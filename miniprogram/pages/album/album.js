const app = getApp();
const music = require('../../utils/music.js');

Page({
  data: {
    trips: [], hero: {},
  },

  onShow() {
    app.ready((c) => {
      if (this._sourceTrips !== c.trips || this._sourceHero !== c.albumHero) {
        this._sourceTrips = c.trips;
        this._sourceHero = c.albumHero;
        this.setData({
          trips: (c.trips || []).map((t, i) => ({
            ...t, _key: `${t.photo}:${i}`, _photo: t.thumb || t.photo,
            _ratio: t.width > 0 && t.height > 0 ? +(t.height / t.width * 100).toFixed(3) : 70,
            _loaded: false, _failed: false,
          })),
          hero: c.albumHero || {},
        });
      }
      music.sync(this);
    });
  },

  toggleMusic() { music.toggle(); },

  photoLoaded(e) {
    const i = +e.currentTarget.dataset.i;
    if (!this.data.trips[i]) return;
    const update = { [`trips[${i}]._loaded`]: true, [`trips[${i}]._failed`]: false };
    const { width, height } = e.detail;
    const trip = this.data.trips[i];
    if (!(trip.width > 0 && trip.height > 0) && width > 0 && height > 0) {
      update[`trips[${i}]._ratio`] = +(height / width * 100).toFixed(3);
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
