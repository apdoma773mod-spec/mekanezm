/* ميكانيكس — اختيار المجال: أيقونات + أقسام + وحدات + أصناف جاهزة حسب نشاط المحل */
(function(){
const I=(id,icon,name,cats,units,items,hint)=>({id,icon,name,cats,units,items,hint});
const IND=[
I('auto','🚗','قطع غيار سيارات',['زيوت وسوائل','فلاتر','فرامل','بوجيهات وكهرباء','بطاريات','إطارات وجنوط','إكسسوارات سيارات','عفشة ومساعدين'],['قطعة','علبة','لتر','طقم','كرتونة'],
 ['زيت محرك 5W-30 (لتر)','زيت فتيس','فلتر زيت','فلتر هواء','فلتر بنزين','طقم تيل فرامل أمامي','طقم بوجيهات','بطارية 12 فولت','مساعد أمامي','ماء راديتر (جركن)'],'سيارات'),
I('plumb','🚿','أدوات صحية وسباكة',['خلاطات','محابس وصمامات','مواسير وأكواع','أحواض وقواعد','سخانات','مضخات','لوازم حمامات'],['قطعة','متر','طقم','كرتونة','لفة'],
 ['خلاط حوض','خلاط دش','محبس 1/2 بوصة','ماسورة 1 بوصة (متر)','كوع 90','شطاف','سيفون','وصلة مرنة','شريط تفلون','سخان كهرباء 50 لتر'],'سباكة'),
I('stove','🔥','بوتاجازات وأجهزة منزلية',['بوتاجازات','سخانات غاز','قطع غيار بوتاجاز','شعلات ومحابس','خراطيم وأنابيب','أجهزة صغيرة'],['قطعة','طقم','كرتونة','متر'],
 ['شعلة بوتاجاز كبيرة','شعلة صغيرة','مفتاح تشغيل بوتاجاز','ولاعة بوتاجاز','بوجيه','صمام أمان','خرطوم غاز (متر)','منظم غاز','صينية فرن','لمبة فرن'],'بوتاجاز'),
I('fabric','🧵','أقمشة وستائر',['ستائر','أقمشة مفروشات','تل وشيفون','بلاك آوت','إكسسوارات ستائر','سكك وقضبان'],['متر','رول','قطعة','طقم','لفة'],
 ['قماش ستارة (متر)','تل أبيض (متر)','بلاك آوت (متر)','شريط ستائر (متر)','حلقات ستائر','سكة ستائر (متر)','كلبسات','حبل ربط','زيل كرنيش','بطانة (متر)'],'أقمشة'),
I('grocery','🛒','بقالة وسوبر ماركت',['مواد غذائية','مشروبات','ألبان وأجبان','معلبات','منظفات','حلويات وسناكس'],['قطعة','كيلو','كرتونة','عبوة','لتر'],
 ['سكر (كيلو)','أرز (كيلو)','زيت طعام (لتر)','مكرونة','شاي','معجون طماطم','مياه معدنية','مسحوق غسيل','صابون','عصير'],'بقالة'),
I('kitchen','🍳','إكسسوارات مطابخ ودريسنج',['مفصلات','سحابات وأدراج','مقابض','وحدات ومشايات','إضاءة','ألمنيوم وقطاعات','خردوات'],['قطعة','طقم','زوج','متر','كرتونة'],
 ['مفصلة هيدروليك','سحاب درج','مقبض ستانلس','شمعة LED','قطاع ألمنيوم (متر)','رف سلك','ممسحة مطبخ','حامل أطباق'],'مطابخ'),
I('electric','💡','كهرباء وإضاءة',['كابلات وأسلاك','مفاتيح وبرايز','لمبات ولد','قواطع وطبلونات','إنارة خارجية','أجهزة كهربائية'],['قطعة','متر','لفة','كرتونة','علبة'],
 ['كابل 2.5 مم (لفة)','لمبة LED 12 وات','مفتاح فردي','بريزة','قاطع 20 أمبير','شريط عازل','فيشة','وصلة كهرباء','سبوت لايت','كشاف LED'],'كهرباء'),
I('tools','🔧','عدد ومعدات يدوية',['عدد يدوية','عدد كهربائية','مفكات ومفاتيح','مثاقب وأزاميل','قياس وتسوية','أمان وسلامة'],['قطعة','طقم','علبة','كرتونة'],
 ['شاكوش','مفتاح إنجليزي','طقم مفكات','متر قياس','مثقاب كهرباء','عدة تفريغ','ميزان مياه','كماشة','زرادية','خوذة أمان'],'عدد'),
I('paint','🎨','دهانات ومواد بناء',['دهانات','معجون وتأسيس','فرش ورولات','أدوات بناء','أسمنت ولياسة','عوازل'],['علبة','جركن','كيس','قطعة','متر'],
 ['دهان بلاستيك (جركن)','معجون جاهز','سيلر تأسيس','رولة دهان','فرشاة','سيليكون','كيس أسمنت','عازل مائي','ورق صنفرة','شريط لاصق'],'دهانات'),
I('clothes','👕','ملابس وأزياء',['رجالي','حريمي','أطفال','أحذية','إكسسوارات','ملابس داخلية'],['قطعة','زوج','دستة'],
 ['تيشيرت','بنطلون جينز','قميص','فستان','حذاء','شنطة','حزام','جاكيت','شراب (زوج)','طقم أطفال'],'ملابس'),
I('pharmacy','💊','صيدلية ومستحضرات',['أدوية','فيتامينات','عناية بالبشرة','أطفال ورضع','مستلزمات طبية','أجهزة قياس'],['علبة','شريط','زجاجة','قطعة','عبوة'],
 ['مسكن','مضاد حيوي','فيتامين سي','كريم مرطب','محلول ملحي','شاش وقطن','ميزان حرارة','جهاز ضغط','حفاضات','لبن أطفال'],'صيدلية'),
I('phone','📱','موبايلات وإكسسواراتها',['موبايلات','شواحن وكابلات','سماعات','جرابات وحمايات','باور بانك','قطع غيار موبايل'],['قطعة','علبة','كرتونة'],
 ['شاحن سريع','كابل Type-C','سماعة بلوتوث','جراب موبايل','سكرينة حماية','باور بانك 10000','فلاشة 64 جيجا','كارت ميموري','شاشة موبايل','بطارية موبايل'],'موبايلات'),
I('furniture','🛋️','أثاث ومفروشات',['غرف نوم','أنتريهات','سفرة','مراتب','سجاد وموكيت','ديكور'],['قطعة','طقم','متر','رول'],
 ['سرير','دولاب','مرتبة','كنبة','ترابيزة سفرة','كرسي','سجادة (متر)','موكيت (متر)','مرآة','وسادة'],'أثاث'),
I('stationery','📚','مكتبة وأدوات مكتبية',['كراريس وورق','أقلام','حقائب','أدوات هندسية','كتب','هدايا'],['قطعة','دستة','رزمة','علبة','كرتونة'],
 ['كراسة 80 ورقة','قلم جاف (دستة)','ورق A4 (رزمة)','حقيبة مدرسية','ألوان خشب','دباسة','ملف شفاف','ممحاة','مسطرة','لاصق ورق'],'مكتبة'),
I('other','🏪','نشاط آخر (فاضي)',['عام'],['قطعة','كرتونة','متر','كيلو','لتر','علبة'],[],'عام')
];
const get=id=>IND.find(x=>x.id===id)||null;
const cur=()=>{try{return get(localStorage.getItem('mk_industry'))}catch(e){return null}};
const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.mkSB||(typeof SBc==='function'?SBc():null);

/* CSS صغير للشبكة */
const st=document.createElement('style');
st.textContent='.indG{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:8px 0;max-height:46vh;overflow:auto}.indG button{border:2px solid #d5dde0;background:#fff;border-radius:14px;padding:10px 4px;font:inherit;font-size:12.5px;font-weight:700;color:#17363b;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px}.indG button b{font-size:28px;line-height:1}.indG button.on{border-color:#087f8c;background:#e6f4f5}';
document.head.appendChild(st);

function grid(sel){return '<div class="indG" id="indG">'+IND.map(x=>`<button type="button" data-i="${x.id}" class="${x.id===sel?'on':''}"><b>${x.icon}</b>${H(x.name)}</button>`).join('')+'</div>'}
function bindGrid(onPick){document.querySelectorAll('#indG button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#indG button').forEach(x=>x.classList.remove('on'));b.classList.add('on');onPick(b.dataset.i)})}

/* شاشة حساب جديد */
function signup(){
 if(typeof mkT_showWho!=='function')return;let pick='';
 mkT_showWho(`<div class="mkbox" style="margin:auto"><h2>حساب جديد</h2><p>اختار مجال شغلك والسيستم يتظبط عليه</p>
 <input id="sgShop" placeholder="اسم المحل"><input id="sgPhone" type="tel" inputmode="tel" placeholder="رقم الموبايل">
 <input id="sgEmail" type="email" placeholder="الإيميل" autocomplete="username"><input id="sgPass" type="password" placeholder="كلمة السر (٦ حروف أو أكتر)" autocomplete="new-password">
 <p style="margin:10px 0 0;font-weight:700">مجال المحل:</p>${grid('')}
 <div id="sgMsg" style="margin:8px 0;padding:10px;border-radius:10px;font-weight:700;display:none"></div>
 <button type="button" id="sgGo">إنشاء الحساب</button><button type="button" class="alt" style="margin-top:8px" onclick="mkT_email()">عندي حساب — دخول</button></div>`);
 const w=document.getElementById('mkWho');if(w){w.style.overflowY='auto';w.style.alignItems='flex-start';w.scrollTop=0}
 bindGrid(i=>pick=i);
 const msg=(t,ok)=>{const m=document.getElementById('sgMsg');m.style.display='block';m.style.background=ok?'#dff3e6':'#fbe1de';m.style.color=ok?'#1f8a4c':'#c0392b';m.textContent=t;m.scrollIntoView({block:'center',behavior:'smooth'});if(typeof toast==='function')try{toast(t)}catch(x){}};
 const v=id=>document.getElementById(id).value.trim();
 document.getElementById('sgGo').onclick=async()=>{
  const b=document.getElementById('sgGo');
  try{
   if(!v('sgShop')||!v('sgEmail')||v('sgPass').length<6)return msg('اكتب اسم المحل والإيميل وكلمة سر ٦ حروف على الأقل');
   if(!pick)return msg('اختار مجال المحل من الأيقونات');
   if(!sb())return msg('مفيش نت — لازم نت عشان تسجّل');
   b.disabled=true;msg('جاري إنشاء الحساب…',true);
   const r=await sb().auth.signUp({email:v('sgEmail'),password:v('sgPass'),options:{data:{shop:v('sgShop'),phone:v('sgPhone'),industry:pick}}});
   if(r.error){b.disabled=false;const t=String(r.error.message||'');
    return msg(/registered|already/i.test(t)?'الإيميل ده مسجل قبل كده — ادخل بيه':/password/i.test(t)?'كلمة السر ضعيفة — خليها ٦ حروف أو أكتر':/invalid/i.test(t)?'الإيميل مكتوب غلط':/rate|seconds/i.test(t)?'استنى دقيقة وجرّب تاني':'مشكلة في التسجيل: '+t)}
   try{localStorage.setItem('mk_industry',pick)}catch(x){}
   if(r.data&&r.data.session){msg('✔ اتعمل الحساب — جاري الدخول…',true);setTimeout(()=>location.reload(),900)}
   else{b.disabled=false;msg('✔ اتعمل الحساب — افتح الإيميل واضغط رابط التأكيد، وبعدها ارجع ادخل',true)}
  }catch(x){b.disabled=false;msg('حصلت مشكلة: '+(x&&x.message||x))}
 }
}

/* تغيير المجال من الإعدادات (للمدير) */
function change(){
 if(typeof openModal!=='function')return;let c=cur();let pick=c?c.id:'';
 openModal(`<div class="modal-head"><h2>🏪 مجال المحل</h2><button class="close" onclick="closeModal()">✕</button></div><p>اختار مجالك — هتظهر الأقسام والوحدات المناسبة، وتقدر تضيف أصناف جاهزة.</p>${grid(pick)}<label style="display:flex;gap:8px;margin:8px 0"><input type="checkbox" id="indSeed" checked> ضيف أقسام وأصناف جاهزة للمجال ده</label><button class="primary" id="indOk" type="button">حفظ</button>`);
 bindGrid(i=>pick=i);
 document.getElementById('indOk').onclick=async()=>{if(!pick)return;const seed=document.getElementById('indSeed').checked;await save(pick,seed);closeModal();if(typeof toast==='function')toast('✔ اتظبط على مجال: '+get(pick).name);if(seed)setTimeout(()=>location.reload(),600)}
}

async function save(id,seed){
 try{localStorage.setItem('mk_industry',id)}catch(e){}
 const c=sb();if(!c)return;
 await c.from('mk_settings').upsert([{key:'industry',value:{id,applied:!!seed,at:new Date().toISOString()}}],{onConflict:'key'});
 if(seed)await seedProducts(id)
}
async function seedProducts(id){
 const x=get(id);if(!x||!x.items.length)return;const c=sb();
 const ex=await c.from('mk_products').select('name');const have=new Set((ex.data||[]).map(r=>r.name));
 const pre=id.slice(0,2).toUpperCase();
 const rows=x.items.filter(n=>!have.has(n)).map((n,i)=>({code:pre+String(i+1).padStart(3,'0'),name:n,cat:x.cats[i%x.cats.length],unit:x.units[0],qty:0,price:0,min:5}));
 if(rows.length)await c.from('mk_products').insert(rows)
}

/* بعد الدخول: لو الحساب جديد وفيه مجال في بيانات التسجيل، يتطبق مرة واحدة */
async function after(role){
 const c=sb();if(!c)return;
 try{
  const r=await c.from('mk_settings').select('value').eq('key','industry').maybeSingle();let v=r.data&&r.data.value;
  if(!v&&role==='admin'){
   const u=(await c.auth.getUser()).data.user,m=u&&u.user_metadata&&u.user_metadata.industry;
   if(m&&get(m)){await save(m,true);v={id:m,applied:true}}
  }
  if(v&&v.id){try{localStorage.setItem('mk_industry',v.id)}catch(e){}}
 }catch(e){console.warn('industry',e)}
}

window.mkInd={list:IND,get,cur,signup,change,after,
 defCat:()=>{const c=cur();return c?c.cats[0]:'إكسسوارات مطابخ'},
 cats:()=>{const c=cur();return c?c.cats:[]},
 units:d=>{const c=cur();return c?[...new Set(c.units.concat(d))]:d}};
})();
