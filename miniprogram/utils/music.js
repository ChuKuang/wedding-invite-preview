/* 页面里的背景音乐按钮：onShow 里 sync，按钮绑定 toggle */
module.exports = {
  sync(page) {
    const app = getApp();
    page.setData({ hasMusic: app.hasMusic(), musicOn: app.musicOn() });
    app.autoMusic();
  },
  toggle() {
    getApp().toggleMusic();
  },
};
