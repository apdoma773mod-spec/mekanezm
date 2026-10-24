/* ===== 🎬 مونتاج ذكي — فيديو خام من الموبايل → ترجمة كلامك + توضيح المقاسات والأصناف والأسعار + قالب مونتاج → MP4 جاهز للنشر
   ١) الصوت بيتسحب من الفيديو جوه الموبايل (١٦ كيلو مونو) ويتقسم أجزاء ٤٠ ثانية → دالة video-ai على سيرفر ميكانيزم (Gemini) → كلام بتوقيته + أحداث + الإعادات اللي تتشال + الكلمات المهمة
   ١ب) مكان الشخص (MediaPipe Pose) عشان الكلام والكروت مايغطّوش الوش، والزووم يتمركز عليه
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
/* القالب = مجموعة اختيارات جاهزة، وكل اختيار يتغيّر لوحده من «تخصيص» (بيتحفظ في S.o) */
const TPL={
 pro:{n:'🔥 يوتيوب احترافي',d:'قص قوي من غير سكتات ولا إعادات + زووم مع كل قطع + الكلمات المهمة بماركر ملون وملصقات بإيموجي + كروت وعناوين أقسام + أصوات',cap:'bold',motion:'punch',cut:3,takes:true,kw:true,chap:true,ov:true,prog:true,wm:true,letter:false,look:'auto'},
 fast:{n:'⚡ تيك توك سريع',d:'كلمة كلمة كبير + زووم مع كل قطع + قص قوي + شريط تقدم',cap:'karaoke',motion:'punch',cut:3,takes:true,kw:true,chap:false,ov:true,prog:true,wm:true,letter:false,look:'vivid'},
 tech:{n:'🛠️ شرح فني',d:'ترجمة في بوكس + كروت المقاسات والخطوات والتحذيرات + زووم خفيف + قص عادي',cap:'box',motion:'soft',cut:2,takes:true,kw:true,chap:true,ov:true,prog:false,wm:true,letter:false,look:'auto'},
 ad:{n:'🏷️ إعلان منتج',d:'كروت الأصناف والأسعار كبيرة + كلام بخلفية ملونة + زووم على المنتج + ألوان قوية',cap:'pill',motion:'punch',cut:3,takes:true,kw:true,chap:false,ov:true,prog:false,wm:true,letter:false,look:'vivid'},
 talk:{n:'🎙️ كلام مباشر',d:'كلام عريض تحت والكلمات المهمة ملونة + عناوين أقسام + من غير كروت كتير',cap:'bold',motion:'soft',cut:2,takes:true,kw:true,chap:true,ov:false,prog:true,wm:true,letter:false,look:'auto'},
 cine:{n:'🎬 سينمائي',d:'شرايط سودا فوق وتحت + حركة بطيئة + كلام صغير أنيق + ألوان أقوى',cap:'lower',motion:'ken',cut:1,takes:true,kw:false,chap:true,ov:true,prog:false,wm:true,letter:true,look:'vivid'},
 calm:{n:'✨ هادي وأنيق',d:'ترجمة صغيرة تحت + كروت هادية من غير زووم ولا قص',cap:'lower',motion:'none',cut:0,takes:false,kw:false,chap:false,ov:true,prog:false,wm:false,letter:false,look:'auto'},
 clean:{n:'📐 توضيحات بس',d:'من غير ترجمة — المقاسات والأصناف والأسعار بس + قص خفيف',cap:'none',motion:'soft',cut:1,takes:true,kw:false,chap:true,ov:true,prog:false,wm:true,letter:false,look:'auto'}};
/* إضافات الحركة والرسومات لكل قالب: انتقال عند القطع، ملصقات للكلمات المهمة، نداء للشراء في النص، أصوات (في السحابة) */
const TPLX={pro:{trans:'zoom',stk:true,cta:true,sfx:true},fast:{trans:'flash',stk:true,cta:true,sfx:true},tech:{trans:'zoom',stk:true,cta:true,sfx:true},ad:{trans:'flash',stk:true,cta:true,sfx:true},
 talk:{trans:'zoom',stk:true,cta:true,sfx:true},cine:{trans:'none',stk:false,cta:false,sfx:false},calm:{trans:'none',stk:false,cta:false,sfx:false},clean:{trans:'zoom',stk:false,cta:true,sfx:true}};
Object.keys(TPLX).forEach(k=>Object.assign(TPL[k],TPLX[k]));
const TRANS=[['zoom','زووم سريع'],['flash','فلاش أبيض'],['none','من غير']];
/* إيموجي مناسب للكلام (بعد توحيد الحروف) */
const EMJ=[[/مجر|درج|ادراج/,'🗄️'],[/مطبخ|مطابخ/,'🍳'],[/دريسنج|دولاب|دواليب|هدوم/,'👔'],[/مفصل/,'🔩'],[/مقبض|مقابض|اكر|كالون|باب|ضلف/,'🚪'],[/سعر|جنيه|فلوس|رخيص|خصم|عرض خاص/,'💰'],[/ضمان/,'🛡️'],[/جود|اصلي|ممتاز|فاخر|احسن|افضل/,'⭐'],[/هادي|صوت|خبط/,'🤫'],[/قوي|تقيل|يشيل|كيلو|وزن/,'💪'],[/سريع|بسرع/,'⚡'],[/المنيوم|حديد|ستانلس|معدن/,'🔧'],[/لون|الوان|اسود|ابيض|ذهبي/,'🎨'],[/مقاس|سم|متر|طول/,'📏'],[/تركيب|يركب|ركب/,'🛠️'],[/توصيل|شحن/,'🚚'],[/اطلب|كلمنا|اتصل|واتساب/,'📞'],[/جديد|وصل/,'🆕'],[/مشكل|غلط|احذر/,'⚠️'],[/نصيح|خلي بالك|سر/,'💡'],[/ركن/,'📐'],[/مضمون|ثقه/,'🤝']];
const CAPS=[['bold','عريض بحدود (من غير بوكس)'],['box','في بوكس غامق'],['pill','بخلفية ملونة'],['karaoke','كلمة كلمة كبير'],['lower','صغير هادي تحت'],['none','من غير كلام']];
/* شكل كل نوع كلام: عدد الكلمات في السطر، المكان المفضّل (نسبة من الطول)، الحجم */
const CAPF={bold:{words:5,pos:.78,sz:64},box:{words:6,pos:.80,sz:56},pill:{words:5,pos:.78,sz:58},karaoke:{words:3,pos:.66,sz:92},lower:{words:7,pos:.87,sz:46},none:{words:6,pos:.8,sz:56}};
const MOTIONS=[['punch','زووم مع كل قطع (يوتيوب)'],['soft','زووم خفيف على المهم'],['ken','حركة بطيئة سينمائية'],['none','ثابت']];
const CUTS=[[3,'قوي — من غير ولا سكتة'],[2,'عادي'],[1,'خفيف'],[0,'من غير قص']];
const LOOKS=[['auto','تلقائي — يشيل الصفار'],['vivid','ألوان أقوى'],['warm','دافي'],['bw','أبيض وأسود'],['off','زي ما هو']];
const COLORS=[['#F6DC8A','ذهبي'],['#FFE600','أصفر'],['#2EC4B6','تركواز ميكانيزم'],['#35E0A0','أخضر'],['#4FC3FF','أزرق'],['#FF7A45','برتقالي'],['#FFFFFF','أبيض']];
let S=Object.assign({tpl:'pro',o:{},font:'Cairo',size:1,color:'#F6DC8A',aspect:'916',q:1080,intro:true,outro:true,smart:true},(()=>{try{return JSON.parse(localStorage.getItem('mkz-smart')||'{}')}catch(e){return {}}})());
if(!TPL[S.tpl])S.tpl='pro';if(!S.o||typeof S.o!=='object')S.o={};
const saveS=()=>{try{localStorage.setItem('mkz-smart',JSON.stringify(S))}catch(e){}};
const O=k=>(S.o&&S.o[k]!=null)?S.o[k]:TPL[S.tpl][k];
const CF=()=>CAPF[O('cap')]||CAPF.box;
let F=null,V=null,D=null,CAP=[],EV=[],GAPS=[],CUTT=[],STK=[],CTA=null,busy=false,raf=0,REC=null;   // F: الملف، V: عنصر الفيديو، D: نتيجة الذكاء، CUTT: أماكن القطع

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
/* نتيجة الذكاء لكل جزء → كلام وأحداث بتوقيت الفيديو كله (نفس الشكل في العامل السحابي) */
function mergeAI(res,offs){let seg=[],ev=[],title='';
 res.forEach((r,i)=>{const off=offs[i];if(i===0)title=r.title||'';(r.segments||[]).forEach(x=>{if(String(x.t||'').trim())seg.push({s:off+(+x.s||0),e:off+(+x.e||+x.s+1),t:String(x.t).trim(),cut:!!x.cut,kw:Array.isArray(x.kw)?x.kw.map(String).filter(Boolean).slice(0,3):[]})});
  (r.events||[]).forEach(x=>{if(String(x.label||'').trim())ev.push({s:off+(+x.s||0),e:off+(+x.e||0),type:String(x.type||'point'),label:String(x.label).trim(),value:en(x.value||''),unit:String(x.unit||''),on:true})})});
 seg.sort((a,b)=>a.s-b.s);ev.sort((a,b)=>a.s-b.s);return {title,seg,ev}}
async function analyze(prog){
 const tok=await token();if(!tok)throw new Error('LOGIN');
 const f32=await pcmFromFile(F,prog),pts=splitPoints(f32,40),jobs=[];
 for(let i=0;i<pts.length-1;i++)jobs.push({i,a:pts[i],b:pts[i+1]});
 const res=new Array(jobs.length);let done=0;
 const run=async j=>{for(let k=0;;k++){try{res[j.i]=await callAI(wav64(f32.subarray(j.a,j.b)),j.a/16000,j.i===0,tok);break}catch(e){if(k>=2||/LOGIN|دخول/.test(e.message))throw e;await new Promise(r=>setTimeout(r,2500*(k+1)))}}done++;prog('🧠 بفهم الكلام… '+done+' من '+jobs.length)};
 prog('🧠 بفهم الكلام… 0 من '+jobs.length);
 for(let i=0;i<jobs.length;i+=3)await Promise.all(jobs.slice(i,i+3).map(run));
 return Object.assign(mergeAI(res,jobs.map(j=>j.a/16000)),{dur:f32.length/16000})}

/* ---------- 👀 مكان الشخص في الفيديو (عشان الكلام والكروت ماتغطيش وشه) ---------- */
/* MediaPipe Pose: بيتحمّل مرة واحدة من النت. لو فشل، بنكمل بتقدير تقريبي لمكان الراس */
const MP='https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
const MP_MODEL='https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
let poseP=null;
function pose(){if(!poseP){poseP=(async()=>{const v=await import(MP+'/vision_bundle.mjs'),fs=await v.FilesetResolver.forVisionTasks(MP+'/wasm');
  return await v.PoseLandmarker.createFromOptions(fs,{baseOptions:{modelAssetPath:MP_MODEL,delegate:'CPU'},runningMode:'IMAGE',numPoses:1})})();poseP.catch(()=>{poseP=null})}return poseP}
/* صندوق الراس (نسبة من عرض/طول الصورة) من نقط الوش في Pose */
function headBox(lm){const pts=lm.slice(0,11).filter(p=>p&&(p.visibility==null||p.visibility>.4));if(pts.length<3)return null;
 let x0=1,x1=0,ey=0;pts.forEach(p=>{x0=Math.min(x0,p.x);x1=Math.max(x1,p.x)});const eyes=[1,2,3,4,5,6].map(i=>lm[i]).filter(Boolean);ey=eyes.length?eyes.reduce((a,p)=>a+p.y,0)/eyes.length:pts[0].y;
 return {cx:(x0+x1)/2,ey,w:Math.max(.04,(x1-x0)*1.5)}}
async function detectPeople(times,frame,prog){const m=await pose();const out=[];
 for(let i=0;i<times.length;i++){const t=times[i];try{const src=await frame(t),r=m.detect(src),lm=r&&r.landmarks&&r.landmarks[0],ar=(src.videoWidth||src.naturalWidth||1)/(src.videoHeight||src.naturalHeight||1),h=lm&&headBox(lm);
   if(h){const hh=h.w*ar*1.35;out.push({t,x0:Math.max(0,h.cx-h.w/2),x1:Math.min(1,h.cx+h.w/2),y0:Math.max(0,h.ey-hh*.55),y1:Math.min(1,h.ey+hh*.6)})}else out.push({t,none:1})}catch(e){out.push({t,none:1})}
  if(prog&&i%5===0)prog(Math.round(i/times.length*100))}
 return out}
/* الراس عند لحظة t (بيدمج أقرب عينتين عشان مايتنططش) */
function headAt(t){const P=D&&D.people;
 if(!P){if(!S.smart||!V||V.videoWidth>V.videoHeight)return null;return {x0:.36,x1:.64,y0:.13,y1:.36,guess:1}}   // من غير كشف: تقدير لفيديو طولي
 if(!P.length)return null;let lo=0,hi=P.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(P[mid].t<=t)lo=mid;else hi=mid-1}
 const a=P[lo],b=P[Math.min(P.length-1,lo+1)];if(Math.abs(a.t-t)>1.6&&Math.abs(b.t-t)>1.6)return null;
 if(a.none&&b.none)return null;if(a.none)return b;if(b.none||b===a)return a;const k=Math.max(0,Math.min(1,(t-a.t)/Math.max(.01,b.t-a.t)));
 return {x0:a.x0+(b.x0-a.x0)*k,x1:a.x1+(b.x1-a.x1)*k,y0:a.y0+(b.y0-a.y0)*k,y1:a.y1+(b.y1-a.y1)*k}}

/* ---------- ٢) تجهيز الترجمة والقص ---------- */
const GAPR={1:[.9,.2],2:[.5,.12],3:[.3,.07]};   // مستوى القص: [أقل سكتة تتشال، المسافة اللي تفضل قبل وبعد الكلام]
function build(){const cf=CF(),cut=+O('cut')||0,takes=O('takes');CAP=[];
 const SEG=(D.seg||[]).filter(g=>!(takes&&g.cut));
 SEG.forEach(g=>{const w=g.t.split(/\s+/).filter(Boolean),n=Math.max(1,Math.ceil(w.length/cf.words)),per=Math.ceil(w.length/n),dur=Math.max(.4,g.e-g.s);
  for(let i=0;i<n;i++){const ws=w.slice(i*per,(i+1)*per);if(!ws.length)continue;const a=g.s+dur*(i*per)/w.length,b=g.s+dur*Math.min(w.length,(i+1)*per)/w.length;CAP.push({s:a,e:b,w:ws,kw:g.kw||[]})}});
 const EL={product:3,topic:2.6,step:2.8,warn:2.8};
 EV=(D.ev||[]).map(x=>Object.assign(x,{e:Math.max(x.e||0,x.s+(EL[x.type]||2.4))}));
 /* القص: السكتات حسب المستوى + الجمل اللي الذكاء علّم عليها إنها إعادة أو تهتهة */
 let G=[];const end=(V&&V.duration)||D.dur||0;
 if(cut&&SEG.length){const [mn,pad]=GAPR[cut];let prev=0;
  if(SEG[0].s>mn+pad)G.push([0,SEG[0].s-pad]);
  SEG.forEach((g,i)=>{if(i&&g.s-prev>mn)G.push([prev+pad,g.s-pad]);prev=Math.max(prev,g.e)});
  if(end-prev>mn+.4)G.push([prev+pad+.15,end])}
 if(takes)(D.seg||[]).forEach(g=>{if(g.cut)G.push([Math.max(0,g.s-.04),g.e+.04])});
 G.sort((a,b)=>a[0]-b[0]);GAPS=[];G.forEach(g=>{if(g[1]-g[0]<.05)return;const l=GAPS[GAPS.length-1];if(l&&g[0]<=l[1]+.05)l[1]=Math.max(l[1],g[1]);else GAPS.push([g[0],g[1]])});
 CUTT=GAPS.map(g=>g[1]);
 /* ملصقات الكلمات المهمة: كلمة كبيرة بإيموجي كل ٤ ثواني تقريبًا (لو مفيش كارت ظاهر ساعتها) */
 CTA=null;const od=outDur();if(O('cta')&&od>22){const s=srcT(od*.48);CTA={s,e:s+3.4}}
 STK=[];if(O('stk')){let last=-9;CAP.forEach(c=>{const w=c.w.find(x=>isKw(x,c.kw));if(!w)return;const o=outT(c.s);if(o-last<4||o<2.6)return;if(EV.some(e=>showEv(e)&&e.s<c.e+.3&&e.e>c.s-.3))return;if(CTA&&c.s<CTA.e+.3&&c.s+1.7>CTA.s-.3)return;
  STK.push({s:c.s,e:Math.max(c.s+1.3,Math.min(c.s+1.7,c.e+.5)),w:w.replace(/[.,،؟!?:«»"]/g,''),em:emojiFor(c.w.join(' '))});last=o})}
 /* مكان الكلام وترتيب الكروت بيتحسبوا من أول وجديد */
 LAY.clear()}
const inGap=t=>GAPS.find(g=>t>=g[0]&&t<g[1]);
const shotIdx=t=>{let n=0;for(const c of CUTT){if(c<=t)n++;else break}return n};
const shotSpan=t=>{let a=0,b=(V&&V.duration)||D.dur||1;for(const g of GAPS){if(g[1]<=t)a=g[1];else{b=g[0];break}}return [a,b]};
const outT=t=>{let s=0;for(const g of GAPS){if(g[1]<=t)s+=g[1]-g[0];else if(g[0]<t)s+=t-g[0]}return t-s};
const outDur=()=>Math.max(.1,outT((V&&V.duration)||D.dur||0));
/* العكس: لحظة في الفيديو النهائي → لحظتها في الفيديو الأصلي */
const srcT=o=>{let acc=0,prev=0;for(const g of GAPS){const L=Math.max(0,g[0]-prev);if(acc+L>=o)return prev+(o-acc);acc+=L;prev=g[1]}return prev+(o-acc)};
const lastCut=t=>{let r=null;for(const c of CUTT){if(c<=t)r=c;else break}return r!=null&&t-r<.35?t-r:null};
const emojiFor=t=>{const n=norm(t);for(const [re,e] of EMJ)if(re.test(n))return e;return '✨'};
const prodImg={};function findProd(label){const L=prods(),q=String(label||'').replace(/\s+/g,'');let best=null,bs=0;
 L.forEach(p=>{const n=String(p.nm||'').replace(/\s+/g,'');if(!n)return;let s=0;if(n.includes(q)||q.includes(n))s=Math.min(n.length,q.length)/Math.max(n.length,q.length)+.5;else{let c=0;for(const ch of new Set(q))if(n.includes(ch))c++;s=c/Math.max(q.length,1)*.6}if(s>bs){bs=s;best=p}});
 if(!best||bs<.55)return null;if(best.img&&!prodImg[best.id]){const im=new Image();im.src=best.img;prodImg[best.id]=im}return best}

/* ---------- ٣) الرسم ---------- */
let CV=null,CX=null;
function dims(){const vw=(V&&V.videoWidth)||1080,vh=(V&&V.videoHeight)||1920;if(S.aspect==='orig'){const k=S.q/Math.min(vw,vh);return [Math.round(vw*k/2)*2,Math.round(vh*k/2)*2]}return [S.q,Math.round(S.q*16/9/2)*2]}
function rr(x,y,w,h,r){CX.beginPath();CX.moveTo(x+r,y);CX.arcTo(x+w,y,x+w,y+h,r);CX.arcTo(x+w,y+h,x,y+h,r);CX.arcTo(x,y+h,x,y,r);CX.arcTo(x,y,x+w,y,r);CX.closePath()}
const ease=t=>1-Math.pow(1-Math.max(0,Math.min(1,t)),3);
const back=t=>{t=Math.max(0,Math.min(1,t));const c=1.7;return 1+(c+1)*Math.pow(t-1,3)+c*Math.pow(t-1,2)};   // حركة «نطّة» خفيفة للكروت
function wrapLines(words,maxW){const L=[];let cur=[];words.forEach(w=>{const t=cur.concat(w).join(' ');if(CX.measureText(t).width>maxW&&cur.length){L.push(cur);cur=[w]}else cur.push(w)});if(cur.length)L.push(cur);return L}
const norm=w=>String(w).replace(/[ً-ْـ.,،؟!?:؛"«»()]/g,'').replace(/[أإآ]/g,'ا').replace(/ة/g,'ه').replace(/ى/g,'ي');
const isKw=(w,kw)=>{if(!kw||!kw.length)return false;const n=norm(w);return !!n&&kw.some(k=>{const q=norm(k);return q&&(q===n||q.split(/\s+/).includes(n))})};

/* الزووم والحركة: بيرجّع مكان الفيديو على الكانفاس عند لحظة t */
function xf(t){const [W,H]=[CV.width,CV.height],vw=V.videoWidth,vh=V.videoHeight,side=S.aspect!=='orig'&&vw>vh,mo=O('motion');
 const k0=side?W/vw:Math.max(W/vw,H/vh),dw=vw*k0,dh=vh*k0,dx=(W-dw)/2,dy=(H-dh)/2;
 let z=1;const ze=EV.find(x=>x.on&&t>=x.s&&t<x.e&&(x.type==='measure'||x.type==='product'||x.type==='price'));
 const pulse=e=>ease((t-e.s)/.35)*(1-ease((t-e.e+.35)/.35));
 if(mo==='soft'){if(ze)z+=.06*pulse(ze);else{const c=CAP.find(x=>t>=x.s&&t<x.e);if(c&&O('cap')==='karaoke')z+=.03*(1-ease((t-c.s)/.5))}}
 else if(mo==='punch'){z+=shotIdx(t)%2?.1:0;if(ze)z+=.05*pulse(ze)}
 else if(mo==='ken'){const [a,b]=shotSpan(t);z+=.02+.08*Math.max(0,Math.min(1,(t-a)/Math.max(1,b-a)))}
 if(mo!=='none'){const st=STK.find(x=>t>=x.s&&t<x.e);if(st)z+=.045*ease((t-st.s)/.25)*(1-ease((t-st.e+.3)/.3))}
 if(O('trans')==='zoom'){const d=lastCut(t);if(d!=null)z+=.09*(1-ease(d/.25))}
 /* الزووم بيتمركز على الراس عشان الوش يفضل في الكادر */
 const hd=!side&&headAt(t);let ax=W/2,ay=H/2;if(hd&&!hd.guess){ax=dx+(hd.x0+hd.x1)/2*dw;ay=dy+(hd.y0+hd.y1)/2*dh}
 let x=ax-(ax-dx)*z,y=ay-(ay-dy)*z;const w=dw*z,h=dh*z;
 if(!side){if(w>=W)x=Math.min(0,Math.max(W-w,x));if(h>=H)y=Math.min(0,Math.max(H-h,y))}
 return {side,x,y,w,h,z,k0,vw,vh}}
/* صندوق الراس على الكانفاس (مع هامش) — للكلام والكروت يبعدوا عنه */
function headRect(t){if(!S.smart)return null;const hd=headAt(t);if(!hd)return null;const f=xf(t);if(f.side)return null;const u=CV.width/1080,m=24*u;
 return [f.y+hd.y0*f.h-m,f.y+hd.y1*f.h+m]}
/* بيدوّر على أقرب مكان لـ pref مايلمسش أي حاجة من avoid (كلها [من، لـ] على المحور الرأسي) */
function freeY(h,pref,avoid){const H=CV.height,st=H*.02;
 const ok=y=>{const a=y-h/2,b=y+h/2;return a>=H*.03&&b<=H*.97&&avoid.every(r=>!r||b<=r[0]||a>=r[1])};
 if(ok(pref))return pref;for(let d=st;d<H;d+=st){if(ok(pref+d))return pref+d;if(ok(pref-d))return pref-d}return pref}
const LAY=new Map();   // كاش مكان الكلام والكروت (بيتمسح مع build وتغيير المقاس)

/* الألوان: «تلقائي» بيحسب متوسط ألوان الصورة كل ثانية ويشيل الصفار/الزرقان (Gray World) بطبقة multiply — نفس النتيجة في المعاينة والتصدير والسحابة */
let SMP=null;const LK={t:-9,m:[1,1,1]};
function lookGains(t){if(Math.abs(t-LK.t)<.9)return LK.m;LK.t=t;try{if(!SMP){SMP=document.createElement('canvas');SMP.width=SMP.height=24}const c=SMP.getContext('2d',{willReadFrequently:true});c.drawImage(V,0,0,24,24);
  const d=c.getImageData(0,0,24,24).data;let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){const l=(d[i]+d[i+1]+d[i+2])/3;if(l<25||l>235)continue;r+=d[i];g+=d[i+1];b+=d[i+2];n++}
  if(n<40)return LK.m;r/=n;g/=n;b/=n;const a=(r+g+b)/3,st=.85;let G=[a/r,a/g,a/b].map(x=>1+(x-1)*st);const mx=Math.max(...G);G=G.map(x=>Math.max(.75,x/mx));
  if(Math.max(...G)-Math.min(...G)<.03)G=[1,1,1];LK.m=LK.m.map((x,i)=>x*.4+G[i]*.6)}catch(e){}return LK.m}
function applyLook(t,W,H){const lk=O('look');if(lk==='off')return;CX.save();
 if(lk==='auto'||lk==='vivid'){const m=lookGains(t);if(m[0]<.995||m[1]<.995||m[2]<.995){CX.globalCompositeOperation='multiply';CX.fillStyle=`rgb(${Math.round(255*m[0])},${Math.round(255*m[1])},${Math.round(255*m[2])})`;CX.fillRect(0,0,W,H)}
  if(lk==='vivid'){CX.globalCompositeOperation='overlay';CX.globalAlpha=.22;CX.drawImage(CV,0,0)}
  else{CX.globalCompositeOperation='screen';CX.fillStyle='rgb(10,10,12)';CX.fillRect(0,0,W,H)}}
 else if(lk==='warm'){CX.globalCompositeOperation='multiply';CX.fillStyle='rgb(255,236,212)';CX.fillRect(0,0,W,H);CX.globalCompositeOperation='screen';CX.fillStyle='rgb(14,8,0)';CX.fillRect(0,0,W,H)}
 else if(lk==='bw'){CX.globalCompositeOperation='saturation';CX.fillStyle='#808080';CX.fillRect(0,0,W,H);CX.globalCompositeOperation='overlay';CX.globalAlpha=.15;CX.drawImage(CV,0,0)}
 CX.restore()}

/* الكلام: تقسيم السطور والمكان (بيبعد عن الراس) */
function capLayout(c){const key='c'+c.s;if(LAY.has(key))return LAY.get(key);const [W,H]=[CV.width,CV.height],u=W/1080,cf=CF(),cs=O('cap'),F=`"${S.font}",Cairo,sans-serif`;
 const sz=Math.round(cf.sz*u*S.size);CX.font=`900 ${sz}px ${F}`;const L=wrapLines(c.w,W*(cs==='karaoke'?.80:.86)),lh=sz*1.34,h=L.length*lh+(cs==='box'||cs==='pill'?16*u:0);
 let pref=H*cf.pos;if(O('letter')&&cs==='lower')pref=H*.875;
 const y=freeY(h,pref,[headRect(c.s)]);const r={L,lh,sz,y0:y-(L.length-1)*lh/2,band:[y-h/2-10*u,y+h/2+10*u]};LAY.set(key,r);return r}
const capAt=t=>O('cap')==='none'?null:CAP.find(x=>t>=x.s&&t<x.e+.08);

/* الكروت: كل كارت بياخد مكان فاضي بعيد عن الراس والكلام والكروت اللي ظاهرة قبله */
const EVH={measure:250,product:215,price:145,point:115,warn:120,step:120,topic:130};
function evY(e,i){const key='e'+i+':'+e.s;if(LAY.has(key))return LAY.get(key);const H=CV.height,u=CV.width/1080,h=(EVH[e.type]||115)*u;
 const c=capAt(e.s),av=[headRect(e.s),c?capLayout(c).band:null];
 EV.forEach((x,j)=>{if(j<i&&x.on&&x.s<=e.s&&x.e>e.s&&showEv(x)){const yy=evY(x,j),hh=(EVH[x.type]||115)*u;av.push([yy-hh/2-14*u,yy+hh/2+14*u])}});
 const y=freeY(h,e.type==='topic'?H*.2:H*.16,av);LAY.set(key,y);return y}
const showEv=e=>e.on&&(e.type==='topic'?O('chap'):O('ov'));

function drawWord(w,x,y,o){CX.save();CX.translate(x,y);if(o.sc&&o.sc!==1)CX.scale(o.sc,o.sc);
 if(o.stroke){CX.lineWidth=o.stroke;CX.lineJoin='round';CX.strokeStyle=o.sc>1?'rgba(0,0,0,.95)':'rgba(0,0,0,.85)';CX.strokeText(w,0,0)}
 if(o.bg){const ww=CX.measureText(w).width,hh=o.size*1.12,full=ww+24*o.u,wv=Math.max(1,full*(o.wipe==null?1:o.wipe));rr(full/2-wv,-hh/2,wv,hh,12*o.u);CX.fillStyle=o.bg;CX.fill();if(o.wipe!=null&&o.wipe<1){CX.save();CX.beginPath();CX.rect(full/2-wv,-hh,wv,hh*2);CX.clip();CX.fillStyle=o.fill;CX.fillText(w,0,0);CX.restore();CX.fillStyle='#fff';CX.lineWidth=10*o.u;CX.strokeStyle='rgba(0,0,0,.85)';CX.save();CX.beginPath();CX.rect(-full/2-4*o.u,-hh,full-wv+4*o.u,hh*2);CX.clip();CX.strokeText(w,0,0);CX.fillText(w,0,0);CX.restore();CX.restore();return}}
 CX.fillStyle=o.fill;CX.fillText(w,0,0);CX.restore()}

function draw(t){const [W,H]=[CV.width,CV.height];CX.setTransform(1,0,0,1,0,0);CX.globalCompositeOperation='source-over';CX.globalAlpha=1;CX.fillStyle='#000';CX.fillRect(0,0,W,H);
 if(!V||!V.videoWidth)return;
 const f=xf(t);
 if(f.side){/* فيديو عرضي في ٩:١٦: خلفية مكبّرة غامقة + الفيديو كامل في النص */const kb=Math.max(W/f.vw,H/f.vh)*1.1;CX.globalAlpha=.35;CX.drawImage(V,(W-f.vw*kb)/2,(H-f.vh*kb)/2,f.vw*kb,f.vh*kb);CX.globalAlpha=1;CX.drawImage(V,(W-f.w)/2,(H-f.h)/2,f.w,f.h)}
 else CX.drawImage(V,f.x,f.y,f.w,f.h);
 applyLook(t,W,H);
 if(O('trans')==='flash'){const d=lastCut(t);if(d!=null&&d<.16){CX.fillStyle=`rgba(255,255,255,${(.55*(1-d/.16)).toFixed(3)})`;CX.fillRect(0,0,W,H)}}
 const u=W/1080,F=`"${S.font}",Cairo,sans-serif`,acc=S.color;CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 /* المقدمة والخاتمة بتوقيت الفيديو بعد القص (عشان ماتتشالش مع السكتات) */
 const dur=V.duration||D.dur||0,br=brand(),ot=outT(t),od=outDur(),inOut=S.outro&&od>4&&ot>od-2.2,inIntro=S.intro&&D.title&&ot<2.4;
 if(O('letter')){CX.fillStyle='#000';CX.fillRect(0,0,W,H*.085);CX.fillRect(0,H*.915,W,H*.085)}
 /* مقدمة: العنوان بعيد عن الراس */
 if(inIntro){const a=1-ease((ot-1.9)/.5);CX.globalAlpha=Math.max(0,a);CX.fillStyle='rgba(0,0,0,.45)';CX.fillRect(0,0,W,H);
  const tsz=Math.round(86*u*S.size);CX.font=`900 ${tsz}px ${F}`;const L=wrapLines(D.title.split(/\s+/),W*.84),bh=L.length*tsz*1.2+90*u,ty=freeY(bh,H*.42,[headRect(0)]),y0=ty-bh/2+tsz*.6;
  L.forEach((l,i)=>{const y=y0+i*tsz*1.2,s=.9+.1*back(ot/.5);CX.save();CX.translate(W/2,y);CX.scale(s,s);CX.lineWidth=12*u;CX.lineJoin='round';CX.strokeStyle='rgba(0,0,0,.75)';CX.strokeText(l.join(' '),0,0);CX.fillStyle='#fff';CX.fillText(l.join(' '),0,0);CX.restore()});
  const ly=y0+L.length*tsz*1.2-tsz*.2;CX.fillStyle=acc;CX.fillRect(W/2-W*.15*ease(ot/.6),ly,W*.3*ease(ot/.6),8*u);CX.font=`700 ${Math.round(40*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,ly+48*u);CX.globalAlpha=1}
 /* الكروت وعناوين الأقسام */
 EV.forEach((e,i)=>{if(!showEv(e)||t<e.s||t>e.e||inOut||inIntro)return;const a=ease((t-e.s)/.3),out=1-ease((t-e.e+.3)/.3),al=Math.min(a,out);if(al<=0)return;CX.globalAlpha=al;const y=evY(e,i),sc=.8+.2*back((t-e.s)/.4);
  CX.save();CX.translate(W/2,y);
  if(e.type==='topic'){/* عنوان قسم: شريط داخل من اليمين */const sl=(1-ease((t-e.s)/.45))*W;CX.translate(sl,0);CX.font=`900 ${Math.round(58*u)}px ${F}`;const tw=CX.measureText(e.label).width,bw=Math.min(W*.92,tw+140*u);
   rr(-bw/2,-62*u,bw,124*u,18*u);CX.fillStyle='rgba(10,10,12,.86)';CX.fill();CX.fillStyle=acc;CX.fillRect(bw/2-22*u,-62*u,22*u,124*u);CX.fillStyle='#fff';CX.fillText(e.label,-11*u,3*u)}
  else{CX.scale(sc,sc);
  if(e.type==='measure'){const val=(e.value||'')+' '+(e.unit||''),lab=e.label||'';CX.font=`900 ${Math.round(110*u)}px ${F}`;const vwid=CX.measureText(ar(val)).width;CX.font=`700 ${Math.round(38*u)}px ${F}`;const lw=CX.measureText(lab).width,bw=Math.min(W*.92,Math.max(vwid,lw)+120*u);
   const hasL=lab&&lab.replace(/\s/g,'')!==val.replace(/\s/g,'');rr(-bw/2,(hasL?-125:-95)*u,bw,(hasL?245:190)*u,28*u);CX.fillStyle='rgba(10,10,12,.84)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   /* مسطرة بتتمد */const rw=(bw-80*u)*ease((t-e.s)/.6);const ry=(hasL?80:52)*u;CX.fillStyle=acc;CX.fillRect(-rw/2,ry,rw,8*u);for(let k=0;k<=10;k++){const x=-rw/2+rw*k/10;CX.fillRect(x-1.5*u,ry-(k%5?8:16)*u,3*u,(k%5?16:24)*u)}
   /* الرقم بيعدّ لحد قيمته */const num=parseFloat(e.value),cnt=isFinite(num)&&num>0?(Math.round(num*ease((t-e.s)/.7)*10)/10):null;
   CX.fillStyle=acc;CX.font=`900 ${Math.round(110*u)}px ${F}`;CX.fillText(ar(cnt!=null&&t-e.s<.7?(Number.isInteger(num)?Math.round(cnt):cnt)+' '+(e.unit||''):val),0,-14*u);if(hasL){CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText(lab,0,-90*u)}}
  else if(e.type==='product'){const p=findProd(e.label),im=p&&prodImg[p.id],has=im&&im.complete&&im.naturalWidth;CX.font=`800 ${Math.round(46*u)}px ${F}`;const nm=p?p.nm:e.label,tw=CX.measureText(nm).width,bw=Math.min(W*.9,tw+(has?250:110)*u),bh=has?210*u:120*u;
   rr(-bw/2,-bh/2,bw,bh,26*u);CX.fillStyle='rgba(255,255,255,.96)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   if(has){const s=170*u,r=Math.min(s/im.naturalWidth,s/im.naturalHeight);CX.drawImage(im,bw/2-20*u-s+(s-im.naturalWidth*r)/2,-s/2+(s-im.naturalHeight*r)/2,im.naturalWidth*r,im.naturalHeight*r)}
   CX.fillStyle='#111';CX.textAlign='center';CX.fillText(nm,has?-85*u:0,p&&p.pr?-18*u:0);if(p&&p.pr){CX.font=`700 ${Math.round(34*u)}px ${F}`;CX.fillStyle='#8F6A1E';CX.fillText(ar(p.pr)+' جنيه',has?-85*u:0,32*u)}}
  else if(e.type==='price'){const txt=ar((e.value||e.label)+' '+(e.unit||'جنيه'));CX.font=`900 ${Math.round(80*u)}px ${F}`;const bw=CX.measureText(txt).width+110*u,wob=1+.06*Math.sin(Math.max(0,t-e.s-.4)*6)*Math.max(0,1-(t-e.s-.4)/1.2);
   CX.scale(wob,wob);rr(-bw/2,-70*u,bw,140*u,70*u);CX.fillStyle=acc;CX.fill();CX.lineWidth=6*u;CX.strokeStyle='rgba(0,0,0,.35)';CX.stroke();CX.fillStyle='#111';CX.fillText(txt,0,4*u)}
  else if(e.type==='step'){CX.font=`800 ${Math.round(48*u)}px ${F}`;const n=ar(e.value||'•'),txt=e.label,tw=CX.measureText(txt).width,bw=Math.min(W*.92,tw+190*u);
   rr(-bw/2,-56*u,bw,112*u,56*u);CX.fillStyle='rgba(10,10,12,.86)';CX.fill();CX.beginPath();CX.arc(bw/2-56*u,0,44*u,0,7);CX.fillStyle=acc;CX.fill();CX.fillStyle='#111';CX.font=`900 ${Math.round(50*u)}px ${F}`;CX.fillText(n,bw/2-56*u,4*u);
   CX.fillStyle='#fff';CX.font=`800 ${Math.round(48*u)}px ${F}`;CX.fillText(txt,-50*u,3*u)}
  else if(e.type==='warn'){CX.font=`800 ${Math.round(48*u)}px ${F}`;const txt='⚠️ '+e.label,bw=Math.min(W*.92,CX.measureText(txt).width+90*u),sh=Math.sin((t-e.s)*28)*6*u*Math.max(0,1-(t-e.s)/.5);
   CX.translate(sh,0);rr(-bw/2,-58*u,bw,116*u,58*u);CX.fillStyle='rgba(200,30,30,.92)';CX.fill();CX.lineWidth=4*u;CX.strokeStyle='#FFD54F';CX.stroke();CX.fillStyle='#fff';CX.fillText(txt,0,3*u)}
  else{CX.font=`800 ${Math.round(48*u)}px ${F}`;const txt='✔ '+e.label,bw=Math.min(W*.92,CX.measureText(txt).width+90*u);rr(-bw/2,-55*u,bw,110*u,55*u);CX.fillStyle='rgba(10,10,12,.86)';CX.fill();CX.lineWidth=4*u;CX.strokeStyle=acc;CX.stroke();CX.fillStyle='#fff';CX.fillText(txt,0,3*u)}}
  CX.restore();CX.globalAlpha=1});
 /* ملصق الكلمة المهمة: إيموجي بينط + الكلمة كبيرة مايلة + خطوط انفجار */
 STK.forEach((x,i)=>{if(inOut||inIntro||t<x.s||t>x.e)return;const key='s'+i;let y=LAY.get(key);if(y==null){const cc=capAt(x.s);y=freeY(300*u,H*.44,[headRect(x.s),cc?capLayout(cc).band:null]);LAY.set(key,y)}
  const p=(t-x.s)/.35,al=Math.min(1,p*1.6,(x.e-t)/.25);if(al<=0)return;CX.save();CX.globalAlpha=Math.max(0,al);CX.translate(W/2,y);
  const bs=Math.max(.01,back(p));CX.save();CX.rotate(-.07);CX.scale(bs,bs);
  CX.strokeStyle=acc;CX.lineWidth=7*u;CX.lineCap='round';const br2=ease((t-x.s)/.45);for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r0=150*u+90*u*br2,r1=r0+40*u*(1-br2);CX.globalAlpha=Math.max(0,al*(1-br2*.85));CX.beginPath();CX.moveTo(Math.cos(a)*r0*1.5,Math.sin(a)*r0*.7);CX.lineTo(Math.cos(a)*r1*1.5,Math.sin(a)*r1*.7);CX.stroke()}
  CX.globalAlpha=Math.max(0,al);CX.font=`900 ${Math.round(128*u)}px ${F}`;CX.lineJoin='round';CX.lineWidth=18*u;CX.strokeStyle='#000';CX.strokeText(x.w,0,30*u);CX.fillStyle=acc;CX.fillText(x.w,0,30*u);CX.restore();
  const bob=Math.sin((t-x.s)*9)*10*u*Math.max(0,1-(t-x.s)/1.2);CX.font=`${Math.round(96*u)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(x.em,0,-95*u+bob);CX.restore()});
 /* نداء للشراء في نص الفيديو */
 if(CTA&&!inOut&&t>=CTA.s&&t<=CTA.e){const p=ease((t-CTA.s)/.4),q=1-ease((t-CTA.e+.35)/.35),al=Math.min(p,q);if(al>0){let y=LAY.get('cta');if(y==null){const cc=capAt(CTA.s);y=freeY(130*u,H*.30,[headRect(CTA.s),cc?capLayout(cc).band:null]);LAY.set('cta',y)}
  const txt='📞 '+[br.cta||'اطلب دلوقتي',br.phone?ar(br.phone):''].filter(Boolean).join(' • ');CX.font=`800 ${Math.round(46*u)}px ${F}`;const bw=Math.min(W*.92,CX.measureText(txt).width+100*u);
  CX.save();CX.globalAlpha=al;CX.translate(W/2,y+(1-p)*80*u);const pl=1+.04*Math.sin((t-CTA.s)*7);CX.scale(pl,pl);rr(-bw/2,-58*u,bw,116*u,58*u);CX.fillStyle=acc;CX.fill();CX.lineWidth=5*u;CX.strokeStyle='#fff';CX.stroke();CX.fillStyle='#111';CX.fillText(txt,0,4*u);CX.restore()}}
 /* الكلام */
 const c=!inOut?capAt(t):null,cs=O('cap'),kwOn=O('kw');
 if(c){const Ly=capLayout(c),{L,lh,sz,y0}=Ly,a=ease((t-c.s)/.15);CX.font=`900 ${sz}px ${F}`;
  const nWord=Math.min(c.w.length-1,Math.floor((t-c.s)/((c.e-c.s)/c.w.length)));let wi=0;const sp=CX.measureText(' ').width;
  L.forEach((ln,li)=>{const y=y0+li*lh,txt=ln.join(' '),tw=CX.measureText(txt).width;
   if(cs==='box'||cs==='lower'||cs==='pill'){CX.globalAlpha=cs==='lower'?a:1;rr(W/2-tw/2-28*u,y-lh/2+4*u,tw+56*u,lh-4*u,16*u);CX.fillStyle=cs==='pill'?acc:cs==='lower'?'rgba(0,0,0,.5)':'rgba(0,0,0,.66)';CX.fill()}
   const base=cs==='pill'?'#111':'#fff',hi=cs==='pill'?'#fff':acc,stroke=cs==='bold'?12*u:cs==='karaoke'?14*u:cs==='pill'?0:0;
   let x=W/2+tw/2;const pop=cs==='bold'?.94+.06*a:cs==='karaoke'?.92+.08*a:1;
   ln.forEach(w=>{const ww=CX.measureText(w).width,cur=cs==='karaoke'&&wi===nWord,k=kwOn&&isKw(w,c.kw);
    const mk=k&&(cs==='bold'||cs==='karaoke'||cs==='box');   // ماركر ملون ورا الكلمة المهمة بيتمسح من اليمين
    drawWord(w,x-ww/2,y+2*u,{u,size:sz,sc:cur?pop*1.08:k&&cs!=='lower'?pop*1.04:pop,stroke:mk?0:(cs==='pill'&&k)?6*u:stroke,fill:mk?'#111':cur||k?hi:base,bg:mk?acc:null,wipe:mk?ease((t-c.s)/.28):1});x-=ww+sp;wi++});
   CX.globalAlpha=1})}
 /* شريط التقدم + اسم المحل في الركن */
 if(O('prog')&&dur){const p=Math.min(1,ot/od),by=O('letter')?H*.085:0;CX.fillStyle='rgba(255,255,255,.25)';CX.fillRect(0,by,W,9*u);CX.fillStyle=acc;CX.fillRect(W*(1-p),by,W*p,9*u)}
 if(O('wm')&&!inOut&&!inIntro){const nm=br.shop||'ميكانيزم';CX.font=`800 ${Math.round(30*u)}px ${F}`;const tw=CX.measureText(nm).width,bw=tw+56*u,top=(O('letter')?H*.085:0)+(O('prog')?22*u:16*u),x=W-bw-18*u;
  CX.globalAlpha=.88;rr(x,top,bw,52*u,26*u);CX.fillStyle='rgba(0,0,0,.45)';CX.fill();CX.beginPath();CX.arc(x+bw-22*u,top+26*u,7*u,0,7);CX.fillStyle=acc;CX.fill();CX.fillStyle='#fff';CX.fillText(nm,x+bw/2-8*u,top+28*u);CX.globalAlpha=1}
 /* الخاتمة */
 if(inOut){const a=ease((ot-(od-2.2))/.4),hr=headRect(t),oy=freeY(250*u,H*.70+125*u,[hr])-125*u;CX.globalAlpha=a;rr(W*.08,oy,W*.84,250*u,30*u);CX.fillStyle='rgba(10,10,12,.88)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
  CX.fillStyle=acc;CX.font=`900 ${Math.round(64*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,oy+70*u);CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText([br.cta||'اطلب دلوقتي',br.phone?ar(br.phone):''].filter(Boolean).join(' • '),W/2,oy+140*u);if(br.addr){CX.font=`600 ${Math.round(32*u)}px ${F}`;CX.fillText(br.addr,W/2,oy+195*u)}CX.globalAlpha=1}}

/* ---------- ٤) المعاينة ---------- */
function loop(){cancelAnimationFrame(raf);const f=()=>{if(!V)return;const g=!V.paused&&inGap(V.currentTime);if(g&&!REC){V.currentTime=g[1]}draw(V.currentTime);updBar();raf=requestAnimationFrame(f)};raf=requestAnimationFrame(f)}
function updBar(){const s=$s('sm_seek');if(s&&V&&V.duration&&!s._drag){s.value=V.currentTime/V.duration*1000}const l=$s('sm_tm');if(l&&V)l.textContent=fmt(V.currentTime)+' / '+fmt(V.duration)+(GAPS.length?' ← '+fmt(outDur()):'')}
function setupCanvas(){CV=$s('sm_cv');if(!CV)return;const [w,h]=dims();CV.width=w;CV.height=h;CX=CV.getContext('2d');LAY.clear();draw(V?V.currentTime:0)}

/* ---------- ٥) التصدير ---------- */
async function exportVid(){if(busy)return;if(typeof MediaRecorder==='undefined'||!CV.captureStream)return say('المتصفح ده مش بيدعم التصدير — حدّث iOS');
 const mt=['video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mt)return say('التصدير مش مدعوم على الموبايل ده');
 busy=true;const btn=$s('sm_ex');btn.disabled=true;
 try{setupCanvas();V.pause();V.currentTime=GAPS.length&&GAPS[0][0]<=0?GAPS[0][1]:0;await new Promise(r=>{V.onseeked=()=>{V.onseeked=null;r()};setTimeout(r,800)});
  const AC=window.AudioContext||window.webkitAudioContext;if(!V._ac){V._ac=new AC();V._src=V._ac.createMediaElementSource(V);V._dst=V._ac.createMediaStreamDestination();V._src.connect(V._dst);V._src.connect(V._ac.destination)}
  await V._ac.resume();const st=CV.captureStream(30);V._dst.stream.getAudioTracks().forEach(tr=>st.addTrack(tr));
  const ch=[];REC=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:S.q>=1080?8e6:5e6,audioBitsPerSecond:128000});REC.ondataavailable=e=>e.data&&e.data.size&&ch.push(e.data);
  const total=outDur();let rendered=0,lastT=V.currentTime;
  const stop=new Promise(r=>REC.onstop=r);V.muted=false;REC.start(500);await V.play();
  await new Promise(res=>{const tick=()=>{if(!REC)return res();const t=V.currentTime;if(t>lastT)rendered+=t-lastT;lastT=t;
    const g=inGap(t);if(g&&!V.seeking){if(g[1]>=V.duration-.05)return res();try{REC.pause()}catch(e){}V.currentTime=g[1];lastT=g[1];V.onseeked=()=>{V.onseeked=null;try{REC.resume()}catch(e){}}}
    btn.textContent='⏺️ بسجّل الفيديو… '+Math.min(99,Math.round(rendered/total*100))+'%';if(V.ended||t>=V.duration-0.05)return res();setTimeout(tick,60)};V.onended=()=>res();tick()});
  REC.stop();await stop;V.pause();const blob=new Blob(ch,{type:mt.split(';')[0]}),ext=/mp4/.test(mt)?'mp4':'webm',name='ميكانيزم-'+new Date().toISOString().slice(0,10)+'.'+ext,file=new File([blob],name,{type:blob.type});
  REC=null;btn.textContent='💾 صدّر الفيديو';btn.disabled=false;busy=false;
  const out=$s('sm_out');out.innerHTML=`<div class="p"><h2>✅ الفيديو جاهز (${(blob.size/1048576).toFixed(1)} ميجا)</h2><video src="${URL.createObjectURL(blob)}" controls playsinline style="width:100%;max-height:60vh;border-radius:12px;background:#000"></video>
   <button class="b" id="sm_sh" style="width:100%;margin-top:8px">📤 شارك / احفظ في الصور</button><a class="b o" style="width:100%" download="${esc(name)}" href="${URL.createObjectURL(blob)}">⬇️ تنزيل الملف</a>
   <p class="mu">من «شارك» تقدر تحفظه في الصور أو تبعته على طول لتيك توك وإنستجرام وفيسبوك.${ext!=='mp4'?' (الصيغة WebM — لو المنصة رفضته نزّله واستخدم تحويل)':''}</p></div>`;
  $s('sm_sh').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:D.title||'ميكانيزم'});else say('المشاركة مش متاحة — استخدم «تنزيل الملف»')}catch(e){}};
  out.scrollIntoView({behavior:'smooth'})}
 catch(e){REC=null;busy=false;btn.disabled=false;btn.textContent='💾 صدّر الفيديو';say('❌ التصدير وقف: '+(e.message||e))}}

/* ---------- الشاشة ---------- */
const sel=(id,list,v)=>`<select id="${id}">${list.map(x=>`<option value="${x[0]}" ${String(v)===String(x[0])?'selected':''}>${x[1]}</option>`).join('')}</select>`;
const chk=(id,v,txt)=>`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="${id}" ${v?'checked':''}> ${txt}</label>`;
function paintOpts(){const el=$s('sm_op');if(!el)return;
 el.innerHTML=`<div class="r2"><label>شكل الكلام${sel('so_cap',CAPS,O('cap'))}</label><label>حركة الكاميرا${sel('so_mo',MOTIONS,O('motion'))}</label>
  <label>شيل السكتات${sel('so_cut',CUTS,O('cut'))}</label><label>الألوان${sel('so_lk',LOOKS,O('look'))}</label><label>الانتقال عند القطع${sel('so_tr',TRANS,O('trans'))}</label></div>
  <div class="r2" style="margin-top:8px">${chk('so_tk',O('takes'),'شيل الإعادات والتهتهة')}${chk('so_kw',O('kw'),'لوّن الكلمات المهمة')}${chk('so_ov',O('ov'),'كروت المقاسات والأصناف والأسعار')}${chk('so_ch',O('chap'),'عناوين الأقسام')}${chk('so_pr',O('prog'),'شريط تقدم فوق')}${chk('so_wm',O('wm'),'اسم المحل في الركن')}${chk('so_lt',O('letter'),'شرايط سينما')}${chk('so_st',O('stk'),'ملصقات للكلمات المهمة بإيموجي')}${chk('so_ct',O('cta'),'نداء «اطلب دلوقتي» في النص')}${chk('so_fx',O('sfx'),'أصوات مع الرسومات (في الخلفية)')}${chk('so_sm',S.smart,'👀 الكلام مايغطيش وشّي')}</div>`;
 const set=(id,k,f)=>{$s(id).onchange=()=>{const v=f($s(id));if(k==='smart')S.smart=v;else S.o[k]=v;saveS();changed()}};
 set('so_cap','cap',x=>x.value);set('so_mo','motion',x=>x.value);set('so_cut','cut',x=>+x.value);set('so_lk','look',x=>x.value);
 set('so_tk','takes',x=>x.checked);set('so_kw','kw',x=>x.checked);set('so_ov','ov',x=>x.checked);set('so_ch','chap',x=>x.checked);set('so_pr','prog',x=>x.checked);set('so_wm','wm',x=>x.checked);set('so_lt','letter',x=>x.checked);set('so_tr','trans',x=>x.value);set('so_st','stk',x=>x.checked);set('so_ct','cta',x=>x.checked);set('so_fx','sfx',x=>x.checked);set('so_sm','smart',x=>x.checked)}
function changed(){LK.t=-9;if(D&&V){build();renderLists();draw(V.currentTime);updBar()}}
function paint(){const el=$s('v-smart');if(!el)return;
 el.innerHTML=`<h1>🎬 مونتاج ذكي</h1><p class="mu">ارفع الفيديو اللي صورته — السيستم بيسمع كلامك، يشيل السكتات والإعادات، يكتب الكلام على الفيديو من غير ما يغطي وشك، ويظهر المقاسات والأصناف والأسعار والخطوات وقت ما تقولها، ويظبط الألوان. اختار الطريقة وبعدين «صدّر» أو «اعمله في الخلفية».</p>
 <div id="sm_auth"></div>
 <div class="p"><h2>١) الفيديو</h2><label class="b" style="width:100%;cursor:pointer">📹 اختار الفيديو<input type="file" id="sm_f" accept="video/*" style="display:none"></label><div id="sm_fi" class="mu"></div></div>
 <div class="p"><h2>٢) طريقة المونتاج</h2><div id="sm_tp" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
  <details style="margin-top:10px" ${Object.keys(S.o).length?'open':''}><summary style="cursor:pointer;font-weight:800;padding:6px 0">⚙️ تخصيص (غيّر أي حاجة في القالب)</summary><div id="sm_op" style="margin-top:6px"></div></details>
  <div class="r2" style="margin-top:10px"><label>الخط<select id="sm_ft">${FONTS.map(f=>`<option value="${f[0]}" ${S.font===f[0]?'selected':''} style="font-family:'${f[0]}'">${f[1]}</option>`).join('')}</select></label>
  <label>لون التمييز<select id="sm_cl">${COLORS.map(c=>`<option value="${c[0]}" ${S.color===c[0]?'selected':''}>${c[1]}</option>`).join('')}</select></label>
  <label>حجم الكلام<input type="range" id="sm_sz" min="0.7" max="1.5" step="0.05" value="${S.size}"></label>
  <label>المقاس<select id="sm_as"><option value="916" ${S.aspect==='916'?'selected':''}>طولي ٩:١٦ (تيك توك/ريلز)</option><option value="orig" ${S.aspect==='orig'?'selected':''}>زي الفيديو الأصلي</option></select></label>
  <label>الجودة<select id="sm_q"><option value="1080" ${S.q==1080?'selected':''}>عالية 1080</option><option value="720" ${S.q==720?'selected':''}>متوسطة 720 (أسرع وأخف)</option></select></label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_in" ${S.intro?'checked':''}> عنوان في الأول</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_ou" ${S.outro?'checked':''}> اسم المحل وتليفونه في الآخر</label></div></div>
 <button class="b" id="sm_bg" style="width:100%;min-height:56px;font-size:18px">☁️ اعمله في الخلفية (تقفل الموبايل وهو شغال)</button>
 <p class="mu" style="margin:4px 0 10px">بيرفع الفيديو، وبعدها السيرفر هو اللي بيسمع ويعمل المونتاج ويطلّعه جاهز — تلاقيه تحت في «فيديوهاتي». بياخد من دقيقتين لـ ٢٠ دقيقة على حسب طول الفيديو (لحد ١٠ دقايق).</p>
 <button class="b o" id="sm_go" style="width:100%;min-height:50px">✨ أو اعمله هنا على الموبايل (مع معاينة وتعديل)</button><div id="sm_pg" class="mu" style="text-align:center;margin:6px 0"></div>
 <div id="sm_res" style="display:none"><div class="p"><h2>٣) المعاينة</h2><canvas id="sm_cv" style="width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:12px;display:block"></canvas>
  <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="b" id="sm_pl" style="flex:none;min-width:64px">▶️</button><input type="range" id="sm_seek" min="0" max="1000" value="0" style="flex:1"><span id="sm_tm" class="mu" style="flex:none"></span></div>
  <button class="b" id="sm_ex" style="width:100%;min-height:56px;font-size:18px;margin-top:8px">💾 صدّر الفيديو</button><p class="mu">التصدير بياخد نفس مدة الفيديو بعد القص تقريبًا — سيب الشاشة مفتوحة لحد ما يخلص.</p></div>
  <div class="p"><h2>✍️ الكلام (دوس على الوقت تروح له، عدّل الكلمة لو غلط، و✂️ = الجملة دي هتتشال)</h2><input id="sm_ti" placeholder="عنوان الفيديو" style="width:100%;margin-bottom:8px"><div id="sm_cap" style="max-height:45vh;overflow:auto"></div></div>
  <div class="p"><h2>📐 التوضيحات اللي هتظهر</h2><div id="sm_ev"></div></div></div>
 <div id="sm_out"></div>
 <div class="p" id="sm_jobsbox"><h2>☁️ فيديوهاتي (في الخلفية)</h2><div id="sm_jobs" class="mu">⏳</div></div>`;
 /* الدخول */
 token().then(t=>{const a=$s('sm_auth');if(!a)return;if(!t){a.innerHTML=loginBox();$s('sm_li').onclick=doLogin}else a.innerHTML=''}).catch(()=>{});
 $s('sm_tp').innerHTML=Object.keys(TPL).map(k=>`<button type="button" data-tp="${k}" class="b ${S.tpl===k?'':'o'}" style="display:block;text-align:right;min-height:84px;white-space:normal;line-height:1.5"><b style="font-size:16px">${TPL[k].n}</b><br><span style="font-size:12px;font-weight:500">${TPL[k].d}</span></button>`).join('');
 $s('sm_tp').onclick=e=>{const b=e.target.closest('[data-tp]');if(!b)return;S.tpl=b.dataset.tp;S.o={};saveS();paintTpl();paintOpts();changed()};
 paintOpts();
 const ch=(id,k,f)=>{$s(id).oninput=$s(id).onchange=()=>{S[k]=f?f($s(id)):$s(id).value;saveS();if(D){if(k==='aspect'||k==='q')setupCanvas();LAY.clear();draw(V.currentTime)}}};
 ch('sm_ft','font');ch('sm_cl','color');ch('sm_sz','size',x=>+x.value);ch('sm_as','aspect');ch('sm_q','q',x=>+x.value);ch('sm_in','intro',x=>x.checked);ch('sm_ou','outro',x=>x.checked);
 $s('sm_f').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;F=f;D=null;$s('sm_res').style.display='none';$s('sm_out').innerHTML='';
  if(V){V.pause();URL.revokeObjectURL(V.src)}V=document.createElement('video');V.playsInline=true;V.preload='auto';V.src=URL.createObjectURL(f);V.setAttribute('webkit-playsinline','');
  V.onloadedmetadata=()=>{$s('sm_fi').textContent='✔ '+f.name+' — '+fmt(V.duration)+' — '+(f.size/1048576).toFixed(0)+' ميجا'};V.load()};
 $s('sm_go').onclick=go;$s('sm_bg').onclick=cloudSubmit;loadJobs();clearInterval(JT);JT=setInterval(()=>{if($s('sm_jobs')&&document.visibilityState==='visible'&&$s('v-smart').classList.contains('on'))loadJobs()},15000)}
function paintTpl(){document.querySelectorAll('#sm_tp [data-tp]').forEach(b=>b.classList.toggle('o',b.dataset.tp!==S.tpl))}
/* مكان الشخص على الموبايل: بنقف على الفيديو كل ثانية ونشوف الراس فين */
async function phonePeople(pg){if(!S.smart||!V||V.videoWidth>V.videoHeight)return;const dur=V.duration||D.dur||0,times=[];for(let t=.3;t<dur;t+=1)times.push(t);
 const seek=t=>new Promise(r=>{const done=()=>{V.removeEventListener('seeked',done);r(V)};V.addEventListener('seeked',done);V.currentTime=t;setTimeout(done,1500)});
 try{pg.textContent='👀 بدور على مكانك في الفيديو…';D.people=await detectPeople(times,seek,p=>{pg.textContent='👀 بدور على مكانك في الفيديو… '+p+'%'});V.currentTime=0}
 catch(e){console.warn('pose',e);pg.textContent='⚠️ ماقدرتش أحدد مكانك — هستخدم تقدير'}}
async function go(){if(busy)return;if(!F)return say('اختار الفيديو الأول');const b=$s('sm_go'),pg=$s('sm_pg');busy=true;b.disabled=true;b.textContent='⏳ شغال…';
 const key='mkz-ai2:'+F.name+':'+F.size;
 try{let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  D=cached||await analyze(m=>pg.textContent=m);
  if(!D.people&&S.smart){await new Promise(r=>{if(V.readyState>=1)r();else V.onloadedmetadata=r});await phonePeople(pg)}
  try{localStorage.setItem(key,JSON.stringify(D))}catch(e){}
  if(!D.seg.length&&!D.ev.length)say('⚠️ مالقيتش كلام في الفيديو — اتأكد إن الصوت واضح');
  build();const cutN=(D.seg||[]).filter(g=>g.cut).length;
  pg.textContent='✔ '+D.seg.length+' جملة • '+D.ev.length+' توضيح'+(cutN?' • '+cutN+' إعادة هتتشال':'')+(cached?' (من قبل كده)':'');
  $s('sm_res').style.display='';setupCanvas();renderLists();loop();wirePlayer();$s('sm_res').scrollIntoView({behavior:'smooth'})}
 catch(e){if(e.message==='LOGIN'){pg.textContent='';const a=$s('sm_auth');a.innerHTML=loginBox();$s('sm_li').onclick=doLogin;a.scrollIntoView({behavior:'smooth'});say('سجّل دخول بحساب ميكانيزم الأول')}else{const m=/no longer available|اتقفل/i.test(e.message||'')?'موديل جوجل اتغيّر — حدّث الصفحة وجرّب تاني':(e.message||e);pg.textContent='❌ '+m;say('❌ '+m)}}
 finally{busy=false;b.disabled=false;b.textContent='✨ اعمل المونتاج تاني'}}
function wirePlayer(){$s('sm_pl').onclick=async()=>{if(V.paused){try{if(V._ac)await V._ac.resume();await V.play()}catch(e){}$s('sm_pl').textContent='⏸️'}else{V.pause();$s('sm_pl').textContent='▶️'}};
 V.onended=()=>{$s('sm_pl').textContent='▶️'};const sk=$s('sm_seek');sk.oninput=()=>{sk._drag=1;V.currentTime=sk.value/1000*(V.duration||0)};sk.onchange=()=>{sk._drag=0};
 $s('sm_ex').onclick=exportVid;const ti=$s('sm_ti');ti.value=D.title||'';ti.oninput=()=>{D.title=ti.value;draw(V.currentTime)}}
function renderLists(){
 $s('sm_cap').innerHTML=D.seg.map((g,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;${g.cut&&O('takes')?'opacity:.5':''}"><button type="button" class="b o" data-sk="${g.s}" style="flex:none;min-width:58px;padding:6px">${fmt(g.s)}</button><label title="شيل الجملة دي" style="flex:none;display:flex;align-items:center;gap:2px">✂️<input type="checkbox" data-sc="${i}" ${g.cut?'checked':''} style="width:20px;height:20px"></label><input data-sg="${i}" value="${esc(g.t)}" style="flex:1"></div>`).join('')||'<p class="mu">مفيش كلام</p>';
 $s('sm_cap').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}};
 $s('sm_cap').onchange=e=>{const i=e.target.dataset.sc;if(i==null)return;D.seg[+i].cut=e.target.checked;if(e.target.checked&&!O('takes')){S.o.takes=true;saveS();paintOpts()}build();renderLists();draw(V.currentTime);updBar()};
 $s('sm_cap').oninput=e=>{const i=e.target.dataset.sg;if(i==null)return;D.seg[+i].t=e.target.value;build();draw(V.currentTime)};
 const IC={measure:'📏',product:'📦',price:'💰',point:'✔',step:'🔢',warn:'⚠️',topic:'📌'};
 $s('sm_ev').innerHTML=(D.ev.length?D.ev.map((x,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" data-eo="${i}" ${x.on?'checked':''} style="width:22px;height:22px;flex:none"><button type="button" class="b o" data-sk="${x.s}" style="flex:none;min-width:58px;padding:6px">${fmt(x.s)}</button><span style="flex:none">${IC[x.type]||'•'}</span><input data-el="${i}" value="${esc(x.type==='measure'||x.type==='price'?((x.value||'')+' '+(x.unit||'')).trim():x.label)}" style="flex:1"></div>`).join(''):'<p class="mu">مالقيتش مقاسات أو أصناف في الكلام.</p>')
  +`<button type="button" class="b o" id="sm_ae" style="width:100%">➕ ضيف توضيح عند اللحظة الحالية</button>${O('ov')?'':'<p class="mu">الكروت مقفولة في القالب ده — افتحها من «تخصيص».</p>'}`;
 $s('sm_ev').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}if(e.target.id==='sm_ae'){const t=prompt('اكتب التوضيح (مثلًا: 60 سم — أو اسم الصنف — أو نصيحة — أو ⚠️ تحذير)');if(!t)return;const m=en(t).match(/([\d.]+)\s*(سم|مم|م|متر|كجم|كيلو|بوصة|جنيه)/);
   D.ev.push(m?{s:V.currentTime,e:V.currentTime+2.4,type:m[2]==='جنيه'?'price':'measure',value:m[1],unit:m[2]==='متر'?'م':m[2],label:t,on:true}:/^\s*⚠/.test(t)?{s:V.currentTime,e:V.currentTime+2.8,type:'warn',label:t.replace(/^\s*⚠️?\s*/,''),on:true}:{s:V.currentTime,e:V.currentTime+2.6,type:findProd(t)?'product':'point',label:t,on:true});D.ev.sort((a,b)=>a.s-b.s);build();renderLists();draw(V.currentTime)}};
 $s('sm_ev').onchange=e=>{const i=e.target.dataset.eo;if(i!=null){D.ev[+i].on=e.target.checked;build();draw(V.currentTime)}};
 $s('sm_ev').oninput=e=>{const i=e.target.dataset.el;if(i==null)return;const x=D.ev[+i],v=en(e.target.value);if(x.type==='measure'||x.type==='price'){const m=v.match(/([\d.]+)\s*(.*)/);if(m){x.value=m[1];x.unit=m[2].trim()||x.unit}}else x.label=e.target.value;LAY.clear();draw(V.currentTime)}}

/* ---------- ☁️ المونتاج في الخلفية ---------- */
let JT=0;
const PART=40*1024*1024;
function slimImg(src,max){return new Promise(res=>{if(!src||String(src).length<10)return res('');const im=new Image();im.onload=()=>{try{const k=Math.min(1,max/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res(c.toDataURL('image/jpeg',.8))}catch(e){res('')}};im.onerror=()=>res('');im.src=src})}
async function cloudSubmit(){if(busy)return;if(!F)return say('اختار الفيديو الأول');
 if(F.size>1500*1024*1024)return say('الفيديو أكبر من ١٫٥ جيجا — قصّره');
 const pg=$s('sm_pg'),b=$s('sm_bg');busy=true;b.disabled=true;let wl=null,step='الدخول';
 pg.textContent='⏳ بجهّز الرفع…';b.textContent='⏳ بجهّز…';pg.scrollIntoView({behavior:'smooth',block:'center'});
 try{const tok=await withTO(token(),20000,'الدخول اتأخر — اتأكد من النت');if(!tok){const a=$s('sm_auth');a.innerHTML=loginBox();$s('sm_li').onclick=doLogin;a.scrollIntoView({behavior:'smooth'});throw new Error('سجّل دخول بحساب ميكانيزم الأول')}
  try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(x=>{wl=x}).catch(()=>{})}catch(e){}
  const c=sbk(),ses=(await c.auth.getSession()).data.session,uid=ses&&ses.user&&ses.user.id;if(!uid)throw new Error('سجّل دخول تاني بحساب ميكانيزم');step='تجهيز الطلب';const id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));
  pg.textContent='⏳ بجهّز الطلب…';
  const P=prods().slice(0,40),slim=[];for(const p of P)slim.push({id:p.id,nm:p.nm,pr:p.pr,img:await slimImg(p.img,220)});
  const spec={S:Object.assign({},S),brand:brand(),products:slim,src:F.name,srcSize:F.size};
  step='تسجيل الطلب';let ins=await withTO(c.from('mk_video_jobs').insert({id,user_id:uid,name:(F.name||'فيديو').slice(0,80),status:'uploading',spec}),30000,'السيرفر مابيردش');if(ins.error)throw new Error(/mk_video_jobs|relation/.test(ins.error.message||'')?'جدول المهام مش متعمل — كلمني':ins.error.message);
  step='رفع الفيديو';const n=Math.ceil(F.size/PART),paths=[];
  for(let i=0;i<n;i++){const path=`${uid}/${id}/p${String(i+1).padStart(3,'0')}`,blob=F.slice(i*PART,Math.min(F.size,(i+1)*PART));
   for(let k=0;;k++){pg.textContent=`⬆️ برفع الفيديو… ${i+1} من ${n} (${Math.round((i*PART)/F.size*100)}%) — سيب الشاشة مفتوحة لحد ما يخلص الرفع`;
    const r=await c.storage.from('video-jobs').upload(path,blob,{upsert:true,contentType:'application/octet-stream'});if(!r.error)break;if(k>=3)throw new Error('الرفع وقف: '+(r.error.message||r.error));await new Promise(r=>setTimeout(r,2500*(k+1)))}
   paths.push(path)}
  step='تأكيد الطلب';const up=await c.from('mk_video_jobs').update({parts:paths,status:'queued',note:'مستني دوره'}).eq('id',id);if(up.error)throw up.error;
  pg.textContent='✅ الفيديو اتحط في الطابور — تقدر تقفل الموبايل. هتلاقيه جاهز تحت في «فيديوهاتي».';say('✅ اترفع — السيرفر هيكمل لوحده');loadJobs();$s('sm_jobsbox').scrollIntoView({behavior:'smooth'})}
 catch(e){const m='❌ وقف في خطوة «'+step+'»: '+(e&&e.message||e);pg.textContent=m;say(m);try{localStorage.setItem('mkz-last-err',new Date().toISOString()+' '+m)}catch(x){}}
 finally{busy=false;b.disabled=false;b.textContent='☁️ اعمله في الخلفية (تقفل الموبايل وهو شغال)';try{wl&&wl.release()}catch(e){}}}
const withTO=(p,ms,msg)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error(msg)),ms))]);
const JST={uploading:'⬆️ بيترفع',queued:'⏳ مستني دوره',working:'⚙️ شغال',done:'✅ جاهز',failed:'❌ فشل'};
async function loadJobs(){const el=$s('sm_jobs');if(!el)return;const c=sbk();if(!c)return;
 try{if(!(await token())){el.innerHTML='سجّل دخول بحساب ميكانيزم عشان تشوف فيديوهاتك.';return}
  const r=await c.from('mk_video_jobs').select('id,name,status,progress,note,error,out_path,created_at,attempts,parts').order('created_at',{ascending:false}).limit(15);if(r.error)throw r.error;
  const L=r.data||[];el.innerHTML=L.length?L.map(j=>`<div class="p" style="margin:0 0 8px;padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${esc(j.name)}</b><span>${JST[j.status]||j.status}</span></div>
   ${j.status==='working'||j.status==='queued'?`<div style="height:8px;background:var(--ln);border-radius:6px;margin:6px 0;overflow:hidden"><div style="height:100%;width:${Math.max(3,j.progress||0)}%;background:var(--g)"></div></div><small>${esc(j.note||'')} ${j.progress?j.progress+'%':''}</small>`:''}
   ${j.status==='failed'?`<small style="color:#ff8a80">${esc(j.error||'')}</small><br><button class="b o" data-rt="${j.id}" style="margin-top:6px">🔁 جرّب تاني</button>`:''}
   ${j.status==='done'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="b" data-vw="${j.id}" style="flex:1">▶️ شاهد</button><button class="b o" data-sh="${j.id}" style="flex:1">📤 شارك</button><button class="b o" data-dl="${j.id}" style="flex:1">⬇️ نزّل</button></div>${Array.isArray(j.parts)&&j.parts.length?`<button class="b o" data-rr="${j.id}" style="width:100%;margin-top:6px">🔁 اعمله تاني بالقالب والاختيارات اللي فوق</button>`:''}<small class="mu">${esc(j.note&&j.note!=='جاهز'?j.note:'')}</small>`:''}
   <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:6px"><small class="mu">${new Date(j.created_at).toLocaleString('ar-EG',{day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</small>${j.status!=='working'?`<button class="b o" data-rm="${j.id}" style="flex:none;padding:6px 12px;color:#ff8a80">🗑️ امسح</button>`:''}</div></div>`).join(''):'مفيش فيديوهات في الخلفية لسه.';
  JOBS=Object.fromEntries(L.map(j=>[j.id,j]))}
 catch(e){el.textContent=/mk_video_jobs|relation/.test(String(e&&e.message))?'جدول المهام مش متعمل':'❌ '+(e.message||e)}}
let JOBS={};
async function jobUrl(id,dl){const j=JOBS[id];if(!j||!j.out_path)throw new Error('الفيديو مش موجود');const r=await sbk().storage.from('video-jobs').createSignedUrl(j.out_path,3600,dl?{download:(j.name||'ميكانيزم').replace(/\.[^.]+$/,'')+'-ميكانيزم.mp4'}:undefined);if(r.error)throw r.error;return r.data.signedUrl}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-vw],[data-sh],[data-dl],[data-rt],[data-rr],[data-rm]');if(!b||!$s('sm_jobs')||!$s('sm_jobs').contains(b))return;
 try{if(b.dataset.rm){/* مسح الفيديو الجاهز والأصل من التخزين وبعدين من القايمة */const j=JOBS[b.dataset.rm];if(!j||!confirm('تمسح «'+(j.name||'الفيديو')+'» نهائي؟'))return;const c=sbk();
   const files=[j.out_path].concat(Array.isArray(j.parts)?j.parts:[]).filter(Boolean);if(files.length){const r=await c.storage.from('video-jobs').remove(files);if(r.error)throw r.error}
   const d=await c.from('mk_video_jobs').delete().eq('id',j.id).select('id');if(d.error)throw d.error;if(!(d.data||[]).length)throw new Error('مش مسموح بالمسح لسه — كلّم عبده');say('🗑️ اتمسح');return loadJobs()}
  if(b.dataset.rr){/* نفس الفيديو المرفوع بقالب تاني: الكلام اتحلل قبل كده فبيخلص أسرع */const c=sbk(),r=await c.from('mk_video_jobs').select('spec').eq('id',b.dataset.rr).maybeSingle();if(r.error||!r.data)throw r.error||new Error('الفيديو مش موجود');
   const up=await c.from('mk_video_jobs').update({spec:Object.assign({},r.data.spec,{S:Object.assign({},S)}),status:'queued',attempts:0,error:'',progress:0,note:'هيتعمل تاني بقالب '+TPL[S.tpl].n}).eq('id',b.dataset.rr);if(up.error)throw up.error;say('✅ اتحط في الطابور بالقالب الجديد');return loadJobs()}
  if(b.dataset.rt){await sbk().from('mk_video_jobs').update({status:'queued',attempts:0,error:'',note:'هيعيد المحاولة'}).eq('id',b.dataset.rt);return loadJobs()}
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
window.mkzSmart={draw:t=>draw(t),state:()=>({S,D,CAP,EV,GAPS,STK,CTA}),_test:{build,wav64,splitPoints,mergeAI,headAt,setD:d=>{D=d},setV:v=>{V=v},setS:x=>{Object.assign(S,x);if(!TPL[S.tpl])S.tpl='pro';if(!S.o||typeof S.o!=='object')S.o={}},setup:setupCanvas,
 /* العامل السحابي: بيدوّر على مكان الشخص في الفريمات قبل الرسم (لو الاختيار شغال) */
 /* أوقات الأصوات في الفيديو النهائي: «بوب» مع الكروت والملصقات و«ووش» مع عناوين الأقسام والنداء */
 sfx:()=>{if(!O('sfx'))return [];const L=[];EV.forEach(e=>{if(showEv(e))L.push({t:outT(e.s),k:e.type==='topic'?'whoosh':'pop'})});STK.forEach(x=>L.push({t:outT(x.s),k:'pop'}));if(CTA)L.push({t:outT(CTA.s),k:'whoosh'});
  return L.filter(x=>x.t>.2).sort((a,b)=>a.t-b.t).filter((x,i,a)=>!i||x.t-a[i-1].t>.25).slice(0,90)},
 wantPeople:()=>!!S.smart&&!(D&&D.people),detect:async(times,frame)=>{try{D.people=await detectPeople(times,frame);return D.people.filter(x=>!x.none).length}catch(e){console.warn('pose',e&&e.message);return -1}}}};
})();
