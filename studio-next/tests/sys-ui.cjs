// اختبار ربط الستوديو بالسيستم والموقع: node tests/sys-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9364;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/sys-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`(()=>{window.alert=()=>{};const g=document.getElementById('gt-ov');if(g)g.remove()})()`);
  await ev(`document.querySelector('[data-go="smart"]').click()`); await sleep(2000);
  // فيديو تجريبي ٦ ثواني من canvas
  console.log('video:', await ev(`(async()=>{const c=document.createElement('canvas');c.width=720;c.height=1280;const x=c.getContext('2d');const st=c.captureStream(30);const r=new MediaRecorder(st,{mimeType:'video/webm'});const ch=[];r.ondataavailable=e=>ch.push(e.data);r.start(100);const t0=performance.now();
    await new Promise(res=>{const f=()=>{const t=(performance.now()-t0)/1000;x.fillStyle='hsl('+(t*60)+',60%,45%)';x.fillRect(0,0,720,1280);x.fillStyle='#fff';x.font='bold 120px sans-serif';x.fillText(t.toFixed(1),200,640);if(t<6)requestAnimationFrame(f);else res()};f()});r.stop();await new Promise(z=>r.onstop=z);
    const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(new Blob(ch,{type:'video/webm'}));await new Promise(z=>{v.onloadeddata=z;v.load()});if(!isFinite(v.duration)){v.currentTime=1e9;await new Promise(z=>{v.ondurationchange=z;setTimeout(z,3000)});v.currentTime=0}window.__tv=v;return v.videoWidth+'x'+v.videoHeight+' dur '+v.duration})()`));
  const T = `window.mkzSmart._test`;
  console.log('card:', await ev(`!!document.getElementById('sm_sys')&&!!document.getElementById('sy_l')`));
  console.log('site brand:', await ev(`(async()=>{for(let i=0;i<30;i++){const s=${T}.sysState();if(s.site)return JSON.stringify(s.SITEB);await new Promise(r=>setTimeout(r,500))}return 'no site'})()`));
  console.log('search:', await ev(`(async()=>{const q=document.getElementById('sm_sysq');q.value='جرار';q.oninput();for(let i=0;i<40;i++){await new Promise(r=>setTimeout(r,500));const s=${T}.sysState();if(s.SRES.length)return JSON.stringify(s.SRES.map(x=>x.nm+' | '+x.code+' | imgs '+x.imgs.length));}return document.getElementById('sm_sysr').innerText})()`));
  console.log('pick:', await ev(`(()=>{if(!${T}.sysState().SELP.length)document.querySelector('[data-sya="0"]').click();const s=${T}.sysState();return JSON.stringify(s.SELP.map(x=>({nm:x.nm,img:x.img.slice(0,40),n:x.imgs.length})))})()`));
  console.log('to video imgs:', await ev(`(async()=>{document.querySelector('[data-syi="0"]').click();for(let i=0;i<60;i++){await new Promise(r=>setTimeout(r,500));const c=window.mkzSmart.state().IMC;if(c&&c.length)return c.length+' '+c.map(x=>x.name+':'+x.w+'x'+x.h).join(',')}return 'none: '+document.getElementById('sm_ii').innerText})()`));
  console.log('product card uses pick:', await ev(`(()=>{const T=${T};T.setV(window.__tv);T.setD({title:'تجربة',dur:6,seg:[{s:.2,e:2.6,t:'ده طقم جرار دولاب سوفت كلوز',kw:[]},{s:2.8,e:5.6,t:'اطلبه دلوقتي',kw:[]}],ev:[{s:.4,e:2.6,type:'product',label:'جرار دولاب سوفت كلوز',on:true}],vad:[[.2,2.6],[2.8,5.6]],ch:[[0,6]],loud:{db:-20,gain:1.6},peak:.5,cs:2,rt:1});document.getElementById('sm_res').style.display='block';T.setup();T.build();return 'ok'})()`));
  await sleep(2500);
  const fr = await ev(`(()=>{window.mkzSmart.draw(1.6);return document.getElementById('sm_cv').toDataURL('image/jpeg',.8)})()`);
  if (typeof fr === 'string' && fr.startsWith('data:')) { fs.writeFileSync(path.join(OUT, 'sys-card.jpg'), Buffer.from(fr.split(',')[1], 'base64')); console.log('frame saved (canvas not tainted)'); } else console.log('frame:', fr);
  console.log('bad login msg:', await ev(`(async()=>{document.getElementById('sy_l').value='01000000000';document.getElementById('sy_p').value='wrongpass1';let m='';const o=window.toast;window.toast=x=>{m=x};document.getElementById('sy_go').click();for(let i=0;i<30&&!m;i++)await new Promise(r=>setTimeout(r,300));window.toast=o;return m})()`));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
