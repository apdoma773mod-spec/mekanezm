// printer.js - طباعة صامتة على طابعات الكمبيوتر من أوامر السيستم (PRINT:receipt / PRINT:label / PRINT:a4)
// بيستخدم كروم بوضع kiosk-printing (من غير نافذة طباعة) وبيبدّل الطابعة الافتراضية مؤقتًا.
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFile, spawn } = require('child_process');

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEFAULTS = {
  receipt: 'Xprinter XP-80(Copy 1)',   // الشغالة (الأصلية XP-80 أوفلاين)
  label: 'Xprinter XP-370B',
  a4: 'KONICA MINOLTA 4700P_4000P_3300P',
};
let MAP = Object.assign({}, DEFAULTS);
try { MAP = Object.assign(MAP, JSON.parse(fs.readFileSync(path.join(__dirname, 'printers.json'), 'utf8'))); } catch (e) {}

const ps = (script) => new Promise((resolve, reject) => {
  execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { windowsHide: true, timeout: 30000 }, (err, out) => err ? reject(err) : resolve(String(out).trim()));
});

// تغيير الطابعة الافتراضية بطريقة CIM مع تأكيد بالقراءة — في استدعاء PowerShell واحد بس
// (كان قبل كده 2-7 استدعاءات لكل تبديل، وكل استدعاء بيفتح عملية PowerShell جديدة بتاخد وقت)
async function setDefault(name) {
  const q = name.replace(/'/g, "''");
  const out = await ps(
    "$cur = (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name;" +
    "if ($cur -ne '" + q + "') {" +
    "  Invoke-CimMethod -InputObject (Get-CimInstance Win32_Printer -Filter \"Name='" + q + "'\") -MethodName SetDefaultPrinter | Out-Null;" +
    "  for ($i = 0; $i -lt 10; $i++) {" +
    "    $cur2 = (Get-CimInstance Win32_Printer | Where-Object { $_.Default }).Name;" +
    "    if ($cur2 -eq '" + q + "') { break };" +
    "    Start-Sleep -Milliseconds 300" +
    "  }" +
    "};" +
    "$cur"
  );
  return out;   // اسم الطابعة الافتراضية القديمة (قبل التبديل)
}
let chain = Promise.resolve();   // طابور: شغلانة واحدة في المرة
function enqueue(fn) { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; }

async function printHtml(kind, html, log) {
  const name = MAP[kind] || MAP.a4;
  const dir = path.join(__dirname, 'printjobs');
  fs.mkdirSync(dir, { recursive: true });
  const id = Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  const file = path.join(dir, id + '.html');
  let body = String(html || '');
  if (!/<meta[^>]*charset/i.test(body)) body = '<meta charset="utf-8">' + body;
  fs.writeFileSync(file, body, 'utf8');

  let prev = '';
  try { prev = await setDefault(name); } catch (e) { log && log('تعذر تبديل الطابعة الافتراضية: ' + e.message); }
  try {
    const prof = path.join(os.tmpdir(), 'mk-print-' + String(kind).replace(/[^a-z0-9]/gi, ''));
    // كروم بيطبع على «آخر طابعة مستخدمة» من ملف الإعدادات مش على الافتراضية: بنكتبها هنا قبل التشغيل
    try {
      const dd = path.join(prof, 'Default');
      fs.mkdirSync(dd, { recursive: true });
      const state = { version: 2, recentDestinations: [{ id: name, origin: 'local', account: '', capabilities: {}, displayName: name, extensionId: '', extensionName: '' }],
        selectedDestinationId: name, isHeaderFooterEnabled: false, isCssBackgroundEnabled: true };
      const pf = path.join(dd, 'Preferences');
      let pr = {};
      try { pr = JSON.parse(fs.readFileSync(pf, 'utf8')); } catch (e) {}
      pr.printing = Object.assign({}, pr.printing, { print_preview_sticky_settings: { appState: JSON.stringify(state) } });
      fs.writeFileSync(pf, JSON.stringify(pr), 'utf8');
    } catch (e) { log && log('تعذر ضبط الطابعة في كروم: ' + e.message); }
    await new Promise((resolve, reject) => {
      const child = spawn(CHROME, ['--kiosk-printing', '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--app=file:///' + file.replace(/\\/g, '/')], { windowsHide: true, stdio: 'ignore' });
      const kill = setTimeout(() => { try { execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => {}); } catch (e) {} }, 25000);
      child.on('exit', () => { clearTimeout(kill); resolve(); });
      child.on('error', (e) => { clearTimeout(kill); reject(e); });
    });
    log && log('🖨️ اتطبع على ' + name);
  } finally {
    if (prev && prev !== name) { try { await setDefault(prev); } catch (e) {} }
    setTimeout(() => { try { fs.unlinkSync(file); } catch (e) {} }, 60000);
  }
}

// o = صف من wa_out: to_phone = 'PRINT:receipt' ، body = HTML الورقة
function handle(o, log) {
  const kind = String(o.to_phone || '').replace(/^PRINT:/i, '').toLowerCase();
  return enqueue(() => printHtml(kind, o.body, log));
}

module.exports = { handle, isPrintJob: (o) => /^PRINT:/i.test(String((o && o.to_phone) || '')), MAP };
