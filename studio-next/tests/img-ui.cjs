// اختبار إدراج الصور الذكي: node tests/img-ui.cjs <url> <outDir>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9361;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/img-ui-prof', 'about:blank'], { stdio: 'ignore' });
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
  console.log('inject:', await ev(`(()=>{const T=${T};T.setV(window.__tv);T.setD({title:'تجربة',dur:6,seg:[{s:.2,e:1.6,t:'ليه الدرج الصامت أحسن من العادي؟',kw:[]},{s:1.8,e:3,t:'محلنا في أرض اللواء الجيزة',kw:[]},{s:3.2,e:4.6,t:'المفصلة سوفت كلوز بتقفل لوحدها',kw:[]},{s:4.8,e:5.8,t:'اطلب دلوقتي من ميكانيزم',kw:[]}],ev:[],vad:[[.2,1.6],[1.8,3],[3.2,4.6],[4.8,5.8]],ch:[[0,6]],loud:{db:-20,gain:1.6},peak:.5,cs:2,rt:1});document.getElementById('sm_res').style.display='block';T.setup();T.build();return 'ok'})()`));
  // صور تجريبية (أفقي، طولي، مربع) بصيغة PNG كملفات حقيقية، وبنمر على نفس مسار الرفع
  console.log('add:', await ev(`(async()=>{const mk=(w,h,c,tx)=>new Promise(r=>{const k=document.createElement('canvas');k.width=w;k.height=h;const x=k.getContext('2d');x.fillStyle=c;x.fillRect(0,0,w,h);x.fillStyle='#fff';x.font='bold '+Math.round(w/6)+'px sans-serif';x.fillText(tx,20,h/2);k.toBlob(b=>r(new File([b],tx+'.png',{type:'image/png'})))});
    const fs=[await mk(1600,900,'#a33','map'),await mk(900,1600,'#36a','hinge'),await mk(1000,1000,'#3a6','price'),await mk(1200,800,'#a6a','extra')];
    await window.mkzSmart._test.addImgFiles(fs);return JSON.stringify(window.mkzSmart.state().IMC.map(c=>c.name+':'+c.w+'x'+c.h))})()`));
  console.log('fallback IML:', await ev(`JSON.stringify(window.mkzSmart.state().IML.map(b=>[+b.s.toFixed(1),+b.e.toFixed(1),b.c.name,!!b.fb]))`));
  await sleep(3000);console.log('ai state:', await ev(`JSON.stringify(window.mkzSmart.state().IMAI)`));
  // ذكاء محقون: map→جملة ٢ (محلنا)، hinge→جملة ٣، price→جملة ٤ بدون تطابق، extra→مفيش
  console.log('apply:', await ev(`(()=>{const T=${T};T.imApply([{i:0,seg:0,phrase:'الدرج',conf:.9,kind:'place',desc:'خريطة المحل',caption:'موقعنا'},{i:1,seg:2,phrase:'المفصلة',conf:.95,kind:'product',desc:'مفصلة سوفت',caption:''},{i:2,seg:-1,phrase:'',conf:0,kind:'price',desc:'قايمة أسعار',caption:''},{i:3,seg:3,phrase:'اطلب',conf:.2,kind:'other',desc:'؟',caption:''}]);return JSON.stringify(window.mkzSmart.state().IML.map(b=>[+b.s.toFixed(2),+b.e.toFixed(2),b.c.name]))})()`));
  for (const mode of ['auto', 'full']) {
    await ev(`(()=>{const s=document.getElementById('sm_ist');s.value='${mode}';s.onchange()})()`);
    for (const t of [1.6, 4.0]) {
      const r = await ev(`(async()=>{const v=window.__tv;v.currentTime=${t};await new Promise(z=>{v.onseeked=z;setTimeout(z,1500)});window.mkzSmart.draw(${t});return document.getElementById('sm_cv').toDataURL('image/jpeg',.8)})()`);
      if (typeof r === 'string' && r.startsWith('data:')) fs.writeFileSync(path.join(OUT, 'img-' + mode + '-' + t + '.jpg'), Buffer.from(r.split(',')[1], 'base64')); else console.log('draw', mode, t, r);
    }
  }
  console.log('list html:', await ev(`document.getElementById('sm_il').innerText.slice(0,400)`));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
