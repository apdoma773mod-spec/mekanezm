/**
 * صور الآيفون (HEIC/HEIF) في أي مكان في السيستم: كروم على الكمبيوتر مابيفتحهاش، فبنحوّلها لـ JPEG قبل ما أي شاشة تلمسها.
 * - isImageFile: صورة بالنوع أو بالامتداد (ويندوز أوقات بيدّي نوع فاضي)
 * - toDecodable: لو HEIC → JPEG، غير كده زي ما هي
 * - installFileNormalizer: مرة واحدة في التطبيق: أي خانة اختيار صور بتقبل HEIC وبتسلّم الشاشة JPEG جاهز
 */
const IMG_EXT = /\.(jpe?g|jfif|pjpeg|pjp|png|webp|gif|bmp|avif|heic|heif|tiff?)$/i;
export const isHeic = (f: { type?: string; name?: string }) => /hei[cf]/i.test(f.type || '') || /\.hei[cf]$/i.test(f.name || '');
export const isImageFile = (f: File) => /^image\//.test(f.type) || IMG_EXT.test(f.name);

export async function heicToJpeg(file: Blob, name = 'photo.heic'): Promise<File> {
  const why: string[] = [];
  let jpg: Blob | null = null;
  try {
    const { heicTo } = await import('heic-to');
    jpg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.9 });
  } catch (e) {
    why.push('1:' + String((e as Error)?.message ?? e).slice(0, 60));
  }
  if (!jpg) {
    try {
      const { default: heic2any } = await import('heic2any');
      const out = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.9 });
      jpg = Array.isArray(out) ? out[0]! : out;
    } catch (e) {
      why.push('2:' + String((e as { message?: string })?.message ?? JSON.stringify(e)).slice(0, 60));
    }
  }
  if (!jpg) throw new Error(`مقدرتش أحوّل صورة الآيفون "${name}" (${why.join(' | ')})`);
  return new File([jpg], name.replace(/\.hei[cf]$/i, '') + '.jpg', { type: 'image/jpeg', lastModified: Date.now() });
}

export async function toDecodable(f: File): Promise<File> {
  return isHeic(f) ? heicToJpeg(f, f.name) : f;
}

const DONE = '__mkNormalized';
let installed = false;

export function installFileNormalizer() {
  if (installed || typeof document === 'undefined') return;
  installed = true;
  // قبل ما نافذة اختيار الملفات تفتح: خانات الصور تقبل HEIC (ويندوز بيخبيها لو accept="image/*" بس)
  document.addEventListener(
    'click',
    (e) => {
      const el = e.target as HTMLInputElement | null;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'file') return;
      const acc = el.getAttribute('accept') || '';
      if (/image\//.test(acc) && !/heic/i.test(acc)) el.setAttribute('accept', acc + ',.heic,.heif,image/heic,image/heif');
    },
    true,
  );
  // بعد الاختيار: لو فيه صور HEIC نحوّلها الأول، وبعدين نسلّم الشاشة الملفات الجديدة كأنها اتختارت كده
  document.addEventListener(
    'change',
    (e) => {
      const el = e.target as (HTMLInputElement & { [DONE]?: boolean }) | null;
      if (!el || el.tagName !== 'INPUT' || el.type !== 'file' || !el.files?.length) return;
      if (el[DONE]) {
        el[DONE] = false;
        return;
      }
      const files = [...el.files];
      if (!files.some(isHeic)) return;
      e.stopImmediatePropagation();
      e.stopPropagation();
      void (async () => {
        const out: File[] = [];
        for (const f of files) {
          try {
            out.push(await toDecodable(f));
          } catch {
            out.push(f); // الشاشة نفسها هتطلّع رسالة واضحة باسم الملف
          }
        }
        const dt = new DataTransfer();
        out.forEach((f) => dt.items.add(f));
        el.files = dt.files;
        el[DONE] = true;
        el.dispatchEvent(new Event('change', { bubbles: true }));
      })();
    },
    true,
  );
}
