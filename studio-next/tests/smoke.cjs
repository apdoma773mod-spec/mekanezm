// اختبار دخان للمونتاج الذكي في كروم حقيقي (CDP): الإدراج + الموسيقى + اللوجو + الدليل
// التشغيل: node tests/smoke.cjs <فولدر مطلق للصور> [http://localhost:3204/] — محتاج Chrome وسيرفر الستوديو شغال
const { spawn } = require('child_process');
const fs = require('fs');
const OUT = process.argv[2];
const URL_ = process.argv[3] || 'http://localhost:3204/';
const PORT = 9347;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + OUT + '/prof', '--window-size=480,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs;
  for (let i = 0; i < 90; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch (e) { } await sleep(500); }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text)); else if (d.method === 'Runtime.consoleAPICalled' && /error|warning/.test(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result.result.value };
  await send('Runtime.enable'); await send('Page.enable');
  await send('Page.navigate', { url: URL_ });
  await sleep(6000);
  console.log('rail', await ev(`document.querySelectorAll('#rail button').length`));
  console.log('open smart', await ev(`(()=>{const b=document.querySelector('#rail [data-go=smart]');b&&b.click();return !!b})()`));
  await sleep(1500);
  console.log('has sm_bf', await ev(`!!document.getElementById('sm_bf')`));
  // فيديو اختبار: كانفاس متحرك بيتسجل
  const mk = `(async (label,col,secs)=>{const c=document.createElement('canvas');c.width=360;c.height=640;const x=c.getContext('2d');let t0=performance.now();const st=c.captureStream(15);const rec=new MediaRecorder(st,{mimeType:'video/webm'});const ch=[];rec.ondataavailable=e=>ch.push(e.data);rec.start();
    const iv=setInterval(()=>{const t=(performance.now()-t0)/1000;x.fillStyle=col;x.fillRect(0,0,360,640);x.fillStyle='#fff';x.font='bold 40px sans-serif';x.textAlign='center';x.fillText(label,180,320);x.beginPath();x.arc(180+Math.sin(t*3)*60,120,50,0,7);x.fillStyle='#ffd3a8';x.fill();x.fillStyle='#000';x.fillRect(100,420+Math.sin(t*4)*40,160,30)},60);
    await new Promise(r=>setTimeout(r,secs*1000));clearInterval(iv);rec.stop();await new Promise(r=>rec.onstop=r);return new File([new Blob(ch,{type:'video/webm'})],label+'.webm',{type:'video/webm'})})`;
  console.log('gen', await ev(`(async()=>{window.__mainF=await ${mk}('MAIN','#1d3a5f',10);window.__brF=await ${mk}('BROLL','#8a1c1c',4);return [__mainF.size,__brF.size]})()`));
  // رفع فيديو الإدراج عبر الواجهة
  console.log('upload broll', await ev(`(()=>{const i=document.getElementById('sm_bf');i.onchange({target:{files:[window.__brF],value:''}});return 'ok'})()`));
  await sleep(1500);
  console.log('bi', await ev(`document.getElementById('sm_bi').textContent.trim()`));
  // فيديو أساسي + بيانات
  console.log('setup', await ev(`(async()=>{const T=mkzSmart._test,v=document.createElement('video');v.muted=true;v.playsInline=true;v.src=URL.createObjectURL(__mainF);await new Promise(r=>{v.onloadedmetadata=r});T.setV(v);window.__V=v;
    T.setD({title:'اختبار الإدراج',dur:10,vad:[],ch:[[0,6]],seg:[{s:0.3,e:2.2,t:'النهارده هنتكلم عن المجرى الاسباني',cut:false,kw:['المجرى']},{s:2.4,e:4.4,t:'هيظهرلكم فيديو تحت دلوقتي',cut:false,kw:[]},{s:5.5,e:7.5,t:'وبيشيل وزن كبير جدا وعليه ضمان',cut:false,kw:[]}],ev:[],people:[{t:0.3,x0:.36,x1:.64,y0:.08,y1:.28},{t:3,x0:.36,x1:.64,y0:.08,y1:.28},{t:5.5,x0:.36,x1:.64,y0:.08,y1:.28}]});
    T.setS({intro:false,outro:false,smart:true,aspect:'916'});T.setup();T.build();return JSON.stringify(mkzSmart.state().CAP.map(c=>[c.s.toFixed(2),c.w.join(' ')]))})()`));
  console.log('BRL text', await ev(`document.getElementById('sm_bl')?document.getElementById('sm_bl').textContent.trim().slice(0,200):'no sm_bl'`));
  for (const [name, tt] of [['kw', 1.75], ['kw2', 5.9], ['late', 7.9]]) {
    const r = await ev(`(async()=>{const v=mkzSmart.state?0:0;const cv=document.getElementById('sm_cv');const V=document.querySelector('video');return 1})()`);
    console.log('seek', name, await ev(`(async()=>{const T=mkzSmart._test;const vs=[...document.querySelectorAll('video')];return vs.length})()`));
    await ev(`(async()=>{__V.currentTime=${tt};await new Promise(r=>{__V.onseeked=r;setTimeout(r,1500)});for(let k=0;k<4;k++){mkzSmart.draw(${tt});await new Promise(r=>setTimeout(r,400))}return 1})()`);
    const png = await ev(`document.getElementById('sm_cv').toDataURL('image/png')`);
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  }
  // موسيقى: WAV صغير بيتعمل جوه الصفحة
  console.log('music', await ev(`(async()=>{const sr=22050,n=sr*3,b=new ArrayBuffer(44+n*2),d=new DataView(b),w=(o,t)=>[...t].forEach((c,i)=>d.setUint8(o+i,c.charCodeAt(0)));w(0,'RIFF');d.setUint32(4,36+n*2,true);w(8,'WAVEfmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,sr,true);d.setUint32(28,sr*2,true);d.setUint16(32,2,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*2,true);for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.sin(i/sr*2*Math.PI*440)*8000,true);
    const f=new File([b],'music.wav',{type:'audio/wav'});document.getElementById('sm_mf').onchange({target:{files:[f]}});await new Promise(r=>setTimeout(r,2000));return document.getElementById('sm_mi').textContent.trim()})()`));
  // لوجو: صورة بتتعمل جوه الصفحة
  console.log('logo', await ev(`(async()=>{const c=document.createElement('canvas');c.width=300;c.height=150;const x=c.getContext('2d');x.fillStyle='#D4A537';x.fillRect(0,0,300,150);x.fillStyle='#000';x.font='bold 60px sans-serif';x.fillText('LOGO',40,100);const bl=await new Promise(r=>c.toBlob(r));document.getElementById('sm_lg').onchange({target:{files:[new File([bl],'logo.png',{type:'image/png'})]}});await new Promise(r=>setTimeout(r,1500));mkzSmart.draw(1.75);return document.getElementById('sm_lgi').textContent.trim()})()`));
  { const png = await ev(`document.getElementById('sm_cv').toDataURL('image/png')`); fs.writeFileSync(`${OUT}/logo.png`, Buffer.from(png.split(',')[1], 'base64')); }
  console.log('ui', await ev(`JSON.stringify(['sm_mf','sm_lg','sm_mv','sm_bf','pro-help','pro-fab'].map(i=>[i,!!document.getElementById(i)]))`));
  console.log('guide', await ev(`(()=>{mkzGuide();const t=document.getElementById('pro-tip');const ok=!!t&&t.textContent.includes('إنجازاتك');t&&t.remove();return ok})()`));
  const exc = logs.filter(l => l.startsWith('EXC'));
  console.log('errors', JSON.stringify(logs.slice(0, 8)));
  if (exc.length) { console.error('FAIL exceptions'); ws.close(); chrome.kill(); process.exit(1); }
  ws.close(); chrome.kill();
  process.exit(0);
})().catch(e => { console.error('FAIL', e); chrome.kill(); process.exit(1) });
