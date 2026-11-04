// اختبار شامل للمسار الحقيقي: رفع الفيديو بالـ input الحقيقي + ضغط «اعمل المونتاج» + رد سيرفر مزيّف (من غير ما نلمس Supabase)
// node tests/e2e.cjs <فولدر مطلق للصور> [رابط الستوديو] <فولدر الفيديوهات: tests>  — ممكن NOBR=1 لتجاهل فيديو الإدراج
const { spawn } = require('child_process');
const fs = require('fs');
const OUT = process.argv[2];
const URL_ = process.argv[3] || 'http://localhost:3204/';
const PORT = 9361;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + OUT + '/prof', '--window-size=480,900', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs;
  for (let i = 0; i < 90; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch (e) { } await sleep(500); }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(); const logs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.method==='Page.javascriptDialogOpening'){console.log('DIALOG:',d.params.type,d.params.message);ws.send(JSON.stringify({id:++id,method:'Page.handleJavaScriptDialog',params:{accept:true}}));return} if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } else if (d.method === 'Runtime.exceptionThrown') logs.push('EXC ' + JSON.stringify(d.params.exceptionDetails.exception && d.params.exceptionDetails.exception.description || d.params.exceptionDetails.text)); else if (d.method === 'Runtime.consoleAPICalled' && /error|warning/.test(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map(a => a.value || a.description).join(' ').slice(0, 200)) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async expr => { const to=new Promise(r=>setTimeout(()=>r('TIMEOUT'),25000)); return Promise.race([to, ev0(expr)]) }; const ev0 = async expr => { const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'ERR ' + JSON.stringify(r.result.exceptionDetails.exception && r.result.exceptionDetails.exception.description); return r.result.result.value };
  await send('Runtime.enable'); await send('Page.enable');
  // سيرفر مزيّف + دخول مزيّف قبل ما الصفحة تشتغل
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `
    (()=>{try{const b=s=>btoa(s).replace(/=/g,'').replace(/\\+/g,'-').replace(/\\//g,'_');const exp=Math.floor(Date.now()/1000)+86400;
      const jwt=b('{"alg":"HS256","typ":"JWT"}')+'.'+b(JSON.stringify({sub:'u1',aud:'authenticated',role:'authenticated',exp}))+'.sig';
      localStorage.setItem('mkz-mk-auth',JSON.stringify({access_token:jwt,token_type:'bearer',expires_in:86400,expires_at:exp,refresh_token:'r',user:{id:'u1',aud:'authenticated',role:'authenticated',email:'t@t.t',app_metadata:{},user_metadata:{},created_at:'2026-01-01T00:00:00Z'}}))}catch(e){}
     const of=window.fetch.bind(window);window.__calls=[];window.fetch=async(u,o)=>{const s=String(u&&u.url||u);
      if(s.includes('/functions/v1/video-ai')){window.__calls.push('ai');return new Response(JSON.stringify(window.__AI||{segments:[],events:[]}),{status:200,headers:{'content-type':'application/json'}})}
      if(s.includes('/functions/v1/video-scene')){window.__calls.push('scene');return new Response(JSON.stringify({scenes:[]}),{status:200,headers:{'content-type':'application/json'}})}
      return of(u,o)}})();` });
  await send('Page.navigate', { url: URL_ });
  await sleep(6000);
  console.log('rail', await ev(`document.querySelectorAll('#rail button').length`));
  console.log('open smart', await ev(`(()=>{const b=document.querySelector('#rail [data-go=smart]');b&&b.click();return !!b})()`));
  await sleep(1500);
  // فيديوهات اختبار حقيقية (صوت + صورة)
  const mk = `(async(sec,label,tone)=>{const cv=document.createElement('canvas');cv.width=480;cv.height=854;const x=cv.getContext('2d');const ac=new AudioContext();await ac.resume();const o=ac.createOscillator();o.frequency.value=tone;const g=ac.createGain();g.gain.value=.05;const d=ac.createMediaStreamDestination();o.connect(g);g.connect(d);o.start();const st=cv.captureStream(24);d.stream.getAudioTracks().forEach(t=>st.addTrack(t));
     const rec=new MediaRecorder(st,{mimeType:'video/webm;codecs=vp8,opus'});const ch=[];rec.ondataavailable=e=>e.data.size&&ch.push(e.data);const done=new Promise(r=>rec.onstop=r);rec.start(200);const t0=performance.now();
     await new Promise(res=>{const f=()=>{const t=(performance.now()-t0)/1000;x.fillStyle=label==='MAIN'?'#1f3354':'#7a1d1d';x.fillRect(0,0,480,854);if(label==='MAIN'){x.fillStyle='#f6a98a';x.beginPath();x.arc(240+Math.sin(t)*20,250,90,0,7);x.fill()}x.fillStyle='#fff';x.font='bold 60px sans-serif';x.textAlign='center';x.fillText(label,240,500);x.font='30px sans-serif';x.fillText(t.toFixed(1),240,560);if(t<sec)requestAnimationFrame(f);else res()};f()});
     rec.stop();await done;o.stop();return new File([new Blob(ch,{type:'video/webm'})],label+'.webm',{type:'video/webm'})})`;
  await send('DOM.enable');const doc=await send('DOM.getDocument',{depth:1});const q=async sel=>(await send('DOM.querySelector',{nodeId:doc.result.root.nodeId,selector:sel})).result.nodeId;
  const MEDIA=process.argv[4];await send('DOM.setFileInputFiles',{nodeId:await q('#sm_f'),files:[MEDIA+'/fixture-main.mp4']});await sleep(1200);if(!process.env.NOBR)await send('DOM.setFileInputFiles',{nodeId:await q('#sm_bf'),files:[MEDIA+'/fixture-broll.mp4']});console.log('picked real files');
  await sleep(2500);
  console.log('bi', await ev(`document.getElementById('sm_bi').textContent.trim()`));
  // كلام اختبار: نسخة بتحاكي كلامك + «صفر» بدل سفرة
  await ev(`window.__AI={title:'ميكانيزم السفرة',segments:[
    {s:0.4,e:3.4,t:'الميكانيزم ده بيوفر لك على الصفر اربع كراسي',cut:false,kw:['كراسي']},
    {s:3.9,e:7.2,t:'ولو جالك ضيوف زيادة تقدر تزود اتنين كرسي',cut:false,kw:[]},
    {s:7.8,e:10.8,t:'وبيتفتح من 60 لـ 120 سم',cut:false,kw:[]},
    {s:11.5,e:14.6,t:'وهيظهرلكم فيديو تحت دلوقتي',cut:false,kw:[]},{s:15.2,e:18.2,t:'وعليه ضمان عشر سنين',cut:false,kw:[]}],
    events:[{s:0.4,e:3.4,type:'anim',label:'سفرة',value:'',unit:'',scene:'table',action:'expand'}]}`);
  // الضغط الحقيقي على زرار المونتاج
  console.log('click go', await ev(`(()=>{const b=document.getElementById('sm_go');b.click();return b.textContent})()`));
  let st = '';
  for (let i = 0; i < 60; i++) { await sleep(2000); st = await ev(`document.getElementById('sm_pg')?document.getElementById('sm_pg').textContent:''`); if (i%5===0) console.log('  ..',i*2,'s:',st); if (/✔|❌/.test(st)) break; }
  console.log('progress:', st, JSON.stringify(logs.slice(0,6)));
  console.log('result visible', await ev(`document.getElementById('sm_res').style.display!=='none'`));
  console.log('calls', await ev(`JSON.stringify(__calls)`));
  console.log('state', await ev(`(()=>{const m=mkzSmart.state();return JSON.stringify({cap:m.CAP.map(c=>[+c.s.toFixed(1),+c.e.toFixed(1),c.w.join(' ')]),cnt:m.CNT.map(c=>({s:+c.s.toFixed(2),e:+c.e.toFixed(2),n:c.n,m:c.m,kind:c.kind,table:c.table})),fx2:m.FX2.map(f=>[f.k,+f.s.toFixed(2)]),fxl:m.FXL.map(f=>[f.kind,+f.s.toFixed(2)]),ev:m.EV.map(e=>[e.type,+e.s.toFixed(2),+e.e.toFixed(2)]),brl:document.getElementById('sm_bl')?document.getElementById('sm_bl').textContent.trim().slice(0,300):null})})()`));
  const shot = async (name, t) => {
    await ev(`(async()=>{const V=mkzSmart.state().V;if(V){V.currentTime=${t};await new Promise(r=>{V.onseeked=r;setTimeout(r,1500)})}for(let k=0;k<5;k++){mkzSmart.draw(${t});await new Promise(r=>setTimeout(r,250))}return 1})()`);
    const png = await ev(`document.getElementById('sm_cv').toDataURL('image/png')`);
    fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(png.split(',')[1], 'base64'));
  };
  const st2=JSON.parse(await ev('JSON.stringify({c:mkzSmart.state().CNT.map(c=>[c.s,c.e,c.xt,c.m,c.rg||0]),b:(mkzSmart.state().BRL||[]).map(b=>[b.s,b.e])})'));console.log('plan',JSON.stringify(st2));let n=0;for(const c of st2.c){await shot('cnt'+(++n)+'a',c[0]+1.0);await shot('cnt'+n+'b',c[1]-0.8)}n=0;for(const b of st2.b){await shot('br'+(++n),b[0]+1.2)}
  console.log('applied', await ev('document.getElementById("sm_ap").innerText'));
  console.log('buttons', await ev('JSON.stringify(["sm_go","sm_bg"].map(i=>[i,document.getElementById(i).className,document.getElementById(i).textContent.trim().slice(0,40)]))'));
  await ev('(()=>{const t=document.getElementById("pro-tip");t&&t.remove()})()');for(const [nm,id] of [['ap','sm_ap'],['btn','sm_go']]){await ev('document.getElementById("'+id+'").scrollIntoView({block:"center"})');await sleep(600);const r=await send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(OUT+'/'+nm+'.png',Buffer.from(r.result.data,'base64'))}
  console.log('errors', JSON.stringify(logs.filter(l => !/GoTrueClient/.test(l)).slice(0, 8)));
  ws.close(); chrome.kill(); process.exit(0);
})().catch(e => { console.error('FAIL', e); chrome.kill(); process.exit(1) });
