/* wx.* 接口与云开发的浏览器模拟。数据存在 localStorage，前缀 wxp: */
(function () {
  const LS = 'wxp:';
  const $ = (sel) => document.querySelector(sel);
  const later = (fn, ms) => setTimeout(fn, ms == null ? 0 : ms);
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function cb(opt, ok, res) {
    opt = opt || {};
    const fn = ok ? opt.success : opt.fail;
    try { fn && fn(res); } finally { opt.complete && opt.complete(res); }
  }

  /* ---------------- 浮层：toast / loading / modal / 看大图 ---------------- */
  let toastTimer = null;
  function layer() { return $('#wx-layer'); }

  function showToast(o) {
    o = o || {};
    clearTimeout(toastTimer);
    const icon = o.icon === undefined ? 'success' : o.icon;
    const box = icon === 'none'
      ? `<div class="wx-toast text">${esc(o.title)}</div>`
      : `<div class="wx-toast"><div class="wx-toast-ico ${icon}"></div><div>${esc(o.title)}</div></div>`;
    $('#wx-toast').innerHTML = (o.mask ? '<div class="wx-mask clear"></div>' : '') + box;
    if (icon !== 'loading') toastTimer = setTimeout(() => { $('#wx-toast').innerHTML = ''; }, o.duration || 1500);
    cb(o, true, { errMsg: 'showToast:ok' });
  }
  function hideToast(o) { clearTimeout(toastTimer); $('#wx-toast').innerHTML = ''; cb(o, true, {}); }

  function showModal(o) {
    o = o || {};
    const wrap = document.createElement('div');
    wrap.className = 'wx-modal-wrap';
    const showCancel = o.showCancel !== false;
    wrap.innerHTML = `<div class="wx-mask"></div><div class="wx-modal">
      ${o.title ? `<div class="wx-modal-t">${esc(o.title)}</div>` : ''}
      ${o.content ? `<div class="wx-modal-c">${esc(o.content)}</div>` : ''}
      <div class="wx-modal-b">
        ${showCancel ? `<div class="c" style="color:${o.cancelColor || '#000'}">${esc(o.cancelText || '取消')}</div>` : ''}
        <div class="ok" style="color:${o.confirmColor || '#576B95'}">${esc(o.confirmText || '确定')}</div>
      </div></div>`;
    const close = (confirm) => { wrap.remove(); cb(o, true, { confirm, cancel: !confirm }); };
    wrap.querySelector('.ok').onclick = () => close(true);
    const c = wrap.querySelector('.c');
    if (c) c.onclick = () => close(false);
    layer().appendChild(wrap);
  }

  function previewImage(o) {
    const urls = o.urls || [];
    let i = Math.max(0, urls.indexOf(o.current));
    const wrap = document.createElement('div');
    wrap.className = 'wx-viewer';
    const draw = () => {
      wrap.innerHTML = `<img src="${esc(WXML.mapSrc(urls[i]))}"><div class="wx-viewer-n">${i + 1} / ${urls.length}</div>
        <div class="wx-viewer-tip">点左右两侧切换 · 点中间关闭</div>`;
    };
    wrap.onclick = (e) => {
      const r = wrap.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width;
      if (x < 0.28 && i > 0) { i--; draw(); }
      else if (x > 0.72 && i < urls.length - 1) { i++; draw(); }
      else wrap.remove();
    };
    draw();
    layer().appendChild(wrap);
    cb(o, true, {});
  }

  /* ---------------- 模拟的云数据库 ---------------- */

  function db() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(LS + 'db')); } catch (e) { /* 首次 */ }
    if (!d) d = { config: null, admins: [], rsvp: [], wishes: [] };
    return d;
  }
  function saveDb(d) {
    try { localStorage.setItem(LS + 'db', JSON.stringify(d)); }
    catch (e) { console.warn('[预览] 本地存储写满了（多半是上传的图片太大）', e); throw new Error('浏览器本地存储已满'); }
  }
  function openid() {
    let id = localStorage.getItem(LS + 'openid');
    if (!id) { id = 'o-preview-' + Math.random().toString(36).slice(2, 10); localStorage.setItem(LS + 'openid', id); }
    return id;
  }

  const FUNCS = {
    getConfig() {
      const d = db();
      return {
        ok: true, openid: openid(), config: d.config,
        isAdmin: d.admins.indexOf(openid()) > -1, hasAdmin: d.admins.length > 0,
      };
    },
    saveConfig(ev) {
      const d = db();
      const me = openid();
      if (ev.action === 'claim') {
        if (d.admins.length) return { ok: false, err: '已经有人认领过了' };
        d.admins = [me];
        d.config = ev.config || {};
        saveDb(d);
        return { ok: true, isAdmin: true, claimed: true };
      }
      if (d.admins.indexOf(me) < 0) return { ok: false, err: '没有权限' };
      const ALLOWED = ['couple', 'cover', 'wedding', 'venue', 'letter', 'schedule', 'tips', 'trips', 'albumHero',
        'wishHero', 'rsvpHero', 'heroPhoto', 'routes', 'contact', 'rsvpText', 'wishText', 'features', 'music'];
      const clean = {};
      ALLOWED.forEach((k) => { if (ev.config && ev.config[k] !== undefined) clean[k] = ev.config[k]; });
      d.config = clean;
      saveDb(d);
      return { ok: true, updatedAt: Date.now() };
    },
    addRsvp(ev) {
      const d = db();
      const name = String(ev.name || '').trim().slice(0, 20);
      if (!name) return { ok: false, err: '缺少称呼' };
      const attend = ev.attend === 'no' ? 'no' : 'yes';
      const doc = {
        _id: 'r' + Date.now(), openid: ev.openid || openid(), name, attend,
        count: attend === 'yes' ? Math.min(20, Math.max(1, parseInt(ev.count, 10) || 1)) : 0,
        phone: String(ev.phone || '').slice(0, 11), addr: String(ev.addr || '').slice(0, 120),
        message: String(ev.message || '').slice(0, 200), updatedAt: Date.now(),
      };
      const i = d.rsvp.findIndex((x) => x.openid === doc.openid);
      if (i > -1) d.rsvp[i] = Object.assign(d.rsvp[i], doc, { _id: d.rsvp[i]._id }); else d.rsvp.push(doc);
      saveDb(d);
      return { ok: true, updated: i > -1 };
    },
    addWish(ev) {
      const d = db();
      const type = ev.type === 'voice' ? 'voice' : 'text';
      const content = String(ev.content || '').trim().slice(0, 200);
      if (type === 'text' && !content) return { ok: false, err: '内容为空' };
      d.wishes.push({
        _id: 'w' + Date.now(), openid: openid(), status: 'pass', type, content,
        name: String(ev.name || '一位朋友').slice(0, 20), fileID: ev.fileID || '',
        duration: Math.min(60, parseInt(ev.duration, 10) || 0), createdAt: Date.now(),
      });
      saveDb(d);
      return { ok: true, status: 'pass' };
    },
    getWishes(ev) {
      const list = db().wishes.filter((x) => x.status === 'pass').sort((a, b) => b.createdAt - a.createdAt);
      const skip = +ev.skip || 0;
      return { ok: true, total: list.length, list: list.slice(skip, skip + (+ev.limit || 20)) };
    },
    getRsvpCount() {
      const r = db().rsvp;
      const yes = r.filter((x) => x.attend === 'yes');
      return { ok: true, openid: openid(), yes: yes.length, no: r.length - yes.length, people: yes.reduce((s, x) => s + (x.count || 1), 0) };
    },
    adminRsvp() {
      const d = db();
      if (d.admins.indexOf(openid()) < 0) return { ok: false, err: '没有权限' };
      const list = d.rsvp.slice().sort((a, b) => b.updatedAt - a.updatedAt);
      const yes = list.filter((x) => x.attend === 'yes');
      const people = yes.reduce((s, x) => s + (x.count || 1), 0);
      return { ok: true, list, stat: { yes: yes.length, no: list.length - yes.length, people, tables: Math.ceil(people / 10) } };
    },
  };

  function asPromise(o, work, delay) {
    return new Promise((resolve, reject) => {
      later(() => {
        try {
          const res = work();
          cb(o, true, res);
          resolve(res);
        } catch (e) {
          const err = { errMsg: String(e.message || e), message: String(e.message || e) };
          cb(o, false, err);
          reject(err);
        }
      }, delay == null ? 180 : delay);
    });
  }

  const cloud = {
    DYNAMIC_CURRENT_ENV: 'preview',
    init() {},
    callFunction(o) {
      return asPromise(o, () => {
        const fn = FUNCS[o.name];
        if (!fn) throw new Error('云函数不存在：' + o.name);
        const result = fn(o.data || {});
        console.info('[预览·云函数]', o.name, o.data || {}, '→', result);
        return { result, errMsg: 'cloud.callFunction:ok' };
      });
    },
    uploadFile(o) {
      // 图片已是 dataURL，直接当 fileID；音乐等大文件存进 IndexedDB
      if (!String(o.filePath).startsWith('blob:')) return asPromise(o, () => ({ fileID: o.filePath, statusCode: 200 }), 300);
      const key = 'f' + Date.now() + Math.random().toString(36).slice(2, 6);
      return fetch(o.filePath).then((r) => r.blob()).then((b) => idbPut(key, b)).then(() => {
        const res = { fileID: CLOUD + key, statusCode: 200 };
        cb(o, true, res);
        return res;
      }, (e) => { const err = { errMsg: String(e.message || e) }; cb(o, false, err); throw err; });
    },
    getTempFileURL(o) {
      return Promise.all((o.fileList || []).map((f) => resolveUrl(f).then((u) => ({ fileID: f, tempFileURL: u }), () => ({ fileID: f, tempFileURL: '' }))))
        .then((fileList) => { const res = { fileList }; cb(o, true, res); return res; });
    },
  };

  /* ---------------- 录音 / 播放 ---------------- */
  function recorderManager() {
    const h = { start: [], stop: [], error: [] };
    let mr = null;
    let chunks = [];
    let t0 = 0;
    const emit = (k, v) => h[k].forEach((f) => f(v));
    return {
      onStart: (f) => h.start.push(f),
      onStop: (f) => h.stop.push(f),
      onError: (f) => h.error.push(f),
      start() {
        if (!navigator.mediaDevices || !window.MediaRecorder) { emit('error', { errMsg: '浏览器不支持录音' }); return; }
        navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
          chunks = [];
          mr = new MediaRecorder(stream);
          mr.ondataavailable = (e) => chunks.push(e.data);
          mr.onstop = () => {
            stream.getTracks().forEach((t) => t.stop());
            const blob = new Blob(chunks, { type: mr.mimeType || 'audio/webm' });
            const reader = new FileReader();
            reader.onload = () => emit('stop', { tempFilePath: reader.result, duration: Date.now() - t0, fileSize: blob.size });
            reader.readAsDataURL(blob);
          };
          t0 = Date.now();
          mr.start();
          emit('start', {});
        }).catch((e) => emit('error', { errMsg: '麦克风不可用：' + e.message }));
      },
      stop() { if (mr && mr.state !== 'inactive') mr.stop(); },
    };
  }

  function audioContext() {
    const a = new Audio();
    const h = { play: [], pause: [], stop: [], error: [], ended: [] };
    const emit = (k, v) => h[k].forEach((f) => f(v || {}));
    let src = '';
    let ready = Promise.resolve();
    a.addEventListener('play', () => emit('play'));
    a.addEventListener('pause', () => { if (!a.ended) emit('pause'); });
    a.addEventListener('ended', () => emit('ended'));
    a.addEventListener('error', () => { if (a.getAttribute('src')) emit('error', { errMsg: '音频无法播放' }); });
    return {
      get src() { return src; },
      set src(v) {
        src = v || '';
        if (!src) { a.removeAttribute('src'); ready = Promise.resolve(); return; }
        ready = resolveUrl(src).then((u) => { a.src = u; }).catch((e) => emit('error', { errMsg: e.message }));
      },
      get loop() { return a.loop; },
      set loop(v) { a.loop = !!v; },
      obeyMuteSwitch: false,
      play() {
        ready.then(() => a.play()).catch((e) => emit('error', {
          errMsg: e && e.name === 'NotAllowedError' ? '浏览器拦截了自动播放，点一下右上角唱片即可' : String(e && e.message),
        }));
      },
      pause: () => a.pause(),
      stop: () => { a.pause(); a.currentTime = 0; emit('stop'); },
      onPlay: (f) => h.play.push(f),
      onPause: (f) => h.pause.push(f),
      onStop: (f) => h.stop.push(f),
      onEnded: (f) => h.ended.push(f),
      onError: (f) => h.error.push(f),
      destroy: () => a.pause(),
    };
  }

  /* ---------------- 大文件（音乐）存 IndexedDB，fileID 仿照云存储的 cloud:// 格式 ---------------- */
  const CLOUD = 'cloud://preview/';
  let idbOpen = null;
  function idb() {
    if (!idbOpen) {
      idbOpen = new Promise((res, rej) => {
        const r = indexedDB.open('wxp-files', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('f');
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
    }
    return idbOpen;
  }
  function idbPut(key, blob) {
    return idb().then((d) => new Promise((res, rej) => {
      const tx = d.transaction('f', 'readwrite');
      tx.objectStore('f').put(blob, key);
      tx.oncomplete = () => res();
      tx.onerror = () => rej(tx.error);
    }));
  }
  function idbGet(key) {
    return idb().then((d) => new Promise((res, rej) => {
      const q = d.transaction('f').objectStore('f').get(key);
      q.onsuccess = () => res(q.result);
      q.onerror = () => rej(q.error);
    }));
  }
  const urlCache = {};
  function resolveUrl(src) {
    if (!src.startsWith(CLOUD)) return Promise.resolve(WXML.mapSrc(src) || src);
    const key = src.slice(CLOUD.length);
    if (urlCache[key]) return Promise.resolve(urlCache[key]);
    return idbGet(key).then((b) => {
      if (!b) throw new Error('预览里找不到这个文件（可能清过数据），请重新上传');
      urlCache[key] = URL.createObjectURL(b);
      return urlCache[key];
    });
  }

  /* ---------------- 从聊天记录选文件：浏览器里改为选本地文件 ---------------- */
  function chooseMessageFile(o) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = (o.extension || []).map((e) => '.' + e).join(',') || '*/*';
    input.onchange = () => {
      const f = input.files[0];
      if (!f) return cb(o, false, { errMsg: 'chooseMessageFile:fail cancel' });
      cb(o, true, { tempFiles: [{ path: URL.createObjectURL(f), name: f.name, size: f.size, type: 'file', time: Date.now() }] });
    };
    input.click();
  }

  /* ---------------- 文件系统 + 发送文件：浏览器里改为直接下载 ---------------- */
  const memfs = {};
  const fsManager = {
    writeFileSync(path, data) { memfs[path] = data; },
    writeFile(o) { memfs[o.filePath] = o.data; later(() => cb(o, true, {})); },
    readFileSync(path) { if (!(path in memfs)) throw new Error('no such file ' + path); return memfs[path]; },
  };
  function shareFileMessage(o) {
    if (!(o.filePath in memfs)) return cb(o, false, { errMsg: 'shareFileMessage:fail file not found' });
    const blob = new Blob([memfs[o.filePath]], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = o.fileName || 'file';
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast({ title: '预览中改为直接下载', icon: 'none' });
    cb(o, true, {});
  }

  /* ---------------- 选图：压缩后转成 dataURL，刷新后仍然有效 ---------------- */
  function chooseMedia(o) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return cb(o, false, { errMsg: 'chooseMedia:fail cancel' });
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1200 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k);
        cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        // PNG 保持 PNG，否则透明底会变黑
        const url = file.type === 'image/png' ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.82);
        // 模拟 chooseMedia 的 tempFilePath 带扩展名，后面靠它取后缀
        URL.revokeObjectURL(img.src);
        cb(o, true, { type: 'image', tempFiles: [{ tempFilePath: url, size: url.length, fileType: 'image' }] });
      };
      img.src = URL.createObjectURL(file);
    };
    input.click();
  }

  /* ---------------- 导出 wx ---------------- */
  const store = {
    get(k) {
      const raw = localStorage.getItem(LS + 's:' + k);
      if (raw == null) return '';
      try { return JSON.parse(raw); } catch (e) { return ''; }
    },
    set(k, v) { localStorage.setItem(LS + 's:' + k, JSON.stringify(v)); },
  };

  window.wx = {
    cloud,
    canIUse: () => true,
    getSystemInfoSync: () => ({ windowWidth: 375, windowHeight: 667, screenWidth: 375, pixelRatio: 2, platform: 'devtools', SDKVersion: '3.0.0' }),
    getStorageSync: store.get,
    setStorageSync: store.set,
    removeStorageSync: (k) => localStorage.removeItem(LS + 's:' + k),
    getStorage: (o) => later(() => cb(o, true, { data: store.get(o.key) })),
    setStorage: (o) => later(() => { store.set(o.key, o.data); cb(o, true, {}); }),
    showToast,
    hideToast,
    showLoading: (o) => showToast(Object.assign({}, o, { icon: 'loading' })),
    hideLoading: hideToast,
    showModal,
    showActionSheet: (o) => cb(o, false, { errMsg: 'showActionSheet:fail 预览不支持' }),
    vibrateShort: (o) => { if (navigator.vibrate) navigator.vibrate(15); cb(o, true, {}); },
    vibrateLong: (o) => cb(o, true, {}),
    previewImage,
    chooseMedia,
    chooseImage: (o) => chooseMedia({ success: (r) => cb(o, true, { tempFilePaths: r.tempFiles.map((f) => f.tempFilePath), tempFiles: r.tempFiles }), fail: o && o.fail }),
    setClipboardData(o) {
      const done = () => { cb(o, true, {}); showToast({ title: '内容已复制', icon: 'none' }); };
      if (navigator.clipboard) navigator.clipboard.writeText(o.data).then(done, done); else done();
    },
    makePhoneCall: (o) => showModal({ title: '拨打电话', content: o.phoneNumber + '\n（预览中不会真的拨出）', showCancel: false, success: () => cb(o, true, {}) }),
    openLocation(o) {
      const url = `https://uri.amap.com/marker?position=${o.longitude},${o.latitude}&name=${encodeURIComponent(o.name || '')}&coordinate=gaode&callnative=0`;
      window.open(url, '_blank');
      cb(o, true, {});
    },
    getLocation: (o) => cb(o, false, { errMsg: 'getLocation:fail 预览不支持' }),
    authorize: (o) => later(() => cb(o, true, { errMsg: 'authorize:ok' })),
    openSetting: (o) => cb(o, true, { authSetting: {} }),
    getSetting: (o) => cb(o, true, { authSetting: {} }),
    getRecorderManager: recorderManager,
    getImageInfo(o) {
      const img = new Image();
      img.onload = () => cb(o, true, { width: img.naturalWidth, height: img.naturalHeight, path: o.src });
      img.onerror = () => cb(o, false, { errMsg: 'getImageInfo:fail' });
      img.src = o.src;
    },
    createOffscreenCanvas(opt) {
      const cv = document.createElement('canvas');
      cv.width = opt.width; cv.height = opt.height;
      cv.createImage = () => new Image();
      return cv;
    },
    canvasToTempFilePath(o) {
      try { cb(o, true, { tempFilePath: o.canvas.toDataURL(o.fileType === 'jpg' ? 'image/jpeg' : 'image/png') }); }
      catch (e) { cb(o, false, { errMsg: 'canvasToTempFilePath:fail ' + e.message }); }
    },
    createInnerAudioContext: audioContext,
    setInnerAudioOption: (o) => cb(o, true, {}),
    chooseMessageFile,
    getFileSystemManager: () => fsManager,
    shareFileMessage,
    env: { USER_DATA_PATH: 'wxfile://usr' },
    stopPullDownRefresh: () => {},
    startPullDownRefresh: () => {},
    pageScrollTo: (o) => { const s = $('.wx-scroll'); if (s) s.scrollTo({ top: o.scrollTop || 0, behavior: 'smooth' }); },
    setNavigationBarTitle: (o) => { const t = $('#wx-nav-title'); if (t) t.textContent = o.title; },
    showShareMenu: () => {},
    nextTick: (f) => Promise.resolve().then(f),
  };

  // 只清空数据、不删库：连接还开着时 deleteDatabase 会一直挂起，紧接着刷新会把新页面卡死
  window.WXP_RESET = function () {
    Object.keys(localStorage).filter((k) => k.startsWith(LS)).forEach((k) => localStorage.removeItem(k));
    Object.keys(urlCache).forEach((k) => { URL.revokeObjectURL(urlCache[k]); delete urlCache[k]; });
    return idb().then((d) => new Promise((res) => {
      const tx = d.transaction('f', 'readwrite');
      tx.objectStore('f').clear();
      tx.oncomplete = res;
      tx.onerror = res;
    })).catch(() => {});
  };
})();
