const localWedding = require('./config/wedding.js');

App({
  globalData: {
    wedding: localWedding,   // 启动时先用本地的，云端拉到后覆盖
    opened: false,
    openid: '',
    isAdmin: false,
    hasAdmin: false,         // 是否已有管理员（false = 还没人认领）
    remote: false,           // 当前配置是否来自云端
    wishes: [],
  },

  _ready: false,
  _cbs: [],

  onLaunch() {
    if (!wx.cloud) {
      console.error('基础库过低，无法使用云能力');
      this.flush();
      return;
    }
    wx.cloud.init({ env: wx.cloud.DYNAMIC_CURRENT_ENV, traceUser: true });
    this.loadConfig().catch(() => this.flush());
  },

  /* 页面统一用 app.ready(cb) 拿配置，避免异步时序问题 */
  ready(cb) {
    if (this._ready) cb(this.globalData.wedding);
    else this._cbs.push(cb);
  },

  flush() {
    this._ready = true;
    const cbs = this._cbs;
    this._cbs = [];
    cbs.forEach((cb) => {
      try { cb(this.globalData.wedding); } catch (e) { console.error(e); }
    });
  },

  /* 拉云端配置；force=true 时强制重拉（管理页保存后调用） */
  loadConfig(force) {
    if (this._loading) return this._loading;
    this._loading = wx.cloud
      .callFunction({ name: 'getConfig', data: { t: force ? Date.now() : 0 } })
      .then((res) => {
        const r = (res && res.result) || {};
        if (r.openid) this.globalData.openid = r.openid;
        this.globalData.isAdmin = !!r.isAdmin;
        this.globalData.hasAdmin = !!r.hasAdmin;

        if (r.config && Object.keys(r.config).length) {
          // 云端配置与本地合并：本地缺的字段用默认值兜底
          this.globalData.wedding = this.merge(localWedding, r.config);
          this.globalData.remote = true;
        }
        this.flush();
        return this.globalData.wedding;
      })
      .catch((err) => {
        console.warn('拉取云端配置失败，使用本地配置', err);
        this.flush();
        return this.globalData.wedding;
      })
      .finally(() => { this._loading = null; });
    return this._loading;
  },

  // 深浅合并：只覆盖普通对象，数组直接用云端值
  merge(base, remote) {
    const out = {};
    Object.keys(base).forEach((k) => { out[k] = base[k]; });
    Object.keys(remote).forEach((k) => {
      const b = base[k];
      const r = remote[k];
      if (b && r && typeof b === 'object' && typeof r === 'object' && !Array.isArray(b) && !Array.isArray(r)) {
        out[k] = this.merge(b, r);
      } else {
        out[k] = r;
      }
    });
    return out;
  },

  /* 管理页保存后调用：重拉并通知所有页面刷新 */
  refresh() {
    this._ready = false;
    return this.loadConfig(true);
  },

  /* ---------- 背景音乐 ---------- */
  _bgm: null,
  _bgmOn: false,
  _bgmOff: false,     // 宾客手动关掉后，不再自动播放
  _bgmWas: false,

  onHide() {
    this._bgmWas = this._bgmOn;
  },

  onShow() {
    if (this._bgmWas) this.playMusic();
  },

  musicConf() { return this.globalData.wedding.music || {}; },
  hasMusic() { return !!this.musicConf().src; },
  musicOn() { return this._bgmOn; },

  playMusic() {
    const src = this.musicConf().src;
    if (!src) return;
    if (!this._bgm) {
      // 静音模式下也播放，且不打断宾客正在听的其他音频
      if (wx.setInnerAudioOption) wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true });
      const a = wx.createInnerAudioContext();
      a.loop = true;
      a.onPlay(() => this.setMusic(true));
      a.onPause(() => this.setMusic(false));
      a.onStop(() => this.setMusic(false));
      a.onError((e) => { console.warn('背景音乐播放失败', e); this.setMusic(false); });
      this._bgm = a;
    }
    if (this._bgmSrc !== src) { this._bgmSrc = src; this._bgm.src = src; }
    this._bgm.play();
  },

  pauseMusic() {
    if (this._bgm) this._bgm.pause();
  },

  toggleMusic() {
    if (this._bgmOn) { this._bgmOff = true; this.pauseMusic(); }
    else { this._bgmOff = false; this.playMusic(); }
  },

  // 进入页面时调用：配置了音乐、允许自动播放、宾客没手动关过，就开始放
  autoMusic() {
    const m = this.musicConf();
    if (m.src && m.autoplay !== false && !this._bgmOff && !this._bgmOn) this.playMusic();
  },

  setMusic(on) {
    this._bgmOn = on;
    getCurrentPages().forEach((p) => {
      if (p.data && p.data.hasMusic !== undefined) p.setData({ musicOn: on });
    });
  },
});
