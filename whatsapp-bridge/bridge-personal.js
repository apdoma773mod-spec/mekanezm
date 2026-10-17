// جسر الأرقام الشخصية (رقم 1 / رقم 2) — بيسمع بس، مابيبعتش أي رسالة من رقمك. 2026-10-16
// التشغيل: node bridge-personal.js p1   (أو p2) — أول مرة بيطلع QR تمسحه من موبايلك.
// الخصوصية: نص رسايل الأهل والأصحاب مابيتحفظش في أي مكان، والأرقام المتسجّلة عندك بتتجاهل
// إلا لو الرقم ده عميل/مورد متسجّل في السيستم أو في «الأرقام المسموحة».
const { Client, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const { execFile } = require('child_process');

const LINE = (process.argv[2] || 'p1').replace(/[^a-z0-9]/gi, '').toLowerCase() || 'p1';
const LINK = process.argv.includes('--link');
const NUM = LINE.replace(/\D/g, '') || '1';
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

async function rpc(fn, body) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null;
}
waFilter.init({ rpc, secret: SECRET, log, private: true, ignoreSaved: true, queue: QUEUE });

const client = new Client({
  authStrategy: new LocalAuth({ clientId: LINE, dataPath: 'C:\\mkwa-personal' }),   // بره فولدر الجسر عشان إعادة تشغيل جسر المحل ماتقفلهوش
  authTimeoutMs: 120000,   // مهلة تحميل واتساب ويب
  puppeteer: { executablePath: CHROME, headless: true, args: ['--no-sandbox'] },
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
client.on('ready', () => {
  log('رقم ' + NUM + ' شغال وبيسمع للطلبات والتحويلات بس');
  try { fs.unlinkSync(QR); } catch (e) {}
  if (LINK) { console.log('\n✅ رقم ' + NUM + ' اتربط. الشباك ده هيقفل والجسر هيشتغل في الخلفية.\n'); setTimeout(() => process.exit(0), 4000); return; }
  flush();
});
client.on('disconnected', (r) => { log('اتفصل:', r); process.exit(1); });

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
      if (pre.accept) (async () => {
        try {
          const media = await msg.downloadMedia();
          if (!media || !/^image\/(jpeg|png|webp)/.test(media.mimetype || '')) return;
          await rpc('wa_photo_submit', { p_secret: SECRET, p_msg_id: msgId, p_phone: ph0, p_name: nm0, p_caption: text, p_img: `data:${media.mimetype.split(';')[0]};base64,${media.data}` });
          log('📷 صورة اتبعتت للسيستم — السبب: ' + pre.why);
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
