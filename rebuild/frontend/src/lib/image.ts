/** Shrinks a picked image so it can be stored inline in the settings (the old system kept base64 too). */
const isHeic = (f: File) => /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name);

function load(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('decode'));
    };
    img.src = url;
  });
}

export async function fileToDataUrl(file: File, maxSide: number): Promise<string> {
  let img: HTMLImageElement;
  try {
    img = await load(file);
  } catch {
    // صور الآيفون (HEIC) كروم على الكمبيوتر مابيفتحهاش: نحوّلها لـ JPEG الأول
    if (!isHeic(file)) throw new Error(`الملف "${file.name}" مش صورة المتصفح يعرف يفتحها (${file.type || 'نوع مجهول'}) — صوّرها JPG أو PNG`);
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      img = await load(Array.isArray(out) ? out[0]! : out);
    } catch {
      throw new Error(`مقدرتش أحوّل صورة الآيفون "${file.name}" — ابعتها من الآيفون بصيغة JPG (الإعدادات ← الكاميرا ← التنسيقات ← الأكثر توافقًا)`);
    }
  }
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('المتصفح مش قادر يعالج الصورة');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  // PNG keeps logo transparency; photos (backgrounds) are smaller as JPEG.
  return file.type === 'image/png' && maxSide <= 800 ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82);
}
