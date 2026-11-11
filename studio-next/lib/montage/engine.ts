// @ts-nocheck
// محرك المونتاج الذكي: آخر شكل نهائي من studio/smart.js، متغلّف كموديول Next.js (بيتركّب جوه #mk-host). المنطق النضيف اتنقل لـ lib/montage/*.
import { loudGain, peakOf, findHooks, paceReport, coverCandidates, frameScore, preflight } from './pro';
import { bestClips, retention, fillerReport, titleIdeas, platformCaptions, shotList, cleanScript, toSrt, punchWords, beatsOf } from './pro2';
import { officialLogo } from '../templates/logo';
import { loadFiles } from '../templates/media';
import qrcode from 'qrcode-generator';
export function startEngine(){
/* ===== 🎬 مونتاج ذكي — فيديو خام من الموبايل → ترجمة كلامك + توضيح المقاسات والأصناف والأسعار + قالب مونتاج → MP4 جاهز للنشر
   ١) الصوت بيتسحب من الفيديو جوه الموبايل (١٦ كيلو مونو) ويتقسم أجزاء ٤٠ ثانية → دالة video-ai على سيرفر ميكانيزم (Gemini) → كلام بتوقيته + أحداث + الإعادات اللي تتشال + الكلمات المهمة
   ١ب) مكان الشخص (MediaPipe Pose) عشان الكلام والكروت مايغطّوش الوش، والزووم يتمركز عليه
   ٢) المعاينة والتصدير على canvas: الفيديو + الترجمة + الكروت، والتصدير بـ MediaRecorder (نفس المدة الحقيقية للفيديو)
   الدخول بحساب ميكانيزم (مرة واحدة) عشان المفتاح يفضل على السيرفر ومحدش غيرك يستخدمه. ===== */
(function(){
'use strict';
const MK_URL='https://rzvncstjattlklpdtkfn.supabase.co',MK_KEY='sb_publishable_Molr1fCzsC-VbSgTFDXc5w_F1p0-Fcr';
const $s=id=>document.getElementById(id);
const say=m=>{try{toast(m)}catch(e){alert(m)}};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const en=t=>String(t==null?'':t).replace(/[٠-٩]/g,d=>'٠١٢٣٤٥٦٧٨٩'.indexOf(d));
const ar=t=>String(t==null?'':t).replace(/[0-9]/g,d=>'٠١٢٣٤٥٦٧٨٩'[d]);
const fmt=s=>{s=Math.max(0,s||0);const m=Math.floor(s/60),x=Math.floor(s%60);return m+':'+String(x).padStart(2,'0')};
/* بيانات الستوديو (المنتجات والهوية) جوه مخزن __KV — الكود الأساسي محطوط جوه __ready فمتغيراته مش ظاهرة هنا */
const kv=(k,d)=>{try{const v=window.__KV&&window.__KV.get(k);return v==null?d:(JSON.parse(v)??d)}catch(e){return d}};
let SELP=[],SITEB={};try{const x=JSON.parse(localStorage.getItem('mkz-selp')||'[]');if(Array.isArray(x))SELP=x}catch(e){}
const prods=()=>{const L=kv('prods',[]),A=Array.isArray(L)?L:[];return SELP.length?SELP.concat(A.filter(p=>!SELP.some(q=>q.nm===p.nm))):A};
const brand=()=>{const b=kv('brand',{})||{},o=Object.assign({shop:'ميكانيزم',cta:'اطلب دلوقتي',addr:'أرض اللواء - الجيزة',phone:''},SITEB);Object.keys(b).forEach(k=>{if(b[k]!==''&&b[k]!=null)o[k]=b[k]});return o};

/* ---------- الدخول بحساب ميكانيزم ---------- */
let SBK=null;
function sbk(){if(SBK)return SBK;if(!window.supabase||!supabase.createClient)return null;/* lock: من غير قفل المتصفح — على الآيفون القفل ده ساعات بيعلّق والطلبات تقف («السيرفر مابيردش») */
 SBK=supabase.createClient(MK_URL,MK_KEY,{auth:{storageKey:'mkz-mk-auth',persistSession:true,autoRefreshToken:true,lock:(n,t,fn)=>fn()}});return SBK}
async function token(){const c=sbk();if(!c)throw new Error('مكتبة الدخول مااتحملتش — اتأكد من النت');
 /* الدخول بيخلص كل ساعة، والآيفون ساعات مابيجددهوش لوحده (JWT expired) — نجدده إحنا قبل ما يخلص */
 const TO=(p,ms)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error('النت بطيء — جرّب تاني')),ms))]);
 let {data}=await TO(c.auth.getSession(),15000);let ses=data&&data.session;
 if(ses&&(!ses.expires_at||ses.expires_at*1000-Date.now()<120000)){try{const r=await TO(c.auth.refreshSession(),20000);ses=r&&r.data&&r.data.session||null}catch(e){ses=null}}
 if(ses)return ses.access_token;
 /* لو ميكانيزم مفتوح على نفس الموبايل (Safari) نستخدم نفس الدخول */
 try{const o=JSON.parse(localStorage.getItem('sb-rzvncstjattlklpdtkfn-auth-token')||'null');if(o&&o.refresh_token){const r=await c.auth.setSession({access_token:o.access_token,refresh_token:o.refresh_token});if(r.data&&r.data.session)return r.data.session.access_token}}catch(e){}
 return null}
function loginBox(){return `<div class="p" id="sm_login"><h2>🔐 دخول بحساب ميكانيزم (مرة واحدة)</h2><p class="mu">نفس الإيميل والباسورد اللي بتدخل بيهم سيستم ميكانيزم — عشان الذكاء يشتغل باسمك وماحدش غيرك يستخدمه.</p>
 <div class="r2"><label>الإيميل<input id="sm_em" type="email" autocomplete="username" dir="ltr"></label><label>الباسورد<input id="sm_pw" type="password" autocomplete="current-password" dir="ltr"></label></div>
 <button class="b" id="sm_li" style="width:100%;margin-top:8px">دخول</button></div>`}
async function doLogin(){const b=$s('sm_li');b.disabled=true;b.textContent='جاري الدخول...';
 try{const r=await sbk().auth.signInWithPassword({email:$s('sm_em').value.trim(),password:$s('sm_pw').value});if(r.error)throw r.error;say('✔ اتسجل الدخول');paint()}
 catch(e){b.disabled=false;b.textContent='دخول';say('❌ '+(/Invalid login/i.test(e.message||'')?'الإيميل أو الباسورد غلط':(e.message||e)))}}

/* ---------- قاموس المصطلحات: الذكاء يكتبها صح، وأي كلمة تصلّحها في الترجمة تتحفظ لوحدها ---------- */
const GLOS0=['ميكانيزم','دريسنج روم','أكر','سوفت كلوز','دلفة','جرار','باسكت قمامة','دولاب سوبر ماركت','خزنة بصمة','قطاع ألمنيوم','مقبض','كالون','فصالة','سكة'];
const gloss=()=>{let L=[];try{L=JSON.parse(localStorage.getItem('mkz-gloss')||'[]')}catch(e){}return [...new Set(GLOS0.concat(Array.isArray(L)?L:[]))].slice(0,150)};
const addGloss=ws=>{try{const L=JSON.parse(localStorage.getItem('mkz-gloss')||'[]');ws.forEach(w=>{w=String(w).replace(/[.,،؟!?:«»"]/g,'');if(w.length>=3&&!L.includes(w)&&!GLOS0.includes(w))L.push(w)});localStorage.setItem('mkz-gloss',JSON.stringify(L.slice(-120)))}catch(e){}};
const dlBlob=(b,nm)=>{const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download=String(nm).replace(/[\/:*?"<>|]+/g,'-');a.click()};

/* ---------- الحالة ---------- */
const FONTS=[['Cairo','القاهرة'],['Tajawal','تجوال'],['Almarai','المراعي'],['Changa','شانجا'],['Lalezar','لاله زار'],['El Messiri','المسيري'],['Reem Kufi','ريم كوفي'],['Marhey','مرحي']];
/* القالب = مجموعة اختيارات جاهزة، وكل اختيار يتغيّر لوحده من «تخصيص» (بيتحفظ في S.o) */
const TPL={
 magic:{n:'🎯 احترافي ذكي (سكيل المونتاج)',d:'قص السكتات والإعادات + كلام كلمة كلمة بعيد عن واجهة تيك توك/ريلز + كروت صغيرة نضيفة ماتغطيش الوش + اسم المنتج مرة واحدة + أقصى عنصرين مع بعض',cap:'wbw',motion:'soft',cut:2,takes:true,kw:true,chap:false,ov:true,prog:false,wm:false,letter:false,look:'auto',safe:true,calm:true,chip:true,l3:true},
 pro:{n:'🔥 يوتيوب احترافي',d:'قص قوي من غير سكتات ولا إعادات + زووم مع كل قطع + الكلمات المهمة بماركر ملون وملصقات بإيموجي + كروت وعناوين أقسام + أصوات',cap:'bold',motion:'punch',cut:3,takes:true,kw:true,chap:true,ov:true,prog:true,wm:true,letter:false,look:'auto'},
 fast:{n:'⚡ تيك توك سريع',d:'كلمة كلمة كبير + زووم مع كل قطع + قص قوي + شريط تقدم',cap:'karaoke',motion:'punch',cut:3,takes:true,kw:true,chap:false,ov:true,prog:true,wm:true,letter:false,look:'vivid'},
 tech:{n:'🛠️ شرح فني',d:'ترجمة في بوكس + كروت المقاسات والخطوات والتحذيرات + زووم خفيف + قص عادي',cap:'box',motion:'soft',cut:2,takes:true,kw:true,chap:true,ov:true,prog:false,wm:true,letter:false,look:'auto'},
 ad:{n:'🏷️ إعلان منتج',d:'كروت الأصناف والأسعار كبيرة + كلام بخلفية ملونة + زووم على المنتج + ألوان قوية',cap:'pill',motion:'punch',cut:3,takes:true,kw:true,chap:false,ov:true,prog:false,wm:true,letter:false,look:'vivid'},
 talk:{n:'🎙️ كلام مباشر',d:'كلام عريض تحت والكلمات المهمة ملونة + عناوين أقسام + من غير كروت كتير',cap:'bold',motion:'soft',cut:2,takes:true,kw:true,chap:true,ov:false,prog:true,wm:true,letter:false,look:'auto'},
 cine:{n:'🎬 سينمائي',d:'شرايط سودا فوق وتحت + حركة بطيئة + كلام صغير أنيق + ألوان أقوى',cap:'lower',motion:'ken',cut:1,takes:true,kw:false,chap:true,ov:true,prog:false,wm:true,letter:true,look:'vivid'},
 calm:{n:'✨ هادي وأنيق',d:'ترجمة صغيرة تحت + كروت هادية من غير زووم ولا قص',cap:'lower',motion:'none',cut:0,takes:false,kw:false,chap:false,ov:true,prog:false,wm:false,letter:false,look:'auto'},
 clean:{n:'📐 توضيحات بس',d:'من غير ترجمة — المقاسات والأصناف والأسعار بس + قص خفيف',cap:'none',motion:'soft',cut:1,takes:true,kw:false,chap:true,ov:true,prog:false,wm:true,letter:false,look:'auto'}};
/* إضافات الحركة والرسومات لكل قالب: انتقال عند القطع، ملصقات للكلمات المهمة، نداء للشراء في النص، أصوات (في السحابة) */
const TPLX={magic:{trans:'none',stk:false,cta:false,sfx:false},pro:{trans:'zoom',stk:true,cta:true,sfx:true},fast:{trans:'flash',stk:true,cta:true,sfx:true},tech:{trans:'zoom',stk:true,cta:true,sfx:true},ad:{trans:'flash',stk:true,cta:true,sfx:true},
 talk:{trans:'zoom',stk:true,cta:true,sfx:true},cine:{trans:'none',stk:false,cta:false,sfx:false},calm:{trans:'none',stk:false,cta:false,sfx:false},clean:{trans:'zoom',stk:false,cta:true,sfx:true}};
TPL.mix=Object.assign({},TPL.magic,{n:'🎲 تنويع تلقائي — كل فيديو بشكل مختلف',d:'كل مرة بيختار «بصمة» جديدة: لون وخط وشكل كروت وانتقال وكلام وصوت مختلفين، ومابيكررش آخر فيديوهاتك'});TPLX.mix={trans:'zoom',stk:false,cta:false,sfx:true};
Object.keys(TPLX).forEach(k=>Object.assign(TPL[k],TPLX[k],{anim:true}));
const TRANS=[['zoom','زووم سريع'],['flash','فلاش أبيض'],['none','من غير']];
/* إيموجي مناسب للكلام (بعد توحيد الحروف) */
const EMJ=[[/مجر|درج|ادراج/,'🗄️'],[/مطبخ|مطابخ/,'🍳'],[/دريسنج|دولاب|دواليب|هدوم/,'👔'],[/مفصل/,'🔩'],[/مقبض|مقابض|اكر|كالون|باب|ضلف/,'🚪'],[/سعر|جنيه|فلوس|رخيص|خصم|عرض خاص/,'💰'],[/ضمان/,'🛡️'],[/جود|اصلي|ممتاز|فاخر|احسن|افضل/,'⭐'],[/هادي|صوت|خبط/,'🤫'],[/قوي|تقيل|يشيل|كيلو|وزن/,'💪'],[/سريع|بسرع/,'⚡'],[/المنيوم|حديد|ستانلس|معدن/,'🔧'],[/لون|الوان|اسود|ابيض|ذهبي/,'🎨'],[/مقاس|سم|متر|طول/,'📏'],[/تركيب|يركب|ركب/,'🛠️'],[/توصيل|شحن/,'🚚'],[/اطلب|كلمنا|اتصل|واتساب/,'📞'],[/جديد|وصل/,'🆕'],[/مشكل|غلط|احذر/,'⚠️'],[/نصيح|خلي بالك|سر/,'💡'],[/ركن/,'📐'],[/مضمون|ثقه/,'🤝']];
const CAPS=[['wbw','كلمة بكلمة (الجارية ملونة) — آمن'],['bold','عريض بحدود (من غير بوكس)'],['box','في بوكس غامق'],['pill','بخلفية ملونة'],['karaoke','كلمة كلمة كبير'],['lower','صغير هادي تحت'],['none','من غير كلام']];
/* شكل كل نوع كلام: عدد الكلمات في السطر، المكان المفضّل (نسبة من الطول)، الحجم */
const CAPF={wbw:{words:4,pos:.70,sz:62},bold:{words:5,pos:.78,sz:64},box:{words:6,pos:.80,sz:56},pill:{words:5,pos:.78,sz:58},karaoke:{words:3,pos:.66,sz:92},lower:{words:7,pos:.87,sz:46},none:{words:6,pos:.8,sz:56}};
const MOTIONS=[['punch','زووم مع كل قطع (يوتيوب)'],['soft','زووم خفيف على المهم'],['ken','حركة بطيئة سينمائية'],['none','ثابت']];
const CUTS=[[3,'قوي — من غير ولا سكتة'],[2,'عادي'],[1,'خفيف'],[0,'من غير قص']];
const LOOKS=[['auto','تلقائي — يشيل الصفار'],['vivid','ألوان أقوى'],['warm','دافي'],['bw','أبيض وأسود'],['off','زي ما هو']];
const COLORS=[['#F6DC8A','ذهبي'],['#FFE600','أصفر'],['#2EC4B6','تركواز ميكانيزم'],['#35E0A0','أخضر'],['#4FC3FF','أزرق'],['#FF7A45','برتقالي'],['#FFFFFF','أبيض']];
let S=Object.assign({tpl:'magic',o:{},font:'Cairo',size:1,color:'#F6DC8A',aspect:'916',q:1080,fps:30,clar:true,sharp:true,dn:true,auto:true,stab:false,intro:true,outro:true,smart:true},(()=>{try{return JSON.parse(localStorage.getItem('mkz-smart')||'{}')}catch(e){return {}}})());
if(!S.mixMig){S.tpl='mix';S.o={};S.mixMig=1}if(!TPL[S.tpl])S.tpl='pro';if(!S.o||typeof S.o!=='object')S.o={};
const saveS=()=>{try{localStorage.setItem('mkz-smart',JSON.stringify(S))}catch(e){}};
var STY={on:false,o:{},color:'',font:'',rad:1,bw:2,kw:'under',lift:0,snd:{w:null,f:1}};const STYK=['cap','motion','trans','look','cut'];
const O=k=>(S.o&&S.o[k]!=null)?S.o[k]:(STY.on&&S.tpl==='mix'&&STY.o[k]!=null)?STY.o[k]:TPL[S.tpl][k];
const COL=()=>STY.on&&STY.color?STY.color:S.color,FONTN=()=>STY.on&&STY.font?STY.font:S.font;
const CF=()=>CAPF[O('cap')]||CAPF.box;
let F=null,V=null,D=null,CAP=[],EV=[],GAPS=[],CUTT=[],STK=[],CTA=null,busy=false,raf=0,REC=null;   // F: الملف، V: عنصر الفيديو، D: نتيجة الذكاء، CUTT: أماكن القطع

/* ---------- ١) الصوت: سحب + تقسيم ---------- */
async function pcmFromFile(file,prog){
 const AC=window.AudioContext||window.webkitAudioContext;
 if(file.size<=260e6&&!window.__forceRT){try{
  prog('🎧 بسحب الصوت من الفيديو…');const buf=await file.arrayBuffer(),ac=new AC();
  const ab=await new Promise((ok,no)=>{const p=ac.decodeAudioData(buf,ok,no);if(p&&p.then)p.then(ok,no)});ac.close&&ac.close();
  const off=new OfflineAudioContext(1,Math.ceil(ab.duration*16000),16000),src=off.createBufferSource();src.buffer=ab;src.connect(off.destination);src.start();
  const r=await off.startRendering();return r.getChannelData(0)}catch(e){console.warn('decode',e);prog('⚠️ السحب السريع للصوت فشل ('+String((e&&e.message)||e||'صيغة').slice(0,60)+') — هسمعه وهو شغال وهياخد وقت الفيديو')}}
 /* فيديو كبير أو الصيغة مش بتتفك: نسمعه وهو شغال (بياخد نفس مدة الفيديو) */
 return await new Promise((ok,no)=>{const v=document.createElement('video');v.src=URL.createObjectURL(file);v.playsInline=true;v.muted=false;
  const ac=new AC(),src=ac.createMediaElementSource(v),sp=ac.createScriptProcessor(4096,1,1),parts=[],g=ac.createGain();g.gain.value=0;
  src.connect(sp);sp.connect(g);g.connect(ac.destination);const rate=ac.sampleRate;
  sp.onaudioprocess=e=>{parts.push(new Float32Array(e.inputBuffer.getChannelData(0)));prog('🎧 بسمع الفيديو… '+fmt(v.currentTime)+' من '+fmt(v.duration)+'')};
  const wake=()=>{if(v.ended||!v.paused||document.visibilityState!=='visible')return;ac.resume().then(()=>v.play()).catch(()=>{})};document.addEventListener('visibilitychange',wake);v.onpause=()=>{if(!v.ended)setTimeout(wake,400)};const wd=setInterval(wake,2500);
  v.onended=()=>{document.removeEventListener('visibilitychange',wake);clearInterval(wd);sp.disconnect();ac.close&&ac.close();let n=parts.reduce((a,p)=>a+p.length,0),all=new Float32Array(n),o=0;parts.forEach(p=>{all.set(p,o);o+=p.length});
   const k=rate/16000,out=new Float32Array(Math.floor(n/k));for(let i=0;i<out.length;i++)out[i]=all[Math.floor(i*k)];URL.revokeObjectURL(v.src);ok(out)};
  v.onerror=()=>no(new Error('الفيديو مش بيشتغل على الموبايل ده'));ac.resume().then(()=>v.play()).catch(no)})}
function wav64(f32){const n=f32.length,b=new ArrayBuffer(44+n*2),d=new DataView(b);const w=(o,s)=>{for(let i=0;i<s.length;i++)d.setUint8(o+i,s.charCodeAt(i))};
 w(0,'RIFF');d.setUint32(4,36+n*2,true);w(8,'WAVE');w(12,'fmt ');d.setUint32(16,16,true);d.setUint16(20,1,true);d.setUint16(22,1,true);d.setUint32(24,16000,true);d.setUint32(28,32000,true);d.setUint16(32,2,true);d.setUint16(34,16,true);w(36,'data');d.setUint32(40,n*2,true);
 let peak=0;for(let i=0;i<n;i++)peak=Math.max(peak,Math.abs(f32[i]));const g=peak>0.001?Math.min(8,0.9/peak):1;   // تعلية الصوت الواطي
 for(let i=0;i<n;i++)d.setInt16(44+i*2,Math.max(-1,Math.min(1,f32[i]*g))*32767,true);
 let s='',u=new Uint8Array(b);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)}
/* تقسيم على أماكن السكوت عشان مانقطعش كلمة في النص */
function splitPoints(f32,len){const R=16000,out=[0];let at=0;while(at+len*R<f32.length){let tgt=at+len*R,best=tgt,bv=1e9;for(let i=tgt-4*R;i<tgt+2*R&&i<f32.length;i+=800){let e=0;for(let j=i;j<i+800&&j<f32.length;j++)e+=Math.abs(f32[j]);if(e<bv){bv=e;best=i}}at=best;out.push(at)}out.push(f32.length);return out}
/* أماكن الكلام الحقيقية من الصوت نفسه (كل ٢٠ مللي): الذكاء بيقدّر التوقيت بالتقريب، فالقص والترجمة بيمشوا على الصوت */
function vad(f32){const F=320,n=Math.floor(f32.length/F);if(n<10)return [];const E=new Float32Array(n);for(let i=0;i<n;i++){let a=0;for(let j=i*F;j<(i+1)*F;j++)a+=f32[j]*f32[j];E[i]=10*Math.log10(a/F+1e-10)}
 const so=Array.from(E).sort((a,b)=>a-b),fl=so[Math.floor(n*.05)],pk=so[Math.floor(n*.98)],thr=Math.max(fl+7,Math.min(fl+(pk-fl)*.2,pk-22)),lo=thr-3;   // حساسية أعلى + هستيريسس: الكلام الواطي وآخر الكلمات مايتحسبوش سكوت
 const I=[];let st=-1;for(let i=0;i<=n;i++){const on=i<n&&(st>=0?E[i]>lo:E[i]>thr);if(on&&st<0)st=i;if(!on&&st>=0){I.push([st*.02,i*.02]);st=-1}}
 const M=[];I.forEach(x=>{const l=M[M.length-1];if(l&&x[0]-l[1]<.3)l[1]=x[1];else M.push([x[0],x[1]])});return M.filter(x=>x[1]-x[0]>=.06).map(x=>[+Math.max(0,x[0]-.05).toFixed(2),+(x[1]+.1).toFixed(2)])}
async function callAI(b64,offset,first,tok){
 const r=await fetch(MK_URL+'/functions/v1/video-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:MK_KEY},body:JSON.stringify({audio:b64,mime:'audio/wav',offset,first,products:prods().map(p=>p.nm).filter(Boolean),gloss:gloss()})});
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('HTTP '+r.status));return j}
/* نتيجة الذكاء لكل جزء → كلام وأحداث بتوقيت الفيديو كله (نفس الشكل في العامل السحابي) */
function mergeAI(res,offs){let seg=[],ev=[],title='';
 res.forEach((r,i)=>{const off=offs[i];if(i===0)title=r.title||'';(r.segments||[]).forEach(x=>{if(String(x.t||'').trim())seg.push({s:off+(+x.s||0),e:off+(+x.e||+x.s+1),t:String(x.t).trim(),cut:!!x.cut,kw:Array.isArray(x.kw)?x.kw.map(String).filter(Boolean).slice(0,3):[]})});
  (r.events||[]).forEach(x=>{if(String(x.label||'').trim())ev.push({s:off+(+x.s||0),e:off+(+x.e||0),type:String(x.type||'point'),label:String(x.label).trim(),value:en(x.value||''),unit:String(x.unit||''),scene:String(x.scene||''),action:String(x.action||''),on:true})})});
 seg.sort((a,b)=>a.s-b.s);ev.sort((a,b)=>a.s-b.s);return {title,seg,ev}}
async function analyze(prog){
 const tok=await token();if(!tok)throw new Error('LOGIN');
 const f32=await pcmFromFile(F,prog),pts=splitPoints(f32,40),jobs=[];
 for(let i=0;i<pts.length-1;i++)jobs.push({i,a:pts[i],b:pts[i+1]});
 const res=new Array(jobs.length);let done=0;
 const run=async j=>{for(let k=0;;k++){try{res[j.i]=await callAI(wav64(f32.subarray(j.a,j.b)),j.a/16000,j.i===0,tok);break}catch(e){if(k>=2||/LOGIN|دخول|مفتاح Gemini|API key/.test(e.message))throw e;await new Promise(r=>setTimeout(r,2500*(k+1)))}}done++;prog('🧠 بفهم الكلام… '+done+' من '+jobs.length)};
 prog('🧠 بفهم الكلام… 0 من '+jobs.length);
 for(let i=0;i<jobs.length;i+=3)await Promise.all(jobs.slice(i,i+3).map(run));
 return Object.assign(mergeAI(res,jobs.map(j=>j.a/16000)),{dur:f32.length/16000,vad:vad(f32),loud:loudGain(f32,vad(f32)),peak:peakOf(f32),ch:jobs.map(j=>[j.a/16000,j.b/16000])})}

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
 if(!P){if(!S.smart||!V||V.videoWidth>V.videoHeight)return null;return {x0:.30,x1:.70,y0:.08,y1:.42,guess:1}}   // من غير كشف: تقدير لفيديو طولي
 if(!P.length)return null;let lo=0,hi=P.length-1;while(lo<hi){const mid=(lo+hi+1)>>1;if(P[mid].t<=t)lo=mid;else hi=mid-1}
 const a=P[lo],b=P[Math.min(P.length-1,lo+1)];if(Math.abs(a.t-t)>1.6&&Math.abs(b.t-t)>1.6)return null;
 if(a.none&&b.none)return null;if(a.none)return b;if(b.none||b===a)return a;const k=Math.max(0,Math.min(1,(t-a.t)/Math.max(.01,b.t-a.t)));
 return {x0:a.x0+(b.x0-a.x0)*k,x1:a.x1+(b.x1-a.x1)*k,y0:a.y0+(b.y0-a.y0)*k,y1:a.y1+(b.y1-a.y1)*k}}

/* ---------- ٢) تجهيز الترجمة والقص ---------- */
const GAPR={1:[1,.25],2:[.6,.18],3:[.4,.12]};   // مستوى القص: [أقل سكتة تتشال، المسافة اللي تفضل قبل وبعد الكلام] — أهدى من الأول عشان الكلام مايتقطعش
/* ---------- قص أذكى: إعادات حقيقية بس + حماية الكلام ---------- */
const TK=t=>norm(t).split(/\s+/).filter(w=>w.length>1);
const META=/(استن[يى]\s*(نعيد|اعيد|ثانيه)|نعيد|هعيد|اعيد تاني|كده تمام|غلطت|ايه ده)/;
const FILL=new Set(['ايه','يعني','اه','ام','امم','اممم','ااا','اها','ايوه','كده','طيب','بقي','هو']);
/* تكرار: الجملة الأقدم تتشال لو اللي بعدها (خلال دقيقتين، حتى لو في آخر الفيديو) بتقول نفس الكلام تقريبًا — وتفضل آخر مرة بس.
   تهتهة/بداية غلط: جملة قصيرة هي أول كلام جملة جاية. جملة فيها معلومة مش في اللي بعدها مابتتشالش. */
function markRepeats(){const S=D.seg||[],T=S.map(g=>TK(g.t));
 for(let i=0;i<S.length;i++){const A=T[i];if(S[i].man||A.length<2)continue;const a=new Set(A);
  for(let j=i+1;j<S.length&&S[j].s-S[i].e<120;j++){const B=T[j];if(!B.length)continue;let hit=0;a.forEach(w=>{if(B.includes(w))hit++});const cov=hit/a.size;
   const full=A.length>=4&&cov>=.75&&B.length>=A.length*.7;
   const pre=A.length<=6&&B.length>A.length&&S[j].s-S[i].e<25&&A.slice(0,Math.min(3,A.length)).every((w,k)=>B[k]===w);
   const near=S[j].s-S[i].e<12&&A.length>=3&&cov>=.9&&B.length>=A.length;
   if(full||pre||near){S[i].dup=true;S[i].cut=true;break}}}}
/* علامات «تتشال» اللي جاية من الذكاء: بنصدّقها بس لو إعادة فعلًا (تشبه جملة جاية) أو تهتهة من غير معنى أو كلام للمصوّر. غير كده الكلام يفضل */
function sanitizeCuts(){if(!D||D.cs===2)return;const S=D.seg||[];S.forEach(g=>{g.ai=!!g.cut;if(!g.man)g.cut=false});markRepeats();
 const T=S.map(g=>TK(g.t));
 S.forEach((g,i)=>{if(g.man||g.dup||!g.ai)return;const A=T[i],n=norm(g.t);
  if(META.test(n)||(A.length&&A.length<=4&&A.every(w=>FILL.has(w)))){g.cut=true;return}
  const a=new Set(A);for(let j=i+1;j<S.length&&S[j].s-g.e<60;j++){let hit=0;a.forEach(w=>{if(T[j].includes(w))hit++});if(a.size>=3&&hit/a.size>=.5){g.cut=true;break}}});
 D.cs=2}
/* أماكن الكلام الحقيقية (مدموجة): أي سكوت أقصر من ٣٥٠ مللي جوه الجملة مايتقطعش، وأي جملة مفيش عليها صوت مكتشف تتحسب كلام برضه */
function islands(){const A=(D.vad||[]).map(x=>[x[0],x[1]]);(D.seg||[]).forEach(g=>{if(!A.some(x=>x[0]<g.e&&x[1]>g.s))A.push([g.s,g.e])});A.sort((a,b)=>a[0]-b[0]);
 const M=[];A.forEach(x=>{const l=M[M.length-1];if(l&&x[0]-l[1]<.35)l[1]=Math.max(l[1],x[1]);else M.push([x[0],x[1]])});return M}
/* مدى الجملة اللي هتتشال: على حدود الصوت الحقيقي جواها، ومايتعداش ±٠٫١٢ ثانية من تقدير الذكاء (عشان مانلمسش كلمة الجملة اللي جنبها) */
function takeRange(g){const m=(D.vad||[]).filter(x=>{const c=(x[0]+x[1])/2;return c>=g.s-.05&&c<=g.e+.05});
 if(!m.length)return [Math.max(0,g.s-.04),g.e+.04];return [Math.max(0,Math.max(g.s-.12,Math.min(g.s,m[0][0]))-.02),Math.min(g.e+.12,Math.max(g.e,m[m.length-1][1]))+.02]}
/* توزيع الكلام على أماكن الصوت الحقيقية جوه كل جزء (على حسب طول الكلمات) + تحريك الكروت معاه */
function retime(){if(!D||!D.vad||!D.vad.length||D.rt||!(D.seg||[]).length)return;const chs=(D.ch&&D.ch.length)?D.ch:[[0,D.dur||1e9]],pairs=[];
 chs.forEach(([a,b])=>{const G=D.seg.filter(g=>g.s>=a-.01&&g.s<b),SP=D.vad.map(x=>[Math.max(a,x[0]),Math.min(b,x[1])]).filter(x=>x[1]-x[0]>.05);if(!G.length||!SP.length)return;
  const T=SP.reduce((s,x)=>s+x[1]-x[0],0),W=G.map(g=>Math.max(1,g.t.replace(/\s+/g,'').length+g.t.split(/\s+/).length)),tot=W.reduce((s,x)=>s+x,0);
  const at=q=>{let r=q*T;for(const x of SP){const L=x[1]-x[0];if(r<=L)return x[0]+r;r-=L}return SP[SP.length-1][1]};
  let c=0;G.forEach((g,i)=>{const ns=at(c/tot);c+=W[i];const ne=at(c/tot);pairs.push([g.s,ns]);g.s=+ns.toFixed(2);g.e=+Math.max(ns+.3,ne).toFixed(2)})});
 pairs.sort((x,y)=>x[0]-y[0]);const map=t=>{if(!pairs.length)return t;if(t<=pairs[0][0])return Math.max(0,pairs[0][1]-(pairs[0][0]-t));for(let i=1;i<pairs.length;i++)if(t<=pairs[i][0]){const [a0,a1]=pairs[i-1],[b0,b1]=pairs[i];return a1+(b1-a1)*((t-a0)/Math.max(.01,b0-a0))}const l=pairs[pairs.length-1];return l[1]+(t-l[0])};
 (D.ev||[]).forEach(x=>{const d=Math.max(0,(x.e||0)-x.s),ns=map(x.s);x.s=+ns.toFixed(2);x.e=d?+(ns+d).toFixed(2):0});D.rt=1}
function build(){retime();sanitizeCuts();const cf=CF(),cut=+O('cut')||0,takes=O('takes');CAP=[];
 const SEG=(D.seg||[]).filter(g=>!(takes&&g.cut));
 SEG.forEach(g=>{const w=g.t.split(/\s+/).filter(Boolean),n=Math.max(1,Math.ceil(w.length/cf.words)),per=Math.ceil(w.length/n),dur=Math.max(.4,g.e-g.s);
  for(let i=0;i<n;i++){const ws=w.slice(i*per,(i+1)*per);if(!ws.length)continue;const a=g.s+dur*(i*per)/w.length,b=g.s+dur*Math.min(w.length,(i+1)*per)/w.length;CAP.push({s:a,e:b,w:ws,kw:g.kw||[]})}});
 const EL={product:3,topic:2.6,step:2.8,warn:2.8,anim:3.8};
 EV=(D.ev||[]).map(x=>Object.assign(x,{e:Math.max(x.e||0,x.s+(EL[x.type]||2.4))}));
 /* الذكاء ساعات بيحط الحركة في خانة غلط أو مابيحددهاش: نصلّحها من الجملة نفسها */
 const AK=ACTIONS.map(a=>a[0]),sc0=(EV.filter(e=>e.type==='anim'&&SCF[e.scene]).map(e=>e.scene).sort((a,b,L)=>0)[0])||'flap_up';
 EV.forEach(e=>{const n=norm(e.label);
  if(e.type!=='anim'&&/ضغط|نيوتن/.test(n)&&/\d/.test(en(e.label))){e.type='anim';e.scene=sc0;e.action='force'}
  /* اسم صنف ليه رسمة (دراع، مجرى، مفصلة…) → يظهر بيشتغل بدل كارت كلام بس، لو مفيش رسمة جنبه */
  if(e.type==='product'){const m=SCN.find(([re])=>re.test(n));if(m&&!EV.some(x=>x!==e&&x.type==='anim'&&Math.abs(x.s-e.s)<3)){e.type='anim';e.scene=m[1];e.action=/تركيب|تثبيت/.test(n)?'install':'open'}}
  if(e.type!=='anim')return;if(!AK.includes(e.action)&&AK.includes(e.unit))e.action=e.unit;
  if(/تركيب|يتركب|بيتركب|التثبيت|بيتثبت/.test(n)&&(!AK.includes(e.action)||e.action==='open'))e.action='install';
  if(!AK.includes(e.action))e.action=(ACT.find(([re])=>re.test(n))||[,'open'])[1];if(!SCF[e.scene])e.scene='item';
  e.e=Math.max(e.e,e.s+(e.action==='force'?4.6:/break|compare|install/.test(e.action)?4.2:3.6))});
 /* القص: السكتات حسب المستوى + الجمل اللي الذكاء علّم عليها إنها إعادة أو تهتهة */
 let G=[];const end=(V&&V.duration)||D.dur||0;
 if(cut&&D.vad&&D.vad.length){/* السكتات من الصوت نفسه */const [mn,pad]=GAPR[cut],sp=islands();let prev=0;
  sp.forEach(x=>{if(x[0]-prev>mn+(prev?2*pad:pad))G.push([prev?prev+pad:0,x[0]-pad]);prev=Math.max(prev,x[1])});if(end-prev>mn+.4)G.push([prev+pad+.15,end])}
 else if(cut&&SEG.length){const [mn,pad]=GAPR[cut];let prev=0;
  if(SEG[0].s>mn+pad)G.push([0,SEG[0].s-pad]);
  SEG.forEach((g,i)=>{if(i&&g.s-prev>mn)G.push([prev+pad,g.s-pad]);prev=Math.max(prev,g.e)});
  if(end-prev>mn+.4)G.push([prev+pad+.15,end])}
 if(takes)(D.seg||[]).forEach(g=>{if(g.cut)G.push(takeRange(g))});
 G.sort((a,b)=>a[0]-b[0]);GAPS=[];G.forEach(g=>{if(g[1]-g[0]<.05)return;const l=GAPS[GAPS.length-1];if(l&&g[0]<=l[1]+.05)l[1]=Math.max(l[1],g[1]);else GAPS.push([g[0],g[1]])});
 CUTT=GAPS.map(g=>g[1]);
 /* الرسومات المتحركة: من الذكاء، ولو مارجعش حاجة بنطلعها من الكلام */
 if(O('anim')&&!EV.some(e=>e.type==='anim'))EV=EV.concat(autoAnims(SEG)).sort((a,b)=>a.s-b.s);
 /* رسمة واحدة في المرة: لو بدأت رسمة جديدة، اللي قبلها تخلص */
 {let prev=null;EV.forEach(e=>{if(e.type!=='anim'||!e.on)return;if(prev&&prev.e>e.s-.15)prev.e=Math.max(prev.s+1.2,e.s-.15);prev=e})}
 /* وضع «سكيل المونتاج»: كل عنصر مدته ١٫٢–٣ ثواني، اسم المنتج يظهر مرة واحدة، وأقصى عنصرين مع بعض (الرسمة بعنصرين) — اللي يزيد يتشال مش يتضغط */
 EV.forEach(e=>{e.skip=false});
 if(O('calm')){const seen=new Set(),act=[];EV.forEach(e=>{if(!showEv(e))return;if(e.type==='product'){const k=norm(e.label);if(seen.has(k)){e.skip=true;return}seen.add(k);if(O('l3'))e.e=e.s+2}
  else if(e.type!=='anim')e.e=Math.max(e.s+1.4,Math.min(e.e,e.s+3));
  const w=e.type==='anim'?2:1;let load=0;act.forEach(a=>{if(a.e>e.s)load+=a.w});if(load+w>2){e.skip=true;return}act.push({e:e.e,w})})}
 /* ملصقات الكلمات المهمة: كلمة كبيرة بإيموجي كل ٤ ثواني تقريبًا (لو مفيش كارت ظاهر ساعتها) */
 CTA=null;const od=outDur();if(O('cta')&&od>22){const s=srcT(od*.48);CTA={s,e:s+3.4}}
 STK=[];if(O('stk')){let last=-9;CAP.forEach(c=>{const k1=(c.kw||[]).find(k=>k.split(/\s+/).length<=2&&k.split(/\s+/).every(x=>c.w.some(w=>norm(w)===norm(x))));const w=k1||c.w.find(x=>isKw(x,c.kw));if(!w)return;const o=outT(c.s);if(o-last<4||o<2.6)return;if(EV.some(e=>showEv(e)&&e.s<c.e+.3&&e.e>c.s-.3))return;if(CTA&&c.s<CTA.e+.3&&c.s+1.7>CTA.s-.3)return;
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
 if(mo!=='none'&&typeof PIL!=='undefined'){const pi=PIL.find(x=>t>=x.s&&t<x.s+.55);if(pi)z+=.065*(1-ease((t-pi.s)/.55))}
 if(mo!=='none'){const st=STK.find(x=>t>=x.s&&t<x.e);if(st)z+=.045*ease((t-st.s)/.25)*(1-ease((t-st.e+.3)/.3))}
 const _fz=S.fx!==false&&mo!=='ken'?FXL.find(x=>t>=x.s&&t<x.s+.45):null;if(_fz)z+=.055*(1-ease((t-_fz.s)/.45));
 if(O('trans')==='zoom'){const d=lastCut(t);if(d!=null)z+=.09*(1-ease(d/.25))}
 /* الزووم بيتمركز على الراس عشان الوش يفضل في الكادر */
 const hd=!side&&headAt(t);let ax=W/2,ay=H/2;if(hd&&!hd.guess){ax=dx+(hd.x0+hd.x1)/2*dw;ay=dy+(hd.y0+hd.y1)/2*dh}
 let x=ax-(ax-dx)*z,y=ay-(ay-dy)*z;const w=dw*z,h=dh*z;
 if(!side){if(w>=W)x=Math.min(0,Math.max(W-w,x));if(h>=H)y=Math.min(0,Math.max(H-h,y))}
 return {side,x,y,w,h,z,k0,vw,vh}}
/* صندوق الراس على الكانفاس (مع هامش) — للكلام والكروت يبعدوا عنه */
function headRect(t){if(!S.smart)return null;const hd=headAt(t);if(!hd)return null;const f=xf(t);if(f.side)return null;const u=CV.width/1080,m=46*u;
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
function capLayout(c){const key='c'+c.s;if(LAY.has(key))return LAY.get(key);const [W,H]=[CV.width,CV.height],u=W/1080,cf=CF(),cs=O('cap'),F=`"${FONTN()}",Cairo,sans-serif`;
 const sz=Math.round(cf.sz*u*S.size);CX.font=`900 ${sz}px ${F}`;const L=wrapLines(c.w,W*(cs==='karaoke'?.80:.86)),lh=sz*1.34,h=L.length*lh+(cs==='box'||cs==='pill'?16*u:0);
 const y=capBottom()-h/2;const r={L,lh,sz,y0:y-(L.length-1)*lh/2,band:[y-h/2-10*u,y+h/2+10*u]};LAY.set(key,r);return r}
const capAt=t=>O('cap')==='none'?null:CAP.find(x=>t>=x.s&&t<x.e+.08);

/* كل حاجة تحت: الكلام في آخر الشاشة، والكروت والرسومات فوقه على طول — عند الرجلين مش على الجسم أو الوش */
function capBottom(){return CV.height*((O('safe')?.77:O('letter')?.905:.945)-(STY.on?STY.lift:0))}
function stackBase(){const u=CV.width/1080,cf=CF();if(O('cap')==='none')return capBottom();const lh=Math.round(cf.sz*u*S.size)*1.34;return capBottom()-2*lh-30*u}
const EVH={measure:250,product:215,price:145,point:120,warn:120,step:120,topic:130,anim:500};
const chipK=e=>O('chip')&&e.type!=='anim'?.8:1;
function evY(e,i){const key='e'+i+':'+e.s;if(LAY.has(key))return LAY.get(key);const H=CV.height,u=CV.width/1080,h=(EVH[e.type]||115)*u*chipK(e)*(e.type==='anim'&&O('calm')?.8:1);
 let cur=stackBase();EV.forEach((x,j)=>{if(j<i&&x.s<=e.s&&x.e>e.s&&showEv(x)){const yx=evY(x,j);if(yx!=null)cur=Math.min(cur,yx-(EVH[x.type]||115)*u*chipK(x)/2-16*u)}});
 let y=Math.max(H*.05+h/2,cur-h/2-6*u);
 if(O('calm')){/* ممنوع أي عنصر يتقاطع مع الراس (من أول الكارت لآخره) — بندوّر على أقرب مكان فاضي جوه الحدود الآمنة، ولو مفيش: العنصر يتشال */
  const hs=[0,.5,1].map(k=>headRect(e.s+(e.e-e.s)*k)).filter(Boolean),top=H*(O('safe')?.10:.05)+h/2,bot=Math.max(top,cur+h/2-6*u);
  const bad=yy=>hs.some(r=>yy+h/2>r[0]&&yy-h/2<r[1]);
  if(bad(y)||y<top){let ok=null;for(let d=0;d<H&&ok==null;d+=H*.02){for(const yy of [y-d,y+d])if(yy>=top&&yy<=bot&&!bad(yy)){ok=yy;break}}
   if(ok==null){LAY.set(key,null);return null}y=ok}}
 LAY.set(key,y);return y}
const showEv=e=>e.on&&!e.skip&&!cntHides(e)&&(e.type==='topic'?O('chap'):e.type==='anim'?O('anim'):O('ov'));

/* ---------- 🎞️ رسومات متحركة بتشرح الكلام (مكتبة مشاهد لمنتجات ميكانيزم) ----------
   كل مشهد بيترسم بالكود (من غير صور) في كارت كبير: ضلفة بتفتح لفوق بالدراع الباكم، مجرى درج، مفصلة، كالون، ركنة، بانتوجراف، مقبض.
   والحركة على حسب الكلام: open يفتح، close/soft يقفل بالراحة، break يتكسر، heavy عليه وزن، compare العادي بيتكسر قصاد الكويس. */
const SCENES=[['flap_up','ضلفة بتفتح لفوق (دراع باكم)'],['drawer','مجرى درج'],['hinge_door','مفصلة ضلفة'],['lock','كالون / قفل'],['corner_basket','ميكانيزم ركنة'],['wardrobe_lift','بانتوجراف دريسنج'],['handle','مقبض'],['item','منتج عام']];
const ACTIONS=[['open','بيفتح'],['soft','بيقفل بالراحة'],['break','بيتكسر'],['heavy','بيشيل وزن'],['compare','العادي قصاد الكويس'],['install','التركيب'],['force','الأحجام / الضغط']];
const SCX={label:''};   // جملة الرسمة الحالية (للأرقام ومكان التركيب)
const SCN=[[/باكم|بستم|بيستون|دراع|لفوق|قلاب|فلاب|ضلفه علويه/,'flap_up'],[/مجر|درج|ادراج|سحاب/,'drawer'],[/مفصل/,'hinge_door'],[/كالون|كوالين|قفل|مفتاح/,'lock'],[/ركنه|كرسيل|دوار|ركن/,'corner_basket'],[/بانتوجراف|شماع|علاق/,'wardrobe_lift'],[/مقبض|مقابض|اكر/,'handle']];
const ACT=[[/بيتكسر|يتكسر|اتكسر|بايظ|بيبوظ|بيقع|وقع|ضعيف|بيصدي|بيصدا|مش بيستحمل/,'break'],[/هادي|خبط|سوفت|بالراحه|بشويش/,'soft'],[/يشيل|كيلو|تقيل|وزن|حمل/,'heavy']];
const SC_COL={wood:'#C99A5B',woodD:'#8E6534',body:'#EFE8DA',line:'#2E2A26',metal:'#9DA7B1',metalD:'#5E6873',bad:'#E53935',good:'#2E9E52',bg:'#FBF7EF'};
const lerp=(a,b,k)=>a+(b-a)*k,cl=x=>Math.max(0,Math.min(1,x));
function scBox(x,y,w,h,f,lw){CX.beginPath();CX.rect(x,y,w,h);if(f){CX.fillStyle=f;CX.fill()}if(lw){CX.lineWidth=lw;CX.strokeStyle=SC_COL.line;CX.stroke()}}
function scLine(x1,y1,x2,y2,w,c){CX.beginPath();CX.moveTo(x1,y1);CX.lineTo(x2,y2);CX.lineWidth=w;CX.strokeStyle=c;CX.lineCap='round';CX.stroke()}
function scBadge(ok,x,y,r,a){if(a<=0)return;CX.save();CX.globalAlpha*=cl(a);CX.translate(x,y);const s=back(cl(a));CX.scale(s,s);CX.beginPath();CX.arc(0,0,r,0,7);CX.fillStyle=ok?SC_COL.good:SC_COL.bad;CX.fill();CX.lineWidth=r*.12;CX.strokeStyle='#fff';CX.stroke();
 CX.lineWidth=r*.2;CX.lineCap='round';CX.beginPath();if(ok){CX.moveTo(-r*.45,0);CX.lineTo(-r*.1,r*.35);CX.lineTo(r*.5,-r*.35)}else{CX.moveTo(-r*.4,-r*.4);CX.lineTo(r*.4,r*.4);CX.moveTo(r*.4,-r*.4);CX.lineTo(-r*.4,r*.4)}CX.stroke();CX.restore()}
function scSpark(x,y,r,a){if(a<=0||a>=1)return;CX.save();CX.translate(x,y);CX.strokeStyle='#FFB300';CX.lineWidth=r*.12;CX.lineCap='round';for(let i=0;i<8;i++){const g=i/8*Math.PI*2,r0=r*.2+r*a,r1=r0+r*.5*(1-a);CX.globalAlpha=1-a;CX.beginPath();CX.moveTo(Math.cos(g)*r0,Math.sin(g)*r0);CX.lineTo(Math.cos(g)*r1,Math.sin(g)*r1);CX.stroke()}CX.restore()}
function scWaves(x,y,k,p){CX.save();CX.strokeStyle=SC_COL.good;CX.lineWidth=4*k;for(let i=0;i<3;i++){const q=(p*2+i/3)%1;CX.globalAlpha=(1-q)*.8;CX.beginPath();CX.arc(x,y,(12+q*40)*k,-.7,.7);CX.stroke()}CX.restore()}
function scArc(cx,cy,r,a0,a1,k){CX.save();CX.setLineDash([10*k,9*k]);CX.lineWidth=3*k;CX.strokeStyle='rgba(46,42,38,.45)';CX.beginPath();CX.arc(cx,cy,r,a0,a1,a1<a0);CX.stroke();CX.restore()}
function scWeight(x,y,k,txt){CX.save();CX.translate(x,y);CX.beginPath();CX.moveTo(-34*k,0);CX.lineTo(34*k,0);CX.lineTo(26*k,-44*k);CX.lineTo(-26*k,-44*k);CX.closePath();CX.fillStyle='#37474F';CX.fill();CX.beginPath();CX.arc(0,-50*k,10*k,Math.PI,0);CX.lineWidth=5*k;CX.strokeStyle='#37474F';CX.stroke();
 CX.fillStyle='#fff';CX.font=`900 ${Math.round(17*k)}px Cairo,sans-serif`;CX.textAlign='center';CX.textBaseline='middle';CX.fillText(txt||'٥٠ كجم',0,-20*k);CX.restore()}
/* الحركة حسب الفعل: بيرجّع قيمة الفتح (0 مقفول → 1 مفتوح) وحالة الكسر */
function scMotion(act,p){if(act==='break'){const o=p<.42?ease(p/.42)*.75:p<.5?.75:Math.max(0,.75*(1-ease((p-.5)/.12)));return {o,brk:p>=.45,bp:cl((p-.45)/.4),shake:p>.5&&p<.75?Math.sin(p*120)*(1-(p-.5)/.25):0}}
 if(act==='soft'){const o=p<.2?1:1-(p<.75?ease((p-.2)/.55)*.85:.85+.15*ease((p-.75)/.25));return {o,soft:p>.6}}
 return {o:act==='heavy'?Math.min(1,ease(p/.35)):Math.min(1,back(cl(p/.45))*1),heavy:act==='heavy'}}
function scFlap(k,act,p){let m=scMotion(act==='install'?'heavy':act,p);const C=SC_COL;
 /* force: الضلفة بتفتح أعلى مع كل ضغط أكبر (الأرقام من الجملة: ٨٠ / ١٠٠ / ١٢٠) */let fN=null;
 if(act==='force'){const nums=(en(SCX.label).match(/\d{2,3}/g)||['80','100','120']).slice(0,4),n=nums.length,idx=Math.min(n-1,Math.floor(p*n)),q=p*n-idx,f=i=>.45+.55*(i+1)/n;m={o:lerp(idx?f(idx-1):0,f(idx),ease(Math.min(1,q/.45)))};fN=nums[idx]}
 CX.save();CX.translate(m.shake*6*k||0,0);
 /* جنب الدولاب (منظر جانبي) */scBox(-120*k,-105*k,150*k,210*k,C.body,4*k);scLine(-120*k,0,30*k,0,3*k,'rgba(46,42,38,.35)');
 const hx=30*k,hy=-105*k,ang=-1.85*m.o,dx=-Math.sin(ang),dy=Math.cos(ang),L=210*k;
 if(act!=='break'||!m.brk)scArc(hx,hy,L*.98,Math.PI/2,Math.PI/2-1.85,k);
 /* الدراع: من جنب الدولاب لنص الضلفة */const bx=-20*k,by=30*k,px=hx+dx*80*k,py=hy+dy*80*k;
 if(!m.brk){const mx=lerp(bx,px,.58),my=lerp(by,py,.58);scLine(bx,by,mx,my,13*k,'#263238');scLine(mx,my,px,py,5*k,C.metal)}
 else{const f=m.bp,mx=lerp(bx,px,.58),my=lerp(by,py,.58);CX.save();CX.translate(bx,by);CX.rotate(.9*f);scLine(0,0,(mx-bx)*.95,(my-by)*.95+f*40*k,13*k,'#263238');CX.restore();
  CX.save();CX.translate(px,py+f*f*120*k);CX.rotate(-1.4*f);scLine(0,0,(mx-px)*.9,(my-py)*.9,5*k,C.metal);CX.restore();scSpark(mx,my,45*k,cl(f*2.2))}
 CX.save();CX.translate(hx,hy);CX.rotate(ang);scBox(-8*k,0,16*k,L,C.wood,4*k);CX.restore();
 CX.beginPath();CX.arc(hx,hy,7*k,0,7);CX.fillStyle=C.metalD;CX.fill();
 if(m.soft)scWaves(hx+20*k,hy+L*.9,k,p);
 if(act==='install'){/* مكان التركيب بينوّر + مفك بيلف: «في الجنب» على جسم الدولاب و«في الوش» على الضلفة */const n=norm(SCX.label),side=/جنب|الجانب/.test(n),front=/وش|الضلفه|الباب/.test(n),pts=side&&!front?[[bx,by]]:front&&!side?[[px,py]]:[[bx,by],[px,py]];
  pts.forEach(([x,y],i)=>{const pu=.5+.5*Math.sin(p*14+i);CX.beginPath();CX.arc(x,y,(16+12*pu)*k,0,7);CX.lineWidth=5*k;CX.strokeStyle=SC_COL.good;CX.stroke();scScrew(x+34*k,y-34*k,k,p*8+i)})}
 if(fN){CX.save();CX.translate(-60*k,-70*k);const s=back(cl((p*3)%1/.3));CX.scale(s,s);rr(-52*k,-26*k,104*k,52*k,26*k);CX.fillStyle='#263238';CX.fill();CX.fillStyle='#FFD54F';CX.font=`900 ${Math.round(28*k)}px Cairo,sans-serif`;CX.textAlign='center';CX.textBaseline='middle';CX.fillText(ar(fN)+' نيوتن',0,2*k);CX.restore()}
 CX.restore();
 if(act==='break')scBadge(false,120*k,-80*k,30*k,(p-.62)/.15);else if(act!=='compare'&&p>.55)scBadge(true,120*k,-80*k,30*k,(p-.55)/.15)}
/* مفك بيلف (للتركيب) */
function scScrew(x,y,k,ang){CX.save();CX.translate(x,y);CX.rotate(-.7);scBox(-6*k,-40*k,12*k,30*k,'#E53935',2*k);scLine(0,-10*k,0,18*k,5*k,'#90A4AE');CX.save();CX.translate(0,20*k);CX.rotate(ang);scLine(-6*k,0,6*k,0,3*k,'#263238');CX.restore();CX.restore()}
function scDrawer(k,act,p){const m=scMotion(act==='break'?'heavy':act,p),C=SC_COL,ext=(act==='soft'?m.o:m.o)*150*k,brk=act==='break'&&p>.5,tilt=brk?.2*ease((p-.5)/.2):0;
 CX.save();CX.translate(m.shake*6*k||0,0);scBox(-150*k,-100*k,200*k,200*k,C.body,4*k);
 /* المجرى التلسكوبي: ٣ أجزاء */scBox(-140*k,38*k,185*k,9*k,C.metalD,0);scBox(-140*k+ext*.5,47*k,185*k,8*k,C.metal,0);
 CX.save();CX.translate(ext,0);CX.translate(50*k,40*k);CX.rotate(tilt);CX.translate(-50*k,-40*k);
 if(!brk)scBox(-140*k,55*k,185*k,7*k,'#CFD8DC',0);
 /* الدرج */scBox(-140*k,-40*k,190*k,80*k,'#F5EEDF',3*k);scBox(50*k,-55*k,16*k,100*k,C.wood,4*k);scBox(62*k,-14*k,8*k,26*k,C.metalD,0);
 if(m.heavy||act==='break'){const dp=cl((p-.25)/.25),wy=lerp(-170*k,-40*k,ease(dp));scWeight(-95*k,wy,k)}
 CX.restore();if(act==='soft'&&p>.25&&p<.85){for(let i=0;i<3;i++)scLine(85*k+i*18*k,(-30+i*25)*k,120*k+i*18*k,(-30+i*25)*k,4*k,'rgba(46,42,38,.35)')}
 if(m.soft)scWaves(80*k,0,k,p);if(brk)scSpark(40*k,45*k,40*k,cl((p-.5)/.3));CX.restore();
 if(act==='break')scBadge(false,-115*k,-70*k,30*k,(p-.62)/.15);else if(p>.6)scBadge(true,-115*k,-70*k,30*k,(p-.6)/.15)}
function scHinge(k,act,p){const m=scMotion(act,p),C=SC_COL,brk=act==='break'&&m.brk;CX.save();CX.translate(m.shake*6*k||0,0);
 /* منظر من فوق: جسم الدولاب + الضلفة بتلف على المفصلة */scBox(-100*k,-135*k,200*k,64*k,C.body,4*k);
 const hx=-96*k,hy=-64*k,ang=1.55*m.o;scArc(hx,hy,175*k,0,1.55,k);
 CX.save();CX.translate(hx,hy);if(brk){CX.translate(m.bp*20*k,m.bp*m.bp*60*k);CX.rotate(ang+.5*m.bp)}else CX.rotate(ang);scBox(0,-6*k,180*k,14*k,C.wood,4*k);CX.restore();
 if(!brk){CX.beginPath();CX.arc(hx+8*k,hy-12*k,11*k,0,7);CX.fillStyle=C.metalD;CX.fill()}else{for(let i=0;i<3;i++){const f=m.bp;CX.beginPath();CX.arc(hx+(10+i*16)*k+f*(i-1)*50*k,hy+f*f*(80+i*30)*k,5*k,0,7);CX.fillStyle=C.metalD;CX.fill()}scSpark(hx+8*k,hy-12*k,40*k,cl(m.bp*2))}
 if(m.soft)scWaves(hx+200*k,hy,k,p);CX.restore();
 if(act==='break')scBadge(false,120*k,60*k,30*k,(p-.62)/.15);else if(p>.55)scBadge(true,120*k,60*k,30*k,(p-.55)/.15)}
function scLock(k,act,p){const C=SC_COL,brk=act==='break',r=brk?Math.min(.35,ease(p/.4)*.35):ease(cl(p/.5))*Math.PI/2,bolt=brk?0:ease(cl((p-.4)/.3))*70*k,sh=brk&&p>.45&&p<.7?Math.sin(p*120)*6*k:0;
 CX.save();CX.translate(sh,0);scBox(-160*k,-100*k,180*k,200*k,C.wood,4*k);scBox(-20*k,-70*k,40*k,140*k,'#B0BEC5',4*k);scBox(20*k-70*k+bolt,-18*k,70*k,36*k,C.metalD,0);
 CX.beginPath();CX.arc(0,-10*k,24*k,0,7);CX.fillStyle='#FFD54F';CX.fill();CX.lineWidth=4*k;CX.strokeStyle=C.line;CX.stroke();
 CX.save();CX.translate(0,-10*k);CX.rotate(r);scBox(-5*k,-16*k,10*k,32*k,C.line,0);scBox(-26*k,-50*k,52*k,36*k,'#FFC107',3*k);CX.restore();CX.restore();
 if(brk)scBadge(false,110*k,-70*k,30*k,(p-.6)/.15);else if(p>.7)scBadge(true,110*k,-70*k,30*k,(p-.7)/.15)}
function scCorner(k,act,p){const m=scMotion(act,p),C=SC_COL,o=Math.min(1.05,m.o);
 /* منظر من فوق: دولاب ركنة على شكل L والسلة بتطلع لبرة وهي بتلف */scBox(-150*k,-120*k,150*k,240*k,C.body,4*k);scBox(-150*k,-120*k,280*k,90*k,C.body,4*k);
 scArc(-60*k,40*k,150*k,-1.2,-.1,k);
 CX.save();CX.translate(lerp(-75*k,95*k,o),lerp(-60*k,45*k,o));CX.rotate(lerp(-.6,0,o));CX.beginPath();if(CX.roundRect)CX.roundRect(-75*k,-45*k,150*k,90*k,22*k);else CX.rect(-75*k,-45*k,150*k,90*k);CX.fillStyle='rgba(157,167,177,.35)';CX.fill();CX.lineWidth=5*k;CX.strokeStyle=C.metalD;CX.stroke();
 for(let i=1;i<4;i++)scLine(-75*k+i*37*k,-40*k,-75*k+i*37*k,40*k,2.5*k,C.metal);CX.restore();if(p>.6)scBadge(true,125*k,-85*k,30*k,(p-.6)/.15)}
function scLift(k,act,p){const C=SC_COL,d=(act==='soft'?1-ease(cl(p/.8)):ease(cl(p/.55)))*110*k;scBox(-140*k,-110*k,280*k,220*k,C.body,4*k);scBox(-140*k,-110*k,280*k,24*k,C.wood,0);
 const ry=-60*k+d;scLine(-120*k,-80*k,-60*k,ry,8*k,C.metalD);scLine(120*k,-80*k,60*k,ry,8*k,C.metalD);scLine(-110*k,ry,110*k,ry,9*k,C.metal);
 for(let i=0;i<5;i++){const x=-80*k+i*40*k;scLine(x,ry,x,ry+14*k,3*k,C.line);CX.beginPath();CX.moveTo(x,ry+14*k);CX.lineTo(x-18*k,ry+34*k);CX.lineTo(x+18*k,ry+34*k);CX.closePath();CX.lineWidth=3*k;CX.strokeStyle=C.line;CX.stroke();scBox(x-15*k,ry+34*k,30*k,46*k,['#90CAF9','#F48FB1','#A5D6A7','#FFE082','#CE93D8'][i],0)}
 if(p>.6)scBadge(true,120*k,-80*k,30*k,(p-.6)/.15)}
/* المقابض: الشكل بيتغير حسب الكلام — تقليدي بمسمارين / بلت إن (مجرى في حرف الضلفة) / حرف L تحت الرخامة / حرف U و C بين الأدراج / ألوان */
function scHandle(k,act,p){const C=SC_COL,n=norm(SCX.label),pull=ease(cl((p-.35)/.3))*(1-ease(cl((p-.8)/.2))),BK='#2B2B2B',AL='#9DA7B1';
 const lbl=(t,x,y,c)=>{CX.fillStyle=c||C.line;CX.font=`800 ${Math.round(20*k)}px Cairo,sans-serif`;CX.textAlign='center';CX.textBaseline='middle';CX.fillText(t,x,y)};
 const finger=(x,y)=>{CX.save();CX.translate(x,y);CX.fillStyle='#E0AC7E';CX.strokeStyle=C.line;CX.lineWidth=3*k;CX.beginPath();if(CX.roundRect)CX.roundRect(-10*k,-30*k,20*k,46*k,10*k);else CX.rect(-10*k,-30*k,20*k,46*k);CX.fill();CX.stroke();CX.restore()};
 const pulse=(x,y,r)=>{const q=.5+.5*Math.sin(p*16);CX.beginPath();CX.arc(x,y,(r+8*q)*k,0,7);CX.lineWidth=4*k;CX.strokeStyle=C.good;CX.stroke()};
 if(/اسود|فضي|لون|الوان/.test(n)){/* الألوان: عود فضي وعود أسود بيظهروا ورا بعض */[[AL,'فضي',-70],[BK,'أسود',70]].forEach(([c,t,x],i)=>{const q=ease(cl((p-.1-i*.25)/.3));CX.save();CX.globalAlpha*=q;CX.translate(x*k,(1-q)*40*k);scBox(-18*k,-110*k,36*k,190*k,c,3*k);CX.restore();CX.globalAlpha=1;if(q>.5)lbl(t,x*k,105*k)});return}
 if(/حرف\s*l\b/i.test(n)||/ L /.test(' '+SCX.label+' ')){/* حرف L: قطاع جانبي — الرخامة فوق، الـL تحتها، والصباع بيشد حرف الضلفة */
  scBox(-150*k,-110*k,300*k,26*k,'#D9D4CC',3*k);lbl('الرخامة',-80*k,-125*k,C.metalD);scBox(-150*k,-84*k,40*k,190*k,C.body,3*k);
  const q=ease(cl(p/.3));CX.save();CX.translate(0,(1-q)*-40*k);CX.globalAlpha*=q;CX.beginPath();CX.moveTo(-110*k,-84*k);CX.lineTo(30*k,-84*k);CX.lineTo(30*k,-40*k);CX.lineTo(18*k,-40*k);CX.lineTo(18*k,-72*k);CX.lineTo(-110*k,-72*k);CX.closePath();CX.fillStyle=BK;CX.fill();CX.restore();CX.globalAlpha=1;
  CX.save();CX.translate(pull*70*k,0);scBox(30*k,-52*k,22*k,160*k,C.wood,3*k);CX.restore();finger(60*k+pull*70*k,-60*k);if(q>.9)pulse(24*k,-60*k,20);lbl('حرف L',-40*k,-30*k,C.line);if(p>.6)scBadge(true,120*k,70*k,30*k,(p-.6)/.15);return}
 if(/حرف\s*[uc]\b|بين الدرج|بين الادراج|بين الضلف/i.test(n)||/ [UC] /.test(' '+SCX.label+' ')){/* U / C: مجرى بين درجين — الصباع بيدخل ويشد الدرج اللي فوق وبعدين اللي تحت */
  scBox(-150*k,-110*k,40*k,220*k,C.body,3*k);const up=ease(cl((p-.3)/.25))*(1-ease(cl((p-.62)/.12))),dn=ease(cl((p-.7)/.2));
  CX.save();CX.translate(up*70*k,0);scBox(-110*k,-105*k,170*k,90*k,'#F5EEDF',2*k);scBox(60*k,-105*k,20*k,90*k,C.wood,3*k);CX.restore();
  CX.save();CX.translate(dn*70*k,0);scBox(-110*k,15*k,170*k,90*k,'#F5EEDF',2*k);scBox(60*k,15*k,20*k,90*k,C.wood,3*k);CX.restore();
  const q=ease(cl(p/.3));CX.save();CX.globalAlpha*=q;CX.beginPath();CX.moveTo(80*k,-15*k);CX.lineTo(40*k,-15*k);CX.lineTo(40*k,15*k);CX.lineTo(80*k,15*k);CX.lineTo(80*k,7*k);CX.lineTo(48*k,7*k);CX.lineTo(48*k,-7*k);CX.lineTo(80*k,-7*k);CX.closePath();CX.fillStyle=BK;CX.fill();CX.restore();CX.globalAlpha=1;
  finger(95*k+(p<.65?up:dn)*70*k,p<.65?-10*k:22*k);lbl(/حرف\s*c/i.test(n)||/ C /.test(' '+SCX.label+' ')?'حرف C':'حرف U',-30*k,-125*k,C.line);if(p>.85)scBadge(true,125*k,-85*k,30*k,(p-.85)/.12);return}
 if(/بلت|بيلت|built|جولا|بروفايل|عود/.test(n)){/* بلت إن: الضلفة فيها مجرى في حرفها اللي فوق — مفيش مقبض بارز */
  scBox(-150*k,-110*k,40*k,220*k,C.body,3*k);CX.save();CX.translate(pull*80*k,0);
  CX.beginPath();CX.moveTo(30*k,-105*k);CX.lineTo(60*k,-105*k);CX.lineTo(60*k,110*k);CX.lineTo(30*k,110*k);CX.closePath();CX.fillStyle=C.wood;CX.fill();CX.lineWidth=3*k;CX.strokeStyle=C.line;CX.stroke();
  const q=ease(cl(p/.3));CX.globalAlpha*=q;CX.beginPath();CX.moveTo(30*k,-105*k);CX.lineTo(60*k,-105*k);CX.lineTo(60*k,-80*k);CX.lineTo(46*k,-80*k);CX.lineTo(46*k,-92*k);CX.lineTo(30*k,-92*k);CX.closePath();CX.fillStyle=AL;CX.fill();CX.stroke();CX.restore();CX.globalAlpha=1;
  finger(75*k+pull*80*k,-110*k);if(q>.9)pulse(50*k+pull*80*k,-92*k,18);lbl('مقبض بلت إن',-30*k,0,C.line);if(p>.6)scBadge(true,120*k,70*k,30*k,(p-.6)/.15);return}
 /* تقليدي: مقبض بمسمارين — المسامير بتظهر وبعدين الضلفة بتتشد */
 const pl=Math.sin(cl((p-.45)/.4)*Math.PI)*16*k;scBox(-150*k,-105*k,300*k,210*k,C.wood,4*k);
 CX.save();CX.translate(0,-50*k);scLine(-80*k,-10*k-pl,80*k,-10*k-pl,14*k,C.metalD);scLine(-80*k,-10*k-pl,-80*k,8*k,8*k,C.metalD);scLine(80*k,-10*k-pl,80*k,8*k,8*k,C.metalD);
 [-80,80].forEach((x,i)=>{const q=back(cl((p-.1-i*.15)/.2));if(q>0){CX.save();CX.translate(x*k,18*k);CX.scale(q,q);CX.beginPath();CX.arc(0,0,8*k,0,7);CX.fillStyle='#FFD54F';CX.fill();CX.lineWidth=2*k;CX.strokeStyle=C.line;CX.stroke();scLine(-5*k,0,5*k,0,2*k,C.line);CX.restore()}});CX.restore();
 if(/مسمار/.test(n))lbl('بمسمارين',0,40*k,'#fff');if(p>.6)scBadge(true,120*k,70*k,30*k,(p-.6)/.15)}
function scItem(k,act,p){const C=SC_COL;CX.save();const s=back(cl(p/.4));CX.scale(s,s);scBox(-90*k,-70*k,180*k,140*k,'#D7B98E',4*k);scLine(-90*k,-20*k,90*k,-20*k,4*k,C.line);scLine(0,-70*k,0,70*k,4*k,'rgba(46,42,38,.4)');CX.restore();
 for(let i=0;i<5;i++){const g=i/5*Math.PI*2+p*3,r=130*k;CX.fillStyle='#FFC107';CX.globalAlpha=.5+.5*Math.sin(p*12+i);CX.font=`${Math.round(30*k)}px sans-serif`;CX.fillText('✦',Math.cos(g)*r,Math.sin(g)*r*.6)}CX.globalAlpha=1;
 if(act==='break')scBadge(false,120*k,-70*k,30*k,(p-.5)/.15);else if(p>.5)scBadge(true,120*k,-70*k,30*k,(p-.5)/.15)}
const SCF={flap_up:scFlap,drawer:scDrawer,hinge_door:scHinge,lock:scLock,corner_basket:scCorner,wardrobe_lift:scLift,handle:scHandle,item:scItem};
function drawScene(sc,act,p,k){const f=SCF[sc]||scItem;if(sc!=='flap_up'&&sc!=='handle'&&(act==='install'||act==='force')){f(k,act==='force'?'heavy':'open',act==='force'?p:1);if(act==='install'){const pu=.5+.5*Math.sin(p*14);CX.beginPath();CX.arc(-20*k,10*k,(18+12*pu)*k,0,7);CX.lineWidth=5*k;CX.strokeStyle=SC_COL.good;CX.stroke();scScrew(14*k,-24*k,k,p*8)}return}f(k,act,p)}
/* أيقونات متحركة للنقط المهمة */
const ICN=[[/ضمان/,'warranty'],[/اصلي|براند|اسباني|الماني|تركي|ايطالي|مستورد|جوده|اوريجينال/,'original'],[/شحن|توصيل|محافظ/,'shipping'],[/رسايل|رساله|واتساب|كلمنا|اتصل|الصفحه|تليفون|تواصل/,'contact'],[/متوفر|مقاسات|احجام|ضغط|الوان|انواع|موديلات/,'options'],[/تركيب|يتركب|بيتركب|تثبيت/,'tools']];
const iconFor=l=>{const n=norm(l);return (ICN.find(([re])=>re.test(n))||[,'check'])[1]};
function drawIcon(kind,x,y,r,dt,acc){CX.save();CX.translate(x,y);const s=back(cl(dt/.4));CX.scale(s,s);CX.beginPath();CX.arc(0,0,r,0,7);CX.fillStyle=acc;CX.fill();const k=r/46,D='#111';CX.strokeStyle=D;CX.fillStyle=D;CX.lineCap='round';CX.lineJoin='round';
 if(kind==='warranty'){CX.beginPath();CX.moveTo(0,-28*k);CX.lineTo(22*k,-18*k);CX.lineTo(20*k,8*k);CX.quadraticCurveTo(12*k,24*k,0,30*k);CX.quadraticCurveTo(-12*k,24*k,-20*k,8*k);CX.lineTo(-22*k,-18*k);CX.closePath();CX.lineWidth=5*k;CX.stroke();const q=cl((dt-.3)/.4);CX.beginPath();CX.moveTo(-10*k,0);if(q>0)CX.lineTo(lerp(-10,-2,cl(q*2))*k,lerp(0,9,cl(q*2))*k);if(q>.5)CX.lineTo(lerp(-2,12,(q-.5)*2)*k,lerp(9,-9,(q-.5)*2)*k);CX.lineWidth=6*k;CX.stroke()}
 else if(kind==='original'){CX.rotate(dt*1.2);CX.beginPath();for(let i=0;i<10;i++){const a=i/10*Math.PI*2-Math.PI/2,rr2=(i%2?12:28)*k;CX.lineTo(Math.cos(a)*rr2,Math.sin(a)*rr2)}CX.closePath();CX.fill()}
 else if(kind==='shipping'){const dx=((dt*40)%60-30)*k*.6;CX.translate(dx,0);CX.fillRect(-24*k,-14*k,30*k,24*k);CX.fillRect(6*k,-6*k,16*k,16*k);CX.beginPath();CX.arc(-14*k,14*k,6*k,0,7);CX.arc(14*k,14*k,6*k,0,7);CX.fill()}
 else if(kind==='contact'){CX.rotate(Math.sin(dt*25)*.25*Math.max(0,1-((dt%1.2)/.6)));CX.lineWidth=12*k;CX.beginPath();CX.arc(0,0,20*k,Math.PI*.75,Math.PI*1.75);CX.stroke();CX.fillRect(-26*k,4*k,14*k,12*k);CX.fillRect(10*k,-26*k,14*k,12*k)}
 else if(kind==='options'){[0,1,2].forEach(i=>{const h=(12+i*10)*k*ease(cl((dt-i*.15)/.3));CX.fillRect((-22+i*16)*k,18*k-h,11*k,h)})}
 else if(kind==='tools'){CX.rotate(Math.sin(dt*6)*.6);CX.lineWidth=8*k;CX.beginPath();CX.moveTo(-18*k,18*k);CX.lineTo(10*k,-10*k);CX.stroke();CX.beginPath();CX.arc(14*k,-14*k,10*k,0,7);CX.lineWidth=6*k;CX.stroke()}
 else{const q=cl(dt/.5);CX.lineWidth=8*k;CX.beginPath();CX.moveTo(-16*k,0);if(q>0)CX.lineTo(lerp(-16,-4,cl(q*2))*k,lerp(0,12,cl(q*2))*k);if(q>.5)CX.lineTo(lerp(-4,18,(q-.5)*2)*k,lerp(12,-14,(q-.5)*2)*k);CX.stroke()}
 CX.restore()}
/* ---------- 🎨 رسمة الذكاء (video-scene): أشكال بسيطة + حركتها، مخصوصة لكل جملة ---------- */
const okC=c=>typeof c==='string'&&/^(#[0-9a-f]{3,8}|rgba?\([\d.,\s%]+\)|transparent)$/i.test(c.trim())?c.trim():null;
const fin=(v,d)=>Number.isFinite(+v)&&v!==null&&v!==''?+v:d;
const kk=e=>Math.round(e.s*10)+'|'+e.label;
/* الرسومات اللي محتاجة رسمة من الذكاء + الكلام اللي حواليها */
function animList(){return EV.filter(e=>e.type==='anim'&&showEv(e)).map(e=>({key:kk(e),label:e.label,scene:e.scene,action:e.action,ctx:(D.seg||[]).filter(g=>g.e>e.s-2.5&&g.s<e.s+4.5).map(g=>g.t).join(' ').slice(0,380)||e.label})).slice(0,24)}
async function sceneMap(list,headers,prog){const out={},B=[];for(let i=0;i<list.length;i+=2)B.push(list.slice(i,i+2));let done=0;
 const run=async b=>{try{const r=await fetch(MK_URL+'/functions/v1/video-scene',{method:'POST',headers:Object.assign({'Content-Type':'application/json',apikey:MK_KEY},headers),body:JSON.stringify({items:b.map((x,i)=>({i,label:x.label,ctx:x.ctx,scene:x.scene,action:x.action}))})});
   const j=await r.json().catch(()=>({}));(j.scenes||[]).forEach(sc=>{const x=b[sc.i];if(x&&dslOk(sc))out[x.key]={shapes:sc.shapes.slice(0,40)}})}catch(e){console.warn('scene',e)}done++;prog&&prog(done,B.length)};
 for(let i=0;i<B.length;i+=3)await Promise.all(B.slice(i,i+3).map(run));return out}
function kfAt(sh,p){if(!sh._k){let cur={dx:0,dy:0,rot:0,s:1,o:1};sh._k=(Array.isArray(sh.kf)?sh.kf:[]).filter(k=>k&&Number.isFinite(+k.t)).sort((a,b)=>a.t-b.t).map(k=>{cur={t:cl(+k.t),dx:fin(k.dx,cur.dx),dy:fin(k.dy,cur.dy),rot:fin(k.rot,cur.rot),s:Math.max(0,fin(k.s,cur.s)),o:cl(fin(k.o,cur.o))};return cur})}
 const K=sh._k;if(!K.length)return {dx:0,dy:0,rot:0,s:1,o:1};if(p<=K[0].t)return K[0];
 for(let i=1;i<K.length;i++)if(p<=K[i].t){const a=K[i-1],b=K[i],q=(p-a.t)/Math.max(.001,b.t-a.t),e=q*q*(3-2*q),r={};['dx','dy','rot','s','o'].forEach(k=>r[k]=a[k]+(b[k]-a[k])*e);return r}return K[K.length-1]}
const dslOk=sc=>sc&&Array.isArray(sc.shapes)&&sc.shapes.filter(x=>x&&x.k).length>=3;
function drawDsl(sc,p,bw,bh){const k=Math.min(bw/400,bh/260);CX.save();CX.scale(k,k);CX.translate(-200,-130);CX.textAlign='center';CX.textBaseline='middle';CX.direction='rtl';
 for(const sh of sc.shapes){if(!sh||!sh.k)continue;const f=kfAt(sh,p);if(f.o<=.01)continue;CX.save();CX.globalAlpha*=f.o;
  const x=fin(sh.x,0),y=fin(sh.y,0),w=fin(sh.w,0),h=fin(sh.h,0),ox=fin(sh.ox,x+w/2),oy=fin(sh.oy,y+h/2);CX.translate(f.dx+ox,f.dy+oy);if(f.rot)CX.rotate(f.rot*Math.PI/180);if(f.s!==1)CX.scale(f.s,f.s);CX.translate(-ox,-oy);
  let fill=okC(sh.fill),stroke=okC(sh.stroke);const sw=Math.max(.5,Math.min(12,fin(sh.sw,2)));CX.lineWidth=sw;CX.lineCap='round';CX.lineJoin='round';
  if(!fill&&!stroke&&/rect|circle|path/.test(sh.k))fill='#9DA7B1';const paint=()=>{if(fill){CX.fillStyle=fill;CX.fill()}if(stroke){CX.strokeStyle=stroke;CX.stroke()}};
  try{if(sh.k==='rect'){CX.beginPath();const r=Math.min(fin(sh.rx,0),Math.abs(w)/2,Math.abs(h)/2);if(r>0&&CX.roundRect)CX.roundRect(x,y,w,h,r);else CX.rect(x,y,w,h);paint()}
   else if(sh.k==='circle'){CX.beginPath();CX.arc(x,y,Math.max(0,fin(sh.r,8)),0,7);paint()}
   else if(sh.k==='line'||sh.k==='arrow'){const x2=fin(sh.x2,x),y2=fin(sh.y2,y);CX.strokeStyle=stroke||fill||'#2E2A26';CX.beginPath();CX.moveTo(x,y);CX.lineTo(x2,y2);CX.stroke();
    if(sh.k==='arrow'){const a=Math.atan2(y2-y,x2-x),L=Math.max(8,sw*3.5);CX.fillStyle=stroke||fill||'#2E2A26';CX.beginPath();CX.moveTo(x2,y2);CX.lineTo(x2-L*Math.cos(a-.45),y2-L*Math.sin(a-.45));CX.lineTo(x2-L*Math.cos(a+.45),y2-L*Math.sin(a+.45));CX.closePath();CX.fill()}}
   else if(sh.k==='path'&&typeof sh.d==='string'&&sh.d.length<4000){const P=new Path2D(sh.d);if(fill){CX.fillStyle=fill;CX.fill(P)}if(stroke){CX.strokeStyle=stroke;CX.stroke(P)}}
   else if(sh.k==='text'&&sh.txt){CX.font=`800 ${Math.round(Math.max(12,Math.min(26,fin(sh.h,18))))}px Cairo,sans-serif`;CX.fillStyle=fill||'#2E2A26';CX.fillText(String(sh.txt).slice(0,40),x,y)}}catch(e){}
  CX.restore()}
 CX.restore()}
/* الكارت الكبير للمشهد: خلفية فاتحة + المشهد + سطر الشرح تحت. compare = نصين: العادي بيتكسر ✖ وميكانيزم ✔ */
function dk(x,y,w,h,r,a){const k=CV.width/1080;if(STY.on)r=Math.min(r*STY.rad,h/2);CX.save();CX.shadowColor='rgba(0,0,0,.45)';CX.shadowBlur=22*k;CX.shadowOffsetY=6*k;rr(x,y,w,h,r);const g=CX.createLinearGradient(0,y,0,y+h);const tn=STY.on?hexRgb(STY.color):null,mx=(c,t)=>tn?Math.round(c+(t-c)*.16):c;g.addColorStop(0,`rgba(${mx(32,tn&&tn[0])},${mx(35,tn&&tn[1])},${mx(43,tn&&tn[2])},${a})`);g.addColorStop(1,`rgba(${mx(9,tn&&tn[0])},${mx(10,tn&&tn[1])},${mx(13,tn&&tn[2])},${a})`);CX.fillStyle=g;CX.fill();CX.restore();CX.save();rr(x,y,w,h,r);CX.lineWidth=(STY.on?STY.bw:2)*k;CX.strokeStyle=STY.on?'rgba('+hexRgb(STY.color).join(',')+',.75)':'rgba(255,255,255,.16)';CX.stroke();CX.restore()}
function hexRgb(h){const m=/^#?([0-9a-f]{6})$/i.exec(h||'');if(!m)return [246,220,138];const n=parseInt(m[1],16);return [n>>16&255,n>>8&255,n&255]}
function drawAnimPanel(e,y,t,W,H,u,F,acc){const d=Math.max(1,e.e-e.s),p=cl((t-e.s)/d),pw=Math.min(W*.9,820*u),ph=Math.min(H*.27,490*u),lab=56*u;SCX.label=e.label||'';
 const a=Math.min(ease((t-e.s)/.35),1-ease((t-e.e+.35)/.35));if(a<=0)return;CX.save();CX.globalAlpha=a;CX.translate(W/2,y);const s=.85+.15*back(cl((t-e.s)/.45));CX.scale(s,s);
 rr(-pw/2,-ph/2,pw,ph,30*u);CX.fillStyle=SC_COL.bg;CX.fill();CX.lineWidth=6*u;CX.strokeStyle=acc;CX.stroke();
 CX.save();rr(-pw/2,-ph/2,pw,ph,30*u);CX.clip();const sh=ph-lab,k=sh/320;
 if(e.action==='compare'&&!dslOk(D&&D.dsl&&D.dsl[kk(e)])){const hw=pw/2;[['break',-hw/2,'العادي'],['open',hw/2,'ميكانيزم']].forEach(([ac,x,tt])=>{CX.save();CX.translate(x,-lab/2+6*u);CX.scale(.5,.5);drawScene(e.scene,ac,cl(p*1.15),k*1.05);CX.restore();
   CX.fillStyle=ac==='break'?SC_COL.bad:SC_COL.good;CX.font=`900 ${Math.round(30*u)}px ${F}`;CX.textAlign='center';CX.textBaseline='middle';CX.fillText(tt,x,-ph/2+30*u)});scLine(0,-ph/2+14*u,0,ph/2-lab-10*u,3*u,'rgba(46,42,38,.25)')}
 else{const ds=D&&D.dsl&&D.dsl[kk(e)];CX.save();CX.translate(0,-lab/2+4*u);if(dslOk(ds))drawDsl(ds,p,pw-24*u,sh-14*u);else drawScene(e.scene,e.action,p,k);CX.restore()}
 CX.restore();
 rr(-pw/2,ph/2-lab,pw,lab,0);CX.save();rr(-pw/2,-ph/2,pw,ph,30*u);CX.clip();CX.fillStyle='rgba(10,10,12,.9)';CX.fillRect(-pw/2,ph/2-lab,pw,lab);CX.restore();
 CX.fillStyle=e.action==='break'?'#FF8A80':'#fff';CX.font=`800 ${Math.round(36*u)}px ${F}`;CX.textAlign='center';CX.textBaseline='middle';CX.direction='rtl';CX.fillText(e.label||'',0,ph/2-lab/2+2*u);CX.restore()}
/* لو الذكاء مارجعش مشاهد: نطلعها من الكلام نفسه (اسم المنتج + الفعل) */
function autoAnims(SEG){const out=[];let last=-99,until=-1;SEG.forEach((g,i)=>{if(i<=until)return;const sc=SCN.find(([re])=>re.test(norm(g.t)));if(!sc)return;if(outT(g.s)<last+1.2)return;
  /* الفعل ممكن ييجي في الجملة دي أو اللي بعدها بجملتين — والرسمة تبدأ عند الجملة اللي فيها الفعل */
  let act='open',at=g;for(let j=i;j<=Math.min(SEG.length-1,i+2);j++){const f=ACT.find(([re])=>re.test(norm(SEG[j].t)));if(f){act=f[1];at=SEG[j];until=j;break}}
  const win=norm(SEG.slice(i,i+4).map(x=>x.t).join(' '));if(act==='break'&&/لكن|بس ده|اما ده|عندنا|بتاعنا|ميكانيزم|بيستحمل/.test(win))act='compare';
  out.push({s:at.s,e:at.s+(act==='break'||act==='compare'?4.2:3.6),type:'anim',scene:sc[1],action:act,label:at.t.split(/\s+/).slice(0,7).join(' '),on:true,auto:true});last=outT(at.s)+(act==='break'||act==='compare'?4.2:3.6)});return out}

function drawWord(w,x,y,o){CX.save();CX.translate(x,y);if(o.sc&&o.sc!==1)CX.scale(o.sc,o.sc);
 if(o.stroke){CX.lineWidth=o.stroke;CX.lineJoin='round';CX.strokeStyle=o.sc>1?'rgba(0,0,0,.95)':'rgba(0,0,0,.85)';CX.strokeText(w,0,0)}
 if(o.bg){const ww=CX.measureText(w).width,hh=o.size*1.12,full=ww+24*o.u,wv=Math.max(1,full*(o.wipe==null?1:o.wipe));rr(full/2-wv,-hh/2,wv,hh,12*o.u);CX.fillStyle=o.bg;CX.fill();if(o.wipe!=null&&o.wipe<1){CX.save();CX.beginPath();CX.rect(full/2-wv,-hh,wv,hh*2);CX.clip();CX.fillStyle=o.fill;CX.fillText(w,0,0);CX.restore();CX.fillStyle='#fff';CX.lineWidth=10*o.u;CX.strokeStyle='rgba(0,0,0,.85)';CX.save();CX.beginPath();CX.rect(-full/2-4*o.u,-hh,full-wv+4*o.u,hh*2);CX.clip();CX.strokeText(w,0,0);CX.fillText(w,0,0);CX.restore();CX.restore();return}}
 CX.fillStyle=o.fill;CX.fillText(w,0,0);CX.restore()}

function draw(t){if(!CV||!CX)return;const [W,H]=[CV.width,CV.height];CX.setTransform(1,0,0,1,0,0);CX.globalCompositeOperation='source-over';CX.globalAlpha=1;hqCtx();CX.fillStyle='#000';CX.fillRect(0,0,W,H);
 if(!V||!V.videoWidth)return;
 const f=xf(t);
 if(f.side){/* فيديو عرضي في ٩:١٦: خلفية مكبّرة غامقة + الفيديو كامل في النص */const kb=Math.max(W/f.vw,H/f.vh)*1.1;CX.globalAlpha=.35;if('filter' in CX)CX.filter='blur(22px)';CX.drawImage(V,(W-f.vw*kb)/2,(H-f.vh*kb)/2,f.vw*kb,f.vh*kb);if('filter' in CX)CX.filter='none';CX.globalAlpha=1;CX.drawImage(V,(W-f.w)/2,(H-f.h)/2,f.w,f.h)}
 else{const sb=stab(f,t);CX.drawImage(V,sb[0],sb[1],sb[2],sb[3])}
 applyLook(t,W,H);
 const BR=brActive(t);if(BR)drawBroll(BR,t,W,H);else BRC.forEach(c=>{if(c.v&&!c.v.paused)c.v.pause()});
 if(!BR&&typeof IML!=='undefined'){const IB=imActive(t);if(IB)drawImg(IB,t,W,H)}
 drawFinish(t,W,H);
 drawFrame(W,H,W/1080);drawLogo(W,H,W/1080);musHook();musDuck(t);
 if(O('trans')==='flash'){const d=lastCut(t);if(d!=null&&d<.16){CX.fillStyle=`rgba(255,255,255,${(.55*(1-d/.16)).toFixed(3)})`;CX.fillRect(0,0,W,H)}}
 {const tr=O('trans'),d=(tr==='slide'||tr==='rgb'||tr==='blink')?lastCut(t):null;
  if(d!=null){if(tr==='blink'&&d<.22){CX.fillStyle=`rgba(0,0,0,${(.85*Math.sin(Math.PI*d/.22)).toFixed(3)})`;CX.fillRect(0,0,W,H)}
   else if(tr==='slide'&&d<.3){const p=ease(d/.3),x=-W*.2+W*1.4*p;CX.save();CX.fillStyle=COL();CX.globalAlpha=.9*(1-p*.4);CX.beginPath();CX.moveTo(x,0);CX.lineTo(x+W*.22,0);CX.lineTo(x+W*.08,H);CX.lineTo(x-W*.14,H);CX.closePath();CX.fill();CX.restore()}
   else if(tr==='rgb'&&d<.28){const p=1-d/.28,off=Math.round(26*p*W/1080);CX.save();CX.globalCompositeOperation='lighter';CX.globalAlpha=.55*p;for(let k=0;k<5;k++){const sy=Math.floor(((k*7919+Math.floor(t*30)*131)%97)/97*H*.9),sh=Math.round(H*.06+((k*31)%7)*H*.012),dx=((k%2)?1:-1)*off*(1+k*.4);try{CX.drawImage(CV,0,sy,W,sh,dx,sy,W,sh)}catch(e){}}CX.globalCompositeOperation='source-over';CX.fillStyle='rgba(0,229,255,'+(.16*p).toFixed(3)+')';CX.fillRect(0,0,off*2,H);CX.fillStyle='rgba(255,0,110,'+(.16*p).toFixed(3)+')';CX.fillRect(W-off*2,0,off*2,H);CX.restore()}}}
 const u=W/1080,F=`"${FONTN()}",Cairo,sans-serif`,acc=COL();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 /* المقدمة والخاتمة بتوقيت الفيديو بعد القص (عشان ماتتشالش مع السكتات) */
 const dur=V.duration||D.dur||0,br=brand(),ot=outT(t),od=outDur(),inOut=S.outro&&od>4&&ot>od-outLen(),inIntro=S.intro&&D.title&&ot<2.4;
 if(O('letter')){CX.fillStyle='#000';CX.fillRect(0,0,W,H*.085);CX.fillRect(0,H*.915,W,H*.085)}
 /* مقدمة: العنوان بعيد عن الراس */
 if(inIntro){const a=1-ease((ot-1.9)/.5);CX.globalAlpha=Math.max(0,a);CX.fillStyle='rgba(0,0,0,.45)';CX.fillRect(0,0,W,H);
  const tsz=Math.round(86*u*S.size);CX.font=`900 ${tsz}px ${F}`;const L=wrapLines(D.title.split(/\s+/),W*.84),bh=L.length*tsz*1.2+90*u,ty=stackBase()-bh/2-10*u,y0=ty-bh/2+tsz*.6;
  L.forEach((l,i)=>{const y=y0+i*tsz*1.2,s=.9+.1*back(ot/.5);CX.save();CX.translate(W/2,y);CX.scale(s,s);CX.lineWidth=12*u;CX.lineJoin='round';CX.strokeStyle='rgba(0,0,0,.75)';CX.strokeText(l.join(' '),0,0);CX.fillStyle='#fff';CX.fillText(l.join(' '),0,0);CX.restore()});
  const ly=y0+L.length*tsz*1.2-tsz*.2;CX.fillStyle=acc;CX.fillRect(W/2-W*.15*ease(ot/.6),ly,W*.3*ease(ot/.6),8*u);CX.font=`700 ${Math.round(40*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,ly+48*u);CX.globalAlpha=1}
 /* الكروت وعناوين الأقسام (الوضع الآمن: مزاحة شوية بعيد عن أزرار المنصة اللي على اليمين) */
 if(O('safe')){CX.save();CX.translate(-W*.06,0)}
 EV.forEach((e,i)=>{if(BR||!showEv(e)||t<e.s||t>e.e||inOut||inIntro)return;if(evY(e,i)==null)return;if(e.type==='anim'){drawAnimPanel(e,evY(e,i),t,W,H,u,F,acc);CX.globalAlpha=1;return}const a=ease((t-e.s)/.3),out=1-ease((t-e.e+.3)/.3),al=Math.min(a,out);if(al<=0)return;CX.globalAlpha=al;const y=evY(e,i),sc=.8+.2*back((t-e.s)/.4);
  CX.save();CX.translate(W/2,y);if(chipK(e)!==1)CX.scale(chipK(e),chipK(e));
  if(e.type==='topic'){/* عنوان قسم: شريط داخل من اليمين */const sl=(1-ease((t-e.s)/.45))*W;CX.translate(sl,0);CX.font=`900 ${Math.round(58*u)}px ${F}`;const tw=CX.measureText(e.label).width,bw=Math.min(W*.92,tw+140*u);
   dk(-bw/2,-62*u,bw,124*u,18*u,.86);CX.fillStyle=acc;CX.fillRect(bw/2-22*u,-62*u,22*u,124*u);CX.fillStyle='#fff';CX.fillText(e.label,-11*u,3*u)}
  else{CX.scale(sc,sc);
  if(e.type==='measure'){const val=(e.value||'')+' '+(e.unit||''),lab=e.label||'';CX.font=`900 ${Math.round(110*u)}px ${F}`;const vwid=CX.measureText(ar(val)).width;CX.font=`700 ${Math.round(38*u)}px ${F}`;const lw=CX.measureText(lab).width,bw=Math.min(W*.92,Math.max(vwid,lw)+120*u);
   const hasL=lab&&lab.replace(/\s/g,'')!==val.replace(/\s/g,'');dk(-bw/2,(hasL?-125:-95)*u,bw,(hasL?245:190)*u,28*u,.84);CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   /* مسطرة بتتمد */const rw=(bw-80*u)*ease((t-e.s)/.6);const ry=(hasL?80:52)*u;CX.fillStyle=acc;CX.fillRect(-rw/2,ry,rw,8*u);for(let k=0;k<=10;k++){const x=-rw/2+rw*k/10;CX.fillRect(x-1.5*u,ry-(k%5?8:16)*u,3*u,(k%5?16:24)*u)}
   /* الرقم بيعدّ لحد قيمته */const num=parseFloat(e.value),cnt=isFinite(num)&&num>0?(Math.round(num*ease((t-e.s)/.7)*10)/10):null;
   CX.fillStyle=acc;CX.font=`900 ${Math.round(110*u)}px ${F}`;CX.fillText(ar(cnt!=null&&t-e.s<.7?(Number.isInteger(num)?Math.round(cnt):cnt)+' '+(e.unit||''):val),0,-14*u);if(hasL){CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText(lab,0,-90*u)}}
  else if(e.type==='product'&&O('l3')){const p=findProd(e.label),nm=p?p.nm:e.label;CX.font=`800 ${Math.round(44*u)}px ${F}`;const tw=CX.measureText(nm).width,bw=Math.min(W*.8,tw+96*u),bh=84*u;
   dk(-bw/2,-bh/2,bw,bh,14*u,.82);CX.fillStyle=acc;CX.fillRect(bw/2-10*u,-bh/2,10*u,bh*ease((t-e.s)/.35));CX.fillStyle='#fff';CX.fillText(nm,-8*u,3*u)}
  else if(e.type==='product'){const p=findProd(e.label),im=p&&prodImg[p.id],has=im&&im.complete&&im.naturalWidth;CX.font=`800 ${Math.round(46*u)}px ${F}`;const nm=p?p.nm:e.label,tw=CX.measureText(nm).width,bw=Math.min(W*.9,tw+(has?250:110)*u),bh=has?210*u:120*u;
   rr(-bw/2,-bh/2,bw,bh,26*u);CX.fillStyle='rgba(255,255,255,.96)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
   if(has){const s=170*u,r=Math.min(s/im.naturalWidth,s/im.naturalHeight);CX.drawImage(im,bw/2-20*u-s+(s-im.naturalWidth*r)/2,-s/2+(s-im.naturalHeight*r)/2,im.naturalWidth*r,im.naturalHeight*r)}
   CX.fillStyle='#111';CX.textAlign='center';CX.fillText(nm,has?-85*u:0,p&&p.pr?-18*u:0);if(p&&p.pr){CX.font=`700 ${Math.round(34*u)}px ${F}`;CX.fillStyle='#8F6A1E';CX.fillText(ar(p.pr)+' جنيه',has?-85*u:0,32*u)}}
  else if(e.type==='price'){const txt=ar((e.value||e.label)+' '+(e.unit||'جنيه'));CX.font=`900 ${Math.round(80*u)}px ${F}`;const bw=CX.measureText(txt).width+110*u,wob=1+.06*Math.sin(Math.max(0,t-e.s-.4)*6)*Math.max(0,1-(t-e.s-.4)/1.2);
   CX.scale(wob,wob);rr(-bw/2,-70*u,bw,140*u,70*u);CX.fillStyle=acc;CX.fill();CX.lineWidth=6*u;CX.strokeStyle='rgba(0,0,0,.35)';CX.stroke();CX.fillStyle='#111';CX.fillText(txt,0,4*u)}
  else if(e.type==='step'){CX.font=`800 ${Math.round(48*u)}px ${F}`;const n=ar(e.value||'•'),txt=e.label,tw=CX.measureText(txt).width,bw=Math.min(W*.92,tw+190*u);
   dk(-bw/2,-56*u,bw,112*u,56*u,.86);CX.beginPath();CX.arc(bw/2-56*u,0,44*u,0,7);CX.fillStyle=acc;CX.fill();CX.fillStyle='#111';CX.font=`900 ${Math.round(50*u)}px ${F}`;CX.fillText(n,bw/2-56*u,4*u);
   CX.fillStyle='#fff';CX.font=`800 ${Math.round(48*u)}px ${F}`;CX.fillText(txt,-50*u,3*u)}
  else if(e.type==='warn'){CX.font=`800 ${Math.round(48*u)}px ${F}`;const txt='⚠️ '+e.label,bw=Math.min(W*.92,CX.measureText(txt).width+90*u),sh=Math.sin((t-e.s)*28)*6*u*Math.max(0,1-(t-e.s)/.5);
   CX.translate(sh,0);rr(-bw/2,-58*u,bw,116*u,58*u);CX.fillStyle='rgba(200,30,30,.92)';CX.fill();CX.lineWidth=4*u;CX.strokeStyle='#FFD54F';CX.stroke();CX.fillStyle='#fff';CX.fillText(txt,0,3*u)}
  else{/* نقطة مهمة + أيقونة متحركة على حسب الكلام (ضمان، أصلي، شحن، تواصل، مقاسات، تركيب) */const ic=iconFor(e.label);CX.font=`800 ${Math.round(46*u)}px ${F}`;const tw=CX.measureText(e.label).width,bw=Math.min(W*.94,tw+190*u);
   dk(-bw/2,-60*u,bw,120*u,60*u,.88);CX.lineWidth=4*u;CX.strokeStyle=acc;CX.stroke();drawIcon(ic,bw/2-60*u,0,46*u,t-e.s,acc);CX.fillStyle='#fff';CX.fillText(e.label,-45*u,3*u)}}
  CX.restore();CX.globalAlpha=1});
 /* ملصق الكلمة المهمة: إيموجي بينط + الكلمة كبيرة مايلة + خطوط انفجار */
 STK.forEach((x,i)=>{if(BR||inOut||inIntro||t<x.s||t>x.e)return;const key='s'+i;let y=LAY.get(key);if(y==null){const cc=capAt(x.s);y=stackBase()-165*u;LAY.set(key,y)}
  const p=(t-x.s)/.35,al=Math.min(1,p*1.6,(x.e-t)/.25);if(al<=0)return;CX.save();CX.globalAlpha=Math.max(0,al);CX.translate(W/2,y);
  const bs=Math.max(.01,back(p));CX.save();CX.rotate(-.07);CX.scale(bs,bs);
  CX.strokeStyle=acc;CX.lineWidth=7*u;CX.lineCap='round';const br2=ease((t-x.s)/.45);for(let k=0;k<10;k++){const a=k/10*Math.PI*2,r0=150*u+90*u*br2,r1=r0+40*u*(1-br2);CX.globalAlpha=Math.max(0,al*(1-br2*.85));CX.beginPath();CX.moveTo(Math.cos(a)*r0*1.5,Math.sin(a)*r0*.7);CX.lineTo(Math.cos(a)*r1*1.5,Math.sin(a)*r1*.7);CX.stroke()}
  CX.globalAlpha=Math.max(0,al);CX.font=`900 ${Math.round(128*u)}px ${F}`;CX.lineJoin='round';CX.lineWidth=18*u;CX.strokeStyle='#000';CX.strokeText(x.w,0,30*u);CX.fillStyle=acc;CX.fillText(x.w,0,30*u);CX.restore();
  const bob=Math.sin((t-x.s)*9)*10*u*Math.max(0,1-(t-x.s)/1.2);CX.font=`${Math.round(96*u)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(x.em,0,-95*u+bob);CX.restore()});
 if(!BR&&!inOut&&!inIntro){drawFx(t,W,H,u,F,acc);drawFx2(t,W,H,u,F,acc);drawCount(t,W,H,u,F,acc)}
 sfxTick(t);
 /* نداء للشراء في نص الفيديو */
 if(CTA&&!BR&&!inOut&&t>=CTA.s&&t<=CTA.e){const p=ease((t-CTA.s)/.4),q=1-ease((t-CTA.e+.35)/.35),al=Math.min(p,q);if(al>0){let y=LAY.get('cta');if(y==null){const cc=capAt(CTA.s);y=stackBase()-70*u;LAY.set('cta',y)}
  const txt='📞 '+[br.cta||'اطلب دلوقتي',br.phone?ar(br.phone):''].filter(Boolean).join(' • ');CX.font=`800 ${Math.round(46*u)}px ${F}`;const bw=Math.min(W*.92,CX.measureText(txt).width+100*u);
  CX.save();CX.globalAlpha=al;CX.translate(W/2,y+(1-p)*80*u);const pl=1+.04*Math.sin((t-CTA.s)*7);CX.scale(pl,pl);rr(-bw/2,-58*u,bw,116*u,58*u);CX.fillStyle=acc;CX.fill();CX.lineWidth=5*u;CX.strokeStyle='#fff';CX.stroke();CX.fillStyle='#111';CX.fillText(txt,0,4*u);CX.restore()}}
 /* الكلام */
 const c=!inOut?capAt(t):null,cs=O('cap'),kwOn=O('kw');
 if(c){const Ly=capLayout(c),{L,lh,sz,y0}=Ly,a=ease((t-c.s)/.15);CX.font=`900 ${sz}px ${F}`;
  const nWord=Math.min(c.w.length-1,Math.floor((t-c.s)/((c.e-c.s)/c.w.length)));let wi=0;const sp=CX.measureText(' ').width;
  L.forEach((ln,li)=>{const y=y0+li*lh,txt=ln.join(' '),tw=CX.measureText(txt).width;
   if(cs==='box'||cs==='lower'||cs==='pill'||cs==='wbw'){CX.globalAlpha=cs==='lower'?a:1;rr(W/2-tw/2-28*u,y-lh/2+4*u,tw+56*u,lh-4*u,16*u);CX.fillStyle=cs==='pill'?acc:cs==='lower'?'rgba(0,0,0,.5)':cs==='wbw'?'rgba(8,9,12,.58)':'rgba(0,0,0,.66)';CX.fill()}
   const base=cs==='pill'?'#111':'#fff',hi=cs==='pill'?'#fff':acc,stroke=cs==='bold'?12*u:cs==='karaoke'?14*u:cs==='pill'?0:0;
   let x=W/2+tw/2;const pop=cs==='bold'?.94+.06*a:cs==='karaoke'?.92+.08*a:1;
   ln.forEach(w=>{const ww=CX.measureText(w).width,cur=(cs==='karaoke'||cs==='wbw')&&wi===nWord,k=kwOn&&(isKw(w,c.kw)||/d/.test(en(w)));
    const mk=k&&!cur&&(cs==='bold'||cs==='karaoke'||cs==='box');   // ماركر ملون ورا الكلمة المهمة بيتمسح من اليمين
    drawWord(w,x-ww/2,y+2*u,{u,size:sz,sc:cur?pop*1.08:k&&cs!=='lower'?pop*1.04:pop,stroke:mk?0:(cs==='pill'&&k)?6*u:stroke,fill:mk?'#111':cur||k?hi:base,bg:mk?acc:null,wipe:mk?ease((t-c.s)/.28):1});x-=ww+sp;wi++});
   CX.globalAlpha=1})}
 if(O('safe'))CX.restore();
 /* شريط التقدم + اسم المحل في الركن */
 if(O('prog')&&dur){const p=Math.min(1,ot/od),by=O('letter')?H*.085:0;CX.fillStyle='rgba(255,255,255,.25)';CX.fillRect(0,by,W,9*u);CX.fillStyle=acc;CX.fillRect(W*(1-p),by,W*p,9*u)}
 if(O('wm')&&!inOut&&!inIntro){const nm=br.shop||'ميكانيزم';CX.font=`800 ${Math.round(30*u)}px ${F}`;const tw=CX.measureText(nm).width,bw=tw+56*u,top=(O('letter')?H*.085:0)+(O('prog')?22*u:16*u),x=W-bw-18*u;
  CX.globalAlpha=.88;rr(x,top,bw,52*u,26*u);CX.fillStyle='rgba(0,0,0,.45)';CX.fill();CX.beginPath();CX.arc(x+bw-22*u,top+26*u,7*u,0,7);CX.fillStyle=acc;CX.fill();CX.fillStyle='#fff';CX.fillText(nm,x+bw/2-8*u,top+28*u);CX.globalAlpha=1}
 /* الخاتمة */
 if(inOut){const a=ease((ot-(od-outLen()))/.4),oy=stackBase()-260*u;drawQR(W,H,u,oy,a,acc,F);CX.globalAlpha=a;rr(W*.08,oy,W*.84,250*u,30*u);CX.fillStyle='rgba(10,10,12,.88)';CX.fill();CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
  CX.fillStyle=acc;CX.font=`900 ${Math.round(64*u)}px ${F}`;CX.fillText(br.shop||'ميكانيزم',W/2,oy+70*u);CX.fillStyle='#fff';CX.font=`700 ${Math.round(38*u)}px ${F}`;CX.fillText([br.cta||'اطلب دلوقتي',br.phone?ar(br.phone):''].filter(Boolean).join(' • '),W/2,oy+140*u);if(br.addr){CX.font=`600 ${Math.round(32*u)}px ${F}`;CX.fillText(br.addr,W/2,oy+195*u)}CX.globalAlpha=1}}

/* ---------- ٤) المعاينة ---------- */
function loop(){cancelAnimationFrame(raf);const f=()=>{if(!V)return;const g=!V.paused&&inGap(V.currentTime);if(g&&!REC){V.currentTime=g[1]}draw(V.currentTime);updBar();raf=requestAnimationFrame(f)};raf=requestAnimationFrame(f)}
function updBar(){const s=$s('sm_seek');if(s&&V&&V.duration&&!s._drag){s.value=V.currentTime/V.duration*1000}const l=$s('sm_tm');if(l&&V)l.textContent=fmt(V.currentTime)+' / '+fmt(V.duration)+(GAPS.length?' ← '+fmt(outDur()):'')}
function hqCtx(){try{CX.imageSmoothingEnabled=true;CX.imageSmoothingQuality='high'}catch(e){}}
function hqBits(W,H,fps){return Math.round(Math.max(6e6,Math.min(42e6,W*H*fps*.3)))}
function setupCanvas(){CV=$s('sm_cv');if(!CV)return;const [w,h]=dims();CV.width=w;CV.height=h;CX=CV.getContext('2d',{alpha:false,desynchronized:false});hqCtx();LAY.clear();draw(V?V.currentTime:0)}

/* ---------- ٥) التصدير ---------- */
async function exportVid(){if(busy)return;if(typeof MediaRecorder==='undefined'||!CV.captureStream)return say('المتصفح ده مش بيدعم التصدير — حدّث iOS');
 const mt=['video/mp4;codecs=avc1.640033','video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1.4d0028','video/mp4;codecs=avc1','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mt)return say('التصدير مش مدعوم على الموبايل ده');
 busy=true;const btn=$s('sm_ex');btn.disabled=true;
 try{setupCanvas();V.pause();V.currentTime=GAPS.length&&GAPS[0][0]<=0?GAPS[0][1]:0;await new Promise(r=>{V.onseeked=()=>{V.onseeked=null;r()};setTimeout(r,800)});
  let WL=null;try{WL=await navigator.wakeLock.request('screen')}catch(e){}
  const AC=window.AudioContext||window.webkitAudioContext;if(!V._ac){try{V._ac=new AC({sampleRate:48000,latencyHint:'playback'})}catch(e){V._ac=new AC()}V._src=V._ac.createMediaElementSource(V);V._dst=V._ac.createMediaStreamDestination();V._src.connect(V._ac.destination);const a=V._ac,hp=a.createBiquadFilter();hp.type='highpass';hp.frequency.value=85;const pk=a.createBiquadFilter();pk.type='peaking';pk.frequency.value=3000;pk.Q.value=1;pk.gain.value=3;const cp=a.createDynamicsCompressor();cp.threshold.value=-26;cp.knee.value=8;cp.ratio.value=4;cp.attack.value=.005;cp.release.value=.2;const mg=a.createGain();mg.gain.value=Math.max(1,Math.min(3.2,(D&&D.loud?D.loud.gain*1.15:1.7)));hp.connect(pk);pk.connect(cp);cp.connect(mg);const gt=a.createGain(),an=a.createAnalyser();an.fftSize=1024;mg.connect(an);V._gt=gt;V._an=an;V._cl=[hp,mg]}
  {const [hp,mg]=V._cl;try{V._src.disconnect(V._dst)}catch(e){}try{V._src.disconnect(hp)}catch(e){}try{mg.disconnect()}catch(e){}try{V._gt.disconnect()}catch(e){}GF=null;V._gt.gain.value=1;if(S.clean!==false){V._src.connect(hp);mg.connect(V._an);mg.connect(V._gt);V._gt.connect(V._dst)}else V._src.connect(V._dst)}
  await V._ac.resume();HQOFF.sharp=HQOFF.dn=HQOFF.clar=false;HQOFF.ema=0;const FPS=S.fps===60?60:30,st=CV.captureStream(FPS);V._dst.stream.getAudioTracks().forEach(tr=>st.addTrack(tr));
  const ch=[];const VB=hqBits(CV.width,CV.height,FPS);try{REC=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:VB,audioBitsPerSecond:256000})}catch(e){REC=new MediaRecorder(st,{mimeType:mt,videoBitsPerSecond:VB})}REC.ondataavailable=e=>e.data&&e.data.size&&ch.push(e.data);
  const total=outDur();let rendered=0,lastT=V.currentTime;
  const stop=new Promise(r=>REC.onstop=r),vis=()=>{if(!REC)return;if(document.hidden){try{REC.pause()}catch(e){}V.pause();say('⏸️ وقفت التسجيل لأنك خرجت من الصفحة — ارجع وهيكمل')}else{try{REC.resume()}catch(e){}V.play().catch(()=>{})}};document.addEventListener('visibilitychange',vis);V.muted=false;REC.start(500);await V.play();if(MU.buf)musStart();
  await new Promise(res=>{const tick=()=>{if(!REC)return res();try{gateTick()}catch(e){}const t=V.currentTime;if(t>lastT)rendered+=t-lastT;lastT=t;
    const g=inGap(t);if(g&&!V.seeking){if(g[1]>=V.duration-.05)return res();try{REC.pause()}catch(e){}V.currentTime=g[1];lastT=g[1];V.onseeked=()=>{V.onseeked=null;try{REC.resume()}catch(e){}}}
    btn.textContent='⏺️ بسجّل الفيديو… '+Math.min(99,Math.round(rendered/total*100))+'%';if(V.ended||t>=V.duration-0.05)return res();setTimeout(tick,60)};V.onended=()=>res();tick()});
  REC.stop();await stop;const hqCut=HQOFF.sharp||HQOFF.dn||HQOFF.clar;HQOFF.sharp=HQOFF.dn=HQOFF.clar=false;document.removeEventListener('visibilitychange',vis);try{WL&&WL.release()}catch(e){}V.pause();const blob=new Blob(ch,{type:mt.split(';')[0]}),ext=/mp4/.test(mt)?'mp4':'webm',name='ميكانيزم-'+new Date().toISOString().slice(0,10)+'.'+ext,file=new File([blob],name,{type:blob.type});
  musStop();REC=null;btn.textContent='💾 صدّر الفيديو';btn.disabled=false;busy=false;
  if(blob.size<150000&&total>2&&!EXRETRY&&(S.q>720||S.fps===60)){EXRETRY=true;S.q=720;S.fps=30;saveS();setupCanvas();const qq=$s('sm_q');if(qq)qq.value='720';say('⚠️ التسجيل طلع فاضي بالجودة العالية — بعيده تلقائي بجودة ٧٢٠');try{return await exportVid()}finally{EXRETRY=false}}
  libPut(blob,name,D&&D.title).then(()=>{renderLib();const n=$s('sm_ln');if(n)n.textContent='✅ اتحفظ كمان في «📚 فيديوهاتي» فوق — هتلاقيه حتى لو قفلت الصفحة.'}).catch(()=>{const n=$s('sm_ln');if(n)n.textContent='⚠️ ماقدرتش أحفظه في «فيديوهاتي» (المساحة؟) — شاركه أو نزّله دلوقتي.'});
  const out=$s('sm_out');out.innerHTML=`<div class="p"><h2>✅ الفيديو جاهز (${(blob.size/1048576).toFixed(1)} ميجا)</h2><p class="mu" style="margin:0 0 6px">📊 ${CV.width}×${CV.height} — ${FPS} إطار/ث — ${(blob.size*8/Math.max(1,total)/1e6).toFixed(1)} ميجابت/ث${blob.size*8/Math.max(1,total)<VB*.55?' ⚠️ المتصفح قلّل الجودة — جرّب جودة أقل أو فيديو أقصر':' ✅ جودة عالية'}${hqCut?' — ⚡ الجهاز بطيء فقفلت الشحذ/التنعيم تلقائي عشان الحركة ماتتقطعش':''}${Math.min(V.videoWidth,V.videoHeight)<Math.min(CV.width,CV.height)*.95?' — الفيديو الأصلي أقل دقة من التصدير، مش هيزيد تفاصيل':''}</p><video src="${URL.createObjectURL(blob)}" controls playsinline style="width:100%;max-height:60vh;border-radius:12px;background:#000"></video>
   <button class="b" id="sm_sh" style="width:100%;margin-top:8px">📤 شارك / احفظ في الصور</button><a class="b o" style="width:100%" download="${esc(name)}" href="${URL.createObjectURL(blob)}">⬇️ تنزيل الملف</a>
   <p class="mu" id="sm_ln">⏳ بحفظه في «فيديوهاتي»…</p><p class="mu">من «شارك» تقدر تحفظه في الصور أو تبعته على طول لتيك توك وإنستجرام وفيسبوك.${ext!=='mp4'?' (الصيغة WebM — لو المنصة رفضته نزّله واستخدم تحويل)':''}</p></div>`;
  $s('sm_sh').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:D.title||'ميكانيزم'});else say('المشاركة مش متاحة — استخدم «تنزيل الملف»')}catch(e){}};
  out.scrollIntoView({behavior:'smooth'})}
 catch(e){REC=null;busy=false;btn.disabled=false;btn.textContent='💾 صدّر الفيديو';say('❌ التصدير وقف: '+(e.message||e))}}

/* ---------- الشاشة ---------- */
const sel=(id,list,v)=>`<select id="${id}">${list.map(x=>`<option value="${x[0]}" ${String(v)===String(x[0])?'selected':''}>${x[1]}</option>`).join('')}</select>`;
const chk=(id,v,txt)=>`<label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="${id}" ${v?'checked':''}> ${txt}</label>`;
function paintOpts(){const el=$s('sm_op');if(!el)return;
 el.innerHTML=`<div class="r2"><label>شكل الكلام${sel('so_cap',CAPS,O('cap'))}</label><label>حركة الكاميرا${sel('so_mo',MOTIONS,O('motion'))}</label>
  <label>شيل السكتات${sel('so_cut',CUTS,O('cut'))}</label><label>الألوان${sel('so_lk',LOOKS,O('look'))}</label><label>الانتقال عند القطع${sel('so_tr',TRANS,O('trans'))}</label></div>
  <div class="r2" style="margin-top:8px">${chk('so_tk',O('takes'),'شيل الإعادات والتهتهة')}${chk('so_kw',O('kw'),'لوّن الكلمات المهمة')}${chk('so_ov',O('ov'),'كروت المقاسات والأصناف والأسعار')}${chk('so_ch',O('chap'),'عناوين الأقسام')}${chk('so_pr',O('prog'),'شريط تقدم فوق')}${chk('so_wm',O('wm'),'اسم المحل في الركن')}${chk('so_lt',O('letter'),'شرايط سينما')}${chk('so_an',O('anim'),'🎞️ رسومات متحركة بتشرح الكلام')}${chk('so_st',O('stk'),'ملصقات للكلمات المهمة بإيموجي')}${chk('so_ct',O('cta'),'نداء «اطلب دلوقتي» في النص')}${chk('so_fx',O('sfx'),'أصوات مع الرسومات (في الخلفية)')}${chk('so_sm',S.smart,'👀 الكلام مايغطيش وشّي')}${chk('so_sf',O('safe'),'🛡️ بعيد عن واجهة تيك توك/ريلز')}${chk('so_cl',O('calm'),'🎯 أقصى عنصرين + ولا عنصر على الوش')}${chk('so_cp',O('chip'),'كروت صغيرة')}${chk('so_l3',O('l3'),'اسم المنتج شريط صغير مرة واحدة')}</div>`;
 const set=(id,k,f)=>{$s(id).onchange=()=>{const v=f($s(id));if(k==='smart')S.smart=v;else S.o[k]=v;saveS();changed()}};
 set('so_cap','cap',x=>x.value);set('so_mo','motion',x=>x.value);set('so_cut','cut',x=>+x.value);set('so_lk','look',x=>x.value);
 set('so_tk','takes',x=>x.checked);set('so_kw','kw',x=>x.checked);set('so_ov','ov',x=>x.checked);set('so_ch','chap',x=>x.checked);set('so_pr','prog',x=>x.checked);set('so_wm','wm',x=>x.checked);set('so_lt','letter',x=>x.checked);set('so_tr','trans',x=>x.value);set('so_st','stk',x=>x.checked);set('so_an','anim',x=>x.checked);set('so_ct','cta',x=>x.checked);set('so_fx','sfx',x=>x.checked);set('so_sm','smart',x=>x.checked);set('so_sf','safe',x=>x.checked);set('so_cl','calm',x=>x.checked);set('so_cp','chip',x=>x.checked);set('so_l3','l3',x=>x.checked)}
function changed(){LK.t=-9;if(D&&V){build();renderLists();draw(V.currentTime);updBar()}}
function paint(){const el=$s('v-smart');if(!el)return;
 el.innerHTML=`<h1>🎬 مونتاج ذكي</h1><p class="mu">ارفع الفيديو اللي صورته — السيستم بيسمع كلامك، يشيل السكتات والإعادات، يكتب الكلام على الفيديو من غير ما يغطي وشك، ويظهر المقاسات والأصناف والأسعار والخطوات وقت ما تقولها، ويظبط الألوان. اختار الطريقة وبعدين «صدّر» أو «اعمله في الخلفية».</p>
 <div class="p" style="border:2px solid #F6DC8A"><button type="button" class="b" id="sm_one" style="width:100%;min-height:56px;font-size:18px">🪄 ظبّط كل حاجة لأفضل جودة (ضغطة واحدة)</button><div id="sm_onem" class="mu" style="margin-top:6px">مش عايز تفكر في الإعدادات؟ دوس هنا واختار الفيديو، والباقي علينا.</div></div>
 <div id="sm_auth"></div>
 <div class="p"><h2>١) الفيديو</h2><label class="b" style="width:100%;cursor:pointer">📹 اختار الفيديو<input type="file" id="sm_f" accept="video/*" style="display:none"></label><div id="sm_fi" class="mu"></div></div>
 <div class="p"><h2>📚 فيديوهاتي (متخزنة على الجهاز ده)</h2><div id="sm_lib"></div><p class="mu" style="margin:6px 0 0">بتفضل بعد ما تقفل الصفحة، بس على الموبايل ده وبالمتصفح ده بس (مش على موبايل تاني). آخر ١٥ فيديو.</p></div>
 <p class="mu" style="margin:0 0 8px;text-align:center">نسخة المونتاج: <b>١١ نوفمبر ٢٠٢٦ — ن</b> (مربوط بالسيستم والموقع + صور ذكية + مخرج ذكي + QR + ترجمة)</p>
 <div class="p"><h2>🎵 موسيقى خلفية ولوجو (اختياري)</h2><p class="mu" style="margin:0 0 6px">الموسيقى بتوطى لوحدها وانت بتتكلم وتعلى في السكوت، وبتتسجل في الفيديو المتصدّر. اللوجو بيتحفظ مرة واحدة ويظهر فوق على الشمال في كل فيديو.</p><div style="display:flex;gap:6px"><label class="b o" style="flex:1;cursor:pointer">🎵 اختار موسيقى<input type="file" id="sm_mf" accept="audio/*,.mp3,.m4a,.aac,.wav" style="display:none"></label><label class="b o" style="flex:1;cursor:pointer">🏷️ ارفع اللوجو<input type="file" id="sm_lg" accept="image/*" style="display:none"></label></div><label class="mu" style="display:flex;gap:8px;align-items:center;margin-top:6px">علو الموسيقى<input type="range" id="sm_mv" min="5" max="80" value="30" style="flex:1"></label><div id="sm_mi" class="mu"></div><div id="sm_lgi" class="mu"></div><div id="sm_lgc" style="display:none;margin-top:8px"><label class="mu" style="display:flex;gap:8px;align-items:center">حجم اللوجو<input type="range" id="sm_lgs" min="60" max="420" value="170" style="flex:1"><b id="sm_lgsv"></b></label><div class="r2" style="margin-top:6px"><label class="mu">مكان اللوجو<select id="sm_lgp"><option value="tl">فوق شمال</option><option value="tr">فوق يمين</option><option value="tc">فوق في النص</option></select></label><label class="mu">الشفافية<input type="range" id="sm_lgo" min="30" max="100" value="95"></label></div></div></div>
 <div class="p"><h2>🎞️ فيديوهات الإدراج (اختياري)</h2><p class="mu" style="margin:0 0 6px">ارفع الفيديوهات اللي عايزها تظهر تحت وانت بتتكلم. كل ما تقول «هيظهرلكم فيديو تحت» أو «هتشوفوا» أو «يظهر»، بيظهر الفيديو اللي بعده بالترتيب في نص الشاشة تحت وشك، ويرجع لوحده. (بيشتغل في «اعمله هنا على الموبايل» مش في الخلفية).</p><label class="b o" style="width:100%;cursor:pointer">➕ ضيف فيديو إدراج<input type="file" id="sm_bf" accept="video/*" multiple style="display:none"></label><div id="sm_bi" class="mu"></div></div>
 <div class="p" id="sm_sys"><h2>🔎 منتجات ميكانيزم (السيستم + الموقع)</h2><p class="mu" style="margin:0 0 6px">دوّر على أي منتج واختاره للفيديو: اسمه وسعره وصوره بيدخلوا في المونتاج والكروت والذكاء على طول.</p><div id="sm_sysl"></div><input id="sm_sysq" placeholder="🔎 اسم المنتج أو الكود" style="width:100%;margin-bottom:8px"><div id="sm_sysr" style="max-height:50vh;overflow:auto"></div><div id="sm_syss"></div></div>
 <div class="p"><h2>🖼️ صور الإدراج الذكي (اختياري)</h2><p class="mu" style="margin:0 0 6px">ارفع ١٠ لـ ٢٠ صورة (صور الآيفون HEIC عادي). السيستم بيفهم كل صورة وبيظهرها في اللحظة اللي بتتكلم فيها عن حاجة ليها علاقة بيها (مثلًا صورة الموقع لما تقول العنوان). بيشتغل في «اعمله هنا على الموبايل» مش في الخلفية.</p><label class="b o" style="width:100%;cursor:pointer">➕ ضيف صور<input type="file" id="sm_if" accept="image/*,.heic,.heif" multiple style="display:none"></label><div id="sm_ii" class="mu"></div><div class="r2" style="margin-top:8px"><label>شكل الصورة<select id="sm_ist"><option value="auto">كارت تحت الوش (تلقائي)</option><option value="full">ملء الشاشة</option></select></label></div><button type="button" class="b o" id="sm_imb" style="width:100%;margin-top:6px">🧠 طابق الصور بالكلام تاني</button></div>
 <div class="p"><h2>🎨 الشكل: لون + خط + إطار</h2><div id="sm_modes" style="display:flex;gap:6px;flex-wrap:wrap"></div><div id="sm_sty" style="margin-top:8px"></div><div id="sm_cu" style="display:none;margin-top:8px"></div><div class="mu" style="margin:10px 0 4px">كل البصمات قدامك — دوس على اللي عاجبك:</div><div id="sm_gal" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div><button type="button" class="b o" id="sm_rer" style="width:100%;margin-top:8px">🎲 بصمة عشوائية جديدة</button><p class="mu" style="margin:6px 0 0">«تنويع تلقائي» بيغيّر البصمة مع كل فيديو ومابيكررش آخر ٦. «عادي» و«هادي خالص» ثابتين. «مخصص» تختار أي لون مع أي خط.</p></div>
 <div class="p"><h2>٢) طريقة المونتاج</h2><div id="sm_tp" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
  <details style="margin-top:10px" ${Object.keys(S.o).length?'open':''}><summary style="cursor:pointer;font-weight:800;padding:6px 0">⚙️ تخصيص (غيّر أي حاجة في القالب)</summary><div id="sm_op" style="margin-top:6px"></div></details>
  <div class="r2" style="margin-top:10px"><label>الخط<select id="sm_ft">${FONTS.map(f=>`<option value="${f[0]}" ${S.font===f[0]?'selected':''} style="font-family:'${f[0]}'">${f[1]}</option>`).join('')}</select></label>
  <label>لون التمييز<select id="sm_cl">${COLORS.map(c=>`<option value="${c[0]}" ${S.color===c[0]?'selected':''}>${c[1]}</option>`).join('')}</select></label>
  <label>حجم الكلام<input type="range" id="sm_sz" min="0.7" max="1.5" step="0.05" value="${S.size}"></label>
  <label>المقاس<select id="sm_as"><option value="916" ${S.aspect==='916'?'selected':''}>طولي ٩:١٦ (تيك توك/ريلز)</option><option value="orig" ${S.aspect==='orig'?'selected':''}>زي الفيديو الأصلي</option></select></label>
  <label>الجودة<select id="sm_q"><option value="1440" ${S.q==1440?'selected':''}>فائقة 1440 (أنقى — أبطأ وأتقل)</option><option value="1080" ${S.q==1080?'selected':''}>عالية جدًا 1080</option><option value="720" ${S.q==720?'selected':''}>متوسطة 720 (أسرع وأخف)</option></select></label>
  <label>نعومة الحركة<select id="sm_fps"><option value="30" ${S.fps!=60?'selected':''}>٣٠ إطار (عادي)</option><option value="60" ${S.fps==60?'selected':''}>٦٠ إطار (لو صوّرته ٦٠)</option></select></label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_cr" ${S.clar!==false?'checked':''}> ✨ وضوح وعمق للصورة</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_hqs" ${S.sharp!==false?'checked':''}> 🔪 شحذ احترافي للتفاصيل</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_hqd" ${S.dn!==false?'checked':''}> 🧼 تقليل الضوضاء (المشاهد الثابتة)</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_hqa" ${S.auto!==false?'checked':''}> 🎨 ضبط النور واللون تلقائي</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_hqb" ${S.stab?'checked':''}> 📐 تثبيت اهتزاز الكاميرا (بيقص ٨٪)</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_hqg" ${S.gate!==false?'checked':''}> 🔇 بوابة ضوضاء (تهدّي الورشة وقت السكوت)</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_pi" checked> 🔔 كسر الملل (نبضة زووم لو الشاشة واقفة)</label><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_tr"> 🌍 ترجمة إنجليزي تحت الكلام</label><div id="sm_trm" class="mu" style="grid-column:1/-1"></div><div style="grid-column:1/-1;display:flex;gap:6px"><button type="button" class="b o" id="sm_bps" style="flex:1;min-height:44px">💾 احفظ بصمة المحل</button><button type="button" class="b o" id="sm_bpa" style="flex:1;min-height:44px">🏷️ طبّق البصمة</button></div>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_cln" ${S.clean!==false?'checked':''}> 🎙️ نضّف صوتي وثبّت علوّه في الفيديو المتصدّر</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_fx" ${S.fx!==false?'checked':''}> ✨ لمسات ذكية (شارات وأرقام متحركة من كلامك)</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_in" ${S.intro?'checked':''}> عنوان في الأول</label>
  <label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_ou" ${S.outro?'checked':''}> اسم المحل وتليفونه في الآخر</label><div style="grid-column:1/-1"><label style="display:flex;gap:6px;align-items:center"><input type="checkbox" id="sm_qro" checked> 📲 كود QR في الآخر (يفتح واتساب المحل أو لينكك)</label><input id="sm_qr" placeholder="لينك الكود (سيبه فاضي = واتساب المحل)" style="width:100%;margin-top:6px" dir="ltr"><div id="sm_qrm" class="mu" style="margin-top:4px;word-break:break-all"></div></div></div></div>
 
 <button class="b" id="sm_go" style="width:100%;min-height:62px;font-size:19px">✨ اعمل المونتاج الذكي</button><div id="sm_pg" class="mu" style="text-align:center;margin:6px 0"></div>
 <div id="sm_res" style="display:none"><div class="p"><h2>٣) المعاينة</h2><canvas id="sm_cv" style="width:100%;max-height:70vh;object-fit:contain;background:#000;border-radius:12px;display:block"></canvas>
  <div style="display:flex;gap:8px;align-items:center;margin-top:8px"><button class="b" id="sm_pl" style="flex:none;min-width:64px">▶️</button><input type="range" id="sm_seek" min="0" max="1000" value="0" style="flex:1"><span id="sm_tm" class="mu" style="flex:none"></span></div>
  <button class="b" id="sm_ex" style="width:100%;min-height:56px;font-size:18px;margin-top:8px">💾 صدّر الفيديو</button><div style="display:flex;gap:6px;margin-top:6px"><button class="b o" id="sm_srt" style="flex:1">⬇️ ترجمة SRT</button><button class="b o" id="sm_cov" style="flex:1">🖼️ صورة غلاف</button></div><button class="b o" id="sm_post" style="width:100%;margin-top:6px">📝 انسخ نص البوست (عنوان + وصف + هاشتاجات)</button><div style="display:flex;gap:6px;margin-top:6px"><button class="b o" id="sm_scb" style="flex:1">📊 قوة الفيديو</button><button class="b o" id="sm_chb" style="flex:1">⏱️ انسخ الفصول</button><button class="b o" id="sm_pv" style="flex:1">▶️ معاينة ١٠ث</button></div><div id="sm_sc" class="mu" style="white-space:pre-line;margin-top:6px"></div></div>
  <div class="p"><h2>✍️ الكلام (دوس على الوقت تروح له، عدّل الكلمة لو غلط، و✂️ = الجملة دي هتتشال)</h2><input id="sm_ti" placeholder="عنوان الفيديو" style="width:100%;margin-bottom:8px"><div id="sm_cap" style="max-height:45vh;overflow:auto"></div></div>
  <div class="p"><h2>🧾 اللي اتطبّق على الفيديو ده</h2><div id="sm_ap" style="line-height:1.9"></div><button type="button" class="b o" id="sm_rp" style="width:100%;margin-top:8px">📋 انسخ تقرير الفيديو وابعته لـ Claude</button></div>
 <div class="p"><h2>🎞️ أماكن فيديوهات الإدراج</h2><div id="sm_bl"></div></div>
  <div class="p"><h2>🖼️ أماكن الصور</h2><div id="sm_il"></div></div>
  <div class="p"><h2>🎬 المخرج الذكي</h2><p class="mu" style="margin:0 0 6px">بيراجع كلامك كأنه مخرج: يختار أقوى بداية، يطلّع هوك تاني تقارن بيه، يشيل الجمل الضعيفة، ويقولك ناقصك إيه في الإعلان.</p><div id="sm_dir"></div></div>
  <div class="p"><h2>📐 التوضيحات اللي هتظهر</h2><div id="sm_ev"></div></div></div>
 <div id="sm_out"></div>
 <div class="p" id="sm_jobsbox"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">☁️ فيديوهاتي (في الخلفية)</h2><button type="button" class="b o" id="sm_rf" style="flex:none;padding:8px 14px">🔄 تحديث</button></div><small id="sm_rt" class="mu"></small><div id="sm_jobs" class="mu" style="margin-top:8px">⏳</div></div>`;
 /* الدخول */
 token().then(t=>{const a=$s('sm_auth');if(!a)return;if(!t){a.innerHTML=loginBox();$s('sm_li').onclick=doLogin}else a.innerHTML=''}).catch(()=>{});
 $s('sm_tp').innerHTML=Object.keys(TPL).sort((a,b)=>a==='mix'?-1:b==='mix'?1:0).map(k=>`<button type="button" data-tp="${k}" class="b ${S.tpl===k?'':'o'}" style="display:block;text-align:right;min-height:84px;white-space:normal;line-height:1.5"><b style="font-size:16px">${TPL[k].n}</b><br><span style="font-size:12px;font-weight:500">${TPL[k].d}</span></button>`).join('');
 $s('sm_tp').onclick=e=>{const b=e.target.closest('[data-tp]');if(!b)return;S.tpl=b.dataset.tp;S.o={};saveS();paintTpl();paintOpts();changed()};
 paintOpts();
 const ch=(id,k,f)=>{$s(id).oninput=$s(id).onchange=()=>{S[k]=f?f($s(id)):$s(id).value;saveS();if(D){if(k==='aspect'||k==='q')setupCanvas();LAY.clear();draw(V.currentTime)}}};
 ch('sm_ft','font');ch('sm_cl','color');ch('sm_sz','size',x=>+x.value);ch('sm_as','aspect');ch('sm_q','q',x=>+x.value);ch('sm_fps','fps',x=>+x.value);ch('sm_cr','clar',x=>x.checked);ch('sm_hqs','sharp',x=>x.checked);ch('sm_hqd','dn',x=>x.checked);ch('sm_hqa','auto',x=>x.checked);ch('sm_hqb','stab',x=>x.checked);ch('sm_hqg','gate',x=>x.checked);
 {const BK=['tpl','o','font','size','color','aspect','q','fps','clar','sharp','dn','auto','stab','gate','intro','outro','smart','px'],IDS={sm_ft:'font',sm_cl:'color',sm_sz:'size',sm_as:'aspect',sm_q:'q',sm_fps:'fps'},CK={sm_cr:'clar',sm_hqs:'sharp',sm_hqd:'dn',sm_hqa:'auto',sm_hqb:'stab',sm_hqg:'gate',sm_in:'intro',sm_ou:'outro'};
  $s('sm_bps').onclick=()=>{const o={};BK.forEach(k=>{if(S[k]!==undefined)o[k]=S[k]});try{localStorage.setItem('mkz-smart-brand',JSON.stringify(o));say('✅ اتحفظت بصمة المحل — طبّقها على أي فيديو بضغطة')}catch(e){say('مقدرتش أحفظها (المساحة؟)')}};
  $s('sm_bpa').onclick=()=>{let o=null;try{o=JSON.parse(localStorage.getItem('mkz-smart-brand')||'null')}catch(e){}if(!o)return say('مفيش بصمة محفوظة — اظبط الشكل واضغط «احفظ بصمة المحل» الأول');Object.assign(S,o);saveS();Object.keys(IDS).forEach(i=>{const e=$s(i);if(e&&S[IDS[i]]!==undefined)e.value=S[IDS[i]]});Object.keys(CK).forEach(i=>{const e=$s(i);if(e)e.checked=S[CK[i]]!==false&&!!S[CK[i]]});try{paintTpl();paintOpts()}catch(e){}if(D){setupCanvas();LAY.clear();changed()}say('✅ اتطبقت بصمة المحل')}}ch('sm_in','intro',x=>x.checked);ch('sm_fx','fx',x=>x.checked);ch('sm_cln','clean',x=>x.checked);ch('sm_ou','outro',x=>x.checked);
 $s('sm_f').onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;F=f;D=null;$s('sm_res').style.display='none';$s('sm_out').innerHTML='';
  if(V){V.pause();URL.revokeObjectURL(V.src)}V=document.createElement('video');V.playsInline=true;V.preload='auto';V.src=URL.createObjectURL(f);V.setAttribute('webkit-playsinline','');
  V.onloadedmetadata=()=>{$s('sm_fi').textContent='✔ '+f.name+' — '+fmt(V.duration)+' — '+(f.size/1048576).toFixed(0)+' ميجا — '+V.videoWidth+'×'+V.videoHeight};V.load()};
 $s('sm_mf').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)loadMusic(f)};$s('sm_mf').onclick=e=>{e.target.value=''};$s('sm_lg').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)loadLogo(f)};{const rd=()=>{if(V&&CV)draw(V.currentTime)};$s('sm_lgs').oninput=e=>{LGC.size=+e.target.value;$s('sm_lgsv').textContent=LGC.size;lgSave();rd()};$s('sm_lgp').onchange=e=>{LGC.pos=e.target.value;lgSave();rd()};$s('sm_lgo').oninput=e=>{LGC.op=+e.target.value;lgSave();rd()}}
 $s('sm_mv').oninput=e=>{MU.vol=(+e.target.value)/100;if(V)musDuck(V.currentTime)};paintMu();
 $s('sm_rp').onclick=copyReport;styWire();$s('sm_lib').onclick=libAct;renderLib();
 $s('sm_bf').onchange=e=>{if(e.target.files&&e.target.files.length)addBrollFiles(e.target.files)};$s('sm_bf').onclick=e=>{e.target.value=''};$s('sm_bi').onclick=e=>{const b=e.target.closest('[data-brd]');if(!b)return;const c=BRC.splice(+b.dataset.brd,1)[0];try{c.v.pause();URL.revokeObjectURL(c.url)}catch(x){}paintBrIn();if(D){build();renderBR();draw(V.currentTime)}};paintBrIn();
 $s('sm_go').onclick=go;$s('sm_rf').onclick=async()=>{const b=$s('sm_rf');b.disabled=true;b.textContent='⏳';await loadJobs();b.disabled=false;b.textContent='🔄 تحديث'};loadJobs();
 /* تحديث لوحده: كل ٥ ثواني لو فيه فيديو شغال، وأول ما ترجع للتطبيق */
 clearInterval(JT);let tick=0;JT=setInterval(()=>{tick++;if(!$s('sm_jobs')||document.visibilityState!=='visible')return;const act=Object.values(JOBS).some(j=>/uploading|queued|working/.test(j.status));if(act||tick%3===0)loadJobs()},5000);
 if(!window.__smVis){window.__smVis=1;document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&$s('sm_jobs'))loadJobs()})}}
function paintTpl(){document.querySelectorAll('#sm_tp [data-tp]').forEach(b=>b.classList.toggle('o',b.dataset.tp!==S.tpl))}
/* مكان الشخص على الموبايل: بنقف على الفيديو كل ثانية ونشوف الراس فين */
async function phonePeople(pg){if(!S.smart||!V||V.videoWidth>V.videoHeight)return;const dur=(isFinite(V.duration)&&V.duration)||D.dur||0,times=[];for(let t=.3;t<dur;t+=1)times.push(t);
 const seek=t=>new Promise(r=>{const done=()=>{V.removeEventListener('seeked',done);r(V)};V.addEventListener('seeked',done);V.currentTime=t;setTimeout(done,1500)});
 try{pg.textContent='👀 بدور على مكانك في الفيديو…';D.people=await detectPeople(times,seek,p=>{pg.textContent='👀 بدور على مكانك في الفيديو… '+p+'%'});V.currentTime=0}
 catch(e){console.warn('pose',e);pg.textContent='⚠️ ماقدرتش أحدد مكانك — هستخدم تقدير'}}
let WLK=null;async function keepAwake(){try{if(navigator.wakeLock&&!WLK){WLK=await navigator.wakeLock.request('screen');WLK.addEventListener('release',()=>{WLK=null})}}catch(e){}}function relAwake(){try{if(WLK)WLK.release()}catch(e){}WLK=null}document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&busy)keepAwake()});
async function go(){if(busy)return;keepAwake();if(!F)return say('اختار الفيديو الأول');const b=$s('sm_go'),pg=$s('sm_pg');busy=true;b.disabled=true;b.textContent='⏳ شغال…';let wl=null;const getWl=()=>{try{navigator.wakeLock&&navigator.wakeLock.request('screen').then(x=>{wl=x}).catch(()=>{})}catch(e){}};getWl();const wlv=()=>{if(document.visibilityState==='visible'&&busy)getWl()};document.addEventListener('visibilitychange',wlv);
 const key='mkz-ai2:'+F.name+':'+F.size;
 try{let cached=null;try{cached=JSON.parse(localStorage.getItem(key)||'null')}catch(e){}
  D=cached||await analyze(m=>pg.textContent=m);styInit();
  if(!D.people&&S.smart){await new Promise(r=>{if(V.readyState>=1)r();else V.onloadedmetadata=r});await phonePeople(pg)}
  /* رسومات الذكاء المخصوصة لكل جملة */
  if(!D.dsl&&O('anim')){build();const L=animList();if(L.length){pg.textContent='🎨 برسم الرسومات المتحركة…';try{const tk=await token();D.dsl=await sceneMap(L,{Authorization:'Bearer '+tk},(a,b)=>pg.textContent='🎨 برسم الرسومات المتحركة… '+a+' من '+b)}catch(e){D.dsl={}}}}
  try{localStorage.setItem(key,JSON.stringify(D))}catch(e){}
  if(!D.seg.length&&!D.ev.length)say('⚠️ مالقيتش كلام في الفيديو — اتأكد إن الصوت واضح');
  build();const cutN=(D.seg||[]).filter(g=>g.cut).length;
  pg.textContent='✔ '+D.seg.length+' جملة • '+D.ev.length+' توضيح'+(cutN?' • '+cutN+' إعادة هتتشال':'')+(cached?' (من قبل كده)':'');
  $s('sm_res').style.display='';setupCanvas();renderLists();loop();wirePlayer();$s('sm_res').scrollIntoView({behavior:'smooth'})}
 catch(e){if(e.message==='LOGIN'){pg.textContent='';const a=$s('sm_auth');a.innerHTML=loginBox();$s('sm_li').onclick=doLogin;a.scrollIntoView({behavior:'smooth'});say('سجّل دخول بحساب ميكانيزم الأول')}else{const m=/no longer available|اتقفل/i.test(e.message||'')?'موديل جوجل اتغيّر — حدّث الصفحة وجرّب تاني':(e.message||e);pg.textContent='❌ '+m;say('❌ '+m)}}
 finally{document.removeEventListener('visibilitychange',wlv);try{wl&&wl.release()}catch(e){}busy=false;b.disabled=false;b.textContent='✨ اعمل المونتاج تاني'}}
/* ترجمة SRT بتوقيت الفيديو بعد القص + صورة غلاف من لقطة واضحة بعد المقدمة */
function postText(){const b=brand()||{},T=(D&&D.title)||'',ws={};
 const STOP=/^(اللي|الي|ده|دي|دول|كده|يعني|ازاي|انا|احنا|انت|هو|هي|ممكن|لازم|كمان|برضو|عشان|علشان|لان|لكن|يلا|فيه|علي|على|عندنا|عندك|بتاع|بتاعه|بتاعت|هنا|هناك|دلوقتي|النهارده|جدا|اوي|حاجه|حاجات|جماعه|وده|ودي|بقي|بقى|خالص|كل|مش|مع|من|في|او|ولا|لما|اللى)$/;
 CAP.forEach(c=>c.w.forEach(w=>{const n=norm(w).replace(/[^\u0600-\u06FFa-z0-9]/gi,'');if(n.length>=4&&!STOP.test(n)&&!/^\d+$/.test(en(n)))ws[n]=(ws[n]||0)+1}));
 const top=Object.keys(ws).sort((x,y)=>ws[y]-ws[x]||y.length-x.length).slice(0,6);
 const first=(CAP.slice(0,4).map(c=>c.w.join(' ')).join(' ').split(/\s+/).slice(0,26).join(' ')).trim();
 const tags=['#'+(b.shop||'ميكانيزم').replace(/\s+/g,'_')].concat(top.map(w=>'#'+w));
 return [T?('🔥 '+T):'',first?(first+'…'):'',(b.cta||b.phone)?('📞 '+[b.cta||'اطلب دلوقتي',b.phone||''].filter(Boolean).join(' — ')):'',tags.join(' ')].filter(Boolean).join('\n\n')}
async function copyPost(){if(!CAP.length)return say('اعمل التحليل الأول');const tx=postText();try{await navigator.clipboard.writeText(tx);say('✅ نص البوست اتنسخ — الصقه في فيسبوك/إنستجرام')}catch(e){try{await navigator.share({text:tx})}catch(x){prompt('انسخ النص ده:',tx)}}}
/* 📊 تقييم قوة الفيديو قبل النشر + نصايح */
function scoreVideo(){const dur=Math.max(1,outDur()||(V&&V.duration)||1),words=CAP.reduce((n,c)=>n+c.w.length,0),wps=words/dur,tips=[];let sc=0;
 const add=(ok,pts,tip)=>{if(ok)sc+=pts;else tips.push(tip)};
 add(!!(D&&D.title&&D.title.length>=6),14,'اكتب عنوان للفيديو (بيطلع كهوك أول ثانيتين)');
 add(wps>=1.8&&wps<=3.8,18,wps<1.8?'الكلام بطيء — شيل السكوت أو اقصّ الإعادات':'الكلام سريع أوي — الكابشن مش هيلحق يتقري');
 add(dur>=15&&dur<=75,14,dur<15?'الفيديو قصير جدًا (أقل من ١٥ ثانية)':'الفيديو طويل للريلز (أكتر من ٧٥ ثانية) — جرّب تقسمه');
 add(FXL.length+FX2.length>=Math.floor(dur/8),14,'قليل اللمسات — فعّل «✨ لمسات ذكية» أو قول كلمات زي «ضمان/توصيل/بكام»');
 add(BRC.length>0,8,'مفيش فيديو إدراج — الفيديو التاني بيكسر الملل');
 add(!!(brand().phone||brand().cta),10,'ضيف رقم التليفون في بيانات المحل عشان يظهر النداء');
 add(O('cap')!=='none',10,'شغّل الترجمة — أغلب الناس بتتفرج من غير صوت');
 add(!!MU.buf,6,'ضيف موسيقى خلفية خفيفة');
 add(!!MU.logo,6,'ارفع لوجو المحل');
 return {sc:Math.min(100,sc),tips,dur,wps}}
function showScore(){if(!CAP.length)return say('اعمل التحليل الأول');const r=scoreVideo(),el=$s('sm_sc');if(el)el.textContent=(r.sc>=80?'🟢 ':r.sc>=55?'🟡 ':'🔴 ')+'قوة الفيديو: '+ar(String(r.sc))+' / ١٠٠'+(r.tips.length?'\nعشان يبقى أقوى:\n• '+r.tips.join('\n• '):'\nجاهز للنشر 👌')}
/* ⏱️ فصول يوتيوب من أقسام الفيديو */
function copyChapters(){if(!CAP.length)return say('اعمل التحليل الأول');const ch=(D&&D.ch)||[],mm=t=>{t=Math.max(0,Math.round(t));return Math.floor(t/60)+':'+String(t%60).padStart(2,'0')},L=[];
 ch.forEach((c,i)=>{const t0=Array.isArray(c)?c[0]:(c&&c.s)||0,cap=CAP.find(x=>x.s>=t0-.2)||CAP[0],name=(c&&c.t)||(cap?cap.w.slice(0,4).join(' '):'قسم '+(i+1));L.push((i?mm(outT(t0)):'0:00')+' '+name)});
 if(L.length<3)return say('الفيديو مفيهوش فصول كفاية (محتاج ٣ على الأقل)');const tx=L.join('\n');(navigator.clipboard?navigator.clipboard.writeText(tx):Promise.reject()).then(()=>say('✅ الفصول اتنسخت — الصقها في وصف اليوتيوب')).catch(()=>prompt('انسخ الفصول:',tx))}
/* ▶️ معاينة سريعة ١٠ ثواني من الأول بدل التصدير الكامل */
function quickPreview(){if(!V)return;V.muted=false;try{V.currentTime=0}catch(e){}V.play().catch(()=>{});clearTimeout(quickPreview._t);quickPreview._t=setTimeout(()=>{try{V.pause()}catch(e){}},10000)}
function exportSrt(){const tc=t=>{const ms=Math.round(Math.max(0,t)*1000),p=(x,l)=>String(x).padStart(l,'0');return `${p(Math.floor(ms/3600000),2)}:${p(Math.floor(ms/60000)%60,2)}:${p(Math.floor(ms/1000)%60,2)},${p(ms%1000,3)}`};
 const L=CAP.filter(c=>!inGap(c.s)).map((c,i)=>`${i+1}
${tc(outT(c.s))} --> ${tc(Math.max(outT(c.s)+.3,outT(c.e)))}
${c.w.join(' ')}
`).join('\n');dlBlob(new Blob([L],{type:'text/plain;charset=utf-8'}),(D.title||'ترجمة')+'.srt')}
async function exportCover(tt){const t=typeof tt==='number'?tt:srcT(Math.max(2.8,Math.min(outDur()*.25,outDur()-.6)));await new Promise(r=>{const d=()=>{V.removeEventListener('seeked',d);r()};V.addEventListener('seeked',d);V.currentTime=t;setTimeout(d,2500)});draw(V.currentTime);CV.toBlob(b=>b&&dlBlob(b,(D.title||'غلاف')+'.jpg'),'image/jpeg',.92)}
function wirePlayer(){$s('sm_pl').onclick=async()=>{if(V.paused){try{if(V._ac)await V._ac.resume();await V.play()}catch(e){}$s('sm_pl').textContent='⏸️'}else{V.pause();$s('sm_pl').textContent='▶️'}};
 V.onended=()=>{$s('sm_pl').textContent='▶️'};const sk=$s('sm_seek');sk.oninput=()=>{sk._drag=1;V.currentTime=sk.value/1000*(V.duration||0)};sk.onchange=()=>{sk._drag=0};
 $s('sm_ex').onclick=exportVid;$s('sm_srt').onclick=exportSrt;$s('sm_post').onclick=copyPost;$s('sm_scb').onclick=showScore;$s('sm_chb').onclick=copyChapters;$s('sm_pv').onclick=quickPreview;$s('sm_cov').onclick=exportCover;const ti=$s('sm_ti');ti.value=D.title||'';ti.oninput=()=>{D.title=ti.value;draw(V.currentTime)}}
function renderLists(){
 (D.seg||[]).forEach(g=>{if(g._o==null)g._o=g.t});
 $s('sm_cap').innerHTML=D.seg.map((g,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;${g.cut&&O('takes')?'opacity:.5':''}"><button type="button" class="b o" data-sk="${g.s}" style="flex:none;min-width:58px;padding:6px">${fmt(g.s)}</button><label title="شيل الجملة دي" style="flex:none;display:flex;align-items:center;gap:2px">✂️<input type="checkbox" data-sc="${i}" ${g.cut?'checked':''} style="width:20px;height:20px"></label><input data-sg="${i}" value="${esc(g.t)}" style="flex:1"></div>`).join('')||'<p class="mu">مفيش كلام</p>';
 $s('sm_cap').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}};
 $s('sm_cap').onchange=e=>{if(e.target.dataset.sg!=null){const g=D.seg[+e.target.dataset.sg];if(g&&g._o!=null){const old=new Set(String(g._o).split(/s+/));addGloss(e.target.value.split(/s+/).filter(w=>!old.has(w)))}return}const i=e.target.dataset.sc;if(i==null)return;D.seg[+i].cut=e.target.checked;D.seg[+i].man=true;if(e.target.checked&&!O('takes')){S.o.takes=true;saveS();paintOpts()}build();renderLists();draw(V.currentTime);updBar()};
 $s('sm_cap').oninput=e=>{const i=e.target.dataset.sg;if(i==null)return;D.seg[+i].t=e.target.value;build();draw(V.currentTime)};
 const IC={measure:'📏',product:'📦',price:'💰',point:'✔',step:'🔢',warn:'⚠️',topic:'📌',anim:'🎞️'};
 $s('sm_ev').innerHTML=(D.ev.length?D.ev.map((x,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><input type="checkbox" data-eo="${i}" ${x.on?'checked':''} style="width:22px;height:22px;flex:none"><button type="button" class="b o" data-sk="${x.s}" style="flex:none;min-width:58px;padding:6px">${fmt(x.s)}</button><span style="flex:none">${IC[x.type]||'•'}</span><input data-el="${i}" value="${esc(x.type==='measure'||x.type==='price'?((x.value||'')+' '+(x.unit||'')).trim():x.label)}" style="flex:1"></div>${x.type==='anim'?`<div style="display:flex;gap:6px;margin:-2px 0 8px 0">${sel('',SCENES,x.scene).replace('<select id=""',`<select data-as="${i}" style="flex:1"`)}${sel('',ACTIONS,x.action).replace('<select id=""',`<select data-aa="${i}" style="flex:1"`)}</div>`:''}`).join(''):'<p class="mu">مالقيتش مقاسات أو أصناف في الكلام.</p>')
  +`<button type="button" class="b o" id="sm_ae" style="width:100%">➕ ضيف توضيح عند اللحظة الحالية</button>${O('ov')?'':'<p class="mu">الكروت مقفولة في القالب ده — افتحها من «تخصيص».</p>'}`;
 $s('sm_ev').onclick=e=>{const b=e.target.closest('[data-sk]');if(b){V.currentTime=+b.dataset.sk;draw(V.currentTime)}if(e.target.id==='sm_ae'){const t=prompt('اكتب التوضيح (مثلًا: 60 سم — أو اسم الصنف — أو نصيحة — أو ⚠️ تحذير)');if(!t)return;const m=en(t).match(/([\d.]+)\s*(سم|مم|م|متر|كجم|كيلو|بوصة|جنيه)/);
   D.ev.push(m?{s:V.currentTime,e:V.currentTime+2.4,type:m[2]==='جنيه'?'price':'measure',value:m[1],unit:m[2]==='متر'?'م':m[2],label:t,on:true}:/^\s*⚠/.test(t)?{s:V.currentTime,e:V.currentTime+2.8,type:'warn',label:t.replace(/^\s*⚠️?\s*/,''),on:true}:{s:V.currentTime,e:V.currentTime+2.6,type:findProd(t)?'product':'point',label:t,on:true});D.ev.sort((a,b)=>a.s-b.s);build();renderLists();draw(V.currentTime)}};
 $s('sm_ev').onchange=e=>{const d=e.target.dataset;if(d.as!=null){D.ev[+d.as].scene=e.target.value;build();return draw(V.currentTime)}if(d.aa!=null){const x=D.ev[+d.aa];x.action=e.target.value;x.e=x.s+(/break|compare/.test(x.action)?4.2:3.6);build();return draw(V.currentTime)}const i=d.eo;if(i!=null){D.ev[+i].on=e.target.checked;build();draw(V.currentTime)}};
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
  const c=sbk(),ses=(await c.auth.getSession()).data.session,uid=ses&&ses.user&&ses.user.id;if(!uid)throw new Error('سجّل دخول تاني بحساب ميكانيزم');step='تجهيز الطلب';let id=(crypto.randomUUID?crypto.randomUUID():String(Date.now())+Math.random().toString(16).slice(2));
  /* لو نفس الفيديو اترفع قبل كده ووقف في النص: نكمّل من مكان ما وقف */
  let resume=false;try{const o=await withTO(c.from('mk_video_jobs').select('id,spec').eq('status','uploading').order('created_at',{ascending:false}).limit(5),20000,'السيرفر مابيردش');const m=(o.data||[]).find(x=>x.spec&&+x.spec.srcSize===F.size);if(m){id=m.id;resume=true}}catch(e){}
  pg.textContent='⏳ بجهّز الطلب…';
  const P=prods().slice(0,40),slim=[];for(const p of P)slim.push({id:p.id,nm:p.nm,pr:p.pr,img:await slimImg(p.img,220)});
  const spec={S:Object.assign({},S),brand:brand(),gloss:gloss(),products:slim,src:F.name,srcSize:F.size};
  step='تسجيل الطلب';let ins=resume?await withTO(c.from('mk_video_jobs').update({spec}).eq('id',id),30000,'السيرفر مابيردش'):await withTO(c.from('mk_video_jobs').insert({id,user_id:uid,name:(F.name||'فيديو').slice(0,80),status:'uploading',spec}),30000,'السيرفر مابيردش');if(ins.error)throw new Error(/mk_video_jobs|relation/.test(ins.error.message||'')?'جدول المهام مش متعمل — كلمني':ins.error.message);
  step='رفع الفيديو';const n=Math.ceil(F.size/PART),paths=[];let have={};
  if(resume){try{const L=await withTO(c.storage.from('video-jobs').list(`${uid}/${id}`,{limit:1000}),20000,'السيرفر مابيردش');(L.data||[]).forEach(o=>{have[o.name]=o.metadata&&+o.metadata.size})}catch(e){}if(Object.keys(have).length)say('⬆️ هكمّل الرفع من مكان ما وقف')}
  for(let i=0;i<n;i++){const nm=`p${String(i+1).padStart(3,'0')}`,path=`${uid}/${id}/${nm}`,blob=F.slice(i*PART,Math.min(F.size,(i+1)*PART));
   if(have[nm]===blob.size){paths.push(path);continue}
   for(let k=0;;k++){pg.textContent=`⬆️ برفع الفيديو… ${i+1} من ${n} (${Math.round((i*PART)/F.size*100)}%)`;
    const r=await c.storage.from('video-jobs').upload(path,blob,{upsert:true,contentType:'application/octet-stream'});if(!r.error)break;if(k>=3)throw new Error('الرفع وقف: '+(r.error.message||r.error));await new Promise(r=>setTimeout(r,2500*(k+1)))}
   paths.push(path)}
  step='تأكيد الطلب';const up=await c.from('mk_video_jobs').update({parts:paths,status:'queued',note:'مستني دوره'}).eq('id',id);if(up.error)throw up.error;
  pg.textContent='✅ الفيديو اتحط في الطابور — تقدر تقفل الموبايل. هتلاقيه جاهز تحت في «فيديوهاتي».';say('✅ اترفع — السيرفر هيكمل لوحده');loadJobs();$s('sm_jobsbox').scrollIntoView({behavior:'smooth'})}
 catch(e){const m='❌ وقف في خطوة «'+step+'»: '+(e&&e.message||e);pg.textContent=m;say(m);try{localStorage.setItem('mkz-last-err',new Date().toISOString()+' '+m)}catch(x){}}
 finally{busy=false;relAwake();b.disabled=false;b.textContent='☁️ اعمله في الخلفية (تقفل الموبايل وهو شغال)';try{wl&&wl.release()}catch(e){}}}
const withTO=(p,ms,msg)=>Promise.race([p,new Promise((_,no)=>setTimeout(()=>no(new Error(msg)),ms))]);
const JST={uploading:'⬆️ بيترفع',queued:'⏳ مستني دوره',working:'⚙️ شغال',done:'✅ جاهز',failed:'❌ فشل'};
async function loadJobs(){const el=$s('sm_jobs');if(!el)return;const c=sbk();if(!c)return;
 try{if(!(await token())){el.innerHTML='سجّل دخول بحساب ميكانيزم عشان تشوف فيديوهاتك.';return}
  const r=await c.from('mk_video_jobs').select('id,name,status,progress,note,error,out_path,created_at,attempts,parts').order('created_at',{ascending:false}).limit(15);if(r.error)throw r.error;
  const L=r.data||[];el.innerHTML=L.length?L.map(j=>`<div class="p" style="margin:0 0 8px;padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${esc(j.name)}</b><span>${JST[j.status]||j.status}</span></div>
   ${j.status==='working'||j.status==='queued'?`<div style="height:8px;background:var(--ln);border-radius:6px;margin:6px 0;overflow:hidden"><div style="height:100%;width:${Math.max(3,j.progress||0)}%;background:var(--g)"></div></div><small>${esc(j.note||'')} ${j.progress?j.progress+'%':''}</small>`:''}
   ${j.status==='uploading'?`<small class="mu">لو الرفع وقف (الشاشة قفلت أو الصفحة اتقفلت): اختار نفس الفيديو فوق ودوس «☁️ اعمله في الخلفية» — هيكمّل من مكان ما وقف.</small>`:''}
   ${j.status==='failed'?`<small style="color:#ff8a80">${esc(j.error||'')}</small><br><button class="b o" data-rt="${j.id}" style="margin-top:6px">🔁 جرّب تاني</button>`:''}
   ${j.status==='done'?`<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="b" data-vw="${j.id}" style="flex:1">▶️ شاهد</button><button class="b o" data-sh="${j.id}" style="flex:1">📤 شارك</button><button class="b o" data-dl="${j.id}" style="flex:1">⬇️ نزّل</button></div>${Array.isArray(j.parts)&&j.parts.length?`<button class="b o" data-rr="${j.id}" style="width:100%;margin-top:6px">🔁 اعمله تاني بالقالب والاختيارات اللي فوق</button>`:''}<small class="mu">${esc(j.note&&j.note!=='جاهز'?j.note:'')}</small>`:''}
   <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-top:6px"><small class="mu">${new Date(j.created_at).toLocaleString('ar-EG',{day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</small>${j.status!=='working'?`<button class="b o" data-rm="${j.id}" style="flex:none;padding:6px 12px;color:#ff8a80">🗑️ امسح</button>`:''}</div></div>`).join(''):'مفيش فيديوهات في الخلفية لسه.';
  JOBS=Object.fromEntries(L.map(j=>[j.id,j]));const rt=$s('sm_rt');if(rt)rt.textContent='آخر تحديث: '+new Date().toLocaleTimeString('ar-EG',{hour:'numeric',minute:'2-digit',second:'2-digit'})}
 catch(e){const m=String(e&&e.message||e);if(/JWT|expired|token/i.test(m)){el.innerHTML='الدخول خلص وقته — سجّل دخول تاني.';const a=$s('sm_auth');if(a){a.innerHTML=loginBox();$s('sm_li').onclick=doLogin}return}el.textContent=/mk_video_jobs|relation/.test(m)?'جدول المهام مش متعمل':'❌ '+m}}
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

/* ---------- 🧠 سكيل من لينك: لينك فيديو → السيرفر ينزّله ويسمعه (طابور mk_skill_jobs + عامل skill-link) → SKILL.md ---------- */
let SJT=0,SJ={};
const SJST={queued:'⏳ مستني دوره',working:'⚙️ شغال',done:'✅ جاهز',failed:'❌ فشل'};
const fileName=md=>((String(md).match(/^name:\s*(.+)$/m)||[])[1]||'skill').trim().replace(/[^\w-]+/g,'-')+'-SKILL.md';
async function sklSend(){const ta=$s('sk_u'),b=$s('sk_go'),pg=$s('sk_pg');const urls=(ta.value.match(/https?:\/\/[^\s]+/g)||[]).slice(0,10);if(!urls.length)return say('الصق لينك الفيديو الأول');
 b.disabled=true;b.textContent='⏳ ببعت…';
 try{const tok=await token();if(!tok)throw new Error('LOGIN');const c=sbk(),r=await c.from('mk_skill_jobs').insert(urls.map(u=>({url:u,status:'queued',note:'مستني دوره'})));if(r.error)throw r.error;
  ta.value='';pg.textContent='✅ اللينك اتبعت — تقدر تقفل الموبايل. السكيل هيظهر تحت لما يخلص (دقيقة أو اتنين تقريبًا).';sklJobs()}
 catch(e){if(e.message==='LOGIN'){const a=$s('sk_auth');a.innerHTML=loginBox();$s('sm_li').onclick=async()=>{await doLogin();a.innerHTML=''};a.scrollIntoView({behavior:'smooth'});say('سجّل دخول بحساب ميكانيزم الأول')}else{pg.textContent='❌ '+(e.message||e);say('❌ '+(e.message||e))}}
 finally{b.disabled=false;b.textContent='🧠 ابعت اللينك'}}
async function sklJobs(){const el=$s('sk_jobs');if(!el)return;const c=sbk();if(!c)return;
 try{if(!(await token())){el.textContent='سجّل دخول بحساب ميكانيزم عشان تشوف السكيلات.';return}
  const r=await c.from('mk_skill_jobs').select('id,url,status,note,error,skill,created_at').order('created_at',{ascending:false}).limit(20);if(r.error)throw r.error;
  const L=r.data||[];SJ=Object.fromEntries(L.map(j=>[j.id,j]));
  const open=new Set([...el.querySelectorAll('details[open]')].map(d=>d.dataset.id));
  el.innerHTML=L.length?L.map(j=>`<div class="p" style="margin:0 0 8px;padding:10px"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b dir="ltr" style="font-size:12px;word-break:break-all;flex:1">${esc(j.url)}</b><span>${SJST[j.status]||j.status}</span></div>
   ${j.status==='working'||j.status==='queued'?`<small class="mu">${esc(j.note||'')}</small>`:''}
   ${j.status==='failed'?`<small style="color:#ff8a80">${esc(j.error||'')}</small>`:''}
   ${j.status==='done'?`<details data-id="${j.id}" ${open.has(j.id)?'open':''} style="margin-top:6px"><summary style="cursor:pointer;font-weight:700">📄 افتح السكيل</summary><textarea readonly dir="auto" style="width:100%;min-height:45vh;font-family:monospace;font-size:13px;margin-top:6px">${esc(j.skill)}</textarea>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px"><button class="b" data-sc="${j.id}" style="flex:1">📋 انسخ</button><button class="b o" data-sd="${j.id}" style="flex:1">⬇️ نزّل</button><button class="b o" data-ss="${j.id}" style="flex:1">📤 شارك</button></div></details>`:''}
   <div style="display:flex;justify-content:space-between;align-items:center;margin-top:6px"><small class="mu">${new Date(j.created_at).toLocaleString('ar-EG',{day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</small><button class="b o" data-sx="${j.id}" style="flex:none;padding:6px 12px;color:#ff8a80">🗑️ امسح</button></div></div>`).join(''):'مفيش لينكات لسه.'}
 catch(e){el.textContent=/mk_skill_jobs|relation/.test(String(e&&e.message))?'جدول السكيلات مش متعمل':'❌ '+(e&&e.message||e)}}
document.addEventListener('click',async e=>{const b=e.target.closest('[data-sc],[data-sd],[data-ss],[data-sx]');if(!b||!$s('sk_jobs')||!$s('sk_jobs').contains(b))return;
 const id=b.dataset.sc||b.dataset.sd||b.dataset.ss||b.dataset.sx,j=SJ[id];if(!j)return;
 try{if(b.dataset.sc){try{await navigator.clipboard.writeText(j.skill)}catch(x){const t=b.closest('details').querySelector('textarea');t.select();document.execCommand('copy')}say('✔ اتنسخ')}
  if(b.dataset.sd){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([j.skill],{type:'text/markdown'}));a.download=fileName(j.skill);a.click()}
  if(b.dataset.ss){if(navigator.share)await navigator.share({title:fileName(j.skill),text:j.skill});else{await navigator.clipboard.writeText(j.skill);say('✔ اتنسخ')}}
  if(b.dataset.sx){if(!confirm('تمسح ده؟'))return;const d=await sbk().from('mk_skill_jobs').delete().eq('id',id);if(d.error)throw d.error;sklJobs()}}
 catch(err){if(!/abort|cancel/i.test(String(err&&err.name)))say('❌ '+(err.message||err))}});
function sklPaint(){const s=$s('v-skl');if(!s)return;
 s.innerHTML=`<h1>🧠 سكيل من لينك</h1><p class="mu">الصق لينك فيديو (فيسبوك أو يوتيوب…) بيشرح إزاي تستخدم كلود أو أدوات معاه. السيرفر بينزّله ويسمع الكلام ويقرا اللي على الشاشة، ويكتب لك سكيل جاهز: الفيديو بيتكلم على إيه، الأدوات إيه، واللينكات. الفيديو لازم يكون عام (مش خاص).</p>
 <div id="sk_auth"></div>
 <div class="p"><h2>الصق اللينك</h2><textarea id="sk_u" dir="ltr" rows="3" placeholder="https://www.facebook.com/…  (تقدر تلزق أكتر من لينك)" style="width:100%"></textarea>
 <button class="b" id="sk_go" style="width:100%;min-height:56px;font-size:18px;margin-top:8px">🧠 ابعت اللينك</button><p id="sk_pg" class="mu"></p></div>
 <div class="p"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><h2 style="margin:0">📚 السكيلات بتاعتي</h2><button class="b o" id="sk_rf" style="flex:none;padding:8px 14px">🔄 تحديث</button></div><div id="sk_jobs" class="mu" style="margin-top:8px">⏳</div></div>`;
 token().then(t=>{const a=$s('sk_auth');if(a&&!t){a.innerHTML=loginBox();$s('sm_li').onclick=async()=>{await doLogin();a.innerHTML=''}}}).catch(()=>{});
 $s('sk_go').onclick=sklSend;$s('sk_rf').onclick=sklJobs;sklJobs();
 clearInterval(SJT);SJT=setInterval(()=>{if(!$s('sk_jobs')||document.visibilityState!=='visible')return;if(Object.values(SJ).some(j=>/queued|working/.test(j.status)))sklJobs()},6000)}

/* ---------- التركيب في الستوديو ---------- */
function mount(){if($s('v-smart'))return;const s=document.createElement('section');s.className='v';s.id='v-smart';const ref=$s('v-vid');(ref&&ref.parentNode||document.getElementById('mk-host')||document.body).insertBefore(s,ref||null);
 const btn=`<button data-go="smart"><svg class="i"><use href="#i-vid"/></svg>🎬 مونتاج ذكي</button>`,rail=$s('rail');if(rail){const first=rail.querySelector('[data-go="vid"]');first?first.insertAdjacentHTML('beforebegin',btn):rail.insertAdjacentHTML('beforeend',btn)}
 const tiles=$s('tiles');if(tiles)tiles.insertAdjacentHTML('afterbegin',`<button class="tile" data-go="smart"><span class="ic">🎬</span>مونتاج ذكي</button>`);
 const s2=document.createElement('section');s2.className='v';s2.id='v-skl';s.parentNode.insertBefore(s2,s);
 const b2=`<button data-go="skl"><svg class="i"><use href="#i-ai"/></svg>🧠 سكيل من لينك</button>`;if(rail){const f=rail.querySelector('[data-go="smart"]');f?f.insertAdjacentHTML('beforebegin',b2):rail.insertAdjacentHTML('beforeend',b2)}
 if(tiles)tiles.insertAdjacentHTML('afterbegin',`<button class="tile" data-go="skl"><span class="ic">🧠</span>سكيل من لينك</button>`);
 let sp=false;document.addEventListener('click',e=>{const b=e.target.closest('[data-go="skl"]');if(!b)return;if(!sp){sklPaint();sp=true}setTimeout(()=>{document.querySelectorAll('.v').forEach(x=>x.classList.toggle('on',x.id==='v-skl'));document.querySelectorAll('#rail button').forEach(x=>x.classList.toggle('on',x.dataset.go==='skl'));scrollTo(0,0)},0)});
 let painted=false;document.addEventListener('click',e=>{const b=e.target.closest('[data-go]');if(!b)return;if(b.dataset.go==='smart'){if(!painted){paint();painted=true}setTimeout(()=>{document.querySelectorAll('.v').forEach(x=>x.classList.toggle('on',x.id==='v-smart'));document.querySelectorAll('#rail button').forEach(x=>x.classList.toggle('on',x.dataset.go==='smart'))},0)}else if(V&&!V.paused)V.pause()})}
/* ---------- 🎞️ فيديوهات الإدراج (B-roll): لما تقول «هيظهرلكم فيديو تحت» يظهر الفيديو التاني تحت وانت فوق ---------- */
let BRC=[],BRL=[],BRM=[],BRX=new Set();   // BRC: الفيديوهات المرفوعة، BRL: أماكن الإدراج، BRM: اللي ضفتها بإيدك، BRX: اللي شلتها
const BR_ESC=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
function addBrollFiles(files){[...files].forEach(f=>{const url=URL.createObjectURL(f),v=document.createElement('video');v.muted=true;v.playsInline=true;v.preload='auto';v.src=url;v.setAttribute('webkit-playsinline','');
  const c={name:f.name,url,v,dur:0,mb:Math.round(f.size/1048576),ty:f.type||''};v.onerror=()=>{c.err=(v.error&&v.error.code)||1;c.bad=1;paintBrIn()};const upd=()=>{if(v.duration&&isFinite(v.duration)&&c.dur!==v.duration){c.dur=v.duration;c.bad=0;paintBrIn();if(D){build();renderBR();try{draw(V.currentTime)}catch(e){}}}};v.onloadedmetadata=upd;v.ondurationchange=upd;v.onloadeddata=upd;v.load();const pr=v.play();if(pr&&pr.then)pr.then(()=>{v.pause();try{v.currentTime=0}catch(e){}}).catch(()=>{});BRC.push(c);setTimeout(()=>{if(!c.dur){c.bad=1;paintBrIn()}},8000)});paintBrIn()}
function paintBrIn(){const el=$s('sm_bi');if(el)el.innerHTML=BRC.length?BRC.map((c,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-top:4px"><span style="flex:1">🎞️ ${i+1}. ${BR_ESC(c.name)} ${c.dur?'— '+fmt(c.dur):c.bad?'⚠️ مش قادر أقرأ الفيديو ده ('+(c.ty||'؟')+' '+c.mb+'MB — جرّب تصدّره MP4 / H.264)':'⏳ بحمّل… ('+c.mb+'MB)'}</span><button type="button" class="b o" data-brd="${i}" style="flex:none;padding:4px 10px">✕</button></div>`).join(''):''}
/* كلمات التنبيه: الفعل «يظهر/هتشوف/هعرض…» أو «تحت» جنب «فيديو/دلوقتي/اهو». الإدراج بيبدأ لما الجملة تخلص */
function brCues(){const W=[];CAP.forEach(c=>{const n=c.w.length,d=Math.max(.2,c.e-c.s);c.w.forEach((w,i)=>W.push({w:norm(w),e:c.s+d*(i+1)/n}))});
 const hit=[];W.forEach((x,i)=>{const w=x.w;let ok=/ظهر/.test(w)||/^(هتشوف|هنشوف|شوفو|اتفرجو|هتتفرج|هعرض|اعرض|هنعرض|هتلاقو)/.test(w);
  if(!ok&&w==='تحت'){const nb=W.slice(Math.max(0,i-3),i+4).map(y=>y.w).join(' ');ok=/فيديو|ظهر|اهو|دلوقتي|شوف|بص|هنا/.test(nb)}
  if(!ok&&/^فيديو/.test(w)){const nb=W.slice(i,i+4).map(y=>y.w).join(' ');ok=/تحت|التاني|تاني|الاخر/.test(nb)}
  if(ok)hit.push(x.e)});
 const out=[];hit.forEach(t=>{const l=out[out.length-1];if(l!=null&&t-l<3.2){/* نفس الجملة: نفضل على أول كلمة عشان الفيديو يطلع وهو بيقولها */}else out.push(t)});return out.filter(t=>t>.8)}
function computeBroll(){BRL=[];if(!BRC.length||!D)return;const dur=D.dur||(V&&V.duration)||0;let cues=brCues();
 const spare=BRC.length-cues.length;if(spare>0&&CAP.length){const used=cues.slice();for(let k=1;k<=spare;k++){const want=dur*k/(spare+1);const c=CAP.filter(x=>x.e<dur-2&&used.every(u=>Math.abs(u-x.e)>6)).sort((a,b)=>Math.abs(a.e-want)-Math.abs(b.e-want))[0];if(c){cues.push(c.e);used.push(c.e)}}}
 cues.sort((a,b)=>a-b);const L=[];
 cues.forEach((t,i)=>{if(BRX.has(Math.round(t)))return;const c=BRC[i%BRC.length],len=c&&c.dur;if(!len)return;const g=inGap(t);const s=g?g[1]:t,nx=cues[i+1]!=null?cues[i+1]-.2:1e9;const e=Math.min(s+Math.min(len,7),nx,dur||1e9);if(e-s>=1.8)L.push({s,e,c})});
 BRM.forEach(m=>{const c=BRC[m.i];if(c&&c.dur)L.push({s:m.s,e:Math.min(m.s+Math.min(c.dur,7),dur||1e9),c,man:m})});
 L.sort((a,b)=>a.s-b.s);BRL=L}
/* مكان اللوحة: تحت راسك (بعيد عن الوش) وفوق الكلام */
function brGeom(t){const [W,H]=[CV.width,CV.height],u=W/1080,hr=headRect(t),top=Math.max(H*.47,hr?hr[1]+10*u:0);
 const cf=CF(),lh=Math.round(cf.sz*u*S.size)*1.34,bot=O('cap')==='none'?H*.93:capBottom()-2*lh-24*u;if(top>H*.62||bot-top<H*.15){if(!S.brp)return null;return brCustom({x:W*.04,y:H*.6,w:W*.92,h:H*.28},W,H)}
 /* المساحة المتاحة بين الوش والكلام: نحط الفيديو في الجزء الأوطى منها (مش لازق في الوش) */
 const hd=Math.min(bot-top,H*.34),px=W*.04,g0={x:px,y:top+(bot-top-hd)*.8,w:W-2*px,h:hd};return brCustom(g0,W,H)}
/* مكان فيديو الإدراج بإيدك: S.brp = {cx,cy,w} نسب من الشاشة (مركز الفيديو وعرضه) — لو متحدد بيتستخدم بدل المكان التلقائي */
function brCustom(g0,W,H){const p=S.brp;if(!p)return g0;const w=Math.max(W*.18,Math.min(W*.98,W*(p.w||.92))),h=Math.min(H*.6,g0.h*(w/g0.w)),x=Math.max(0,Math.min(W-w,p.cx*W-w/2)),y=Math.max(0,Math.min(H-h,p.cy*H-h/2));return {x,y,w,h}}
function brActive(t){const b=BRL.find(x=>t>=x.s&&t<x.e);return b&&(S.brp||brGeom(t))?b:null}
function brSync(b,t){const v=b.c.v;if(!v||v.readyState<2)return;const rel=Math.min(Math.max(0,t-b.s),Math.max(0,(b.c.dur||1)-.05)),pl=V&&!V.paused;
 if(pl){if(Math.abs(v.currentTime-rel)>.4)v.currentTime=rel;if(v.paused)v.play().catch(()=>{})}else{if(!v.paused)v.pause();if(Math.abs(v.currentTime-rel)>.04)v.currentTime=rel}}
function drawBroll(b,t,W,H){const g=brGeom(t),u=W/1080,acc=COL(),v=b.c.v;if(!g)return;brSync(b,t);
 const pin=ease((t-b.s)/.4),pout=1-ease((t-b.e+.3)/.3),p=Math.min(pin,pout);if(p<=0)return;
 const sl=(1-pin)*(H-g.y)*.3+(1-pout)*(H-g.y)*.2,sc=.96+.04*p;
 CX.save();CX.globalAlpha=p;CX.translate(g.x+g.w/2,g.y+g.h/2+sl);CX.scale(sc,sc);const x=-g.w/2,y=-g.h/2,r=34*u;
 CX.save();CX.shadowColor='rgba(0,0,0,.55)';CX.shadowBlur=40*u;CX.shadowOffsetY=10*u;rr(x,y,g.w,g.h,r);CX.fillStyle='#000';CX.fill();CX.restore();
 CX.save();rr(x,y,g.w,g.h,r);CX.clip();
 if(v&&v.videoWidth&&v.readyState>=2){const k=Math.max(g.w/v.videoWidth,g.h/v.videoHeight),dw=v.videoWidth*k,dh=v.videoHeight*k;CX.drawImage(v,x+(g.w-dw)/2,y+(g.h-dh)/2,dw,dh)}
 else{CX.fillStyle='#111';CX.fillRect(x,y,g.w,g.h)}
 const pr=Math.min(1,Math.max(0,(t-b.s)/Math.max(.1,b.e-b.s)));CX.fillStyle=acc;CX.fillRect(x,y+g.h-8*u,g.w*pr,8*u);CX.restore();
 rr(x,y,g.w,g.h,r);CX.lineWidth=6*u;CX.strokeStyle=acc;CX.stroke();CX.restore();CX.globalAlpha=1}
function renderBR(){const el=$s('sm_bl');if(!el)return;
 if(!BRC.length){el.innerHTML='<p class="mu">ارفع فيديو الإدراج من «٢) فيديوهات الإدراج» وهيظهر هنا مكانه.</p>';return}
 el.innerHTML=(BRL.map((b,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:6px"><button type="button" class="b o" data-brs="${b.s}" style="flex:none;min-width:58px;padding:6px">${fmt(b.s)}</button><span style="flex:1">🎞️ ${BR_ESC(b.c.name)} (${(b.e-b.s).toFixed(1)}ث)</span><button type="button" class="b o" data-brx="${i}" style="flex:none;padding:6px 10px">✕</button></div>`).join('')||'<p class="mu">مفيش مكان إدراج — قول «هيظهرلكم فيديو تحت» في الفيديو، أو ضيف مكان بإيدك.</p>')+
 `<button type="button" class="b o" id="sm_bad" style="width:100%">➕ ضيف الإدراج هنا (عند المشهد الحالي)</button>`;
 el.onclick=e=>{const s=e.target.closest('[data-brs]');if(s){V.currentTime=+s.dataset.brs;draw(V.currentTime);return}
  const x=e.target.closest('[data-brx]');if(x){const b=BRL[+x.dataset.brx];if(b.man)BRM=BRM.filter(m=>m!==b.man);else BRX.add(Math.round(b.s));computeBroll();renderBR();draw(V.currentTime);return}
  if(e.target.id==='sm_bad'){if(!BRC.length)return say('ارفع فيديو الإدراج الأول');const i=BRM.length%BRC.length;BRM.push({s:+(V.currentTime||0).toFixed(2),i});computeBroll();renderBR();draw(V.currentTime)}}}
const _build0=build;build=function(){const r=_build0.apply(this,arguments);try{computeBroll()}catch(e){console.warn('broll',e)}return r};
const _renderLists0=renderLists;renderLists=function(){const r=_renderLists0.apply(this,arguments);try{renderBR()}catch(e){}return r};
/* ---------- 🖼️ إدراج صور ذكي: ترفع ١٠-٢٠ صورة والمونتاج يحط كل صورة في اللحظة اللي بتتكلم فيها عن حاجة ليها علاقة بيها (نفس فكرة فيديوهات الإدراج) ---------- */
let IMC=[],IML=[],IMM=[],IMX=new Set(),IMSK={},IMW=[],IMAI={sig:'',busy:0,err:'',n:0},BIGSIG='',_imRe=0;   // IMC: الصور المرفوعة، IML: أماكن الظهور، IMM: اللي حطيتها بإيدك، IMX: اللي شلتها، IMSK: اللي ملقتش لها مكان
const IM_MAX=30,IM_RX=/^image\/|\.(jpe?g|png|webp|gif|bmp|avif|heic|heif|hif|tiff?)$/i;
async function addImgFiles(files){const el=$s('sm_ii');const all=[...files],list=all.filter(f=>IM_RX.test(f.type||'')||IM_RX.test(f.name||'')||!f.type);
 const room=IM_MAX-IMC.length;if(room<=0)return say('وصلت أقصى عدد صور ('+IM_MAX+') — شيل شوية الأول');
 const take=list.slice(0,room),bad=all.length-list.length;let errs=[];
 if(el)el.textContent='⏳ بحضّر الصور (0/'+take.length+')…';
 try{const r=await loadFiles(take,(d,n)=>{const e=$s('sm_ii');if(e)e.textContent='⏳ بحضّر الصور ('+d+'/'+n+')…'});errs=r.errors||[];
  r.items.filter(x=>x.kind==='img').forEach(it=>IMC.push({id:it.id,name:it.name,src:it.src,w:it.w,h:it.h,thumb:it.thumb,fx:it.fx,fy:it.fy,date:it.date,seg:null,phrase:'',conf:0,kind:'',desc:'',cap:'',ai:0}))}
 catch(e){errs.push(String(e&&e.message||e))}
 if(list.length>room)errs.push('اتضاف '+room+' صورة بس (الحد الأقصى '+IM_MAX+')');if(bad)errs.push(bad+' ملف مش صورة اتتجاهل');
 IMAI.sig='';paintImIn();if(errs.length)say(errs.slice(0,3).join(' — '));
 if(D&&D.seg&&D.seg.length){computeImg();renderIM();try{draw(V.currentTime)}catch(e){}imMatch()}}
function paintImIn(){const el=$s('sm_ii');if(!el)return;
 const st=!IMC.length?'':!D?'ℹ️ هتتطابق بالكلام أول ما تعمل المونتاج.':IMAI.busy?'🧠 بفهم الصور وبطابقها بكلامك…':IMAI.err?'⚠️ الذكاء ماقدرش يطابق ('+BR_ESC(IMAI.err)+') — وزّعتهم تلقائي على طول الفيديو، وتقدر تحركهم بإيدك.':IMAI.sig?'✔ الذكاء طابق '+IMAI.n+' صورة بالكلام.':'';
 el.innerHTML=(IMC.length?IMC.map((c,i)=>`<div style="display:flex;gap:8px;align-items:center;margin-top:4px"><img src="${c.thumb}" style="width:40px;height:40px;object-fit:cover;border-radius:8px;flex:none"><span style="flex:1;font-size:13px">${i+1}. ${BR_ESC(c.desc||c.name)}</span><button type="button" class="b o" data-imd="${i}" style="flex:none;padding:4px 10px">✕</button></div>`).join(''):'')+(st?`<div style="margin-top:6px">${st}</div>`:'')}
function imJpg(c){const k=Math.min(1,576/Math.max(c.w,c.h)),cv=document.createElement('canvas');cv.width=Math.max(1,Math.round(c.w*k));cv.height=Math.max(1,Math.round(c.h*k));cv.getContext('2d').drawImage(c.src,0,0,cv.width,cv.height);const u=cv.toDataURL('image/jpeg',.66);cv.width=cv.height=0;return u.split(',')[1]||''}
const imSegs=()=>(D&&D.seg||[]).map((g,i)=>({i,s:g.s,e:g.e,t:g.t,cut:g.cut})).filter(g=>!(O('takes')&&g.cut));
const imSig=()=>IMC.map(c=>c.id).join(',')+'|'+(D?(D._imk||(D._imk=Math.random().toString(36).slice(2)))+':'+(D.seg||[]).length:'');
async function imMatch(force){if(!IMC.length||!D||!D.seg||!D.seg.length||IMAI.busy)return;const sig=imSig();if(!force&&IMAI.sig===sig)return;
 IMAI.busy=1;IMAI.err='';paintImIn();IMC.forEach(c=>{c.ai=0});
 try{const tok=await token(),segs=imSegs();if(!segs.length)throw new Error('مفيش كلام');
  const images=IMC.map((c,i)=>({i,jpg:c.jpg||(c.jpg=imJpg(c))}));
  const ac=new AbortController(),to=setTimeout(()=>ac.abort(),125000);let r;
  try{r=await fetch(MK_URL+'/functions/v1/video-images',{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:MK_KEY},body:JSON.stringify({images,segs:segs.map(g=>({i:g.i,s:+g.s.toFixed(2),e:+g.e.toFixed(2),t:g.t})),title:D.title||'',products:prods().map(p=>p.nm).filter(Boolean)})})}
  catch(e){throw new Error(e&&e.name==='AbortError'?'السيرفر اتأخر':'النت مقطوع')}finally{clearTimeout(to)}
  const j=await r.json().catch(()=>({}));if(!r.ok||!Array.isArray(j.matches))throw new Error(j.error||('السيرفر '+r.status));
  imApply(j.matches);IMAI.sig=sig}
 catch(e){IMAI.err=String(e&&e.message||e).slice(0,140);IMAI.sig=sig}
 IMAI.busy=0;paintImIn();computeImg();renderIM();try{if(V&&CV)draw(V.currentTime)}catch(e){}}
function imApply(ms){let n=0;ms.forEach(m=>{const c=IMC[m.i];if(!c)return;c.seg=m.seg;c.phrase=m.phrase||'';c.conf=+m.conf||0;c.kind=m.kind||'';c.desc=m.desc||c.desc;c.cap=m.caption||'';c.ai=1;n++});IMAI.n=n}
const imWords=()=>{const W=[];CAP.forEach(c=>{const n=c.w.length,d=Math.max(.2,c.e-c.s);c.w.forEach((w,i)=>W.push({w:norm(w),s:c.s+d*i/n,e:c.s+d*(i+1)/n}))});return W};
const imEq=(a,b)=>a&&b&&(a===b||(a.length>2&&b.length>2&&(a.includes(b)||b.includes(a))));
function imAnchor(c){if(c.seg==null||c.seg<0)return null;const g=D.seg[c.seg];if(!g||(O('takes')&&g.cut))return null;let t=g.s;
 if(c.phrase){const pw=norm(c.phrase).split(/\s+/).filter(Boolean);if(pw.length){const W=IMW.filter(x=>x.e>g.s-.1&&x.s<g.e+.1);for(let i=0;i<W.length;i++)if(imEq(W[i].w,pw[0])){t=W[i].s;break}}}
 return Math.max(0,t-.15)}
function computeImg(){IML=[];IMSK={};if(!IMC.length||!D||!D.seg||!CAP.length)return;const dur=D.dur||(V&&V.duration)||0;IMW=imWords();const A=[],fb=[];
 IMC.forEach(c=>{if(IMX.has(c.id))return;const man=IMM.find(m=>m.id===c.id);
  if(man){A.push({c,t:man.s,man});return}
  if(c.ai){if(c.conf>=.3){const t=imAnchor(c);if(t!=null)A.push({c,t});else IMSK[c.id]='الجملة المناسبة اتشالت من الفيديو'}else IMSK[c.id]='مفيش كلام في الفيديو ليه علاقة بالصورة دي';return}
  fb.push(c)});
 /* لو الذكاء مارجعش (مفيش نت/سيرفر واقع): نوزّع على طول الفيديو بالترتيب */
 if(fb.length){const used=A.map(a=>a.t);fb.forEach((c,k)=>{const want=dur*(k+1)/(fb.length+1);const cp=CAP.filter(x=>x.e<dur-2&&used.every(u=>Math.abs(u-x.s)>4)).sort((a,b)=>Math.abs(a.s-want)-Math.abs(b.s-want))[0]||CAP[Math.min(CAP.length-1,Math.floor(CAP.length*(k+1)/(fb.length+1)))];if(cp){used.push(cp.s);A.push({c,t:cp.s,fb:1})}})}
 A.sort((a,b)=>a.t-b.t);let cur=((S.intro&&D.title)||(S.hook&&S.hook.text))?srcT(2.5):0;
 A.forEach((a,k)=>{const g=a.c.seg>=0&&D.seg[a.c.seg];let len=a.man?3:Math.min(4.2,Math.max(2.4,(g?g.e-g.s:2)+.8)),s=Math.max(a.t,cur);const nx=A[k+1];if(nx&&!a.man&&nx.t-.15-s>=1.6)len=Math.min(len,nx.t-.15-s);
  for(let q=0;q<4;q++){const gp=inGap(s);if(gp)s=gp[1];const b=BRL.find(x=>s<x.e&&s+len>x.s);if(b&&b.s<=s+.3)s=b.e+.15;else break}
  let e=Math.min(s+len,dur||1e9);const b2=BRL.find(x=>s<x.e&&e>x.s);if(b2)e=Math.min(e,b2.s-.1);const ng=GAPS.find(x=>x[0]>s);if(ng)e=Math.min(e,ng[0]);
  if(e-s<1.4){IMSK[a.c.id]='مفيش مكان فاضي عندها (فيديو إدراج أو قص)';return}
  if(!a.man&&s-a.t>7){IMSK[a.c.id]='مكانها مشغول بحاجة تانية';return}
  IML.push({s,e,c:a.c,man:a.man,fb:a.fb});cur=e+.15});
 IML.sort((a,b)=>a.s-b.s)}
const imActive=t=>IML.find(x=>t>=x.s&&t<x.e)||null;
/* رسم صورة جوه مستطيل: cover (بتملاه بالقص على نقطة التركيز) أو contain (كاملة) */
function imFit(c,x,y,w,h,mode,z){const im=c.src,iw=c.w,ih=c.h;if(!im||!iw||!ih)return;let k=mode==='cover'?Math.max(w/iw,h/ih):Math.min(w/iw,h/ih);k*=z;const dw=iw*k,dh=ih*k;let dx=x+(w-dw)/2,dy=y+(h-dh)/2;
 if(mode==='cover'){dx=Math.min(x,Math.max(x+w-dw,x+w/2-(c.fx==null?.5:c.fx)*dw));dy=Math.min(y,Math.max(y+h-dh,y+h/2-(c.fy==null?.5:c.fy)*dh))}
 try{CX.drawImage(im,dx,dy,dw,dh)}catch(e){}}
function drawImg(b,t,W,H){const c=b.c;if(!c||!c.src)return;const u=W/1080,acc=COL(),pin=ease((t-b.s)/.35),pout=1-ease((t-b.e+.3)/.3),p=Math.min(pin,pout);if(p<=0)return;
 const prog=Math.min(1,Math.max(0,(t-b.s)/Math.max(.1,b.e-b.s))),z=1+.06*prog,gm=(S.imst==='full')?null:brGeom(t),F=`"${FONTN()}",Cairo,sans-serif`;
 CX.save();CX.globalAlpha=p;let cx,cy,cw,ch;
 if(!gm){/* ملء الشاشة: خلفية مغبّشة + الصورة (بتملا الشاشة لو قريبة من شكلها، وإلا كاملة في النص) */
  CX.save();if('filter' in CX)CX.filter='blur(26px)';CX.globalAlpha=p*.9;imFit(c,-W*.05,-H*.05,W*1.1,H*1.1,'cover',1);if('filter' in CX)CX.filter='none';CX.restore();
  const ra=(c.w/c.h)/(W/H),near=Math.max(ra,1/ra)<1.45;CX.save();imFit(c,0,0,W,H,near?'cover':'contain',z);CX.restore();cx=0;cy=0;cw=W;ch=H}
 else{const sl=(1-pin)*(H-gm.y)*.3+(1-pout)*(H-gm.y)*.2,sc=.96+.04*p,r=34*u;CX.translate(gm.x+gm.w/2,gm.y+gm.h/2+sl);CX.scale(sc,sc);const x=-gm.w/2,y=-gm.h/2;
  CX.save();CX.shadowColor='rgba(0,0,0,.55)';CX.shadowBlur=40*u;CX.shadowOffsetY=10*u;rr(x,y,gm.w,gm.h,r);CX.fillStyle='#000';CX.fill();CX.restore();
  CX.save();rr(x,y,gm.w,gm.h,r);CX.clip();if('filter' in CX)CX.filter='blur(20px)';imFit(c,x-gm.w*.05,y-gm.h*.05,gm.w*1.1,gm.h*1.1,'cover',1);if('filter' in CX)CX.filter='none';imFit(c,x,y,gm.w,gm.h,'contain',z);CX.fillStyle=acc;CX.fillRect(x,y+gm.h-8*u,gm.w*prog,8*u);CX.restore();
  rr(x,y,gm.w,gm.h,r);CX.lineWidth=6*u;CX.strokeStyle=acc;CX.stroke();cx=x;cy=y;cw=gm.w;ch=gm.h}
 /* كلمة صغيرة على الصورة (اسم الصنف) */
 if(c.cap){const sz=Math.round(40*u*Math.min(1.2,S.size));CX.font=`800 ${sz}px ${F}`;CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';const tw=CX.measureText(c.cap).width+44*u,py=cy+ch-(gm?46*u:H*.2),px=cx+cw/2;rr(px-tw/2,py-sz*.8,tw,sz*1.6,sz*.8);CX.fillStyle='rgba(0,0,0,.62)';CX.fill();CX.fillStyle=acc;CX.fillText(c.cap,px,py+2*u)}
 CX.restore();CX.globalAlpha=1}
function renderIM(){const el=$s('sm_il');if(!el)return;
 if(!IMC.length){el.innerHTML='<p class="mu">ارفع صور من «🖼️ صور الإدراج الذكي» وهتظهر هنا أماكنها.</p>';return}
 el.innerHTML=IMC.map((c,i)=>{const b=IML.find(x=>x.c===c),rm=IMX.has(c.id);
  const st=rm?'⛔ مشيلاها':b?`✔ عند ${fmt(b.s)} (${(b.e-b.s).toFixed(1)}ث)${b.man?' — بإيدك':b.fb?' — توزيع تلقائي':c.phrase?' — «'+BR_ESC(c.phrase)+'»':''}`:('⚠️ '+(IMSK[c.id]||'مش متحطة'));
  return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px"><img src="${c.thumb}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex:none"><span style="flex:1;font-size:13px;line-height:1.5">${i+1}. ${BR_ESC(c.desc||c.name)}<br><small class="mu">${st}</small></span>${b?`<button type="button" class="b o" data-ims="${b.s}" style="flex:none;padding:6px 8px">${fmt(b.s)}</button>`:''}<button type="button" class="b o" data-imh="${c.id}" style="flex:none;padding:6px 8px" title="حطها هنا">📍</button><button type="button" class="b o" data-imx="${c.id}" style="flex:none;padding:6px 8px">${rm?'↩️':'✕'}</button></div>`}).join('')+
 `<p class="mu" style="margin:0">📍 = حط الصورة عند المشهد الحالي، ✕ = شيلها من الفيديو (من غير ما تمسحها).</p>`;
 el.onclick=e=>{const s=e.target.closest('[data-ims]');if(s){V.currentTime=+s.dataset.ims;draw(V.currentTime);return}
  const h=e.target.closest('[data-imh]');if(h){IMX.delete(h.dataset.imh);IMM=IMM.filter(m=>m.id!==h.dataset.imh);IMM.push({id:h.dataset.imh,s:+(V.currentTime||0).toFixed(2)});computeImg();renderIM();draw(V.currentTime);return}
  const x=e.target.closest('[data-imx]');if(x){const id=x.dataset.imx;if(IMX.has(id))IMX.delete(id);else{IMX.add(id);IMM=IMM.filter(m=>m.id!==id)}computeImg();renderIM();draw(V.currentTime)}}}
function imWire(){const f=$s('sm_if');if(!f||f._w)return;f._w=1;
 f.onchange=e=>{if(e.target.files&&e.target.files.length)addImgFiles([...e.target.files])};f.onclick=e=>{e.target.value=''};
 const ii=$s('sm_ii');if(ii)ii.onclick=e=>{const b=e.target.closest('[data-imd]');if(!b)return;const c=IMC.splice(+b.dataset.imd,1)[0];if(c){try{c.src.close&&c.src.close()}catch(x){}IMM=IMM.filter(m=>m.id!==c.id);IMX.delete(c.id)}IMAI.sig='';paintImIn();if(D){computeImg();renderIM();try{draw(V.currentTime)}catch(x){}imMatch()}};
 const st=$s('sm_ist');if(st){st.value=S.imst||'auto';st.onchange=()=>{S.imst=st.value;saveS();if(D&&V)draw(V.currentTime)}}
 const mb=$s('sm_imb');if(mb)mb.onclick=()=>{if(!IMC.length)return say('ارفع صور الأول');if(!D)return say('اعمل المونتاج الأول وبعدين طابق');imMatch(true)};
 paintImIn()}
const _paintIm=paint;paint=function(){const r=_paintIm.apply(this,arguments);try{imWire()}catch(e){console.warn('imgs',e)}return r};
const _buildIm=build;build=function(){const r=_buildIm.apply(this,arguments);
 try{computeImg();const sg=IML.map(x=>x.s.toFixed(1)+'-'+x.e.toFixed(1)).join(',')+'|'+BRL.map(x=>x.s.toFixed(1)+'-'+x.e.toFixed(1)).join(',');
  if(sg!==BIGSIG&&!_imRe){BIGSIG=sg;_imRe=1;try{_buildIm.apply(this,arguments)}finally{_imRe=0}}
  if(IMC.length&&D&&D.seg&&D.seg.length&&IMAI.sig!==imSig()&&!IMAI.busy)setTimeout(()=>imMatch(),0)}catch(e){console.warn('img',e)}return r};
const _renderListsIm=renderLists;renderLists=function(){const r=_renderListsIm.apply(this,arguments);try{renderIM()}catch(e){}return r};
/* ---------- 🔔 كسر الملل التلقائي: لو فيه أكتر من ~٥ ثواني من غير أي حاجة بتتحرك على الشاشة (كارت/ملصق/إدراج/قطع) بيعمل نبضة زووم خفيفة مع بداية جملة — الفيديو مايبقاش «واقف» ---------- */
let PIL=[];
function computePI(){PIL=[];if(!D||!CAP.length||S.pi===false||O('motion')==='none')return;const dur=D.dur||(V&&V.duration)||0;if(dur<8)return;
 const A=[0,dur];GAPS.forEach(g=>A.push(g[1]));CUTT.forEach(t=>A.push(t));EV.forEach(e=>{if(e.on)A.push(e.s,e.e||e.s+2)});STK.forEach(x=>A.push(x.s));(FXL||[]).forEach(f=>A.push(f.s));
 if(typeof BRL!=='undefined')BRL.forEach(b=>A.push(b.s,b.e));if(typeof IML!=='undefined')IML.forEach(b=>A.push(b.s,b.e));if(CTA)A.push(CTA.s);
 A.sort((a,b)=>a-b);const GAP_MIN=5,STEP=4.2;
 for(let i=0;i<A.length-1;i++){let a=A[i],b=A[i+1];if(b-a<GAP_MIN)continue;let t=a+STEP;
  while(t<b-1.6){const c=CAP.filter(x=>x.s>=t-1&&x.s<=t+1&&!inGap(x.s)).sort((m,n)=>Math.abs(m.s-t)-Math.abs(n.s-t))[0];const at=c?c.s:t;if(!inGap(at)&&(!PIL.length||at-PIL[PIL.length-1].s>3.2))PIL.push({s:at});t=at+STEP}}}
const _buildPI=build;build=function(){const r=_buildPI.apply(this,arguments);try{computePI()}catch(e){console.warn('pi',e)}return r};
/* ---------- 🪄 ضغطة واحدة: يظبط كل حاجة على أفضل جودة تشتغل على أي جهاز (آيفون وويندوز) ---------- */
const ONE={tpl:'pro',o:{},q:1080,fps:30,clar:true,sharp:true,dn:true,auto:true,stab:false,gate:true,clean:true,fx:true,smart:true,pi:true,intro:true,outro:true};
function oneTap(){Object.assign(S,ONE,{o:{}});saveS();
 const V2={sm_ft:'font',sm_cl:'color',sm_sz:'size',sm_as:'aspect',sm_q:'q',sm_fps:'fps'},C2={sm_cr:'clar',sm_hqs:'sharp',sm_hqd:'dn',sm_hqa:'auto',sm_hqb:'stab',sm_hqg:'gate',sm_in:'intro',sm_ou:'outro',sm_cln:'clean',sm_fx:'fx',sm_pi:'pi'};
 Object.keys(V2).forEach(i=>{const e=$s(i);if(e&&S[V2[i]]!==undefined)e.value=S[V2[i]]});Object.keys(C2).forEach(i=>{const e=$s(i);if(e)e.checked=!!S[C2[i]]});
 try{paintTpl();paintOpts()}catch(e){}if(D&&V){try{setupCanvas();LAY.clear();changed()}catch(e){}}
 const m=$s('sm_onem');if(m)m.textContent='✅ اتظبّط: قالب احترافي، جودة عالية جدًا ١٠٨٠ (تشتغل على الآيفون وويندوز)، تنضيف الصوت، شحذ ووضوح، لمسات ذكية، وكسر الملل. دوس «اعمل المونتاج الذكي».'}
function piWire(){const b=$s('sm_one');if(b&&!b._w){b._w=1;b.onclick=oneTap}const c=$s('sm_pi');if(c&&!c._w){c._w=1;c.checked=S.pi!==false;c.onchange=()=>{S.pi=c.checked;saveS();if(D&&V){computePI();draw(V.currentTime)}}}}
const _paintPI=paint;paint=function(){const r=_paintPI.apply(this,arguments);try{piWire()}catch(e){console.warn('pi ui',e)}return r};
/* ---------- 📲 كارت النهاية بـ QR: اللي بيتفرج يصوّر الشاشة بالموبايل ويفتح واتساب المحل أو اللينك على طول ---------- */
/* اللينك: اللي انت كاتبه، وإلا واتساب من رقم المحل (01xxxxxxxxx → wa.me/201xxxxxxxxx) */
function qrText(){if(S.qrOn===false)return '';const t=String(S.qr||'').trim();if(t)return /^(https?:|tel:|mailto:|geo:|whatsapp:)/i.test(t)?t:(/^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(t)?'https://'+t:t);
 const ph=en(brand().phone||'').replace(/\D/g,'');if(!ph)return '';const intl=ph.startsWith('20')?ph:ph.startsWith('0')?'2'+ph:'20'+ph;return 'https://wa.me/'+intl}
let QRC={t:'',c:null};
function qrCanvas(t){if(QRC.t===t&&QRC.c)return QRC.c;let q;try{q=qrcode(0,'M');q.addData(unescape(encodeURIComponent(t)),'Byte');q.make()}catch(e){try{q=qrcode(0,'L');q.addData(unescape(encodeURIComponent(t)),'Byte');q.make()}catch(e2){QRC={t,c:null};return null}}
 const n=q.getModuleCount(),m=4,px=8,c=document.createElement('canvas');c.width=c.height=(n+m*2)*px;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.fillStyle='#000';
 for(let r=0;r<n;r++)for(let k=0;k<n;k++)if(q.isDark(r,k))x.fillRect((k+m)*px,(r+m)*px,px,px);QRC={t,c};return c}
const outLen=()=>qrText()?4:2.2;   // مع QR النهاية بتطول عشان يلحق يصوّرها
function drawQR(W,H,u,oy,a,acc,F){const t=qrText();if(!t)return;const c=qrCanvas(t);if(!c)return;let sz=Math.min(W*.42,330*u);const top=Math.max(H*.1,oy-sz-90*u);sz=Math.min(sz,oy-100*u-top);if(sz<140*u)return;
 const x=W/2-sz/2,y=oy-sz-100*u,pad=16*u;CX.save();CX.globalAlpha=a;CX.shadowColor='rgba(0,0,0,.5)';CX.shadowBlur=30*u;rr(x-pad,y-pad,sz+2*pad,sz+2*pad,24*u);CX.fillStyle='#fff';CX.fill();CX.shadowBlur=0;CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();
 CX.imageSmoothingEnabled=false;CX.drawImage(c,x,y,sz,sz);CX.imageSmoothingEnabled=true;
 CX.font=`800 ${Math.round(30*u)}px ${F}`;CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';const lb=/wa\.me|whatsapp/i.test(t)?'📷 صوّر الكود وكلّمنا واتساب':'📷 صوّر الكود';const tw=CX.measureText(lb).width+40*u;rr(W/2-tw/2,y+sz+pad+8*u,tw,48*u,24*u);CX.fillStyle=acc;CX.fill();CX.fillStyle='#111';CX.fillText(lb,W/2,y+sz+pad+33*u);CX.restore()}
function qrWire(){const i=$s('sm_qr');if(!i||i._w)return;i._w=1;i.value=S.qr||'';const st=()=>{const m=$s('sm_qrm');if(m){const t=qrText();m.textContent=t?'✔ الكود هيفتح: '+t:(S.qrOn===false?'الكود مقفول':'⚠️ مفيش لينك ولا رقم تليفون للمحل — اكتب لينك أو رقم واتساب')}};
 i.oninput=()=>{S.qr=i.value;saveS();st();if(D&&V)draw(V.currentTime)};const c=$s('sm_qro');if(c){c.checked=S.qrOn!==false;c.onchange=()=>{S.qrOn=c.checked;saveS();st();if(D&&V)draw(V.currentTime)}}st()}
const _paintQR=paint;paint=function(){const r=_paintQR.apply(this,arguments);try{qrWire()}catch(e){console.warn('qr ui',e)}return r};
/* ---------- 🎬 المخرج الذكي + 🅰️🅱️ نسختين بهوكين + 🌍 كابشن بلغتين (دالة video-plus) ---------- */
let DIR={busy:0,err:'',r:null,k:''},TRS={busy:0,err:'',k:''};
const dKey=()=>D?(D._imk||(D._imk=Math.random().toString(36).slice(2)))+':'+(D.seg||[]).length:'';
async function plusCall(body,ms){const tok=await token(),ac=new AbortController(),to=setTimeout(()=>ac.abort(),ms||125000);let r;
 try{r=await fetch(MK_URL+'/functions/v1/video-plus',{method:'POST',signal:ac.signal,headers:{'Content-Type':'application/json',Authorization:'Bearer '+tok,apikey:MK_KEY},body:JSON.stringify(body)})}
 catch(e){throw new Error(e&&e.name==='AbortError'?'السيرفر اتأخر — جرّب تاني':'النت مقطوع')}finally{clearTimeout(to)}
 const j=await r.json().catch(()=>({}));if(!r.ok||j.error)throw new Error(j.error||('السيرفر '+r.status));return j}
const liveSegs=()=>(D&&D.seg||[]).map((g,i)=>({i,s:+(+g.s).toFixed(2),e:+(+g.e).toFixed(2),t:g.t,cut:g.cut})).filter(g=>String(g.t||'').trim());
async function dirRun(){if(!D||!D.seg||!D.seg.length)return say('اعمل المونتاج الأول');if(DIR.busy)return;DIR.busy=1;DIR.err='';dirPaint();
 try{const segs=liveSegs().filter(g=>!g.cut);DIR.r=await plusCall({mode:'direct',segs,title:D.title||'',dur:D.dur||(V&&V.duration)||0,products:prods().map(p=>p.nm).filter(Boolean)});DIR.k=dKey();DIR.r.cuts.forEach(c=>c.on=true)}
 catch(e){DIR.err=String(e&&e.message||e).slice(0,160)}DIR.busy=0;dirPaint()}
function dirApplyCuts(){const r=DIR.r;if(!r)return;let n=0;r.cuts.forEach(c=>{if(!c.on)return;const g=D.seg[c.i];if(g&&!g.cut){g.cut=true;g.man=true;n++}});if(n&&!O('takes')){S.o.takes=true;saveS();try{paintOpts()}catch(e){}}
 build();renderLists();try{draw(V.currentTime);updBar()}catch(e){}say(n?'✂️ اتشال '+n+' جملة ضعيفة — تقدر ترجّع أي واحدة من «الكلام»':'مفيش جمل جديدة تتشال')}
function dirHook(text){if(!text)return;S.hook={n:'🎬 المخرج الذكي',text,fx:(S.hook&&S.hook.fx)||'slam'};saveS();try{LAY.clear();draw(.1)}catch(e){}say('✅ الهوك اتحط في أول الفيديو')}
async function abExport(){const r=DIR.r;if(!r||!r.hook.text||!r.hookB.text)return say('شغّل المخرج الذكي الأول');if(busy)return;const keep=S.hook?Object.assign({},S.hook):null,out=$s('sm_out');
 try{S.hook={n:'🅰️',text:r.hook.text,fx:(keep&&keep.fx)||'slam'};say('🅰️ بصدّر النسخة الأولى…');await exportVid();
  if(out&&out.children.length){const w=document.createElement('div');w.id='sm_outA';const h=document.createElement('h2');h.textContent='🅰️ نسخة A — «'+r.hook.text+'»';w.appendChild(h);while(out.firstChild)w.appendChild(out.firstChild);const old=$s('sm_outA');if(old)old.remove();out.after(w)}
  S.hook={n:'🅱️',text:r.hookB.text,fx:(keep&&keep.fx)||'flash'};say('🅱️ بصدّر النسخة التانية…');await exportVid();
  if(out&&out.firstChild){const h=document.createElement('h2');h.textContent='🅱️ نسخة B — «'+r.hookB.text+'»';out.prepend(h)}
  say('✅ النسختين جاهزين — انشر الاتنين وشوف أنهي بيتشاف أكتر')}
 finally{if(keep)S.hook=keep;else delete S.hook;saveS();try{draw(V.currentTime)}catch(e){}}}
function dirPaint(){const el=$s('sm_dir');if(!el)return;const r=DIR.r&&DIR.k===dKey()?DIR.r:null,E=BR_ESC;
 if(DIR.busy){el.innerHTML='<p class="mu">🎬 المخرج بيتفرج على كلامك ويراجعه… (ممكن ياخد دقيقة)</p>';return}
 let h=`<button type="button" class="b" id="dr_go" style="width:100%">${r?'🔄 راجع تاني':'🎬 خلّي المخرج يراجع الفيديو'}</button>`;
 if(DIR.err)h+=`<p class="mu">⚠️ ${E(DIR.err)}</p>`;
 if(r){const L=liveSegs(),txt=i=>{const g=D.seg[i];return g?E(g.t):''},st=r.structure,mk=(k,n)=>`<div>${st[k]>=0?'✔':'⚠️'} ${n}${st[k]>=0?' — «'+txt(st[k])+'»':' — مش موجود'}</div>`;
  h+=`<div style="margin-top:10px;font-size:22px;font-weight:900">قوة الفيديو كإعلان: ${ar(String(r.score))}/١٠٠</div>`;
  h+=`<div class="p" style="margin-top:8px"><b>🪝 أقوى بداية</b><div style="font-size:18px;font-weight:800;margin:6px 0">«${E(r.hook.text)}»</div><div class="mu">${E(r.hook.why||'')}</div><button type="button" class="b o" id="dr_hk" style="width:100%;margin-top:6px">حطها في أول الفيديو</button>${r.hookB.text?`<div style="margin-top:10px"><b>🅱️ هوك تاني للمقارنة:</b> «${E(r.hookB.text)}»</div><div style="display:flex;gap:6px;margin-top:6px"><button type="button" class="b o" id="dr_hb" style="flex:1">استخدم ده بدل الأول</button><button type="button" class="b" id="dr_ab" style="flex:1">🅰️🅱️ صدّر نسختين</button></div><p class="mu" style="margin:4px 0 0">نسختين بنفس الفيديو وبداية مختلفة — انشرهم وشوف أنهي أنجح.</p>`:''}</div>`;
  h+=`<div class="p"><b>🧱 هيكل الإعلان</b><div style="line-height:1.9;margin-top:4px">${mk('problem','المشكلة')}${mk('solution','الحل (المنتج)')}${mk('proof','الدليل')}${mk('cta','النداء (اطلب)')}</div>${st.cta<0?'<button type="button" class="b o" id="dr_cta" style="width:100%;margin-top:6px">ضيف نداء «اطلب دلوقتي» على الشاشة</button>':''}</div>`;
  h+=`<div class="p"><b>✂️ جمل ضعيفة تتشال (${ar(String(r.cuts.length))})</b>${r.cuts.length?r.cuts.map((c,k)=>`<label style="display:flex;gap:8px;align-items:flex-start;margin-top:6px"><input type="checkbox" data-dc="${k}" ${c.on?'checked':''}><span>«${txt(c.i)}»<br><small class="mu">${E(c.why)}</small></span></label>`).join('')+'<button type="button" class="b o" id="dr_cut" style="width:100%;margin-top:8px">✂️ شيل المختار</button>':'<p class="mu">مفيش — الكلام نضيف 👌</p>'}</div>`;
  if(r.tips.length)h+=`<div class="p"><b>💡 نصايح المخرج</b><ul style="margin:6px 0 0;padding-inline-start:20px;line-height:1.8">${r.tips.map(x=>'<li>'+E(x)+'</li>').join('')}</ul></div>`;
  if(r.titles&&r.titles.length)h+=`<div class="p"><b>🏷️ عناوين</b>${r.titles.map((x,k)=>`<div style="display:flex;gap:6px;align-items:center;margin-top:6px"><span style="flex:1">${E(x)}</span><button type="button" class="b o" data-dt="${k}" style="flex:none;padding:4px 10px">استخدمه</button></div>`).join('')}</div>`}
 el.innerHTML=h;
 el.onclick=e=>{const id=e.target.id;if(id==='dr_go')return dirRun();if(!r)return;if(id==='dr_hk')return dirHook(r.hook.text);if(id==='dr_hb')return dirHook(r.hookB.text);if(id==='dr_ab')return abExport();if(id==='dr_cut')return dirApplyCuts();
  if(id==='dr_cta'){S.o.cta=true;saveS();try{paintOpts()}catch(x){}changed();say('✅ النداء اتضاف');return}
  const t=e.target.closest('[data-dt]');if(t){D.title=r.titles[+t.dataset.dt];const ti=$s('sm_ti');if(ti)ti.value=D.title;try{LAY.clear();draw(V.currentTime)}catch(x){}say('✅ العنوان اتغيّر')}};
 el.onchange=e=>{const c=e.target.closest('[data-dc]');if(c&&r)r.cuts[+c.dataset.dc].on=c.checked}}
/* 🌍 كابشن بلغتين: سطر إنجليزي صغير تحت الكلام */
async function trRun(){if(!D||!D.seg||!D.seg.length||TRS.busy)return;const k=dKey();if(TRS.k===k&&D.en)return;TRS.busy=1;TRS.err='';trMsg();
 try{const segs=liveSegs().map(g=>({i:g.i,s:g.s,e:g.e,t:g.t}));const j=await plusCall({mode:'translate',segs});const m={};j.items.forEach(x=>{m[x.i]=x.en});D.en=m;TRS.k=k}
 catch(e){TRS.err=String(e&&e.message||e).slice(0,140)}TRS.busy=0;trMsg();try{draw(V.currentTime)}catch(e){}}
function trMsg(){const m=$s('sm_trm');if(!m)return;m.textContent=!S.tr?'':TRS.busy?'⏳ بترجم…':TRS.err?'⚠️ الترجمة ماشتغلتش: '+TRS.err:D&&D.en?'✔ الترجمة جاهزة ('+Object.keys(D.en).length+' جملة) — تقدر تعدّلها من «الكلام»':D?'':'هتترجم بعد ما تعمل المونتاج'}
function drawEn(t){if(!S.tr||!D||!D.en||!CV||!CX)return;const od=outDur(),ot=outT(t);if(S.outro&&od>4&&ot>od-outLen())return;if(S.hook&&S.hook.text&&ot<2.4)return;
 const i=(D.seg||[]).findIndex(g=>t>=g.s&&t<g.e&&!(O('takes')&&g.cut));if(i<0)return;const en=D.en[i];if(!en)return;const c=capAt(t);if(!c)return;
 const W=CV.width,H=CV.height,u=W/1080,Ly=capLayout(c),sz=Math.round(34*u*Math.min(1.25,S.size));CX.save();CX.font=`700 ${sz}px Inter,Arial,sans-serif`;CX.direction='ltr';CX.textAlign='center';CX.textBaseline='middle';
 let txt=en;while(CX.measureText(txt).width>W*.88&&txt.length>8)txt=txt.slice(0,-2);if(txt!==en)txt=txt.replace(/\s+\S*$/,'')+'…';const tw=CX.measureText(txt).width+32*u,bh=sz*1.5;
 let y=Ly.band[1]+bh/2+8*u;if(y+bh/2>H*.985)y=Ly.band[0]-bh/2-8*u;rr(W/2-tw/2,y-bh/2,tw,bh,bh/2);CX.fillStyle='rgba(0,0,0,.6)';CX.fill();CX.fillStyle='#fff';CX.fillText(txt,W/2,y+1*u);CX.restore()}
const _drawEn=draw;draw=function(t){const r=_drawEn.apply(this,arguments);try{drawEn(t)}catch(e){}return r};
function plusWire(){const c=$s('sm_tr');if(c&&!c._w){c._w=1;c.checked=!!S.tr;c.onchange=()=>{S.tr=c.checked;saveS();trMsg();if(S.tr)trRun();else try{draw(V.currentTime)}catch(e){}};trMsg()}dirPaint()}
const _paintPlus=paint;paint=function(){const r=_paintPlus.apply(this,arguments);try{plusWire()}catch(e){console.warn('plus ui',e)}return r};
const _buildPlus=build;build=function(){const r=_buildPlus.apply(this,arguments);try{if(S.tr&&D&&D.seg&&D.seg.length&&TRS.k!==dKey()&&!TRS.busy)setTimeout(trRun,0);dirPaint();trMsg()}catch(e){}return r};
/* ---------- 🔎 منتجات ميكانيزم: الستوديو بيقرا من السيستم (كل الأصناف بأسعارها ومخزونها وصورها) ومن الموقع (بيانات المحل والمنتجات المعروضة) عن طريق جسر /api/mk (قراية بس) ---------- */
const SYS={at:'',rt:'',user:null};try{Object.assign(SYS,JSON.parse(localStorage.getItem('mkz-sys')||'{}'))}catch(e){}
const sysSave=()=>{try{localStorage.setItem('mkz-sys',JSON.stringify({at:SYS.at,rt:SYS.rt,user:SYS.user}))}catch(e){}};
const selSave=()=>{try{localStorage.setItem('mkz-selp',JSON.stringify(SELP))}catch(e){}};
let SITE=null,SINFO=null,SRES=[],SQ='',SBUSY=0,SERR='',STO=0;
/* أي لينك صورة من السيستم أو الموقع (…/api/v1/work/files/x.jpg) بيتقري من نفس الدومين عشان الصورة تدخل الفيديو المتصدّر */
const mkImg=u=>{u=String(u||'');const m=u.match(/\/api\/v1\/(work\/files\/[\w.-]+)/);return m?'/api/mk/'+m[1]:u};
async function sysGet(path,noAuth){const go=()=>fetch('/api/mk/'+path,{headers:SYS.at&&!noAuth?{'x-mk-at':SYS.at}:{},cache:'no-store'});let r=await go();
 if(r.status===401&&!noAuth&&SYS.rt){const rr=await fetch('/api/mk/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rt:SYS.rt})});const j=await rr.json().catch(()=>({}));
  if(rr.ok&&j.at){SYS.at=j.at;SYS.rt=j.rt||SYS.rt;sysSave();r=await go()}else{SYS.at='';SYS.rt='';sysSave()}}
 const j=await r.json().catch(()=>({}));if(!r.ok){if(r.status===401){SYS.at='';sysSave()}throw Object.assign(new Error((j.error&&j.error.message)||j.message||(typeof j.error==='string'?j.error:'')||('السيستم '+r.status)),{status:r.status})}return j}
async function siteLoad(){if(SITE)return SITE;try{const j=await sysGet('web/public/site',true);SITE=(j&&j.site&&j.site.data)||{};
  SITEB={};if(SITE.phone)SITEB.phone=String(SITE.phone);if(SITE.address)SITEB.addr=String(SITE.address).slice(0,60);
  try{if(V&&CV)draw(V.currentTime)}catch(e){}}catch(e){SITE=null}return SITE}
async function infoLoad(){if(SINFO||!SYS.at)return SINFO;try{const j=await sysGet('products/info/all');const m={};(j.items||j.info||(Array.isArray(j)?j:[])).forEach(r=>{if(r&&r.productId)m[r.productId]=r});SINFO=m}catch(e){}return SINFO}
const siteProds=()=>((SITE&&SITE.products)||[]).map(x=>({code:String(x.code||''),name:String(x.name||''),desc:String(x.desc||''),imgs:(x.imgs||[x.img]).filter(Boolean)}));
function mkSel(it){const code=String(it.code||''),sp=siteProds().find(x=>x.code&&x.code===code),inf=SINFO&&it.id?SINFO[it.id]:null;
 const imgs=[].concat(inf&&Array.isArray(inf.imgs)?inf.imgs.map(x=>typeof x==='string'?x:(x&&(x.url||x.src))||''):[],sp?sp.imgs:[]).filter(Boolean).map(mkImg).filter((u,i,a)=>a.indexOf(u)===i).slice(0,20);
 return {id:'sys-'+(code||it.id||it.name),code,nm:String(it.name||it.nm||''),pr:it.price!=null&&+it.price>0?String(+it.price):'',img:imgs[0]||'',imgs,qty:it.qty!=null?+it.qty:null,cat:it.category||'',unit:it.unit||'',
  descr:String((inf&&inf.descr)||(sp&&sp.desc)||'').slice(0,600),specs:[inf&&inf.brand,inf&&inf.size,inf&&inf.finish,inf&&inf.specs].filter(Boolean).join(' • ').slice(0,200)}}
async function sysSearch(q){SQ=q;SERR='';const qq=String(q||'').trim();if(!qq){SRES=[];sysPaint();return}SBUSY++;sysPaint();
 try{await siteLoad();let L=[];
  if(SYS.at){await infoLoad();const j=await sysGet('products/all?q='+encodeURIComponent(qq));if(SQ!==q){SBUSY--;return}L=(j.items||[]).slice(0,60).map(mkSel)}
  const n=norm(qq),sp=siteProds().filter(x=>norm(x.name).includes(n)||x.code===qq).map(x=>mkSel({code:x.code,name:x.name}));
  sp.forEach(x=>{if(!L.some(y=>y.code&&y.code===x.code))L.push(x)});SRES=L}
 catch(e){SERR=e.status===401?'login':String(e.message||e).slice(0,140)}SBUSY--;sysPaint()}
async function sysLogin(){const l=$s('sy_l'),pw=$s('sy_p'),b=$s('sy_go');if(!l||!pw)return;if(!l.value.trim()||!pw.value)return say('اكتب رقم الموبايل وكلمة السر بتاعة السيستم');b.disabled=true;b.textContent='⏳';
 try{const r=await fetch('/api/mk/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({login:en(l.value.trim()),password:pw.value})});const j=await r.json().catch(()=>({}));
  if(!r.ok||!j.at)throw new Error(j.error||'الدخول ماتمّش');SYS.at=j.at;SYS.rt=j.rt||'';SYS.user=j.user?{name:j.user.name||'',role:j.user.role||''}:null;sysSave();SINFO=null;pw.value='';say('✅ الستوديو اتربط بالسيستم');if(SQ)sysSearch(SQ)}
 catch(e){say(String(e.message||e))}b.disabled=false;b.textContent='ادخل';sysPaint()}
function sysPaint(){const L=$s('sm_sysl'),R=$s('sm_sysr'),P=$s('sm_syss');if(!L)return;const E=BR_ESC;
 L.innerHTML=SYS.at?`<div class="mu">✔ مربوط بالسيستم${SYS.user&&SYS.user.name?' — '+E(SYS.user.name):''} · كل الأصناف بأسعارها ومخزونها <button type="button" class="b o" id="sy_out" style="padding:2px 10px;min-height:30px;font-size:12px">خروج</button></div>`
  :`<div style="border:1px dashed var(--a2,#d4a537);border-radius:12px;padding:10px;margin-bottom:8px"><div class="mu" style="margin-bottom:6px">ادخل بحساب <b>السيستم</b> مرة واحدة عشان تشوف كل الأصناف بأسعارها ومخزونها وصورها. (من غير دخول بتدوّر في منتجات الموقع بس)</div><input id="sy_l" placeholder="رقم الموبايل أو الإيميل" autocomplete="username" dir="ltr" style="width:100%;margin-bottom:6px"><input id="sy_p" type="password" placeholder="كلمة السر" autocomplete="current-password" style="width:100%;margin-bottom:6px"><button type="button" class="b" id="sy_go" style="width:100%">ادخل</button></div>`;
 if(R){R.innerHTML=SBUSY?'<p class="mu">⏳ بدوّر…</p>':SERR==='login'?'<p class="mu">⚠️ الدخول خلص — ادخل تاني بحساب السيستم</p>':SERR?'<p class="mu">⚠️ '+E(SERR)+'</p>':!SQ?'':!SRES.length?'<p class="mu">مالقيتش منتج بالاسم ده'+(SYS.at?'':' في الموقع — ادخل بحساب السيستم تدوّر في كل الأصناف')+'</p>':
  SRES.map((x,i)=>{const on=SELP.some(y=>y.id===x.id);return `<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">${x.img?`<img src="${E(x.img)}" loading="lazy" style="width:52px;height:52px;object-fit:cover;border-radius:10px;flex:none;background:#222">`:'<div style="width:52px;height:52px;border-radius:10px;background:#222;flex:none;display:grid;place-items:center">📦</div>'}<span style="flex:1;font-size:13px;line-height:1.5"><b>${E(x.nm)}</b><br><small class="mu">${x.code?'#'+E(x.code)+' · ':''}${x.pr?ar(x.pr)+' جنيه · ':''}${x.qty==null?'من الموقع':x.qty>0?'✔ متاح ('+ar(String(x.qty))+')':'✖ خلصان'}${x.imgs.length?' · '+ar(String(x.imgs.length))+' صورة':''}</small></span><button type="button" class="b ${on?'':'o'}" data-sya="${i}" style="flex:none;padding:6px 10px">${on?'✔':'اختار'}</button></div>`}).join('')}
 if(P)P.innerHTML=SELP.length?'<div style="font-weight:800;margin:8px 0 6px">📦 منتجات الفيديو ده (السعر والاسم والصورة بيظهروا في الكروت، والذكاء بيعرفهم):</div>'+SELP.map((x,i)=>`<div style="padding:8px;border:1px solid rgba(255,255,255,.12);border-radius:12px;margin-bottom:8px"><div style="display:flex;gap:8px;align-items:center">${x.img?`<img src="${E(x.img)}" style="width:44px;height:44px;object-fit:cover;border-radius:8px;flex:none">`:''}<span style="flex:1;font-size:13px"><b>${E(x.nm)}</b>${x.pr?' — '+ar(x.pr)+' جنيه':''}</span><button type="button" class="b o" data-syx="${i}" style="flex:none;padding:4px 10px">✕</button></div>${x.descr||x.specs?`<div class="mu" style="font-size:12px;margin-top:4px">${E([x.specs,x.descr].filter(Boolean).join(' — ').slice(0,220))}</div>`:''}<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">${x.imgs.length?`<button type="button" class="b o" data-syi="${i}" style="flex:1;padding:6px">🖼️ صوره في الفيديو (${ar(String(x.imgs.length))})</button>`:''}<button type="button" class="b o" data-syh="${i}" style="flex:1;padding:6px">🪝 هوك ليه</button><button type="button" class="b o" data-syc="${i}" style="flex:1;padding:6px">📋 انسخ بياناته</button></div></div>`).join(''):''}
async function selImgs(x){const urls=x.imgs.slice(0,Math.max(0,IM_MAX-IMC.length));if(!urls.length)return say('مفيش مكان لصور تانية (أقصى '+IM_MAX+')');say('⏳ بجيب '+urls.length+' صورة…');const files=[];
 await Promise.all(urls.map(async(u,k)=>{try{const r=await fetch(u);if(!r.ok)return;const b=await r.blob();if(!/^image\//.test(b.type)&&b.size<1000)return;files[k]=new File([b],(x.code||'prod')+'-'+(k+1)+'.'+((b.type.split('/')[1]||'jpg').replace('jpeg','jpg')),{type:b.type||'image/jpeg'})}catch(e){}}));
 const ok=files.filter(Boolean);if(!ok.length)return say('مقدرتش أجيب صور المنتج — جرّب تاني');await addImgFiles(ok)}
function sysWire(){const q=$s('sm_sysq');if(!q||q._w)return;q._w=1;q.value=SQ;q.oninput=()=>{clearTimeout(STO);STO=setTimeout(()=>sysSearch(q.value),350)};
 const box=$s('sm_sys');box.onclick=e=>{const t=e.target;if(t.id==='sy_go')return sysLogin();if(t.id==='sy_out'){SYS.at='';SYS.rt='';SYS.user=null;SINFO=null;sysSave();sysPaint();return}
  const a=t.closest('[data-sya]');if(a){const x=SRES[+a.dataset.sya];if(!x)return;const k=SELP.findIndex(y=>y.id===x.id);if(k>=0)SELP.splice(k,1);else{SELP.unshift(x);SELP=SELP.slice(0,10)}selSave();sysPaint();if(D)changed();return}
  const xb=t.closest('[data-syx]');if(xb){SELP.splice(+xb.dataset.syx,1);selSave();sysPaint();if(D)changed();return}
  const ib=t.closest('[data-syi]');if(ib){const x=SELP[+ib.dataset.syi];if(x)selImgs(x);return}
  const hb=t.closest('[data-syh]');if(hb){const x=SELP[+hb.dataset.syh],hp=$s('hk_p');if(x&&hp){hp.value=x.nm;hp.dispatchEvent(new Event('input',{bubbles:true}));say('✅ اسم المنتج اتحط في الهوكات — اختار هوك')}return}
  const cb=t.closest('[data-syc]');if(cb){const x=SELP[+cb.dataset.syc];if(!x)return;const tx=[x.nm,x.pr?'السعر: '+x.pr+' جنيه':'',x.code?'الكود: '+x.code:'',x.specs,x.descr,x.qty!=null?(x.qty>0?'متاح':'خلصان'):''].filter(Boolean).join('\n');try{navigator.clipboard.writeText(tx);say('📋 اتنسخ')}catch(e){say(tx)}}};
 box.addEventListener('keydown',e=>{if(e.key==='Enter'&&(e.target.id==='sy_p'||e.target.id==='sy_l'))sysLogin()});
 sysPaint();siteLoad().then(()=>{if(SQ)sysSearch(SQ)})}
const _paintSys=paint;paint=function(){const r=_paintSys.apply(this,arguments);try{sysWire()}catch(e){console.warn('sys ui',e)}return r};
/* ---------- ✨ لمسات ذكية: شارات وأرقام متحركة بتطلع من كلامك (من غير ما تعتمد على السيرفر) وبتبعد عن وشك ---------- */
let FXL=[];
const FXB=[[/ضمان|مضمون/,'warranty','ضمان',null],[/اصلي|اوريجينال|براند|مستورد|جوده|جودة/,'original','جودة أصلية',null],[/توصيل|شحن/,'shipping','توصيل',null],[/تركيب|تثبيت|يتركب/,'tools','تركيب',null],
 [/واتساب|كلمنا|اتصل|اتصلو|رسايل|تليفون/,'contact','تواصل معانا',null],[/مقاسات|الوان|انواع|موديلات|اشكال/,'options','اختيارات كتير',null],
 [/رخيص|خصم|عرض|سعر|اسعار|فلوس/,null,'سعر مميز','💰'],[/سريع|بسرعه|فورا|بسرع/,null,'سريع','⚡'],[/قوي|تقيل|يشيل|متين|يتحمل/,null,'قوي ومتين','💪'],[/هادي|بهدوء|من غير صوت/,null,'هادي','🤫'],[/جديد|وصل|لسه/,null,'جديد','🆕'],[/احذر|خلي بالك|غلط|مشكله/,null,'خلي بالك','⚠️'],[/^(عشان|علشان|لان|لانه)$/,null,'السبب','💡'],[/^(اولا|ثانيا|ثالثا)$/,null,'خطوة جديدة','👉']];
const FXU=/^(سم|ملي|مم|متر|م|كيلو|كجم|جرام|جنيه|ج|الف|%|سنه|سنين|سنوات|ثانيه|ثواني|دقيقه|دقايق|درجه|كيلوجرام)/;
function buildFx(){FXL=[];if(S.fx===false||!CAP.length)return;
 const W=[];CAP.forEach(c=>{const n=c.w.length,d=Math.max(.2,c.e-c.s);c.w.forEach((w,i)=>W.push({raw:w,w:norm(w),s:c.s+d*i/n,e:c.s+d*(i+1)/n}))});
 const near=(a,b,ty)=>EV.some(x=>showEv(x)&&(!ty||ty.includes(x.type))&&x.s<b&&x.e>a);
 let lastEnd=-9;const NUM=[],BDG=[];
 W.forEach((x,i)=>{
  /* أرقام: ٦٠ سم، ٥٠٠ جنيه، ١٠ سنين ضمان */
  const num=en(x.raw).replace(/[^0-9.,]/g,'').replace(',','.');
  if(num&&/^\d+(\.\d+)?$/.test(num)&&W[i+1]){const u2=norm(W[i+1].raw);if(FXU.test(u2)&&x.s>lastEnd+.4&&!near(x.s-.4,x.s+2,['measure','price'])){const unit=W[i+1].raw;NUM.push({s:x.s,e:x.s+2.6,kind:'num',val:parseFloat(num),unit,label:''});lastEnd=x.s+2.6;return}}
  const b=FXB.find(r=>r[0].test(x.w));if(!b||x.s<.6)return;
  if(near(x.s-.3,x.s+1.6,['product','point','step','anim','warn','measure','price']))return;
  BDG.push({s:x.s,e:x.s+1.9,kind:'badge',icon:b[1],em:b[3],label:b[2]})});
 /* ماتبقاش كتير: أقصى شارة كل ٣ ثواني تقريبًا */
 const out=[];BDG.forEach(f=>{const l=out[out.length-1];if(NUM.some(n=>f.s<n.e+.3&&f.e>n.s-.3))return;if(!l||f.s-l.s>=2.6)out.push(f)});const base=NUM.concat(out),KW=[];
 if(!O('stk')){let last=-9;const STOPW=/^(اللي|الي|ده|دي|دول|كده|يعني|ازاي|انا|احنا|انت|هو|هي|ممكن|لازم|كمان|برضو|عشان|علشان|لان|لكن|يلا|اصل|فيه|علي|على|عندنا|عندك|بتاع|بتاعه|بتاعت|هنا|هناك|دلوقتي|النهارده|جدا|اوي|حاجه|حاجات|الحاجه|بتاعنا|جماعه|يا جماعه)$/;
  CAP.forEach(c=>{if(c.s<last+2.1||c.s<.8)return;const k1=(c.kw||[]).map(norm),cand=c.w.map((x,i)=>({x,n:norm(x),i})).filter(o=>o.n.length>=4&&!STOPW.test(o.n)&&!/^\d+$/.test(en(o.n)));
   const w=cand.find(o=>k1.some(k=>k&&(o.n===k||k.split(/\s+/).includes(o.n))))||cand.slice().sort((a,b)=>b.n.length-a.n.length)[0];if(!w)return;
   const d=Math.max(.2,c.e-c.s),ts=c.s+d*w.i/c.w.length,item={s:ts,e:ts+1.5,kind:'kw',word:w.x.replace(/[.,،؟!?:«»"]/g,''),em:emojiFor(c.w.join(' '))};
   if(base.some(n=>item.s<n.e+.2&&item.e>n.s-.2)||EV.some(x=>showEv(x)&&x.s<item.e&&x.e>item.s))return;KW.push(item);last=ts})}
 FXL=base.concat(KW).sort((a,b)=>a.s-b.s)}
function fxSide(t,w){const [W,H]=[CV.width,CV.height],u=W/1080,hd=headAt(t),f=xf(t);let hx0=W*.35,hx1=W*.65,hy=H*.2;
 if(hd&&!f.side){hx0=f.x+hd.x0*f.w-30*u;hx1=f.x+hd.x1*f.w+30*u;hy=f.y+(hd.y0+hd.y1)/2*f.h}
 const m=24*u,sh=O('safe')?W*.06:0,right=W-m-w,left=m+sh,fitsL=m+w<hx0,fitsR=right-sh>hx1;
 let x=null;if(fitsR&&fitsL)x=((hx0+hx1)/2<W/2)?right:left;else if(fitsR)x=right;else if(fitsL)x=left;
 const top=headRect(t),y=Math.max(H*.1,Math.min(H*.42,hy));
 if(x==null){/* الوش واخد العرض: نحطها فوق الراس لو فيه مكان، وإلا نشيلها */if(top&&top[0]>H*.16)return {x:(W-w)/2,y:Math.max(H*.08,top[0]-70*u)};return null}
 return {x,y}}
function drawFx(t,W,H,u,F,acc){if(S.fx===false)return;const f=FXL.find(x=>t>=x.s&&t<x.e);if(!f)return;
 const dt=t-f.s,a=Math.min(ease(dt/.28),1-ease((t-f.e+.3)/.3));if(a<=0)return;
 const lab=f.kind==='num'?(f.unit):f.kind==='kw'?f.word:f.label;CX.save();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 CX.font=`800 ${Math.round(40*u)}px ${F}`;const tw=CX.measureText(lab).width;
 if(f.kind==='kw'){drawKw(f,t,W,H,u,F,acc,dt,a);CX.restore();return}
 if(f.kind==='badge'){const bw=Math.min(W*.62,tw+190*u),bh=96*u,p=fxSide(t,bw);if(!p){CX.restore();return}
  const k=p.x+bw/2<W/2?-1:1,sl=(1-ease(dt/.35))*k*W*.25,fl=Math.sin(dt*3)*4*u,sc=.9+.1*back(dt/.4);
  CX.globalAlpha=a;CX.translate(p.x+bw/2+sl,p.y+fl);CX.scale(sc,sc);
  /* موجة بتتفتح ورا الأيقونة */const pr=cl(dt/.7);CX.save();CX.globalAlpha=a*(1-pr)*.6;CX.beginPath();CX.arc(bw/2-bh/2,0,bh/2+pr*70*u,0,7);CX.lineWidth=5*u;CX.strokeStyle=acc;CX.stroke();CX.restore();
  dk(-bw/2,-bh/2,bw,bh,bh/2,.82);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();
  if(f.icon)drawIcon(f.icon,bw/2-bh/2,0,bh*.4,dt,acc);else{CX.beginPath();CX.arc(bw/2-bh/2,0,bh*.4,0,7);CX.fillStyle=acc;CX.fill();CX.font=`${Math.round(bh*.46)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(f.em,bw/2-bh/2,3*u)}
  CX.fillStyle='#fff';CX.font=`800 ${Math.round(40*u)}px ${F}`;CX.fillText(f.label,-bh/2+6*u,3*u)}
 else{/* رقم بيعدّ جوه حلقة بتتملي */const R=118*u,bw=R*2+Math.max(0,tw-40*u)+60*u,p=fxSide(t,bw);if(!p){CX.restore();return}
  const k=p.x+bw/2<W/2?-1:1,sl=(1-ease(dt/.35))*k*W*.25,sc=.9+.1*back(dt/.4);CX.globalAlpha=a;CX.translate(p.x+bw/2+sl,p.y);CX.scale(sc,sc);
  dk(-bw/2,-R-18*u,bw,(R+18*u)*2,(R+18*u),.82);const q=ease(dt/.9);CX.lineWidth=12*u;CX.lineCap='round';CX.strokeStyle='rgba(255,255,255,.18)';CX.beginPath();CX.arc(0,0,R-14*u,0,7);CX.stroke();
  CX.strokeStyle=acc;CX.beginPath();CX.arc(0,0,R-14*u,-Math.PI/2,-Math.PI/2+Math.PI*2*q);CX.stroke();
  const shown=Number.isInteger(f.val)?Math.round(f.val*q):(Math.round(f.val*q*10)/10);CX.fillStyle=acc;CX.font=`900 ${Math.round(92*u)}px ${F}`;CX.fillText(ar(String(shown)),0,-14*u);CX.fillStyle='#fff';CX.font=`800 ${Math.round(38*u)}px ${F}`;CX.fillText(f.unit,0,52*u)}
 CX.restore();CX.globalAlpha=1}
/* كلمة مهمة كبيرة بإيموجي بينط في نص الجسم (بين الراس والكلام) */
function drawKw(f,t,W,H,u,F,acc,dt,a){const hr=headRect(t),cap=O('cap')==='none'?H*.93:capBottom()-2*Math.round(CF().sz*u*S.size)*1.34-40*u;
 const top=hr?hr[1]+50*u:H*.34;if(cap-top<260*u)return;const y=Math.min(cap-110*u,Math.max(top+110*u,(top+cap)/2)),kk=STY.on?STY.kw:'under';
 const sc=Math.max(.01,back(dt/.4)),out=1-ease((t-f.e+.25)/.25);let sz=Math.round(124*u);CX.font=`900 ${sz}px ${F}`;const mw=W*.8;let tw=CX.measureText(f.word).width;if(tw>mw){sz=Math.round(sz*mw/tw);CX.font=`900 ${sz}px ${F}`;tw=CX.measureText(f.word).width}
 CX.globalAlpha=a*out;CX.translate(W/2,y);CX.rotate(kk==='sticker'?-.08:kk==='hl'?-.03:-.05);CX.scale(sc,sc);
 if(kk==='under'||kk==='3d'){CX.strokeStyle=acc;CX.lineWidth=6*u;CX.lineCap='round';const br=ease(dt/.45);for(let k=0;k<8;k++){const an=k/8*Math.PI*2,r0=tw*.5+60*u+70*u*br,r1=r0+34*u*(1-br);CX.globalAlpha=Math.max(0,a*out*(1-br*.8));CX.beginPath();CX.moveTo(Math.cos(an)*r0,Math.sin(an)*r0*.5);CX.lineTo(Math.cos(an)*r1,Math.sin(an)*r1*.5);CX.stroke()}CX.globalAlpha=a*out}
 CX.lineJoin='round';
 if(kk==='hl'){const pw=tw+70*u,ph=sz*1.15,w2=pw*ease(dt/.3);rr(-pw/2,-ph/2,w2,ph,16*u);CX.fillStyle=acc;CX.fill();CX.fillStyle='#111';CX.fillText(f.word,0,0)}
 else if(kk==='neon'){CX.shadowColor=acc;CX.shadowBlur=38*u;CX.fillStyle='#fff';CX.fillText(f.word,0,0);CX.fillText(f.word,0,0);CX.shadowBlur=0;CX.lineWidth=4*u;CX.strokeStyle=acc;CX.strokeText(f.word,0,0)}
 else if(kk==='sticker'){const pw=tw+90*u,ph=sz*1.3;CX.save();CX.shadowColor='rgba(0,0,0,.5)';CX.shadowBlur=24*u;CX.shadowOffsetY=8*u;rr(-pw/2,-ph/2,pw,ph,ph/2);CX.fillStyle='#fff';CX.fill();CX.restore();rr(-pw/2,-ph/2,pw,ph,ph/2);CX.lineWidth=8*u;CX.strokeStyle=acc;CX.stroke();CX.fillStyle='#111';CX.fillText(f.word,0,0)}
 else if(kk==='3d'){for(let k=12;k>=1;k--){CX.fillStyle=k%2?'#000':acc;CX.fillText(f.word,k*2.4*u,k*2.4*u)}CX.lineWidth=10*u;CX.strokeStyle='#000';CX.strokeText(f.word,0,0);CX.fillStyle='#fff';CX.fillText(f.word,0,0)}
 else{CX.fillStyle=acc;const uw=(tw+40*u)*ease(dt/.3);CX.fillRect(tw/2+20*u-uw,sz*.52,uw,14*u);CX.lineWidth=16*u;CX.strokeStyle='#000';CX.strokeText(f.word,0,0);CX.fillStyle='#fff';CX.fillText(f.word,0,0)}
 const bob=Math.sin(dt*9)*9*u*Math.max(0,1-dt/1.1);CX.font=`${Math.round(88*u)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(f.em||'✨',0,-sz*(kk==='sticker'?1.1:.95)+bob)}
/* لمسة سينمائية: تعتيم خفيف على الأطراف + لمعة بتعدّي مع كل قطع */
function drawFinish(t,W,H){if(S.fx===false||O('look')==='off')return;
 CX.save();const g=CX.createRadialGradient(W/2,H/2,Math.min(W,H)*.45,W/2,H/2,Math.max(W,H)*.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.28)');CX.fillStyle=g;CX.fillRect(0,0,W,H);
 const d=O('trans')!=='none'?lastCut(t):null;if(d!=null&&d<.4){const p=d/.4,x=-W*.4+W*1.8*p,w=W*.35,gr=CX.createLinearGradient(x-w,0,x+w,H*.5);gr.addColorStop(0,'rgba(255,255,255,0)');gr.addColorStop(.5,`rgba(255,255,255,${(.22*(1-p)).toFixed(3)})`);gr.addColorStop(1,'rgba(255,255,255,0)');CX.globalCompositeOperation='lighter';CX.fillStyle=gr;CX.fillRect(0,0,W,H)}
 CX.restore()}
const _build1=build;build=function(){const r=_build1.apply(this,arguments);try{buildFx()}catch(e){console.warn('fx',e)}return r};
/* ---------- 🎵 موسيقى خلفية بتوطى لوحدها وانت بتتكلم + 🏷️ لوجو المحل ---------- */
const MU={buf:null,name:'',vol:.3,src:null,g:null,ctx:null,pc:null,logo:null};
try{const lg=localStorage.getItem('mkz-logo');if(lg){const im=new Image();im.onload=()=>{MU.logo=im};im.src=lg}}catch(e){}
function musStop(){try{MU.src&&MU.src.stop()}catch(e){}try{MU.g&&MU.g.disconnect()}catch(e){}MU.src=null;MU.g=null}
function musStart(){musStop();if(!MU.buf||!V)return;const rec=REC&&V._ac&&V._dst;const AC=window.AudioContext||window.webkitAudioContext;
 const ctx=rec?V._ac:(MU.pc||(MU.pc=new AC()));try{ctx.resume()}catch(e){}const sr=ctx.createBufferSource();sr.buffer=MU.buf;sr.loop=true;const g=ctx.createGain();g.gain.value=MU.vol;sr.connect(g);g.connect(ctx.destination);if(rec)g.connect(V._dst);
 sr.start(0,(V.currentTime||0)%MU.buf.duration);MU.src=sr;MU.g=g;MU.ctx=ctx}
function musDuck(t){if(!MU.g||!MU.ctx)return;const talk=CAP.some(c=>t>=c.s-.15&&t<=c.e+.3);try{MU.g.gain.setTargetAtTime(MU.vol*(talk?.28:1),MU.ctx.currentTime,.15)}catch(e){}}
function musHook(){if(!V||V._musHook)return;V._musHook=1;V.addEventListener('play',()=>{if(MU.buf)musStart()});V.addEventListener('pause',musStop);V.addEventListener('ended',musStop);V.addEventListener('seeked',()=>{if(MU.buf&&!V.paused)musStart()})}
function paintMu(){const el=$s('sm_mi');if(el)el.innerHTML=MU.buf?`🎵 ${BR_ESC(MU.name)} — ${fmt(MU.buf.duration)} <button type="button" class="b o" id="sm_mx" style="padding:4px 10px">✕</button>`:'';const x=$s('sm_mx');if(x)x.onclick=()=>{musStop();MU.buf=null;paintMu()};
 const lgc=$s('sm_lgc');if(lgc){lgc.style.display=MU.logo?'':'none';$s('sm_lgs').value=LGC.size;$s('sm_lgsv').textContent=LGC.size;$s('sm_lgp').value=LGC.pos;$s('sm_lgo').value=LGC.op}const lg=$s('sm_lgi');if(lg)lg.innerHTML=MU.logo?'🏷️ اللوجو متحفظ وهيظهر فوق على الشمال <button type="button" class="b o" id="sm_lgx" style="padding:4px 10px">✕</button>':'';const lx=$s('sm_lgx');if(lx)lx.onclick=()=>{MU.logo=null;try{localStorage.removeItem('mkz-logo')}catch(e){}paintMu();if(V)draw(V.currentTime)}}
function loadMusic(f){const AC=window.AudioContext||window.webkitAudioContext,tmp=MU.pc||(MU.pc=new AC());const el=$s('sm_mi');if(el)el.textContent='⏳ بحمّل الموسيقى…';
 f.arrayBuffer().then(ab=>new Promise((ok,bad)=>tmp.decodeAudioData(ab,ok,bad))).then(b=>{MU.buf=b;MU.name=f.name;paintMu();if(V&&!V.paused)musStart()}).catch(()=>{if(el)el.textContent='⚠️ مش قادر أقرأ ملف الموسيقى ده (جرّب MP3 أو M4A)'})}
function loadLogo(f){const r=new FileReader();r.onload=()=>{const im=new Image();im.onload=()=>{const k=Math.min(1,256/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);const url=c.toDataURL('image/png');try{localStorage.setItem('mkz-logo',url)}catch(e){}const i2=new Image();i2.onload=()=>{MU.logo=i2;paintMu();if(V)draw(V.currentTime)};i2.src=url};im.src=r.result};r.readAsDataURL(f)}
const LGC=(()=>{try{return Object.assign({size:170,pos:'tl',op:95},JSON.parse(localStorage.getItem('mkz-logo-cfg')||'{}'))}catch(e){return {size:170,pos:'tl',op:95}}})();
function drawLogo(W,H,u){if(!MU.logo)return;const top=(O('letter')?H*.085:0)+(O('prog')?28*u:22*u),sh=O('safe')?W*.06:0,r=MU.logo.width/MU.logo.height;let h=LGC.size*u,w=h*r;if(w>W*.7){w=W*.7;h=w/r}
 const x=LGC.pos==='tr'?W-22*u-sh-w:LGC.pos==='tc'?(W-w)/2:22*u+sh;CX.save();CX.globalAlpha=Math.max(.2,Math.min(1,LGC.op/100));CX.shadowColor='rgba(0,0,0,.45)';CX.shadowBlur=10*u;CX.drawImage(MU.logo,x,top,w,h);CX.restore()}
function lgSave(){try{localStorage.setItem('mkz-logo-cfg',JSON.stringify(LGC))}catch(e){}}
/* ---------- 🎬 لحظات مونتاج ذكية من كلامك: سؤال، مقارنة، خطوات، تقييم، مكان، متابعة، سهم، احتفال، هوك ---------- */
let FX2=[],STEPS=[];
const FX2R=[
 ['q',/^(ازاي|ليه|ايه|فين|امتي|امتى|هل|مين|كام|بكام|يعني ايه)$/,0],
 ['vs',/^(بدل|مقارنه|مقارنة|الفرق|عكس|احسن من|افضل من)$/,1],
 ['stars',/^(ممتاز|ممتازه|احسن|افضل|جباره|جبار|تحفه|عالمي|عالميه|الاول|رقم واحد)$/,1],
 ['pin',/^(عنوان|عنواننا|فرع|فروع|مكاننا|المعرض|تعالو|تعالوا|زورونا|زورنا)$/,1],
 ['follow',/^(تابعونا|تابعنا|اشترك|اشتركو|لايك|فولو|شير|شيرو)$/,1],
 ['arrow',/^(بص|بصو|بصوا|شايفين|شايف|شوفو|شوفوا|هنا)$/,1],
 ['party',/^(مبروك|خصم|هديه|هدية|مجانا|ببلاش|عرض|عروض)$/,1],
 ['know',/^(تعرف|تعرفو|تعرفوا|عارفين|عارف|هل تعلم|عارفين ان)$/,1],
 ['limit',/^(لفتره محدوده|لفترة محدودة|لحد اخر|اخر يوم|النهارده بس|الحق|متفوتش|متفوتوش|محدوده|محدودة)$/,1]];
const STEPW=/^(اولا|ثانيا|ثالثا|رابعا|الخطوه|خطوه|اول حاجه|تاني حاجه|تالت حاجه|اخر حاجه)$/;
function buildFx2(){FX2=[];STEPS=[];if(S.fx===false||!CAP.length)return;
 const busy=(a,b)=>FXL.some(f=>a<f.e+.2&&b>f.s-.2)||EV.some(x=>showEv(x)&&x.s<b&&x.e>a)||FX2.some(f=>a<f.e+.3&&b>f.s-.3);
 const used={};let stepN=0;
 /* هوك أول ثانيتين: عنوان الفيديو كبير لو مفيش مقدمة */
 if(!S.intro&&D&&D.title&&CAP[0])FX2.push({k:'hook',s:.05,e:Math.min(2.6,Math.max(1.6,CAP[0].e)),txt:D.title});
 CAP.forEach((c,ci)=>{const d=Math.max(.2,c.e-c.s),ws=c.w.map(norm);
  ws.forEach((w,i)=>{const two=i<ws.length-1?w+' '+ws[i+1]:'',ts=c.s+d*i/ws.length;
   if(STEPW.test(w)||STEPW.test(two)){stepN++;STEPS.push({s:ts,n:stepN});return}
   for(const [k,re,once] of FX2R){if(!(re.test(w)||(two&&re.test(two))))continue;if(k==='q'&&i>1)continue;if(once&&used[k]&&ts-used[k]<12)continue;
    let dur=k==='q'?Math.min(2.4,Math.max(1.4,c.e-ts+.3)):k==='party'?1.6:k==='vs'?2.6:2.1;if(ts<.7)continue;
    /* لو فيه مشهد جاي قريب، نقصّر اللحظة عشان تخلص قبله بدل ما نلغيها */const nx=Math.min(...[...FXL.map(f=>f.s),...EV.filter(showEv).map(x=>x.s),...FX2.map(f=>f.s)].filter(x=>x>ts),1e9);dur=Math.min(dur,nx-ts-.25);if(dur<1.1||busy(ts,ts+dur))continue;
    const txt=k==='q'?c.w.join(' ').replace(/[.,،!:«»"]/g,'').replace(/[؟?]?$/,'؟'):'';FX2.push({k,s:ts,e:ts+dur,txt,next:(c.w.slice(i+1,i+4).join(' ')||'').replace(/[.,،؟!?:«»"]/g,'')});used[k]=ts;break}})});
 FX2.sort((a,b)=>a.s-b.s);STEPS.forEach((x,i)=>{x.e=STEPS[i+1]?Math.min(STEPS[i+1].s,x.s+8):x.s+6})}
function drawFx2(t,W,H,u,F,acc){if(S.fx===false)return;CX.save();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 /* عدّاد الخطوات: شارة ثابتة فوق لحد الخطوة اللي بعدها */
 const st=STEPS.find(x=>t>=x.s&&t<x.e);if(st){const dt=t-st.s,a=Math.min(ease(dt/.3),1-ease((t-st.e+.3)/.3)),lab='خطوة '+ar(String(st.n)),bw=230*u,bh=74*u,p=fxSide(t,bw);
  if(p&&a>0){const y=Math.max(H*.06+(MU.logo?130*u:0),p.y-140*u);CX.save();CX.globalAlpha=a;CX.translate(p.x+bw/2,y);CX.scale(.85+.15*back(dt/.4),.85+.15*back(dt/.4));dk(-bw/2,-bh/2,bw,bh,bh/2,.86);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();
   CX.beginPath();CX.arc(bw/2-bh/2,0,bh*.36,0,7);CX.fillStyle=acc;CX.fill();CX.fillStyle='#000';CX.font=`900 ${Math.round(34*u)}px ${F}`;CX.fillText(ar(String(st.n)),bw/2-bh/2,2*u);CX.fillStyle='#fff';CX.font=`800 ${Math.round(34*u)}px ${F}`;CX.fillText(lab,-bh/2+10*u,2*u);CX.restore()}}
 const f=FX2.find(x=>t>=x.s&&t<x.e);if(!f){CX.restore();return}
 const dt=t-f.s,a=Math.min(ease(dt/.25),1-ease((t-f.e+.3)/.3)),pop=Math.max(.01,back(dt/.38));if(a<=0){CX.restore();return}
 const hr=headRect(t),capTop=O('cap')==='none'?H*.9:capBottom()-2*Math.round(CF().sz*u*S.size)*1.34-30*u,midTop=hr?hr[1]+40*u:H*.34,midY=Math.min(capTop-120*u,Math.max(midTop+120*u,(midTop+capTop)/2)),roomMid=capTop-midTop>240*u;
 const pos=bw=>fxSide(t,bw)||(roomMid?{x:(W-bw)/2,y:midY}:null),emo=(e,x,y,sz)=>{CX.font=`${Math.round(sz)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(e,x,y)};
 CX.globalAlpha=a;
 if(f.k==='hook'){const y=!hr?H*.12:hr[0]-H*.04>110*u?Math.max(H*.06,hr[0]-80*u):Math.min(capTop-90*u,hr[1]+80*u);let sz=Math.round(78*u);CX.font=`900 ${sz}px ${F}`;let tw=CX.measureText(f.txt).width;if(tw>W*.88){sz=Math.round(sz*W*.88/tw);CX.font=`900 ${sz}px ${F}`;tw=CX.measureText(f.txt).width}
  CX.translate(W/2,y);CX.scale(pop,pop);CX.fillStyle=acc;const bw=tw+60*u;CX.fillRect(-bw/2,-sz*.7,bw*ease(dt/.35),sz*1.4);CX.lineJoin='round';CX.lineWidth=10*u;CX.strokeStyle='#000';CX.strokeText(f.txt,0,4*u);CX.fillStyle='#fff';CX.fillText(f.txt,0,4*u)}
 else if(f.k==='q'){/* فقاعة سؤال بتطلع جنب الراس */let sz=Math.round(40*u);CX.font=`800 ${sz}px ${F}`;let tx=f.txt;while(CX.measureText(tx).width>W*.56&&tx.length>8)tx=tx.split(' ').slice(0,-1).join(' ')+'…';const tw=CX.measureText(tx).width,bw=tw+130*u,bh=100*u,p=pos(bw);if(!p){CX.restore();return}
  CX.translate(p.x+bw/2,p.y);CX.scale(pop,pop);dk(-bw/2,-bh/2,bw,bh,28*u,.9);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();CX.beginPath();const k=p.x+bw/2<W/2?1:-1;CX.moveTo(k*bw*.25,bh/2-2*u);CX.lineTo(k*bw*.25+k*36*u,bh/2+34*u);CX.lineTo(k*bw*.25+k*50*u,bh/2-2*u);CX.fillStyle='rgba(32,35,43,.9)';CX.fill();
  emo('❓',bw/2-46*u,0,54*u);CX.fillStyle='#fff';CX.font=`800 ${sz}px ${F}`;CX.fillText(tx,-30*u,3*u)}
 else if(f.k==='vs'){if(!roomMid){CX.restore();return}const bw=Math.min(W*.86,820*u),bh=230*u;CX.translate(W/2,midY);CX.scale(pop,pop);dk(-bw/2,-bh/2,bw,bh,30*u,.9);
  const sl=ease(dt/.5);CX.fillStyle='rgba(40,170,90,.28)';CX.fillRect(-bw/2+12*u,-bh/2+12*u,(bw/2-18*u)*sl,bh-24*u);CX.fillStyle='rgba(220,60,60,.25)';CX.fillRect(bw/2-12*u-(bw/2-18*u)*sl,-bh/2+12*u,(bw/2-18*u)*sl,bh-24*u);
  emo('❌',bw/4,-30*u,70*u);emo('✅',-bw/4,-30*u,70*u);CX.fillStyle='#fff';CX.font=`800 ${Math.round(36*u)}px ${F}`;CX.fillText(f.next&&norm(f.next).length>2?f.next:'العادي',bw/4,60*u);CX.fillText(brand().shop||'بتاعنا',-bw/4,60*u);
  CX.fillStyle=acc;CX.font=`900 ${Math.round(46*u)}px ${F}`;CX.beginPath();CX.arc(0,0,44*u,0,7);CX.fill();CX.fillStyle='#000';CX.fillText('VS',0,3*u)}
 else if(f.k==='stars'){const bw=430*u,bh=110*u,p=pos(bw);if(!p){CX.restore();return}CX.translate(p.x+bw/2,p.y);CX.scale(pop,pop);dk(-bw/2,-bh/2,bw,bh,bh/2,.86);
  for(let i=0;i<5;i++){const q=cl((dt-.12*i)/.25);if(q<=0)continue;CX.save();CX.translate(bw/2-60*u-i*78*u,0);CX.scale(back(q),back(q));emo('⭐',0,4*u,62*u);CX.restore()}}
 else if(f.k==='pin'){const addr=brand().addr||'زورونا في المعرض';CX.font=`800 ${Math.round(38*u)}px ${F}`;const tw=Math.min(W*.6,CX.measureText(addr).width),bw=tw+150*u,bh=104*u,p=pos(bw);if(!p){CX.restore();return}
  CX.translate(p.x+bw/2,p.y);CX.scale(pop,pop);dk(-bw/2,-bh/2,bw,bh,bh/2,.88);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();const by=-Math.abs(Math.sin(dt*7))*14*u*Math.max(0,1-dt/1.2);emo('📍',bw/2-58*u,by,58*u);CX.fillStyle='#fff';CX.font=`800 ${Math.round(38*u)}px ${F}`;CX.fillText(addr,-40*u,3*u,W*.6)}
 else if(f.k==='follow'){const bw=420*u,bh=110*u,p=pos(bw);if(!p){CX.restore();return}CX.translate(p.x+bw/2,p.y);CX.scale(pop,pop);const tap=dt>.6&&dt<.85;CX.save();if(tap)CX.scale(.94,.94);rr(-bw/2,-bh/2,bw,bh,bh/2);CX.fillStyle=dt>.75?'#2a2a2e':'#e53935';CX.fill();CX.restore();
  CX.fillStyle='#fff';CX.font=`900 ${Math.round(40*u)}px ${F}`;CX.fillText(dt>.75?'✓ متابَع':'تابعنا',-30*u,3*u);emo('👍',bw/2-56*u,0,56*u);const hx=-bw/2+90*u+(1-ease(dt/.6))*120*u,hy=bh/2+10*u+(1-ease(dt/.6))*60*u;emo('👆',hx,hy,64*u)}
 else if(f.k==='arrow'){if(!roomMid){CX.restore();return}const y=midY+Math.sin(dt*10)*16*u;CX.translate(W/2,y);CX.scale(pop,pop);CX.fillStyle=acc;CX.strokeStyle='#000';CX.lineWidth=8*u;CX.lineJoin='round';
  CX.beginPath();CX.moveTo(-30*u,-90*u);CX.lineTo(30*u,-90*u);CX.lineTo(30*u,0);CX.lineTo(70*u,0);CX.lineTo(0,80*u);CX.lineTo(-70*u,0);CX.lineTo(-30*u,0);CX.closePath();CX.stroke();CX.fill();CX.fillStyle='#fff';CX.font=`900 ${Math.round(44*u)}px ${F}`;CX.lineWidth=10*u;CX.strokeText('بص هنا',0,-130*u);CX.fillText('بص هنا',0,-130*u)}
 else if(f.k==='know'){const tx=(f.next||'').replace(/^(ان|إن|أن)s+/,'').split(' ').slice(0,4).join(' ');let sz=Math.round(36*u);CX.font=`800 ${sz}px ${F}`;const tw=Math.max(CX.measureText(tx||'تعرف؟').width,CX.measureText('💡 تعرف إن؟').width),bw=Math.min(W*.8,tw+110*u),bh=150*u,p=pos(bw);if(!p){CX.restore();return}
  CX.translate(p.x+bw/2,p.y);CX.scale(pop,pop);dk(-bw/2,-bh/2,bw,bh,28*u,.9);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();CX.fillStyle=acc;CX.font=`900 ${Math.round(40*u)}px ${F}`;CX.fillText('💡 تعرف إن؟',0,-30*u);if(tx){CX.fillStyle='#fff';CX.font=`800 ${sz}px ${F}`;CX.fillText(tx+'…',0,34*u,bw-40*u)}}
 else if(f.k==='limit'){const bw=520*u,bh=96*u,p=pos(bw);if(!p){CX.restore();return}const pl=1+Math.sin(dt*8)*.04;CX.translate(p.x+bw/2,p.y);CX.scale(pop*pl,pop*pl);rr(-bw/2,-bh/2,bw,bh,bh/2);CX.shadowColor='rgba(0,0,0,.45)';CX.shadowBlur=18*u;CX.fillStyle='#d32f2f';CX.fill();CX.shadowBlur=0;CX.lineWidth=4*u;CX.strokeStyle='#fff';CX.stroke();
  CX.fillStyle='#fff';CX.font=`900 ${Math.round(40*u)}px ${F}`;CX.fillText('العرض لفترة محدودة',-26*u,3*u);CX.font=`${Math.round(52*u)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText('⏳',bw/2-58*u,0)}
 else if(f.k==='party'){/* قصاصات ملونة بتنزل فوق، بعيد عن الوش */const cols=['#FFD54F','#4FC3F7','#EF5350','#66BB6A','#AB47BC',acc];for(let i=0;i<46;i++){const r1=Math.sin(i*12.9898)*43758.5453%1,r2=Math.sin(i*78.233)*12345.678%1,x=W*Math.abs(r1),y0=-40*u-Math.abs(r2)*H*.2,y=y0+dt*H*.55*(.7+Math.abs(r2)*.6);
  if(hr&&x>W*.26&&x<W*.74&&y>hr[0]-20*u&&y<hr[1])continue;CX.save();CX.translate(x+Math.sin(dt*6+i)*18*u,y);CX.rotate(dt*5+i);CX.fillStyle=cols[i%cols.length];CX.fillRect(-9*u,-5*u,18*u,10*u);CX.restore()}
  if(roomMid){CX.translate(W/2,midY);CX.scale(pop,pop);emo('🎉',0,0,140*u)}}
 CX.restore();CX.globalAlpha=1}
/* 🔊 مؤثرات صوتية في التصدير والمعاينة (بوب/ووش/دينج) من غير ملفات — بتتولد بالـ WebAudio */
let SFX_last=-1;const SFXL=()=>{const L=[];if(!O('sfx'))return L;EV.forEach(e=>{if(showEv(e))L.push({t:e.s,k:e.type==='topic'||e.type==='anim'?'whoosh':'pop'})});STK.forEach(x=>L.push({t:x.s,k:'pop'}));if(CTA)L.push({t:CTA.s,k:'whoosh'});
 FXL.forEach(f=>L.push({t:f.s,k:f.kind==='num'?(/جنيه|^ج$|الف|ألف/.test(f.unit||'')?'cash':'ding'):f.kind==='kw'?'whoosh':'pop'}));EV.forEach(e=>{if(showEv(e)&&e.type==='price')L.push({t:e.s,k:'cash'})});FX2.forEach(f=>L.push({t:f.s,k:f.k==='party'||f.k==='stars'?'ding':f.k==='hook'?'whoosh':'pop'}));STEPS.forEach(x=>L.push({t:x.s,k:'pop'}));CNT.forEach(c=>{L.push({t:c.s,k:'whoosh'});if(c.m)L.push({t:c.xt+.5,k:'ding'});if(c.rg)L.push({t:c.xt+1.7,k:'ding'})});return L};
function sfxPlay(k){const rec=REC&&V&&V._ac&&V._dst,ctx=rec?V._ac:MU.pc;if(!ctx||ctx.state==='closed')return;const n=ctx.currentTime,g=ctx.createGain();g.connect(ctx.destination);if(rec)g.connect(V._dst);
 if(k==='whoosh'){const len=Math.round(ctx.sampleRate*.45),b=ctx.createBuffer(1,len,ctx.sampleRate),d=b.getChannelData(0);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.sin(Math.PI*i/len);const s=ctx.createBufferSource();s.buffer=b;const bp=ctx.createBiquadFilter();bp.type='bandpass';bp.Q.value=1.2;bp.frequency.setValueAtTime(400,n);bp.frequency.exponentialRampToValueAtTime(3200,n+.4);s.connect(bp);bp.connect(g);g.gain.value=.22;s.start(n)}
 else if(k==='cash'){[0,.11].forEach((d,i)=>{const o=ctx.createOscillator(),gg=ctx.createGain();o.type='triangle';o.frequency.value=i?2093:1568;gg.gain.setValueAtTime(.0001,n+d);gg.gain.exponentialRampToValueAtTime(.2,n+d+.01);gg.gain.exponentialRampToValueAtTime(.0001,n+d+.35);o.connect(gg);gg.connect(ctx.destination);if(rec)gg.connect(V._dst);o.start(n+d);o.stop(n+d+.4)})}
 else{const o=ctx.createOscillator(),sf=STY.on?STY.snd:{w:null,f:1},fm=sf.f||1;o.type=sf.w||(k==='ding'?'triangle':'sine');o.frequency.setValueAtTime((k==='ding'?1320:520)*fm,n);o.frequency.exponentialRampToValueAtTime((k==='ding'?1760:260)*fm,n+(k==='ding'?.25:.09));g.gain.setValueAtTime(.0001,n);g.gain.exponentialRampToValueAtTime(k==='ding'?.18:.28,n+.01);g.gain.exponentialRampToValueAtTime(.0001,n+(k==='ding'?.5:.14));o.connect(g);o.start(n);o.stop(n+.55)}}
function sfxTick(t){if(!V||V.paused||V.seeking){SFX_last=t;return}if(SFX_last<0||t<SFX_last||t-SFX_last>.6){SFX_last=t;return}
 if(!(REC&&V._ac)&&!MU.pc){try{MU.pc=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}SFXL().forEach(x=>{if(x.t>SFX_last&&x.t<=t)sfxPlay(x.k)});SFX_last=t}
const _build2=build;build=function(){const r=_build2.apply(this,arguments);try{buildFx2()}catch(e){console.warn('fx2',e)}return r};
/* ---------- 🧮 مشهد «العدد والتوسعة»: بيفهم من كلامك «عدد + حاجة» وبيرسمها، ولو قلت «وزوّد كمان N» بيوسّع المشهد ويضيف ---------- */
var CNT=[];
function cntHides(e){return !!CNT&&CNT.some(c=>e.s<c.e&&e.e>c.s)}
const CNW={1:/^(واحد|واحده|وحده)$/,2:/^(اتنين|اثنين|اتنان|اتنتين|اثنان|زوج)$/,3:/^(تلاته|ثلاثه|تلات|ثلاث|تلاتة)$/,4:/^(اربعه|اربع|اربعة)$/,5:/^(خمسه|خمس|خمسة)$/,6:/^(سته|ست|ستة)$/,7:/^(سبعه|سبع|سبعة)$/,8:/^(تمانيه|ثمانيه|تمان|ثمان|تمنيه|تمانية)$/,9:/^(تسعه|تسع|تسعة)$/,10:/^(عشره|عشر|عشرة)$/};
/* الحاجات اللي بتتعد: [regex, إيموجي (أو null يترسم صندوق), مفرد للعرض] */
const CNN=[[/^(كرسي|كراسي|كرسى)$/,'chair','كرسي'],[/^(سرير|سراير|اسره)$/,'🛏️','سرير'],[/^(باب|ابواب)$/,'🚪','باب'],[/^(ضيف|ضيوف|شخص|اشخاص|فرد|افراد|نفر|انفار)$/,'🧑','شخص'],[/^(مفتاح|مفاتيح)$/,'🔑','مفتاح'],[/^(لمبه|لمبات|مصباح)$/,'💡','لمبة'],[/^(درج|ادراج|أدراج|درج)$/,'🗄️','درج'],[/^(رف|رفوف)$/,'📚','رف'],[/^(قطعه|قطع|حته|حتت)$/,'box','قطعة'],[/^(وحده|وحدات|مكان|اماكن|مقعد|مقاعد)$/,'box','مكان'],[/^(طقم|اطقم|طقوم)$/,'box','طقم']];
const CNC=/^(زود|زوّد|تزود|اتزود|يزود|ازود|نزود|زياده|زيادة|كمان|اضافي|اضافيه|تضيف|ضيف|اخليها|اخلي|احولها|احول|تحولها|يحولها|تتحول|يتحول|تبقي|تبقى|يبقي|يبقى|توسع|توسّع|تتوسع|تكبر|يكبر|بتكبر|يوصل|توصل|توصلها|وسع|اوسع|ازوّد)$/;
const CNZ=/^(زود|زوّد|تزود|اتزود|يزود|ازود|نزود|زياده|زيادة|اضافي|اضافيه|تضيف|ضيف|كمان)$/;
const CNX=/^(زود|زوّد|تزود|زيادة|زياده|كمان|اضافي|اضافيه|تضيف|ضيف|زياده|اتزود|بيزيد|تزيد|توسع|توسّع|يتوسع|لو جالك|لو جه|ضيوف|زايد|زاد)$/;
const CNT_TABLE=/^(سفره|صفره|صفر|ترابيزه|طاوله|مائده|السفره|الصفره)$/;
const cnStrip=w=>{let n=norm(w).replace(/[^؀-ۿa-z0-9]/gi,'');if(n.length>3&&/^[وفب]/.test(n)&&!CNN.some(r=>r[0].test(n)))n=n.slice(1);return n};
const CNTEN={عشرين:20,تلاتين:30,ثلاثين:30,اربعين:40,خمسين:50,ستين:60,سبعين:70,تمانين:80,ثمانين:80,تسعين:90,ميه:100,مية:100,ميتين:200,تلتمية:300,تلتميه:300,اربعمية:400,اربعميه:400,خمسمية:500,خمسميه:500};
function cnNum(W,i){const x=W[i];if(!x)return null;const dg=en(x.raw).replace(/[^0-9.]/g,'');if(dg&&/^\d+(\.\d+)?$/.test(dg)&&en(x.raw).replace(/[^0-9.,]/g,'')===dg)return {v:parseFloat(dg),len:1};
 const n=x.n.replace(/^و/,'');for(const k in CNW)if(CNW[k].test(n))return {v:+k,len:1};if(CNTEN[n]){let v=CNTEN[n],len=1;const y=W[i+1];if(y&&/^و/.test(y.n)){const t=y.n.slice(1);if(CNTEN[t]&&CNTEN[t]<v){v+=CNTEN[t];len=2}else for(const k in CNW)if(CNW[k].test(t)){v+=+k;len=2;break}}return {v,len}}return null}
const CNU=/^(سم|ملي|مم|متر|م|كيلو|كجم|جرام|جنيه|ج|درجه|لتر|شخص|اشخاص|فرد|افراد|كرسي|كراسي)$/;
function buildRange(W){const R=[];W.forEach((x,i)=>{if(x.n!=='من')return;const a=cnNum(W,i+1);if(!a)return;let j=i+1+a.len;const to=W[j];if(!to||!/^(ل|لحد|لغايه|لغاية|الي|الى|إلى|ل\u0640)$/.test(to.n)&&!/^ل/.test(to.n))return;
  let bj=j+1;if(/^ل\S+/.test(to.n)&&!/^(لحد|لغايه|لغاية)$/.test(to.n)&&to.n.length>1){const gl=cnNum([{raw:to.raw.replace(/^ل/,''),n:to.n.slice(1)}],0);if(gl){R.push({i,a:a.v,b:gl.v,ts:x.s,te:to.e,ui:j+1});return}}
  const b=cnNum(W,bj);if(!b||b.v<=a.v)return;const u=W[bj+b.len],un=u&&CNU.test(u.n)?u.raw.replace(/[.,،؟!?:«»"]/g,''):'';R.push({i,a:a.v,b:b.v,ts:x.s,te:(W[bj+b.len-1]||to).e,unit:un})});return R}
function buildCount(){CNT=[];if(S.fx===false||!CAP.length)return;
 const W=[];CAP.forEach(c=>{const n=c.w.length,d=Math.max(.2,c.e-c.s);c.w.forEach((w,i)=>W.push({raw:w,n:cnStrip(w),s:c.s+d*i/n,e:c.s+d*(i+1)/n}))});
 const num1=x=>{const dig=en(x.raw).replace(/[^0-9]/g,'');if(dig&&/^\d{1,2}$/.test(dig)&&en(x.raw).replace(/[^0-9.,]/g,'')===dig)return +dig;for(const cand of [x.n,x.n.replace(/^ل/,'')])for(const k in CNW)if(CNW[k].test(cand))return +k;return null};
 const M=[];
 /* عدد قبل الحاجة: «أربع كراسي» */
 W.forEach((x,i)=>{const v=num1(x);if(v==null||v<1||v>12)return;for(let j=1;j<=2;j++){const y=W[i+j];if(!y)break;const nn=CNN.find(r=>r[0].test(y.n));if(nn){M.push({i,v,ts:x.s,te:y.e,kind:nn[1],name:nn[2],raw:y.raw.replace(/[.,،؟!?:«»"]/g,''),ni:i+j,add:false});break}}});
 /* الحاجة وبعدها «أو» وعدد: «كرسي أو اتنين» = إضافة */
 W.forEach((x,i)=>{const nn=CNN.find(r=>r[0].test(x.n));if(!nn)return;const y=W[i+1],z=W[i+2],v=z?num1(z):null;if(y&&/^(او|أو)$/.test(y.n)&&v!=null&&v>=1&&v<=12&&!M.some(m=>m.i===i+2))M.push({i:i+2,v,ts:z.s,te:z.e,kind:nn[1],name:nn[2],raw:x.raw.replace(/[.,،؟!?:«»"]/g,''),ni:i,add:true})});
 M.sort((p,q)=>p.i-q.i);
 const cand=[];let k=0;
 while(k<M.length){const A=M[k];if(A.add){k++;continue}let B=null,total=0;
  for(let q=k+1;q<M.length;q++){const m=M[q];if(m.ts-A.te>16)break;if(m.kind!==A.kind)continue;const win=W.slice(Math.max(A.ni+1,m.i-9),m.i+1),cue=win.some(w=>CNC.test(w.n)),zed=win.some(w=>CNZ.test(w.n));
   if(m.add&&(cue||zed)){B=m;total=A.v+m.v;break}
   if(!m.add&&m.v>A.v&&cue){B=m;total=m.v;break}
   if(!m.add&&m.v<=A.v&&zed){B=m;total=A.v+m.v;break}}
  const near=W.slice(Math.max(0,A.i-9),A.ni+8),tbl=A.kind==='chair'&&near.some(w=>CNT_TABLE.test(w.n.replace(/^ال/,'')));
  const s0=Math.max(.3,A.ts-.1),end=B?Math.min(B.te+2.2,s0+9):s0+3.2;
  cand.push({s:s0,e:end,n:A.v,m:B?total-A.v:0,xt:B?B.ts:0,kind:A.kind,name:A.name,raw:A.raw,table:tbl,exp:!!B});
  k=B?M.indexOf(B)+1:k+1}
 /* التوسعة هي الأهم: كل توسعة تتحط، والعدّ العادي مرة كل ٢٥ ثانية وبحد أقصى ٣ مرات (عشان مايتكررش) */
 let plain=0;cand.sort((p,q)=>p.s-q.s).forEach(c=>{const ov=CNT.find(x=>c.s<x.e+.5&&c.e>x.s-.5);if(ov)return;const prev=CNT.length?CNT[CNT.length-1]:null;
  if(!c.exp){if(plain>=3||(prev&&c.s-prev.e<25))return;plain++}else if(prev&&c.s-prev.s<20)return;CNT.push(c)});
 {const W2=[];CAP.forEach(c=>{const n=c.w.length,d=Math.max(.2,c.e-c.s);c.w.forEach((w,i)=>W2.push({raw:w,n:cnStrip(w),s:c.s+d*i/n,e:c.s+d*(i+1)/n}))});
  buildRange(W2).forEach(r=>{const s0=Math.max(.3,r.ts-.1),end=Math.min(r.te+2.4,s0+6.5);const ov=CNT.find(c=>s0<c.e+.4&&end>c.s-.4);if(ov&&ov.s<s0&&s0-ov.s>2.5&&(!ov.m||s0>ov.xt+1.3))ov.e=Math.min(ov.e,s0-.1);if(!ov||ov.e<=s0)CNT.push({s:s0,e:end,rg:1,a:r.a,b:r.b,unit:r.unit||'',xt:s0+.9,n:0,m:0,kind:'range',name:'',raw:'',table:false})});CNT.sort((x,y)=>x.s-y.s)}
 /* فيديو الإدراج أهم: المشهد يخلص قبله، أو يتشال لو هيتغطى من أوله */
 {const OV=(typeof BRL!=='undefined'&&BRL||[]).concat(typeof IML!=='undefined'&&IML||[]);if(OV.length)CNT=CNT.map(c=>{const b=OV.find(x=>c.s<x.e&&c.e>x.s);if(!b)return c;if(b.s>c.s+2.8){c.e=Math.min(c.e,b.s-.15);return c}return null}).filter(Boolean)}
 /* المشهد بياخد مكان أي لمسة تانية في نفس الوقت */
 if(CNT.length){FXL=FXL.filter(f=>!CNT.some(c=>f.s<c.e+.2&&f.e>c.s-.2));FX2=FX2.filter(f=>f.k==='hook'||!CNT.some(c=>f.s<c.e+.2&&f.e>c.s-.2));STEPS=STEPS.filter(x=>!CNT.some(c=>x.s<c.e&&x.e>c.s))}}
function drawCount(t,W,H,u,F,acc){const c=CNT.find(x=>t>=x.s&&t<x.e);if(!c||S.fx===false)return;
 const dt=t-c.s,a=Math.min(ease(dt/.3),1-ease((t-c.e+.35)/.35));if(a<=0)return;
 const hr=headRect(t),capTop=O('cap')==='none'?H*.9:capBottom()-2*Math.round(CF().sz*u*S.size)*1.34-30*u,top=hr?hr[1]+28*u:H*.28,room=capTop-top-16*u;if(room<200*u)return;
 const bw=Math.min(W*.92,920*u),bh=(c.table?470:360)*u,sc=Math.min(1,room/bh),cy=top+8*u+room/2,pop=Math.max(.01,back(dt/.4));
 if(c.rg){const bw2=Math.min(W*.92,920*u),bh2=330*u,sc2=Math.min(1,room/bh2),cy2=top+8*u+room/2,pop2=Math.max(.01,back(dt/.4)),q=ease(cl((t-c.xt)/1.7)),val=c.a+(c.b-c.a)*q,vs=Number.isInteger(c.a)&&Number.isInteger(c.b)?String(Math.round(val)):(Math.round(val*10)/10).toFixed(1);
  CX.save();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';CX.globalAlpha=a;CX.translate(W/2,cy2);CX.scale(sc2*pop2,sc2*pop2);dk(-bw2/2,-bh2/2,bw2,bh2,34*u,.9);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();
  CX.fillStyle='rgba(255,255,255,.7)';CX.font=`800 ${Math.round(36*u)}px ${F}`;CX.fillText('من '+ar(String(c.a))+' لـ '+ar(String(c.b))+(c.unit?' '+c.unit:''),0,-bh2/2+46*u);
  CX.fillStyle=acc;CX.font=`900 ${Math.round(110*u)}px ${F}`;CX.fillText(ar(vs)+(c.unit?' '+c.unit:''),0,-bh2/2+130*u,bw2-80*u);
  const tw2=bw2-130*u,tx=-tw2/2,ty2=bh2/2-86*u,full=tw2,w0=full*c.a/c.b,wv=full*val/c.b;CX.lineCap='round';CX.lineWidth=18*u;CX.strokeStyle='rgba(255,255,255,.16)';CX.beginPath();CX.moveTo(tx,ty2);CX.lineTo(tx+full,ty2);CX.stroke();
  CX.strokeStyle=acc;CX.beginPath();CX.moveTo(tx,ty2);CX.lineTo(tx+Math.max(1,wv),ty2);CX.stroke();CX.lineWidth=3*u;CX.strokeStyle='rgba(255,255,255,.5)';for(let k=0;k<=10;k++){const x=tx+full*k/10;CX.beginPath();CX.moveTo(x,ty2+18*u);CX.lineTo(x,ty2+(k%5?28:38)*u);CX.stroke()}
  CX.fillStyle='#fff';rr(tx+w0-4*u,ty2-30*u,8*u,60*u,4*u);CX.fill();CX.font=`800 ${Math.round(28*u)}px ${F}`;CX.fillText(ar(String(c.a)),tx+w0,ty2-50*u);
  CX.beginPath();CX.arc(tx+Math.max(1,wv),ty2,17*u,0,7);CX.fillStyle='#fff';CX.fill();CX.restore();return}
 const xt=c.m?c.xt:1e9,px=c.m?ease(cl((t-xt-.15)/.7)):0,n=c.n,m=c.m,tot=n+m;
 const shown=c.m&&t>=xt+.5?Math.min(tot,n+Math.ceil(m*cl((t-xt-.5)/(.22*m+.2)))):n;
 CX.save();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';CX.globalAlpha=a;CX.translate(W/2,cy);CX.scale(sc*pop,sc*pop);
 dk(-bw/2,-bh/2,bw,bh,34*u,.9);CX.lineWidth=3*u;CX.strokeStyle=acc;CX.stroke();
 const lbl=ar(String(shown))+' '+(shown>1?c.raw||c.name:c.name),ly=-bh/2+52*u;CX.fillStyle='#fff';CX.font=`900 ${Math.round(68*u)}px ${F}`;CX.fillText(lbl,0,ly,bw-60*u);
 
 const chairIcon=(x,y,s,col,flip)=>{CX.save();CX.translate(x,y);CX.fillStyle=col;CX.strokeStyle='rgba(0,0,0,.6)';CX.lineWidth=3.5*u;rr(-s/2,-s/2,s,s,s*.26);CX.fill();CX.stroke();const by=flip?s/2-s*.2:-s/2;rr(-s/2,by,s,s*.2,s*.1);CX.fillStyle='rgba(60,60,70,.75)';CX.fill();CX.stroke();CX.restore()};
 if(c.table){const cs=100*u,gap=38*u,ps0=Math.ceil(n/2),ps1=Math.ceil(tot/2),ps=ps0+(ps1-ps0)*px,slotW=cs+gap,tw0=ps0*slotW+70*u,tw=ps*slotW+70*u,th=130*u,ty=52*u,leaf=Math.max(0,tw-tw0);
  CX.save();CX.fillStyle='rgba(0,0,0,.28)';CX.beginPath();CX.ellipse(0,ty+th/2+cs*1.28,tw/2+36*u,20*u,0,0,7);CX.fill();CX.restore();
  CX.save();rr(-tw/2,ty-th/2,tw,th,26*u);const g=CX.createLinearGradient(0,ty-th/2,0,ty+th/2);g.addColorStop(0,'#dca46a');g.addColorStop(1,'#a56a38');CX.fillStyle=g;CX.fill();CX.lineWidth=4*u;CX.strokeStyle='rgba(0,0,0,.5)';CX.stroke();
  CX.fillStyle='rgba(255,255,255,.13)';rr(-tw/2+14*u,ty-th/2+10*u,tw-28*u,16*u,8*u);CX.fill();
  if(leaf>4){CX.save();CX.beginPath();CX.rect(-leaf/2,ty-th/2,leaf,th);CX.clip();CX.fillStyle='rgba(255,236,205,.4)';CX.fillRect(-leaf/2,ty-th/2,leaf,th);CX.restore();CX.strokeStyle='rgba(60,30,10,.7)';CX.lineWidth=4*u;[-1,1].forEach(sg=>{CX.beginPath();CX.moveTo(sg*leaf/2,ty-th/2+4*u);CX.lineTo(sg*leaf/2,ty+th/2-4*u);CX.stroke()})}
  CX.restore();
  if(px>0&&px<1){CX.save();CX.fillStyle=acc;[-1,1].forEach(sg=>{const ax=sg*(tw/2+40*u+Math.sin(t*14)*7*u);CX.beginPath();CX.moveTo(ax+sg*30*u,ty);CX.lineTo(ax,ty-28*u);CX.lineTo(ax,ty+28*u);CX.closePath();CX.fill()});CX.restore()}
  for(let i=0;i<tot;i++){const top2=i%2===0,slot=Math.floor(i/2),isNew=i>=n,q=isNew?cl((t-xt-.55-.2*(i-n))/.3):cl((dt-.3-.14*i)/.3);if(q<=0)continue;
   const x=(slot-(ps-1)/2)*slotW,y=ty+(top2?-1:1)*(th/2+cs*.62+10*u),s2=cs*Math.max(.01,back(q));chairIcon(x,y,s2,'#ecebf0',!top2)}
  const st=m?(px>=1?'مفتوحة':'ملمومة'):'',cw=170*u,ch=54*u;if(st){CX.save();CX.translate(-bw/2+cw/2+30*u,ly);rr(-cw/2,-ch/2,cw,ch,ch/2);CX.fillStyle=px>=1?acc:'rgba(255,255,255,.16)';CX.fill();CX.fillStyle=px>=1?'#000':'#fff';CX.font=`800 ${Math.round(32*u)}px ${F}`;CX.fillText(st,0,2*u);CX.restore()}}
 else{const em=c.kind,sz=104*u,per=5,rows=Math.ceil(tot/per),oy=18*u-(rows-1)*sz*.55;
  for(let i=0;i<tot;i++){const r=Math.floor(i/per),inRow=Math.min(per,tot-r*per),col=i%per,isNew=i>=n,q=isNew?cl((t-xt-.55-.2*(i-n))/.3):cl((dt-.3-.14*i)/.3);if(q<=0)continue;
   const x=(col-(inRow-1)/2)*(sz+22*u),y=oy+r*(sz+22*u),s=Math.max(.01,back(q));CX.save();CX.translate(x,y);CX.scale(s,s);
   
   if(em==='box'||em==='chair'){rr(-sz*.4,-sz*.4,sz*.8,sz*.8,sz*.18);CX.fillStyle='#ecebf0';CX.fill();CX.lineWidth=3*u;CX.strokeStyle='rgba(0,0,0,.5)';CX.stroke();CX.fillStyle='#000';CX.font=`900 ${Math.round(sz*.42)}px ${F}`;CX.fillText(ar(String(i+1)),0,2*u)}
   else{CX.font=`${Math.round(sz*.82)}px "Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif`;CX.fillText(em,0,3*u)}
   CX.restore()}}
 CX.restore();CX.globalAlpha=1}
function appliedList(){const L=[],t0=x=>fmt(x);
 CNT.forEach(c=>L.push(c.rg?`📏 مسطرة «من ${ar(String(c.a))} لـ ${ar(String(c.b))}${c.unit?' '+c.unit:''}» — عند ${t0(c.s)}`:`🧮 مشهد عدد «${ar(String(c.n))} ${c.raw||c.name}${c.m?' ← +'+ar(String(c.m)):''}»${c.table?' (سفرة)':''} — عند ${t0(c.s)}`));
 const nm={hook:'🔥 عنوان البداية',q:'❓ فقاعة سؤال',vs:'⚖️ مقارنة',stars:'⭐ تقييم',pin:'📍 العنوان',follow:'👍 متابعة',arrow:'👇 سهم',party:'🎉 احتفال',know:'💡 تعرف إن',limit:'⏳ عرض محدود'};
 FX2.forEach(f=>L.push((nm[f.k]||f.k)+' — عند '+t0(f.s)));STEPS.forEach(x=>L.push('🔢 خطوة '+ar(String(x.n))+' — عند '+t0(x.s)));
 const nb=FXL.filter(f=>f.kind==='badge').length,nn=FXL.filter(f=>f.kind==='num').length,nk=FXL.filter(f=>f.kind==='kw').length;if(nb+nn+nk)L.push(`✨ ${nb} شارة، ${nn} رقم بيعدّ، ${nk} كلمة كبيرة`);
 const ne=EV.filter(showEv).length;if(ne)L.push('🎨 '+ne+' رسمة من السيرفر');
 if(!BRC.length)L.push('⚠️ مفيش فيديو إدراج مرفوع (ارفعه من «🎞️ فيديوهات الإدراج» قبل ما تضغط الزرار)');
 else if(!BRL.length)L.push('⚠️ فيديو الإدراج مرفوع بس ما لقيتش مكان مناسب ليه — دوس «➕ ضيف الإدراج هنا» في قايمة الإدراج');
 else BRL.forEach(b=>L.push('🎞️ فيديو إدراج عند '+t0(b.s)+' لحد '+t0(b.e)));
 if(IMC.length){if(!IML.length)L.push('⚠️ صور الإدراج مرفوعة ('+IMC.length+') بس ما اتحطش منها حاجة'+(IMAI.err?' — الذكاء: '+IMAI.err:''));else IML.forEach(b=>L.push('🖼️ صورة «'+(b.c.desc||b.c.name)+'» عند '+t0(b.s)+' لحد '+t0(b.e)+(b.fb?' (توزيع تلقائي)':'')))}
 if(PIL.length)L.push('🔔 '+PIL.length+' نبضة كسر ملل (أماكن الشاشة فيها واقفة)');
 if(MU.buf)L.push('🎵 موسيقى: '+MU.name);if(MU.logo)L.push('🏷️ لوجو المحل');return L}
function renderApplied(){const el=$s('sm_ap');if(!el)return;const L=appliedList(),sc=L.filter(x=>!x.startsWith('⚠️')).length;
 el.innerHTML=(L.length?L.map(x=>'<div>'+BR_ESC(x)+'</div>').join(''):'')+(sc<=1?'<div style="margin-top:6px;color:#e0a030">⚠️ مفيش لحظات ذكية كتير اتلقت في الكلام ده. الكلام اللي اتفرّغ موجود في «✍️ الكلام» تحت — ولو شايف إن فيه مشهد المفروض يطلع، دوس «📋 انسخ تقرير» وابعته لـ Claude.</div>':'')}
function copyReport(){const g=(()=>{try{return JSON.parse(localStorage.getItem('mkz-pro-err')||'[]').slice(0,5)}catch(e){return []}})(),st=JSON.parse(JSON.stringify(S,(k,v)=>typeof v==='function'?undefined:v));
 const R=['تقرير مونتاج — نسخة ٤ نوفمبر ٢٠٢٦ ل','الرابط: '+location.href,'الجهاز: '+navigator.userAgent,'الفيديو: '+(F?F.name+' — '+Math.round(F.size/1048576)+'MB':'-')+(V?' — '+V.videoWidth+'x'+V.videoHeight+' — '+Math.round(V.duration||0)+'ث':''),
  'إدراج: '+(BRC.length?BRC.map(c=>c.name+' '+(c.dur?Math.round(c.dur)+'ث':'⚠️')).join(' | '):'مفيش'),'موسيقى: '+(MU.buf?MU.name:'مفيش')+' | لوجو: '+(MU.logo?'أيوه':'لا'),'القالب: '+S.tpl+' | الوضع: '+(S.sm||'auto')+' | البصمة: '+(STY.on?STY.n+' ('+STY.font+', '+STY.color+')':'عادي')+' | لوجو: '+LGC.size+'/'+LGC.pos+' | لمسات: '+(S.fx!==false?'شغالة':'مقفولة'),'','اللي اتطبّق:'].concat(appliedList(),['','الكلام المفرّغ:'],CAP.map(c=>fmt(c.s)+' '+c.w.join(' ')),['','أخطاء: '+(g.length?JSON.stringify(g):'مفيش')]).join('\n');
 (navigator.clipboard?navigator.clipboard.writeText(R):Promise.reject()).then(()=>say('✅ التقرير اتنسخ — الصقه في الشات مع Claude')).catch(()=>prompt('انسخ التقرير ده:',R))}
const _rl2=renderLists;renderLists=function(){const r=_rl2.apply(this,arguments);try{renderApplied()}catch(e){console.warn('applied',e)}return r};
const _build3=build;build=function(){const r=_build3.apply(this,arguments);try{buildCount()}catch(e){console.warn('count',e)}return r};
/* ---------- 📚 فيديوهاتي: الفيديوهات المتصدّرة بتتحفظ على جهازك وتفضل بعد ما تقفل الصفحة ---------- */
const LIBMAX=15,LIBBYTES=1.2e9;
function libDb(){return new Promise((ok,no)=>{const r=indexedDB.open('mkz-studio-lib',1);r.onupgradeneeded=()=>r.result.createObjectStore('v',{keyPath:'id'});r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
const libTx=async(mode,fn)=>{const db=await libDb();return await new Promise((ok,no)=>{const t=db.transaction('v',mode),st=t.objectStore('v'),rq=fn(st);t.oncomplete=()=>{db.close();ok(rq&&rq.result)};t.onerror=t.onabort=()=>{db.close();no(t.error||new Error('IDB'))}})};
async function libList(){const all=await libTx('readonly',st=>st.getAll());return (all||[]).sort((a,b)=>b.ts-a.ts)}
async function libPut(blob,name,title){const buf=await blob.arrayBuffer(),rec={id:String(Date.now()),ts:Date.now(),name,title:title||'',type:blob.type,size:blob.size,buf};await libTx('readwrite',st=>st.put(rec));
 const L=await libList();let tot=0;const drop=[];L.forEach((x,i)=>{tot+=x.size;if(i>=LIBMAX||(tot>LIBBYTES&&i>0))drop.push(x.id)});if(drop.length)await libTx('readwrite',st=>{drop.forEach(id=>st.delete(id))});return rec.id}
const libDel=id=>libTx('readwrite',st=>st.delete(id));
const libGet=id=>libTx('readonly',st=>st.get(id));
async function renderLib(){const el=$s('sm_lib');if(!el)return;let L=[];try{L=await libList()}catch(e){el.innerHTML='<span class="mu">⚠️ المتصفح ده مش بيخزّن الفيديوهات (وضع الخصوصية؟). شارك أو نزّل الفيديو أول ما يخلص.</span>';return}
 el.innerHTML=L.length?L.map(x=>`<div class="p" style="margin:0 0 8px;padding:10px" data-lid="${x.id}"><div style="display:flex;justify-content:space-between;gap:6px;flex-wrap:wrap"><b>${BR_ESC(x.title||x.name)}</b><span class="mu">${(x.size/1048576).toFixed(1)} ميجا</span></div><div class="mu" style="margin:2px 0 6px">${new Date(x.ts).toLocaleString('ar-EG',{day:'numeric',month:'numeric',hour:'numeric',minute:'2-digit'})}</div>
  <div class="lv"></div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="b" data-la="play" style="flex:1">▶️ شاهد</button><button type="button" class="b o" data-la="share" style="flex:1">📤 شارك</button><button type="button" class="b o" data-la="dl" style="flex:1">⬇️ نزّل</button><button type="button" class="b o" data-la="rm" style="flex:none;color:#ff8a80">🗑️</button></div></div>`).join(''):'<span class="mu">لسه مفيش. أي فيديو تصدّره من «💾 صدّر الفيديو» هيتحفظ هنا لوحده.</span>'}
async function libAct(e){const b=e.target.closest('[data-la]');if(!b)return;const box=b.closest('[data-lid]'),id=box.dataset.lid,a=b.dataset.la;
 if(a==='rm'){if(confirm('تمسح الفيديو ده من جهازك؟')){await libDel(id);renderLib()}return}
 const r=await libGet(id);if(!r)return say('الفيديو مش موجود');const blob=new Blob([r.buf],{type:r.type||'video/mp4'}),file=new File([blob],r.name,{type:blob.type});
 if(a==='play'){const lv=box.querySelector('.lv');if(lv.firstChild){lv.innerHTML='';return}const v=document.createElement('video');v.src=URL.createObjectURL(blob);v.controls=true;v.playsInline=true;v.style.cssText='width:100%;max-height:60vh;border-radius:12px;background:#000;margin-bottom:8px';lv.appendChild(v)}
 else if(a==='share'){try{if(navigator.canShare&&navigator.canShare({files:[file]}))await navigator.share({files:[file],title:r.title||'ميكانيزم'});else say('المشاركة مش متاحة — استخدم «نزّل»')}catch(x){}}
 else if(a==='dl'){const l=document.createElement('a');l.href=URL.createObjectURL(blob);l.download=r.name;document.body.appendChild(l);l.click();l.remove()}}
/* ---------- 🎲 بصمة الفيديو: كل فيديو بشكل مختلف (لون، خط، كروت، كلمة كبيرة، انتقال، كلام، صوت) ومن غير تكرار آخر فيديوهاتك ---------- */
const PERS=[
 {id:'gold',fr:'corners',n:'ذهبي فاخر',color:'#F6DC8A',font:'El Messiri',rad:1,bw:3,kw:'under',lift:.02,snd:{w:'sine',f:.85},o:{cap:'lower',motion:'ken',trans:'none',look:'warm',cut:2}},
 {id:'neon',fr:'border',n:'نيون سريع',color:'#00E5FF',font:'Changa',rad:.18,bw:4,kw:'neon',lift:0,snd:{w:'square',f:1.25},o:{cap:'karaoke',motion:'punch',trans:'rgb',look:'vivid',cut:3}},
 {id:'pink',fr:'wash',n:'مرح وملوّن',color:'#FF4D8D',font:'Marhey',rad:1.25,bw:3,kw:'sticker',lift:.05,snd:{w:'triangle',f:1.35},o:{cap:'pill',motion:'punch',trans:'slide',look:'vivid',cut:3}},
 {id:'green',fr:'none',n:'أخضر طبيعي',color:'#3DDC97',font:'Tajawal',rad:.8,bw:2,kw:'hl',lift:.03,snd:{w:'sine',f:1},o:{cap:'bold',motion:'soft',trans:'blink',look:'auto',cut:2}},
 {id:'fire',fr:'strip',n:'ناري للإعلان',color:'#FF7A2F',font:'Lalezar',rad:.3,bw:4,kw:'3d',lift:.01,snd:{w:'sawtooth',f:1.1},o:{cap:'pill',motion:'punch',trans:'flash',look:'vivid',cut:3}},
 {id:'blue',fr:'corners',n:'أزرق هادي',color:'#5AA9FF',font:'Almarai',rad:.9,bw:2,kw:'under',lift:.04,snd:{w:'sine',f:.95},o:{cap:'box',motion:'soft',trans:'zoom',look:'auto',cut:2}},
 {id:'violet',fr:'wash',n:'بنفسجي سينمائي',color:'#B388FF',font:'Reem Kufi',rad:.55,bw:3,kw:'neon',lift:.06,snd:{w:'triangle',f:.8},o:{cap:'lower',motion:'ken',trans:'blink',look:'vivid',cut:1}},
 {id:'red',fr:'border',n:'أحمر قوي',color:'#FF4545',font:'Cairo',rad:.12,bw:5,kw:'3d',lift:0,snd:{w:'square',f:1},o:{cap:'bold',motion:'punch',trans:'slide',look:'vivid',cut:3}},
 {id:'lime',fr:'strip',n:'ليموني حيوي',color:'#C6FF3D',font:'Changa',rad:.45,bw:3,kw:'hl',lift:.02,snd:{w:'sawtooth',f:1.5},o:{cap:'wbw',motion:'punch',trans:'rgb',look:'vivid',cut:2}},
 {id:'sand',fr:'none',n:'رملي أنيق',color:'#E9CBA0',font:'Amiri',rad:.7,bw:2,kw:'under',lift:.07,snd:{w:'sine',f:.75},o:{cap:'lower',motion:'none',trans:'none',look:'warm',cut:1}}];
const FRN={none:'من غير',corners:'أركان',border:'إطار ملوّن',wash:'تدرّج لون',strip:'شريط علوي'};
const KWN={under:'خط تحت',neon:'نيون مضيء',sticker:'ستيكر',hl:'ماركر','3d':'ثلاثي الأبعاد'},TRN={zoom:'زووم',flash:'فلاش',none:'من غير',slide:'سلايد',rgb:'تشويش ألوان',blink:'غمضة'},CPN={wbw:'كلمة بكلمة',bold:'عريض',box:'بوكس',pill:'خلفية ملونة',karaoke:'كاريوكي',lower:'هادي تحت',none:'بدون'};
const styHist=()=>{try{return JSON.parse(localStorage.getItem('mkz-sty-hist')||'[]')}catch(e){return []}};
function drawFrame(W,H,u){if(!STY.on||!STY.fr||STY.fr==='none')return;const c=COL(),f=STY.fr;CX.save();
 if(f==='border'){CX.lineWidth=12*u;CX.strokeStyle=c;CX.globalAlpha=.92;rr(8*u,8*u,W-16*u,H-16*u,34*u);CX.stroke()}
 else if(f==='corners'){CX.lineWidth=11*u;CX.strokeStyle=c;CX.lineCap='round';CX.globalAlpha=.95;const m=34*u,L=110*u;[[m,m,1,1],[W-m,m,-1,1],[m,H-m,1,-1],[W-m,H-m,-1,-1]].forEach(q=>{CX.beginPath();CX.moveTo(q[0]+q[2]*L,q[1]);CX.lineTo(q[0],q[1]);CX.lineTo(q[0],q[1]+q[3]*L);CX.stroke()})}
 else if(f==='wash'){const rgb=hexRgb(c).join(','),g1=CX.createLinearGradient(0,0,0,H*.3);g1.addColorStop(0,'rgba('+rgb+',.5)');g1.addColorStop(1,'rgba('+rgb+',0)');CX.fillStyle=g1;CX.fillRect(0,0,W,H*.3);const g2=CX.createLinearGradient(0,H*.7,0,H);g2.addColorStop(0,'rgba('+rgb+',0)');g2.addColorStop(1,'rgba('+rgb+',.5)');CX.fillStyle=g2;CX.fillRect(0,H*.7,W,H*.3)}
 else if(f==='strip'){CX.fillStyle=c;CX.fillRect(0,0,W,16*u);CX.fillRect(0,H-16*u,W,16*u);CX.globalAlpha=.9;CX.fillRect(0,H*.5-110*u,12*u,220*u);CX.fillRect(W-12*u,H*.5-110*u,12*u,220*u)}
 CX.restore()}
function styApply(p,fixed){STY=Object.assign({on:true},p);try{PERS.forEach(x=>document.fonts&&document.fonts.load('900 40px "'+x.font+'"'))}catch(e){}try{document.fonts&&document.fonts.load('900 40px "'+p.font+'"').then(()=>{LAY.clear();if(V&&CV)draw(V.currentTime)})}catch(e){}LAY.clear();if(D&&!fixed)D.sty=p.id;styPaint()}
function styPick(avoid){const h=styHist(),skip=new Set(h.slice(0,6));if(avoid)skip.add(avoid);let c=PERS.filter(p=>!skip.has(p.id));if(!c.length)c=PERS.filter(p=>p.id!==avoid);
 const last=PERS.find(p=>p.id===(avoid||h[0]));if(last){const d=c.filter(p=>p.font!==last.font&&p.o.trans!==last.o.trans&&p.kw!==last.kw&&p.fr!==last.fr);const d2=c.filter(p=>p.font!==last.font&&p.o.trans!==last.o.trans&&p.fr!==last.fr);c=d.length?d:d2.length?d2:c}const p=c[Math.floor(Math.random()*c.length)];try{localStorage.setItem('mkz-sty-hist',JSON.stringify([p.id].concat(h.filter(x=>x!==p.id)).slice(0,8)))}catch(e){}return p}
const CALM={id:'calm',n:'هادي خالص (من غير ألوان)',color:'#E6E6EA',font:'Almarai',rad:.9,bw:1,kw:'under',lift:.03,fr:'none',snd:{w:'sine',f:.8},o:{cap:'lower',motion:'none',trans:'none',look:'auto',cut:1}};
const SWATCH=['#F6DC8A','#FFE400','#FF7A2F','#FF4545','#FF4D8D','#E040FB','#B388FF','#5AA9FF','#00E5FF','#14B8A6','#3DDC97','#C6FF3D','#E9CBA0','#FFFFFF'];
const FONTL=[['Cairo','القاهرة'],['Tajawal','تجوال'],['Almarai','المراعي'],['Changa','شانجا'],['Lalezar','لاله زار'],['El Messiri','المسيري'],['Reem Kufi','ريم كوفي'],['Marhey','مرحي'],['Amiri','أميري (نسخ)']];
const FRL=[['none','من غير'],['corners','أركان'],['border','إطار ملوّن'],['wash','تدرّج لون'],['strip','شريط علوي']],KWL=[['under','خط تحت'],['neon','نيون'],['sticker','ستيكر'],['hl','ماركر'],['3d','ثلاثي الأبعاد']],TRL=[['none','من غير'],['zoom','زووم'],['flash','فلاش'],['slide','سلايد'],['rgb','تشويش ألوان'],['blink','غمضة']];
const custOf=()=>Object.assign({color:'#F6DC8A',font:'Cairo',fr:'none',kw:'under',trans:'zoom',rad:1},S.cust||{});
const styFonts=()=>{try{FONTL.forEach(f=>document.fonts&&document.fonts.load('900 40px "'+f[0]+'"'))}catch(e){}};
function styInit(){const m=S.sm||(S.mix===false?'plain':'auto');styFonts();
 if(m==='plain'){STY={on:false,o:{},color:'',font:'',rad:1,bw:2,kw:'under',lift:0,snd:{w:null,f:1}};LAY.clear();styPaint();return}
 if(m==='calm')return styApply(CALM,true);
 if(m==='custom'){const c=custOf();return styApply({id:'custom',n:'مخصص — '+((FONTL.find(f=>f[0]===c.font)||[])[1]||c.font),color:c.color,font:c.font,rad:c.rad,bw:3,kw:c.kw,lift:0,fr:c.fr,snd:{w:'sine',f:1},o:{trans:c.trans}},true)}
 if(m==='pick'){return styApply(PERS.find(x=>x.id===S.pickId)||PERS[0],true)}
 const keep=D&&D.sty&&PERS.find(p=>p.id===D.sty),curAuto=STY.on&&PERS.some(p=>p.id===STY.id)?STY.id:'';styApply(keep||styPick(curAuto))}
function styMode(m){S.sm=m;saveS();styInit();if(V&&CV)draw(V.currentTime)}
function styReroll(){if((S.sm||'auto')!=='auto'){S.sm='auto';saveS()}styApply(styPick(STY.on&&PERS.some(p=>p.id===STY.id)?STY.id:''));if(D&&F){try{const key='mkz-ai2:'+F.name+':'+F.size,c=JSON.parse(localStorage.getItem(key)||'null');if(c){c.sty=STY.id;localStorage.setItem(key,JSON.stringify(c))}}catch(e){}}if(V&&CV)draw(V.currentTime)}
function styPaint(){const md=S.sm||(S.mix===false?'plain':'auto'),el=$s('sm_sty');if(!el)return;
 const MODES=[['auto','🎲 تنويع تلقائي'],['pick','🖼️ اختار بصمة'],['plain','⚪ عادي'],['calm','🤍 هادي خالص'],['custom','🛠️ لون + خط مخصص']];
 $s('sm_modes').innerHTML=MODES.map(m=>`<button type="button" class="b ${md===m[0]?'':'o'}" data-sm="${m[0]}" style="flex:1 1 44%;min-height:46px">${m[1]}</button>`).join('');
 if(!STY.on)el.innerHTML=md==='plain'?'<b>⚪ عادي</b><div class="mu">اللون الذهبي والخط الأساسي من غير أي بصمة.</div>':'<span class="mu">هتتحدد بصمة أول ما تضغط «اعمل المونتاج».</span>';
 else{const o=STY.o||{};el.innerHTML=`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap"><span style="width:26px;height:26px;border-radius:50%;background:${STY.color};border:2px solid #fff3;flex:none"></span><b style="font-size:17px">${BR_ESC(STY.n)}</b></div><div class="mu" style="margin-top:4px">الخط: ${BR_ESC((FONTL.find(f=>f[0]===STY.font)||[])[1]||STY.font)} • الكلمة الكبيرة: ${(KWL.find(k=>k[0]===STY.kw)||[])[1]||STY.kw} • الإطار: ${(FRL.find(f=>f[0]===STY.fr)||[])[1]||'من غير'}${o.trans?' • الانتقال: '+((TRL.find(t=>t[0]===o.trans)||[])[1]||o.trans):''}</div>`}
 /* كل البصمات قدامك: دوس على أي واحدة */
 $s('sm_gal').innerHTML=PERS.map(p=>`<button type="button" data-pk="${p.id}" class="b o" style="display:block;text-align:right;padding:10px;border:2px solid ${(STY.on&&STY.id===p.id)?p.color:'rgba(255,255,255,.14)'};border-radius:14px;min-height:0"><div style="display:flex;align-items:center;gap:8px"><span style="width:22px;height:22px;border-radius:50%;background:${p.color};flex:none"></span><b>${BR_ESC(p.n)}</b></div><div style="font-family:'${p.font}',Cairo;font-size:21px;font-weight:900;color:${p.color};margin-top:4px">ميكانيزم السفرة</div><div class="mu" style="font-size:12px">${BR_ESC((FRL.find(f=>f[0]===p.fr)||[])[1]||'')} • ${BR_ESC((KWL.find(k=>k[0]===p.kw)||[])[1]||'')}</div></button>`).join('');
 const cu=$s('sm_cu');cu.style.display=md==='custom'?'':'none';
 if(md==='custom'){const c=custOf();cu.innerHTML=`<div class="mu" style="margin-bottom:4px">اللون</div><div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center">${SWATCH.map(x=>`<button type="button" data-cc="${x}" style="width:38px;height:38px;border-radius:50%;background:${x};border:3px solid ${c.color.toLowerCase()===x.toLowerCase()?'#fff':'rgba(255,255,255,.2)'};padding:0;min-height:0"></button>`).join('')}<input type="color" id="sm_ci" value="${c.color}" style="width:44px;height:38px;padding:0;border:0;background:none"></div>
  <div class="mu" style="margin:10px 0 4px">الخط (أي خط مع أي لون)</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${FONTL.map(f=>`<button type="button" data-cf="${f[0]}" class="b o" style="font-family:'${f[0]}',Cairo;font-size:20px;font-weight:800;min-height:48px;border:2px solid ${c.font===f[0]?c.color:'rgba(255,255,255,.14)'}">${f[1]}</button>`).join('')}</div>
  <div class="r2" style="margin-top:10px"><label>الإطار<select id="sm_cfr">${FRL.map(f=>`<option value="${f[0]}" ${c.fr===f[0]?'selected':''}>${f[1]}</option>`).join('')}</select></label><label>الكلمة الكبيرة<select id="sm_ckw">${KWL.map(f=>`<option value="${f[0]}" ${c.kw===f[0]?'selected':''}>${f[1]}</option>`).join('')}</select></label><label>الانتقال<select id="sm_ctr">${TRL.map(f=>`<option value="${f[0]}" ${c.trans===f[0]?'selected':''}>${f[1]}</option>`).join('')}</select></label></div>`}
 else cu.innerHTML=''}
function styWire(){const rd=()=>{if(V&&CV)draw(V.currentTime)},cust=(k,v)=>{S.cust=Object.assign(custOf(),{[k]:v});S.sm='custom';saveS();styInit();rd()};
 $s('sm_modes').onclick=e=>{const b=e.target.closest('[data-sm]');if(b)styMode(b.dataset.sm)};
 $s('sm_gal').onclick=e=>{const b=e.target.closest('[data-pk]');if(!b)return;S.pickId=b.dataset.pk;styMode('pick')};
 $s('sm_cu').onclick=e=>{const c=e.target.closest('[data-cc]'),f=e.target.closest('[data-cf]');if(c)cust('color',c.dataset.cc);else if(f)cust('font',f.dataset.cf)};
 $s('sm_cu').onchange=e=>{const t=e.target;if(t.id==='sm_ci')cust('color',t.value);else if(t.id==='sm_cfr')cust('fr',t.value);else if(t.id==='sm_ckw')cust('kw',t.value);else if(t.id==='sm_ctr')cust('trans',t.value)};
 $s('sm_rer').onclick=styReroll;styPaint()}
/* الستوديو بيرسم القايمة بعد ما المخزن يجهز (window.__ready) — نركّب بعده عشان مايتمسحش */
(window.__ready&&window.__ready.then?window.__ready:Promise.resolve()).then(()=>setTimeout(mount,0),()=>setTimeout(mount,0));
/* ---------- 📍 تحريك فيديو الإدراج: سحب بالصباع على المعاينة + حجم + رجوع للمكان التلقائي ---------- */
let BRMOVE=false;
function brPosUI(){const host=$s('sm_bi');if(!host||$s('sm_brp'))return;const d=document.createElement('div');d.id='sm_brp';d.style.cssText='margin-top:10px;padding-top:10px;border-top:1px solid var(--ln)';
 d.innerHTML='<div style="font-weight:800;margin-bottom:6px">📍 مكان الفيديو على الشاشة</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" class="b o" id="sm_brm" style="flex:1;min-width:140px">✋ حرّكه بصباعك</button><button type="button" class="b o" id="sm_brr" style="flex:1;min-width:140px">↩️ المكان التلقائي</button></div><label style="display:flex;align-items:center;gap:8px;margin-top:8px">الحجم <input type="range" id="sm_brw" min="25" max="100" value="92" style="flex:1"><span id="sm_brwv" class="mu">92%</span></label><p class="mu" id="sm_brh" style="margin:6px 0 0">دوس «حرّكه» وبعدين اسحب الفيديو على المعاينة (فوق) للمكان اللي عايزه. الحجم بالسلايدر.</p>';
 host.parentElement.appendChild(d);
 const w=$s('sm_brw'),upd=()=>{const p=S.brp;w.value=Math.round(((p&&p.w)||.92)*100);$s('sm_brwv').textContent=w.value+'%';$s('sm_brm').classList.toggle('o',!BRMOVE);$s('sm_brm').textContent=BRMOVE?'✅ تمام — ثبّت المكان':'✋ حرّكه بصباعك';$s('sm_brr').style.opacity=S.brp?1:.5};
 const redraw=()=>{if(V&&CV){LAY.clear();draw(V.currentTime)}};
 $s('sm_brm').onclick=()=>{BRMOVE=!BRMOVE;if(BRMOVE&&!S.brp){S.brp={cx:.5,cy:.74,w:.92};saveS()}if(CV)CV.style.touchAction=BRMOVE?'none':'';upd();redraw();if(BRMOVE&&CV)CV.scrollIntoView({behavior:'smooth',block:'center'})};
 $s('sm_brr').onclick=()=>{delete S.brp;BRMOVE=false;if(CV)CV.style.touchAction='';saveS();upd();redraw()};
 w.oninput=()=>{S.brp=Object.assign({cx:.5,cy:.74,w:.92},S.brp||{},{w:+w.value/100});saveS();$s('sm_brwv').textContent=w.value+'%';redraw()};upd()}
function brDragWire(){const c=$s('sm_cv');if(!c||c._brd)return;c._brd=1;let on=false;
 const at=e=>{const r=c.getBoundingClientRect();return {x:Math.max(0,Math.min(1,(e.clientX-r.left)/r.width)),y:Math.max(0,Math.min(1,(e.clientY-r.top)/r.height))}};
 const mv=e=>{if(!BRMOVE||!on)return;const p=at(e);S.brp=Object.assign({w:.92},S.brp||{},{cx:+p.x.toFixed(3),cy:+p.y.toFixed(3)});if(V){LAY.clear();draw(V.currentTime)}e.preventDefault()};
 c.addEventListener('pointerdown',e=>{if(!BRMOVE)return;on=true;try{c.setPointerCapture(e.pointerId)}catch(x){}mv(e)});c.addEventListener('pointermove',mv);
 c.addEventListener('pointerup',()=>{if(on){on=false;saveS()}});c.addEventListener('pointercancel',()=>{on=false});}
/* وقت التحريك: لو مفيش إدراج ظاهر في اللحظة دي نرسم مستطيل إرشادي مكانه */
const _draw2=draw;draw=function(t){const r=_draw2.apply(this,arguments);try{if(BRMOVE&&CV&&CX&&!brActive(t)){const W=CV.width,H=CV.height,g=brCustom({x:W*.04,y:H*.6,w:W*.92,h:H*.28},W,H);CX.save();CX.setLineDash([18,12]);CX.lineWidth=5*(W/1080);CX.strokeStyle='#F6DC8A';CX.fillStyle='rgba(246,220,138,.18)';CX.fillRect(g.x,g.y,g.w,g.h);CX.strokeRect(g.x,g.y,g.w,g.h);CX.setLineDash([]);CX.fillStyle='#F6DC8A';CX.font='800 '+Math.round(34*(W/1080))+'px sans-serif';CX.textAlign='center';CX.fillText('🎞️ فيديو الإدراج',g.x+g.w/2,g.y+g.h/2);CX.restore()}}catch(e){}return r};
/* ---------- 🪝 مكتبة الهوكات: ٥٠+ بداية قوية للفيديو. كل هوك: ليه بيشتغل، إزاي تصوره بالتوقيت، إيه اللي يتركّب في المونتاج، جملة نموذجية، وتأثير بيتطبّق لوحده ---------- */
const HK_CATS=['الكل','صدمة وفضول','سؤال وتحدي','أخطاء وتحذير','قبل وبعد','أرقام وأسعار','حركة وبصريات','قصة وإثبات','عرض وعروض'];
const HK=[
['صدمة وفضول','الحقيقة اللي محدش بيقولها','الناس بتقف عند أي حاجة «مخبّياها عنهم»','٠–١ث: قرّب من الكاميرا وبصّة جادة|١–٣ث: قول الجملة ببطء|٣–٥ث: ارجع للمنتج','كلمة «محدش» تتلوّن بالأحمر + صوت نبضة','في حاجة عن {منتج} محدش بيقولهالك…','slam'],
['صدمة وفضول','ماتشتريش قبل ما تشوف ده','تحذير قبل الشراء بيوقّف الإصبع عن السكرول','٠–٢ث: إيدك قدام الكاميرا كأنك بتوقّفه|٢–٤ث: الجملة|بعدها المنتج','علامة ⚠️ نابضة + حدود حمرا بتنبض','استنى! قبل ما تشتري {منتج} شوف ده.','redalert'],
['صدمة وفضول','٣ ثواني وهتفهم الغلط','وعد بوقت قصير بيخلّي الناس تكمّل','٠–١ث: ارفع ٣ صوابع|١–٤ث: عدّ ٣-٢-١ بصوتك|٤ث: الكشف','عدّاد ٣-٢-١ كبير في النص + شريط وقت بينزل','٣ ثواني بس وهتعرف ليه {منتج} بيبوظ.','count'],
['صدمة وفضول','ده اللي حصل لما جرّبت','نتيجة مجهولة = فضول','٠–٢ث: لقطة النتيجة من غير شرح (الأخيرة)|٢–٣ث: قول الجملة|بعد كده ارجع من الأول','الفيديو يبدأ باللقطة الأخيرة مقطوعة ٢ث بعدين «من الأول»','جرّبت {منتج} لمدة شهر… والنتيجة صدمتني.','glitch'],
['صدمة وفضول','إنت بتعملها غلط من سنين','اتهام لطيف بيخلّي الناس تدافع وتتفرج','٠–١ث: بصّة للكاميرا وإشارة بإصبعك|١–٣ث: الجملة|٣ث: اعرض الغلط','إصبع/سهم بيشاور + كلمة «غلط» تنط','إنت بتركّب {منتج} غلط… وده السبب.','slam'],
['صدمة وفضول','لو شفت ده في بيتك اجري','مبالغة خفيفة + خوف بسيط','٠–٢ث: لقطة قريبة للعيب|٢–٣ث: الجملة بصوت واطي','زوم سريع على العيب + صوت تحذير','لو لقيت ده في {منتج} اجري بسرعة.','redalert'],
['صدمة وفضول','المفاجأة في الآخر','بيخلّي الناس تتفرج للنهاية','٠–٢ث: اعرض المنتج وقول «استنى للآخر»|بعد كده شرح عادي','شريط تقدّم بيملا لحد المفاجأة','استنى لآخر الفيديو… في حاجة هتفاجئك.','type'],
['صدمة وفضول','سر الصنايعية','«سر المهنة» بيجذب الفضول','٠–٢ث: لف حوالين الشغل وقول الجملة بهمس|٢–٤ث: اكشف الخدعة','ختم «سر» أحمر ينزل بصوت ختم','السر اللي الصنايعي مابيقولوش للزبون…','slam'],
['صدمة وفضول','ماكنتش مصدّق إن ده ممكن','دهشة شخصية بتنتقل للمتفرج','٠–١ث: عينك واسعة|١–٣ث: الجملة|٣ث: العرض','تأثير فلاش أبيض عند الكشف','مكنتش مصدق إن {منتج} يعمل كده!','flash'],
['صدمة وفضول','أنا غلطت ودفعت التمن','الاعتراف بغلط بيخلّي الناس تسمع','٠–٢ث: وش متضايق + الجملة|٢–٥ث: احكي الغلطة','عنوان «غلطة بـ ... جنيه» بالأحمر','غلطتي في {منتج} كلّفتني فلوس كتير.','glitch'],
['سؤال وتحدي','تعرف الفرق بين ده وده؟','سؤال بيحط المتفرج في اختبار','٠–٢ث: منتجين قدام الكاميرا|٢–٣ث: السؤال|٣ث: الإجابة بعد ثانيتين صمت','علامتي ؟ ؟ فوق كل منتج + عدّاد تفكير','تعرف الفرق بين {منتج} والتاني؟','type'],
['سؤال وتحدي','خمّن الصح من الاتنين','لعبة تفاعل بتزوّد التعليقات','٠–٢ث: اعرض الاتنين|٢–٤ث: «اكتب ١ ولا ٢»|٤ث: الإجابة آخر الفيديو','رقمين كبار ١ و٢ على الجنبين','اكتب في الكومنت: أنهي أحسن؟','slam'],
['سؤال وتحدي','تحدّي: لو عرفت الغلط هديك خصم','تحدي + مكافأة = مشاركة','٠–٣ث: اعرض الصورة وفيها غلطة|٣–٥ث: «اكتب الغلطة في الكومنت»','دائرة حمرا بتتحرك على الغلطة في الآخر','لو لقيت الغلط في الفيديو ده، ليك خصم.','flash'],
['سؤال وتحدي','هل ده يستاهل؟','سؤال بسيط الكل عنده رأي','٠–١ث: اعرض السعر|١–٣ث: السؤال|بعد كده التفاصيل','علامة سعر كبيرة + ❓','{منتج} بسعر كده… يستاهل ولا لأ؟','slam'],
['سؤال وتحدي','إنت من أنهي نوع؟','يخلّي كل متفرج يصنّف نفسه','٠–٢ث: اعرض ٣ أنواع بسرعة|٢–٣ث: السؤال','٣ أيقونات بتظهر ورا بعض','إنت من أنهي نوع في المطبخ؟','type'],
['سؤال وتحدي','٩٩٪ ماعندهمش الإجابة','رقم إحصائي بيثير التحدي','٠–٢ث: السؤال + بصّة واثقة|٢–٤ث: اللغز','نسبة ٩٩٪ كبيرة بتتعد من صفر','٩٩٪ مايعرفوش ليه {منتج} بيقفل بالراحة.','count'],
['سؤال وتحدي','جاوب قبل ما أقولك','بيخلّي المتفرج يفكّر بصوت','٠–٢ث: السؤال|٢–٤ث: سكوت|٤ث: الإجابة','شريط وقت بينزل في الصمت','إيه الحاجة اللي بتبوّظ {منتج}؟ فكّر…','count'],
['أخطاء وتحذير','٣ أخطاء بتبوّظ المطبخ','قائمة بعدد معروف = وعد واضح','٠–٢ث: الجملة + ٣ صوابع|بعد كده كل غلطة بتوقيتها','أرقام ١ ٢ ٣ تظهر مع كل غلطة','٣ أخطاء في اختيار {منتج} بتكلّفك كتير.','redalert'],
['أخطاء وتحذير','الغلطة اللي كل الناس بتعملها','«كل الناس» = المتفرج واحد منهم','٠–٢ث: لقطة الغلطة بتتعمل|٢–٣ث: الجملة','علامة ✗ حمرا كبيرة على الغلط','الغلطة دي بيعملها كل واحد بيركّب {منتج}.','redalert'],
['أخطاء وتحذير','ده السبب إن المنتج بيتكسر','سبب مشكلة معروفة','٠–٢ث: اعرض الكسر|٢–٤ث: السبب','رسمة متحركة للكسر (بتتولّد تلقائي)','ده السبب الحقيقي إن {منتج} بيتكسر.','glitch'],
['أخطاء وتحذير','وقّف قبل ما تركّب','أمر مباشر = توقّف','٠–١ث: إيدك قدام الكاميرا|١–٣ث: الجملة','إطار أحمر بينبض + صوت صفارة','وقّف! ماتركّبش {منتج} قبل ما تشوف ده.','redalert'],
['أخطاء وتحذير','رخيص النهاردة غالي بكرة','مفارقة معروفة','٠–٢ث: منتج رخيص مكسور جنب سليم|٢–٣ث: الجملة','تقسيم الشاشة نصين: رخيص / سليم','اللي بتوفّره النهاردة هتدفعه بكرة.','slam'],
['أخطاء وتحذير','نصيحة الصنايعي دي غلط','تحدّي سلطة بيشد الانتباه','٠–٢ث: الجملة بحزم|٢–٤ث: التصحيح','صوت «بيب» تحذير','في نصيحة بتتقال عن {منتج} وهي غلط.','glitch'],
['أخطاء وتحذير','شوف إيه اللي هيحصل بعد سنة','مستقبل مخيف','٠–٢ث: لقطة منتج جديد|٢–٣ث: «وبعد سنة…»|٣–٥ث: لقطة التلف','انتقال «بعد سنة» بشريط وقت يلف','بعد سنة من الاستخدام… شوف النتيجة.','type'],
['قبل وبعد','من ده… لده','تحوّل واضح','٠–٢ث: لقطة قبل (فوضى)|٢–٣ث: قطع سريع|٣–٥ث: لقطة بعد','تقسيم الشاشة قبل/بعد بخط بيتحرك','من فوضى لمطبخ مرتب بـ {منتج}.','open'],
['قبل وبعد','٣٠ ثانية للتحويل','سرعة التحوّل','٠–١ث: تايمر ٣٠ث|١–٥ث: تسريع (تايم لابس) للشغل','عدّاد تنازلي في ركن الشاشة','٣٠ ثانية بس وتشوف الفرق.','count'],
['قبل وبعد','قبل ما أركّب… وبعد','الفرق البصري','٠–٢ث: لقطة قبل + كلمة «قبل»|٢–٥ث: بعد + كلمة «بعد»','تسمية قبل/بعد بخط كبير','قبل {منتج} وبعده… الفرق واضح.','open'],
['قبل وبعد','الدرج ده كان بيتعب','تحويل مشكلة لحل','٠–٢ث: اعرض المشكلة|٢–٣ث: «لحد ما…»|٣ث: الحل','انتقال سحب لحل','الدرج ده كان مشكلة… لحد ما جبت {منتج}.','open'],
['قبل وبعد','نفس المكان ٢٤ ساعة','قبل/بعد في يوم','٠–٢ث: لقطة ثابتة للمكان|٢–٤ث: تايم لابس للتركيب|٤ث: النتيجة','شريط ساعة بيمشي','يوم واحد وغيّرت المطبخ كله.','count'],
['أرقام وأسعار','بـ {سعر} جنيه بس','السعر الصادم بيشد','٠–١ث: اعرض الرقم مكتوب|١–٣ث: قول الجملة','رقم السعر ضخم بيتعد لحد السعر','{منتج} بـ {سعر} جنيه بس؟!','count'],
['أرقام وأسعار','وفّر ٥٠٪ لو عملت كده','وعد بتوفير','٠–٢ث: الجملة + أرقام بتنزل|٢ث: الطريقة','نسبة ٥٠٪ بتنزل من ١٠٠','هتوفّر نص الفلوس لو عملت كده.','count'],
['أرقام وأسعار','مقارنة: رخيص ٢٠٠ / غالي ٢٠٠٠','فرق سعر كبير بيحرّك الفضول','٠–٢ث: اعرض المنتجين مع سعرهم|٢–٤ث: «الفرق ده فين؟»','تقسيم شاشة بسعرين','٢٠٠ ولا ٢٠٠٠؟ الفرق مش السعر بس.','slam'],
['أرقام وأسعار','٣ حاجات هتعرفها في ١٠ ثواني','وعد صغير وواضح','٠–٢ث: الجملة|٢–١٠ث: الثلاثة بسرعة','قايمة ١-٢-٣ بتظهر وراء بعض','٣ حاجات عن {منتج} في ١٠ ثواني.','type'],
['أرقام وأسعار','جرّبت ١٠ أنواع واخترت واحد','جهد كبير = ثقة','٠–٢ث: ١٠ منتجات في صف|٢–٤ث: واحد بس بيتّاخد','شبكة ١٠ صور وواحدة بتضوي','جرّبت ١٠ أنواع {منتج}… وده الفايز.','flash'],
['أرقام وأسعار','سعر الجملة بقى متاح','عرض للتجار','٠–٢ث: اعرض كمية كبيرة|٢–٣ث: الجملة','شارة «جملة» ذهبية بتلمع','اللي بيشتري كمية هيوصل لسعر تاني خالص.','flash'],
['أرقام وأسعار','٥ ثواني وهتحسب التكلفة','حساب سريع','٠–٣ث: اكتب أرقام على ورقة|٣–٥ث: النتيجة','أرقام بتتجمع وتطلع نتيجة','احسبها معايا في ٥ ثواني.','count'],
['حركة وبصريات','شدّ بإيدك والشاشة تتفتح','حركة جسم بتتحول لانتقال = هوك سينمائي','٠–١ث: ارفع إيدك الشمال قدام الكاميرا كأنك بتمسك حاجة|١–٢ث: اسحبها لجنب|٢ث: بداية الفيديو الحقيقي','لوحتين سودا بتتفتح من النص مع حركة إيدك (تأثير الفتح)','(من غير كلام) اسحب إيدك والشاشة تتفتح عن المنتج','open'],
['حركة وبصريات','نطّة والمنتج يظهر','حركة مفاجئة = انتباه','٠–١ث: اقفز أو انحني للكاميرا|١–٢ث: قطّع على المنتج','هزة كاميرا + فلاش عند القطع','(نط) وفجأة {منتج} قدامك.','flash'],
['حركة وبصريات','وقعت من حاجة','مشهد درامي بيضحّك ويشد','٠–١ث: اتكلم وانت ماشي بعدين اتعثّر|١–٢ث: قطّع|٢ث: وقوع على المنتج','هزة قوية + صوت وقوع + تجميد لقطة ٠٫٣ث','أووه! … شوف إيه اللي وقّعني.','glitch'],
['حركة وبصريات','المنتج بيلف ٣٦٠ في ٣ ثواني','شكل المنتج الكامل بسرعة','٠–٣ث: لف المنتج أو الكاميرا حواليه','لقطة بطيئة + ظل ناعم','{منتج} من كل الزوايا.','open'],
['حركة وبصريات','تقطيع إيقاعي على الموسيقى','إيقاع سريع بيشد العين','٠–٣ث: ٦ لقطات قصيرة للمنتج (نص ثانية)','قطع على الإيقاع + زوم نبضة','{منتج}… بشكل ماشفتهوش قبل كده.','flash'],
['حركة وبصريات','لقطة من جوّه الدرج','زاوية مش معتادة','٠–٢ث: حط الكاميرا جوه الدرج وهو بيتفتح','زوم أوتوماتيك لما الدرج يفتح','شوف الدرج ده من جوّه.','open'],
['حركة وبصريات','قرّب جداً وابعد فجأة','ماكرو مفاجئ','٠–٢ث: قرّب على تفصيلة|٢ث: ابعد فجأة','زوم دخول/خروج سريع','التفصيلة الصغيرة اللي بتفرق في {منتج}.','glitch'],
['حركة وبصريات','لقطة بطيئة لحظة القفل','سلو موشن مريح','٠–٣ث: صوّر قفل الدرج ٦٠ إطار وبطّئه','تباطؤ ٣٠٪ + صوت هادي','اسمع القفل ده… من غير ولا صوت.','open'],
['حركة وبصريات','يد تدخل الإطار بالمنتج','يد بتقدّم المنتج = حقيقي','٠–١ث: لقطة فاضية|١–٢ث: إيد بتدخل بالمنتج','قصّ مرن + ظل','اتفضّل… ده {منتج}.','slam'],
['قصة وإثبات','زبون اتصل بيا الصبح','قصة حقيقية بتشد','٠–٣ث: «زبون اتصل بيا…» وانت بتمسك الموبايل|٣–٦ث: المشكلة','أيقونة موبايل بتهتز + عنوان القصة','زبون اتصل بيا النهاردة بسبب {منتج}…','type'],
['قصة وإثبات','٢٠ سنة شغل وده اللي اتعلمته','خبرة = مصداقية','٠–٢ث: جملة ثابتة في ورشتك|٢–٥ث: الدرس','رقم ٢٠ سنة كبير','٢٠ سنة في الشغل ده وده أهم درس.','slam'],
['قصة وإثبات','شوف رد فعل الزبون','دليل اجتماعي','٠–٣ث: لقطة الزبون وهو بيشوف الشغل','لقطة رد الفعل مكبّرة','شوف الزبون قال إيه لما شاف {منتج}.','flash'],
['قصة وإثبات','ده شغلنا مش صور من النت','صدق وإثبات','٠–٢ث: لقطة الورشة + الجملة','شارة «تصوير حقيقي»','ده شغلنا بإيدينا مش صورة من النت.','glitch'],
['قصة وإثبات','سألوني ليه ماعملتش كده قبل','سؤال شائع = فضول','٠–٣ث: الجملة|٣ث: الإجابة','علامة سؤال تتحول لإجابة','كل الناس بتسألني: ليه {منتج}؟','type'],
['قصة وإثبات','اللي عمل ده مابقاش فيه تاني','ندرة','٠–٢ث: اعرض منتج نادر|٢–٤ث: «آخر قطعة»','عدّاد قطع بتنقص','آخر كام قطعة من {منتج} وخلاص.','count'],
['عرض وعروض','عرض لمدة ٢٤ ساعة','ندرة زمنية','٠–٢ث: الجملة + ساعة|٢ث: العرض','تايمر ٢٤ ساعة بيعد','عرض {منتج} لمدة ٢٤ ساعة بس.','count'],
['عرض وعروض','أول ١٠ بس هياخدوا الهدية','ندرة عدد','٠–٢ث: الجملة + ١٠ صوابع','عدّاد ١٠ بينقص','أول ١٠ طلبات عليهم هدية.','count'],
['عرض وعروض','اطلبها قبل ما تخلص','FOMO','٠–٢ث: اعرض الكمية الباقية|٢ث: الجملة','شريط كمية بيفضى','الكمية قربت تخلص… اطلب دلوقتي.','redalert'],
['عرض وعروض','اللي هيكلمني دلوقتي له سعر خاص','دعوة واضحة','٠–٣ث: اعرض الرقم|٣–٥ث: الجملة','زرار واتساب أخضر بينبض','كلّمني دلوقتي واطلب {منتج} بسعر خاص.','flash'],
['عرض وعروض','ضمان سنتين مكتوب','ضمان بيريّح','٠–٢ث: اعرض الورقة|٢ث: الجملة','ختم «ضمان» ينزل','{منتج} بضمان سنتين مكتوب.','slam']];
const HKFX={slam:'ضربة نص كبير',flash:'فلاش أبيض + نص',glitch:'تشويش رقمي',open:'شاشة بتتفتح',redalert:'تحذير أحمر',count:'عدّاد',type:'كتابة على لوح'};
/* واجهة الهوكات + تأثير بداية الفيديو */
let HKSEL=null,HKCAT='الكل';
function hkUI(){const go=$s('sm_go');if(!go||$s('sm_hk'))return;const d=document.createElement('div');d.className='p';d.id='sm_hk';
 d.innerHTML=`<h2>🪝 الهوكات (${HK.length})</h2><p class="mu" style="margin:0 0 8px">اختار هوك: هيقولك تصوّر إزاي بالتوقيت وإيه اللي يتركّب، وتقدر تطبّق التأثير على بداية الفيديو بضغطة.</p><div id="hk_c" style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px"></div><input id="hk_p" placeholder="اسم المنتج (يتحط مكان {منتج})" style="width:100%;margin-bottom:6px"><div id="hk_l" style="max-height:340px;overflow:auto"></div><div id="hk_d"></div>`;
 go.before(d);
 const prod=()=>($s('hk_p').value.trim()||'المنتج'),fill=t=>t.replace(/\{منتج\}/g,prod()).replace(/\{سعر\}/g,'...');
 const paintList=()=>{$s('hk_c').innerHTML=HK_CATS.map(c=>`<button type="button" class="b ${c===HKCAT?'':'o'}" data-c="${c}" style="padding:4px 10px;min-height:34px;font-size:13px">${c}</button>`).join('');
  $s('hk_l').innerHTML=HK.map((h,i)=>({h,i})).filter(x=>HKCAT==='الكل'||x.h[0]===HKCAT).map(({h,i})=>`<button type="button" data-i="${i}" class="b o" style="display:flex;width:100%;justify-content:space-between;text-align:right;margin:0 0 5px;${HKSEL===i?'background:rgba(212,165,55,.18)':''}"><span>${h[1]}</span><span class="mu" style="font-size:11px;font-weight:600">${HKFX[h[6]]||''}</span></button>`).join('')};
 const paintDet=()=>{const el=$s('hk_d');if(HKSEL==null){el.innerHTML='';return}const h=HK[HKSEL],on=S.hook&&S.hook.n===h[1];
  el.innerHTML=`<div style="margin-top:10px;padding:12px;border:1px solid var(--a2);border-radius:12px"><div style="font-weight:900;font-size:17px;margin-bottom:6px">${h[1]}</div><div class="mu" style="margin-bottom:8px">💡 ليه بيشتغل: ${h[2]}</div><div style="font-weight:800;margin-bottom:4px">🎥 صوّر كده:</div><ol style="margin:0 0 8px;padding-inline-start:20px;line-height:1.8">${h[3].split('|').map(x=>'<li>'+x+'</li>').join('')}</ol><div style="font-weight:800;margin-bottom:4px">✂️ في المونتاج:</div><div style="margin-bottom:8px;line-height:1.7">${h[4]}</div><div style="font-weight:800;margin-bottom:4px">💬 الجملة (عدّلها):</div><input id="hk_t" value="${esc(fill(h[5]))}" style="width:100%"><label style="display:block;margin-top:8px">التأثير: <select id="hk_f">${Object.keys(HKFX).map(k=>`<option value="${k}" ${(on?S.hook.fx:h[6])===k?'selected':''}>${HKFX[k]}</option>`).join('')}</select></label><div style="display:flex;gap:6px;margin-top:10px"><button type="button" class="b" id="hk_ap" style="flex:1">✅ طبّق على بداية الفيديو</button>${on?'<button type="button" class="b o" id="hk_rm">✕ شيله</button>':''}</div>${on?'<p class="mu" style="margin:6px 0 0">✔ متطبّق: بيظهر أول ٢٫٤ ثانية من الفيديو.</p>':''}</div>`;
  $s('hk_ap').onclick=()=>{S.hook={n:h[1],text:$s('hk_t').value.trim(),fx:$s('hk_f').value};saveS();paintDet();if(V&&CV){LAY.clear();draw(0.1);say('اتطبّق ✔ — شوف أول الفيديو في المعاينة')}};
  const rm=$s('hk_rm');if(rm)rm.onclick=()=>{delete S.hook;saveS();paintDet();if(V&&CV)draw(V.currentTime)}};
 $s('hk_c').onclick=e=>{const b=e.target.closest('[data-c]');if(b){HKCAT=b.dataset.c;paintList()}};
 $s('hk_p').oninput=()=>{if(HKSEL!=null&&$s('hk_t'))$s('hk_t').value=fill(HK[HKSEL][5])};
 $s('hk_l').onclick=e=>{const b=e.target.closest('[data-i]');if(!b)return;HKSEL=+b.dataset.i;paintList();paintDet();$s('hk_d').scrollIntoView({behavior:'smooth',block:'nearest'})};
 paintList()}
function hkWrap(txt,maxW,fs){CX.font='900 '+fs+'px Cairo,Tajawal,sans-serif';const w=txt.split(/\s+/),L=[];let c='';w.forEach(x=>{const n=c?c+' '+x:x;if(CX.measureText(n).width>maxW&&c){L.push(c);c=x}else c=n});if(c)L.push(c);return L}
function hookOverlay(t){const h=S.hook;if(!h||!h.text||!CV||!CX)return;const tt=outT(t),D=2.4;if(tt<0||tt>=D)return;const W=CV.width,H=CV.height,u=W/1080,fx=h.fx||'slam',ac=COL(),e=x=>x<0?0:x>1?1:x*x*(3-2*x),fade=tt>D-.35?e((D-tt)/.35):1;
 CX.save();CX.direction='rtl';CX.textAlign='center';CX.textBaseline='middle';
 const drawText=(sc,al,yy,col)=>{const fs=Math.round(92*u),L=hkWrap(h.text,W*.84,fs),lh=fs*1.25,cy=(yy==null?H*.4:yy),y0=cy-(L.length-1)*lh/2;CX.save();CX.globalAlpha=al*fade;CX.translate(W/2,cy);CX.scale(sc,sc);CX.translate(-W/2,-cy);
  CX.font='900 '+fs+'px Cairo,Tajawal,sans-serif';CX.lineJoin='round';CX.lineWidth=fs*.16;CX.strokeStyle='rgba(0,0,0,.85)';CX.shadowColor='rgba(0,0,0,.6)';CX.shadowBlur=24*u;L.forEach((l,i)=>{CX.strokeText(l,W/2,y0+i*lh)});CX.shadowBlur=0;CX.fillStyle=col||'#fff';L.forEach((l,i)=>CX.fillText(l,W/2,y0+i*lh));CX.restore()};
 if(fx==='slam'){const p=e(tt/.28),sc=1.9-.9*p;CX.fillStyle='rgba(0,0,0,'+(.45*fade)+')';CX.fillRect(0,0,W,H);drawText(sc,p,null,'#fff');CX.fillStyle=ac;CX.globalAlpha=fade*p;CX.fillRect(W*.2,H*.4+Math.round(92*u*1.5),W*.6*p,10*u)}
 else if(fx==='flash'){const f=Math.max(0,1-tt/.22);CX.fillStyle='rgba(255,255,255,'+(.85*f)+')';CX.fillRect(0,0,W,H);CX.fillStyle='rgba(0,0,0,'+(.4*fade)+')';CX.fillRect(0,0,W,H);drawText(1+.12*(1-e(tt/.4)),e(tt/.15),null,'#ffe27a')}
 else if(fx==='glitch'){CX.fillStyle='rgba(0,0,0,'+(.5*fade)+')';CX.fillRect(0,0,W,H);const j=tt<.9?(Math.sin(tt*90)*12*u):0;CX.save();CX.translate(j,0);CX.globalCompositeOperation='lighter';CX.save();CX.translate(-6*u,0);drawText(1,1,null,'#ff2d55');CX.restore();CX.save();CX.translate(6*u,0);drawText(1,1,null,'#00e5ff');CX.restore();CX.restore();drawText(1,1,null,'#fff');if(tt<.9){for(let i=0;i<5;i++){const y=((tt*997+i*173)%1)*H;CX.fillStyle='rgba(255,255,255,.2)';CX.fillRect(0,y,W,8*u+(i%3)*5*u)}}}
 else if(fx==='open'){const p=e(tt/.9),w2=W/2*(1-p);CX.fillStyle='#000';CX.fillRect(0,0,w2,H);CX.fillRect(W-w2,0,w2,H);CX.fillStyle=ac;CX.fillRect(w2-4*u,0,4*u,H);CX.fillRect(W-w2,0,4*u,H);if(tt>.45)drawText(1,e((tt-.45)/.3),H*.28,'#fff')}
 else if(fx==='redalert'){const pu=.5+.5*Math.sin(tt*14);CX.lineWidth=(26+18*pu)*u;CX.strokeStyle='rgba(255,40,40,'+(.9*fade)+')';CX.strokeRect(0,0,W,H);CX.fillStyle='rgba(120,0,0,'+(.28*fade)+')';CX.fillRect(0,0,W,H);CX.font=Math.round(150*u)+'px sans-serif';CX.globalAlpha=fade*(.7+.3*pu);CX.fillText('⚠️',W/2,H*.22);drawText(1+.05*pu,e(tt/.2),H*.42,'#fff')}
 else if(fx==='count'){const n=Math.max(1,3-Math.floor(tt/.5)),k=(tt%.5)/.5;CX.fillStyle='rgba(0,0,0,'+(.5*fade)+')';CX.fillRect(0,0,W,H);CX.globalAlpha=fade*(1-k*.5);CX.font='900 '+Math.round(360*u)+'px Cairo,sans-serif';CX.fillStyle=ac;CX.lineWidth=18*u;CX.strokeStyle='#000';if(tt<1.5){CX.save();CX.translate(W/2,H*.3);CX.scale(1.3-.3*e(k*2),1.3-.3*e(k*2));CX.strokeText(String(n),0,0);CX.fillText(String(n),0,0);CX.restore()}CX.globalAlpha=1;drawText(1,e((tt-.2)/.3),H*.58,'#fff');CX.fillStyle=ac;CX.fillRect(W*.1,H*.9,W*.8*Math.max(0,1-tt/D),12*u)}
 else if(fx==='type'){const bh=H*.2,y=H*.36;CX.fillStyle='rgba(10,10,14,'+(.8*fade)+')';CX.beginPath();if(CX.roundRect)CX.roundRect(W*.06,y,W*.88,bh,26*u);else CX.rect(W*.06,y,W*.88,bh);CX.fill();const full=h.text,n=Math.min(full.length,Math.floor(tt/.045)),part=full.slice(0,n);const fs=Math.round(60*u);CX.font='800 '+fs+'px Cairo,Tajawal,sans-serif';CX.fillStyle='#fff';CX.globalAlpha=fade;CX.fillText(part+(Math.floor(tt*4)%2?'▍':''),W/2,y+bh/2);CX.fillStyle=ac;CX.fillRect(W*.06,y+bh-8*u,W*.88*Math.min(1,tt/1.2),8*u)}
 CX.restore()}
const _draw3=draw;draw=function(t){const r=_draw3.apply(this,arguments);try{hookOverlay(t)}catch(e){}return r};
/* ---------- 🔲 شاشة المونتاج الذكي: أيقونات مربعة بدل ٩ كروت طويلة تحت بعض — دوس أيقونة تفتح اختياراتها، دوس تاني ترجع مربعة ---------- */
const TILE_CSS=`#v-smart .tl-g{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin:8px 0}
#v-smart .tl{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;aspect-ratio:1;min-width:0;padding:6px 3px;border:1px solid var(--ln);border-radius:16px;background:var(--sf);color:var(--tx);font-family:var(--f);cursor:pointer;text-align:center;-webkit-tap-highlight-color:transparent;transition:transform .12s,box-shadow .12s}
#v-smart .tl:active{transform:scale(.95)}
#v-smart .tl{grid-column:span 2}#v-smart .tl.w{grid-column:span 3;aspect-ratio:auto;min-height:72px;flex-direction:row;gap:8px;padding:8px 10px}
#v-smart .tl .ti{font-size:28px;line-height:1}#v-smart .tl.w .ti{font-size:30px}
#v-smart .tl .tt{font-weight:800;font-size:13px;line-height:1.2;color:var(--tx)}
#v-smart .tl .ts{font-size:11px;color:var(--mu);line-height:1.2;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#v-smart .tl.w .tx{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
#v-smart .tl.on{border-color:var(--a2,#D4A537);box-shadow:0 0 0 2px var(--a2,#D4A537) inset;background:color-mix(in srgb,var(--a2) 18%,var(--sf))}
#v-smart .tl-p>.p{display:none;margin-top:0}#v-smart .tl-p>.p.tl-open{display:block;animation:tlin .16s ease-out}
@keyframes tlin{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}`;
const TILES=[
 ['١) الفيديو','📹','الفيديو',()=>F?F.name.slice(0,18):'اختار',1,'pre'],
 ['📚 فيديوهاتي (متخزنة','📚','فيديوهاتي',()=>'المتخزنة',1,'pre'],
 ['🎵 موسيقى','🎵','موسيقى ولوجو',()=>MU.buf?(MU.name||'موسيقى').slice(0,14):'مفيش',0,'pre'],
 ['🎞️ فيديوهات الإدراج','🎞️','الإدراج',()=>BRC.length?BRC.length+' فيديو':'مفيش',0,'pre'],
 ['🔎 منتجات ميكانيزم','🔎','المنتجات',()=>SELP.length?SELP.length+' مختار':(SYS.at?'دوّر':'الموقع'),0,'pre'],
 ['🖼️ صور الإدراج','🖼️','صور الإدراج',()=>IMC.length?IMC.length+' صورة':'مفيش',0,'pre'],
 ['🎨 الشكل','🎨','الشكل',()=>'لون وخط وإطار',0,'pre'],
 ['🪝 الهوكات','🪝','الهوكات',()=>S.hook?'متطبّق':HK.length+' هوك',0,'pre'],['٢) طريقة المونتاج','🛠️','الطريقة',()=>(TPL[S.tpl]&&TPL[S.tpl].n||'').replace(/^\S+\s*/,'').slice(0,14)||'اختار',0,'pre'],
 ['✍️ الكلام','✍️','الكلام',()=>D&&D.seg?D.seg.length+' جملة':'',0,'res'],
 ['🧾 اللي اتطبّق','🧾','المتطبّق',()=>'',0,'res'],
 ['🎞️ أماكن فيديوهات','📍','أماكن الإدراج',()=>BRL&&BRL.length?BRL.length+' مكان':'مفيش',0,'res'],
 ['🖼️ أماكن الصور','🖼️','أماكن الصور',()=>IML&&IML.length?IML.length+' مكان':'مفيش',0,'res'],
 ['🎬 المخرج الذكي','🎬','المخرج',()=>DIR.r&&DIR.k===dKey()?ar(String(DIR.r.score))+'/١٠٠':'راجع',0,'res'],
 ['📐 التوضيحات','📐','التوضيحات',()=>D&&D.ev?D.ev.filter(e=>e.on).length+' توضيح':'',0,'res']];
function tileify(){const root=$s('v-smart');if(!root||root.querySelector('.tl-g'))return;
 if(!document.getElementById('tl-css')){const st=document.createElement('style');st.id='tl-css';st.textContent=TILE_CSS;document.head.appendChild(st)}
 const cards=[...root.querySelectorAll('.p')].filter(c=>c.querySelector('h2')&&!c.parentElement.closest('.p'));
 const pre=[],res=[];TILES.forEach(T=>{const c=[...root.querySelectorAll('.p')].find(x=>{const h=x.querySelector('h2');return h&&h.textContent.trim().startsWith(T[0])&&!x.dataset.tl});if(c){c.dataset.tl='1';(T[5]==='res'?res:pre).push([T,c])}});
 if(!pre.length)return;
 const build=(items,anchor,inside)=>{const g=document.createElement('div');g.className='tl-g';const pn=document.createElement('div');pn.className='tl-p';
  items.forEach(([T,c])=>{const b=document.createElement('button');b.type='button';b.className='tl'+(T[4]?' w':'');b.innerHTML=T[4]?`<span class="ti">${T[1]}</span><span class="tx"><span class="tt">${T[2]}</span><span class="ts"></span></span>`:`<span class="ti">${T[1]}</span><span class="tt">${T[2]}</span><span class="ts"></span>`;
   b._c=c;b._s=T[3];pn.appendChild(c);g.appendChild(b)});
  g.onclick=e=>{const b=e.target.closest('.tl');if(!b)return;const open=b._c.classList.contains('tl-open');g.querySelectorAll('.tl').forEach(x=>{x.classList.remove('on');x._c.classList.remove('tl-open')});if(!open){b.classList.add('on');b._c.classList.add('tl-open');setTimeout(()=>b._c.scrollIntoView({behavior:'smooth',block:'nearest'}),30)}};
  if(inside)anchor.appendChild(g),anchor.appendChild(pn);else anchor.before(g),anchor.before(pn);return g};
 const goBtn=$s('sm_go'),g1=build(pre,goBtn,false);
 const sres=$s('sm_res'),g2=res.length&&sres?build(res,sres,true):null;
 const upd=()=>{[g1,g2].forEach(g=>g&&g.querySelectorAll('.tl').forEach(b=>{const s=b.querySelector('.ts');if(s){let v='';try{v=b._s()||''}catch(e){}s.textContent=v}}))};
 upd();clearInterval(window.__tlT);window.__tlT=setInterval(()=>{if(!document.body.contains(g1)){clearInterval(window.__tlT);return}if(document.visibilityState==='visible')upd()},1200)}

/* ---------- 🚀 أدوات احترافية: فحص قبل النشر + أقوى هوك + مدرّب الإيقاع + أفضل غلاف + معايرة الصوت (lib/montage/pro.ts) ---------- */
function proSegs(){return (D&&D.seg||[]).filter(g=>!(O('takes')&&g.cut))}
function proOut(h){const o=$s('sm_p_out');if(o)o.innerHTML=h}
function proUI(){const a=$s('sm_sc');if(!a||$s('sm_pro'))return;const box=document.createElement('div');box.id='sm_pro';box.className='p';box.style.marginTop='8px';
 box.innerHTML='<h2>🚀 أدوات احترافية</h2><div class="r2"><button class="b o" id="sm_p_qa">✅ فحص قبل النشر</button><button class="b o" id="sm_p_hk">🎣 أقوى هوك</button><button class="b o" id="sm_p_pc">⏱️ مدرّب الإيقاع</button><button class="b o" id="sm_p_cv">🖼️ أفضل غلاف تلقائي</button></div><div id="sm_p_out" class="mu" style="white-space:pre-line;margin-top:8px"></div>';a.after(box);
 const need=()=>{if(!D||!(D.seg||[]).length){say('اعمل التحليل الأول');return false}return true};
 $s('sm_p_qa').onclick=()=>{if(!need())return;const q=preflight({seg:proSegs(),outDur:outDur(),title:D.title,peak:D.peak,aspect:S.aspect,hasCap:O('cap')!=='none'});
  const ld=D.loud?'🔊 صوتك '+D.loud.db+' dB ← اتعدّل تلقائي ×'+D.loud.gain+' عشان يوصل للمستوى القياسي (−١٦)\n':'';
  proOut(esc(ld+q.ok.map(x=>'✅ '+x).concat(q.warn.map(x=>'⚠️ '+x)).join('\n')+'\n')+'<br>'+q.platforms.map(p=>'<span class="ch'+(p.fit?' on':'')+'">'+(p.fit?'✔ ':'✖ ')+esc(p.name)+'</span>').join(''))};
 $s('sm_p_hk').onclick=()=>{if(!need())return;const H=findHooks(proSegs());if(!H.length)return proOut('مفيش جملة قوية كفاية في أول الفيديو — جرّب سؤال أو رقم في الافتتاح');
  proOut('أقوى جمل تفتح بيها (دوس للاستخدام كعنوان الهوك):<br>'+H.map((h,i)=>'<div class="it"><div style="flex:1"><b>'+esc(h.text)+'</b><br><span class="mu">'+esc(h.why.join(' • '))+'</span></div><button class="b o" data-hk="'+i+'">استخدمها</button></div>').join(''));
  $s('sm_p_out').querySelectorAll('[data-hk]').forEach(b=>b.onclick=()=>{D.title=H[+b.dataset.hk].text.slice(0,42);try{changed()}catch(e){}say('✔ اتحطت كهوك أول ثانيتين')})};
 $s('sm_p_pc').onclick=()=>{if(!need())return;const p=paceReport(proSegs(),D.dur||outDur(),GAPS),mm=t=>fmt(t);
  proOut(esc('الإيقاع: '+ar(String(p.wps))+' كلمة/ثانية — سكوت '+ar(String(p.deadPct))+'٪'+(p.slow.length?'\nبطيء عند: '+p.slow.map(x=>mm(x[0])).join('، '):'')+(p.fast.length?'\nسريع عند: '+p.fast.map(x=>mm(x[0])).join('، '):'')+'\n'+(p.tips.length?p.tips.map(x=>'• '+x).join('\n'):'الإيقاع تمام 👌')))};
 $s('sm_p_cv').onclick=async()=>{if(!need()||!V)return;const C=coverCandidates(proSegs());if(!C.length)return say('مفيش لقطات كفاية');proOut('🔎 بدوّر على أحسن لقطة…');
  const cv=document.createElement('canvas'),w=72,h=Math.max(40,Math.round(72*(V.videoHeight||16)/(V.videoWidth||9)));cv.width=w;cv.height=h;const cx=cv.getContext('2d',{willReadFrequently:true});let best=C[0],bs=-1;
  for(const t of C){await new Promise(r=>{const d=()=>{V.removeEventListener('seeked',d);r()};V.addEventListener('seeked',d);V.currentTime=t;setTimeout(d,2000)});try{cx.drawImage(V,0,0,w,h);const sc=frameScore(cx.getImageData(0,0,w,h).data,w,h);if(sc>bs){bs=sc;best=t}}catch(e){}}
  proOut('✔ أحسن لقطة عند '+fmt(best)+' — بنزّلها…');await exportCover(best)}}
/* ---------- 🌍 الدفعة التانية: ١١ لمسة على الفيديو (بتتسجل في التصدير) + ٩ أدوات نشر (lib/montage/pro2.ts) ---------- */
if(!S.px||typeof S.px!=='object')S.px={};
const PXL=[['grain','🎞️','لمسة سينما','حبيبات + أطراف غامقة'],['grade','🎨','تلوين عالمي','ألوان أفلام'],['loop','🔁','نهاية لوب','الآخر بيدخل في الأول'],['head','📰','عنوان ثابت','العنوان فوق طول الوقت'],['follow','➕','تذكير متابعة','«تابعنا» في النص'],['leak','✨','ومضات ضوء','ضوء دافي مع القطع'],['punch','💥','كلمة الضربة','الكلمة القوية بتنط'],['beat','🥁','نبض الإيقاع','ومضة مع الموسيقى'],['ticker','📢','شريط متحرك','المحل والتليفون تحت'],['ribbon','🎗️','شريط ركن','«جديد» في الركن'],['safe','📱','مناطق الأمان','في المعاينة بس']];
const GRADES=[['teal','تيل وأورنج'],['gold','ذهبي دافي'],['matte','مات هادي'],['cool','بارد نضيف'],['vivid','حيوي']];
const PX=k=>!!(S.px&&S.px[k]);
let GRN=null;
function pxGrade(W,H){
 if(PX('grade')){const g=S.px.gradeK||'teal';CX.save();
  if(g==='teal'){CX.globalCompositeOperation='soft-light';CX.fillStyle='rgba(0,120,150,.38)';CX.fillRect(0,0,W,H);CX.globalCompositeOperation='soft-light';const gr=CX.createRadialGradient(W/2,H*.42,W*.1,W/2,H*.5,H*.7);gr.addColorStop(0,'rgba(255,150,70,.34)');gr.addColorStop(1,'rgba(255,150,70,0)');CX.fillStyle=gr;CX.fillRect(0,0,W,H)}
  else if(g==='gold'){CX.globalCompositeOperation='soft-light';CX.fillStyle='rgba(255,168,60,.42)';CX.fillRect(0,0,W,H)}
  else if(g==='matte'){CX.globalCompositeOperation='lighten';CX.fillStyle='rgb(30,28,32)';CX.fillRect(0,0,W,H);CX.globalCompositeOperation='soft-light';CX.fillStyle='rgba(150,135,120,.3)';CX.fillRect(0,0,W,H)}
  else if(g==='cool'){CX.globalCompositeOperation='soft-light';CX.fillStyle='rgba(70,140,255,.34)';CX.fillRect(0,0,W,H)}
  else{CX.globalCompositeOperation='overlay';CX.fillStyle='rgba(255,255,255,.07)';CX.fillRect(0,0,W,H);CX.globalCompositeOperation='saturation';CX.globalAlpha=.25;CX.fillStyle='hsl(0,100%,50%)';CX.fillRect(0,0,W,H)}
  CX.restore()}
 if(PX('grain')){CX.save();const vg=CX.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.hypot(W,H)*.58);vg.addColorStop(0,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.5)');CX.fillStyle=vg;CX.fillRect(0,0,W,H);
  if(!GRN){GRN=document.createElement('canvas');GRN.width=GRN.height=192;const g=GRN.getContext('2d'),im=g.createImageData(192,192);for(let i=0;i<im.data.length;i+=4){const v=Math.random()*255|0;im.data[i]=im.data[i+1]=im.data[i+2]=v;im.data[i+3]=255}g.putImageData(im,0,0)}
  CX.globalCompositeOperation='overlay';CX.globalAlpha=.09;const pt=CX.createPattern(GRN,'repeat');if(pt){CX.translate(Math.random()*192|0,Math.random()*192|0);CX.fillStyle=pt;CX.fillRect(-192,-192,W+384,H+384)}CX.restore()}}
/* ---------- جودة الصورة: شحذ احترافي + تقليل ضوضاء + تثبيت اهتزاز + ضبط ألوان تلقائي ---------- */
let GF=null,GB=null,EXRETRY=false,HQOFF={sharp:false,dn:false,clar:false,ema:0},SMPC=null,SMPT=-1,SMPD=null,PREVG=null,DNC=null,HPC=null,AUTO=null,STAB={px:0,py:0,sx:0,sy:0,t:-9,g:null};
function gateTick(){if(S.gate===false||S.clean===false||!V||!V._an||!V._gt)return;const an=V._an,b=GB&&GB.length===an.fftSize?GB:(GB=new Float32Array(an.fftSize));an.getFloatTimeDomainData(b);let sm=0;for(let i=0;i<b.length;i++)sm+=b[i]*b[i];const r=Math.sqrt(sm/b.length);GF=GF==null?r:(r<GF?GF+(r-GF)*.3:GF+(r-GF)*.004);const thr=Math.max(.003,GF*2.2);V._gt.gain.setTargetAtTime(r<thr?.3:1,V._ac.currentTime,.06)}
function smp(){const t=V.currentTime;if(SMPT===t&&SMPD)return SMPD;if(!SMPC){SMPC=document.createElement('canvas');SMPC.width=SMPC.height=48}const c=SMPC.getContext('2d',{willReadFrequently:true});c.drawImage(V,0,0,48,48);SMPD=c.getImageData(0,0,48,48).data;SMPT=t;return SMPD}
function stab(f,t){if(!S.stab||!V||!V.videoWidth)return [f.x,f.y,f.w,f.h];
 const d=smp(),g=new Float32Array(2304);for(let i=0;i<2304;i++)g[i]=d[i*4]*.3+d[i*4+1]*.59+d[i*4+2]*.11;const st=STAB,ct=V.currentTime;
 if(st.g&&ct!==st.t&&Math.abs(ct-st.t)<.2){let best=1e18,bx=0,by=0;for(let dy=-3;dy<=3;dy++)for(let dx=-3;dx<=3;dx++){let sm=0;for(let y=4;y<44;y+=2)for(let x=4;x<44;x+=2)sm+=Math.abs(g[y*48+x]-st.g[(y+dy)*48+x+dx]);if(sm<best){best=sm;bx=dx;by=dy}}
  st.px+=bx;st.py+=by;st.sx=st.sx*.92+st.px*.08;st.sy=st.sy*.92+st.py*.08}
 else if(Math.abs(ct-st.t)>=.2){st.px=st.py=st.sx=st.sy=0}
 st.g=g;st.t=ct;const k=1.09,w=f.w*k,h=f.h*k,mx=(w-f.w)/2*.9,my=(h-f.h)/2*.9,ox=Math.max(-mx,Math.min(mx,(st.px-st.sx)*f.w/48)),oy=Math.max(-my,Math.min(my,(st.py-st.sy)*f.h/48));
 return [f.x+f.w/2-w/2+ox,f.y+f.h/2-h/2+oy,w,h]}
function autoCol(W,H){const d=smp();let r=0,g=0,b=0,n=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];n++}r/=n;g/=n;b/=n;const l=r*.3+g*.59+b*.11;
 const A=AUTO=AUTO||{l,r,g,b};A.l+=(l-A.l)*.08;A.r+=(r-A.r)*.08;A.b+=(b-A.b)*.08;CX.save();
 if(A.l<90){CX.globalCompositeOperation='screen';CX.fillStyle='rgba(255,255,255,'+((90-A.l)/90*.2).toFixed(3)+')';CX.fillRect(0,0,W,H)}
 else if(A.l>175){CX.globalCompositeOperation='multiply';CX.fillStyle='rgba(60,60,60,'+((A.l-175)/80*.25).toFixed(3)+')';CX.fillRect(0,0,W,H)}
 const cast=A.r-A.b;if(Math.abs(cast)>12){CX.globalCompositeOperation='soft-light';CX.fillStyle=(cast>0?'rgba(90,150,255,':'rgba(255,170,90,')+Math.min(.35,Math.abs(cast)/255*1.2).toFixed(3)+')';CX.fillRect(0,0,W,H)}CX.restore()}
function denoise(W,H){const d=smp();let m=0;if(PREVG)for(let i=0;i<d.length;i+=16)m+=Math.abs(d[i]-PREVG[i]);m/=d.length/16;
 if(PREVG&&m<4&&DNC&&DNC.width===W&&DNC.height===H){CX.save();CX.globalAlpha=.22;CX.drawImage(DNC,0,0);CX.restore()}
 PREVG=new Uint8ClampedArray(d);if(!DNC)DNC=document.createElement('canvas');if(DNC.width!==W||DNC.height!==H){DNC.width=W;DNC.height=H}DNC.getContext('2d').drawImage(CV,0,0)}
function hqSharp(W,H){if(!S.sharp||HQOFF.sharp||!('filter' in CX))return;if(!HPC)HPC=document.createElement('canvas');if(HPC.width!==W||HPC.height!==H){HPC.width=W;HPC.height=H}
 const h=HPC.getContext('2d');h.globalAlpha=1;h.filter='none';h.drawImage(CV,0,0);h.filter='invert(1) blur('+Math.max(1,W/540).toFixed(2)+'px)';h.globalAlpha=.5;h.drawImage(CV,0,0);h.filter='none';h.globalAlpha=1;
 CX.save();CX.globalCompositeOperation='overlay';CX.globalAlpha=.55;CX.drawImage(HPC,0,0);CX.restore()}
const _al0=applyLook;applyLook=function(t,W,H){const h0=performance.now();try{if(V&&V.videoWidth&&CX){if(S.auto!==false)autoCol(W,H);if(S.dn!==false&&!HQOFF.dn)denoise(W,H)}}catch(e){}const r=_al0.apply(this,arguments);try{if(V&&V.videoWidth&&CX)hqSharp(W,H)}catch(e){}try{if(S.clar!==false&&!HQOFF.clar&&CX){CX.save();CX.globalCompositeOperation='soft-light';CX.globalAlpha=.22;CX.drawImage(CV,0,0);CX.restore()}}catch(e){}if(REC){HQOFF.ema=HQOFF.ema*.9+(performance.now()-h0)*.1;if(HQOFF.ema>30)HQOFF.sharp=true;if(HQOFF.ema>45)HQOFF.dn=true;if(HQOFF.ema>60)HQOFF.clar=true}return r};
const _al2=applyLook;applyLook=function(t,W,H){const r=_al2.apply(this,arguments);try{pxGrade(W,H)}catch(e){}return r};
let LOOPC=null,LOOPD=null,PWC=[],PWK=null,BEATS=[],BEATB=null;
const pxE=x=>x<0?0:x>1?1:x*x*(3-2*x),pxBack=x=>{x=x<0?0:x>1?1:x;const c=1.70158;return 1+(c+1)*Math.pow(x-1,3)+c*Math.pow(x-1,2)};
function pxRR(x,y,w,h,r){CX.beginPath();if(CX.roundRect)CX.roundRect(x,y,w,h,r);else CX.rect(x,y,w,h)}
function pxText(s,x,y,px,col,stroke,w){CX.font=(w||900)+' '+Math.round(px)+'px "'+FONTN()+'",Cairo,sans-serif';CX.textAlign='center';CX.textBaseline='middle';try{CX.direction='rtl'}catch(e){}if(stroke){CX.lineJoin='round';CX.lineWidth=px*.16;CX.strokeStyle=stroke;CX.strokeText(s,x,y)}CX.fillStyle=col;CX.fillText(s,x,y)}
function pxTop(t){const W=CV.width,H=CV.height,u=W/1080,o=outT(t),od0=outDur(),od=isFinite(od0)?od0:outT(D&&D.dur||0),ac=COL();
 if(PX('loop')){if(o<.08&&LOOPD!==D){LOOPC=LOOPC||document.createElement('canvas');LOOPC.width=W;LOOPC.height=H;LOOPC.getContext('2d').drawImage(CV,0,0);LOOPD=D}
  const L=.7;if(LOOPC&&LOOPD===D&&LOOPC.width===W&&o>od-L){CX.save();CX.globalAlpha=pxE((o-(od-L))/L);CX.drawImage(LOOPC,0,0,W,H);CX.restore()}}
 if(PX('leak')){let c=null;for(const x of CUTT){if(x<=t&&t-x<.55)c=x;if(x>t)break}if(c!=null){const p=(t-c)/.55,a=Math.sin(p*Math.PI)*.6;CX.save();CX.globalCompositeOperation='screen';const gx=W*(1.1-p*1.3),g=CX.createRadialGradient(gx,H*.3,10,gx,H*.3,W*.9);g.addColorStop(0,'rgba(255,190,110,'+a+')');g.addColorStop(.5,'rgba(255,110,60,'+(a*.45)+')');g.addColorStop(1,'rgba(255,80,40,0)');CX.fillStyle=g;CX.fillRect(0,0,W,H);CX.restore()}}
 if(PX('beat')&&MU.buf){if(BEATB!==MU.buf){BEATB=MU.buf;BEATS=beatsOf(MU.buf.getChannelData(0),MU.buf.sampleRate)}const mt=t%MU.buf.duration;let b=null;for(const x of BEATS){if(x>mt)break;if(mt-x<.2)b=x}if(b!=null){const p=(mt-b)/.2;CX.save();CX.globalCompositeOperation='screen';const g=CX.createRadialGradient(W/2,H/2,Math.min(W,H)*.38,W/2,H/2,Math.hypot(W,H)*.6);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,ac);CX.globalAlpha=.32*(1-p);CX.fillStyle=g;CX.fillRect(0,0,W,H);CX.restore()}}
 if(PX('punch')&&CAP.length){if(PWK!==CAP){PWK=CAP;PWC=punchWords(CAP)}const w=PWC.find(x=>t>=x.t&&t<x.t+.65);if(w){const p=(t-w.t)/.65,s=pxBack(p/.3)*(1+.05*Math.sin(p*40)*(1-p)),al=p>.75?1-(p-.75)/.25:1;CX.save();CX.globalAlpha=al;CX.translate(W/2,H*.4);CX.rotate(-.05);CX.scale(s,s);pxText(w.w,0,0,170*u,ac,'rgba(0,0,0,.9)');CX.restore()}}
 if(PX('head')&&D&&D.title){const st=S.hook&&S.hook.text?2.4:.25;if(o>st){const p=pxE((o-st)/.45);CX.save();CX.globalAlpha=p;CX.font='900 '+Math.round(50*u)+'px "'+FONTN()+'",Cairo,sans-serif';const tt=D.title.length>34?D.title.slice(0,33)+'…':D.title,tw=Math.min(W*.9,CX.measureText(tt).width+60*u),y=H*.115-(1-p)*40*u;CX.fillStyle='rgba(0,0,0,.66)';pxRR(W/2-tw/2,y-46*u,tw,92*u,22*u);CX.fill();CX.fillStyle=ac;CX.fillRect(W/2-tw/2+22*u,y+38*u,tw-44*u,6*u);pxText(tt,W/2,y,50*u,'#fff');CX.restore()}}
 if(PX('ribbon')){const tx=(S.px.ribbonT||'جديد').slice(0,14);CX.save();CX.translate(W,0);CX.rotate(Math.PI/4);CX.fillStyle=ac;CX.shadowColor='rgba(0,0,0,.4)';CX.shadowBlur=14*u;CX.fillRect(-W*.3,170*u,W*.6,84*u);CX.shadowBlur=0;pxText(tx,0,212*u,46*u,'#111');CX.restore()}
 if(PX('follow')){const at=od*.55;if(o>=at&&o<at+2.4){const p=o-at,s=pxBack(p/.35),al=p>2.1?(2.4-p)/.3:1,sh=(brand().shop||'ميكانيزم');CX.save();CX.globalAlpha=al;CX.translate(W/2,H*.6);CX.scale(s,s);CX.font='900 '+Math.round(52*u)+'px "'+FONTN()+'",Cairo,sans-serif';const lb='تابع '+sh+' ➕',tw=CX.measureText(lb).width+80*u;CX.fillStyle=ac;CX.shadowColor='rgba(0,0,0,.5)';CX.shadowBlur=24*u;pxRR(-tw/2,-52*u,tw,104*u,52*u);CX.fill();CX.shadowBlur=0;pxText(lb,0,2*u,52*u,'#111');CX.font=Math.round(84*u)+'px sans-serif';CX.fillText('👆',tw*.3,110*u+Math.abs(Math.sin(p*7))*-24*u);CX.restore()}}
 if(PX('ticker')){const b=brand(),tx=[b.shop,b.phone&&('📞 '+ar(b.phone)),b.addr&&('📍 '+b.addr),b.cta||'اطلب دلوقتي'].filter(Boolean).join('    •    ')+'    •    ',bh=66*u,y=H-bh-8*u;CX.save();CX.fillStyle='rgba(0,0,0,.74)';CX.fillRect(0,y,W,bh);CX.fillStyle=ac;CX.fillRect(0,y,W,5*u);CX.font='800 '+Math.round(36*u)+'px "'+FONTN()+'",Cairo,sans-serif';CX.textBaseline='middle';CX.textAlign='left';try{CX.direction='rtl'}catch(e){}const tw=Math.max(200,CX.measureText(tx).width),off=(o*150*u)%tw;CX.fillStyle='#fff';for(let x=-tw+off;x<W;x+=tw)CX.fillText(tx,x,y+bh/2+3*u);CX.restore()}
 if(PX('safe')&&!REC){CX.save();CX.fillStyle='rgba(255,40,60,.18)';CX.strokeStyle='rgba(255,80,90,.9)';CX.setLineDash([12*u,10*u]);CX.lineWidth=3*u;[[0,0,W,H*.085,'شريط التطبيق فوق'],[0,H*.8,W,H*.2,'الكابشن والأزرار تحت'],[W*.85,H*.42,W*.15,H*.38,'لايك/شير']].forEach(([x,y,w,h,l])=>{CX.fillRect(x,y,w,h);CX.strokeRect(x,y,w,h);CX.font='700 '+Math.round(26*u)+'px Cairo,sans-serif';CX.textAlign='center';CX.textBaseline='middle';CX.fillStyle='#fff';CX.fillText(l,x+w/2,y+h/2);CX.fillStyle='rgba(255,40,60,.18)'});CX.restore()}}
const _draw4=draw;draw=function(t){const r=_draw4.apply(this,arguments);try{if(CV&&CX&&V&&V.videoWidth)pxTop(t)}catch(e){}return r};
/* الأدوات */
const pxMerge=G=>{const s=G.map(g=>[g[0],g[1]]).sort((a,b)=>a[0]-b[0]),o=[];s.forEach(g=>{const l=o[o.length-1];if(l&&g[0]<=l[1])l[1]=Math.max(l[1],g[1]);else o.push(g)});return o};
function p2Out(h){const o=$s('sm_p2_out');if(o){o.innerHTML=h;o.scrollIntoView({behavior:'smooth',block:'nearest'})}}
function p2Copy(tx){try{navigator.clipboard.writeText(tx);say('✅ اتنسخ')}catch(e){say('انسخ يدوي')}}
async function bestFrameT(){const C=coverCandidates(proSegs());if(!C.length)return srcT(Math.min(2.5,outDur()/3));const cv=document.createElement('canvas'),w=72,h=Math.max(40,Math.round(72*(V.videoHeight||16)/(V.videoWidth||9)));cv.width=w;cv.height=h;const cx=cv.getContext('2d',{willReadFrequently:true});let best=C[0],bs=-1;
 for(const t of C){await new Promise(r=>{const d=()=>{V.removeEventListener('seeked',d);r()};V.addEventListener('seeked',d);V.currentTime=t;setTimeout(d,2000)});try{cx.drawImage(V,0,0,w,h);const sc=frameScore(cx.getImageData(0,0,w,h).data,w,h);if(sc>bs){bs=sc;best=t}}catch(e){}}return best}
async function titledCover(){const t=await bestFrameT();await new Promise(r=>{const d=()=>{V.removeEventListener('seeked',d);r()};V.addEventListener('seeked',d);V.currentTime=t;setTimeout(d,2000)});
 const W=1080,H=S.aspect==='916'?1920:Math.round(1080*(V.videoHeight||1920)/(V.videoWidth||1080)),c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d'),vw=V.videoWidth,vh=V.videoHeight,k=Math.max(W/vw,H/vh);x.drawImage(V,(W-vw*k)/2,(H-vh*k)/2,vw*k,vh*k);
 const g=x.createLinearGradient(0,H*.45,0,H);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,.85)');x.fillStyle=g;x.fillRect(0,H*.45,W,H*.55);
 const T=(D&&D.title)||'';x.textAlign='center';x.textBaseline='middle';try{x.direction='rtl'}catch(e){}const fs=104;x.font='900 '+fs+'px "'+FONTN()+'",Cairo,sans-serif';const ws=T.split(/\s+/),L=[];let cur='';ws.forEach(w=>{const n=cur?cur+' '+w:w;if(x.measureText(n).width>W*.86&&cur){L.push(cur);cur=w}else cur=n});if(cur)L.push(cur);const ln=L.slice(0,3),y0=H*.8-(ln.length-1)*fs*.62;
 ln.forEach((l,i)=>{const y=y0+i*fs*1.22;if(i===0){const tw=x.measureText(l).width+50;x.fillStyle=COL();x.fillRect((W-tw)/2,y-fs*.62,tw,fs*1.24);x.fillStyle='#111';x.fillText(l,W/2,y)}else{x.lineJoin='round';x.lineWidth=16;x.strokeStyle='rgba(0,0,0,.9)';x.strokeText(l,W/2,y);x.fillStyle='#fff';x.fillText(l,W/2,y)}});
 const lg=await officialLogo();if(lg){x.shadowColor='rgba(0,0,0,.4)';x.shadowBlur=16;x.drawImage(lg,36,36,170,170)}
 return await new Promise(r=>c.toBlob(b=>r(b),'image/jpeg',.93))}
const P2T=[['clips','✂️','أفضل مقاطع قصيرة'],['ret','📈','منحنى الاحتفاظ'],['fill','🧹','تقرير الحشو'],['titles','🏷️','عناوين بديلة'],['caps','📝','كابشن لكل منصة'],['shots','🎬','لقطات ناقصة'],['cover','🖼️','غلاف بعنوان'],['script','🗒️','سكريبت نضيف'],['pack','📦','حزمة النشر']];
const P2CSS=`#sm_pro2 .p2g{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 10px}#sm_pro2 .p2t{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:78px;padding:6px 3px;border:1px solid var(--ln);border-radius:14px;background:var(--sf2);color:var(--tx);font:800 12px var(--f);cursor:pointer;text-align:center;line-height:1.25}
#sm_pro2 .p2t i{font-style:normal;font-size:24px}#sm_pro2 .p2t small{font:600 10px var(--f);color:var(--mu)}#sm_pro2 .p2t.on{border-color:var(--a2);box-shadow:0 0 0 2px var(--a2) inset;background:color-mix(in srgb,var(--a2) 18%,var(--sf))}
#sm_pro2 .p2bar{display:flex;align-items:flex-end;gap:3px;height:120px;margin:8px 0;padding:0 2px;border-bottom:1px solid var(--ln)}#sm_pro2 .p2bar div{flex:1;border-radius:4px 4px 0 0;min-width:4px}
#sm_pro2 pre{white-space:pre-wrap;font:600 13px var(--f);background:var(--sf2);border-radius:10px;padding:10px;margin:6px 0;line-height:1.7}`;
function pro2UI(){const a=$s('sm_pro');if(!a||$s('sm_pro2'))return;if(!document.getElementById('p2-css')){const st=document.createElement('style');st.id='p2-css';st.textContent=P2CSS;document.head.appendChild(st)}
 const box=document.createElement('div');box.id='sm_pro2';box.className='p';
 box.innerHTML='<h2>✨ لمسات عالمية على الفيديو</h2><p class="mu" style="margin:0">بتظهر في المعاينة وبتتسجل في «💾 صدّر الفيديو» هنا على الجهاز.</p><div class="p2g" id="sm_p2_fx">'+PXL.map(x=>'<button type="button" class="p2t'+(PX(x[0])?' on':'')+'" data-px="'+x[0]+'"><i>'+x[1]+'</i>'+x[2]+'<small>'+x[3]+'</small></button>').join('')+'</div><div id="sm_p2_sub"></div><h2 style="margin-top:6px">🧰 أدوات النشر</h2><div class="p2g" id="sm_p2_tl">'+P2T.map(x=>'<button type="button" class="p2t" data-tl="'+x[0]+'"><i>'+x[1]+'</i>'+x[2]+'</button>').join('')+'</div><div id="sm_p2_out" class="mu"></div>';
 a.after(box);
 const sub=()=>{let h='';if(PX('grade'))h+='<div class="mu" style="margin-bottom:4px">نوع التلوين:</div><div>'+GRADES.map(g=>'<button type="button" class="ch'+((S.px.gradeK||'teal')===g[0]?' on':'')+'" data-gk="'+g[0]+'">'+g[1]+'</button>').join('')+'</div>';if(PX('ribbon'))h+='<label>كلمة الشريط<input id="sm_p2_rb" maxlength="14" value="'+esc(S.px.ribbonT||'جديد')+'"></label>';$s('sm_p2_sub').innerHTML=h;const rb=$s('sm_p2_rb');if(rb)rb.oninput=()=>{S.px.ribbonT=rb.value;saveS();if(V&&CV)draw(V.currentTime)}};sub();
 $s('sm_p2_sub').onclick=e=>{const b=e.target.closest('[data-gk]');if(!b)return;S.px.gradeK=b.dataset.gk;saveS();sub();if(V&&CV)draw(V.currentTime)};
 $s('sm_p2_fx').onclick=e=>{const b=e.target.closest('[data-px]');if(!b)return;const k=b.dataset.px;S.px[k]=!S.px[k];saveS();b.classList.toggle('on',!!S.px[k]);sub();if(k==='beat'&&S.px[k]&&!MU.buf)say('🥁 ارفع موسيقى الأول من «موسيقى ولوجو»');if(V&&CV)draw(V.currentTime)};
 const need=()=>{if(!D||!(D.seg||[]).length){say('اعمل التحليل الأول');return false}return true};
 $s('sm_p2_tl').onclick=async e=>{const b=e.target.closest('[data-tl]');if(!b||!need())return;const k=b.dataset.tl,sg=proSegs(),od0=outDur(),od=isFinite(od0)?od0:outT(D.dur||0);
  if(k==='clips'){const C=bestClips(sg,D.dur||(V&&V.duration)||od);if(!C.length)return p2Out('الفيديو قصير — مفيش مقاطع أقصر منه');
   p2Out('أحسن مقطع لكل طول (كله من كلامك):'+C.map((c,i)=>'<div class="it"><div><b>'+ar(c.len)+' ثانية</b> — من '+fmt(c.s)+' لـ '+fmt(c.e)+'<br><span class="mu">«'+esc(c.first.slice(0,60))+'»</span></div><button class="b o" data-cj="'+i+'">👁️</button><button class="b" data-cx="'+i+'">🎬 صدّره</button></div>').join(''));
   $s('sm_p2_out').onclick=async ev=>{const j=ev.target.closest('[data-cj]'),x=ev.target.closest('[data-cx]');if(j){const c=C[+j.dataset.cj];V.currentTime=c.s;setTimeout(()=>draw(V.currentTime),300);$s('sm_cv').scrollIntoView({behavior:'smooth'})}
    if(x){const c=C[+x.dataset.cx],dur=V.duration||D.dur,save=GAPS;GAPS=pxMerge([...save,[0,Math.max(0,c.s)],[Math.min(dur,c.e),dur+1]]);try{await exportVid()}finally{GAPS=save;draw(V.currentTime)}}}}
  else if(k==='ret'){const B=retention(sg,od,outT),mx=100;p2Out('النسبة المتوقعة اللي هتكمل تتفرج (تقدير من الإيقاع والجذب):<div class="p2bar">'+B.map(x=>'<div title="'+fmt(x.s)+'" style="height:'+Math.max(4,x.v/mx*100)+'%;background:'+(x.v>=55?'var(--a2)':x.v>=30?'#ff9f43':'#ff5d5d')+'"></div>').join('')+'</div>'+B.filter(x=>x.why).slice(0,6).map(x=>'• '+fmt(x.s)+' — '+esc(x.why)+' ('+ar(x.v)+'٪)').join('<br>')+'<br><b>آخر الفيديو: ~'+ar(B.length?B[B.length-1].v:0)+'٪</b>')}
  else if(k==='fill'){const r=fillerReport(D.seg||[],(D.dur||od)/60);p2Out('<pre>'+esc((Object.keys(r.counts).length?Object.entries(r.counts).sort((a,b)=>b[1]-a[1]).map(([w,n])=>'«'+w+'» × '+ar(n)).join('   '):'مفيش كلمات حشو تقريبًا')+'\n\n'+r.tips.map(x=>'• '+x).join('\n'))+'</pre>')}
  else if(k==='titles'){const L=titleIdeas(sg,D.title||'',brand().shop);p2Out(L.map((x,i)=>'<div class="it"><div><b>'+esc(x)+'</b></div><button class="b o" data-ti="'+i+'">استخدمه</button></div>').join(''));$s('sm_p2_out').onclick=ev=>{const q=ev.target.closest('[data-ti]');if(!q)return;D.title=L[+q.dataset.ti];const ti=$s('sm_ti');if(ti)ti.value=D.title;try{changed()}catch(x){}say('✔ اتغيّر العنوان')}}
  else if(k==='caps'){const C=platformCaptions(sg,D.title||'',brand()),N={tt:'تيك توك',ig:'إنستجرام',fb:'فيسبوك',yt:'يوتيوب'};p2Out(Object.keys(N).map(q=>'<div style="margin-top:8px"><b>'+N[q]+'</b> <button class="b o" data-cp="'+q+'" style="padding:2px 12px;min-height:30px">نسخ</button><pre>'+esc(C[q])+'</pre></div>').join(''));$s('sm_p2_out').onclick=ev=>{const q=ev.target.closest('[data-cp]');if(q)p2Copy(C[q.dataset.cp])}}
  else if(k==='shots'){const L=shotList(sg,outT);p2Out('صوّر اللقطات دي وضيفها كـ«فيديوهات إدراج» عشان الفيديو يبقى أغنى:<br>'+L.map(x=>'🎥 '+fmt(x.at)+' — '+esc(x.shot)).join('<br>'))}
  else if(k==='cover'){p2Out('🔎 بدوّر على أحسن لقطة وبحط العنوان واللوجو…');const bl=await titledCover();if(!bl)return p2Out('ماقدرتش أعمل الغلاف');const f=new File([bl],'غلاف-'+((D.title||'ميكانيزم').slice(0,20))+'.jpg',{type:'image/jpeg'}),u=URL.createObjectURL(bl);p2Out('<img src="'+u+'" style="width:100%;max-width:320px;border-radius:12px;display:block;margin:6px auto"><button class="b" id="sm_p2_cs" style="width:100%">📤 شارك / احفظ</button>');$s('sm_p2_cs').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files:[f]})){await navigator.share({files:[f]});return}}catch(x){if(x&&x.name==='AbortError')return}dlBlob(bl,f.name)}}
  else if(k==='script'){const h=findHooks(sg)[0],tx=cleanScript(sg,h&&h.text,brand().cta||'اطلب دلوقتي');p2Out('السكريبت من غير حشو ولا إعادات، والهوك الأقوى في الأول — اقراه قبل الفيديو الجاي:<pre>'+esc(tx)+'</pre><button class="b o" id="sm_p2_sc">نسخ</button>');$s('sm_p2_sc').onclick=()=>p2Copy(tx)}
  else if(k==='pack'){p2Out('📦 بجهّز الغلاف والكابشن والترجمة…');const bl=await titledCover(),C=platformCaptions(sg,D.title||'',brand()),nm=(D.title||'ميكانيزم').slice(0,20).replace(/[\/:*?"<>|]+/g,'-');
   const files=[bl&&new File([bl],nm+'-غلاف.jpg',{type:'image/jpeg'}),new File(['تيك توك:\n'+C.tt+'\n\nإنستجرام:\n'+C.ig+'\n\nفيسبوك:\n'+C.fb+'\n\nيوتيوب:\n'+C.yt+'\n'],nm+'-كابشن.txt',{type:'text/plain'}),new File(['﻿'+toSrt(CAP,outT)],nm+'.srt',{type:'application/x-subrip'})].filter(Boolean);
   p2Out('✅ الحزمة جاهزة: غلاف + كابشن ٤ منصات + ترجمة SRT <button class="b" id="sm_p2_pk" style="width:100%;margin-top:6px">📤 شارك / نزّل الحزمة</button>');$s('sm_p2_pk').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files})){await navigator.share({files});return}}catch(x){if(x&&x.name==='AbortError')return}files.forEach(f=>dlBlob(f,f.name))}}}}

/* ---------- 📌 معاينة ثابتة فوق: تختار أي شكل/قالب/لمسة وتشوفها قدامك من غير ما تطلع وتنزل ---------- */
const STK_CSS=`#sm_stk{display:none;position:sticky;top:env(safe-area-inset-top,0px);z-index:7;background:var(--bg);padding:6px 0 8px;margin:0 0 8px;border-bottom:1px solid var(--ln);text-align:center}
#sm_stk.on{display:block}#sm_stk #sm_cv{width:auto!important;max-width:100%!important;height:36vh!important;max-height:none!important;margin:0 auto;border-radius:12px;box-shadow:0 6px 24px rgba(0,0,0,.45)}
#sm_stk>div{margin-top:6px!important}#sm_stk .b{min-height:40px;padding:4px 12px}
@media(min-width:960px){#sm_stk #sm_cv{height:52vh!important}}`;
function stkPrev(){const root=$s('v-smart'),cv=$s('sm_cv');if(!root||!cv)return;
 if(!document.getElementById('stk-css')){const st=document.createElement('style');st.id='stk-css';st.textContent=STK_CSS;document.head.appendChild(st)}
 if(!$s('sm_stk')){const row=cv.nextElementSibling,card=cv.closest('.p'),w=document.createElement('div');w.id='sm_stk';
  const anchor=root.querySelector('.tl-g')||$s('sm_go');if(!anchor)return;anchor.before(w);w.appendChild(cv);if(row)w.appendChild(row);
  if(card){const h=card.querySelector('h2');if(h)h.textContent='٣) التصدير والأدوات'}}
 const show=()=>{const w=$s('sm_stk');if(!w){clearInterval(window.__stkT);return}w.classList.toggle('on',!!(D&&V&&CV))};show();clearInterval(window.__stkT);window.__stkT=setInterval(show,500)}
const _paint1=paint;paint=function(){const r=_paint1.apply(this,arguments);try{hkUI();tileify();brPosUI();proUI();pro2UI();stkPrev()}catch(e){console.warn('tiles',e)}return r};const _sc1=setupCanvas;setupCanvas=function(){const r=_sc1.apply(this,arguments);try{brDragWire()}catch(e){}return r};
window.mkzSmart={draw:t=>draw(t),state:()=>({S,D,CAP,EV,GAPS,STK,CTA,FXL,FX2,STEPS,CNT,V,BRL:typeof BRL!=='undefined'?BRL:null,IML:typeof IML!=='undefined'?IML:null,PIL:typeof PIL!=='undefined'?PIL:null,IMC:typeof IMC!=='undefined'?IMC:null,IMAI:typeof IMAI!=='undefined'?IMAI:null}),_test:{sysSearch,sysState:()=>({SYS:{on:!!SYS.at,user:SYS.user},SELP,SRES,SITEB,site:!!SITE}),dirSet:r=>{DIR.r=r;DIR.k=dKey();r.cuts.forEach(c=>c.on=true);dirPaint()},dirApplyCuts,dirHook,setEn:m=>{D.en=m;TRS.k=dKey()},drawEn,qrText,oneTap,computePI,imApply:ms=>{imApply(ms);IMAI.sig=imSig();computeImg()},imMatch,computeImg,addImgFiles,build,showScore,copyChapters,scoreVideo,wav64,splitPoints,mergeAI,headAt,setD:d=>{D=d},setV:v=>{V=v},setS:x=>{Object.assign(S,x);if(!TPL[S.tpl])S.tpl='pro';if(!S.o||typeof S.o!=='object')S.o={}},setup:setupCanvas,exportVid,
 /* العامل السحابي: بيدوّر على مكان الشخص في الفريمات قبل الرسم (لو الاختيار شغال) */
 /* أوقات الأصوات في الفيديو النهائي: «بوب» مع الكروت والملصقات و«ووش» مع عناوين الأقسام والنداء */
 animList:()=>animList(),setDsl:m=>{D.dsl=Object.assign(D.dsl||{},m||{})},
 sfx:()=>{if(!O('sfx'))return [];const L=[];EV.forEach(e=>{if(!showEv(e))return;L.push({t:outT(e.s),k:e.type==='topic'||e.type==='anim'?'whoosh':'pop'});if(e.type==='anim'&&(e.action==='break'||e.action==='compare'))L.push({t:outT(e.s+.45*(e.e-e.s)),k:'pop'})});STK.forEach(x=>L.push({t:outT(x.s),k:'pop'}));if(CTA)L.push({t:outT(CTA.s),k:'whoosh'});
  return L.filter(x=>x.t>.2).sort((a,b)=>a.t-b.t).filter((x,i,a)=>!i||x.t-a[i-1].t>.25).slice(0,90)},
 wantPeople:()=>!!S.smart&&!(D&&D.people),detect:async(times,frame)=>{try{D.people=await detectPeople(times,frame);return D.people.filter(x=>!x.none).length}catch(e){console.warn('pose',e&&e.message);return -1}}}};
})();

}
