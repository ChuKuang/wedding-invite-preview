function call(method, options) {
  return new Promise((resolve, reject) => method({ ...options, success: resolve, fail: reject }));
}

function displaySize(info) {
  let width = Number(info.width), height = Number(info.height);
  if (!(width > 0 && height > 0 && Number.isFinite(width) && Number.isFinite(height))) {
    throw new Error('无法读取照片尺寸，请重新选图');
  }
  if (/^(left|right)/.test(info.orientation || '')) [width, height] = [height, width];
  return { width, height };
}

async function compress(src, edge, qualities, maxBytes) {
  const info = await call((o) => wx.getImageInfo(o), { src });
  displaySize(info);
  const scale = Math.min(1, edge / Math.max(info.width, info.height));
  const compressedWidth = Math.max(1, Math.round(info.width * scale));
  const compressedHeight = Math.max(1, Math.round(info.height * scale));
  for (const quality of qualities) {
    const result = await call((o) => wx.compressImage(o), { src, compressedWidth, compressedHeight, quality });
    const filePath = result.tempFilePath;
    const outputInfo = await call((o) => wx.getImageInfo(o), { src: filePath });
    const size = displaySize(outputInfo);
    if (Math.max(size.width, size.height) > edge + 1) throw new Error('照片缩放失败，请重新选图');
    const fs = wx.getFileSystemManager();
    const stat = await call((o) => fs.stat(o), { path: filePath });
    const bytes = Number(stat.stats && stat.stats.size);
    if (!(bytes > 0 && Number.isFinite(bytes))) throw new Error('无法读取照片大小，请重新选图');
    if (bytes <= maxBytes) return { filePath, ...size, bytes, extension: outputInfo.type === 'png' ? 'png' : 'jpg' };
  }
  throw new Error('照片压缩后仍过大，请换成 JPG 图片再试');
}

// 上传前生成两份限尺寸、限体积的图片，宾客不会下载相机原图。
async function prepareAlbumPhoto(src) {
  if (!wx.compressImage) throw new Error('请升级微信后再上传照片');
  const photo = await compress(src, 2000, [84, 72, 58], 1024 * 1024);
  const thumb = await compress(photo.filePath, 1200, [76, 64, 52], 350 * 1024);
  return { photo, thumb };
}

module.exports = { prepareAlbumPhoto, displaySize };
