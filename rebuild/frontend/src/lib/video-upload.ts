/**
 * رفع فيديو المنتج من أي جهاز وبأي صيغة (آيفون .mov/HEVC، أندرويد، أي حاجة):
 * ١) الأصل بيترفع لمخزن Supabase على أجزاء (كل جزء ٤٥ ميجا — حد المخزن المجاني ٥٠ للملف) في tmp/
 * ٢) السيرفر بيحوّله لـ H.264 mp4 (بيشتغل في أي متصفح، حتى الكمبيوترات اللي مابتشغلش فيديو الآيفون) ويرجّع لينكه.
 */
import { api } from './api';

const SB = 'https://aglwhwrwhobxykizjytc.supabase.co';
// مفتاح الـ anon علني بطبعه (زي أي موقع Supabase)، والمخزن نفسه مقفول على الفيديوهات بس
const ANON = 'sb_publishable_dcjzvoUOmi__7tFVpeTIDA_t6HNC-Ki';
const PART = 45 * 1024 * 1024;
const MAX_PARTS = 8;

function putPart(name: string, blob: Blob, onPct: (loaded: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', `${SB}/storage/v1/object/mk-videos/${name}`);
    x.setRequestHeader('authorization', `Bearer ${ANON}`);
    x.setRequestHeader('apikey', ANON);
    x.setRequestHeader('content-type', 'application/octet-stream');
    x.upload.onprogress = (e) => e.lengthComputable && onPct(e.loaded);
    x.onload = () => (x.status >= 200 && x.status < 300 ? resolve() : reject(new Error(`الفيديو مارفعش (${x.status}) ${x.responseText.slice(0, 120)}`)));
    x.onerror = () => reject(new Error('النت قطع وانت بترفع الفيديو، جرّب تاني'));
    x.send(blob);
  });
}

export async function uploadSiteVideo(f: File, say: (label: string) => void): Promise<string> {
  const n = Math.ceil(f.size / PART);
  if (!f.size) throw new Error('الفيديو فاضي');
  if (n > MAX_PARTS) throw new Error(`الفيديو ${Math.round(f.size / 1048576)} ميجا — كبير قوي. الحد ${Math.round((PART * MAX_PARTS) / 1048576)} ميجا (حوالي دقيقة ونص فيديو آيفون)`);
  const job = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  const parts: string[] = [];
  let done = 0;
  for (let i = 0; i < n; i++) {
    const name = `tmp/${job}/p${i}`;
    const blob = f.slice(i * PART, Math.min(f.size, (i + 1) * PART));
    await putPart(name, blob, (loaded) => say(`بيترفع… ${Math.min(99, Math.round(((done + loaded) / f.size) * 100))}%`));
    done += blob.size;
    parts.push(name);
  }
  say('بيحوّل الفيديو عشان يشتغل على أي جهاز… (ممكن ياخد دقيقة)');
  const r = await api.post<{ url: string }>('/web/video/convert', { parts });
  return r.url;
}
