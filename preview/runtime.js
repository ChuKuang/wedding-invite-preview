/* 小程序运行时：App / Page / require / 页面栈 / 外壳 */
(function () {
  const ROOT = window.WXP_ROOT;
  const files = {};
  const modules = {};
  const defs = {};
  const tpl = {};
  const pjson = {};
  let appJson = {};
  let appInst = null;
  let loadingRoute = '';
  let stack = [];
  const tabInst = {};
  let tabRoutes = [];

  const $ = (s) => document.querySelector(s);
  const clone = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

  /* ---------------- 加载源码 ---------------- */
  async function fetchText(p) {
    const r = await fetch(ROOT + '/' + p + '?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(p + ' → HTTP ' + r.status);
    return r.text();
  }

  function resolve(from, p) {
    let parts;
    if (p.startsWith('/')) parts = p.slice(1).split('/');
    else {
      parts = from.split('/').slice(0, -1);
      p.split('/').forEach((seg) => {
        if (seg === '..') parts.pop();
        else if (seg && seg !== '.') parts.push(seg);
      });
    }
    let out = parts.join('/');
    if (!out.endsWith('.js')) out += '.js';
    return out;
  }

  function readSync(path) {
    if (files[path] != null) return files[path];
    const x = new XMLHttpRequest();
    x.open('GET', ROOT + '/' + path, false);
    x.send();
    if (x.status !== 200) throw new Error('找不到文件 ' + path);
    files[path] = x.responseText;
    return files[path];
  }

  // <include src="..."/>：把被引用的模板原地展开
  function expandIncludes(node, from) {
    const out = [];
    (node.children || []).forEach((c) => {
      if (c.tag === 'include' && c.attrs && c.attrs.src) {
        const path = resolve(from, c.attrs.src).replace(/\.js$/, '');
        try {
          const sub = WXML.parse(readSync(path));
          expandIncludes(sub, path);
          out.push(...sub.children);
        } catch (e) { console.warn('[预览] include 失败', c.attrs.src, e); }
        return;
      }
      if (c.children) expandIncludes(c, from);
      out.push(c);
    });
    node.children = out;
    return node;
  }

  function loadModule(path) {
    if (modules[path]) return modules[path].exports;
    const src = readSync(path);
    const module = { exports: {} };
    modules[path] = module;
    const fn = new Function('require', 'module', 'exports', 'App', 'Page', 'getApp', 'getCurrentPages', 'wx', 'Component', 'Behavior',
      src + '\n//# sourceURL=' + location.origin + '/miniprogram/' + path);
    fn((p) => loadModule(resolve(path, p)), module, module.exports, App, Page, getApp, getCurrentPages, wx, () => {}, (b) => b);
    return module.exports;
  }

  function App(def) { appInst = def; }
  function getApp() { return appInst; }
  function getCurrentPages() { return stack.slice(); }
  function Page(def) { defs[loadingRoute] = def; }

  /* ---------------- 页面实例 ---------------- */
  function setPath(obj, path, val) {
    const keys = path.replace(/\[(\d+)\]/g, '.$1').split('.');
    const last = keys.pop();
    let o = obj;
    keys.forEach((k, i) => {
      if (o[k] == null || typeof o[k] !== 'object') o[k] = /^\d+$/.test(keys[i + 1] || last) ? [] : {};
      o = o[k];
    });
    o[last] = val;
  }

  function createPage(route, query) {
    if (!defs[route]) {
      loadingRoute = route;
      loadModule(route + '.js');
    }
    const def = defs[route] || {};
    const inst = {};
    Object.keys(def).forEach((k) => { inst[k] = k === 'data' ? clone(def.data) || {} : def[k]; });
    if (!inst.data) inst.data = {};
    inst.route = route;
    inst.options = query || {};
    inst.__cbs = [];
    inst.__el = document.createElement('div');
    inst.__el.className = 'wx-page';
    inst.__el.setAttribute('data-r', route);
    inst.setData = function (obj, cb) {
      Object.keys(obj || {}).forEach((k) => setPath(this.data, k, clone(obj[k])));
      if (cb) this.__cbs.push(cb);
      schedule(this);
    };
    return inst;
  }

  function schedule(inst) {
    if (inst.__queued) return;
    inst.__queued = true;
    // 用宏任务而不是微任务：真实点击冒泡途中浏览器会清空微任务，
    // 若此时重绘，冒泡到的祖先节点可能已被复用成别的按钮，同一次点击会再触发一次
    setTimeout(() => {
      inst.__queued = false;
      if (inst.__dead) return;
      paint(inst);
      const cbs = inst.__cbs;
      inst.__cbs = [];
      cbs.forEach((f) => f.call(inst));
    });
  }

  function paint(inst) {
    try { WXML.render(tpl[inst.route], inst.data, inst.__el, inst); }
    catch (e) { console.error('[预览] 渲染出错', inst.route, e); }
  }

  const call = (inst, name, arg) => {
    if (typeof inst[name] === 'function') {
      try { return inst[name](arg); } catch (e) { console.error('[预览]', inst.route, name, e); }
    }
  };

  /* ---------------- 页面栈 ---------------- */
  const top = () => stack[stack.length - 1];

  function parseUrl(url) {
    const [p, q] = String(url).split('?');
    let route = p.startsWith('/') ? p.slice(1) : resolve(top() ? top().route : '', p).replace(/\.js$/, '');
    route = route.replace(/\.js$/, '');
    const query = {};
    (q || '').split('&').filter(Boolean).forEach((kv) => {
      const [k, v] = kv.split('=');
      query[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return { route, query };
  }

  function hideTop() {
    const t = top();
    if (!t) return;
    t.__scroll = $('.wx-scroll').scrollTop;
    call(t, 'onHide');
  }

  function unload(inst) {
    if (inst.__dead) return;
    call(inst, 'onUnload');
    inst.__dead = true;
    inst.__el.remove();
    if (tabInst[inst.route] === inst) delete tabInst[inst.route];
  }

  function show(inst, fresh) {
    const scroll = $('.wx-scroll');
    scroll.replaceChildren(inst.__el);
    paint(inst);
    scroll.scrollTop = inst.__scroll || 0;
    updateChrome(inst);
    if (fresh) call(inst, 'onLoad', inst.options);
    call(inst, 'onShow');
    if (fresh) Promise.resolve().then(() => call(inst, 'onReady'));
  }

  function ok(o, name) {
    const res = { errMsg: name + ':ok' };
    o && o.success && o.success(res);
    o && o.complete && o.complete(res);
  }
  function fail(o, name, msg) {
    const res = { errMsg: name + ':fail ' + msg };
    console.warn('[预览]', res.errMsg);
    o && o.fail && o.fail(res);
    o && o.complete && o.complete(res);
  }
  const exists = (r) => (appJson.pages || []).indexOf(r) > -1;

  function navigateTo(o) {
    const { route, query } = parseUrl(o.url);
    if (!exists(route)) return fail(o, 'navigateTo', 'page "' + route + '" is not found');
    if (tabRoutes.indexOf(route) > -1) return fail(o, 'navigateTo', 'can not navigateTo a tabbar page');
    hideTop();
    const inst = createPage(route, query);
    stack.push(inst);
    show(inst, true);
    ok(o, 'navigateTo');
  }

  function redirectTo(o) {
    const { route, query } = parseUrl(o.url);
    if (!exists(route)) return fail(o, 'redirectTo', 'page not found');
    const old = stack.pop();
    if (old) unload(old);
    const inst = createPage(route, query);
    stack.push(inst);
    show(inst, true);
    ok(o, 'redirectTo');
  }

  function switchTab(o) {
    const { route } = parseUrl(o.url);
    if (tabRoutes.indexOf(route) < 0) return fail(o, 'switchTab', 'can not switch to no-tabBar page');
    hideTop();
    stack.forEach((p) => { if (tabRoutes.indexOf(p.route) < 0) unload(p); });
    let inst = tabInst[route];
    const fresh = !inst;
    if (fresh) inst = tabInst[route] = createPage(route, {});
    stack = [inst];
    show(inst, fresh);
    ok(o, 'switchTab');
  }

  function reLaunch(o) {
    const { route, query } = parseUrl(o.url);
    if (!exists(route)) return fail(o, 'reLaunch', 'page not found');
    stack.forEach(unload);
    Object.keys(tabInst).forEach((k) => unload(tabInst[k]));
    const inst = createPage(route, query);
    if (tabRoutes.indexOf(route) > -1) tabInst[route] = inst;
    stack = [inst];
    show(inst, true);
    ok(o, 'reLaunch');
  }

  function navigateBack(o) {
    o = o || {};
    if (stack.length <= 1) return fail(o, 'navigateBack', 'cannot navigate back at first page.');
    const n = Math.min(o.delta || 1, stack.length - 1);
    for (let i = 0; i < n; i++) unload(stack.pop());
    show(top(), false);
    ok(o, 'navigateBack');
  }

  Object.assign(wx, { navigateTo, redirectTo, switchTab, reLaunch, navigateBack });

  /* ---------------- 外壳：状态栏 / 导航栏 / TabBar ---------------- */
  function updateChrome(inst) {
    const win = appJson.window || {};
    const pj = pjson[inst.route] || {};
    const custom = (pj.navigationStyle || win.navigationStyle) === 'custom';
    const screen = $('.wx-screen');
    screen.classList.toggle('custom-nav', custom);
    const navBg = pj.navigationBarBackgroundColor || win.navigationBarBackgroundColor || '#fff';
    const navText = (pj.navigationBarTextStyle || win.navigationBarTextStyle) === 'white' ? '#fff' : '#000';
    const nav = $('.wx-nav');
    nav.style.background = navBg;
    nav.style.color = navText;
    $('.wx-status').style.background = custom ? 'transparent' : navBg;
    $('.wx-status').style.color = custom ? '#fff' : navText;
    $('#wx-nav-title').textContent = pj.navigationBarTitleText || win.navigationBarTitleText || '';
    $('.wx-back').style.visibility = stack.length > 1 ? 'visible' : 'hidden';
    $('.wx-scroll').style.background = pj.backgroundColor || win.backgroundColor || '#fff';

    const isTab = tabRoutes.indexOf(inst.route) > -1;
    const bar = $('.wx-tabbar');
    bar.style.display = isTab ? 'flex' : 'none';
    if (isTab) {
      const tb = appJson.tabBar;
      bar.style.background = tb.backgroundColor || '#fff';
      bar.style.borderTopColor = tb.borderStyle === 'white' ? 'rgba(0,0,0,.04)' : 'rgba(0,0,0,.12)';
      bar.innerHTML = tb.list.map((it) => {
        const on = it.pagePath === inst.route;
        return `<div class="wx-tab" data-url="/${it.pagePath}">
          <img src="${ROOT}/${on ? it.selectedIconPath : it.iconPath}">
          <span style="color:${on ? tb.selectedColor : tb.color}">${it.text}</span></div>`;
      }).join('');
    }
    history.replaceState(null, '', '#/' + inst.route);
    document.querySelectorAll('.pv-page').forEach((b) => b.classList.toggle('on', b.dataset.route === inst.route));
  }

  function bindChrome() {
    $('.wx-back').onclick = () => navigateBack({});
    $('.wx-tabbar').onclick = (e) => {
      const t = e.target.closest('.wx-tab');
      if (t) switchTab({ url: t.dataset.url });
    };
    $('.wx-capsule .more').onclick = () => {
      const t = top();
      const share = t && typeof t.onShareAppMessage === 'function' ? t.onShareAppMessage({ from: 'menu' }) : null;
      wx.showModal({
        title: '转发给朋友（预览）',
        content: share ? '卡片标题：' + share.title + '\n打开路径：' + (share.path || '/' + t.route) : '这个页面没有开启转发',
        showCancel: false,
      });
    };
    $('.wx-capsule .close').onclick = () => reLaunch({ url: '/' + appJson.pages[0] });
    let reached = false;
    $('.wx-scroll').addEventListener('scroll', (e) => {
      const s = e.target;
      const t = top();
      if (!t) return;
      call(t, 'onPageScroll', { scrollTop: s.scrollTop });
      const near = s.scrollHeight - s.scrollTop - s.clientHeight < 50;
      if (near && !reached) call(t, 'onReachBottom');
      reached = near;
    });
    const clock = () => {
      const d = new Date();
      $('.wx-time').textContent = d.getHours() + ':' + String(d.getMinutes()).padStart(2, '0');
    };
    clock();
    setInterval(clock, 30000);
  }

  /* ---------------- 示意地图（浏览器里没有微信地图组件） ---------------- */
  window.WXP_MAP = function (p) {
    const lat = (+p.latitude || 0).toFixed(4);
    const lng = (+p.longitude || 0).toFixed(4);
    return `<svg viewBox="0 0 340 200" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;display:block">
      <rect width="340" height="200" fill="#EFE5D8"/>
      <path d="M-10 150 C60 120 110 170 180 140 S300 90 360 110" stroke="#CFE0E3" stroke-width="18" fill="none"/>
      <rect x="20" y="20" width="70" height="50" rx="6" fill="#DDE8D2"/>
      <rect x="230" y="150" width="90" height="40" rx="6" fill="#DDE8D2"/>
      <rect x="215" y="18" width="60" height="44" rx="6" fill="#E8DCCB"/>
      <g stroke="#FFFDFA" stroke-linecap="round" fill="none">
        <path d="M0 95 H340" stroke-width="9"/><path d="M120 0 V200" stroke-width="7"/>
        <path d="M0 40 L340 70" stroke-width="4"/><path d="M200 0 L250 200" stroke-width="4"/>
      </g>
      <circle cx="170" cy="100" r="16" fill="#C96A4B" opacity=".18"/>
      <circle cx="170" cy="100" r="6.5" fill="#C96A4B" stroke="#fff" stroke-width="2"/>
      <text x="332" y="192" text-anchor="end" font-size="8" fill="#A8968A">示意图 · ${lat}, ${lng}</text>
    </svg>`;
  };

  /* ---------------- 启动 ---------------- */
  async function boot() {
    try {
      appJson = JSON.parse(await fetchText('app.json'));
    } catch (e) {
      $('.wx-scroll').innerHTML = `<div class="pv-err"><b>没读到小程序源码</b><br>${e.message}<br><br>
        请在工程根目录运行<br><code>python -m http.server 8848</code><br>再打开 <code>http://127.0.0.1:8848/preview/</code></div>`;
      return;
    }
    tabRoutes = ((appJson.tabBar || {}).list || []).map((x) => x.pagePath);
    const want = ['app.js', 'app.wxss'];
    appJson.pages.forEach((p) => ['js', 'wxml', 'wxss', 'json'].forEach((ext) => want.push(p + '.' + ext)));
    await Promise.all(want.map((p) => fetchText(p).then((t) => { files[p] = t; }, () => { files[p] = null; })));

    let css = WXML.css(files['app.wxss'] || '', '.wx-page');
    appJson.pages.forEach((p) => {
      if (files[p + '.wxss']) css += WXML.css(files[p + '.wxss'], '.wx-page[data-r="' + p + '"]');
      tpl[p] = expandIncludes(WXML.parse(files[p + '.wxml'] || ''), p + '.wxml');
      try { pjson[p] = JSON.parse(files[p + '.json'] || '{}'); } catch (e) { pjson[p] = {}; }
    });
    $('#wx-css').textContent = css;

    bindChrome();
    loadModule('app.js');
    if (appInst && appInst.onLaunch) appInst.onLaunch({ path: appJson.pages[0], query: {} });
    if (appInst && appInst.onShow) appInst.onShow({});

    const fromHash = location.hash.replace(/^#\/?/, '');
    reLaunch({ url: '/' + (exists(fromHash) ? fromHash : appJson.pages[0]) });
  }

  window.WXP = { reLaunch, navigateTo, switchTab, getApp, getCurrentPages, tabRoutes: () => tabRoutes };
  boot();
})();
