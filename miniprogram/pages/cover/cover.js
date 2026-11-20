const app = getApp();

Page({
  data: { cfg: {}, fx: false, leaving: false },

  onShow() {
    // 已经打开过就直接进请柬，避免每次回到这个页都看封面
    if (app.globalData.opened) { wx.switchTab({ url: '/pages/invite/invite' }); return; }
    app.ready((cfg) => {
      // 进场淡入只在本机第一次打开时播放，之后直接显示
      const seen = wx.getStorageSync('coverSeen');
      const v = cfg.venue || {};
      this.setData({ cfg, fx: !seen, leaving: false, placeText: [v.city, v.name].filter(Boolean).join(' · ') });
      if (!seen) wx.setStorageSync('coverSeen', 1);
    });
  },

  tapVersion() {
    this._taps = (this._taps || 0) + 1;
    clearTimeout(this._tapTimer);
    this._tapTimer = setTimeout(() => { this._taps = 0; }, 1200);
    if (this._taps >= 5) {
      this._taps = 0;
      wx.navigateTo({ url: '/pages/admin/admin' });
    }
  },

  open() {
    if (this.data.leaving) return;
    app.globalData.opened = true;
    app.autoMusic();   // 要在点击当下调用，否则会被拦截
    wx.vibrateShort({ type: 'light', fail: () => {} });
    this.setData({ leaving: true });
    // 等宣纸色完全盖满再切页
    setTimeout(() => wx.switchTab({ url: '/pages/invite/invite' }), 420);
  },
});