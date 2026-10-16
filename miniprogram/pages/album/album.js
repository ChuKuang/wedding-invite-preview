const app = getApp();
const music = require('../../utils/music.js');

Page({
  data: {
    trips: [], hero: {},
  },

  onShow() {
    app.ready((c) => {
      this.setData({
        trips: c.trips,
        hero: c.albumHero,
      });
      music.sync(this);
    });
  },

  toggleMusic() { music.toggle(); },

  preview(e) {
    const i = +e.currentTarget.dataset.i;
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
