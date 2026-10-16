const app = getApp();

/* ============================================================
   可编辑字段定义
   type: text 单行 / area 多行 / lines 数组(一行一条) / rows 表格
         number 数字 / photo 图片 / audio 音乐
   ============================================================ */
const SCHEMA = [
  {
    tab: 'base', name: '基础信息', items: [
      { key: 'couple.groom', label: '新郎', type: 'text' },
      { key: 'couple.bride', label: '新娘', type: 'text' },
      { key: 'cover.kicker', label: '封面小标题', type: 'text' },
      { key: 'cover.words', label: '封面那句话', type: 'area' },
      { key: 'wedding.dateText', label: '封面日期', type: 'text' },
      { key: 'wedding.dayNum', label: '简短日期', type: 'text' },
      { key: 'wedding.dateCN', label: '中文日期', type: 'text' },
      { key: 'wedding.weekday', label: '星期', type: 'text' },
      { key: 'wedding.lunar', label: '农历', type: 'text' },
      { key: 'wedding.timeText', label: '入场时间', type: 'text' },
      { key: 'wedding.timeNote', label: '时间下方小字', type: 'text' },
      { key: 'wedding.deadline', label: '回执截止日', type: 'text', ph: '2027-04-04' },
      { key: 'venue.name', label: '场地名', type: 'text' },
      { key: 'venue.hall', label: '宴会厅', type: 'text' },
      { key: 'venue.city', label: '城市', type: 'text' },
      { key: 'venue.address', label: '详细地址', type: 'area' },
      { key: 'venue.addressTip', label: '地址补充', type: 'text' },
      { key: 'venue.latitude', label: '纬度', type: 'number', ph: '31.108200' },
      { key: 'venue.longitude', label: '经度', type: 'number', ph: '121.050600' },
      { key: 'contact.name', label: '接待人', type: 'text' },
      { key: 'contact.phone', label: '接待电话', type: 'text' },
    ],
  },
  {
    tab: 'text', name: '请柬正文', items: [
      { key: 'letter.title', label: '开头称呼', type: 'text', ph: '见字如晤：' },
      { key: 'letter.paragraphs', label: '正信（一行一段）', type: 'lines', rows: 6 },
      { key: 'letter.signDate', label: '落款日期', type: 'text' },
      { key: 'letter.signImage', label: '签名图', type: 'photo' },
      { key: 'rsvpText.qAttend', label: '回执第一问', type: 'text' },
      { key: 'rsvpText.qCount', label: '回执第二问', type: 'text' },
      { key: 'rsvpText.yes[0]', label: '「来」主文案', type: 'text' },
      { key: 'rsvpText.yes[1]', label: '「来」副文案', type: 'text' },
      { key: 'rsvpText.no[0]', label: '「不来」主文案', type: 'text' },
      { key: 'rsvpText.no[1]', label: '「不来」副文案', type: 'text' },
      { key: 'rsvpText.counts', label: '人数选项（一行一个）', type: 'lines' },
      { key: 'rsvpText.noNote', label: '不来时第一段', type: 'text' },
      { key: 'rsvpText.noNoteEm', label: '不来时高亮句', type: 'text' },
      { key: 'rsvpText.doneYesSub', label: '回执卡（来）', type: 'text' },
      { key: 'rsvpText.doneNoSub', label: '回执卡（不来）', type: 'text' },
    ],
  },
  {
    tab: 'plan', name: '流程与提示', items: [
      { key: 'schedule', label: '当天流程', type: 'rows', ph: '18:18 | 吉时 · 拜堂成礼 | 中庭 · 请提前入座' },
      { key: 'tips', label: '注意事项', type: 'rows', ph: '穿什么 | 舒服就好' },
      { key: 'routes', label: '交通方式', type: 'rows', ph: 'metro | 地铁 | 17 号线朱家角站 2 号口出' },
    ],
  },
  {
    tab: 'photo', name: '照片', items: [
      { key: 'cover.photo', label: '封面（竖图）', type: 'photo' },
      { key: 'heroPhoto', label: '请柬头图（横图）', type: 'photo' },
      { key: 'venue.photo', label: '场地卡片', type: 'photo' },
      { key: 'rsvpHero.photo', label: '回执页头图', type: 'photo' },
      { key: 'wishHero.photo', label: '祝福页头图', type: 'photo' },
      { key: 'albumHero.head', label: '相册页大标题', type: 'text', ph: '我 们 的 时 光' },
      { key: 'albumHero.headEn', label: '相册页英文小字（可留空）', type: 'text', ph: 'Our Moments' },
      { key: 'albumHero.photo', label: '相册页头图', type: 'photo' },
      { key: 'albumHero.title', label: '相册头图标题', type: 'text' },
      { key: 'albumHero.sub', label: '相册头图副标题', type: 'text' },
    ],
  },
  {
    tab: 'music', name: '背景音乐', items: [
      { key: 'music.src', label: '音乐文件', type: 'audio' },
      { key: 'music.title', label: '曲名（只在后台显示，方便自己认）', type: 'text' },
    ],
  },
];

const TABS = [
  { id: 'base', name: '基础' },
  { id: 'text', name: '正文' },
  { id: 'plan', name: '流程' },
  { id: 'photo', name: '照片' },
  { id: 'music', name: '音乐' },
  { id: 'trip', name: '相册' },
  { id: 'rsvp', name: '回执' },
];

const clone = (o) => JSON.parse(JSON.stringify(o || {}));

function get(obj, path) {
  return path.split('.').reduce((o, k) => {
    if (o == null) return undefined;
    const m = k.match(/^(\w+)\[(\d+)\]$/);
    if (m) return o[m[1]] ? o[m[1]][+m[2]] : undefined;
    return o[k];
  }, obj);
}

function set(obj, path, val) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => {
    if (o[k] == null) o[k] = {};
    return o[k];
  }, obj);
  const m = last.match(/^(\w+)\[(\d+)\]$/);
  if (m) {
    if (!Array.isArray(target[m[1]])) target[m[1]] = [];
    target[m[1]][+m[2]] = val;
  } else {
    target[last] = val;
  }
}

// 表格型数组 ↔ 多行文本
function rowsToText(arr, keys) {
  if (!Array.isArray(arr)) return '';
  return arr.map((r) => keys.map((k) => (r[k] == null ? '' : r[k])).join(' | ')).join('\n');
}
function textToRows(text, keys) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const parts = l.split('|').map((x) => x.trim());
      const o = {};
      keys.forEach((k, i) => { o[k] = parts[i] != null ? parts[i] : ''; });
      return o;
    });
}
const ROW_KEYS = { schedule: ['time', 'title', 'note'], tips: ['k', 'v'], routes: ['icon', 'title', 'desc'] };

// 表单里的字符串 → 存进配置的值
function parseValue(it, v) {
  if (it.type === 'lines') return String(v || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (it.type === 'rows') return textToRows(v, ROW_KEYS[it.key] || []);
  if (it.type === 'number') {
    const n = v === '' ? 0 : Number(v);
    return isNaN(n) ? 0 : n;
  }
  return String(v || '').trim();
}

// 配置里的值 → 表单里的字符串
function formatValue(it, v) {
  if (it.type === 'lines') return Array.isArray(v) ? v.join('\n') : '';
  if (it.type === 'rows') return rowsToText(v, ROW_KEYS[it.key] || []);
  return v == null ? '' : String(v);
}

function pad2(n) { return String(n).padStart(2, '0'); }
function timeText(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getMonth() + 1}/${d.getDate()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function fullTime(ts) {
  const d = new Date(ts || Date.now());
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// CSV 单元格：加引号转义；以 = + - @ 开头的宾客输入前面垫一个 '，防止表格软件把它当公式执行
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

Page({
  data: {
    tabs: TABS,
    tab: 'base',
    groups: [],        // 当前 tab 的字段组
    trips: [],
    authed: false,
    hasAdmin: false,
    openid: '',
    isAdmin: false,
    cfg: null,
    saving: false,
    trying: false,     // 正在试听
    // 回执
    rsvpList: [],
    stat: null,
    rsvpLoading: false,
  },

  onLoad() {
    this.setData({ openid: app.globalData.openid || '' });
    this.init();
  },

  onShow() {
    this.setData({
      openid: app.globalData.openid || '',
      isAdmin: app.globalData.isAdmin,
      hasAdmin: app.globalData.hasAdmin,
    });
    if (app.globalData.isAdmin && this.data.tab === 'rsvp') this.loadRsvp();
  },

  onHide() { this.stopTry(); },
  onUnload() { this.stopTry(); },

  init() {
    app.ready((cfg) => {
      // draft 是正在编辑的那份配置：每次输入都直接写进来，切分区、保存都以它为准
      this.draft = clone(cfg);
      this.setData({ cfg, authed: app.globalData.isAdmin });
      this.buildGroups();
    });
    // openid 可能比 ready 晚到，兜底再取一次
    wx.cloud
      .callFunction({ name: 'getConfig', data: {} })
      .then((r) => {
        const res = (r && r.result) || {};
        if (res.openid) {
          app.globalData.openid = res.openid;
          app.globalData.isAdmin = !!res.isAdmin;
          app.globalData.hasAdmin = !!res.hasAdmin;
          this.setData({
            openid: res.openid,
            isAdmin: !!res.isAdmin,
            authed: !!res.isAdmin,
            hasAdmin: !!res.hasAdmin,
          });
        }
      })
      .catch(() => {});
  },

  /* ---------- 构建表单（从草稿读） ---------- */
  buildGroups() {
    const cfg = this.draft;
    if (!cfg) return;
    const groups = SCHEMA.filter((g) => g.tab === this.data.tab).map((g) => ({
      name: g.name,
      items: g.items.map((it) => ({ ...it, value: formatValue(it, get(cfg, it.key)) })),
    }));
    this.setData({ groups, trips: clone(cfg.trips || []) });
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab;
    this.stopTry();
    this.setData({ tab });
    this.buildGroups();
    if (tab === 'rsvp' && app.globalData.isAdmin) this.loadRsvp();
  },

  setField(gi, ii, value) {
    const it = this.data.groups[gi].items[ii];
    set(this.draft, it.key, parseValue(it, value));
    this.setData({ [`groups[${gi}].items[${ii}].value`]: value });
  },

  onField(e) {
    this.setField(+e.currentTarget.dataset.gi, +e.currentTarget.dataset.ii, e.detail.value);
  },

  /* ---------- 相册照片（直接改草稿） ---------- */
  setTrip(i, k, value) {
    if (!Array.isArray(this.draft.trips)) this.draft.trips = [];
    if (!this.draft.trips[i]) return;
    this.draft.trips[i][k] = value;
    this.setData({ [`trips[${i}].${k}`]: value });
  },

  onTripField(e) {
    this.setTrip(+e.currentTarget.dataset.i, e.currentTarget.dataset.k, e.detail.value);
  },

  addTrip() {
    if (!Array.isArray(this.draft.trips)) this.draft.trips = [];
    this.draft.trips.push({ photo: '', loc: '', word: '' });
    this.setData({ trips: clone(this.draft.trips) });
  },

  delTrip(e) {
    const i = Number(e.currentTarget.dataset.i);
    this.draft.trips.splice(i, 1);
    this.setData({ trips: clone(this.draft.trips) });
  },

  /* ---------- 照片上传 ---------- */
  upload(e) {
    const gi = +e.currentTarget.dataset.gi;
    const ii = +e.currentTarget.dataset.ii;
    const ti = +e.currentTarget.dataset.ti;
    const tk = e.currentTarget.dataset.tk;
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      success: (r) => {
        const file = r.tempFiles[0];
        wx.showLoading({ title: '上传中', mask: true });
        const ext = (file.tempFilePath.split('.').pop() || 'jpg').toLowerCase();
        const cloudPath = `uploads/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
        wx.cloud
          .uploadFile({ cloudPath, filePath: file.tempFilePath })
          .then((up) => {
            wx.hideLoading();
            if (tk) this.setTrip(ti, tk, up.fileID);
            else this.setField(gi, ii, up.fileID);
            wx.showToast({ title: '已上传，记得保存', icon: 'none' });
          })
          .catch((err) => {
            wx.hideLoading();
            console.warn('上传失败', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          });
      },
    });
  },

  /* ---------- 音乐上传与试听 ---------- */
  // 小程序只能从聊天记录里选文件：先把 mp3 发到「文件传输助手」，再在这里选
  uploadAudio(e) {
    const gi = +e.currentTarget.dataset.gi;
    const ii = +e.currentTarget.dataset.ii;
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['mp3', 'm4a', 'aac', 'wav'],
      success: (r) => {
        const f = r.tempFiles[0];
        if (f.size > 10 * 1024 * 1024) {
          wx.showModal({ title: '文件太大', content: '背景音乐控制在 10MB 以内，128kbps 的 mp3 一首歌大约 4MB。', showCancel: false });
          return;
        }
        const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
        wx.showLoading({ title: '上传中', mask: true });
        wx.cloud
          .uploadFile({ cloudPath: `music/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, filePath: f.path })
          .then((up) => {
            wx.hideLoading();
            this.stopTry();
            this.setField(gi, ii, up.fileID);
            // 曲名还空着就用文件名填上
            const titleIdx = this.data.groups[gi].items.findIndex((x) => x.key === 'music.title');
            if (titleIdx > -1 && !this.data.groups[gi].items[titleIdx].value) {
              this.setField(gi, titleIdx, f.name.replace(/\.[^.]+$/, ''));
            }
            wx.showToast({ title: '已上传，记得保存', icon: 'none' });
          })
          .catch((err) => {
            wx.hideLoading();
            console.warn('音乐上传失败', err);
            wx.showToast({ title: '上传失败', icon: 'none' });
          });
      },
    });
  },

  tryAudio(e) {
    if (this.data.trying) { this.stopTry(); return; }
    const it = this.data.groups[+e.currentTarget.dataset.gi].items[+e.currentTarget.dataset.ii];
    if (!it.value) { wx.showToast({ title: '先选一首音乐', icon: 'none' }); return; }
    app.pauseMusic();
    if (!this._try) {
      this._try = wx.createInnerAudioContext();
      this._try.onEnded(() => this.setData({ trying: false }));
      this._try.onError(() => {
        this.setData({ trying: false });
        wx.showToast({ title: '这个文件播放不了', icon: 'none' });
      });
    }
    this._try.src = it.value;
    this._try.play();
    this.setData({ trying: true });
  },

  stopTry() {
    if (this._try) this._try.stop();
    if (this.data.trying) this.setData({ trying: false });
  },

  clearAudio(e) {
    this.stopTry();
    this.setField(+e.currentTarget.dataset.gi, +e.currentTarget.dataset.ii, '');
  },

  /* ---------- 保存 ---------- */
  save() {
    if (!app.globalData.isAdmin) {
      wx.showToast({ title: '请先认领管理员', icon: 'none' });
      return;
    }
    if (this.data.saving) return;

    const cfg = clone(this.draft);
    cfg.trips = (cfg.trips || []).map((t) => ({
      photo: String(t.photo || '').trim(),
      loc: String(t.loc || '').trim(),
      word: String(t.word || '').trim(),
    }));

    // 本地兜底校验
    const err = this.validate(cfg);
    if (err) {
      wx.showModal({ title: '先检查一下', content: err, showCancel: false });
      return;
    }

    this.setData({ saving: true });
    wx.showLoading({ title: '保存中', mask: true });
    wx.cloud
      .callFunction({ name: 'saveConfig', data: { config: cfg } })
      .then((r) => {
        const res = (r && r.result) || {};
        if (!res.ok) throw new Error(res.err || '保存失败');
        return app.refresh();
      })
      .then(() => {
        wx.hideLoading();
        this.setData({ saving: false, cfg: app.globalData.wedding });
        this.draft = clone(app.globalData.wedding);
        this.buildGroups();
        wx.showToast({ title: '已生效', icon: 'success' });
      })
      .catch((err) => {
        wx.hideLoading();
        this.setData({ saving: false });
        console.warn('保存失败', err);
        wx.showModal({
          title: '没保存上',
          content: String(err.message || err.errMsg || err),
          showCancel: false,
        });
      });
  },

  validate(cfg) {
    if (!cfg.venue || !cfg.venue.latitude || !cfg.venue.longitude) return '经纬度还没填，导航会跑偏';
    if (Math.abs(cfg.venue.latitude) > 90 || Math.abs(cfg.venue.longitude) > 180) return '经纬度看着不对（纬度 ±90，经度 ±180）';
    if (cfg.wedding && cfg.wedding.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(cfg.wedding.deadline)) return '截止日格式应为 2027-04-04';
    const noPhoto = (cfg.trips || []).findIndex((t) => !t.photo);
    if (noPhoto > -1) return `相册第 ${noPhoto + 1} 张还没选图片，选一张或者删掉它`;
    return '';
  },

  /* ---------- 认领管理员 ---------- */
  claim() {
    if (!app.globalData.openid) {
      wx.showToast({ title: '还没拿到身份，稍等两秒', icon: 'none' });
      return;
    }
    wx.showModal({
      title: '认领管理员',
      content: '认领后只有你的微信能改这些配置，别人进不来。确定吗？',
      success: (m) => {
        if (!m.confirm) return;
        wx.showLoading({ title: '处理中', mask: true });
        wx.cloud
          .callFunction({
            name: 'saveConfig',
            data: { action: 'claim', config: this.data.cfg || {} },
          })
          .then((r) => {
            wx.hideLoading();
            const res = (r && r.result) || {};
            if (!res.ok) throw new Error(res.err || '认领失败');
            app.globalData.isAdmin = true;
            app.globalData.hasAdmin = true;
            this.setData({ isAdmin: true, authed: true, hasAdmin: true });
            wx.showToast({ title: '你是管理员了', icon: 'success' });
          })
          .catch((err) => {
            wx.hideLoading();
            wx.showModal({ title: '认领失败', content: String(err.message || err), showCancel: false });
          });
      },
    });
  },

  copyOpenid() {
    wx.setClipboardData({
      data: this.data.openid,
      success: () => wx.showToast({ title: '已复制 openid', icon: 'none' }),
    });
  },

  /* ---------- 回执 ---------- */
  loadRsvp() {
    if (this.data.rsvpLoading) return;
    this.setData({ rsvpLoading: true });
    wx.cloud
      .callFunction({ name: 'adminRsvp', data: { limit: 200 } })
      .then((r) => {
        const res = (r && r.result) || {};
        if (!res.ok) throw new Error(res.err || '读取失败');
        const list = (res.list || []).map((x) => ({ ...x, timeText: timeText(x.updatedAt) }));
        this.setData({ rsvpList: list, stat: res.stat, rsvpLoading: false });
      })
      .catch((err) => {
        console.warn('回执读取失败', err);
        this.setData({ rsvpLoading: false });
        wx.showToast({ title: '读取失败：' + (err.message || ''), icon: 'none' });
      });
  },

  rsvpRows() {
    return this.data.rsvpList.map((x) => [
      x.attend === 'yes' ? '到场' : '缺席',
      x.name,
      x.attend === 'yes' ? x.count : 0,
      x.phone || '',
      x.addr || '',
      x.message || '',
      fullTime(x.updatedAt),
    ]);
  },

  // 生成 CSV 文件，直接发到聊天（发给「文件传输助手」，电脑上用 Excel 打开）
  exportFile() {
    const list = this.data.rsvpList;
    if (!list.length) { wx.showToast({ title: '还没有回执', icon: 'none' }); return; }
    const st = this.data.stat || {};
    const head = ['回复', '称呼', '到场人数', '手机', '收喜糖地址', '贺词', '回帖时间'];
    const rows = this.rsvpRows().map((r) => {
      r[3] = r[3] ? '\t' + r[3] : '';  // 手机号前垫制表符，免得 Excel 显示成科学计数法
      return r;
    });
    const sum = ['合计', `到场 ${st.yes || 0} 份`, `共 ${st.people || 0} 人`, `缺席 ${st.no || 0} 份`, `约需 ${st.tables || 0} 桌（按每桌 10 人）`, '', ''];
    const csv = '\ufeff' + [head, ...rows, [], sum].map((r) => r.map(csvCell).join(',')).join('\r\n');

    const d = new Date();
    const fileName = `回帖名单-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}.csv`;
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
    try {
      // 必须同步写：shareFileMessage 只能在点击当下调用
      wx.getFileSystemManager().writeFileSync(filePath, csv, 'utf8');
    } catch (e) {
      console.warn('写文件失败', e);
      this.exportRsvp();
      return;
    }
    if (!wx.shareFileMessage) {
      wx.showModal({ title: '微信版本太低', content: '无法直接发送文件，已改为复制到剪贴板。', showCancel: false });
      this.exportRsvp();
      return;
    }
    wx.shareFileMessage({
      filePath,
      fileName,
      fail: (e) => {
        if (/cancel/.test((e && e.errMsg) || '')) return;
        console.warn('发送文件失败', e);
        wx.showModal({ title: '没发出去', content: '已改为复制到剪贴板，可以直接粘进表格。', showCancel: false });
        this.exportRsvp();
      },
    });
  },

  // 复制为制表符分隔的文本，可直接粘进 Excel / WPS / 腾讯文档
  exportRsvp() {
    const list = this.data.rsvpList;
    if (!list.length) { wx.showToast({ title: '还没有回执', icon: 'none' }); return; }
    const clean = (v) => String(v == null ? '' : v).replace(/[\t\r\n]+/g, ' ');
    const text = this.rsvpRows().map((r) => r.map(clean).join('\t')).join('\n');
    wx.setClipboardData({
      data: `回复\t称呼\t到场人数\t手机\t收喜糖地址\t贺词\t回帖时间\n${text}`,
      success: () => wx.showToast({ title: '已复制，可粘到表格', icon: 'none' }),
    });
  },

  back() {
    wx.navigateBack({
      fail: () => wx.switchTab({ url: '/pages/invite/invite' }),
    });
  },
});
