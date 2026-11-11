// من كارت المنتج: فيديو قالب من صور المنتج (اختيار قالب + تصدير): node tests/tvid-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9371;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/tvid-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await ev(`(()=>{const st=document.createElement('style');st.textContent='#gt-ov{display:none!important}';document.head.appendChild(st)})()`);
  await ev(`document.querySelector('[data-go="prod"]').click()`); await sleep(1500);
  console.log('search:', await ev(`(async()=>{const q=document.getElementById('q1');q.value='سوفت كلوز';q.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));if(window.__mkProd.state().RES.length)return window.__mkProd.state().RES.length+' found'}return 'none'})()`));
  console.log('tvid:', await ev(`(async()=>{document.querySelector('[data-mkp="0"]').click();await new Promise(r=>setTimeout(r,800));const b=document.querySelector('#mkpc [data-x="tvid"]');const lbl=b.textContent;b.click();for(let i=0;i<80;i++){await new Promise(r=>setTimeout(r,500));const v=document.querySelector('.v.on');if(v&&v.id==='v-tpl'&&document.querySelector('#v-tpl .tp-pg.on')&&document.querySelector('#v-tpl .tp-pg.on').dataset.p==='2')return JSON.stringify({btn:lbl,view:v.id,step:2,cards:document.querySelectorAll('#tp_cards > *').length,card:!!document.getElementById('mkpc')})}return 'timeout view='+(document.querySelector('.v.on')||{}).id+' pg='+document.getElementById('tp_pg').textContent})()`));
  await sleep(2500);
  let shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'tvid-pick.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('texts:', await ev(`(async()=>{document.getElementById('tp_next').click();await new Promise(r=>setTimeout(r,800));return JSON.stringify({title:document.getElementById('tp_t_title').value,sub:document.getElementById('tp_t_sub').value,price:document.getElementById('tp_t_price').value,phone:document.getElementById('tp_t_phone').value})})()`));
  console.log('final:', await ev(`(async()=>{document.getElementById('tp_next').click();await new Promise(r=>setTimeout(r,2500));return JSON.stringify({step:document.querySelector('#v-tpl .tp-pg.on').dataset.p,exportBtn:!!document.getElementById('tp_exv')})})()`));
  shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'tvid-final.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('export:', await ev(`(async()=>{document.getElementById('tp_exv').click();for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,1000));const r=document.getElementById('tp_res');if(r&&r.querySelector('video'))return r.innerText.replace(/\s+/g,' ').slice(0,160)}return 'timeout: '+document.getElementById('tp_msg').textContent})()`));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
