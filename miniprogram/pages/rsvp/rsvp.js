const app = getApp();
const music = require('../../utils/music.js');
const CNT = { 1: '1 位', 2: '2 位', 3: '3 位', 4: '4 位及以上' };

Page({
  data: {
    cfg: null,
    deadlineText: '',
    att: 'yes',
    cnt: 1,
    cntText: '1 位',
    name: '',
    phone: '',
    addr: '',
    msg: '',
    done: false,
    submitting: false,
    doneTitle: '',
    doneSub: '',
    iconSmile: '/images/ico-smile-on.png',
    iconMail: '/images/ico-mail-off.png',
    whoIcon: [],
    T: {},          // 回执页文案（来自 config）
    showAddr: false,// 收喜糖地址栏是否显示
  },

  onShow() {
    app.ready((cfg) => {
      const d = cfg.wedding.deadline || '';
      const txt = d.replace(/^(\d{4})-(\d{2})-(\d{2})$/, (_, y, m, dd) => `${+m} 月 ${+dd} 日`);
      const T = Object.assign({ addrLabel: '收 喜 糖 的 地 址' }, cfg.rsvpText || {});
      this.setData({
        cfg,
        T,
        deadlineText: txt,
        deadlineDays: this.daysLeft(d),
      });
      this.syncIcons();
      music.sync(this);
    });
  },

  toggleMusic() { music.toggle(); },

  onLoad() {
    // 已回执过直接进入回执卡，避免重复填报
    this.restore();
  },

  daysLeft(d) {
    if (!d) return 0;
    const t = new Date(d + 'T23:59:59').getTime() - Date.now();
    return Math.max(0, Math.ceil(t / 86400000));
  },

  // 已回执过直接进入回执卡，避免重复填报
  restore() {
    const saved = wx.getStorageSync('rsvp');
    if (saved && saved.name) {
      this.setData({
        att: saved.att || 'yes',
        cnt: saved.cnt || 1,
        cntText: CNT[saved.cnt || 1],
        name: saved.name,
        phone: saved.phone || '',
        addr: saved.addr || '',
      });
      this.showDone(false);
    }
  },

  // 图标的选中态用不同文件，JS 里算好路径交给 WXML
  syncIcons() {
    const { att, cnt } = this.data;
    const mode = (this.data.cfg.features || {}).giftAddress;
    this.setData({
      iconSmile: att === 'yes' ? '/images/ico-smile-on.png' : '/images/ico-smile-off.png',
      iconMail: att === 'no' ? '/images/ico-mail-on.png' : '/images/ico-mail-off.png',
      whoIcon: [1, 2, 3, 4].map((n) => `/images/who${n}-${cnt === n ? 'on' : 'off'}.png`),
      // 'all' 常驻 / 'no' 只在来不了时出现 / false 永不出现
      showAddr: mode === 'all' || (mode === 'no' && att === 'no'),
    });
  },

  pickAtt(e) {
    this.setData({ att: e.currentTarget.dataset.att }, () => this.syncIcons());
    wx.vibrateShort({ type: 'light', fail: () => {} });
  },

  pickCnt(e) {
    const n = +e.currentTarget.dataset.n;
    this.setData({ cnt: n, cntText: CNT[n] }, () => this.syncIcons());
    wx.vibrateShort({ type: 'light', fail: () => {} });
  },

  onName(e) { this.setData({ name: e.detail.value }); },
  onPhone(e) { this.setData({ phone: e.detail.value }); },
  onAddr(e) { this.setData({ addr: e.detail.value }); },
  onMsg(e) { this.setData({ msg: e.detail.value }); },

  submit() {
    const { name, att, msg, cnt, phone, addr, submitting } = this.data;
    if (submitting) return;
    if (!name.trim()) {
      wx.showToast({ title: '先告诉我们怎么称呼你呀', icon: 'none' });
      return;
    }
    if (att === 'yes' && phone && !/^1\d{10}$/.test(phone)) {
      wx.showToast({ title: '手机号看着不太对', icon: 'none' });
      return;
    }

    this.setData({ submitting: true });
    wx.vibrateShort({ type: 'light', fail: () => {} });

    const payload = {
      name: name.trim(),
      attend: att,
      count: att === 'yes' ? cnt : 0,
      phone: phone.trim(),
      addr: addr.trim(),
      message: msg.trim(),
      openid: app.globalData.openid,
    };

    // 先本地落，保证离线也能看到回执卡
    wx.setStorageSync('rsvp', payload);
    if (msg.trim()) this.postWish(name.trim(), msg.trim());

    this.saveToCloud(payload);
  },

  saveToCloud(payload) {
    wx.cloud
      .callFunction({ name: 'addRsvp', data: payload })
      .then(() => { this.setData({ submitting: false }); this.showDone(true); })
      .catch((err) => {
        console.warn('回执未上云（可能未部署云函数）', err);
        this.setData({ submitting: false });
        this.showDone(true);
        wx.showToast({ title: '已记录，稍后同步', icon: 'none' });
      });
  },

  // 留言同步到祝福墙
  postWish(name, content) {
    wx.cloud
      .callFunction({ name: 'addWish', data: { name, content, type: 'text' } })
      .then(() => { app.globalData.wishes = []; })
      .catch((err) => console.warn('留言未上墙', err));
  },

  showDone() {
    const { name, att, cntText, T } = this.data;
    this.setData({
      done: true,
      doneTitle: (att === 'yes' ? T.doneYes : T.doneNo) + name,
      doneSub: att === 'yes' ? T.doneYesSub : T.doneNoSub,
      cntText,
    });
  },

  again() {
    this.setData({ done: false });
  },

  onShareAppMessage() {
    const d = this.data.cfg.wedding.dayNum || '';
    return { title: `来吗？${d} 见`, path: '/pages/rsvp/rsvp' };
  },
});
