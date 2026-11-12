// Adapter: the old bridges call Supabase RPCs (wa_out_claim, wa_submit, ...). When config.json has
// "backend" (e.g. "http://127.0.0.1:4000") and "bridgeSecret", the same calls go to the NEW system's /api/v1/bridge/* instead.
// Rollback: delete "backend" from config.json and restart the bridges.
const fs = require('fs');
let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(__dirname + '\\config.json', 'utf8')); } catch (e) {}
const base = cfg.backend ? String(cfg.backend).replace(/\/$/, '') + '/api/v1/bridge' : '';
exports.enabled = !!(base && cfg.bridgeSecret);

async function http(method, path, body) {
  const r = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-bridge-secret': cfg.bridgeSecret },
    body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${t.slice(0, 200)}`);
  return t ? JSON.parse(t) : null;
}

exports.call = async function (fn, b) {
  b = b || {};
  switch (fn) {
    case 'wa_out_claim': return http('POST', '/out/claim', {});
    case 'wa_out_done': return http('POST', '/out/done', { id: b.p_id, ok: !!b.p_ok, err: b.p_err || '' });
    case 'wa_submit': return http('POST', '/wa/submit', { msgId: b.p_msg_id || undefined, phone: b.p_phone || '', name: b.p_name || '', body: b.p_body });
    case 'wa_photo_submit': return http('POST', '/photo/submit', { msgId: b.p_msg_id || undefined, phone: b.p_phone || '', name: b.p_name || '', caption: b.p_caption || '', img: b.p_img });
    case 'wa_known_phones': return http('GET', '/known-phones');
    case 'wa_rules_get': return http('GET', '/rules');
    case 'wa_rules_stat': return http('POST', '/rules-stat', b.p_stat || {});
    default: throw new Error('rpc غير معروف في الجسر الجديد: ' + fn);
  }
};
