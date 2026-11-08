/**
 * رفع فيديو من التليفون/الكمبيوتر مباشرة لمخزن Supabase (الباك إند على Vercel بياخد 4.5 ميجا بس، والفيديو أكبر).
 * المخزن المجاني بيقبل ملف لحد ٥٠ ميجا، فأي فيديو أكبر بيتصغّر على الجهاز الأول (من غير تقصير) وبعدين يترفع.
 * بيرجّع لينك مباشر للفيديو والموقع بيشغّله.
 */
import { compressVideo } from './video-compress';

const SB = 'https://aglwhwrwhobxykizjytc.supabase.co';
// مفتاح الـ anon علني بطبعه (زي أي موقع Supabase)، والمخزن نفسه مقفول على الفيديوهات بس
const ANON = 'sb_publishable_dcjzvoUOmi__7tFVpeTIDA_t6HNC-Ki';
const LIMIT = 48 * 1024 * 1024;
const MAX_SRC = 450 * 1024 * 1024;

function put(f: File, say: (label: string) => void): Promise<string> {
  const ext = /\.webm$/i.test(f.name) || f.type === 'video/webm' ? 'webm' : /\.mov$/i.test(f.name) || f.type === 'video/quicktime' ? 'mov' : 'mp4';
  const type = ext === 'webm' ? 'video/webm' : ext === 'mov' ? 'video/quicktime' : 'video/mp4';
  const name = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}.${ext}`;
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${SB}/storage/v1/object/mk-videos/${name}`);
    x.setRequestHeader('authorization', `Bearer ${ANON}`);
    x.setRequestHeader('apikey', ANON);
    x.setRequestHeader('content-type', type);
    x.upload.onprogress = (e) => e.lengthComputable && say(`بيترفع… ${Math.round((e.loaded / e.total) * 100)}%`);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve(`${SB}/storage/v1/object/public/mk-videos/${name}`) : reject(new Error(`الفيديو مارفعش (${x.status})`)));
    x.onerror = () => reject(new Error('النت قطع وانت بترفع الفيديو، جرّب تاني'));
    x.send(f);
  });
}

export async function uploadSiteVideo(f: File, say: (label: string) => void): Promise<string> {
  let file = f;
  if (f.size > LIMIT) {
    if (f.size > MAX_SRC) throw new Error(`الفيديو ${Math.round(f.size / 1048576)} ميجا — كبير قوي على التليفون يصغّره. ارفعه يوتيوب غير مدرج وحط اللينك`);
    file = await compressVideo(f, 44 * 1024 * 1024, say);
  }
  return put(file, say);
}
