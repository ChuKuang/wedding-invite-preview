const app = getApp();
const music = require('../../utils/music.js');
const recorder = wx.getRecorderManager ? wx.getRecorderManager() : null;
const audio = wx.createInnerAudioContext ? wx.createInnerAudioContext() : null;

function timeText(ts) {
  if (!ts) return '刚刚';
  const diff = Date.now() - ts;
  if (diff < 60000) return '刚刚';
  if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
  if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
  const d = new Date(ts);
  return `${d.getMonth() + 1} 月 ${d.getDate()} 日`;
}

// 用时长和 id 生成稳定的波形，避免每次渲染跳动
function bars(seed, n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const a = Math.sin(i * 1.7 + seed) * 7 + Math.sin(i * 0.6 + seed * 2) * 5;
    out.push(Math.max(8, Math.round(18 + a)));
  }
  return out;
}

Page({
  data: {
    cfg: null,
    list: [],
    total: 0,
    voiceCount: 0,
    loading: true,
    canVoice: false,
    recording: false,
    recSec: 0,
    bars: bars(3, 16),
    defAvatar: '/images/photos/trip3.jpg',
    T: {},
  },

  onShow() {
    app.ready((cfg) => {
      this.setData({
        cfg,
        T: cfg.wishText || {},
        canVoice: !!cfg.features.voiceWish && !!recorder,
      });
      music.sync(this);
    });
  },

  toggleMusic() { music.toggle(); },

  onLoad() {
    this.bindRecorder();
    this.load();
  },

  onUnload() {
    if (audio) audio.stop();
  },

  onPullDownRefresh() {
    app.globalData.wishes = [];
    this.load(() => wx.stopPullDownRefresh());
  },

  onReachBottom() {
    this.load();
  },

  /* ---------- 拉取 ---------- */
  load(done) {
    if (this._loadingAll) return done && done();
    this.setData({ loading: true });
    const cache = app.globalData.wishes;
    if (cache && cache.length) {
      this.render(cache);
      this.setData({ loading: false });
      return done && done();
    }
    wx.cloud
      .callFunction({
        name: 'getWishes',
        data: { skip: 0, limit: 50 },
      })
      .then((res) => {
        const r = (res && res.result) || {};
        const list = r.list || [];
        app.globalData.wishes = list;
        this.setData({ total: r.total || list.length });
        this.render(list);
      })
      .catch((err) => {
        console.warn('拉取祝福失败（可能未部署云函数）', err);
        this.setData({ list: [], total: 0 });
      })
      .finally(() => {
        this.setData({ loading: false });
        done && done();
      });
  },

  render(list) {
    const v = list.filter((x) => x.type === 'voice');
    const rendered = list.map((x, i) => ({
      ...x,
      timeText: timeText(x.createdAt),
      bars: x.type === 'voice' ? bars(i + (x.duration || 10), 22) : [],
      durationText: x.type === 'voice'
        ? `${Math.floor((x.duration || 0) / 60)}:${String(Math.round((x.duration || 0) % 60)).padStart(2, '0')}`
        : '',
    }));
    this.setData({ list: rendered, voiceCount: v.length, total: Math.max(this.data.total, list.length) });
  },

  /* ---------- 录音 ---------- */
  bindRecorder() {
    if (!recorder) return;
    recorder.onStart(() => {
      this.setData({ recording: true, recSec: 0 });
      this._timer = setInterval(() => {
        const s = this.data.recSec + 1;
        this.setData({ recSec: s, bars: bars(s, 16) });
        if (s >= 60) this.stopRec();
      }, 1000);
    });
    recorder.onStop((res) => {
      clearInterval(this._timer);
      this.resumeMusic();
      this.setData({ recording: false });
      const dur = Math.round((res.duration || 0) / 1000);
      if (dur < 1) { wx.showToast({ title: this.data.T.recShort || '太短了', icon: 'none' }); return; }
      this.uploadVoice(res.tempFilePath, dur);
    });
    recorder.onError((e) => {
      clearInterval(this._timer);
      this.resumeMusic();
      this.setData({ recording: false });
      wx.showToast({ title: '录音失败：' + (e.errMsg || '未知'), icon: 'none' });
    });
  },

  onToggleRec() {
    if (this.data.recording) { this.stopRec(); return; }
    this.toggleRec();
  },

  toggleRec() {
    wx.authorize({
      scope: 'scope.record',
      success: () => {
        // 录音时先停背景音乐，免得录进去
        this._musicWas = app.musicOn();
        app.pauseMusic();
        recorder.start({ format: 'aac', duration: 60000, sampleRate: 44100, numberOfChannels: 1 });
      },
      fail: () => {
        wx.showModal({
          title: '需要麦克风权限',
          content: '语音祝福要用到麦克风，去设置里打开一下',
          confirmText: '去设置',
          success: (r) => { if (r.confirm) wx.openSetting(); },
        });
      },
    });
  },

  resumeMusic() {
    if (this._musicWas) app.playMusic();
    this._musicWas = false;
  },

  stopRec() {
    if (recorder && this.data.recording) recorder.stop();
  },

  uploadVoice(path, duration) {
    wx.showLoading({ title: '发送中', mask: true });
    const name = (wx.getStorageSync('rsvp') || {}).name || this.data.T.anonymous || '一位朋友';
    const cloudPath = `wishes/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.aac`;
    wx.cloud
      .uploadFile({ cloudPath, filePath: path })
      .then((up) =>
        wx.cloud.callFunction({
          name: 'addWish',
          data: { name, type: 'voice', fileID: up.fileID, duration },
        })
      )
      .then(() => {
        wx.hideLoading();
        wx.showToast({ title: this.data.T.recOk || '收到了', icon: 'none' });
        app.globalData.wishes = [];
        this.load();
      })
      .catch((err) => {
        wx.hideLoading();
        console.warn('语音上传失败', err);
        wx.showToast({ title: this.data.T.recFail || '发送失败', icon: 'none' });
      });
  },

  playVoice(e) {
    const item = this.data.list[+e.currentTarget.dataset.i];
    if (!item || !item.fileID || !audio) return;
    wx.cloud
      .getTempFileURL({ fileList: [item.fileID] })
      .then((r) => {
        const url = r.fileList[0] && r.fileList[0].tempFileURL;
        if (!url) throw new Error('no url');
        app.pauseMusic();
        audio.src = url;
        audio.play();
      })
      .catch(() => wx.showToast({ title: '播放失败', icon: 'none' }));
  },

  goRsvp() {
    wx.switchTab({ url: '/pages/rsvp/rsvp' });
  },

  onShareAppMessage() {
    return { title: '把想说的话留给他们', path: '/pages/wish/wish' };
  },
});
