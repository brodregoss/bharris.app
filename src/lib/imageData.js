// Shrink notes photos so they can be sent to the study AI.
// Keep data URLs off React Router history — iOS caps history state size.

// A page or two of notes — not a chapter or a book.
export const MAX_NOTE_PHOTOS = 2;
export const MAX_NOTE_PHOTO_BYTES = 12 * 1024 * 1024;

let pendingPhotos = [];
let pendingMarks = [];
let pendingExtract = null;

export function stashPhotos(images) {
  pendingPhotos = (Array.isArray(images) ? images : images ? [images] : []).filter(Boolean);
  pendingMarks = [];
  pendingExtract = null;
}

export function stashPhoto(image) {
  stashPhotos(image ? [image] : []);
}

export function peekPhotos() {
  return pendingPhotos;
}

export function peekPhoto() {
  return pendingPhotos[0] || null;
}

// When the student highlights regions, extraction uses these crops.
// Originals stay in pendingPhotos so they can adjust the boxes and try again.
export function stashScopedPhotos(entries) {
  const list = (Array.isArray(entries) ? entries : []).filter((entry) => entry?.image);
  pendingExtract = list.length ? list : null;
}

export function peekExtractPlan() {
  return pendingExtract;
}

export function clearScopedPhotos() {
  pendingExtract = null;
}

export function stashHighlightMarks(marks) {
  pendingMarks = Array.isArray(marks) ? marks : [];
}

export function peekHighlightMarks() {
  return pendingMarks;
}

export function clearPhoto() {
  pendingPhotos = [];
  pendingExtract = null;
  pendingMarks = [];
}

function isNotePhoto(file) {
  const type = String(file?.type || '').toLowerCase();
  if (!type || type === 'application/octet-stream' || type.startsWith('image/')) return true;
  const name = String(file?.name || '').toLowerCase();
  return /\.(heic|heif|jpe?g|png|webp|gif|bmp|tiff?)$/.test(name);
}

// Copy before clearing an <input type="file">. Its FileList is live, and
// emptying the input on iOS drops the photo the student just chose.
export function copyFileList(fileList) {
  return Array.from(fileList || []).filter(Boolean);
}

export function validateNotePhotos(fileList) {
  const files = copyFileList(fileList);
  if (!files.length) {
    return { error: 'Please choose a photo of your notes.' };
  }
  if (files.length > MAX_NOTE_PHOTOS) {
    return {
      error: 'You can attach up to 2 photos — a page or two of notes, not a whole book.',
    };
  }
  for (const file of files) {
    if (!isNotePhoto(file)) {
      return { error: 'Please choose photos of your notes.' };
    }
    if (file.size > MAX_NOTE_PHOTO_BYTES) {
      return {
        error: 'Each photo must be under 12 MB. Snap a page or two — not a scan of the book.',
      };
    }
  }
  return { files };
}

function drawToJpeg(source, width, height, maxDim, quality) {
  const scale = Math.min(1, maxDim / Math.max(width, height, 1));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not read that photo');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

export async function fileToJpegDataUrl(file, { maxDim = 1600, quality = 0.72 } = {}) {
  if (!file) throw new Error('No photo selected');

  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file);
      try {
        return drawToJpeg(bitmap, bitmap.width, bitmap.height, maxDim, quality);
      } finally {
        bitmap.close?.();
      }
    } catch {
      // Some iPhone photos (HEIC) need the Image element path instead.
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    const finish = (err, data) => {
      URL.revokeObjectURL(url);
      if (err) reject(err);
      else resolve(data);
    };
    img.onload = () => {
      try {
        finish(null, drawToJpeg(
          img,
          img.naturalWidth || img.width,
          img.naturalHeight || img.height,
          maxDim,
          quality,
        ));
      } catch (err) {
        finish(err instanceof Error ? err : new Error('Could not read that photo'));
      }
    };
    img.onerror = () => finish(new Error('Could not read that photo'));
    img.src = url;
  });
}

function loadHtmlImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that photo'));
    img.src = src;
  });
}

function padRegion(region, pad = 0.012) {
  const x = Math.max(0, region.x - pad);
  const y = Math.max(0, region.y - pad);
  const right = Math.min(1, region.x + region.w + pad);
  const bottom = Math.min(1, region.y + region.h + pad);
  return { x, y, w: Math.max(0, right - x), h: Math.max(0, bottom - y) };
}

// Crop highlighted areas out of a notes photo. Empty input means "use the whole page".
export async function cropImageRegions(dataUrl, regions) {
  const boxes = (Array.isArray(regions) ? regions : [])
    .map((region) => padRegion(region))
    .filter((region) => region.w >= 0.02 && region.h >= 0.02);
  if (!boxes.length) return [];

  const img = await loadHtmlImage(dataUrl);
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) throw new Error('Could not read that photo');

  return boxes.map((region) => {
    const sx = Math.max(0, Math.min(nw - 1, Math.round(region.x * nw)));
    const sy = Math.max(0, Math.min(nh - 1, Math.round(region.y * nh)));
    const sw = Math.max(1, Math.min(nw - sx, Math.round(region.w * nw)));
    const sh = Math.max(1, Math.min(nh - sy, Math.round(region.h * nh)));
    const long = Math.max(sw, sh);
    const scale = Math.min(1600 / long, Math.max(1, 900 / long));
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));
    const canvas = document.createElement('canvas');
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not read that photo');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, dw, dh);
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, dw, dh);
    return canvas.toDataURL('image/jpeg', 0.88);
  });
}

// Full pages stay unmarked. Highlighted pages become one image per box.
export async function buildHighlightedExtractPlan(images, regionsByImage) {
  const photos = (Array.isArray(images) ? images : []).filter(Boolean);
  const entries = [];
  for (let i = 0; i < photos.length; i++) {
    const regions = Array.isArray(regionsByImage?.[i]) ? regionsByImage[i] : [];
    if (!regions.length) {
      entries.push({ image: photos[i], scoped: false });
      continue;
    }
    const crops = await cropImageRegions(photos[i], regions);
    if (!crops.length) entries.push({ image: photos[i], scoped: false });
    else crops.forEach((image) => entries.push({ image, scoped: true }));
  }
  return entries;
}
