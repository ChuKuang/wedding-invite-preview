const app = getApp();

Page({
  data: { cfg: {} },

  onShow() {
    // 已经打开过就直接进请柬，避免每次回到这个页都看封面
    if (app.globalData.opened) { wx.switchTab({ url: '/pages/invite/invite' }); return; }
    app.ready((cfg) => this.setData({ cfg }));
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
    app.globalData.opened = true;
    app.autoMusic();   // 点「启封」时开始放背景音乐
    wx.vibrateShort({ type: 'light', fail: () => {} });
    wx.switchTab({ url: '/pages/invite/invite' });
  },
});
