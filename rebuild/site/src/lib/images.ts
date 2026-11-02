// Shrink a photo in the browser before upload (JPEG so the system's Telegram/WhatsApp alerts can show it).
export function shrinkImage(f: Blob, max: number, quality = 0.8): Promise<Blob> {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(f);
    const im = new Image();
    im.onerror = () => { URL.revokeObjectURL(url); rej(new Error('img')); };
    im.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, max / Math.max(im.width, im.height));
      const c = document.createElement('canvas');
      c.width = Math.round(im.width * k);
      c.height = Math.round(im.height * k);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
      c.toBlob(b => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', quality);
    };
    im.src = url;
  });
}

/** Render an SVG string to a JPEG blob (used for custom-order drawings). */
export function svgToJpeg(svg: string, w = 800, h = 600): Promise<Blob> {
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = w; c.height = h;
      const x = c.getContext('2d')!;
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.drawImage(im, 0, 0, w, h);
      c.toBlob(b => (b ? res(b) : rej(new Error('img'))), 'image/jpeg', 0.88);
    };
    im.onerror = rej;
    im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
