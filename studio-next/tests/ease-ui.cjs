// اختبار كسر الملل وضغطة واحدة: node tests/ease-ui.cjs <url>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9363;
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
  const seg = []; for (let i = 0; i < 9; i++) seg.push({ s: i * 3.5, e: (i + 1) * 3.5, t: 'وكمان بنقول كلام عادي ومستمر ' + i, kw: [] });
  console.log('mounted:', await ev(`!!window.mkzSmart&&!!document.getElementById('sm_one')&&!!document.getElementById('sm_pi')`));
  console.log('inject:', await ev(`(()=>{const T=${T};T.setV(window.__tv);T.setD({title:'طويل',dur:32,seg:${JSON.stringify(seg)},ev:[],vad:[[0,32]],ch:[[0,32]],loud:{db:-20,gain:1.6},peak:.5,cs:2,rt:1});document.getElementById('sm_res').style.display='block';T.setup();T.build();return JSON.stringify(window.mkzSmart.state().PIL)})()`));
  console.log('pi toggle off/on:', await ev(`(()=>{const c=document.getElementById('sm_pi');c.checked=false;c.onchange();const n=window.mkzSmart.state().PIL.length;c.checked=true;c.onchange();return n+' -> '+window.mkzSmart.state().PIL.length})()`));
  console.log('one-tap:', await ev(`(()=>{document.getElementById('sm_hqg').checked=false;document.getElementById('sm_q').value='720';document.getElementById('sm_one').click();const s=window.mkzSmart.state().S;return JSON.stringify({tpl:s.tpl,q:s.q,pi:s.pi,gate:s.gate,uiGate:document.getElementById('sm_hqg').checked,uiQ:document.getElementById('sm_q').value,msg:document.getElementById('sm_onem').textContent.slice(0,30)})})()`));
  console.log('PIL after one-tap:', await ev(`JSON.stringify(window.mkzSmart.state().PIL)`));
  console.log('dbg:', await ev(`(()=>{const st=window.mkzSmart.state();return JSON.stringify({gaps:st.GAPS,cap:st.CAP.length,fx:(st.FXL||[]).map(f=>+f.s.toFixed(1)),stk:st.STK.map(x=>+x.s.toFixed(1)),ev:st.EV.length,cta:st.CTA&&st.CTA.s,mo:st.S.tpl,pi:st.S.pi,dur:st.D.dur})})()`));
  console.log('draw at PI:', await ev(`(()=>{const p=window.mkzSmart.state().PIL;if(!p.length)return 'none';try{window.mkzSmart.draw(Math.min(5,p[0].s+.1));return 'ok'}catch(e){return 'EXC '+e.message}})()`));
  console.log('qr empty:', await ev(`(()=>{const i=document.getElementById('sm_qr');i.value='';i.oninput();return document.getElementById('sm_qrm').textContent})()`));
  console.log('qr set:', await ev(`(()=>{const i=document.getElementById('sm_qr');i.value='mekanizm.example/shop';i.oninput();return window.mkzSmart._test.qrText()+' | '+document.getElementById('sm_qrm').textContent})()`));
  const fr = await ev(`(()=>{window.mkzSmart.draw(31.2);return document.getElementById('sm_cv').toDataURL('image/png')})()`);
  if (typeof fr === 'string' && fr.startsWith('data:')) { require('fs').writeFileSync(require('path').join(process.argv[3] || '.', 'qr-end.png'), Buffer.from(fr.split(',')[1], 'base64')); console.log('qr frame saved'); } else console.log('qr frame:', fr);
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
