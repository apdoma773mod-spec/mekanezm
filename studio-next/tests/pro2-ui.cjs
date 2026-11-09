// اختبار الـ٢٠ إضافة في المونتاج الذكي داخل كروم: فيديو تجريبي + تحليل محقون ← تشغيل كل اللمسات ورسم فريمات + تشغيل كل أداة.
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9353;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/pro2-ui-prof', 'about:blank'], { stdio: 'ignore' });
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
  console.log('panel2:', await ev(`JSON.stringify({p2:!!document.getElementById('sm_pro2'),fx:document.querySelectorAll('#sm_p2_fx [data-px]').length,tl:document.querySelectorAll('#sm_p2_tl [data-tl]').length})`));
  // فيديو تجريبي ٦ ثواني من canvas
  console.log('video:', await ev(`(async()=>{const c=document.createElement('canvas');c.width=720;c.height=1280;const x=c.getContext('2d');const st=c.captureStream(30);const r=new MediaRecorder(st,{mimeType:'video/webm'});const ch=[];r.ondataavailable=e=>ch.push(e.data);r.start(100);const t0=performance.now();
    await new Promise(res=>{const f=()=>{const t=(performance.now()-t0)/1000;x.fillStyle='hsl('+(t*60)+',60%,45%)';x.fillRect(0,0,720,1280);x.fillStyle='#fff';x.font='bold 120px sans-serif';x.fillText(t.toFixed(1),200,640);if(t<6)requestAnimationFrame(f);else res()};f()});r.stop();await new Promise(z=>r.onstop=z);
    const v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(new Blob(ch,{type:'video/webm'}));await new Promise(z=>{v.onloadeddata=z;v.load()});if(!isFinite(v.duration)){v.currentTime=1e9;await new Promise(z=>{v.ondurationchange=z;setTimeout(z,3000)});v.currentTime=0}window.__tv=v;return v.videoWidth+'x'+v.videoHeight+' dur '+v.duration})()`));
  const T = `window.mkzSmart._test`;
  console.log('inject:', await ev(`(()=>{const T=${T};T.setV(window.__tv);T.setD({title:'الدرج الصامت أحسن من العادي',dur:6,seg:[{s:.2,e:1.6,t:'ليه الدرج الصامت أحسن من العادي؟',kw:['الدرج']},{s:1.8,e:3,t:'يعني سعره ٣٥٠ جنيه بس'},{s:3.2,e:4.6,t:'المفصلة سوفت كلوز بتقفل لوحدها مستحيل تخبط'},{s:4.8,e:5.8,t:'اطلب دلوقتي من ميكانيزم'}],ev:[],vad:[[.2,1.6],[1.8,3],[3.2,4.6],[4.8,5.8]],ch:[[0,6]],loud:{db:-20,gain:1.6},peak:.5,cs:2,rt:1});
    document.getElementById('sm_res').style.display='block';T.setup();T.build();return 'ok'})()`));
  await sleep(900);console.log('sticky:',await ev(`(()=>{const w=document.getElementById('sm_stk'),c=document.getElementById('sm_cv');if(!w)return 'no wrapper';const r=c.getBoundingClientRect();return JSON.stringify({on:w.classList.contains('on'),pos:getComputedStyle(w).position,canvasInWrap:w.contains(c),h:Math.round(r.height),w:Math.round(r.width)})})()`));
  // شغّل كل اللمسات
  console.log('toggle fx:', await ev(`(()=>{const b=[...document.querySelectorAll('#sm_p2_fx [data-px]')];b.forEach(x=>x.click());return document.querySelectorAll('#sm_p2_fx .on').length})()`));
  for (const t of [0.05, 0.9, 2.2, 3.3, 4.0, 5.6, 5.95]) {
    const r = await ev(`(async()=>{const v=window.__tv;v.currentTime=${t};await new Promise(z=>{v.onseeked=z;setTimeout(z,1500)});window.mkzSmart.draw(${t});const c=document.getElementById('sm_cv');return c.toDataURL('image/jpeg',.8)})()`);
    if (typeof r === 'string' && r.startsWith('data:')) fs.writeFileSync(path.join(OUT, 'fx-' + t + '.jpg'), Buffer.from(r.split(',')[1], 'base64')); else console.log('draw', t, r);
  }
  for (const k of ['clips', 'ret', 'fill', 'titles', 'caps', 'shots', 'script']) {
    await ev(`document.querySelector('[data-tl="${k}"]').click()`); await sleep(400);
    const o = await ev(`document.getElementById('sm_p2_out').innerText.slice(0,260)`); console.log('▶', k, '→', JSON.stringify(o));
  }
  await ev(`document.querySelector('[data-tl="cover"]').click()`); await sleep(5000);
  const cov = await ev(`(async()=>{const im=document.querySelector('#sm_p2_out img');if(!im)return document.getElementById('sm_p2_out').innerText;const b=await (await fetch(im.src)).blob();return await new Promise(r=>{const f=new FileReader();f.onload=()=>r(f.result);f.readAsDataURL(b)})})()`);
  if (cov && cov.startsWith('data:')) { fs.writeFileSync(path.join(OUT, 'cover.jpg'), Buffer.from(cov.split(',')[1], 'base64')); console.log('cover saved'); } else console.log('cover:', cov);
  await ev(`document.querySelector('[data-tl="pack"]').click()`); await sleep(5000); console.log('pack:', await ev(`document.getElementById('sm_p2_out').innerText.slice(0,120)`));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
