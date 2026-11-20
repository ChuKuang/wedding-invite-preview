const MAX_BYTES = 30 * 1024 * 1024;
const { displaySize } = require('./album-photo.js');

function call(api, options) {
  return new Promise((resolve, reject) => api({ ...options, success: resolve, fail: reject }));
}

async function prepareAlbumVideo(src) {
  if (!wx.getVideoInfo) throw new Error('请升级微信后再上传短片');
  const original = await call((o) => wx.getVideoInfo(o), { src });
  if (!(original.duration > 0) || original.duration > 60) throw new Error('请选择 60 秒以内的短片');
  if (!wx.compressVideo) throw new Error('当前微信不支持视频压缩，请升级后重试');
  const compressed = await call((o) => wx.compressVideo(o), { src, quality: 'medium' });
  const filePath = compressed.tempFilePath;
  if (!filePath) throw new Error('短片压缩失败，请重试');
  const info = await call((o) => wx.getVideoInfo(o), { src: filePath });
  const size = displaySize(info);
  const stat = await call((o) => wx.getFileSystemManager().stat(o), { path: filePath });
  const bytes = stat.stats && stat.stats.size;
  if (!(bytes > 0) || bytes > MAX_BYTES) throw new Error('压缩后仍超过 30MB，请先导出较小的 MP4 短片');
  if (Math.max(size.width, size.height) > 1920) {
    throw new Error('请先将短片导出为 1080p 或更低分辨率');
  }
  if (!(info.duration > 0) || info.duration > 60) throw new Error('请选择 60 秒以内的短片');
  const extension = /\.(mp4|mov)$/i.exec(filePath);
  return { filePath, bytes, width: size.width, height: size.height, extension: extension ? extension[1].toLowerCase() : 'mp4' };
}

module.exports = { prepareAlbumVideo };
