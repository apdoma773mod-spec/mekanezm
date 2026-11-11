// اختبار صفحة المنتجات المربوطة بالسيستم والموقع (كارت المنتج + بوست + مونتاج): node tests/prod-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9365;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/prod-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`(()=>{window.alert=()=>{};const g=document.getElementById('gt-ov');if(g)g.remove()})()`);
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await ev(`document.querySelector('[data-go="prod"]').click()`); await sleep(1500);
  console.log('box:', await ev(`!!document.getElementById('mkp')&&!!document.getElementById('mkp_l')`));
  console.log('search:', await ev(`(async()=>{const q=document.getElementById('q1');q.value='سوفت كلوز';q.dispatchEvent(new Event('input',{bubbles:true}));for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));const s=window.__mkProd.state();if(s.RES.length)return JSON.stringify(s.RES.map(x=>x.name+' | '+x.code+' | '+x.imgs.length+' img'))}return document.getElementById('mkp').innerText})()`));
  console.log('card:', await ev(`(async()=>{document.querySelector('[data-mkp="0"]').click();await new Promise(r=>setTimeout(r,800));const c=document.getElementById('mkpc');return c?c.innerText.replace(/\\s+/g,' ').slice(0,700):'no card'})()`));
  const shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'prod-card.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('ig caption:', await ev(`(()=>{document.querySelector('[data-cap="ig"]').click();return document.getElementById('mkpc_cap').value.slice(0,300)})()`));
  console.log('post:', await ev(`(async()=>{document.querySelector('#mkpc [data-x="post"]').click();await new Promise(r=>setTimeout(r,1500));return JSON.stringify({view:document.querySelector('.v.on')&&document.querySelector('.v.on').id,hd:document.getElementById('hd').value,card:!!document.getElementById('mkpc')})})()`));
  console.log('vid+imgs:', await ev(`(async()=>{document.querySelector('[data-go="prod"]').click();await new Promise(r=>setTimeout(r,500));document.querySelector('[data-mkp="0"]').click();await new Promise(r=>setTimeout(r,600));document.querySelector('#mkpc [data-x="imgs"]').click();for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));const st=window.mkzSmart.state();if(st.IMC&&st.IMC.length&&!document.getElementById('mkpc'))return JSON.stringify({view:document.querySelector('.v.on').id,imgs:st.IMC.length,sel:window.mkzSmart._test.sysState().SELP.map(x=>x.nm)})}return 'timeout'})()`));
  const shot2 = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'prod-smart.jpg'), Buffer.from(shot2.result.data, 'base64'));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
