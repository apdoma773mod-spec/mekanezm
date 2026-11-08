// اختبار الأدوات الاحترافية الخمسة (lib/montage/pro.ts) على بيانات حقيقية/اصطناعية.
const fs=require('fs'),path=require('path'),{pathToFileURL}=require('url');let bad=0;const ok=(c,m)=>{console.log(c?'✔':'✖',m);if(!c)bad++};
(async()=>{
 const P=await import(pathToFileURL(path.join(__dirname,'../lib/montage/pro.ts')).href),V=await import(pathToFileURL(path.join(__dirname,'../lib/montage/vad.ts')).href);
 // ١) معايرة الصوت على الملف الحقيقي
 const wav=fs.readFileSync(path.join(__dirname,'../worker-local/_test.wav'));let off=12,data;while(off<wav.length-8){const id=wav.toString('ascii',off,off+4),sz=wav.readUInt32LE(off+4);if(id==='data'){data=wav.subarray(off+8,off+8+sz);break}off+=8+sz}
 const f=new Float32Array(data.length/2);for(let k=0;k<f.length;k++)f[k]=data.readInt16LE(k*2)/32768;
 const sp=V.vad(f),L=P.loudGain(f,sp);console.log('  صوت الملف',L.db,'dB → ×'+L.gain);
 ok(L.db<0&&L.db>-60&&L.gain>=0.6&&L.gain<=4,'loudGain في الحدود');
 const quiet=f.map(x=>x*.25),Lq=P.loudGain(quiet,sp);ok(Lq.gain>L.gain||L.gain===4,'الصوت الواطي بيتكبّر أكتر');
 const after=P.speechRmsDb(f.map(x=>Math.max(-1,Math.min(1,x*L.gain))),sp);ok(Math.abs(after-(-16))<3||L.gain===4||L.gain===0.6,'بعد التكبير قريب من −١٦ ('+after.toFixed(1)+')');
 // ٢) الهوك
 const seg=[{s:0,e:3,t:'النهارده هنتكلم عن حاجة'},{s:3,e:6,t:'ليه الدرج الصامت أحسن من العادي؟'},{s:6,e:9,t:'سعره ٣٥٠ جنيه بس'},{s:9,e:12,t:'شكرا'}];
 const H=P.findHooks(seg);console.log('  أقوى هوك:',H[0]&&H[0].text);ok(H.length>0&&H[0].i===1,'السؤال بكلمة جذب هو الأقوى');
 // ٣) الإيقاع
 const pc=P.paceReport([{s:0,e:10,t:'كلمتين بس'},{s:10,e:12,t:'ده كلام فيه كلمات كتير جدا جدا جدا جدا جدا جدا جدا جدا جدا'}],30,[[12,30]]);console.log('  ',JSON.stringify(pc));ok(pc.slow.length===1&&pc.fast.length===1,'بطيء وسريع اتكشفوا');
 // ٤) الغلاف: لقطة حادة vs مطموسة
 const W=40,Hh=40,mk=fn=>{const a=new Uint8ClampedArray(W*Hh*4);for(let i=0;i<W*Hh;i++){const v=fn(i%W,(i/W)|0);a[i*4]=a[i*4+1]=a[i*4+2]=v;a[i*4+3]=255}return a};
 const sharp=P.frameScore(mk((x,y)=>((x>>2)+(y>>2))%2?200:60),W,Hh),blur=P.frameScore(mk(()=>128),W,Hh),dark=P.frameScore(mk((x,y)=>((x>>2)+(y>>2))%2?30:5),W,Hh);
 ok(sharp>blur*10&&sharp>dark,'الحادة أعلى من المطموسة والمظلمة');
 ok(P.coverCandidates(Array.from({length:30},(_,i)=>({s:i+1,e:i+2,t:'x'}))).length===9,'٩ مرشحين موزعين');
 // ٥) فحص النشر
 const q=P.preflight({seg:[{s:0,e:1,t:'كلام كتير جدا جدا في ثانية واحدة بس'},{s:1,e:3,t:'تمام'}],outDur:100,title:'ا'.repeat(50),peak:.99,aspect:'169'});console.log('  warn:',q.warn.length,'platforms ok:',q.platforms.filter(p=>p.fit).map(p=>p.id).join(','));
 ok(q.warn.length>=4&&q.platforms.find(p=>p.id==='tt').fit&&!q.platforms.find(p=>p.id==='yts').fit,'التحذيرات والمنصات صح');
 const good=P.preflight({seg:[{s:0,e:3,t:'كلام عادي مريح'},{s:3,e:6,t:'جملة تانية'}],outDur:40,title:'عنوان تمام',peak:.5,aspect:'916'});ok(good.warn.length===0,'فيديو سليم من غير تحذيرات');
 process.exit(bad?1:0)})();
