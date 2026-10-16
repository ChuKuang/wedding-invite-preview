/* 极简 WXML / WXSS 渲染器：只覆盖本工程用到的语法 */
(function () {
  const RPX = 375 / 750;
  const VOID = new Set(['br', 'input', 'image', 'img', 'import', 'include', 'icon', 'wxs']);
  const TAG = {
    view: 'div', text: 'span', image: 'img', 'scroll-view': 'div', map: 'div',
    swiper: 'div', 'swiper-item': 'div', navigator: 'a', icon: 'i', form: 'div',
    button: 'button', input: 'input', textarea: 'textarea', label: 'label', i: 'i', br: 'br',
  };

  /* ---------------- 解析 ---------------- */
  function decode(s) {
    return s
      .replace(/&nbsp;/g, '\u00a0').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&amp;/g, '&');
  }

  function findTag(s, i) {
    while (i < s.length) {
      if (s.startsWith('{{', i)) {
        const e = s.indexOf('}}', i + 2);
        i = e < 0 ? s.length : e + 2;
        continue;
      }
      if (s[i] === '<' && /[A-Za-z\/]/.test(s[i + 1] || '')) return i;
      i++;
    }
    return s.length;
  }

  function parse(src) {
    src = src.replace(/<!--[\s\S]*?-->/g, '');
    const root = { tag: '#root', attrs: {}, children: [] };
    const stack = [root];
    const top = () => stack[stack.length - 1];
    const ws = (c) => c === ' ' || c === '\n' || c === '\r' || c === '\t';
    let i = 0;
    while (i < src.length) {
      const lt = findTag(src, i);
      if (lt > i) {
        const raw = src.slice(i, lt);
        if (!/^[ \t\r\n]*$/.test(raw)) top().children.push({ text: decode(raw).replace(/\\n/g, '\n') });
      }
      if (lt >= src.length) break;
      if (src[lt + 1] === '/') {
        const gt = src.indexOf('>', lt);
        const name = src.slice(lt + 2, gt).trim();
        for (let k = stack.length - 1; k > 0; k--) {
          if (stack[k].tag === name) { stack.length = k; break; }
        }
        i = gt + 1;
        continue;
      }
      let j = lt + 1;
      const name = /^[\w:-]+/.exec(src.slice(j))[0];
      j += name.length;
      const attrs = {};
      let self = false;
      while (j < src.length) {
        while (ws(src[j])) j++;
        if (src[j] === '/' && src[j + 1] === '>') { self = true; j += 2; break; }
        if (src[j] === '>') { j++; break; }
        const an = /^[^\s=\/>]+/.exec(src.slice(j))[0];
        j += an.length;
        while (ws(src[j])) j++;
        if (src[j] === '=') {
          j++;
          while (ws(src[j])) j++;
          const q = src[j];
          if (q === '"' || q === "'") {
            const e = src.indexOf(q, j + 1);
            attrs[an] = decode(src.slice(j + 1, e));
            j = e + 1;
          } else {
            const v = /^[^\s>]+/.exec(src.slice(j))[0];
            attrs[an] = v;
            j += v.length;
          }
        } else {
          attrs[an] = true;
        }
      }
      const node = { tag: name, attrs, children: [] };
      top().children.push(node);
      if (!self && !VOID.has(name)) stack.push(node);
      i = j;
    }
    return root;
  }

  /* ---------------- 表达式 ---------------- */
  const fnCache = new Map();
  const proxyCache = new WeakMap();
  function scopeProxy(obj) {
    let p = proxyCache.get(obj);
    if (!p) {
      p = new Proxy(obj, {
        has: (t, k) => typeof k === 'string',
        get: (t, k) => (k === Symbol.unscopables ? undefined : t[k]),
      });
      proxyCache.set(obj, p);
    }
    return p;
  }
  function evalExpr(expr, scope) {
    let f = fnCache.get(expr);
    if (!f) {
      try { f = new Function('$s', 'with($s){return (' + expr + ');}'); }
      catch (e) { console.warn('[预览] 表达式无法解析：', expr); f = () => undefined; }
      fnCache.set(expr, f);
    }
    try { return f(scopeProxy(scope)); } catch (e) { return undefined; }
  }
  const MUS = /\{\{([\s\S]*?)\}\}/g;
  function interp(str, scope) {
    if (typeof str !== 'string' || str.indexOf('{{') < 0) return str;
    const t = str.trim();
    const all = t.match(MUS);
    if (all && all.length === 1 && t.startsWith('{{') && t.endsWith('}}')) {
      return evalExpr(t.slice(2, -2), scope);
    }
    return str.replace(MUS, (_, e) => {
      const v = evalExpr(e, scope);
      return v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    });
  }

  /* ---------------- 模板 → 虚拟节点 ---------------- */
  function child(scope, extra) {
    const s = Object.create(scope);
    Object.assign(s, extra);
    return s;
  }

  function renderNodes(nodes, scope, out) {
    let chainHit = false;
    for (const node of nodes) {
      if (node.text !== undefined) {
        const v = interp(node.text, scope);
        out.push({ t: v == null ? '' : String(v) });
        continue;
      }
      const a = node.attrs;
      if ('wx:for' in a) {
        let list = interp(a['wx:for'], scope);
        if (typeof list === 'number') list = Array.from({ length: list }, (_, k) => k);
        if (typeof list === 'string') list = list.split('');
        const itemName = a['wx:for-item'] || 'item';
        const idxName = a['wx:for-index'] || 'index';
        const entries = Array.isArray(list) ? list.map((v, k) => [k, v])
          : list && typeof list === 'object' ? Object.keys(list).map((k) => [k, list[k]]) : [];
        for (const [k, v] of entries) {
          const s = child(scope, { [itemName]: v, [idxName]: k });
          if ('wx:if' in a && !interp(a['wx:if'], s)) continue;
          renderEl(node, s, out);
        }
        chainHit = false;
        continue;
      }
      if ('wx:if' in a) {
        chainHit = !!interp(a['wx:if'], scope);
        if (!chainHit) continue;
      } else if ('wx:elif' in a) {
        if (chainHit) continue;
        chainHit = !!interp(a['wx:elif'], scope);
        if (!chainHit) continue;
      } else if ('wx:else' in a) {
        if (chainHit) continue;
        chainHit = true;
      } else {
        chainHit = false;
      }
      renderEl(node, scope, out);
    }
    return out;
  }

  const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

  function renderEl(node, scope, out) {
    const tag = node.tag;
    if (tag === 'block') { renderNodes(node.children, scope, out); return; }
    if (tag === 'import' || tag === 'include' || tag === 'wxs' || tag === 'template') return;
    const v = { tag, props: {}, events: {}, ds: {}, children: [] };
    for (const k in node.attrs) {
      if (k.startsWith('wx:')) continue;
      const val = interp(node.attrs[k], scope);
      const ev = /^(capture-bind|capture-catch|mut-bind|bind|catch):?(.+)$/.exec(k);
      if (ev) { v.events[ev[2]] = { handler: val, stop: ev[1].indexOf('catch') >= 0 }; continue; }
      if (k.startsWith('data-')) { v.ds[camel(k.slice(5))] = val; continue; }
      v.props[k] = val;
    }
    if (!VOID.has(tag)) renderNodes(node.children, scope, v.children);
    out.push(v);
  }

  /* ---------------- 虚拟节点 → DOM（按位置打补丁，保住输入焦点） ---------------- */
  const rpx = (s) => String(s).replace(/(-?\d*\.?\d+)rpx/g, (_, n) => +(n * RPX).toFixed(3) + 'px');

  function mapSrc(src) {
    if (!src || typeof src !== 'string') return '';
    if (/^(data:|blob:|https?:)/.test(src)) return src;
    if (src.startsWith('cloud://')) return '';
    return src.startsWith('/') ? window.WXP_ROOT + src : src;
  }

  function autosize(el) {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }

  function fire(el, type, native, detail) {
    const h = el.__ev && el.__ev[type];
    if (!h) return;
    if (h.stop) native.stopPropagation();
    const page = el.__page;
    const fn = page && page[h.handler];
    if (typeof fn !== 'function') { console.warn('[预览] 页面上没有方法：', h.handler); return; }
    const tgt = native.target && native.target.__ds ? native.target : el;
    fn.call(page, {
      type, timeStamp: Date.now(), detail: detail || {}, mark: {},
      currentTarget: { id: el.id, dataset: Object.assign({}, el.__ds) },
      target: { id: tgt.id, dataset: Object.assign({}, tgt.__ds) },
    });
  }

  function create(v) {
    if (v.t !== undefined) return document.createTextNode(v.t);
    const el = document.createElement(TAG[v.tag] || 'div');
    el.__tag = v.tag;
    el.addEventListener('click', (e) => fire(el, 'tap', e, { x: e.clientX, y: e.clientY }));
    if (v.tag === 'input' || v.tag === 'textarea') {
      el.addEventListener('input', (e) => {
        if (el.__auto) autosize(el);
        fire(el, 'input', e, { value: el.value, cursor: el.selectionStart });
      });
      el.addEventListener('focus', (e) => fire(el, 'focus', e, { value: el.value }));
      el.addEventListener('blur', (e) => fire(el, 'blur', e, { value: el.value }));
      el.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && v.tag === 'input') fire(el, 'confirm', e, { value: el.value });
      });
    }
    if (v.tag === 'button') el.type = 'button';
    return el;
  }

  function apply(el, v, page) {
    const p = v.props;
    el.__page = page;
    el.__ev = v.events;
    el.__ds = v.ds;
    const cls = ['wx-' + v.tag];
    if (p.class) cls.push(String(p.class));
    if (v.tag === 'image') cls.push('wx-mode-' + (p.mode || 'scaleToFill'));
    if (p['placeholder-class']) String(p['placeholder-class']).split(/\s+/).forEach((c) => c && cls.push('ph-' + c));
    if (Object.keys(v.events).length) cls.push('wx-tappable');
    const c = cls.join(' ');
    if (el.className !== c) el.className = c;

    let style = p.style ? rpx(p.style) : '';
    if (p.hidden === true || (p.hidden && p.hidden !== 'false')) style += ';display:none';
    if (el.getAttribute('style') !== style) {
      if (style) el.setAttribute('style', style); else el.removeAttribute('style');
    }
    if (p.id && el.id !== p.id) el.id = p.id;

    switch (v.tag) {
      case 'image': {
        const s = mapSrc(p.src);
        if (el.__src !== s) {
          el.__src = s;
          if (s) el.src = s; else el.removeAttribute('src');
        }
        break;
      }
      case 'input':
      case 'textarea': {
        if (p.placeholder != null && el.placeholder !== String(p.placeholder)) el.placeholder = p.placeholder;
        const ml = +p.maxlength;
        if (ml > 0) el.maxLength = ml; else if (p.maxlength != null) el.removeAttribute('maxlength');
        if (v.tag === 'input') {
          const t = p.type === 'number' || p.type === 'digit' || p.type === 'idcard' ? 'text' : (p.password ? 'password' : 'text');
          if (el.type !== t) el.type = t;
          if (p.type === 'number') el.inputMode = 'numeric';
          if (p.type === 'digit') el.inputMode = 'decimal';
        }
        el.disabled = !!p.disabled && p.disabled !== 'false';
        const val = p.value == null ? '' : String(p.value);
        if (el.value !== val) el.value = val;
        el.__auto = v.tag === 'textarea' && p['auto-height'] !== undefined && p['auto-height'] !== false;
        if (el.__auto) requestAnimationFrame(() => autosize(el));
        break;
      }
      case 'scroll-view':
        el.style.overflowX = p['scroll-x'] ? 'auto' : '';
        el.style.overflowY = p['scroll-y'] ? 'auto' : '';
        break;
      case 'map': {
        const key = p.latitude + ',' + p.longitude;
        if (el.__key !== key) {
          el.__key = key;
          el.innerHTML = window.WXP_MAP ? window.WXP_MAP(p) : '';
        }
        break;
      }
    }
  }

  function patchChildren(parent, vkids, page) {
    for (let i = 0; i < vkids.length; i++) {
      const v = vkids[i];
      const cur = parent.childNodes[i];
      const same = cur && (v.t !== undefined ? cur.nodeType === 3 : cur.nodeType === 1 && cur.__tag === v.tag);
      if (same) {
        if (v.t !== undefined) { if (cur.nodeValue !== v.t) cur.nodeValue = v.t; }
        else update(cur, v, page);
      } else {
        const el = create(v);
        if (v.t === undefined) update(el, v, page);
        if (cur) parent.replaceChild(el, cur); else parent.appendChild(el);
      }
    }
    while (parent.childNodes.length > vkids.length) parent.removeChild(parent.lastChild);
  }

  function update(el, v, page) {
    apply(el, v, page);
    if (v.tag !== 'map' && !VOID.has(v.tag)) patchChildren(el, v.children, page);
  }

  function render(tree, data, rootEl, page) {
    const vkids = renderNodes(tree.children, data, []);
    patchChildren(rootEl, vkids, page);
  }

  /* ---------------- WXSS → CSS ---------------- */
  const SEL_TAG = /(^|[\s>+~(,])(view|text|image|scroll-view|swiper-item|swiper|navigator|map)(?=$|[\s>+~.:#\[,)])/g;
  const SEL_MAP = { view: 'div', text: 'span', image: 'img', 'scroll-view': 'div', 'swiper-item': 'div', swiper: 'div', navigator: 'a', map: 'div' };

  function scopeSel(sel, scope) {
    sel = sel.trim();
    if (/^page(?=$|[\s.:#\[>+~])/.test(sel)) return ':where(' + scope + ')' + sel.slice(4);
    return ':where(' + scope + ') ' + sel.replace(SEL_TAG, (_, p, t) => p + SEL_MAP[t]);
  }

  function css(src, scope) {
    src = rpx(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@import[^;]*;/g, ''));
    let out = '';
    let i = 0;
    while (i < src.length) {
      const ob = src.indexOf('{', i);
      if (ob < 0) break;
      const sel = src.slice(i, ob).trim();
      let depth = 1;
      let j = ob + 1;
      while (j < src.length && depth) {
        if (src[j] === '{') depth++;
        else if (src[j] === '}') depth--;
        j++;
      }
      const body = src.slice(ob + 1, j - 1);
      if (/^@(media|supports)/.test(sel)) out += sel + '{' + css(body, scope) + '}\n';
      else if (sel.startsWith('@')) out += sel + '{' + body + '}\n';
      else {
        const parts = sel.split(',');
        out += parts.map((s) => scopeSel(s, scope)).join(',') + '{' + body + '}\n';
        const ph = parts.map((s) => s.trim()).filter((s) => /^\.[\w-]+$/.test(s));
        if (ph.length) out += ph.map((s) => ':where(' + scope + ') .ph-' + s.slice(1) + '::placeholder').join(',') + '{' + body + '}\n';
      }
      i = j;
    }
    return out;
  }

  window.WXML = { parse, render, css, rpx, mapSrc };
})();
