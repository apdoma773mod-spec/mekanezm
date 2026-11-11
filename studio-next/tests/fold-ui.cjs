// اختبار لمّ الشاشات في أيقونات (كل الشاشات): node tests/fold-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9367;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/fold-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await sleep(2500);
  const views = await ev(`[...new Set([...document.querySelectorAll('#rail [data-go]')].map(b=>b.dataset.go))].join(',')`);
  for (const v of String(views).split(',')) {
    const r = await ev(`(async()=>{const b=document.querySelector('#rail [data-go="${v}"]');b.click();await new Promise(r=>setTimeout(r,1300));const s=document.querySelector('.v.on');if(!s)return 'no view';const tiles=[...s.querySelectorAll('.fz-t')].map(t=>t.textContent.trim());const open=[...s.querySelectorAll('.p')].filter(c=>!c.parentElement.closest('.p')&&getComputedStyle(c).display!=='none').map(c=>{const h=c.querySelector('h2');return h?h.textContent.trim().slice(0,16):'(بدون عنوان)'});return s.id+' | أيقونات '+tiles.length+': '+tiles.join('، ')+' || مفتوح '+open.length+': '+open.join('، ')+' || طول الشاشة '+s.scrollHeight})()`);
    console.log(r);
  }
  await ev(`document.querySelector('#rail [data-go="post"]').click()`); await sleep(1200);
  await ev(`document.querySelectorAll('#gt-ov,[id^=gt-]').forEach(x=>{if(getComputedStyle(x).position==='fixed')x.remove()})`);
  let shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'fold-post.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('open tile:', await ev(`(async()=>{const t=document.querySelector('#v-post .fz-t');t.click();await new Promise(r=>setTimeout(r,500));const c=t._c;const a=getComputedStyle(c).display;t.click();await new Promise(r=>setTimeout(r,300));return 'after open: '+a+' / after second tap: '+getComputedStyle(c).display})()`));
  await ev(`(()=>{document.querySelectorAll('#gt-ov,[id^=gt-]').forEach(x=>{if(getComputedStyle(x).position==='fixed')x.remove()});[...document.querySelectorAll('button')].filter(b=>/يلا نبدأ/.test(b.textContent)).forEach(b=>b.click());document.querySelector('#v-post .fz-t').click()})()`); await sleep(700);
  shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'fold-post-open.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
