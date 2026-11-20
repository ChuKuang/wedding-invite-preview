/* 待发送回帖持久化；同一时刻只发送一份，后续修改以最新一份为准。 */
let flight = null;
let timer = null;
let active = false;
let delay = 5000;
const listeners = [];

function state() {
  return { pending: !!wx.getStorageSync('rsvpPending'), syncing: !!flight };
}

function notify(extra) {
  const s = Object.assign(state(), extra);
  listeners.slice().forEach((cb) => {
    try { cb(s); } catch (e) { console.warn('回帖状态更新失败', e); }
  });
}

function subscribe(cb) {
  listeners.push(cb);
  cb(state());
  return () => { const i = listeners.indexOf(cb); if (i > -1) listeners.splice(i, 1); };
}

function enqueue(input) {
  const payload = {
    name: input.name, attend: input.attend || input.att || 'yes',
    count: input.count === undefined ? (input.cnt || 1) : input.count,
    phone: input.phone || '', addr: input.addr || '', message: input.message || '',
  };
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  wx.setStorageSync('rsvp', payload);
  wx.setStorageSync('rsvpPending', { id, payload });
  // 清空贺词也要重试，避免上一份留言留在墙上。
  if (payload.message || wx.getStorageSync('rsvpWishPending') || (wx.getStorageSync('rsvpWish') || {}).posted) {
    wx.setStorageSync('rsvpWishPending', { id, name: payload.name, content: payload.message });
  }
  delay = 5000;
  notify();
}

async function call(name, data) {
  if (!wx.cloud) throw new Error('云服务不可用');
  const res = await wx.cloud.callFunction({ name, data });
  const result = (res && res.result) || {};
  if (!result.ok) {
    const error = new Error(result.err || '发送失败');
    error.retryable = result.retryable !== false;
    throw error;
  }
  return result;
}

function clearIfCurrent(key, job) {
  if ((wx.getStorageSync(key) || {}).id === job.id) wx.removeStorageSync(key);
}

async function drain() {
  while (true) {
    const job = wx.getStorageSync('rsvpPending');
    if (job) {
      try {
        await call('addRsvp', job.payload);
        wx.setStorageSync('rsvpSynced', job.id);
        clearIfCurrent('rsvpPending', job);
        notify();
      } catch (e) {
        // 旧请求失败时，新提交仍有机会立即发送。
        if ((wx.getStorageSync('rsvpPending') || {}).id !== job.id) continue;
        console.warn('回帖待重试', e);
        return false;
      }
      continue;
    }
    const wish = wx.getStorageSync('rsvpWishPending');
    if (!wish) return true;
    try {
      await call('addWish', { name: wish.name, content: wish.content, type: 'text', source: 'rsvp' });
      wx.setStorageSync('rsvpWish', { posted: !!wish.content });
      clearIfCurrent('rsvpWishPending', wish);
      notify({ wishChanged: true });
    } catch (e) {
      if (wx.getStorageSync('rsvpPending') || (wx.getStorageSync('rsvpWishPending') || {}).id !== wish.id) continue;
      if (e.retryable === false) {
        clearIfCurrent('rsvpWishPending', wish);
        notify({ wishError: e.message });
        continue;
      }
      console.warn('贺词待重试', e);
      return false;
    }
  }
}

function schedule() {
  if (!active || timer || (!wx.getStorageSync('rsvpPending') && !wx.getStorageSync('rsvpWishPending'))) return;
  timer = setTimeout(() => { timer = null; sync(); }, delay);
  delay = Math.min(60000, delay * 2);
}

function sync() {
  if (flight) return flight;
  clearTimeout(timer);
  timer = null;
  flight = Promise.resolve().then(drain).catch((e) => {
    console.warn('回帖同步失败', e);
    return false;
  }).finally(() => { flight = null; notify(); schedule(); });
  notify();
  return flight;
}

function resume() {
  active = true;
  // 旧版本只有本地回执，无法确认是否送达；首次升级时补发一次。
  const saved = wx.getStorageSync('rsvp');
  if (saved && saved.name && !wx.getStorageSync('rsvpSynced') && !wx.getStorageSync('rsvpPending')) enqueue(saved);
  return sync();
}

function pause() { active = false; clearTimeout(timer); timer = null; }

module.exports = { enqueue, sync, resume, pause, state, subscribe };
