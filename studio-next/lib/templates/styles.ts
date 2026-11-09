// مكتبة القوالب: كل قالب = حركة + إطار + انتقالات + شكل كلام + بداية ونهاية + موسيقى، وكل قالب بيشتغل مع ١٢ لون.
// قوالب فيديو + قوالب صور (بوستر/كاروسيل). أرقام نقية من غير DOM عشان تتختبر في Node.

export type Trans = 'fade' | 'push' | 'up' | 'zoom' | 'wipe' | 'circle' | 'blinds' | 'flash' | 'cube' | 'glitch' | 'diag' | 'doors' | 'cut' | 'whip' | 'slice' | 'spin' | 'pixel' | 'leak' | 'swipe' | 'rgb' | 'shutter';
export type Motion = 'kb' | 'kbOut' | 'punch' | 'drift' | 'static' | 'tilt' | 'float' | 'handheld' | 'dolly' | 'pan';
export type Frame = 'full' | 'card' | 'polaroid' | 'gold' | 'film' | 'magazine' | 'neon' | 'minimal' | 'split' | 'circle' | 'arch';
export type TextPos = 'lower' | 'center' | 'top' | 'below' | 'panel' | 'none';
export type Intro = 'title' | 'logo' | 'split' | 'mag' | 'words' | 'curtain' | 'none';
export type Outro = 'card' | 'grid' | 'cta' | 'none';
export type Mood = 'calm' | 'upbeat' | 'luxury' | 'epic' | 'none';
export type Special = 'ba-wipe' | 'ba-split' | 'journey' | 'timelapse' | 'count' | 'polaroid' | 'grid' | 'carousel' | 'price' | 'kinetic' | 'glass' | 'story' | 'stack' | 'bento' | 'editorial' | 'callout' | 'vhs' | 'duo' | 'tri' | 'sheet' | 'duotone' | '';
export type Poster = 'collage' | 'ba' | 'journey' | 'catalog' | 'price';
export type Cat = 'product' | 'ba' | 'journey' | 'offer' | 'catalog' | 'luxury' | 'story' | 'kitchen' | 'image' | 'trend';

export interface Pal { id: string; n: string; bg: string; fg: string; ac: string; ac2: string; light?: boolean }
export interface Style {
  id: string; n: string; d: string; cat: Cat[]; kind: 'video' | 'image'; e: string;
  group: 1 | 2 | 3 | 4; dur: number; td: number; trans: Trans[]; motion: Motion; frame: Frame; text: TextPos; anim: 'pop' | 'slide' | 'type' | 'fade';
  font: string; pal: string; intro: Intro; outro: Outro; music: Mood; special: Special; poster?: Poster; min?: number; fx?: string[];
}

export const PALS: Pal[] = [
  { id: 'gold', n: 'ذهبي ميكانيزم', bg: '#0B0B0C', fg: '#FFFFFF', ac: '#D4A537', ac2: '#F6DC8A' },
  { id: 'teal', n: 'تركواز', bg: '#05201F', fg: '#FFFFFF', ac: '#2EC4B6', ac2: '#9FF3EA' },
  { id: 'white', n: 'أبيض نضيف', bg: '#F7F5F0', fg: '#161616', ac: '#B8862A', ac2: '#2A2A2A', light: true },
  { id: 'red', n: 'أحمر عروض', bg: '#170606', fg: '#FFFFFF', ac: '#FF3B30', ac2: '#FFD60A' },
  { id: 'blue', n: 'أزرق ملكي', bg: '#07122B', fg: '#FFFFFF', ac: '#3D8BFF', ac2: '#A9CBFF' },
  { id: 'wood', n: 'خشبي دافي', bg: '#2A1B12', fg: '#FFF6EA', ac: '#E0A96D', ac2: '#F3D2A2' },
  { id: 'olive', n: 'زيتي', bg: '#111A11', fg: '#F2F5EC', ac: '#9BC53D', ac2: '#DDEFB0' },
  { id: 'rose', n: 'وردي', bg: '#2B0E1C', fg: '#FFFFFF', ac: '#FF5C93', ac2: '#FFC2D6' },
  { id: 'marble', n: 'رخامي فاتح', bg: '#ECEAE6', fg: '#1C1C1C', ac: '#8A6F4D', ac2: '#3A3A3A', light: true },
  { id: 'neon', n: 'نيون', bg: '#05010F', fg: '#FFFFFF', ac: '#00F0FF', ac2: '#FF2BD6' },
  { id: 'silver', n: 'فضي', bg: '#111315', fg: '#FFFFFF', ac: '#C9CED6', ac2: '#8E96A3' },
  { id: 'orange', n: 'برتقالي', bg: '#1A0D02', fg: '#FFFFFF', ac: '#FF8A1F', ac2: '#FFC27A' },
  { id: 'sunset', n: 'غروب', bg: '#1B0B1E', fg: '#FFFFFF', ac: '#FF6B35', ac2: '#FFD166' },
  { id: 'mint', n: 'نعناع عصري', bg: '#04130E', fg: '#F0FFF8', ac: '#00E5A0', ac2: '#9BFFD9' },
  { id: 'lavender', n: 'لافندر', bg: '#14102A', fg: '#FFFFFF', ac: '#B388FF', ac2: '#E0CFFF' },
  { id: 'cream', n: 'كريمي دافي', bg: '#FAF3E6', fg: '#1E1A16', ac: '#C2410C', ac2: '#7A3B12', light: true },
  { id: 'midnight', n: 'منتصف الليل', bg: '#020617', fg: '#FFFFFF', ac: '#38BDF8', ac2: '#BAE6FD' },
  { id: 'emerald', n: 'زمردي ملكي', bg: '#06201A', fg: '#FFFFFF', ac: '#D4AF37', ac2: '#34D399' },
  { id: 'coral', n: 'مرجاني', bg: '#1F0A0A', fg: '#FFFFFF', ac: '#FF7A6B', ac2: '#FFC9C2' },
  { id: 'mono', n: 'أبيض وأسود', bg: '#0A0A0A', fg: '#FFFFFF', ac: '#FFFFFF', ac2: '#9CA3AF' },
];

export const CATS: [Cat | 'all', string][] = [
  ['all', 'الكل'], ['trend', '🔥 ترند حديث'], ['product', '📦 منتج'], ['ba', '↔️ قبل وبعد'], ['journey', '🧭 رحلة ومراحل'], ['kitchen', '🍳 مطابخ وديكور'],
  ['offer', '🏷️ عروض وأسعار'], ['catalog', '🗂️ كتالوج'], ['luxury', '💎 فخم'], ['story', '⚡ ستوري سريع'], ['image', '🖼️ صور وبوسترات'],
];

const S = (id: string, e: string, n: string, d: string, cat: Cat[], o: Partial<Style>): Style => Object.assign({
  id, e, n, d, cat, kind: 'video', group: 1, dur: 2.6, td: .6, trans: ['fade'], motion: 'kb', frame: 'full', text: 'lower', anim: 'slide',
  font: 'Cairo', pal: 'gold', intro: 'title', outro: 'card', music: 'calm', special: '',
} as Style, o);

const TR: Cat[] = ['trend'];
const MODERN: Style[] = [
  S('kinetic', '⚡', 'كلمات متحركة', 'كلمات ضخمة بتنزل على الصورة بحركة صدمة — شكل تيك توك ترند', [...TR, 'story', 'product'], { special: 'kinetic', dur: 2.1, td: .3, trans: ['slice', 'whip'], motion: 'handheld', pal: 'sunset', font: 'Lalezar', fx: ['grain', 'vig'], music: 'upbeat', intro: 'words', outro: 'cta' }),
  S('glass', '🫧', 'زجاجي حديث', 'كارت صورة طايف على خلفية ضبابية وبانل زجاجي للكلام', [...TR, 'product', 'luxury'], { special: 'glass', dur: 2.8, trans: ['leak', 'fade'], motion: 'float', pal: 'midnight', fx: ['vig'], intro: 'curtain', outro: 'cta' }),
  S('story', '📲', 'ستوري إنستجرام', 'شريط تقدم + اسمك + ستيكر كلام وخانة رد — شكل ستوري حقيقي', [...TR, 'story', 'product'], { special: 'story', dur: 2.5, trans: ['swipe'], motion: 'kb', pal: 'gold', intro: 'none', outro: 'cta', music: 'upbeat' }),
  S('stack', '🃏', 'كروت بتتسحب', 'كروت فوق بعض والكارت بيتسحب بعيد ويظهر اللي بعده', [...TR, 'catalog', 'product'], { special: 'stack', dur: 2.3, td: .3, trans: ['fade'], motion: 'static', pal: 'lavender', fx: ['vig'], intro: 'logo', outro: 'cta' }),
  S('bento', '🍱', 'بينتو', 'مربعات بأحجام مختلفة بتتبني واحدة واحدة — ستايل آبل', [...TR, 'catalog', 'product', 'kitchen'], { special: 'bento', group: 4, dur: 3.6, trans: ['zoom'], motion: 'static', text: 'none', pal: 'mint', music: 'calm', outro: 'cta' }),
  S('editorial', '📖', 'مجلة محررين', 'صورة بإطار مزاح + رقم ضخم مفرّغ + كلام أنيق', [...TR, 'luxury', 'kitchen', 'product'], { special: 'editorial', dur: 3, trans: ['shutter'], motion: 'kb', pal: 'cream', font: 'El Messiri', music: 'luxury', outro: 'cta' }),
  S('callout', '🎯', 'نقطة المميزات', 'دايرة بتنبض على التفصيلة وخط ينده على اسمها', [...TR, 'product', 'kitchen'], { special: 'callout', dur: 2.9, trans: ['zoom', 'fade'], motion: 'kb', pal: 'teal', outro: 'cta' }),
  S('vhs', '📼', 'فيديو ريترو', 'REC وتاريخ وخطوط كاميرا قديمة — حنين وستايل', [...TR, 'story'], { special: 'vhs', dur: 2.2, trans: ['rgb', 'glitch'], motion: 'handheld', pal: 'mono', fx: ['grain'], music: 'upbeat', intro: 'none', outro: 'cta' }),
  S('duo', '🔀', 'قطر مزدوج', 'صورتين بينقسموا بقطر مضيء — قبل/بعد أو مقارنة', [...TR, 'ba', 'product'], { special: 'duo', group: 2, dur: 3.2, trans: ['diag', 'slice'], motion: 'kb', pal: 'coral', min: 2, outro: 'cta' }),
  S('tri', '▥', 'ثلاث شرائح', 'تلات صور شرايط طولية بتدخل من فوق وتحت', [...TR, 'catalog', 'product', 'kitchen'], { special: 'tri', group: 3, dur: 3, trans: ['slice'], motion: 'kb', pal: 'silver', text: 'none', min: 3, outro: 'cta' }),
  S('sheet', '💳', 'كارت سعر حديث', 'بانل بيطلع من تحت بالاسم والتقييم والسعر وزرار الطلب', [...TR, 'offer', 'product'], { special: 'sheet', dur: 2.7, trans: ['swipe', 'up'], motion: 'kb', pal: 'white', music: 'upbeat', outro: 'cta' }),
  S('duotone', '🎨', 'ثنائي اللون', 'الصورة بلون البراند وكلمة ضخمة مفرّغة — بوستر عصري', [...TR, 'story', 'product'], { special: 'duotone', dur: 2.2, trans: ['rgb', 'pixel'], motion: 'punch', pal: 'sunset', fx: ['grain'], music: 'upbeat', outro: 'cta' }),
  S('vlog', '🤳', 'فلوج حيّ', 'كاميرا محمولة بترتعش خفيف وانتقالات سحب وتسريب ضوء', [...TR, 'story', 'journey'], { trans: ['swipe', 'whip'], motion: 'handheld', dur: 1.9, td: .4, text: 'lower', anim: 'slide', pal: 'orange', fx: ['grain', 'leak'], music: 'upbeat', outro: 'cta' }),
  S('dream', '☁️', 'حالم', 'حركة بطيئة جوه الصورة وتسريب ضوء ناعم — إحساس سينمائي', [...TR, 'luxury', 'journey'], { trans: ['leak'], motion: 'dolly', dur: 3, td: .8, text: 'center', anim: 'fade', pal: 'lavender', fx: ['leak', 'vig'], music: 'calm', outro: 'cta' }),
  S('pixelpop', '👾', 'بيكسل بوب', 'الصور بتتحول لمربعات وبترجع — شبابي ومختلف', [...TR, 'story'], { trans: ['pixel', 'glitch'], motion: 'punch', dur: 1.5, td: .5, text: 'top', anim: 'pop', pal: 'neon', fx: ['grain'], music: 'upbeat', outro: 'cta' }),
  S('slicex', '🎬', 'شرائح سينمائية', 'شرائح بتتبادل بسرعة مع شرايط سينما وفينييت', [...TR, 'luxury', 'product'], { trans: ['slice'], motion: 'pan', dur: 2.3, td: .7, text: 'lower', anim: 'fade', pal: 'midnight', fx: ['bars', 'vig'], music: 'epic', outro: 'cta' }),
  S('spin', '🌪️', 'دوامة', 'الصورة بتلف وتكبر للي بعدها — حماس وحركة', [...TR, 'story', 'offer'], { trans: ['spin', 'zoom'], motion: 'punch', dur: 1.6, td: .5, text: 'top', anim: 'pop', pal: 'coral', music: 'upbeat', outro: 'cta' }),
  S('luxe2', '🟢', 'ذهب زمردي', 'إطار ذهبي على زمردي غامق وحركة داخلية بطيئة', [...TR, 'luxury', 'kitchen'], { frame: 'gold', trans: ['leak', 'fade'], motion: 'dolly', dur: 3.4, td: 1, text: 'lower', anim: 'fade', pal: 'emerald', font: 'El Messiri', fx: ['vig', 'grain'], music: 'luxury', outro: 'cta' }),
  S('cleanx', '🤍', 'نظيف عصري', 'إطار أبيض ناعم بدون زحمة وسحب أنيق', [...TR, 'product', 'kitchen', 'catalog'], { frame: 'minimal', text: 'below', trans: ['swipe'], motion: 'kb', pal: 'cream', font: 'Tajawal', outro: 'cta' }),
  S('cinema', '🎥', 'سينمائي واسع', 'شرايط سينما + حبوب فيلم + تسريب ضوء + حركة داخلية', [...TR, 'luxury', 'story', 'journey'], { trans: ['shutter', 'fade'], motion: 'dolly', dur: 3, td: .8, text: 'lower', anim: 'fade', pal: 'silver', fx: ['bars', 'vig', 'grain', 'leak'], music: 'epic', outro: 'cta' }),
];

export const STYLES: Style[] = [
  ...MODERN,
  // ── منتج ──
  S('showcase', '✨', 'عرض المنتج', 'زووم ناعم على تفاصيل المنتج + عنوان أنيق + نهاية بالتليفون', ['product', 'kitchen'], { trans: ['fade', 'zoom'], motion: 'kb' }),
  S('slide', '➡️', 'انزلاق احترافي', 'كل صورة بتزق اللي قبلها — إيقاع ثابت ونضيف', ['product', 'catalog'], { trans: ['push'], motion: 'drift', dur: 2.2, music: 'upbeat' }),
  S('cube', '🧊', 'مكعب ثلاثي الأبعاد', 'الصور بتلف كأنها وشوش مكعب', ['product', 'story'], { trans: ['cube'], motion: 'static', dur: 2.2, music: 'upbeat', intro: 'logo' }),
  S('spot', '🔦', 'سبوت لايت', 'المنتج في دايرة نور على خلفية بلون البراند', ['product', 'luxury'], { frame: 'circle', text: 'below', trans: ['circle'], motion: 'float', anim: 'pop' }),
  S('arch', '🏛️', 'قوس عصري', 'الصورة في قوس بستايل إنستجرام الحديث', ['product', 'kitchen'], { frame: 'arch', text: 'below', trans: ['up'], motion: 'kb', pal: 'marble', font: 'El Messiri' }),
  S('mag', '📰', 'غلاف مجلة', 'كل صورة غلاف مجلة بعنوان ضخم', ['product', 'luxury'], { frame: 'magazine', text: 'lower', trans: ['flash', 'push'], motion: 'kbOut', intro: 'mag', font: 'Reem Kufi', pal: 'white' }),
  S('splitp', '🪟', 'نص وصورة', 'الصورة في نص والكلام في نص — شكل كتالوج حديث', ['product', 'catalog'], { frame: 'split', text: 'panel', trans: ['wipe'], motion: 'kb', anim: 'type', pal: 'white' }),
  S('minimal', '◻️', 'بسيط أبيض', 'إطار أبيض وخط رفيع — هادي وراقي', ['product', 'kitchen'], { frame: 'minimal', text: 'below', trans: ['fade'], motion: 'kb', pal: 'white', font: 'Tajawal' }),
  // ── قبل وبعد ──
  S('bawipe', '↔️', 'قبل وبعد بالمسح', 'خط بيتحرك يكشف «بعد» فوق «قبل» — ارفع الصور أزواج: قبل ثم بعد', ['ba', 'kitchen'], { group: 2, special: 'ba-wipe', dur: 4.2, trans: ['fade'], motion: 'static', text: 'none', music: 'epic', min: 2 }),
  S('basplit', '🪞', 'قبل وبعد جنب بعض', 'الشاشة نصين: قبل ثم بعد بيدخل — أزواج', ['ba', 'kitchen'], { group: 2, special: 'ba-split', dur: 3.6, trans: ['push'], motion: 'kb', text: 'none', music: 'epic', min: 2 }),
  S('reveal', '🎭', 'التحوّل الكبير', 'كل الصور بسرعة وفي الآخر النتيجة النهائية بفلاش', ['ba', 'journey', 'kitchen'], { trans: ['flash', 'cut'], dur: 1.1, td: .2, motion: 'punch', music: 'epic', text: 'center', anim: 'pop', pal: 'red' }),
  // ── رحلة ومراحل ──
  S('journey', '🧭', 'رحلة المراحل', '«المرحلة ٣ من ٧» + اسم المرحلة + تاريخها + خط تقدم — مطبخ من الصفر للتسليم', ['journey', 'kitchen'], { special: 'journey', dur: 2.8, trans: ['push'], motion: 'kb', text: 'none', music: 'epic' }),
  S('timelapse', '⏩', 'تايم لابس', 'الصور ورا بعض بسرعة + عداد ٪ — شكل الشغل وهو بيتبني', ['journey', 'kitchen', 'story'], { special: 'timelapse', dur: .55, td: 0, trans: ['cut'], motion: 'static', text: 'none', music: 'upbeat', intro: 'title' }),
  S('diary', '📔', 'يوميات الشغل', 'بولارويد بيتحط فوق بعض بتاريخ كل يوم — شكل حكاية', ['journey', 'story'], { special: 'polaroid', frame: 'polaroid', text: 'below', trans: ['up'], motion: 'static', dur: 2.4, pal: 'wood', font: 'Marhey' }),
  S('trip', '✈️', 'رحلة وذكريات', 'حركة سينمائية وانتقالات ناعمة — لرحلة أو مناسبة', ['journey', 'story'], { trans: ['whip', 'zoom', 'fade'], motion: 'drift', dur: 2.4, text: 'center', anim: 'fade', music: 'calm', pal: 'blue' }),
  // ── مطابخ وديكور ──
  S('kitchen', '🍳', 'مطبخ فخم', 'زووم بطيء + إطار ذهبي + أسماء الأماكن (جزيرة، أدراج…)', ['kitchen', 'luxury'], { frame: 'gold', trans: ['fade', 'diag'], motion: 'kbOut', dur: 3, music: 'luxury', font: 'El Messiri' }),
  S('dressing', '👔', 'دريسنج روم', 'طولي أنيق بحركة لفوق — مناسب للدواليب والدريسنج', ['kitchen', 'product'], { trans: ['up'], motion: 'drift', frame: 'card', text: 'below', pal: 'wood', font: 'Tajawal' }),
  S('blinds', '🪟', 'شرائح ستارة', 'الصور بتدخل كأنها ستارة بتتفتح', ['kitchen', 'product'], { trans: ['blinds'], motion: 'kb', dur: 2.6, pal: 'silver' }),
  S('doors', '🚪', 'أبواب بتتفتح', 'الصورة بتتفتح زي ضلفتين — مناسب للدواليب', ['kitchen', 'product'], { trans: ['doors'], motion: 'kb', dur: 2.6, pal: 'wood', music: 'luxury' }),
  // ── عروض وأسعار ──
  S('price', '🏷️', 'عرض بالسعر', 'شارة سعر بتنط + السعر القديم مشطوب + اطلب دلوقتي', ['offer', 'product'], { special: 'price', trans: ['zoom', 'push'], motion: 'punch', dur: 2.6, music: 'upbeat', pal: 'red', anim: 'pop' }),
  S('flash', '⚡', 'عرض لفترة محدودة', 'شرايط حمرا + «العرض ينتهي قريب» + سعر — يشد العين', ['offer', 'story'], { special: 'price', trans: ['flash', 'glitch'], motion: 'punch', dur: 1.8, td: .35, music: 'upbeat', pal: 'red', frame: 'neon', anim: 'pop', font: 'Lalezar' }),
  S('count', '🔢', 'توب ٥', 'ترقيم تنازلي كبير «رقم ٥… رقم ١» — أحسن منتجات', ['offer', 'catalog', 'story'], { special: 'count', trans: ['glitch', 'push'], motion: 'punch', dur: 2.6, music: 'upbeat', text: 'lower', anim: 'pop', font: 'Lalezar' }),
  // ── كتالوج ──
  S('grid', '🔲', 'شبكة ٤ صور', 'كل شريحة ٤ صور بتظهر واحدة واحدة — كتالوج سريع', ['catalog', 'product'], { group: 4, special: 'grid', dur: 3.2, trans: ['wipe'], motion: 'static', text: 'none', music: 'upbeat' }),
  S('carousel', '🎠', 'كاروسيل', 'الصور بتلف زي كاروسيل والصورة اللي في النص كبيرة', ['catalog', 'product'], { special: 'carousel', dur: 2, trans: ['cut'], td: 0, motion: 'static', text: 'below', music: 'calm' }),
  S('cards', '🃏', 'كروت ناعمة', 'كل صورة كارت بحواف مدورة على خلفية لون البراند', ['catalog', 'product', 'kitchen'], { frame: 'card', text: 'below', trans: ['up', 'zoom'], motion: 'kb', anim: 'slide' }),
  // ── فخم ──
  S('lux', '💎', 'فخامة ذهبية', 'خلفية سودا وإطار ذهبي رفيع وحركة بطيئة جدًا', ['luxury', 'kitchen'], { frame: 'gold', trans: ['fade'], motion: 'kbOut', dur: 3.4, td: 1, music: 'luxury', font: 'El Messiri', anim: 'fade' }),
  S('film', '🎞️', 'سينما', 'شرايط فيلم وألوان سينمائية وانتقالات ناعمة', ['luxury', 'story'], { frame: 'film', trans: ['fade', 'whip'], motion: 'drift', dur: 2.8, music: 'luxury', anim: 'fade' }),
  S('neon', '🌃', 'نيون الليل', 'إطار مضيء بيلمع — شبابي وعصري', ['story', 'product'], { frame: 'neon', trans: ['glitch', 'zoom'], motion: 'punch', dur: 2, music: 'upbeat', pal: 'neon', anim: 'pop', font: 'Changa' }),
  // ── ستوري سريع ──
  S('beat', '🥁', 'على الإيقاع', 'قطع على كل ضربة + زووم — ريلز سريع', ['story', 'product'], { trans: ['cut', 'flash'], td: .15, motion: 'punch', dur: 1, music: 'upbeat', text: 'center', anim: 'pop', intro: 'logo' }),
  S('whip', '🌀', 'لفة سريعة', 'انتقالات «ويب» بسرعة زي الريلز العالمية', ['story', 'journey'], { trans: ['whip'], td: .4, motion: 'punch', dur: 1.6, music: 'upbeat', text: 'top', anim: 'pop' }),
  S('zoomx', '🔍', 'زووم جوه الصورة', 'كل صورة بتدخل جوه اللي بعدها', ['story', 'product'], { trans: ['zoom'], td: .45, motion: 'kb', dur: 1.8, music: 'upbeat', text: 'top', anim: 'pop', pal: 'orange' }),
  S('tilt', '📐', 'ميلان ديناميك', 'الصور مايلة شوية وبتتحرك — حيوي ومختلف', ['story', 'product'], { trans: ['diag', 'push'], motion: 'tilt', dur: 2, music: 'upbeat', frame: 'card', text: 'below', pal: 'teal' }),
  // ── صور وبوسترات (ملف صورة مش فيديو) ──
  S('p_collage', '🧩', 'كولاج صور', 'كل الصور في بوستر واحد مترتب لوحده + العنوان واللوجو', ['image', 'catalog', 'journey'], { kind: 'image', poster: 'collage' }),
  S('p_ba', '↔️', 'بوستر قبل وبعد', 'صورتين جنب بعض «قبل / بعد» + العنوان', ['image', 'ba', 'kitchen'], { kind: 'image', poster: 'ba', min: 2 }),
  S('p_journey', '🧭', 'بوستر المراحل', 'كل المراحل مترقمة في صورة واحدة', ['image', 'journey', 'kitchen'], { kind: 'image', poster: 'journey' }),
  S('p_catalog', '🗂️', 'صفحة كتالوج', 'شبكة منتجات بأسمائها (الكلمة اللي على كل صورة)', ['image', 'catalog'], { kind: 'image', poster: 'catalog', pal: 'white' }),
  S('p_price', '🏷️', 'بوست سعر', 'بوست لكل صورة: المنتج + السعر + اطلب دلوقتي', ['image', 'offer', 'product'], { kind: 'image', poster: 'price', pal: 'red' }),
];

export const ASPECTS: [string, string, number, number][] = [['916', 'ريلز ٩:١٦', 1080, 1920], ['45', 'إنستجرام ٤:٥', 1080, 1350], ['11', 'مربع ١:١', 1080, 1080], ['169', 'يوتيوب ١٦:٩', 1920, 1080]];
export const MOODS: [Mood, string, number][] = [['upbeat', '🥁 حماسي', 118], ['calm', '🌿 هادي', 84], ['luxury', '💎 فخم', 72], ['epic', '🎬 ملحمي', 96], ['none', '🔇 من غير', 0]];

export const styleById = (id: string) => STYLES.find(s => s.id === id) || STYLES[0];
export const palById = (id: string) => PALS.find(p => p.id === id) || PALS[0];
export const TOTAL_TEMPLATES = STYLES.length * PALS.length;

/* ───── الجدول الزمني ───── */
export interface Seg { k: 'intro' | 'slide' | 'outro'; i: number; n: number; items: number[]; s: number; e: number }
export interface TLOpts { count: number; speed: number; bpm: number; intro: boolean; outro: boolean }
/** بيقسّم الصور على شرائح (فردي/أزواج/٤) ويحسب المواعيد. لو فيه موسيقى، الطول بيتظبط على الضربات عشان القطع يبقى على الإيقاع. */
export function timeline(st: Style, o: TLOpts): { segs: Seg[]; dur: number } {
  const beat = o.bpm ? 60 / o.bpm : 0, snap = (x: number, min: number) => { const v = Math.max(min, x); return beat ? Math.max(beat, Math.round(v / beat) * beat) : v; };
  const sp = Math.max(.5, Math.min(2, o.speed || 1)), segs: Seg[] = [], groups: number[][] = [];
  if (st.special === 'carousel') groups.push(Array.from({ length: o.count }, (_, i) => i));
  else for (let i = 0; i < o.count; i += st.group) groups.push(Array.from({ length: Math.min(st.group, o.count - i) }, (_, k) => i + k));
  const td = st.td, slideD = st.special === 'carousel' ? snap(st.dur / sp, .8) * Math.max(1, o.count) : snap(st.dur / sp, st.special === 'timelapse' ? .25 : .9);
  let t = 0; const push = (k: Seg['k'], items: number[], d: number, i: number, n: number) => { const s = segs.length ? Math.max(0, t - td) : 0; segs.push({ k, i, n, items, s, e: s + d }); t = s + d; };
  if (o.intro && st.intro !== 'none') push('intro', [0], snap(2.4 / Math.sqrt(sp), 1.6), 0, 1);
  groups.forEach((g, i) => push('slide', g, slideD + (segs.length ? td : 0), i, groups.length));
  if (o.outro && st.outro !== 'none') push('outro', [], snap(3 / Math.sqrt(sp), 2), 0, 1);
  return { segs, dur: t };
}

/** أرقام عربي (٠١٢…) */
export const arN = (s: string | number) => String(s).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[+d]);
const MON = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
export const arDate = (ms: number) => { const d = new Date(ms); return arN(d.getDate()) + ' ' + MON[d.getMonth()]; };
