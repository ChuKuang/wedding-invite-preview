const app = getApp();
const music = require('../../utils/music.js');
const rsvpSync = require('../../utils/rsvp-sync.js');
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
    syncPending: false,
    syncing: false,
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
      const v = cfg.venue || {};
      this.setData({
        cfg,
        T,
        deadlineText: txt,
        deadlineDays: this.daysLeft(d),
        // 场地名、宴会厅哪个没填就不显示，免得多出一个「·」；都没填就用地址
        venueText: [v.name, v.hall].filter(Boolean).join(' · ') || v.address || '',
      });
      this.syncIcons();
      music.sync(this);
      // 回执卡标题要用到上面的文案，所以等文案就绪后再恢复
      if (this._needRestore) { this._needRestore = false; this.restore(); }
      else if (this.data.done) this.showDone(false);
    });
  },

  toggleMusic() { music.toggle(); },

  onLoad() {
    // 已回执过直接进入回执卡；真正恢复放在 onShow 里文案就绪之后
    this._needRestore = true;
    this._unsubscribe = rsvpSync.subscribe((s) => {
      const wasPending = this.data.syncPending;
      this.setData({ syncPending: s.pending, syncing: s.syncing });
      if (this.data.done && this.data.cfg && wasPending !== s.pending) this.showDone(wasPending && !s.pending);
      if (s.wishError) wx.showToast({ title: s.wishError, icon: 'none' });
    });
  },

  onUnload() { this._unloaded = true; if (this._unsubscribe) this._unsubscribe(); },

  retrySync() { rsvpSync.sync(); },

  daysLeft(d) {
    if (!d) return 0;
    const t = new Date(d + 'T23:59:59').getTime() - Date.now();
    return Math.max(0, Math.ceil(t / 86400000));
  },

  // 已回执过直接进入回执卡，避免重复填报
  restore() {
    const saved = wx.getStorageSync('rsvp');
    if (saved && saved.name) {
      // 存的是提交给云函数的字段：attend / count / message
      const att = saved.attend || saved.att || 'yes';
      const cnt = saved.count || saved.cnt || 1;
      this.setData({
        att,
        cnt,
        cntText: CNT[cnt] || CNT[1],
        name: saved.name,
        phone: saved.phone || '',
        addr: saved.addr || '',
        msg: saved.message || '',
      }, () => this.syncIcons());
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
    };

    try {
      rsvpSync.enqueue(payload);
    } catch (e) {
      this.setData({ submitting: false });
      wx.showToast({ title: '暂存失败，请再试一次', icon: 'none' });
      return;
    }
    this.showDone(false);
    rsvpSync.sync().finally(() => { if (!this._unloaded) this.setData({ submitting: false }); });
  },

  showDone(fresh) {
    const { name, att, cntText, T } = this.data;
    this.setData({
      celebrate: !!fresh && !this.data.syncPending,
      done: true,
      doneTitle: (this.data.syncPending ? '回帖待送出，' : ((att === 'yes' ? T.doneYes : T.doneNo) || '')) + name,
      doneSub: this.data.syncPending ? '已暂存在这台设备，联网后自动重试' : ((att === 'yes' ? T.doneYesSub : T.doneNoSub) || ''),
      cntText,
    });
  },

  again() {
    this.setData({ done: false, celebrate: false });
  },

  onShareAppMessage() {
    const d = this.data.cfg.wedding.dayNum || '';
    return { title: `来吗？${d} 见`, path: '/pages/rsvp/rsvp' };
  },
});
