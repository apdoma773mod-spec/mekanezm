// اختبار قسم القوالب في كروم حقيقي بصور الآيفون (HEIC): رفع ← القالب ← الكلام ← تصدير صور وفيديو + لقطات شاشة.
// node tests/tpl-ui.cjs <url> <photosDir> <outDir> [count] [style]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', DIR = process.argv[3], OUT = process.argv[4], N = +(process.argv[5] || 8), STYLE = process.argv[6] || 'journey', PORT = 9352;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--window-size=430,932', '--user-data-dir=' + require('os').tmpdir() + '/tpl-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = [], logs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text); if (d.method === 'Runtime.consoleAPICalled' && /warn|error/.test(d.params.type)) logs.push(d.params.args.map(a => a.value || a.description).join(' ')) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result.result ? r.result.result.value : r; };
  const shot = async n => { const r = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(OUT, n + '.png'), Buffer.from(r.result.data, 'base64')); };
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`(()=>{const g=document.getElementById('gt-ov');if(g)g.remove();setInterval(()=>{const g=document.getElementById('gt-ov');if(g)g.remove()},500)})()`);await ev(`document.querySelector('#rail [data-go="tpl"]').click()`); await sleep(1500);
  await shot('1-empty');const st0=await ev(`JSON.stringify({sec:!!document.getElementById('v-tpl'),on:document.getElementById('v-tpl')&&document.getElementById('v-tpl').classList.contains('on'),len:(document.getElementById('v-tpl')||{}).innerHTML?.length,btn:!!document.querySelector('#rail [data-go="tpl"]')})`);console.log('open:',st0,'errors:',errs.slice(0,3),logs.slice(0,3));if(!/"on":true/.test(st0)){ws.close();chrome.kill();process.exit(1)}
  const files = fs.readdirSync(DIR).filter(f => /\.(heic|jpe?g|png|mov|mp4)$/i.test(f)).slice(0, N).map(f => path.join(DIR, f));
  const doc = await send('DOM.getDocument', { depth: -1 }); const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#tp_f' });
  const t0 = Date.now(); await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files });
  for (let i = 0; i < 240; i++) { await sleep(1000); const s = await ev(`document.getElementById('tp_pg').innerText`); if (s && !/⏳/.test(s)) { console.log('loaded in', ((Date.now() - t0) / 1000).toFixed(1) + 's:', s.slice(0, 300)); break } }
  await shot('2-photos');
  await ev(`document.getElementById('tp_next').click()`); await sleep(6000); await shot('3-templates');
  await ev(`document.querySelector('[data-st="${STYLE}"]').click()`); await sleep(500);
  await ev(`window.scrollTo(0,0)`); await sleep(1800); await shot('4-selected');
  await ev(`document.getElementById('tp_next').click()`); await sleep(500);
  await ev(`(()=>{const s=(id,v)=>{const e=document.getElementById(id);e.value=v;e.dispatchEvent(new Event('input'))};s('tp_t_title','مطبخ ألمنيوم مودرن');s('tp_t_sub','من الصفر للتسليم');s('tp_t_price','45000');s('tp_t_phone','01001234567');const k=document.getElementById('tp_kit');if(k&&k.offsetParent)k.click();const d=document.getElementById('tp_t_date');d.checked=true;d.dispatchEvent(new Event('change'))})()`);
  await shot('5-texts');
  await ev(`document.getElementById('tp_next').click()`); await sleep(2500); await shot('6-final');
  await ev(`document.getElementById('tp_exi').click()`);
  for (let i = 0; i < 120; i++) { await sleep(1000); const r = await ev(`!!document.getElementById('tp_shi')`); if (r) break; }
  const imgs = await ev(`[...document.querySelectorAll('#tp_res img')].length`); console.log('images exported:', imgs);
  // نحفظ أول ٣ صور
  const srcs = await ev(`Promise.all([...document.querySelectorAll('#tp_res img')].slice(0,4).map(async im=>{const b=await (await fetch(im.src)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})}))`);
  (srcs || []).forEach((d, i) => fs.writeFileSync(path.join(OUT, 'img-' + (i + 1) + '.jpg'), Buffer.from(d.split(',')[1], 'base64')));
  if (process.argv[7] !== 'novideo') {
    const tv = Date.now(); await ev(`document.getElementById('tp_exv').click()`);
    for (let i = 0; i < 240; i++) { await sleep(1000); const r = await ev(`!!document.getElementById('tp_sh')||/❌/.test(document.getElementById('tp_msg').innerText)`); if (r) break; }
    const res = await ev(`(async()=>{const v=document.querySelector('#tp_res video');if(!v)return document.getElementById('tp_msg').innerText;const b=await (await fetch(v.src)).blob();await new Promise(r=>{v.onloadedmetadata=r;setTimeout(r,4000)});return {type:b.type,mb:(b.size/1048576).toFixed(2),dur:v.duration,w:v.videoWidth,h:v.videoHeight,h2:document.querySelector('#tp_res h2').innerText}})()`);
    console.log('video:', JSON.stringify(res), 'took', ((Date.now() - tv) / 1000).toFixed(1) + 's');
    const vd = await ev(`(async()=>{const v=document.querySelector('#tp_res video');if(!v)return null;const b=await (await fetch(v.src)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})})()`);
    if (vd) fs.writeFileSync(path.join(OUT, 'out.' + (/mp4/.test(vd.slice(0, 30)) ? 'mp4' : 'webm')), Buffer.from(vd.split(',')[1], 'base64'));
  }
  console.log('errors:', errs.length, errs.slice(0, 5)); console.log('warnings:', logs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
