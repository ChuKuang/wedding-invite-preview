const app = getApp();
const music = require('../../utils/music.js');

function layouts(trips) {
  const result = trips.map((t, i) => i === 0 ? (t._ratio > 100 ? 'featured portrait' : 'featured wide') : (t._ratio > 100 ? 'portrait' : 'wide'));
  for (let i = 1; i < trips.length - 1; i++) {
    if (trips[i]._ratio > 100 && trips[i + 1]._ratio > 100) {
      result[i] = result[i + 1] = 'paired';
      i++;
    }
  }
  return result;
}

Page({
  data: {
    trips: [], hero: {}, video: {}, videoSrc: '', videoReady: false,
    videoLoading: false, videoFailed: false,
  },

  onShow() {
    this._active = true;
    app.ready((c) => {
      if (!this._active) return;
      if (this._sourceTrips !== c.trips || this._sourceHero !== c.albumHero) {
        this.stopVideo();
        this._sourceTrips = c.trips;
        this._sourceHero = c.albumHero;
        const trips = (c.trips || []).filter((t) => t.photo).map((t, i) => ({
          ...t, _key: `${t.photo}:${i}`, _photo: t.thumb || t.photo,
          _number: String(i + 1).padStart(2, '0'),
          _ratio: t.width > 0 && t.height > 0 ? +(t.height / t.width * 100).toFixed(3) : 70,
          _loaded: false, _failed: false,
        }));
        layouts(trips).forEach((layout, i) => { trips[i]._layout = layout; });
        const video = (c.albumHero || {}).video || {};
        this.setData({
          trips,
          hero: c.albumHero || {},
          video: { ...video, _poster: video.poster || (trips[0] && trips[0]._photo) || '',
            _ratio: video.width > 0 && video.height > 0 ? +(video.height / video.width * 100).toFixed(3) : 56.25 },
        });
      }
      music.sync(this);
    });
  },

  onHide() { this._active = false; this.stopVideo(); },
  onUnload() { this._active = false; this.stopVideo(); },

  toggleMusic() {
    // 宾客主动打开音乐时退出短片，避免两路声音叠在一起。
    if (this._videoPlaying || this.data.videoLoading) this.stopVideo(false);
    music.toggle();
  },

  async startVideo() {
    if (!this._active || !this.data.video.src || this.data.videoLoading) return;
    const request = this._videoRequest = (this._videoRequest || 0) + 1;
    this.setData({ videoLoading: true, videoFailed: false });
    try {
      let src = this.data.video.src;
      if (src.startsWith('cloud://')) {
        const result = await wx.cloud.getTempFileURL({ fileList: [src] });
        src = result.fileList && result.fileList[0] && result.fileList[0].tempFileURL;
        if (!src) throw new Error('短片地址获取失败');
      }
      if (!this._active || request !== this._videoRequest) return;
      this.setData({ videoSrc: src, videoReady: true, videoLoading: false }, () => {
        if (this._active && request === this._videoRequest) wx.createVideoContext('album-film', this).play();
      });
    } catch (err) {
      if (!this._active || request !== this._videoRequest) return;
      this.videoError();
    }
  },

  videoPlayed() {
    if (!this._active || !this.data.videoReady) return;
    this._videoPlaying = true;
    if (app.musicOn()) { this._resumeMusic = true; app.pauseMusic(); }
  },

  restoreMusic() {
    const resume = this._resumeMusic;
    this._resumeMusic = false;
    if (resume && !app._bgmOff) app.playMusic();
  },

  videoPaused() { this._videoPlaying = false; this.restoreMusic(); },
  videoMetadata(e) {
    const { width, height } = e.detail;
    const video = this.data.video;
    if (!(video.width > 0 && video.height > 0) && width > 0 && height > 0) {
      this.setData({ 'video._ratio': +(height / width * 100).toFixed(3) });
    }
  },
  videoEnded() { this.stopVideo(); },
  videoError() { this.stopVideo(); this.setData({ videoFailed: true }); },

  stopVideo(resume = true) {
    this._videoRequest = (this._videoRequest || 0) + 1;
    this._videoPlaying = false;
    // 先清掉恢复标记，stop 的异步 pause 事件不会再打开音乐。
    if (resume) this.restoreMusic();
    else this._resumeMusic = false;
    if (this.data.videoReady) wx.createVideoContext('album-film', this).stop();
    this.setData({ videoReady: false, videoSrc: '', videoLoading: false });
  },

  photoLoaded(e) {
    const i = +e.currentTarget.dataset.i;
    if (!this.data.trips[i]) return;
    const update = { [`trips[${i}]._loaded`]: true, [`trips[${i}]._failed`]: false };
    const { width, height } = e.detail;
    const trip = this.data.trips[i];
    if (!(trip.width > 0 && trip.height > 0) && width > 0 && height > 0) {
      update[`trips[${i}]._ratio`] = +(height / width * 100).toFixed(3);
      const next = this.data.trips.map((t, j) => j === i ? { ...t, _ratio: update[`trips[${i}]._ratio`] } : t);
      layouts(next).forEach((layout, j) => {
        if (layout !== this.data.trips[j]._layout) update[`trips[${j}]._layout`] = layout;
      });
    }
    this.setData(update);
  },

  photoFailed(e) {
    const i = +e.currentTarget.dataset.i;
    if (this.data.trips[i]) this.setData({ [`trips[${i}]._failed`]: true });
  },

  retryPhoto(e) {
    const i = +e.currentTarget.dataset.i;
    const trip = this.data.trips[i];
    if (!trip || !trip._failed) return;
    const src = trip.thumb || trip.photo;
    this.setData({ [`trips[${i}]._photo`]: '', [`trips[${i}]._failed`]: false, [`trips[${i}]._loaded`]: false }, () => {
      this.setData({ [`trips[${i}]._photo`]: src });
    });
  },

  preview(e) {
    const i = +e.currentTarget.dataset.i;
    if (!this.data.trips[i] || !this.data.trips[i].photo) return;
    wx.previewImage({
      current: this.data.trips[i].photo,
      urls: this.data.trips.map((t) => t.photo),
    });
  },

  onShareAppMessage() {
    return {
      title: `${app.globalData.wedding.couple.groom} & ${app.globalData.wedding.couple.bride} · 我们的时光`,
      path: '/pages/album/album',
    };
  },
});
