// اختبار «انشر في كل مكان» على سيرفر محلي (MKZ_TEST_TOKEN): رفع حقيقي للمخزن + نشر + مسح: node tests/pub-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9370;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/pub-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  const TT = process.env.MKZ_TEST_TOKEN;
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await sleep(1500);
  await ev(`(()=>{const st=document.createElement('style');st.textContent='#gt-ov{display:none!important}';document.head.appendChild(st);window.mkzSmart.token=async()=>'${TT}';return 1})()`);
  const api = async (act, body) => (await fetch(URL_.replace(/\/$/, '') + '/api/social/' + act, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, tok: TT }) })).json();
  console.log('unauth status:', JSON.stringify(await (await fetch(URL_.replace(/\/$/, '') + '/api/social/status', { method: 'POST', body: '{}' })).json()));
  console.log('apps-set:', JSON.stringify(await api('apps-set', { apps: { meta: { id: '1234567890', secret: 'fake-secret-for-test' } } })));
  console.log('apps-get (secret hidden):', JSON.stringify(await api('apps-get', {})).slice(0, 300));
  console.log('connect meta url:', String((await api('connect', { provider: 'meta', back: URL_ + '?pub=1' })).url).slice(0, 140));
  console.log('connect google (no keys):', JSON.stringify(await api('connect', { provider: 'google' })));
  console.log('test conns:', JSON.stringify(await api('test-conns', { conns: { facebook: { account_id: '1111', name: 'صفحة تجربة', token: 'FAKE' }, instagram: { account_id: '2222', name: '@test', token: 'FAKE' } } })));
  // شاشة النشر بفيديو حقيقي
  console.log('open:', await ev(`(async()=>{const c=document.createElement('canvas');c.width=360;c.height=640;const x=c.getContext('2d');const s=c.captureStream(30);const r=new MediaRecorder(s,{mimeType:'video/webm'});const ch=[];r.ondataavailable=e=>ch.push(e.data);r.start();const t0=performance.now();await new Promise(z=>{const f=()=>{const t=(performance.now()-t0)/1000;x.fillStyle='hsl('+(t*90)+',60%,45%)';x.fillRect(0,0,360,640);if(t<2)requestAnimationFrame(f);else z()};f()});r.stop();await new Promise(z=>r.onstop=z);
    const blob=new Blob(ch,{type:'video/webm'});await window.mkPublish.open({blob,kind:'video',caps:{fb:'كابشن فيسبوك',ig:'كابشن انستا',yt:'كابشن يوتيوب',tt:'كابشن تيك توك'},title:'تجربة'});await new Promise(z=>setTimeout(z,2500));return document.getElementById('mkpub_b').innerText.replace(/\\s+/g,' ').slice(0,500)})()`));
  let shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'pub-sheet.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('publish:', await ev(`(async()=>{let up=0;const of=window.fetch;window.fetch=function(u,o){if(String(u).includes('/api/blob')&&o&&String(o.body).includes('\"del\"'))window.__del=1;return of.apply(this,arguments)};document.querySelector('#mkpub_b [data-x="go"]').click();for(let i=0;i<120;i++){await new Promise(z=>setTimeout(z,1000));const t=document.getElementById('mkpub_b').innerText;if(/انشر تاني/.test(t))return t.replace(/\\s+/g,' ').slice(0,600)+' || del='+!!window.__del}return 'timeout: '+document.getElementById('mkpub_b').innerText.replace(/\\s+/g,' ').slice(0,300)})()`));
  shot = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); fs.writeFileSync(path.join(OUT, 'pub-done.jpg'), Buffer.from(shot.result.data, 'base64'));
  console.log('big 30MB (multipart):', await ev(`(async()=>{document.getElementById('mkpub')&&document.getElementById('mkpub').remove();const blob=new Blob([new Uint8Array(30*1024*1024)],{type:'video/mp4'});await window.mkPublish.open({blob,kind:'video',caps:{fb:'x'},title:'كبير'});await new Promise(z=>setTimeout(z,2500));window.__del=0;const t0=Date.now();document.querySelector('#mkpub_b [data-x="go"]').click();for(let i=0;i<240;i++){await new Promise(z=>setTimeout(z,1000));const t=document.getElementById('mkpub_b').innerText;if(/انشر تاني/.test(t))return Math.round((Date.now()-t0)/1000)+'s: '+t.replace(/s+/g,' ').slice(150,420)}return 'timeout'})()`));
  console.log('cleanup:', JSON.stringify(await api('apps-set', { apps: { meta: { id: '' }, google: { id: '' }, tiktok: { id: '' } } })), JSON.stringify(await api('test-conns', { conns: {} })));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
