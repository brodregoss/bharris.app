// Shrink a notes photo so it can be sent to the study AI.
// Keep the data URL off React Router history — iOS caps history state size.

let pendingPhoto = null;

export function stashPhoto(image) {
  pendingPhoto = image || null;
}

export function peekPhoto() {
  return pendingPhoto;
}

export function clearPhoto() {
  pendingPhoto = null;
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
