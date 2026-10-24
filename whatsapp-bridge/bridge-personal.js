// جسر الأرقام الشخصية (رقم 1 / رقم 2) — بيسمع بس، مابيبعتش أي رسالة من رقمك. v3 2026-10-18
// التشغيل: node bridge-personal.js p1   (أو p2) — أول مرة بيطلع QR تمسحه من موبايلك.
// الخصوصية: نص رسايل الأهل والأصحاب مابيتحفظش في أي مكان، والأرقام المتسجّلة عندك بتتجاهل
// إلا لو الرقم ده عميل/مورد متسجّل في السيستم أو في «الأرقام المسموحة».
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const { execFile } = require('child_process');

const LINE = (process.argv[2] || 'p1').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'p1';
const LINK = process.argv.includes('--link');
const NUM = LINE.replace(/\D/g, '') || '1';
const DATA_ROOT = 'C:\\mkwa-personal';   // بره فولدر الجسر عشان إعادة تشغيل جسر المحل ماتقفلهوش
const SRC = fs.readFileSync(__dirname + '\\bridge.js', 'utf8');           // نفس عنوان ومفتاح السيستم اللي في الجسر الأساسي
const SB_URL = (SRC.match(/SB_URL\s*=\s*'([^']+)'/) || [])[1];
const SB_KEY = (SRC.match(/SB_KEY\s*=\s*'([^']+)'/) || [])[1];
const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const SECRET = JSON.parse(fs.readFileSync(__dirname + '\\config.json', 'utf8')).secret;
const QUEUE = __dirname + '\\queue-' + LINE + '.jsonl';
const QR = __dirname + '\\qr-' + LINE + '.png';
const waFilter = require('./wa-filter');

const log = (...a) => {
  const line = `[${new Date().toLocaleString('en-GB')}] [رقم ${NUM}] ${a.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(__dirname + '\\bridge-' + LINE + '.log', line + '\n'); } catch (e) {}
};
if (!SB_URL || !SB_KEY) { log('✘ مش لاقي بيانات السيستم في bridge.js'); process.exit(1); }

process.on('uncaughtException', (e) => { log('✘ خطأ غير متوقع (uncaught):', e && e.stack || e); process.exit(1); });
process.on('unhandledRejection', (e) => { log('✘ خطأ غير متوقع (rejection):', e && e.stack || e); process.exit(1); });

// كروم بيسيب ملف قفل (Singleton*) جوه بروفايل الجلسة لو اتقفل بالقوة؛ لو فضل موجود واتساب هيرفض يفتح من غير أي رسالة واضحة
function clearStaleLock() {
  for (const f of ['SingletonLock', 'SingletonCookie', 'SingletonSocket']) {
    try { fs.rmSync(DATA_ROOT + '\\session-' + LINE + '\\' + f, { force: true }); } catch (e) {}
  }
}
clearStaleLock();

async function rpc(fn, body) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null;
}
waFilter.init({ rpc, secret: SECRET, log, private: true, ignoreSaved: true, queue: QUEUE });

const client = new Client({
  authStrategy: new LocalAuth({ clientId: LINE, dataPath: DATA_ROOT }),
  authTimeoutMs: 120000,   // مهلة تحميل واتساب ويب
  puppeteer: { executablePath: CHROME, headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] },
});

let shown = false;
client.on('qr', async (qr) => {
  if (!LINK) { log('الرقم ده لسه مش مربوط — شغّل link-' + LINE + '.bat'); process.exit(3); }
  try { require('qrcode-terminal').generate(qr, { small: true }); } catch (e) {}
  await require('qrcode').toFile(QR, qr, { width: 460, margin: 2 });
  console.log('\n📱 امسح الكود ده من واتساب رقمك ' + NUM + ': الإعدادات ← الأجهزة المرتبطة ← ربط جهاز\n');
  if (!shown) { shown = true; execFile('cmd', ['/c', 'start', '', QR]); }
});
client.on('authenticated', () => log('تم الربط ✔'));
client.on('auth_failure', (m) => log('✘ فشل التوثيق — محتاج ربط جديد:', m));
client.on('ready', () => {
  log('رقم ' + NUM + ' شغال وبيسمع للطلبات والتحويلات بس');
  try { fs.unlinkSync(QR); } catch (e) {}
  if (LINK) {
    console.log('\n✅ رقم ' + NUM + ' اتربط. الشباك ده هيقفل والجسر هيشتغل في الخلفية.\n');
    // لازم نقفل كروم بنعومة (destroy) قبل ما نخرج، لأن قفل العملية بالقوة ممكن يسيب ملفات الجلسة
    // ناقصة (لسه بتُكتب) فتبقى تالفة ويطلب باركود جديد تاني أول ما الجسر الدائم يشتغل
    setTimeout(async () => { try { await client.destroy(); } catch (e) {} process.exit(0); }, 4000);
    return;
  }
  flush();
});
client.on('disconnected', (r) => { log('اتفصل:', r); process.exit(1); });

async function classify(media) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(SB_URL + '/functions/v1/wa-classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ secret: SECRET, mime: String(media.mimetype || 'image/jpeg').split(';')[0], image: media.data }) });
      const j = await r.json();
      if (r.ok && j && j.cat) return j;
    } catch (e) {}
  }
  return null;
}
async function send(o) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/wa_submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY },
    body: JSON.stringify({ p_secret: SECRET, p_msg_id: o.msg_id, p_phone: o.phone, p_name: o.name, p_body: o.body }),
  });
  const out = await r.text(); if (!r.ok) throw new Error(`${r.status} ${out}`); return out;
}
let flushing = false;
async function flush() {
  if (flushing || !fs.existsSync(QUEUE)) return; flushing = true;
  try {
    const rows = fs.readFileSync(QUEUE, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)), left = [];
    for (const o of rows) { try { await send(o); } catch (e) { if (!/forbidden|empty/.test(e.message)) left.push(o); } }
    if (left.length) fs.writeFileSync(QUEUE, left.map((x) => JSON.stringify(x)).join('\n') + '\n'); else fs.unlinkSync(QUEUE);
  } catch (e) { log('خطأ في الطابور:', e.message); }
  flushing = false;
}
setInterval(flush, 60000);

async function phoneOf(msg, contact) {
  let number = contact.number;
  if (msg.from.endsWith('@lid')) {
    try { const m = await client.getContactLidAndPhone([msg.from]); const pn = m && m[0] && (m[0].pn || m[0].phone); if (pn) number = String(pn).split('@')[0]; } catch (e) {}
  }
  return (number || '').replace(/\D/g, '');
}

client.on('message', async (msg) => {
  try { log('[تشخيص] وصلت رسالة نوع=' + msg.type + ' مجموعة=' + String(msg.from).endsWith('@g.us') + ' منك=' + msg.fromMe + ' ميديا=' + msg.hasMedia); } catch (e) {}
  if (LINK) return;
  try {
    const text = (msg.body || '').trim();
    if (msg.fromMe || msg.isStatus || msg.from.endsWith('@g.us')) return;
    const msgId = LINE + '-' + ((msg.id && (msg.id._serialized || msg.id.id)) || `${msg.from}-${msg.timestamp || Date.now()}`);
    if (waFilter.dup(msgId)) return;
    const c0 = await msg.getContact();
    const ph0 = await phoneOf(msg, c0);
    const nm0 = ((c0.pushname || c0.name || '').trim() || 'عميل') + ' (على رقمك ' + NUM + ')';
    const meta = { saved: !!(c0 && c0.isMyContact) };
    let pre = null;
    if (msg.hasMedia && msg.type === 'image') {
      pre = waFilter.decidePhoto(text, ph0, nm0, meta);
      const blocked = !pre.accept && /محظور|إغراق/.test(pre.why || '');   // المحظور والإغراق يفضلوا ممنوعين
      if (pre.accept || !blocked) (async () => {
        try {
          const media = await msg.downloadMedia();
          if (!media || !/^image\/(jpeg|png|webp)/.test(media.mimetype || '')) return;
          let why = pre.why, cap = text;
          if (!pre.accept) {
            // صورة من رقم/سبب مش معروف: الذكاء الاصطناعي يحكم — تحويل أو شغل تتبعت، شخصي/روشتة/كلام تتجاهل
            const c = await classify(media);
            if (c && c.cat === 'other') { log('🖼️ صورة اتجاهلت (مش شغل): ' + (c.why || '')); return; }
            why = c ? ('تصنيف ذكي: ' + (c.cat === 'transfer' ? 'تحويل' : 'شغل')) : 'من غير تصنيف (الذكاء مش متاح)';
            cap = (text ? text + ' ' : '') + (c && c.cat === 'transfer' ? '💸 تحويل' : '🛠️ شغل');
          }
          await rpc('wa_photo_submit', { p_secret: SECRET, p_msg_id: msgId, p_phone: ph0, p_name: nm0, p_caption: cap, p_img: `data:${media.mimetype.split(';')[0]};base64,${media.data}` });
          log('📷 صورة اتبعتت للسيستم — السبب: ' + why);
        } catch (e) { log('✘ صورة ماتبعتتش:', e.message); }
      })();
    }
    if (!text) return;
    if (pre && !(pre.accept && pre.rule)) return;
    const dec = pre ? pre : waFilter.decideText(text, ph0, nm0, meta);
    if (!dec.accept) return;                       // مفيش أي تسجيل للرسايل اللي اتجاهلت (خصوصية)
    const o = { msg_id: msgId, phone: ph0, name: nm0, body: text };
    waFilter.group(o, dec, async (x, n) => {
      try { await send(x); log('✔ طلب/تحويل اتبعت للسيستم — السبب: ' + dec.why + (n > 1 ? ' — ' + n + ' رسايل في طلب واحد' : '')); }
      catch (e) { log('✘ مبعتش، اتحفظ للإعادة'); fs.appendFileSync(QUEUE, JSON.stringify(x) + '\n'); }
    });
  } catch (e) { log('خطأ:', e.message); }
});

client.initialize().catch((e) => { log('واتساب ويب ماتحمّلش:', e.message); process.exit(1); });
