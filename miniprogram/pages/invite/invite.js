const app = getApp();
const music = require('../../utils/music.js');

Page({
  data: { cfg: null },

  onShow() {
    app.ready((cfg) => {
      // 截止日转成更口语的说法
      const d = cfg.wedding.deadline || '';
      cfg.wedding.deadlineText = d
        ? d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${+m} 月 ${+dd} 日`)
        : '';
      this.setData({ cfg });
      music.sync(this);
    });
    app.globalData.opened = true;
  },

  toggleMusic() { music.toggle(); },

  goMap() {
    wx.navigateTo({ url: '/pages/map/map' });
  },

  goNav() {
    const v = this.data.cfg.venue;
    wx.openLocation({
      latitude: v.latitude,
      longitude: v.longitude,
      name: v.name,
      address: v.address,
      scale: v.scale || 16,
      fail: (e) => wx.showToast({ title: '打开地图失败', icon: 'none' }),
    });
  },

  goRsvp() {
    wx.switchTab({ url: '/pages/rsvp/rsvp' });
  },

  onShareAppMessage() {
    const c = this.data.cfg;
    return {
      title: `${c.couple.groom} & ${c.couple.bride} 的婚礼请柬 · ${c.wedding.dateText}`,
      path: '/pages/cover/cover',
      imageUrl: c.cover.photo,
    };
  },

  onShareTimeline() {
    const c = this.data.cfg;
    return {
      title: `${c.couple.groom} & ${c.couple.bride} · ${c.wedding.dateText} · ${c.venue.name}`,
      query: '',
      imageUrl: c.cover.photo,
    };
  },
});
