/**
 * رفع فيديو من التليفون/الكمبيوتر مباشرة لمخزن Supabase (الباك إند على Vercel بياخد 4.5 ميجا بس، والفيديو أكبر).
 * الحد الأقصى ٥٠ ميجا (حد المخزن المجاني). بيرجّع لينك مباشر للفيديو والموقع بيشغّله.
 */
const SB = 'https://aglwhwrwhobxykizjytc.supabase.co';
// مفتاح الـ anon علني بطبعه (زي أي موقع Supabase)، والمخزن نفسه مقفول على الفيديوهات بس وبحد ٥٠ ميجا
const ANON = 'sb_publishable_dcjzvoUOmi__7tFVpeTIDA_t6HNC-Ki';
export const MAX_VIDEO_MB = 50;

export function uploadSiteVideo(f: File, onProgress?: (pct: number) => void): Promise<string> {
  const ext = /\.webm$/i.test(f.name) || f.type === 'video/webm' ? 'webm' : /\.mov$/i.test(f.name) || f.type === 'video/quicktime' ? 'mov' : 'mp4';
  const type = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  if (f.size > MAX_VIDEO_MB * 1024 * 1024) return Promise.reject(new Error(`الفيديو ${Math.round(f.size / 1048576)} ميجا — الحد الأقصى ${MAX_VIDEO_MB} ميجا. قصّره أو صوّره بجودة أقل`));
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.${ext}`;
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${SB}/storage/v1/object/mk-videos/${name}`);
    x.setRequestHeader('authorization', `Bearer ${ANON}`);
    x.setRequestHeader('apikey', ANON);
    x.setRequestHeader('content-type', type);
    x.upload.onprogress = (e) => e.lengthComputable && onProgress?.(Math.round((e.loaded / e.total) * 100));
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(`${SB}/storage/v1/object/public/mk-videos/${name}`) : reject(new Error(`الفيديو مارفعش (${x.status})`)));
    x.onerror = () => reject(new Error('النت قطع وانت بترفع الفيديو، جرّب تاني'));
    x.send(f);
  });
}
