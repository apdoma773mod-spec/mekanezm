/**
 * 📖 الكتالوج الاحترافي (مولّد HTML نقي): غلاف فخم، إهداء/برقية اختياري، فهرس، حكاية ميكانيزم، وكل قسم:
 * صفحة افتتاحية بصورة كاملة + قائمة بصور + صفحة لكل منتج على طريقة كتالوجات الشركات العالمية (صور متداخلة وكتل ألوان).
 * مفيش أسعار (قاعدة المالك). ممكن يطلع PDF (A4 ورا بعض) أو كتاب بيتقلّب بإيدك مع خانة بحث.
 */

export interface CatProduct {
  code: string;
  name: string;
  desc?: string;
  imgs: string[];
  dimImg?: string;
  section: string;
  inStock?: boolean;
}

export interface Article {
  id: string;
  on: boolean;
  /** دليل اختيار / تركيب / مقال / نصيحة… بيظهر فوق العنوان */
  kind: string;
  title: string;
  /** سطر عادي = فقرة، «## » عنوان فرعي، «1. » خطوة، «- » نقطة، «> » نصيحة */
  body: string;
  img?: string;
  /** فاضي = في أول الكتالوج، اسم قسم = بعد منتجات القسم ده، __end = في آخر الكتالوج */
  sec: string;
}

type Block = { t: 'p' | 'h' | 'b' | 'q'; x: string } | { t: 'n'; x: string; n: number };
export function parseBody(body: string): Block[] {
  const out: Block[] = [];
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    let m: RegExpMatchArray | null;
    if ((m = t.match(/^##\s*(.+)$/))) out.push({ t: 'h', x: m[1]! });
    else if ((m = t.match(/^(\d+)[.)\-]\s*(.+)$/))) out.push({ t: 'n', x: m[2]!, n: Number(m[1]) });
    else if ((m = t.match(/^[-•]\s*(.+)$/))) out.push({ t: 'b', x: m[1]! });
    else if ((m = t.match(/^>\s*(.+)$/))) out.push({ t: 'q', x: m[1]!.replace(/^نصيحة[:：]\s*/, '') });
    else out.push({ t: 'p', x: t });
  }
  return out;
}

export const TIPS = [
  'قِس مرتين.. وقص مرة واحدة.',
  'اختار الميكانيزم قبل ما ترسم الدولاب، مش بعده.',
  'الحمولة الصح بتعمّر الدرج سنين.',
  'سوفت كلوز.. هدوء وفخامة في كل حركة.',
  'التركيب الصح نص جودة الشغل.',
];

export const DEFAULT_ARTICLES: Article[] = [
  {
    id: 'a-choose',
    on: true,
    kind: 'دليل الاختيار',
    title: 'إزاي تختار الميكانيزم المناسب قبل ما تصمم',
    sec: '',
    body: `اختيار الميكانيزم بيتم قبل رسم الدولاب مش بعده، لأن مقاسات الدولاب نفسها بتتحدد على حسب الميكانيزم. ولو اخترته متأخر هتضطر تعدّل المقاسات وتضيّع وقت وخامة.
## الخطوات
1. حدد الاستخدام: درج هادي في أوضة النوم؟ جرار دريسنج؟ درج مطبخ تقيل للحلل؟ الاستخدام هو اللي بيحدد الحمل اللي المجرى لازم يشيله.
2. حدد الحمل: اختار مجرى حمولته أعلى من أقصى وزن هتحطه جواه بهامش أمان، خصوصًا في المطبخ.
3. حدد نوع الحركة: سوفت كلوز للقفل الهادي، أو فتح بالضغط لو من غير مقبض، أو مجرى عادي لو الميزانية بسيطة.
4. حدد طريقة التركيب: مجرى جانبي ظاهر أو مخفي تحت الدرج، وكل واحد ليه فراغات مختلفة على الجنب وتحت.
5. اختار الطول على حسب عمق الدولاب من جوه، ومتزودش عن العمق الفعلي.
6. اقرا بيانات المنتج في الكتالوج (الأطوال المتاحة والفراغات المطلوبة) وإنت بترسم، وسجّلها في الرسم.
> ابعتلنا مقاسات الدولاب على واتساب قبل التنفيذ ونرشحلك الميكانيزم المناسب.
## ليه قبل التصميم؟
- عشان تثبت المقاسات النهائية من أول مرة.
- عشان تعرف الفراغات اللازمة جنب الدرج وتحته وخلفه.
- عشان تحسب سُمك الخامة والتكلفة صح.`,
  },
  {
    id: 'a-measure',
    on: true,
    kind: 'مقال',
    title: 'إزاي تقيس صح من أول مرة',
    sec: '',
    body: `أغلب مشاكل التركيب سببها قياس غلط. خد خمس دقايق زيادة في القياس توفّر عليك يوم شغل.
## قِس إيه؟
1. العرض الداخلي للدولاب أو الفتحة، من جوه لجوه.
2. العمق الداخلي، وقِسه عند الحافة وعند الضهر عشان تتأكد إنه مستقيم.
3. الارتفاع المتاح للدرج أو للباب.
4. سُمك الخامة، لأنه بيدخل في حساب مقاس الدرج والباب.
5. أي حاجة في الطريق: ماسورة، سيفون، حلقة، أو بروز في الحيطة.
- سجّل المقاسات على الرسم نفسه مش على ورقة تانية.
- قِس مرتين، ولو الرقمين مختلفين قِس تالت.
> لو المقاس مش مظبوط، نظبط المجرى أو المفصلة على المقاس مش العكس.`,
  },
  {
    id: 'a-slide',
    on: true,
    kind: 'تركيب',
    title: 'تركيب المجرى (السكة) خطوة بخطوة',
    sec: '',
    body: `خطوات عامة لتركيب مجرى الدرج. راجع بيانات المنتج والفراغات المطلوبة قبل ما تبدأ.
1. علّم مكان المجرى على الجنب الداخلي للدولاب وعلى جنب الدرج بميزان وقلم.
2. ثبّت الجزء الثابت في الدولاب الأول، وتأكد إنه أفقي ومتساوي على الجنبين.
3. ثبّت الجزء المتحرك في الدرج على نفس الارتفاع.
4. ركّب الدرج في المجرى وجرّب الفتح والقفل.
5. لو في ميل أو احتكاك، فك البراغي شوية وعدّل الوضع وشدّ تاني.
6. اختبر الحمل: حط وزن فعلي في الدرج وجرّب الحركة.
> متستخدمش براغي أطول من اللازم عشان متخرجش من الناحية التانية للخشب.
- استخدم الميزان في كل خطوة.
- ثبّت بكل الفتحات المتاحة، مش فتحة وسيبك من الباقي.`,
  },
  {
    id: 'a-hinge',
    on: true,
    kind: 'تركيب',
    title: 'تركيب المفصلة وضبطها',
    sec: '',
    body: `المفصلة الصح بتتركب في دقايق، بس ضبطها هو اللي بيفرق بين شغل عادي وشغل محترف.
1. اعمل الحفرة (الكأس) في الباب بمقدار 35 مم بالعمق المناسب لسُمك الباب، وخلي بالك من المسافة بين الحفرة وحافة الباب.
2. ركّب جسم المفصلة في الباب وثبّته.
3. ثبّت القاعدة في جنب الدولاب على المسافة المحددة في بيانات المنتج.
4. ركّب الباب على القاعدة وجرّب الفتح والقفل.
## الضبط
- ضبط الجنب: لتساوي الفواصل بين الأبواب.
- ضبط العمق: لقرب الباب أو بعده عن الدولاب.
- ضبط الارتفاع: لتساوي الأبواب مع بعض.
> اضبط باب باب، وراجع الفواصل كلها في الآخر.`,
  },
  {
    id: 'a-care',
    on: true,
    kind: 'نصيحة',
    title: 'العناية بالسوفت كلوز والميكانيزم',
    sec: '',
    body: `شوية عادات بسيطة بتخلّي الميكانيزم يعمّر سنين.
- نضّف المجرى من التراب بقطعة قماش ناشفة أو مبلولة شوية، وتجنب المواد الكاشطة.
- متحطش في الدرج وزن أكبر من حمولة المجرى.
- متضغطش على الدرج وهو مفتوح ولا تقعد عليه.
- لو سمعت صوت أو حسيت باحتكاك، افحص التركيب والمستوى قبل ما تتفاقم المشكلة.
- اقفل الدرج بإيدك لحد ما السوفت كلوز يكمل، ومتخبطوش بقوة.
> لو في أي مشكلة، كلمنا واتساب وهنساعدك.`,
  },
];

export interface CatCfg {
  colors: { main: string; dark: string; accent: string; alt: string };
  cover: { title: string; subtitle: string; note: string; imgs: string[] };
  /** صورة افتتاح كل قسم، المفتاح اسم القسم */
  secImgs: Record<string, string>;
  layout: 'auto' | '1' | '2' | '3';
  flags: { tabs: boolean; stock: boolean; specs: boolean; gallery: boolean; toc: boolean; story: boolean; search: boolean };
  story: { title: string; text: string };
  articles: Article[];
  style: { font: string; radius: number; coverStyle: 'mosaic' | 'full' | 'minimal'; pattern: boolean; showCode: boolean; showFooter: boolean };
  cta: string;
  /** إهداء لشخص: فاضي/undefined = نسخة ميكانيزم العادية */
  gift?: { name: string; title: string; from: string; message: string };
}

export const STORY_TEXT = `بدأت الحكاية بفضول. فضول قديم لفهم السر وراء قطعة صغيرة اسمها الميكانيزم، وكيف لسوفت كلوز واحد أن يغيّر إحساس الدولاب كله ويوفّر الوقت والمجهود.
تعلّمت الشغلانة بإيدي، وبدأت رحلتي بتروسيكل صغير أمرّ به على الورش: «السلام عليكم، أنا عبده، بوزّع إكسسوار ورش ولوازم نجارة. اتفرّج على اللي معايا، ولو احتجت حاجة خد رقمي وأجيبها لك». لفّيت الشوارع زيجزاج أدوّر على ورش النجارة والألمنيوم، ومع الوقت عرفني الصنايعية وكبر الشغل.
بعدها فتحت محلًا صغيرًا في شارع المعرض، ثم وُلدت «ميكانيزم»: معرض محترم فيه ماكيت مطبخ وماكيت دريسنج، وجرارات ومفصلات تشوفها وتجربها بإيدك.
اللي بينا مش بيع قطع… ده ثقة اتبنت بالسهر والتعب والمسؤولية، وبنكمّلها معاك.`;

export const GIFT_MESSAGE = `تحية طيبة وبعد،
يسعد ميكانيزم أن تُهدي إلى سيادتكم هذا الكتالوج، ثمرة سنوات من العمل والخبرة في عالم الحركة والإكسسوارات، آملين أن تجدوا فيه ما يُلهم أعمالكم ويُيسّر تنفيذها.
ونتطلع إلى أن نكون دائمًا شريككم في النجاح.
مع خالص التقدير،`;

export const COLOR_PRESETS: { name: string; main: string; dark: string; accent: string; alt: string }[] = [
  { name: 'هوية ميكانيزم (كحلي ومانجو وذهبي)', main: '#16357a', dark: '#0a1a3a', accent: '#c9971f', alt: '#f5a623' },
  { name: 'ميكانيزم (تيل وذهبي)', main: '#087f8c', dark: '#0b2e33', accent: '#c9971f', alt: '#c9971f' },
  { name: 'أخضر زي جراس', main: '#0aa84f', dark: '#14262b', accent: '#c9971f', alt: '#c9971f' },
  { name: 'كحلي ملكي', main: '#1f4fa3', dark: '#0a1a3a', accent: '#e0b44c', alt: '#e0b44c' },
  { name: 'أسود وذهبي', main: '#2b2b2b', dark: '#0d0d0d', accent: '#d4a437', alt: '#d4a437' },
  { name: 'عنابي', main: '#8d1f3d', dark: '#2a0a14', accent: '#e0b44c', alt: '#e0b44c' },
  { name: 'برتقالي دافي', main: '#e2711d', dark: '#2a1608', accent: '#ffd27a', alt: '#ffd27a' },
  { name: 'أزرق سماوي', main: '#1597d5', dark: '#07263a', accent: '#ffb400', alt: '#ffb400' },
  { name: 'بنفسجي ملكي', main: '#6a3fb5', dark: '#1c0f38', accent: '#f0c75e', alt: '#f0c75e' },
  { name: 'أحمر ناري', main: '#c62828', dark: '#2b0b0b', accent: '#ffcf6b', alt: '#ffcf6b' },
  { name: 'زيتي هادي', main: '#5b7a3a', dark: '#1b2612', accent: '#e3c16f', alt: '#e3c16f' },
  { name: 'رمادي عصري', main: '#556b78', dark: '#10191e', accent: '#ffb347', alt: '#ffb347' },
  { name: 'بني خشبي', main: '#8a5a35', dark: '#26170d', accent: '#e8c07a', alt: '#e8c07a' },
  { name: 'تركواز فاتح', main: '#14b8a6', dark: '#0a2e2a', accent: '#f59e0b', alt: '#f59e0b' },
  { name: 'وردي أنيق', main: '#d6457f', dark: '#3a0f23', accent: '#ffd0a1', alt: '#ffd0a1' },
  { name: 'أخضر زمردي', main: '#0f8f6a', dark: '#06261d', accent: '#e6c35c', alt: '#e6c35c' },
  { name: 'ذهبي فاخر', main: '#b8860b', dark: '#1f1606', accent: '#fff1c1', alt: '#fff1c1' },
  { name: 'كحلي وتيل', main: '#0f5c7a', dark: '#071c27', accent: '#ffcc66', alt: '#ffcc66' },
  { name: 'نبيتي وذهبي', main: '#6d1030', dark: '#1f0610', accent: '#f2c76b', alt: '#f2c76b' },
  { name: 'أسود وأحمر', main: '#e11d2e', dark: '#0c0c0c', accent: '#ffffff', alt: '#ffffff' },
  { name: 'أزرق نيلي', main: '#2a3eb1', dark: '#0b1033', accent: '#ffd166', alt: '#ffd166' },
  { name: 'أخضر ليموني', main: '#7cb518', dark: '#1c2b05', accent: '#ffffff', alt: '#ffffff' },
  { name: 'قهوة وكريمي', main: '#6f4e37', dark: '#1d130d', accent: '#e9d8b4', alt: '#e9d8b4' },
  { name: 'سماوي وبرتقالي', main: '#00a6c0', dark: '#05222a', accent: '#ff7a1a', alt: '#ff7a1a' },
  { name: 'أرجواني داكن', main: '#8e2de2', dark: '#12062a', accent: '#ffd86b', alt: '#ffd86b' },
  { name: 'فحمي وتيل', main: '#0e7c86', dark: '#0a0f12', accent: '#e5b84b', alt: '#e5b84b' },
  { name: 'أخضر غابات', main: '#1e6b3a', dark: '#0a1f13', accent: '#d9b857', alt: '#d9b857' },
  { name: 'مرجاني', main: '#ef6f5e', dark: '#33120d', accent: '#ffe0a3', alt: '#ffe0a3' },
  { name: 'أزرق جليدي', main: '#3d8bfd', dark: '#0a1a33', accent: '#ffffff', alt: '#ffffff' },
  { name: 'خمري وكريمي', main: '#7a1f2e', dark: '#25090e', accent: '#f3e3c3', alt: '#f3e3c3' },
  { name: 'أسود مطفي', main: '#3a3a3a', dark: '#080808', accent: '#c0c0c0', alt: '#c0c0c0' },
];

export const DEFAULT_CFG: CatCfg = {
  colors: { main: '#16357a', dark: '#0a1a3a', accent: '#c9971f', alt: '#f5a623' },
  cover: { title: 'ميكانيزم', subtitle: 'كتالوج المنتجات', note: '', imgs: [] },
  secImgs: {},
  layout: 'auto',
  flags: { tabs: true, stock: true, specs: true, gallery: true, toc: true, story: true, search: true },
  story: { title: 'حكاية ميكانيزم', text: STORY_TEXT },
  articles: DEFAULT_ARTICLES,
  style: { font: 'Cairo', radius: 18, coverStyle: 'mosaic', pattern: true, showCode: true, showFooter: true },
  cta: 'للسعر والطلب كلمنا واتساب واذكر كود المنتج',
};

export const FONTS = ['Cairo', 'Tajawal', 'Almarai', 'Readex Pro', 'IBM Plex Sans Arabic', 'Noto Kufi Arabic', 'El Messiri', 'Changa'];

export function mergeCfg(c?: Partial<CatCfg> | null): CatCfg {
  const d = DEFAULT_CFG;
  return {
    ...d,
    ...c,
    colors: { ...d.colors, ...c?.colors },
    cover: { ...d.cover, ...c?.cover },
    secImgs: { ...c?.secImgs },
    flags: { ...d.flags, ...c?.flags },
    story: { ...d.story, ...c?.story },
    articles: Array.isArray(c?.articles) ? c.articles : d.articles,
    style: { ...d.style, ...c?.style },
    gift: c?.gift,
  };
}

export interface CatInput {
  shop: string;
  tagline?: string;
  phones: string[];
  address?: string;
  products: CatProduct[];
  cfg?: Partial<CatCfg>;
}

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const nn = (n: number) => n.toLocaleString('ar-EG');
const safeColor = (c: string, d: string) => (/^#[0-9a-fA-F]{3,8}$/.test(c) ? c : d);
const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** النص الحر → مواصفات (سطر «المقاس: 50 سم») + جمل المميزات + مقدمة قصيرة */
export function splitDesc(desc: string): { intro: string; specs: [string, string][]; points: string[] } {
  const specs: [string, string][] = [];
  const rest: string[] = [];
  const skip = /^(اسم المنتج|التصنيف|الكود)$/;
  const flat = desc.replace(/\r/g, '').replace(/\s+(نبذة عن المنتج|المميزات|المواصفات)\s*[:：]/g, '\n$1:');
  for (const raw of flat.split('\n')) {
    const t = raw.trim();
    if (!t) continue;
    const m = t.match(/^([^:：]{1,28})[:：]\s*(.+)$/);
    if (m && !/^(نبذة عن المنتج|المميزات|المواصفات)$/.test(m[1]!.trim())) {
      if (!skip.test(m[1]!.trim())) specs.push([m[1]!.trim(), m[2]!.trim()]);
    } else rest.push(t.replace(/^(نبذة عن المنتج|المميزات|المواصفات)\s*[:：]\s*/, ''));
  }
  const sentences = rest
    .join(' ')
    .split(/(?<=[.!؟?])\s+|\s*[•●▪✔✅]\s*/)
    .map((x) => x.trim())
    .filter((x) => x.length > 3);
  const intro = sentences.shift() ?? '';
  return { intro, specs: specs.slice(0, 8), points: sentences.slice(0, 5) };
}

const CSS = `
@page{size:A4;margin:0}
*{box-sizing:border-box;-webkit-print-color-adjust:exact;print-color-adjust:exact}
:root{--t:#087f8c;--td:color-mix(in srgb,var(--t) 68%,#000);--tk:#0b2e33;--g:#c9971f;--m:#f5a623;--gl:color-mix(in srgb,var(--g) 30%,#fff);--bg:#f4f8f9;--ink:#14262b;--mut:#62767c}
body{margin:0;font-family:Cairo,Tahoma,"Segoe UI",sans-serif;color:var(--ink);background:#fff;direction:rtl}
.pg{--u:calc(var(--H,1123px)/100);width:794px;height:var(--H,1123px);position:relative;overflow:hidden;page-break-after:always;background:#fff}
.pg:last-child{page-break-after:auto}
svg.bp{position:absolute;inset:0;width:100%;height:100%}
/* ===== غلاف ===== */
.cover{background:linear-gradient(170deg,var(--tk),color-mix(in srgb,var(--tk) 60%,var(--t)) 70%,var(--t));color:#fff}
.cover .mos{position:absolute;top:0;left:0;right:0;height:calc(var(--u)*57);overflow:hidden}
.cover .mos div{position:absolute;top:-40px;height:calc(var(--u)*57 + 80px);background-size:cover;background-position:center;opacity:.9}
.cover .mos div:nth-child(1){right:-60px;width:330px;clip-path:polygon(22% 0,100% 0,78% 100%,0 100%)}
.cover .mos div:nth-child(2){right:220px;width:330px;clip-path:polygon(22% 0,100% 0,78% 100%,0 100%);filter:saturate(1.1) brightness(.85)}
.cover .mos div:nth-child(3){right:500px;width:360px;clip-path:polygon(22% 0,100% 0,78% 100%,0 100%);filter:brightness(.75)}
.cover .mos:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0000 35%,var(--tk) 100%)}
.cover .gear{position:absolute;left:-90px;top:430px;width:300px;opacity:.16}
.cover .bx{position:absolute;right:60px;left:60px;bottom:70px}
.cover .kick{letter-spacing:.42em;font-size:13px;font-weight:700;color:var(--m)}
.cover h1{font-size:118px;line-height:1.02;margin:10px 0 0;font-weight:900;background:linear-gradient(180deg,#fff 20%,var(--gl) 55%,var(--g) 100%);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 8px 18px #0006)}
.cover .ln{display:flex;align-items:center;gap:14px;margin:18px 0}
.cover .ln i{height:2px;flex:1;background:linear-gradient(90deg,var(--g),transparent)}
.cover .ln b{font-size:26px;font-weight:700}
.cover .out{font-size:64px;font-weight:900;color:transparent;-webkit-text-stroke:1.5px #ffffff66;line-height:1;margin:6px 0 20px}
.cover .stats{display:flex;gap:14px;margin-top:6px}
.cover .stat{flex:1;border:1px solid #ffffff30;background:#ffffff12;border-radius:16px;padding:14px 18px;backdrop-filter:blur(2px)}
.cover .stat b{display:block;font-size:34px;color:var(--m)}.cover .stat span{font-size:13px;opacity:.85}
.cover .cont{margin-top:20px;font-size:14px;opacity:.9;line-height:2}
/* ===== إهداء / برقية ===== */
.gft{background:linear-gradient(180deg,#fffdf7,#f7efdc);display:flex;align-items:center;justify-content:center}
.gft .fr{width:640px;height:calc(var(--H,1123px) - 180px);border:2px solid var(--g);outline:1px solid var(--g);outline-offset:-12px;padding:70px 60px;position:relative;text-align:center;display:flex;flex-direction:column}
.gft .orn{color:var(--g);font-size:30px;letter-spacing:.5em}
.gft h2{font-size:24px;letter-spacing:.3em;color:var(--g);margin:6px 0 4px;font-weight:700}
.gft .to{font-size:22px;color:var(--mut);margin-top:34px}
.gft .nm{font-size:50px;font-weight:900;color:var(--tk);margin:4px 0 0;line-height:1.3}
.gft .tt{font-size:18px;color:var(--t);font-weight:700}
.gft .ln{width:90px;height:3px;background:var(--g);margin:22px auto}
.gft .msg{font-size:20px;line-height:2.15;color:#2b3b3f;white-space:pre-line;text-align:center;flex:1}
.gft .sg{margin-top:auto;font-size:18px;color:var(--mut)}.gft .sg b{display:block;font-size:30px;color:var(--tk);font-weight:900}
/* ===== فهرس وحكاية ===== */
.toc{padding:70px 64px}
.toc h2{font-size:40px;margin:0 0 6px;color:var(--td)}
.bar{width:70px;height:5px;border-radius:9px;background:var(--g)}
.toc .bar{margin-bottom:28px}
.toc .row{display:flex;align-items:baseline;gap:10px;padding:11px 0;border-bottom:1px dashed #cfdcdf;font-size:20px;font-weight:700}
.toc .row i{flex:1;border-bottom:2px dotted #b9c9cc;transform:translateY(-5px)}
.toc .row span{color:var(--t)}.toc .sub{display:block;font-weight:500;font-size:13px;color:var(--mut)}
.sty{background:linear-gradient(160deg,var(--tk),color-mix(in srgb,var(--tk) 55%,var(--t)));color:#fff;padding:80px 64px}
.sty .q{position:absolute;top:30px;left:40px;font-size:240px;font-weight:900;color:#ffffff12;line-height:1}
.sty h2{font-size:56px;margin:0;position:relative;color:var(--gl)}
.sty .bar{margin:16px 0 28px;position:relative}
.sty p{font-size:19px;line-height:2.1;margin:0 0 12px;position:relative;opacity:.96}
.sty .sg{font-size:22px;color:var(--gl);font-weight:700;margin-top:18px;position:relative}
.note{padding:80px 60px;background:repeating-linear-gradient(#fff 0 39px,#e3ecee 39px 40px)}
.note h2{font-size:30px;color:var(--td);margin:0 0 20px;background:#fff;display:inline-block;padding:0 10px}
/* ===== تبويبات الأقسام ===== */
.tabs{position:absolute;top:150px;left:0;display:flex;flex-direction:column;gap:3px;z-index:9}
.tabs i{display:flex;align-items:center;justify-content:center;width:26px;min-height:44px;background:#ffffffcc;color:#7c8c91;font:900 15px Cairo,sans-serif;font-style:normal;border-radius:0 8px 8px 0;box-shadow:0 2px 6px #0003}
.tabs i.on{background:var(--m);color:var(--tk);width:36px}
/* ===== افتتاحية قسم + قائمة ===== */
.opn{background:var(--tk);color:#fff}
.opn img.bgi{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.opn:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#0000 38%,color-mix(in srgb,var(--tk) 94%,transparent) 100%)}
.opn .tt{position:absolute;right:56px;left:56px;bottom:90px;z-index:2}
.opn .tt small{letter-spacing:.3em;color:var(--m);font-weight:700;font-size:13px}
.opn .tt h2{font-size:64px;line-height:1.2;margin:8px 0 0}
.opn .tt .bar{width:100px;height:6px;margin:20px 0}
.opn .tt p{margin:0;font-size:19px;opacity:.9}
.opn .no{position:absolute;top:36px;right:40px;z-index:2;font-size:120px;font-weight:900;color:#ffffff40;line-height:1}
.lst{padding:70px 50px 60px;display:flex;flex-direction:column}.lst .rows{flex:1;display:flex;flex-direction:column;max-height:calc(var(--H,1123px) - 260px)}
.lst h2{font-size:34px;margin:0;color:var(--td)}.lst .bar{margin:10px 0 22px}
.lst .it{display:flex;align-items:center;gap:18px;padding:14px 0;border-top:2px solid var(--ink);flex:1;max-height:330px}
.lst .it:last-child{border-bottom:2px solid var(--ink)}
.lst .it img{width:300px;height:100%;max-height:300px;object-fit:cover;border-radius:10px;background:#eef3f4;flex:none}
.lst .it b{display:block;font-size:22px;line-height:1.4}.lst .it small{display:block;color:var(--mut);font-size:13px;margin-top:3px}
.lst .it span.n{margin-inline-start:auto;font-size:26px;font-weight:700;color:var(--mut);padding-inline-start:10px}
/* ===== صفحة المنتج (تداخل صور وألوان) ===== */
.pp .hd{position:absolute;top:0;left:0;right:0;height:44px;z-index:8;background:var(--tk);display:flex;align-items:center;justify-content:space-between;padding:0 44px;font-size:12.5px;color:#fff;border-bottom:1.5px solid #ffffff90}
.pp .hd b{font-weight:800;letter-spacing:.04em}
.pp h1{margin:0;line-height:1.3;font-weight:900}
.pp .gl{width:64px;height:5px;border-radius:9px;background:var(--g);margin:12px 0 14px}
.pp p.intro{font-size:15.5px;line-height:2;margin:0 0 10px}
.pp ul.ft{list-style:none;padding:0;margin:8px 0 0;display:grid;gap:8px}
.pp ul.ft li{display:flex;gap:10px;align-items:flex-start;font-size:13.8px;line-height:1.75}
.pp ul.ft li:before{content:"";flex:none;width:9px;height:9px;margin-top:9px;background:var(--m);transform:rotate(45deg)}
.pp .code{position:absolute;z-index:8;background:var(--m);color:var(--tk);font-weight:900;font-size:17px;padding:5px 18px;border-radius:99px;direction:ltr;letter-spacing:.06em;box-shadow:0 6px 16px #0004}
.pp .stk{position:absolute;z-index:8;border-radius:99px;padding:5px 14px;font-size:13px;font-weight:800;box-shadow:0 4px 12px #0003}
.pp .stk.ok{background:#e4f8ec;color:#0e7a3f}.pp .stk.no{background:#fde8e6;color:#b4382b}
.pp .card{background:#fff;border-radius:var(--r,18px);overflow:hidden;box-shadow:0 14px 34px #0b2e3338;position:absolute;z-index:6}
.pp .card h3{margin:0;padding:8px 14px;background:var(--m);color:var(--tk);font-size:13.5px;letter-spacing:.04em}
.pp .card table{width:100%;border-collapse:collapse;font-size:13px}
.pp .card td{padding:6px 14px;border-top:1px solid #e6eef0}
.pp .card tr:nth-child(even) td{background:#f6fafb}
.pp .card td:first-child{color:var(--mut);width:42%}.pp .card td:last-child{font-weight:800}
.pp .tiles{position:absolute;z-index:6;display:grid;gap:8px}
.pp .tiles div{background-size:cover;background-position:center;border-radius:calc(var(--r,18px) - 4px);border:4px solid #fff;box-shadow:0 8px 20px #0003}
.pp .dim{position:absolute;z-index:7;background:#fff;border-radius:var(--r,18px);padding:6px;box-shadow:0 14px 30px #0004;border:2px solid var(--g)}
.pp .dim img{width:100%;display:block;border-radius:10px}.pp .dim small{display:block;text-align:center;font-weight:800;color:var(--td);font-size:12px;padding:3px 0 1px}
.pp .ft2{position:absolute;bottom:0;left:0;right:0;height:46px;z-index:8;display:flex;align-items:center;justify-content:space-between;padding:0 44px;font-size:12px}
.pp .ft2 b{direction:ltr}
.pp .cta{position:absolute;z-index:8;font-size:13px;line-height:1.7}.pp .cta b{direction:ltr;display:inline-block}
/* ===== مقالات وإرشادات + صفحة نصيحة ===== */
.ft2{position:absolute;bottom:0;left:0;right:0;height:44px;z-index:8;display:flex;align-items:center;justify-content:space-between;padding:0 44px;font-size:12px;background:var(--tk);color:#ffffffcc}.ft2 b{direction:ltr}
.art{background:linear-gradient(180deg,#fff,#f4f7fa)}
.art .aim{position:absolute;top:0;left:0;width:100%;height:calc(var(--H,1123px)*.27);object-fit:cover}
.art .ahd{position:relative;padding:62px 56px 0}
.art .ahd.ov{padding-top:calc(var(--H,1123px)*.27 - 62px);background:linear-gradient(180deg,#0000,#fff 55px)}
.art .ahd small{color:var(--m);font-weight:900;letter-spacing:.08em;background:var(--tk);padding:3px 12px;border-radius:99px;font-size:12px}
.art .ahd h2{font-size:calc(34px*var(--fs,1));line-height:1.35;margin:12px 0 0;color:var(--tk)}
.art .ahd .bar{margin:12px 0 0}
.art{display:flex;flex-direction:column}.art .ahd{flex:none}.art .abd{flex:1;display:flex;flex-direction:column;padding:20px 56px 64px;font-size:calc(16px*var(--fs,1));line-height:2;min-height:0}.art .abd .fill{flex:1;min-height:170px;margin-top:14px;display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.art .abd .fill img{width:100%;height:100%;object-fit:cover;border-radius:var(--r,18px);border:4px solid #fff;box-shadow:0 10px 24px #0a1a3a40;min-height:0}
.art .abd p{margin:0 0 12px;color:#2b3b3f}
.art .abd h3{font-size:21px;color:var(--t);margin:18px 0 8px;border-inline-start:5px solid var(--m);padding-inline-start:10px}
.art .stp{display:flex;gap:12px;align-items:flex-start;margin:0 0 10px;background:#fff;border-radius:var(--r,18px);padding:calc(10px*var(--fs,1)) 14px;box-shadow:0 5px 14px #0a1a3a1a}
.art .stp i{flex:none;width:34px;height:34px;border-radius:50%;background:var(--t);color:#fff;font:900 17px Cairo,sans-serif;font-style:normal;display:flex;align-items:center;justify-content:center;margin-top:2px}
.art .bul{position:relative;margin:0 0 8px;padding-inline-start:22px;color:#2b3b3f}
.art .bul:before{content:"";position:absolute;right:0;top:12px;width:9px;height:9px;background:var(--m);transform:rotate(45deg)}
.art .tipb{margin:14px 0;background:linear-gradient(135deg,var(--tk),color-mix(in srgb,var(--tk) 65%,var(--t)));color:#fff;border-radius:var(--r,18px);padding:14px 18px;border-inline-start:6px solid var(--m)}
.art .tipb b{display:block;color:var(--m);margin-bottom:2px}
.tip{background:var(--tk);color:#fff}
.tip .bgi{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.55}
.tip:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,color-mix(in srgb,var(--tk) 55%,transparent),var(--tk))}
.tip .tq{position:absolute;z-index:2;right:56px;left:56px;top:34%}
.tip .tq small{letter-spacing:.2em;color:var(--m);font-weight:800}
.tip .tq h2{font-size:56px;line-height:1.4;margin:14px 0 0;font-weight:900}
.tip .tq .bar{margin-top:22px}
.tip .ft2{z-index:5}
/* ===== صور كبيرة متداخلة + مربعات صغيرة (٣ تخطيطات) ===== */
.pp{--u:calc(var(--H,1123px)/100)}
.pp .im{position:absolute;object-fit:cover;background:#dfe7ea;display:block}
.pp .bd{border:5px solid #fff;border-radius:var(--r,18px);box-shadow:0 16px 36px #0a1a3a55}
.pp .chips{position:absolute;display:grid;gap:6px;z-index:6}
.pp .chip{background:#fff;border-radius:max(4px,calc(var(--r,18px) - 6px));padding:6px 10px;box-shadow:0 6px 16px #0a1a3a26;font-size:12px;line-height:1.55;color:#243438;border-inline-start:4px solid var(--m)}
.pp .chip b{display:block;color:var(--t);font-size:10.5px;letter-spacing:.03em;font-weight:800}
.pp .chip.k{display:flex;justify-content:space-between;gap:8px}.pp .chip.k b{display:inline;font-size:11px;color:var(--mut)}.pp .chip.k span{font-weight:800}
.pp .glass{position:absolute;z-index:5;background:color-mix(in srgb,var(--tk) 90%,transparent);color:#fff;border-radius:var(--r,18px);padding:14px 16px;box-shadow:0 14px 30px #0a1a3a55}
.pp .glass h1{font-size:25px;color:#fff}.pp .glass .gl{margin:8px 0 8px;width:48px;height:4px}.pp .glass p.intro{font-size:12.8px;line-height:1.85;color:#ffffffe6;margin:0}
.pp .dim{width:130px;padding:4px}.pp .dim small{font-size:10.5px}
.pp .ft2{background:var(--tk);color:#ffffffcc;height:44px}
.pp .ctat{position:absolute;z-index:6;font-size:12px;line-height:1.7;font-weight:800;color:var(--tk)}.pp .ctat b{direction:ltr;display:inline-block;color:var(--t)}
/* كل الصور كبيرة، وتحتها شبكة مربعات بتملا المساحة اللي فاضلة بالظبط (مفيش فراغات) */
.pp{--ah:calc(var(--H,1123px) - 300px)}
.pp .bx{position:absolute;z-index:6;left:24px;right:24px;top:calc(var(--H,1123px) - 288px);bottom:52px;display:grid;gap:8px;grid-template-rows:1fr auto}
.pp .bx .r1{display:grid;gap:8px;grid-auto-flow:column;grid-auto-columns:1fr;min-height:0}
.pp .bx .r2{display:grid;gap:8px;grid-auto-flow:column;grid-auto-columns:1fr}
.pp .bx .chip{display:flex;flex-direction:column;justify-content:center;min-height:0;overflow:hidden}
.pp .bx .chip.k{flex-direction:row;align-items:center;justify-content:space-between;padding:7px 10px}
.pp .r1.n1 .chip{font-size:15px;line-height:1.9;padding:12px 16px}.pp .r1.n1 .chip b{font-size:12px}.pp .r1.n2 .chip{font-size:13.2px;line-height:1.75}.pp .chip.hl{background:linear-gradient(135deg,var(--t),color-mix(in srgb,var(--t) 60%,#000));color:#fff;border-inline-start-color:var(--m)}.pp .chip.hl b{color:var(--m)}
.pp .nm{position:absolute;z-index:7;font-weight:900;color:#fff;text-shadow:0 3px 14px #000c;line-height:1.3}
.pp .nm small{display:block;font-size:12px;font-weight:700;color:var(--m);letter-spacing:.06em;margin-bottom:2px}
/* أ: صورة رئيسية بعرض الصفحة + صورتين كبار طالعين عليها */
.la .i1{top:0;left:0;width:100%;height:calc(var(--ah)*.62)}
.la .sh{position:absolute;z-index:3;left:0;right:0;top:0;height:calc(var(--ah)*.62);background:linear-gradient(180deg,#0a1a3ad9 0,#0000 26%,#0000 74%,#0a1a3a55 100%)}
.la .i2{left:24px;top:calc(var(--ah)*.5);width:calc(50% - 30px);height:calc(var(--ah)*.5 - 6px);z-index:5}
.la .i3{right:24px;top:calc(var(--ah)*.5);width:calc(50% - 30px);height:calc(var(--ah)*.5 - 6px);z-index:5}
.la .nm{right:28px;top:56px;left:90px;font-size:24px}
.la .code{top:56px;left:28px}.la .stk{top:98px;left:28px}.la .dim{right:28px;top:calc(var(--ah)*.34);z-index:8}
/* ب: صورة طويلة على اليمين بحافة مائلة + صورتين فوق بعض */
.lb .i1{left:0;top:0;width:64%;height:var(--ah);clip-path:polygon(0 0,100% 0,88% 100%,0 100%)}
.lb .sh{position:absolute;z-index:3;left:0;top:0;width:64%;height:var(--ah);background:linear-gradient(180deg,#0a1a3acc 0,#0000 24%,#0000 100%)}
.lb .i2{right:24px;top:52px;width:46%;height:calc((var(--ah) - 64px)*.5 - 4px);z-index:5}
.lb .i3{right:24px;top:calc(52px + (var(--ah) - 64px)*.5 + 4px);width:46%;height:calc((var(--ah) - 64px)*.5 - 4px);z-index:5}
.lb .nm{left:24px;top:56px;width:50%;font-size:23px}
.lb .code{left:24px;top:calc(var(--ah) - 56px)}.lb .stk{left:24px;top:calc(var(--ah) - 98px)}.lb .dim{left:24px;top:calc(var(--ah)*.5);z-index:8}
/* ج: شريط عنوان + صورة كبيرة بإطار + صورتين كبار متداخلين تحتها */
.lc .bnd{position:absolute;z-index:2;left:0;right:0;top:0;height:calc(var(--ah)*.2 + 44px);background:linear-gradient(165deg,var(--tk),color-mix(in srgb,var(--tk) 62%,var(--t)));clip-path:polygon(0 0,100% 0,100% 90%,0 100%)}
.lc .nm{right:44px;top:58px;width:62%;font-size:24px;text-shadow:none}
.lc .i1{left:24px;width:calc(100% - 48px);top:calc(var(--ah)*.2 + 14px);height:calc(var(--ah)*.5);z-index:3}
.lc .i2{left:24px;top:calc(var(--ah)*.62 + 6px);width:calc(50% - 30px);height:calc(var(--ah)*.38 - 8px);z-index:5}
.lc .i3{right:24px;top:calc(var(--ah)*.62 + 6px);width:calc(50% - 30px);height:calc(var(--ah)*.38 - 8px);z-index:5}
.lc .code{left:30px;top:58px;z-index:8}.lc .stk{left:30px;top:100px;z-index:8}.lc .dim{left:30px;top:calc(var(--ah)*.3);z-index:8}
`;

/** رسم هندسي خفيف (شبكة + دوائر قياس) */
const blueprint = (w: number, h: number, light = true) => {
  const c = light ? '#087f8c' : '#ffffff';
  const o = light ? 0.12 : 0.1;
  const lines: string[] = [];
  for (let x = 0; x <= w; x += 40) lines.push(`<line x1="${x}" y1="0" x2="${x}" y2="${h}" stroke="${c}" stroke-opacity="${x % 200 === 0 ? o * 1.6 : o * 0.7}" stroke-width="${x % 200 === 0 ? 1.2 : 0.6}"/>`);
  for (let y = 0; y <= h; y += 40) lines.push(`<line x1="0" y1="${y}" x2="${w}" y2="${y}" stroke="${c}" stroke-opacity="${y % 200 === 0 ? o * 1.6 : o * 0.7}" stroke-width="${y % 200 === 0 ? 1.2 : 0.6}"/>`);
  const cx = w * 0.5;
  const cy = h * 0.5;
  const ring = (r: number) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${c}" stroke-opacity="${o * 1.4}" stroke-dasharray="6 7"/>`;
  return `<svg class="bp" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${lines.join('')}${ring(h * 0.22)}${ring(h * 0.36)}</svg>`;
};

const gearSvg = () => {
  const teeth = 16;
  let d = '';
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2;
    const a2 = a + (Math.PI * 2) / teeth / 2;
    const p = (r: number, t: number) => `${(150 + r * Math.cos(t)).toFixed(1)},${(150 + r * Math.sin(t)).toFixed(1)}`;
    d += `${i ? 'L' : 'M'}${p(110, a)} L${p(138, a + 0.05)} L${p(138, a2 - 0.05)} L${p(110, a2)} `;
  }
  return `<svg class="gear" viewBox="0 0 300 300" xmlns="http://www.w3.org/2000/svg"><path d="${d}Z" fill="none" stroke="#fff" stroke-width="3"/><circle cx="150" cy="150" r="70" fill="none" stroke="#fff" stroke-width="3"/><circle cx="150" cy="150" r="26" fill="none" stroke="#fff" stroke-width="3"/></svg>`;
};

export interface SearchItem {
  n: string;
  c: string;
  s: string;
  p: number;
}
interface Built {
  pages: string[];
  css: string;
  index: SearchItem[];
  vars: string;
}

export function proPages(inp: CatInput): Built {
  const cfg = mergeCfg(inp.cfg);
  const phones = inp.phones.filter(Boolean);
  const phoneTxt = phones.join(' · ');
  const st = cfg.style;
  const fam = (FONTS.includes(st.font) ? st.font : 'Cairo');
  const vars = `:root{--r:${Math.max(0, Math.min(40, Number(st.radius) || 0))}px;--ff:'${fam}'}body{font-family:'${fam}',Cairo,Tahoma,sans-serif}${st.pattern ? '' : ' svg.bp{display:none}'}${st.showCode ? '' : ' .pp .code{display:none}'}${st.showFooter ? '' : ' .ft2{display:none}'}:root{--t:${safeColor(cfg.colors.main, '#087f8c')};--tk:${safeColor(cfg.colors.dark, '#0b2e33')};--g:${safeColor(cfg.colors.accent, '#c9971f')};--m:${safeColor(cfg.colors.alt, '#f5a623')}}`;
  const bySec = new Map<string, CatProduct[]>();
  for (const p of inp.products) {
    const k = p.section || 'منتجات متنوعة';
    if (!bySec.has(k)) bySec.set(k, []);
    bySec.get(k)!.push(p);
  }
  const secs = [...bySec.entries()];
  const heroOf = (p: CatProduct) => p.imgs.find((u) => u !== p.dimImg) || p.imgs[0] || '';
  const F = cfg.flags;
  const arts = cfg.articles.filter((a) => a.on && a.title.trim() && a.body.trim());

  // الصفحات بتتحط في قايمة بالترتيب، ورقم كل صفحة هو مكانها في القايمة (الـ HTML بيتبني آخر حاجة)
  const entries: ((i: number) => string)[] = [];
  const index: SearchItem[] = [];
  const add = (b: (i: number) => string) => entries.push(b);
  const start = new Map<string, number>();
  const prodPage = new Map<string, number>();
  const artStart = new Map<string, number>();
  let total = 0;
  const pn = (i: number) => nn(i + 1);
  const foot = (i: number) => `<div class="ft2"><span>${esc(inp.shop)}${inp.address ? ` — ${esc(inp.address)}` : ''}</span><b>${esc(phoneTxt)}</b><span>${pn(i)} / ${nn(total)}</span></div>`;
  const tabs = (cur: number) => (F.tabs && cur >= 0 ? `<div class="tabs">${secs.map((_, i) => `<i class="${i === cur ? 'on' : ''}">${nn(i + 1)}</i>`).join('')}</div>` : '');

  // الغلاف
  const covImgs = (cfg.cover.imgs.length ? cfg.cover.imgs : inp.products.map(heroOf).filter(Boolean)).slice(0, 3);
  while (covImgs.length && covImgs.length < 3) covImgs.push(covImgs[covImgs.length - 1]!);
  const cs = cfg.style.coverStyle;
  const mosHtml = cs === 'minimal' ? '' : cs === 'full' && covImgs[0] ? `<div class="mos" style="height:100%"><div style="inset:0;width:100%;right:0;top:0;height:100%;clip-path:none;background-image:url('${esc(covImgs[0])}');opacity:.55"></div></div>` : `<div class="mos">${covImgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join('')}</div>`;
  add(() => `<section class="pg cover">${mosHtml}${gearSvg()}
  <div class="bx"><div class="kick">PRODUCT CATALOG</div><h1>${esc(cfg.cover.title)}</h1>
  <div class="ln"><b>${esc(cfg.cover.subtitle)}</b><i></i></div>
  <div class="out">${new Date().getFullYear()}</div>
  ${cfg.cover.note ? `<div class="cont" style="margin:-8px 0 14px;font-size:17px">${esc(cfg.cover.note)}</div>` : ''}
  <div class="stats"><div class="stat"><b>${nn(inp.products.length)}</b><span>منتج</span></div><div class="stat"><b>${nn(secs.length)}</b><span>قسم</span></div><div class="stat"><b>${esc(phones[0] ?? '')}</b><span>واتساب وطلبات</span></div></div>
  <div class="cont">${esc(inp.tagline || '')}${inp.address ? `<br>📍 ${esc(inp.address)}` : ''}</div></div></section>`);

  if (cfg.gift) {
    const g = cfg.gift;
    add(() => `<section class="pg gft"><div class="fr"><div class="orn">✦ ✦ ✦</div><h2>برقية إهداء</h2><div class="orn" style="font-size:16px">${esc(inp.shop)}</div>
      <div class="to">إلى السيد / الأستاذ</div><div class="nm">${esc(g.name)}</div>${g.title ? `<div class="tt">${esc(g.title)}</div>` : ''}<div class="ln"></div>
      <div class="msg">${esc(g.message || GIFT_MESSAGE)}</div><div class="sg">${esc(g.from ? 'مع تحيات' : '')}<b>${esc(g.from || inp.shop)}</b>${g.from ? esc(inp.shop) : ''}</div><div class="orn" style="margin-top:22px">✦ ✦ ✦</div></div></section>`);
  }
  if (F.toc) {
    add(() => {
      const rows = [
        ...secs.map(([n, l], i) => `<div class="row"><span>${nn(i + 1)}. ${esc(n)}<small class="sub">${nn(l.length)} منتج</small></span><i></i><span>${pn(start.get(n)!)}</span></div>`),
        ...arts.filter((a) => artStart.has(a.id)).map((a) => `<div class="row" style="font-size:16px"><span>📘 ${esc(a.title)}</span><i></i><span>${pn(artStart.get(a.id)!)}</span></div>`),
      ];
      return `<section class="pg toc"><h2>الفهرس</h2><div class="bar"></div>${rows.join('')}</section>`;
    });
  }
  if (F.story) {
    add(() => `<section class="pg sty"><div class="q">”</div><h2>${esc(cfg.story.title)}</h2><div class="bar"></div>${cfg.story.text
      .split('\n')
      .filter((x) => x.trim())
      .map((x) => `<p>${esc(x)}</p>`)
      .join('')}<div class="sg">— ${esc(inp.shop)}</div></section>`);
  }

  // صفحات المقالات: النص بيتقسم على صفحات بحسب الطول
  const artPages = (a: Article, si: number) => {
    const blocks = parseBody(a.body);
    const first = !!a.img;
    const chunks: Block[][] = [[]];
    let w = 0;
    const cap0 = first ? 1250 : 1900;
    let cap = cap0;
    const cw: number[] = [0];
    for (const b of blocks) {
      const bw = (b.t === 'p' ? b.x.length : b.x.length + 70) + 45;
      if (w + bw > cap && chunks[chunks.length - 1]!.length) {
        chunks.push([]);
        cw.push(0);
        w = 0;
        cap = 1900;
      }
      chunks[chunks.length - 1]!.push(b);
      w += bw;
      cw[cw.length - 1] = w;
    }
    chunks.forEach((ch, k) => {
      if (k === 0) artStart.set(a.id, entries.length);
      add((i) => {
        if (k === 0) {
          index.push({ n: a.title, c: a.kind || 'مقال', s: 'مقالات وإرشادات', p: i });
        }
        const body = ch
          .map((b) => {
            if (b.t === 'h') return `<h3>${esc(b.x)}</h3>`;
            if (b.t === 'n') return `<div class="stp"><i>${nn(b.n)}</i><span>${esc(b.x)}</span></div>`;
            if (b.t === 'b') return `<div class="bul">${esc(b.x)}</div>`;
            if (b.t === 'q') return `<div class="tipb"><b>💡 نصيحة</b>${esc(b.x)}</div>`;
            return `<p>${esc(b.x)}</p>`;
          })
          .join('');
        // الصفحة القصيرة: خط أكبر + شريط صور من المنتجات بدل الفراغ
        const ratio = (cw[k] ?? 0) / (k === 0 ? cap0 : 1900);
        const scale = ratio < 0.4 ? 1.32 : ratio < 0.62 ? 1.16 : 1;
        const fillImgs = ratio < 0.66 ? [0, 1, 2].map((n) => inp.products.length ? heroOf(inp.products[(i * 2 + n * 3 + 1) % inp.products.length]!) : '').filter(Boolean) : [];
        const fill = fillImgs.length ? `<div class="fill">${fillImgs.map((u) => `<img src="${esc(u)}" alt="">`).join('')}</div>` : '';
        return `<section class="pg art" style="--fs:${scale}">${tabs(si)}${k === 0 && a.img ? `<img class="aim" src="${esc(a.img)}" alt="">` : ''}
        <div class="ahd${k === 0 && a.img ? ' ov' : ''}"><small>${esc(a.kind || 'إرشادات')}${chunks.length > 1 ? ` · ${nn(k + 1)}/${nn(chunks.length)}` : ''}</small><h2>${esc(a.title)}</h2><div class="bar"></div></div>
        <div class="abd${k === 0 && a.img ? ' wi' : ''}">${body}${fill}</div>${foot(i)}</section>`;
      });
    });
  };
  arts.filter((a) => !a.sec).forEach((a) => artPages(a, -1));

  // صفحة «نصيحة» بدل الصفحة الفاضية لما نحتاج نظبّط الفتحة
  let tipN = 0;
  const tipPage = () => {
    const t = TIPS[tipN % TIPS.length]!;
    const img = inp.products.length ? heroOf(inp.products[(tipN * 3 + 1) % inp.products.length]!) : '';
    tipN++;
    add((i) => `<section class="pg tip">${img ? `<img class="bgi" src="${esc(img)}" alt="">` : ''}<div class="tq"><small>نصيحة من ${esc(inp.shop)}</small><h2>${esc(t)}</h2><div class="bar"></div></div>${foot(i)}</section>`);
  };

  secs.forEach(([name, list], si) => {
    if (entries.length % 2 === 0) tipPage();
    start.set(name, entries.length);
    const sImg = cfg.secImgs[name] || heroOf(list[0]!);
    add(() => `<section class="pg opn">${sImg ? `<img class="bgi" src="${esc(sImg)}" alt="">` : ''}<div class="no">${nn(si + 1)}</div>${tabs(si)}<div class="tt"><small>SECTION ${si + 1}</small><h2>${esc(name)}</h2><div class="bar"></div><p>${nn(list.length)} منتج في القسم ده</p></div></section>`);
    add(() => `<section class="pg lst">${tabs(si)}<h2>${esc(name)}</h2><div class="bar"></div><div class="rows">${list
      .map((p) => `<div class="it">${heroOf(p) ? `<img src="${esc(heroOf(p))}" alt="">` : ''}<div><b>${esc(p.name)}</b><small>كود ${esc(p.code)}</small></div><span class="n">${pn(prodPage.get(p.code)!)}</span></div>`)
      .join('')}</div></section>`);
    list.forEach((p) => {
      prodPage.set(p.code, entries.length);
      add((i) => {
        index.push({ n: p.name, c: p.code, s: name, p: i });
        const d = splitDesc(p.desc ?? '');
        const photos = p.imgs.filter((u) => u !== p.dimImg);
        const lay = cfg.layout === 'auto' ? ['c', 'a', 'b'][(i + si) % 3]! : (['a', 'b', 'c'][Number(cfg.layout) - 1] ?? 'c');
        const p1 = photos[0] ?? '';
        const p2 = photos[1] || p1;
        const p3 = photos[2] || photos[1] || p1;
        const stk = F.stock && p.inStock !== undefined ? `<span class="stk ${p.inStock ? 'ok' : 'no'}">${p.inStock ? '● متوفر' : '○ حسب الطلب'}</span>` : '';
        const code = `<span class="code">${esc(p.code)}</span>`;
        const specs: [string, string][] = [['الكود', p.code], ['القسم', cut(name, 22)], ...d.specs.slice(0, 2).map(([k, v]) => [cut(k, 14), cut(v, 20)] as [string, string])];
        const r2 = F.specs ? `<div class="r2">${specs.slice(0, lay === 'b' ? 3 : 4).map(([k, v]) => `<div class="chip k"><b>${esc(k)}</b><span>${esc(v)}</span></div>`).join('')}</div>` : '';
        const boxes: string[] = [];
        if (d.intro) boxes.push(`<div class="chip hl"><b>عن المنتج</b>${esc(cut(d.intro, 120))}</div>`);
        d.points.slice(0, 2).forEach((x, k) => boxes.push(`<div class="chip"><b>${k ? 'ميزة' : 'أهم ميزة'}</b>${esc(cut(x, 80))}</div>`));
        const r1 = boxes.length ? `<div class="r1 n${boxes.length}">${boxes.join('')}</div>` : '<div></div>';
        const bx = `<div class="bx">${r1}${r2}</div>`;
        const dim = p.dimImg ? `<div class="dim"><img src="${esc(p.dimImg)}" alt=""><small>📐 المقاسات</small></div>` : '';
        const hd = `<div class="hd"><span>${esc(inp.shop)}</span><b>${esc(name)}</b></div>`;
        const nm = `<div class="nm"><small>${esc(name)}</small>${esc(p.name)}</div>`;
        let inner = '';
        if (lay === 'a' || lay === 'b') {
          inner = `<img class="im i1" src="${esc(p1)}" alt=""><div class="sh"></div>${hd}${nm}${code}${stk}${dim}<img class="im i2 bd" src="${esc(p2)}" alt=""><img class="im i3 bd" src="${esc(p3)}" alt="">${bx}`;
        } else {
          inner = `<div class="bnd"></div>${hd}${nm}<img class="im i1 bd" src="${esc(p1)}" alt=""><img class="im i2 bd" src="${esc(p2)}" alt=""><img class="im i3 bd" src="${esc(p3)}" alt="">${code}${stk}${dim}${bx}`;
        }
        return `<section class="pg pp l${lay}">${tabs(si)}${inner}${foot(i)}</section>`;
      });
    });
    // مقالات القسم ده
    arts.filter((a) => a.sec === name).forEach((a) => artPages(a, si));
  });
  // مقالات «في آخر الكتالوج»
  arts.filter((a) => a.sec === '__end').forEach((a) => artPages(a, -1));
  add(() => `<section class="pg cover" style="display:flex;align-items:center;justify-content:center;text-align:center"><div class="mos" style="height:100%;opacity:.35">${covImgs.map((u) => `<div style="background-image:url('${esc(u)}')"></div>`).join('')}</div>${gearSvg()}<div style="position:relative"><h1 style="font-size:84px;margin:0;background:linear-gradient(180deg,#fff,var(--gl));-webkit-background-clip:text;background-clip:text;color:transparent">شكرًا لثقتكم</h1><div class="ln" style="justify-content:center"><i style="max-width:100px"></i></div><p style="font-size:22px;line-height:2;margin:0">${esc(inp.shop)}<br>نوصّل لحد عندك في كل المحافظات</p><div style="font-size:34px;font-weight:900;color:var(--gl);direction:ltr;margin-top:16px">${esc(phoneTxt)}</div></div></section>`);
  total = entries.length;
  // الأقسام بتبدأ على اليسار، فصفحة النهاية بتتحسب بعد ما اتعدّت كل الصفحات
  const pages = entries.map((b, i) => b(i));
  return { pages, css: CSS, index, vars };
}

const fontQ = (inp: CatInput) => {
  const f = mergeCfg(inp.cfg).style.font;
  return (FONTS.includes(f) ? f : 'Cairo').replace(/ /g, '+');
};

const HEAD = (inp: CatInput, b: Built, extra = '') =>
  `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(inp.shop)} — كتالوج</title><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><link rel="preconnect" href="https://fonts.googleapis.com"><link href="https://fonts.googleapis.com/css2?family=${fontQ(inp)}:wght@400;600;700;900&family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"><style>${b.css}${b.vars}${extra}</style></head>`;

/** للطباعة / PDF: صفحات A4 ورا بعض */
export function buildProCatalog(inp: CatInput, opts: { autoPrint?: boolean } = {}): string {
  const b = proPages(inp);
  const auto = opts.autoPrint ? '<script>addEventListener("load",function(){setTimeout(function(){print()},1800)})</script>' : '';
  return `${HEAD(inp, b)}<body>${b.pages.join('')}${auto}</body></html>`;
}

/** 📖 كتاب بيتقلّب بإيدك (St.PageFlip) مع خانة بحث: اكتب اسم منتج أو كود أو قسم وروح للصفحة. */
export function buildFlipbook(inp: CatInput, opts: { close?: boolean; pdfUrl?: string } = {}): string {
  const b = proPages(inp);
  const cfg = mergeCfg(inp.cfg);
  const flipCss = `
html,body{height:100%;margin:0;background:#1b2427;overflow:hidden;touch-action:manipulation}
body{background:radial-gradient(900px 600px at 50% 40%,#2a3a3e,#12191b)}
#bar{position:fixed;top:0;left:0;right:0;height:50px;display:flex;align-items:center;gap:8px;padding:0 10px 0 ${opts.close ? '58px' : '10px'};color:#fff;font:700 13px Cairo,sans-serif;z-index:30;background:#0b1417}
#bar a#b-pdf{flex:none;background:var(--g,#c9971f);color:#fff;border-radius:99px;padding:7px 12px;font:800 12.5px Cairo,sans-serif;text-decoration:none}#bar #b-x{background:#ffffff33;width:30px;height:30px;font-size:15px}@media (hover:none){#bar .nv{display:none}}#bar button{flex:none;background:#ffffff22;color:#fff;border:0;border-radius:99px;width:34px;height:34px;font:700 18px Cairo,sans-serif}
#q{flex:1;min-width:0;border:0;border-radius:99px;padding:8px 14px;font:600 14px Cairo,sans-serif;background:#ffffffe8;color:#14262b;outline:none}
#res{position:fixed;top:54px;right:10px;left:10px;max-width:460px;margin:0 auto;max-height:55vh;overflow:auto;background:#fff;border-radius:14px;box-shadow:0 14px 40px #000a;z-index:40;display:none}
#res div{padding:10px 14px;border-bottom:1px solid #e6eef0;font:600 14px Cairo,sans-serif;color:#14262b;display:flex;justify-content:space-between;gap:10px}
#res div small{color:#62767c;font-weight:500}#res div b{color:var(--t);flex:none}
#stage{position:fixed;inset:50px 0 0 0;display:flex;align-items:center;justify-content:center}
.fp{box-shadow:0 20px 60px #000a}
.fp .page{background:#fff;overflow:hidden}
.fp .pg{transform-origin:0 0;position:absolute;top:0;left:0}
`;
  const data = JSON.stringify(b.index).replace(/</g, '\\u003c');
  const script = `
(function(){
  var W=794,H=1123, IDX=${data};
  var vw=innerWidth,vh=innerHeight-50,portrait=vw<vh*1.1;
  var colW=portrait?vw:vw/2;
  H=Math.max(1000,Math.min(1700,Math.round(W*vh/colW)));
  document.documentElement.style.setProperty('--H',H+'px');
  var pageW=colW, pageH=pageW*H/W, k=pageW/W;
  document.querySelectorAll('.page .pg').forEach(function(el){el.style.transform='scale('+k+')';});
  var pf=new St.PageFlip(document.getElementById('book'),{width:Math.round(pageW),height:Math.round(pageH),size:'fixed',showCover:true,drawShadow:true,maxShadowOpacity:.5,flippingTime:700,usePortrait:true,mobileScrollSupport:false,swipeDistance:20,clickEventForward:false,startPage:0});
  pf.loadFromHTML(document.querySelectorAll('.page'));
  var bx=document.getElementById('b-x');if(bx){var done=false;var closeIt=function(e){if(e)e.preventDefault();if(done)return;done=true;parent.postMessage('catalog-close','*');};bx.addEventListener('click',closeIt);bx.addEventListener('pointerup',closeIt);bx.addEventListener('touchend',closeIt);}
  document.getElementById('b-prev').onclick=function(){pf.flipPrev();};
  document.getElementById('b-next').onclick=function(){pf.flipNext();};
  var q=document.getElementById('q'),res=document.getElementById('res');
  function norm(s){return String(s).toLowerCase().replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه').replace(/[\\u064B-\\u0652]/g,'');}
  function show(){var t=norm(q.value.trim());if(!t){res.style.display='none';return;}
    var out=IDX.filter(function(x){return norm(x.n+' '+x.c+' '+x.s).indexOf(t)>-1;}).slice(0,20);
    res.innerHTML=out.length?out.map(function(x,i){return '<div data-p="'+x.p+'"><span>'+x.n+'<br><small>'+x.s+' · كود '+x.c+'</small></span><b>ص '+(x.p+1)+'</b></div>';}).join(''):'<div>مفيش نتيجة</div>';
    res.style.display='block';}
  q.addEventListener('input',show);
  res.addEventListener('click',function(e){var d=e.target.closest('[data-p]');if(!d)return;pf.turnToPage(+d.getAttribute('data-p'));res.style.display='none';q.blur();});
  document.addEventListener('click',function(e){if(!e.target.closest('#res')&&e.target!==q)res.style.display='none';});
})();`;
  const body = `<body><div id="bar"><input id="q" type="search" placeholder="🔍 ابحث في الكتالوج: اسم منتج، كود، قسم…" autocomplete="off">${opts.pdfUrl ? `<a id="b-pdf" href="${esc(opts.pdfUrl)}" target="_blank" rel="noopener">⬇️ PDF</a>` : ''}<button id="b-prev" class="nv" title="السابق">‹</button><button id="b-next" class="nv" title="التالي">›</button></div><div id="res"></div><div id="stage"><div id="book" class="fp">${b.pages.map((p) => `<div class="page">${p}</div>`).join('')}</div></div>
<script src="https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.js"></script>
<script>${script}</script></body></html>`;
  void cfg;
  return `${HEAD(inp, b, flipCss)}${body}`;
}
