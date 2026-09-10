// Shrink notes photos so they can be sent to the study AI.
// Keep data URLs off React Router history — iOS caps history state size.

// A page or two of notes — not a chapter or a book.
export const MAX_NOTE_PHOTOS = 2;
export const MAX_NOTE_PHOTO_BYTES = 12 * 1024 * 1024;

let pendingPhotos = [];

export function stashPhotos(images) {
  pendingPhotos = (Array.isArray(images) ? images : images ? [images] : []).filter(Boolean);
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

export function clearPhoto() {
  pendingPhotos = [];
}

export function validateNotePhotos(fileList) {
  const files = [...(fileList || [])].filter(Boolean);
  if (!files.length) {
    return { error: 'Please choose a photo of your notes.' };
  }
  if (files.length > MAX_NOTE_PHOTOS) {
    return {
      error: 'You can attach up to 2 photos — a page or two of notes, not a whole book.',
    };
  }
  for (const file of files) {
    if (file.type && !file.type.startsWith('image/')) {
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

export function fileToJpegDataUrl(file, { maxDim = 1600, quality = 0.72 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No photo selected'));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Could not read that photo'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read that photo'));
    };
    img.src = url;
  });
}
