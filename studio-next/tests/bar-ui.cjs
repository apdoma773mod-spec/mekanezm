// شريط الأدمن ماغطّيش علامة ✕ بتاعة أي شاشة: node tests/bar-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9369;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/bar-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await sleep(2000);
  // نفس شريط الأدمن اللي بيظهر بعد الدخول (نفس الـ id والـ CSS بتوع gate.ts)
  console.log('bar:', await ev(`(()=>{const st=document.createElement('style');st.textContent='#gt-ov{display:none!important}';document.head.appendChild(st);let b=document.getElementById('gt-bar');if(!b){b=document.createElement('div');b.id='gt-bar';document.body.prepend(b)}b.innerHTML='🛠️ أدمن <a href="/admin">لوحة التحكم</a> <button>⏻</button>';const r=b.getBoundingClientRect();return JSON.stringify({pos:getComputedStyle(b).position,top:Math.round(r.top),h:Math.round(r.height),left:Math.round(r.left),w:Math.round(r.width)})})()`));
  await ev(`document.querySelector('[data-go="prod"]').click()`); await sleep(1200);
  await ev(`(async()=>{const q=document.getElementById('q1');q.value='سوفت كلوز';q.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));if(window.__mkProd.state().RES.length)break}document.querySelector('[data-mkp="0"]').click();await new Promise(r=>setTimeout(r,800))})()`);
  console.log('X visible & clickable:', await ev(`(()=>{const x=document.querySelector('#mkpc [data-x="close"]');const r=x.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return (el===x||x.contains(el))+' at '+Math.round(r.left)+','+Math.round(r.top)})()`));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'bar-card.jpg'), Buffer.from(shot.result.data, 'base64'));
  await ev(`document.querySelector('#mkpc [data-x="close"]').click()`);
  // كل علامات ✕ اللي ظاهرة في الصفحة: محدش مغطيها
  console.log('all X buttons:', await ev(`(()=>{const L=[...document.querySelectorAll('button')].filter(b=>/^\\s*(✕|×|✖)\\s*$/.test(b.textContent)&&b.offsetParent);return L.length+' ظاهرين، المغطيين: '+L.filter(b=>{const r=b.getBoundingClientRect();const el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return el&&el!==b&&!b.contains(el)&&r.top>=0&&r.top<innerHeight}).length})()`));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
