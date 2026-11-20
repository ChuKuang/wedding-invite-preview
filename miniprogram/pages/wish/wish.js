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
    hasMore: true,
    loadError: false,
    canVoice: false,
    recording: false,
    recSec: 0,
    bars: bars(3, 16),
    defAvatar: '/images/photos/trip3.jpg',
    playing: -1,        // 正在播放的那条的下标
    loadingVoice: false,
    litBars: 0,         // 已播放到第几根波形
    leftText: '',       // 剩余时长
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
    if (this._rawList && !this._loadingAll && app.globalData.wishes !== this._rawList) this.load(null, true);
  },

  toggleMusic() { music.toggle(); },

  onLoad() {
    this.bindRecorder();
    this.bindAudio();
    this.load();
  },

  onUnload() {
    if (audio) audio.stop();
  },

  onHide() {
    // 切走时停掉，免得看不见了还在放
    if (this.data.playing > -1 && audio) audio.stop();
  },

  onPullDownRefresh() {
    this.load(() => wx.stopPullDownRefresh(), true);
  },

  onReachBottom() {
    this.load();
  },

  loadMore() { this.load(); },

  /* ---------- 拉取 ---------- */
  load(done, reset) {
    if (this._loadingAll) {
      if (reset) return this._loadingAll.then(() => this.load(done, true));
      return this._loadingAll.then(() => { if (done) done(); });
    }
    if (reset) {
      if (audio && this.data.playing > -1) audio.stop();
      this._rawList = [];
      this._cursor = null;
      this.setData({ hasMore: true });
    } else if (!this._rawList) {
      const cached = app.globalData.wishesPage;
      this._rawList = app.globalData.wishes || [];
      if (cached) {
        this._cursor = cached.nextCursor;
        this.setData({ total: cached.total, voiceCount: cached.voiceCount, hasMore: cached.hasMore, loading: false });
        this.render(this._rawList);
        if (done) done();
        return Promise.resolve();
      }
      // 旧缓存没有分页信息，从第一页重新读取。
      this._rawList = [];
    }
    if (!this.data.hasMore) { if (done) done(); return Promise.resolve(); }
    this.setData({ loading: true, loadError: false });
    this._loadingAll = wx.cloud
      .callFunction({
        name: 'getWishes',
        data: { cursor: this._cursor || null, limit: 50 },
      })
      .then((res) => {
        const r = (res && res.result) || {};
        if (!r.ok) throw new Error(r.err || '读取失败');
        if (r.hasMore && (!r.nextCursor || JSON.stringify(r.nextCursor) === JSON.stringify(this._cursor))) throw new Error('分页读取异常');
        const ids = new Set(this._rawList.map((x) => x._id));
        const list = this._rawList.concat((r.list || []).filter((x) => !ids.has(x._id)));
        this._rawList = list;
        this._cursor = r.nextCursor;
        app.globalData.wishes = list;
        app.globalData.wishesPage = { total: r.total, voiceCount: r.voiceCount || 0, nextCursor: r.nextCursor, hasMore: !!r.hasMore };
        this.setData({ total: r.total === undefined ? list.length : r.total, voiceCount: r.voiceCount || 0, hasMore: !!r.hasMore });
        this.render(list);
      })
      .catch((err) => {
        console.warn('拉取祝福失败（可能未部署云函数）', err);
        this.setData({ loadError: true });
      })
      .finally(() => {
        this.setData({ loading: false });
        this._loadingAll = null;
        done && done();
      });
    return this._loadingAll;
  },

  render(list) {
    const rendered = list.map((x, i) => ({
      ...x,
      timeText: timeText(x.createdAt),
      bars: x.type === 'voice' ? bars(i + (x.duration || 10), 22) : [],
      durationText: x.type === 'voice'
        ? `${Math.floor((x.duration || 0) / 60)}:${String(Math.round((x.duration || 0) % 60)).padStart(2, '0')}`
        : '',
    }));
    this.setData({ list: rendered });
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
        recorder.start({ format: 'aac', duration: 60000, sampleRate: 44100, numberOfChannels: 1, encodeBitRate: 96000 });
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
      .then((r) => {
        const res = (r && r.result) || {};
        if (!res.ok) throw new Error(res.err || '发送失败');
        wx.hideLoading();
        wx.showToast({ title: res.status === 'pass' ? (this.data.T.recOk || '收到了') : '已收到，审核后显示', icon: 'none' });
        app.globalData.wishes = [];
        app.globalData.wishesPage = null;
        this.load(null, true);
      })
      .catch((err) => {
        wx.hideLoading();
        console.warn('语音上传失败', err);
        wx.showToast({ title: this.data.T.recFail || '发送失败', icon: 'none' });
      });
  },

  /* ---------- 播放语音 ---------- */
  bindAudio() {
    if (!audio || this._audioBound) return;
    this._audioBound = true;
    audio.onPlay(() => this.setData({ loadingVoice: false }));
    audio.onTimeUpdate(() => {
      const i = this.data.playing;
      const item = this.data.list[i];
      if (!item) return;
      // 优先用音频真实时长，拿不到就用上传时记下的秒数
      const total = audio.duration > 0 && isFinite(audio.duration) ? audio.duration : (item.duration || 1);
      const cur = Math.min(audio.currentTime || 0, total);
      const left = Math.max(0, Math.ceil(total - cur));
      this.setData({
        litBars: Math.round((cur / total) * item.bars.length),
        leftText: `-${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`,
      });
    });
    const end = () => this.endVoice();
    audio.onEnded(end);
    audio.onStop(end);
    audio.onError(() => { this.endVoice(); wx.showToast({ title: '播放失败', icon: 'none' }); });
  },

  endVoice() {
    if (this.data.playing === -1) return;
    this.setData({ playing: -1, loadingVoice: false, litBars: 0, leftText: '' });
    // 听完把背景音乐接回来
    if (this._musicWasPlay) app.playMusic();
    this._musicWasPlay = false;
  },

  playVoice(e) {
    const i = +e.currentTarget.dataset.i;
    const item = this.data.list[i];
    if (!item || !audio) return;
    // 再点正在放的那条 = 停止
    if (this.data.playing === i) { audio.stop(); return; }
    if (!item.fileID) { wx.showToast({ title: '这条语音没有音频', icon: 'none' }); return; }
    // 正在放别的：先停掉，不触发恢复背景音乐
    if (this.data.playing > -1) { this.setData({ playing: -1 }); audio.stop(); }
    else { this._musicWasPlay = app.musicOn(); }
    app.pauseMusic();
    this.setData({ playing: i, loadingVoice: true, litBars: 0, leftText: '' });
    const token = (this._playToken || 0) + 1;
    this._playToken = token;
    wx.cloud
      .getTempFileURL({ fileList: [item.fileID] })
      .then((r) => {
        if (this._playToken !== token) return;   // 期间已经点了别的
        const url = r.fileList[0] && r.fileList[0].tempFileURL;
        if (!url) throw new Error('no url');
        audio.src = url;
        audio.play();
      })
      .catch(() => {
        if (this._playToken !== token) return;
        this.endVoice();
        wx.showToast({ title: '播放失败', icon: 'none' });
      });
  },

  goRsvp() {
    wx.switchTab({ url: '/pages/rsvp/rsvp' });
  },

  onShareAppMessage() {
    return { title: '把想说的话留给他们', path: '/pages/wish/wish' };
  },
});
