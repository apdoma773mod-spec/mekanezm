// جسر الطباعة لوحده — مستقل تمامًا عن واتساب (مفيهوش Puppeteer ولا جلسة واتساب خالص).
// بيسحب أوامر الطباعة من صندوق الصادر (wa_out) ويطبعها على طول، وأي رسالة واتساب
// بيحوّلها لجسر bridge.js عن طريق سيرفر محلي صغير (http://127.0.0.1:8787/send) —
// مش عن طريق مشاركة الكود أو العملية، فقفل/إعادة تشغيل بريدج واتساب مابيأثرش على الطباعة خالص.
const fs = require('fs');
const printer = require('./printer');

const SRC = fs.readFileSync(__dirname + '\\bridge.js', 'utf8');   // نفس عنوان ومفتاح السيستم اللي في الجسر الأساسي
const SB_URL = (SRC.match(/SB_URL\s*=\s*'([^']+)'/) || [])[1];
const SB_KEY = (SRC.match(/SB_KEY\s*=\s*'([^']+)'/) || [])[1];
const SECRET = JSON.parse(fs.readFileSync(__dirname + '\\config.json', 'utf8')).secret;
const SEND_URL = 'http://127.0.0.1:8787/send';

const log = (...a) => {
  const line = `[${new Date().toLocaleString('en-GB')}] [طباعة] ${a.join(' ')}`;
  console.log(line);
  try { fs.appendFileSync(__dirname + '\\printer-bridge.log', line + '\n'); } catch (e) {}
};
if (!SB_URL || !SB_KEY) { log('✘ مش لاقي بيانات السيستم في bridge.js'); process.exit(1); }

async function rpc(fn, body) {
  const r = await fetch(SB_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: { 'Content-Type': 'application/json', apikey: SB_KEY }, body: JSON.stringify(body) });
  const t = await r.text(); if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`); return t ? JSON.parse(t) : null;
}

let busy = false;
async function tick() {
  if (busy) return; busy = true;
  try {
    const rows = await rpc('wa_out_claim', { p_secret: SECRET }) || [];
    for (const o of rows) {
      try {
        if (printer.isPrintJob(o)) {
          await printer.handle(o, log);
          await rpc('wa_out_done', { p_secret: SECRET, p_id: o.id, p_ok: true, p_err: '' });
          continue;
        }
        // مش أمر طباعة — رسالة واتساب، بحوّلها لجسر واتساب عن طريق السيرفر المحلي بتاعه
        let r;
        try {
          r = await fetch(SEND_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-secret': SECRET }, body: JSON.stringify(o) });
        } catch (e) { log('⏳ جسر الواتساب مش شغال دلوقتي، الرسالة فاضلة مستنية:', o.to_phone); continue; }
        const j = await r.json().catch(() => ({ ok: false, err: 'bad_response' }));
        if (j.ok) { await rpc('wa_out_done', { p_secret: SECRET, p_id: o.id, p_ok: true, p_err: '' }); log(`📤 اتبعت لـ ${o.to_phone}`); }
        else if (j.err === 'not_ready') { log('⏳ واتساب لسه مش متصل، الرسالة فاضلة مستنية:', o.to_phone); }
        else { await rpc('wa_out_done', { p_secret: SECRET, p_id: o.id, p_ok: false, p_err: j.err || 'فشل' }); log('✘ رسالة ماتبعتتش:', j.err); }
      } catch (e) {
        log('✘ خطأ في تنفيذ أمر:', e.message);
        try { await rpc('wa_out_done', { p_secret: SECRET, p_id: o.id, p_ok: false, p_err: e.message }); } catch (_) {}
      }
    }
  } catch (e) { if (!/fetch failed/i.test(e.message)) log('✘ صندوق الصادر:', e.message); }
  finally { busy = false; }
}
setInterval(tick, 4000);
log('جسر الطباعة شغال — مستقل عن واتساب تمامًا');
tick();
