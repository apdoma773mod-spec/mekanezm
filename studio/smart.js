/* ===== 🎬 مونتاج ذكي — فيديو خام من الموبايل → ترجمة كلامك + توضيح المقاسات والأصناف والأسعار + قالب مونتاج → MP4 جاهز للنشر
   ١) الصوت بيتسحب من الفيديو جوه الموبايل (١٦ كيلو مونو) ويتقسم أجزاء ٤٠ ثانية → دالة video-ai على سيرفر ميكانيزم (Gemini) → كلام بتوقيته + أحداث
   ٢) المعاينة والتصدير على canvas: الفيديو + الترجمة + الكروت، والتصدير بـ MediaRecorder (نفس المدة الحقيقية للفيديو)
   الدخول بحساب ميكانيزم (مرة واحدة) عشان المفتاح يفضل على السيرفر ومحدش غيرك يستخدمه. ===== */
(function(){
'use strict';
const MK_URL='https://tkzfjeizvanfptnqvrmr.supabase.co',MK_KEY='sb_publishable_8QP_KfvoYOyF_bZC4-fw1w_qCkfEpvZ';
const $s=id=>document.getElementById(id);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const en=t=>String(t==null?'':t).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const ar=t=>String(t==null?'':t).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const fmt=s=>{s=Math.max(0,s||0);const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+String(x).padStart(2,'0')};
/* بيانات الستوديو (المنتجات والهوية) جوه مخزن __KV — الكود الأساسي محطوط جوه __ready فمتغيراته مش ظاهرة هنا */
const kv=(k,d)=>{try{const v=window.__KV&&window.__KV.get(k);return v==null?d:(JSON.parse(v)??d)}catch(e){return d}};
const prods=()=>{const L=kv('prods',[]);return Array.isArray(L)?L:[]};
const brand=()=>Object.assign({shop:'ميكانيزم',cta:'اطلب دلوقتي',addr:'أرض اللواء - الجيزة',phone:''},kv('brand',{}));

/* ---------- الدخول بحساب ميكانيزم ---------- */
let SBK=null;
function sbk(){if(SBK)return SBK;if(!window.supabase||!supabase.createClient)return null;SBK=supabase.createClient(MK_URL,MK_KEY,{auth:{storageKey:'mkz-mk-auth',persistSession:true,autoRefreshToken:true}});return SBK}
async function token(){const c=sbk();if(!c)throw new Error('مكتبة الدخول مااتحملتش — اتأكد من النت');
 let {data}=await c.auth.getSession();if(data&&data.session)return data.session.access_token;
 /* لو ميكانيزم مفتوح على نفس الموبايل (Safari) نستخدم نفس الدخول */
 try{const o=JSON.parse(localStorage.getItem('sb-tkzfjeizvanfptnqvrmr-auth-token')||'null');if(o&&o.refresh_token){const r=await c.auth.setSession({access_token:o.access_token,refresh_token:o.refresh_token});if(r.data&&r.data.session)return r.data.session.access_token}}catch(e){}
 return null}
function loginBox(){return `<div class="p" id="sm_login"><h2>🔐 دخول بحساب ميكانيزم (مرة واحدة)</h2><p class="mu">نفس الإيميل والباسورد اللي بتدخل بيهم سيستم ميكانيزم — عشان الذكاء يشتغل باسمك وماحدش غيرك يستخدمه.</p>
 <div class="r2"><label>الإيميل<input id="sm_em" type="email" autocomplete="username" dir="ltr"></label><label>الباسورد<input id="sm_pw" type="password" autocomplete="current-password" dir="ltr"></label></div>
 <button class="b" id="sm_li" style="width:100%;margin-top:8px">دخول</button></div>`}
async function doLogin(){const b=$s('sm_li');b.disabled=true;b.textContent='جاري الدخول...';
 try{const r=await sbk().auth.signInWithPassword({email:$s('sm_em').value.trim(),password:$s('sm_pw').value});if(r.error)throw r.error;say('✔ اتسجل الدخول');paint()}
 catch(e){b.disabled=false;b.textContent='دخول';say('❌ '+(/Invalid login/i.test(e.message||'')?'الإيميل أو الباسورد غلط':(e.message||e)))}}

/* ---------- الحالة ---------- */
const FONTS=[['Cairo','القاهرة'],['Tajawal','تجوال'],['Almarai','المراعي'],['Changa','شانجا'],['Lalezar','لاله زار'],['El Messiri','المسيري'],['Reem Kufi','ريم كوفي'],['Marhey','مرحي']];
const TPL={
 tech:{n:'🛠️ شرح فني',d:'ترجمة تحت في بوكس + كروت المقاسات والأصناف + زووم خفيف + شيل السكتات',cap:'box',pos:.80,words:6,zoom:.06,cut:true,ov:true},
 fast:{n:'⚡ تيك توك سريع',d:'كلام كبير في النص كلمة كلمة + زووم مع كل جملة + شيل السكتات',cap:'karaoke',pos:.62,words:3,zoom:.09,cut:true,ov:true},
 calm:{n:'✨ هادي وأنيق',d:'ترجمة صغيرة تحت + كروت هادية من غير زووم ولا قص',cap:'lower',pos:.86,words:7,zoom:0,cut:false,ov:true},
 clean:{n:'📐 توضيحات بس',d:'من غير ترجمة — المقاسات والأصناف والأسعار بس',cap:'none',pos:.8,words:6,zoom:.05,cut:false,ov:true}};
const COLORS=[['#F6DC8A','ذهبي'],['#FFFFFF','أبيض'],['#FFE600','أصفر'],['#35E0A0','أخضر'],['#4FC3FF','أزرق']];
let S=Object.assign({tpl:'tech',font:'Cairo',size:1,color:'#F6DC8A',aspect:'916',q:1080,intro:true,outro:true},(()=>{try{return JSON.parse(localStorage.getItem('mkz-smart')||'{}')}catch(e){return {}}})());
const saveS=()=>{try{localStorage.setItem('mkz-smart',JSON.stringify(S))}catch(e){}};
let F=null,V=null,D=null,CAP=[],EV=[],GAPS=[],busy=false,raf=0,REC=null;   // F: الملف، V: عنصر الفيديو، D: نتيجة الذكاء

/* ---------- ١) الصوت: سحب + تقسيم ---------- */
async function pcmFromFile(file,prog){
 const AC=window.AudioContext||window.webkitAudioContext;
 if(file.size<=140e6){try{
  prog('🎧 بسحب الصوت من الفيديو…');const buf=await file.arrayBuffer(),ac=new AC();
  const ab=await new Promise((ok,no)=>{const p=ac.decodeAudioData(buf,ok,no);if(p&&p.then)p.then(ok,no)});ac.close&&ac.close();
  const off=new OfflineAudioContext(1,Math.ceil(ab.duration*16000),16000),src=off.createBufferSource();src.buffer=ab;src.connect(off.destination);src.start();
  const r=await off.startRendering();return r.getChannelData(0)}catch(e){console.warn('decode',e)}}
 /* فيديو كبير أو الصيغة مش بتتفك: نسمعه وهو شغال (بياخد نفس مدة الفيديو) */
 return await new Promise((ok,no)=>{const v=document.createElement('video');v.src=URL.createObjectURL(file);v.playsInline=true;v.muted=false;
  const ac=new AC(),src=ac.createMediaElementSource(v),sp=ac.createScriptProcessor(4096,1,1),parts=[],g=ac.createGain();g.gain.value=0;
  src.connect(sp);sp.connect(g);g.connect(ac.destination);const rate=ac.sampleRate;
  sp.onaudioprocess=e=>{parts.push(new Float32Array(e.inputBuffer.getChannelData(0)));prog('🎧 بسمع الفيديو… '+fmt(v.currentTime)+' من '+fmt(v.duration))};
  v.onended=()=>{sp.disconnect();ac.close&&ac.close();let n=parts.reduce((a,p)=>a+p.length,0),all=new Float32Array(n),o=0;parts.forEach(p=>{all.set(p,o);o+=p.length});
   const k=rate/16000,out=new Float32Array(Math.floor(n/k));for(let i=0;i<out.length;i++)out[i]=all[Math.floor(i*k)];URL.revokeObjectURL(v.src);ok(out)};
  v.onerror=()=>no(new Error('الفيديو مش بيشتغل على الموبايل ده'));ac.resume().then(()=>v.play()).catch(no)})}
function wav64(f32){const n=f32.length,b=new ArrayBuffer(44+n*2),d=new DataView(b);const w=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');d.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,16000,true);d.setUint32(28,32000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*2,true);
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(f32[i]));const g=peak>0.001?Math.min(8,0.9/peak):1;   // تعلية الصوت الواطي
 for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.max(-1,Math.min(1,f32[i]*g))*32767,true);
 let s='',u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
/* تقسيم على أماكن السكوت عشان مانقطعش كلمة في النص */
function splitPoints(f32,len){const R=16000,out=[0];let at=0;while(at+len*R<f32.length){let tgt=at+len*R,best=tgt,bv=1e9;for(let i=tgt-4*R;i<tgt+2*R&&i<f32.length;i+=800){let e=0;for(let j=i;j<i+800&&j<f32.length;j++)e+=Math.abs(f32[j]);if(e<bv){bv=e;best=i}}at=best;out.push(at)}out.push(f32.length);return out}
async function callAI(b64,offset,first,tok){
 const r=await fetch(MK_URL+'/functions/v1/video-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:MK_KEY},body:JSON.stringify({audio:b64,mime:'audio/wav',offset,first,products:prods().map(p=>p.nm).filter(Boolean)})});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j}
async function analyze(prog){
 const tok=await token();if(!tok)throw new Error('LOGIN');
 const f32=await pcmFromFile(F,prog),pts=splitPoints(f32,40),jobs=[];
 for(let i=0;i<pts.length-1;i++)jobs.push({i,a:pts[i],b:pts[i+1]});
 const res=new Array(jobs.length);let done=0;
 const run=async j=>{for(let k=0;;k++){try{res[j.i]=await callAI(wav64(f32.subarray(j.a,j.b)),j.a/16000,j.i===0,tok);break}catch(e){if(k>=2||/LOGIN|دخول/.test(e.message))throw e;await new Promise(r=>setTimeout(r,2500*(k+1)))}}done++;prog('🧠 بفهم الكلام… '+done+' من '+jobs.length)};
 prog('🧠 بفهم الكلام… 0 من '+jobs.length);
 for(let i=0;i<jobs.length;i+=3)await Promise.all(jobs.slice(i,i+3).map(run));
 let seg=[],ev=[],title='';
 res.forEach((r,i)=>{const off=jobs[i].a/16000;if(i===0)title=r.title||'';(r.segments||[]).forEach(x=>{if(String(x.t||'').trim())seg.push({s:off+(+x.s||0),e:off+(+x.e||+x.s+1),t:String(x.t).trim()})});
  (r.events||[]).forEach(x=>{if(String(x.label||'').trim())ev.push({s:off+(+x.s||0),e:off+(+x.e||0),type:String(x.type||'point'),label:String(x.label).trim(),value:en(x.value||''),unit:String(x.unit||''),on:true})})});
 seg.sort((a,b)=>a.s-b.s);ev.sort((a,b)=>a.s-b.s);
 return {title,seg,ev,dur:f32.length/16000}}

/* ---------- ٢) تجهيز الترجمة والقص ---------- */
function build(){const T=TPL[S.tpl];CAP=[];
 (D.seg||[]).forEach(g=>{const w=g.t.split(/\s+/).filter(Boolean),n=Math.max(1,Math.ceil(w.length/T.words)),per=Math.ceil(w.length/n),dur=Math.max(.4,g.e-g.s);
  for(let i=0;i<n;i++){const ws=w.slice(i*per,(i+1)*per);if(!ws.length)continue;const a=g.s+dur*(i*per)/w.length,b=g.s+dur*Math.min(w.length,(i+1)*per)/w.length;CAP.push({s:a,e:b,w:ws})}});
 EV=(D.ev||[]).map(x=>Object.assign(x,{e:Math.max(x.e||0,x.s+(x.type==='product'?3:2.4))}));
 /* السكتات: أي فاصل أكتر من ٠٫٩ ثانية بين الكلام (مع ترك ٠٫٢ قبل وبعد) */
 GAPS=[];if(T.cut&&D.seg.length){let prev=0;D.seg.forEach(g=>{if(g.s-prev>0.9)GAPS.push([prev+0.2,g.s-0.2]);prev=Math.max(prev,g.e)});const end=(V&&V.duration)||D.dur;if(end-prev>1.2)GAPS.push([prev+0.3,end])}}
const inGap=t=>GAPS.find(g=>t>=g[0]&&t<g[1]);
const prodImg={};function findProd(label){const L=prods(),q=String(label||'').replace(/\s+/g,'');let best=null,bs=0;
 L.forEach(p=>{const n=String(p.nm||'').replace(/\s+/g,'');if(!n)return;let s=0;if(n.includes(q)||q.includes(n))s=Math.min(n.length,q.length)/Math.max(n.length,q.length)+.5;else{let c=0;for(const ch of new Set(q))if(n.includes(ch))c++;s=c/Math.max(q.length,1)*.6}if(s>bs){bs=s;best=p}});
 if(!best||bs<.55)return null;if(best.img&&!prodImg[best.id]){const im=new Image();im.src=best.img;prodImg[best.id]=im}return best}

/* ---------- ٣) الرسم ---------- */
let CV=null,CX=null;
function dims(){const vw=(V&&V.videoWidth)||1080,vh=(V&&V.videoHeight)||1920;if(S.aspect==='orig'){const k=S.q/Math.min(vw,vh);return [Math.round(vw*k/2)*2,Math.round(vh*k/2)*2]}return [S.q,Math.round(S.q*16/9/2)*2]}
function rr(x,y,w,h,r){CX.beginPath();CX.moveTo(x+r,y);CX.arcTo(x+w,y,x+w,y+h,r);CX.arcTo(x+w,y+h,x,y+h,r);CX.arcTo(x,y+h,x,y,r);CX.arcTo(x,y,x+w,y,r);CX.closePath()}
const ease=t=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);
function wrapLines(words,maxW){const L=[];let cur=[];words.forEach(w=>{const t=cur.concat(w).join(' ');if(CX.measureText(t).width>maxW&&cur.length){L.push(cur);cur=[w]}else cur.push(w)});if(cur.length)L.push(cur);return L}
function draw(t){const [W,H]=[CV.width,CV.height],T=TPL[S.tpl];CX.setTransform(1,0,0,1,0,0);CX.fillStyle='#000';CX.fillRect(0,0,W,H);
 if(!V||!V.videoWidth)return;
 /* زووم خفيف وقت الكروت/الجمل */
 let z=1;if(T.zoom){const e=EV.find(x=>x.on&&t>=x.s&&t<x.e&&(x.type==='measure'||x.type==='product'));const c=T.cap==='karaoke'?CAP.find(x=>t>=x.s&&t<x.e):null;
  if(e)z+=T.zoom*ease((t-e.s)/.35)*(1-ease((t-e.e+.35)/.35));else if(c)z+=T.zoom*.5*(1-ease((t-c.s)/.5))}
 const vw=V.videoWidth,vh=V.videoHeight,k=Math.max(W/vw,H/vh)*z,dw=vw*k,dh=vh*k;
 if(S.aspect!=='orig'&&vw>vh){/* فيديو عرضي في ٩:١٦: خلفية مكبّرة غامقة + الفيديو كامل في النص */const kb=Math.max(W/vw,H/vh)*1.1;CX.globalAlpha=.35;CX.drawImage(V,(W-vw*kb)/2,(H-vh*kb)/2,vw*kb,vh*kb);CX.globalAlpha=1;const kf=W/vw*z;CX.drawImage(V,(W-vw*kf)/2,(H-vh*kf)/2,vw*kf,vh*kf)}
 else CX.drawImage(V,(W-dw)/2,(H-dh)/2,dw,dh);
 const u=W/1080,F=`"${S.font}",Cairo,sans-serif`,acc=S.color;CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 const dur=V.duration||D.dur||0,br=brand();
 /* مقدمة */
 if(S.intro&&D.title&&t<2.4){const a=1-ease((t-1.9)/.5);CX.globalAlpha=Math.max(0,a);CX.fillStyle='rgba(0,0,0,.45)';CX.fillRect(0,0,W,H);
  CX.font=`900 ${Math.round(86*u*S.size)}px ${F}`;const L=wrapLines(D.title.split(/\s+/),W*.84);L.forEach((l,i)=>{const y=H*(T.pos<.7?.30:.42)+(i-(L.length-1)/2)*100*u*S.size;CX.lineWidth=10*u;CX.strokeStyle='rgba(0,0,0,.7)';CX.strokeText(l.join(' '),W/2,y);CX.fillStyle='#fff';CX.fillText(l.join(' '),W/2,y)});
  const ty=H*(T.pos<.7?.30:.42);CX.fillStyle=acc;CX.fillRect(W*.35,ty+L.length*58*u*S.size,W*.3*ease(t/.6),8*u);CX.font=`700 ${Math.round(40*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,ty+L.length*58*u*S.size+50*u);CX.globalAlpha=1}
 /* الكروت */
 if(T.ov){let slot=0;EV.forEach(e=>{if(!e.on||t<e.s||t>e.e)return;const a=ease((t-e.s)/.3),out=1-ease((t-e.e+.3)/.3),al=Math.min(a,out);if(al<=0)return;CX.globalAlpha=al;const y=H*.13+slot*230*u,sc=.85+.15*a;
  CX.save();CX.translate(W/2,y);CX.scale(sc,sc);
  if(e.type==='measure'){const val=(e.value||'')+' '+(e.unit||''),lab=e.label||'';CX.font=`900 ${Math.round(110*u)}px ${F}`;const vwid=CX.measureText(ar(val)).width;CX.font=`700 ${Math.round(38*u)}px ${F}`;const lw=CX.measureText(lab).width,bw=Math.max(vwid,lw)+120*u;
   const hasL=lab&&lab.replace(/\s/g,'')!==val.replace(/\s/g,'');rr(-bw/2,(hasL?-125:-95)*u,bw,(hasL?245:190)*u,28*u);CX.fillStyle='rgba(10,10,12,.82)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   /* مسطرة بتتمد */const rw=(bw-80*u)*ease((t-e.s)/.6);const ry=(hasL?80:52)*u;CX.fillStyle=acc;CX.fillRect(-rw/2,ry,rw,8*u);for(let i=0;i<=10;i++){const x=-rw/2+rw*i/10;CX.fillRect(x-1.5*u,ry-(i%5?8:16)*u,3*u,(i%5?16:24)*u)}
   CX.fillStyle=acc;CX.font=`900 ${Math.round(110*u)}px ${F}`;CX.fillText(ar(val),0,-14*u);if(hasL){CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText(lab,0,-90*u)}}
  else if(e.type==='product'){const p=findProd(e.label),im=p&&prodImg[p.id],has=im&&im.complete&&im.naturalWidth;CX.font=`800 ${Math.round(46*u)}px ${F}`;const nm=p?p.nm:e.label,tw=CX.measureText(nm).width,bw=Math.min(W*.9,tw+(has?250:110)*u),bh=has?210*u:120*u;
   rr(-bw/2,-bh/2,bw,bh,26*u);CX.fillStyle='rgba(255,255,255,.95)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   if(has){const s=170*u,r=Math.min(s/im.naturalWidth,s/im.naturalHeight);CX.drawImage(im,bw/2-20*u-s+(s-im.naturalWidth*r)/2,-s/2+(s-im.naturalHeight*r)/2,im.naturalWidth*r,im.naturalHeight*r)}
   CX.fillStyle='#111';CX.textAlign='center';CX.fillText(nm,has?-85*u:0,p&&p.pr?-18*u:0);if(p&&p.pr){CX.font=`700 ${Math.round(34*u)}px ${F}`;CX.fillStyle='#8F6A1E';CX.fillText(ar(p.pr)+' جنيه',has?-85*u:0,32*u)}}
  else if(e.type==='price'){const txt=ar((e.value||e.label)+' '+(e.unit||'جنيه'));CX.font=`900 ${Math.round(80*u)}px ${F}`;const bw=CX.measureText(txt).width+110*u;rr(-bw/2,-70*u,bw,140*u,70*u);CX.fillStyle=acc;CX.fill();CX.fillStyle='#111';CX.fillText(txt,0,4*u)}
  else{CX.font=`800 ${Math.round(48*u)}px ${F}`;const txt='✔ '+e.label,bw=Math.min(W*.92,CX.measureText(txt).width+90*u);rr(-bw/2,-55*u,bw,110*u,55*u);CX.fillStyle='rgba(10,10,12,.85)';CX.fill();CX.lineWidth=4*u;CX.strokeStyle=acc;CX.stroke();CX.fillStyle='#fff';CX.fillText(txt,0,3*u)}
  CX.restore();CX.globalAlpha=1;slot++})}
 /* الترجمة */
 const inOut=S.outro&&dur&&t>dur-2.2,c=T.cap!=='none'&&!inOut?CAP.find(x=>t>=x.s&&t<x.e+.08):null;
 if(c){const big=T.cap==='karaoke',sz=Math.round((big?92:T.cap==='lower'?46:58)*u*S.size);CX.font=`900 ${sz}px ${F}`;const L=wrapLines(c.w,W*.86),lh=sz*1.32,y0=H*T.pos-(L.length-1)*lh/2,a=ease((t-c.s)/.15);
  const nWord=Math.min(c.w.length-1,Math.floor((t-c.s)/((c.e-c.s)/c.w.length)));let wi=0;
  L.forEach((ln,li)=>{const y=y0+li*lh,txt=ln.join(' '),tw=CX.measureText(txt).width;
   if(T.cap==='box'||T.cap==='lower'){CX.globalAlpha=T.cap==='lower'?a:1;rr(W/2-tw/2-28*u,y-lh/2+4*u,tw+56*u,lh-4*u,16*u);CX.fillStyle=T.cap==='lower'?'rgba(0,0,0,.5)':'rgba(0,0,0,.72)';CX.fill();CX.fillStyle='#fff';CX.fillText(txt,W/2,y+2*u);CX.globalAlpha=1;wi+=ln.length;return}
   /* كلمة كلمة (يمين لشمال) */let x=W/2+tw/2;const sp=CX.measureText(' ').width;const sc=.92+.08*a;
   ln.forEach(w=>{const ww=CX.measureText(w).width,cx=x-ww/2;CX.save();CX.translate(cx,y);const cur=wi===nWord;CX.scale(cur?sc*1.06:sc,cur?sc*1.06:sc);CX.lineWidth=14*u;CX.lineJoin='round';CX.strokeStyle='rgba(0,0,0,.85)';CX.strokeText(w,0,0);CX.fillStyle=cur?acc:'#fff';CX.fillText(w,0,0);CX.restore();x-=ww+sp;wi++})})}
 /* الخاتمة */
 if(S.outro&&dur&&t>dur-2.2){const a=ease((t-(dur-2.2))/.4);CX.globalAlpha=a;rr(W*.08,H*.70,W*.84,250*u,30*u);CX.fillStyle='rgba(10,10,12,.88)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
  CX.fillStyle=acc;CX.font=`900 ${Math.round(64*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,H*.70+70*u);CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText([br.cta||'اطلب دلوقتي',br.phone?ar(br.phone):''].filter(Boolean).join(' • '),W/2,H*.70+140*u);if(br.addr){CX.font=`600 ${Math.round(32*u)}px ${F}`;CX.fillText(br.addr,W/2,H*.70+195*u)}CX.globalAlpha=1}}

/* ---------- ٤) المعاينة ---------- */
function loop(){cancelAnimationFrame(raf);const f=()=>{if(!V)return;const g=!V.paused&&inGap(V.currentTime);if(g&&!REC){V.currentTime=g[1]}draw(V.currentTime);updBar();raf=requestAnimationFrame(f)};raf=requestAnimationFrame(f)}
function updBar(){const s=$s('sm_seek');if(s&&V&&V.duration&&!s._drag){s.value=V.currentTime/V.duration*1000}const l=$s('sm_tm');if(l&&V)l.textContent=fmt(V.currentTime)+' / '+fmt(V.duration)}
function setupCanvas(){CV=$s('sm_cv');if(!CV)return;const [w,h]=dims();CV.width=w;CV.height=h;CX=CV.getContext('2d');draw(V?V.currentTime:0)}

/* ---------- ٥) التصدير ---------- */
async function exportVid(){if(busy)return;if(typeof MediaRecorder==='undefined'||!CV.captureStream)return say('المتصفح ده مش بيدعم التصدير — حدّث iOS');
 const mt=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mt)return say('التصدير مش مدعوم على الموبايل ده');
 busy=true;const btn=$s('sm_ex');btn.disabled=true;
 try{setupCanvas();V.pause();V.currentTime=0;await new Promise(r=>{V.onseeked=()=>{V.onseeked=null;r()};setTimeout(r,800)});
  const AC=window.AudioContext||window.webkitAudioContext;if(!V._ac){V._ac=new AC();V._src=V._ac.createMediaElementSource(V);V._dst=V._ac.createMediaStreamDestination();V._src.connect(V._dst);V._src.connect(V._ac.destination)}
  await V._ac.resume();const st=CV.captureStream(30);V._dst.stream.getAudioTracks().forEach(tr=>st.addTrack(tr));
  const ch=[];REC=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:S.q>=1080?8e6:5e6,audioBitsPerSecond:128000});REC.ondataavailable=e=>e.data&&e.data.size&&ch.push(e.data);
  const total=Math.max(1,(V.duration||1)-GAPS.reduce((a,g)=>a+(g[1]-g[0]),0));let rendered=0,lastT=0;
  const stop=new Promise(r=>REC.onstop=r);V.muted=false;REC.start(500);await V.play();
  await new Promise(res=>{const tick=()=>{if(!REC)return res();const t=V.currentTime;if(t>lastT)rendered+=t-lastT;lastT=t;
    const g=inGap(t);if(g&&!V.seeking){try{REC.pause()}catch(e){}V.currentTime=g[1];lastT=g[1];V.onseeked=()=>{V.onseeked=null;try{REC.resume()}catch(e){}}}
    btn.textContent='⏺️ بسجّل الفيديو… '+Math.min(99,Math.round(rendered/total*100))+'%';if(V.ended||t>=V.duration-0.05)return res();setTimeout(tick,120)};V.onended=()=>res();tick()});
  REC.stop();await stop;V.pause();const blob=new Blob(ch,{type:mt.split(';')[0]}),ext=/mp4/.test(mt)?'mp4':'webm',name='ميكانيزم-'+new Date().toISOString().slice(0,10)+'.'+ext,file=new File([blob],name,{type:blob.type});
  REC=null;btn.textContent='💾 صدّر الفيديو';btn.disabled=false;busy=false;
  const out=$s('sm_out');out.innerHTML=`<div class="p"><h2>✅ الفيديو جاهز (${(blob.size/1048576).toFixed(1)} ميجا)</h2><video src="${URL.createObjectURL(blob)}" controls playsinline style="width:100%;max-height:60vh;border-radius:12px;background:#000"></video>
   <button class="b" id="sm_sh" style="width:100%;margin-top:8px">📤 شارك / احفظ في الصور</button><a class="b o" style="width:100%" download="${esc(name)}" href="${URL.createObjectURL(blob)}">⬇️ تنزيل الملف</a>
   <p class="mu">من «شارك» تقدر تحفظه في الصور أو تبعته على طول لتيك توك وإنستجرام وفيسبوك.${ext!=='mp4'?' (الصيغة WebM — لو المنصة رفضته نزّله واستخدم تحويل)':''}</p></div>`;
  $s('sm_sh').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:D.title||'ميكانيزم'});else say('المشاركة مش متاحة — استخدم «تنزيل الملف»')}catch(e){}};
  out.scrollIntoView({behavior:'smooth'})}
 catch(e){REC=null;busy=false;btn.disabled=false;btn.textContent='💾 صدّر الفيديو';say('❌ التصدير وقف: '+(e.message||e))}}

/* ---------- الشاشة ---------- */
function paint(){const el=$s('v-smart');if(!el)return;
 el.innerHTML=`<h1>🎬 مونتاج ذكي</h1><p class="mu">ارفع الفيديو اللي صورته — السيستم بيسمع كلامك ويكتبه على الفيديو، ويظهر المقاسات والأمتار والأصناف والأسعار وقت ما تقولها، بالقالب اللي تختاره. وبعدين «صدّر» وشارك على كل المنصات.</p>
 <div id="sm_auth"></div>
 <div class="p"><h2>١) الفيديو</h2><label class="b" style="width:100%;cursor:pointer">📹 اختار الفيديو<input type="file" id="sm_f" accept="video/*" style="display:none"></label><div id="sm_fi" class="mu"></div></div>
 <div class="p"><h2>٢) طريقة المونتاج</h2><div id="sm_tp" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
  <div class="r2" style="margin-top:10px"><label>الخط<select id="sm_ft">${FONTS.map(f=>`<option value="${f[0]}" ${S.font===f[0]?'selected':''} style="font-family:'${f[0]}'">${f[1]}</option>`).join('')}</select></label>
  <label>لون التمييز<select id="sm_cl">${COLORS.map(c=>`<option value="${c[0]}" ${S.color===c[0]?'selected':''}>${c[1]}</option>`).join('')}</select></label>
  <label>حجم الكلام<input type="range" id="sm_sz" min="0.7" max="1.5" step="0.05" value="${S.size}"></label>
  <label>المقاس<select id="sm_as"><option value="916" ${S.aspect==='916'?'selected':''}>طولي ٩:١٦ (تيك توك/ريلز)</option><option value="orig" ${S.aspect==='orig'?'selected':''}>زي الفيديو الأصلي</option></select></label>
  <label>الجودة<select id="sm_q"><option value="1080" ${S.q==1080?'selected':''}>عالية 1080</option><option value="720" ${S.q==720?'selected':''}>متوسطة 720 (أسرع وأخف)</option></select></label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_in" ${S.intro?'checked':''}> عنوان في الأول</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_ou" ${S.outro?'checked':''}> اسم المحل وتليفونه في الآخر</label></div></div>
 <button class="b" id="sm_cl" style="width:100%;min-height:56px;font-size:18px">☁️ اعمله في الخلفية (تقفل الموبايل وهو شغال)</button>
 <p class="mu" style="margin:4px 0 10px">بيرفع الفيديو، وبعدها السيرفر هو اللي بيسمع ويعمل المونتاج ويطلّعه جاهز — تلاقيه تحت في «فيديوهاتي». بياخد من دقيقتين لـ ١٥ دقيقة على حسب طول الفيديو.</p>
 <button class="b o" id="sm_go" style="width:100%;min-height:50px">✨ أو اعمله هنا على الموبايل (مع معاينة وتعديل)</button><div id="sm_pg" class="mu" style="text-align:center;margin:6px 0"></div>
 <div id="sm_res" style="display:none"><div class="p"><h2>٣) المعاينة</h2><canvas id="sm_cv" style="width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:12px;display:block"></canvas>
  <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="b" id="sm_pl" style="flex:none;min-width:64px">▶️</button><input type="range" id="sm_seek" min="0" max="1000" value="0" style="flex:1"><span id="sm_tm" class="mu" style="flex:none"></span></div>
  <button class="b" id="sm_ex" style="width:100%;min-height:56px;font-size:18px;margin-top:8px">💾 صدّر الفيديو</button><p class="mu">التصدير بياخد نفس مدة الفيديو تقريبًا — سيب الشاشة مفتوحة لحد ما يخلص.</p></div>
  <div class="p"><h2>✍️ الكلام (دوس على جملة تروح لها، وعدّل الكلمة لو غلط)</h2><input id="sm_ti" placeholder="عنوان الفيديو" style="width:100%;margin-bottom:8px"><div id="sm_cap" style="max-height:45vh;overflow:auto"></div></div>
  <div class="p"><h2>📐 التوضيحات اللي هتظهر</h2><div id="sm_ev"></div></div></div>
 <div id="sm_out"></div>
 <div class="p" id="sm_jobsbox"><h2>☁️ فيديوهاتي (في الخلفية)</h2><div id="sm_jobs" class="mu">⏳</div></div>`;
 /* الدخول */
 token().then(t=>{const a=$s('sm_auth');if(!a)return;if(!t){a.innerHTML=loginBox();$s('sm_li').onclick=doLogin}else a.innerHTML=''}).catch(()=>{});
 $s('sm_tp').innerHTML=Object.keys(TPL).map(k=>`<button type="button" data-tp="${k}" class="b ${S.tpl===k?'':'o'}" style="display:block;text-align:right;min-height:84px;white-space:normal;line-height:1.5"><b style="font-size:16px">${TPL[k].n}</b><br><span style="font-size:12px;font-weight:500">${TPL[k].d}</span></button>`).join('');
 $s('sm_tp').onclick=e=>{const b=e.target.closest('[data-tp]');if(!b)return;S.tpl=b.dataset.tp;saveS();paintTpl();if(D){build();renderLists();draw(V.currentTime)}};
 const ch=(id,k,f)=>{$s(id).oninput=$s(id).onchange=()=>{S[k]=f?f($s(id)):$s(id).value;saveS();if(D){if(k==='aspect'||k==='q')setupCanvas();draw(V.currentTime)}}};
 ch('sm_ft','font');ch('sm_cl','color');ch('sm_sz','size',x=>+x.value);ch('sm_as','aspect');ch('sm_q','q',x=>+x.value);ch('sm_in','intro',x=>x.checked);ch('sm_ou','outro',x=>x.checked);
 $s('sm_f').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;F=f;D=null;$s('sm_res').style.display='none';$s('sm_out').innerHTML='';
  if(V){V.pause();URL.revokeObjectURL(V.src)}V=document.createElement('video');V.playsInline=true;V.preload='auto';V.src=URL.createObjectURL(f);V.setAttribute('webkit-playsinline','');
  V.onloadedmetadata=()=>{$s('sm_fi').textContent='✔ '+f.name+' — '+fmt(V.duration)+' — '+(f.size/1048576).toFixed(0)+' ميجا'};V.load()};
 $s('sm_go').onclick=go;$s('sm_cl').onclick=cloudSubmit;loadJobs();clearInterval(JT);JT=setInterval(()=>{if($s('sm_jobs')&&document.visibilityState==='visible'&&$s('v-smart').classList.contains('on'))loadJobs()},15000)}
function paintTpl(){document.querySelectorAll('#sm_tp [data-tp]').forEach(b=>b.classList.toggle('o',b.dataset.tp!==S.tpl))}
async function go(){if(busy)return;if(!F)return say('اختار الفيديو الأول');const b=$s('sm_go'),pg=$s('sm_pg');busy=true;b.disabled=true;b.textContent='⏳ شغال…';
 const key='mkz-ai:'+F.name+':'+F.size;
 try{let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  D=cached||await analyze(m=>pg.textContent=m);if(!cached)try{localStorage.setItem(key,JSON.stringify(D))}catch(e){}
  if(!D.seg.length&&!D.ev.length)say('⚠️ مالقيتش كلام في الفيديو — اتأكد إن الصوت واضح');
  pg.textContent='✔ '+D.seg.length+' جملة • '+D.ev.length+' توضيح'+(cached?' (من قبل كده)':'');
  build();$s('sm_res').style.display='';setupCanvas();renderLists();loop();wirePlayer();$s('sm_res').scrollIntoView({behavior:'smooth'})}
 catch(e){if(e.message==='LOGIN'){pg.textContent='';const a=$s('sm_auth');a.innerHTML=loginBox();$s('sm_li').onclick=doLogin;a.scrollIntoView({behavior:'smooth'});say('سجّل دخول بحساب ميكانيزم الأول')}else{pg.textContent='❌ '+(e.message||e);say('❌ '+(e.message||e))}}
 finally{busy=false;b.disabled=false;b.textContent='✨ اعمل المونتاج تاني'}}
function wirePlayer(){$s('sm_pl').onclick=async()=>{if(V.paused){try{if(V._ac)await V._ac.resume();await V.play()}catch(e){}$s('sm_pl').textContent='⏸️'}else{V.pause();$s('sm_pl').textContent='▶️'}};
 V.onended=()=>{$s('sm_pl').textContent='▶️'};const sk=$s('sm_seek');sk.oninput=()=>{sk._drag=1;V.currentTime=sk.value/1000*(V.duration||0)};sk.onchange=()=>{sk._drag=0};
 $s('sm_ex').onclick=exportVid;const ti=$s('sm_ti');ti.value=D.title||'';ti.oninput=()=>{D.title=ti.value;draw(V.currentTime)}}
function renderLists(){const T=TPL[S.tpl];
 $s('sm_cap').innerHTML=D.seg.map((g,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><button type="button" class="b o" data-sk="${g.s}" style="flex:none;min-width:58px;padding:6px">${fmt(g.s)}</button><input data-sg="${i}" value="${esc(g.t)}" style="flex:1"></div>`).join('')||'<p class="mu">مفيش كلام</p>';
 $s('sm_cap').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}};
 $s('sm_cap').oninput=e=>{const i=e.target.dataset.sg;if(i==null)return;D.seg[+i].t=e.target.value;build();draw(V.currentTime)};
 const IC={measure:'📏',product:'📦',price:'💰',point:'✔'};
 $s('sm_ev').innerHTML=(D.ev.length?D.ev.map((x,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" data-eo="${i}" ${x.on?'checked':''} style="width:22px;height:22px;flex:none"><button type="button" class="b o" data-sk="${x.s}" style="flex:none;min-width:58px;padding:6px">${fmt(x.s)}</button><span style="flex:none">${IC[x.type]||'•'}</span><input data-el="${i}" value="${esc(x.type==='measure'||x.type==='price'?((x.value||'')+' '+(x.unit||'')).trim():x.label)}" style="flex:1"></div>`).join(''):'<p class="mu">مالقيتش مقاسات أو أصناف في الكلام.</p>')
  +`<button type="button" class="b o" id="sm_ae" style="width:100%">➕ ضيف توضيح عند اللحظة الحالية</button>${T.ov?'':'<p class="mu">القالب ده مش بيظهر توضيحات.</p>'}`;
 $s('sm_ev').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}if(e.target.id==='sm_ae'){const t=prompt('اكتب التوضيح (مثلًا: 60 سم — أو اسم الصنف — أو نصيحة)');if(!t)return;const m=en(t).match(/([\d.]+)\s*(سم|مم|م|متر|كجم|كيلو|بوصة|جنيه)/);
   D.ev.push(m?{s:V.currentTime,e:V.currentTime+2.4,type:m[2]==='جنيه'?'price':'measure',value:m[1],unit:m[2]==='متر'?'م':m[2],label:t,on:true}:{s:V.currentTime,e:V.currentTime+2.6,type:findProd(t)?'product':'point',label:t,on:true});D.ev.sort((a,b)=>a.s-b.s);build();renderLists();draw(V.currentTime)}};
 $s('sm_ev').onchange=e=>{const i=e.target.dataset.eo;if(i!=null){D.ev[+i].on=e.target.checked;build();draw(V.currentTime)}};
 $s('sm_ev').oninput=e=>{const i=e.target.dataset.el;if(i==null)return;const x=D.ev[+i],v=en(e.target.value);if(x.type==='measure'||x.type==='price'){const m=v.match(/([\d.]+)\s*(.*)/);if(m){x.value=m[1];x.unit=m[2].trim()||x.unit}}else x.label=e.target.value;draw(V.currentTime)}}

/* ---------- ☁️ المونتاج في الخلفية ---------- */
let JT=0;
const PART=40*1024*1024;
function slimImg(src,max){return new Promise(res=>{if(!src||String(src).length<10)return res('');const im=new Image();im.onload=()=>{try{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))}catch(e){res('')}};im.onerror=()=>res('');im.src=src})}
async function cloudSubmit(){if(busy)return;if(!F)return say('اختار الفيديو الأول');
 if(F.size>1500*1024*1024)return say('الفيديو أكبر من ١٫٥ جيجا — قصّره');
 const pg=$s('sm_pg'),b=$s('sm_cl');busy=true;b.disabled=true;let wl=null;
 try{const tok=await token();if(!tok){const a=$s('sm_auth');a.innerHTML=loginBox();$s('sm_li').onclick=doLogin;a.scrollIntoView({behavior:'smooth'});throw new Error('سجّل دخول بحساب ميكانيزم الأول')}
  try{wl=await navigator.wakeLock.request('screen')}catch(e){}
  const c=sbk(),uid=(await c.auth.getUser()).data.user.id,id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));
  pg.textContent='⏳ بجهّز الطلب…';
  const P=prods().slice(0,40),slim=[];for(const p of P)slim.push({id:p.id,nm:p.nm,pr:p.pr,img:await slimImg(p.img,220)});
  const spec={S:Object.assign({},S),brand:brand(),products:slim,src:F.name,srcSize:F.size};
  let ins=await c.from('mk_video_jobs').insert({id,user_id:uid,name:(F.name||'فيديو').slice(0,80),status:'uploading',spec});if(ins.error)throw new Error(/mk_video_jobs|relation/.test(ins.error.message||'')?'جدول المهام مش متعمل — كلمني':ins.error.message);
  const n=Math.ceil(F.size/PART),paths=[];
  for(let i=0;i<n;i++){const path=`${uid}/${id}/p${String(i+1).padStart(3,'0')}`,blob=F.slice(i*PART,Math.min(F.size,(i+1)*PART));
   for(let k=0;;k++){pg.textContent=`⬆️ برفع الفيديو… ${i+1} من ${n} (${Math.round((i*PART)/F.size*100)}%) — سيب الشاشة مفتوحة لحد ما يخلص الرفع`;
    const r=await c.storage.from('video-jobs').upload(path,blob,{upsert:true,contentType:'application/octet-stream'});if(!r.error)break;if(k>=3)throw new Error('الرفع وقف: '+(r.error.message||r.error));await new Promise(r=>setTimeout(r,2500*(k+1)))}
   paths.push(path)}
  const up=await c.from('mk_video_jobs').update({parts:paths,status:'queued',note:'مستني دوره'}).eq('id',id);if(up.error)throw up.error;
  pg.textContent='✅ الفيديو اتحط في الطابور — تقدر تقفل الموبايل. هتلاقيه جاهز تحت في «فيديوهاتي».';say('✅ اترفع — السيرفر هيكمل لوحده');loadJobs();$s('sm_jobsbox').scrollIntoView({behavior:'smooth'})}
 catch(e){pg.textContent='❌ '+(e.message||e);say('❌ '+(e.message||e))}
 finally{busy=false;b.disabled=false;try{wl&&wl.release()}catch(e){}}}
const JST={uploading:'⬆️ بيترفع',queued:'⏳ مستني دوره',working:'⚙️ شغال',done:'✅ جاهز',failed:'❌ فشل'};
async function loadJobs(){const el=$s('sm_jobs');if(!el)return;const c=sbk();if(!c)return;
 try{if(!(await token())){el.innerHTML='سجّل دخول بحساب ميكانيزم عشان تشوف فيديوهاتك.';return}
  const r=await c.from('mk_video_jobs').select('id,name,status,progress,note,error,out_path,created_at,attempts').order('created_at',{ascending:false}).limit(15);if(r.error)throw r.error;
  const L=r.data||[];el.innerHTML=L.length?L.map(j=>`<div class="p" style="margin:0 0 8px;padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${esc(j.name)}</b><span>${JST[j.status]||j.status}</span></div>
   ${j.status==='working'||j.status==='queued'?`<div style="height:8px;background:var(--ln);border-radius:6px;margin:6px 0;overflow:hidden"><div style="height:100%;width:${Math.max(3,j.progress||0)}%;background:var(--g)"></div></div><small>${esc(j.note||'')} ${j.progress?j.progress+'%':''}</small>`:''}
   ${j.status==='failed'?`<small style="color:#ff8a80">${esc(j.error||'')}</small><br><button class="b o" data-rt="${j.id}" style="margin-top:6px">🔁 جرّب تاني</button>`:''}
   ${j.status==='done'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="b" data-vw="${j.id}" style="flex:1">▶️ شاهد</button><button class="b o" data-sh="${j.id}" style="flex:1">📤 شارك</button><button class="b o" data-dl="${j.id}" style="flex:1">⬇️ نزّل</button></div>`:''}
   <small class="mu">${new Date(j.created_at).toLocaleString('ar-EG',{day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</small></div>`).join(''):'مفيش فيديوهات في الخلفية لسه.';
  JOBS=Object.fromEntries(L.map(j=>[j.id,j]))}
 catch(e){el.textContent=/mk_video_jobs|relation/.test(String(e&&e.message))?'جدول المهام مش متعمل':'❌ '+(e.message||e)}}
let JOBS={};
async function jobUrl(id,dl){const j=JOBS[id];if(!j||!j.out_path)throw new Error('الفيديو مش موجود');const r=await sbk().storage.from('video-jobs').createSignedUrl(j.out_path,3600,dl?{download:(j.name||'ميكانيزم').replace(/\.[^.]+$/,'')+'-ميكانيزم.mp4'}:undefined);if(r.error)throw r.error;return r.data.signedUrl}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-vw],[data-sh],[data-dl],[data-rt]');if(!b||!$s('sm_jobs')||!$s('sm_jobs').contains(b))return;
 try{if(b.dataset.rt){await sbk().from('mk_video_jobs').update({status:'queued',attempts:0,error:'',note:'هيعيد المحاولة'}).eq('id',b.dataset.rt);return loadJobs()}
  if(b.dataset.vw){const u=await jobUrl(b.dataset.vw);$s('sm_out').innerHTML=`<div class="p"><h2>▶️ الفيديو الجاهز</h2><video src="${u}" controls playsinline style="width:100%;max-height:70vh;border-radius:12px;background:#000"></video></div>`;$s('sm_out').scrollIntoView({behavior:'smooth'})}
  if(b.dataset.dl){const u=await jobUrl(b.dataset.dl,true);location.href=u}
  if(b.dataset.sh){say('⏳ بجهّز الملف للمشاركة…');const u=await jobUrl(b.dataset.sh),bl=await (await fetch(u)).blob(),f=new File([bl],'ميكانيزم.mp4',{type:'video/mp4'});if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f]});else{const a=document.createElement('a');a.href=URL.createObjectURL(bl);a.download='ميكانيزم.mp4';a.click()}}}
 catch(err){say('❌ '+(err.message||err))}});

/* ---------- التركيب في الستوديو ---------- */
function mount(){if($s('v-smart'))return;const s=document.createElement('section');s.className='v';s.id='v-smart';const ref=$s('v-vid');(ref&&ref.parentNode||document.body).insertBefore(s,ref||null);
 const btn=`<button data-go="smart"><svg class="i"><use href="#i-vid"/></svg>🎬 مونتاج ذكي</button>`,rail=$s('rail');if(rail){const first=rail.querySelector('[data-go="vid"]');first?first.insertAdjacentHTML('beforebegin',btn):rail.insertAdjacentHTML('beforeend',btn)}
 const tiles=$s('tiles');if(tiles)tiles.insertAdjacentHTML('afterbegin',`<button class="tile" data-go="smart"><span class="ic">🎬</span>مونتاج ذكي</button>`);
 let painted=false;document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;if(b.dataset.go==='smart'){if(!painted){paint();painted=true}setTimeout(()=>{document.querySelectorAll('.v').forEach(x=>x.classList.toggle('on',x.id==='v-smart'));document.querySelectorAll('#rail button').forEach(x=>x.classList.toggle('on',x.dataset.go==='smart'))},0)}else if(V&&!V.paused)V.pause()})}
/* الستوديو بيرسم القايمة بعد ما المخزن يجهز (window.__ready) — نركّب بعده عشان مايتمسحش */
(window.__ready&&window.__ready.then?window.__ready:Promise.resolve()).then(()=>setTimeout(mount,0),()=>setTimeout(mount,0));
window.mkzSmart={draw:t=>draw(t),state:()=>({S,D,CAP,EV,GAPS}),_test:{build,wav64,splitPoints,setD:d=>{D=d},setV:v=>{V=v},setS:x=>{Object.assign(S,x)},setup:setupCanvas}};
})();
