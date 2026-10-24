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
/* دمج مكتبة الأصناف الجاهزة (industry-data.js) */
const CAT_ICON={};
IND.forEach(x=>{const d=(window.MK_CAT||{})[x.id];x.noun='الأصناف';x.tip='';x.quick=['find','purchase','count','daybook','debts'];x.catData=[];
 if(!d)return;x.noun=d.noun||x.noun;x.tip=d.tip||'';x.quick=d.quick||x.quick;
 x.catData=d.cats.map(c=>({name:c[0],icon:c[1],unit:c[2],items:c[3].split(',').map(t=>t.trim()).filter(Boolean)}));
 if(x.catData.length){x.cats=x.catData.map(c=>c.name);x.units=[...new Set(x.catData.map(c=>c.unit).concat(x.units))];
  x.items=[];x.catData.forEach(c=>c.items.slice(0,2).forEach(n=>x.items.push({n,cat:c.name,unit:c.unit})));
  x.catData.forEach(c=>CAT_ICON[c.name]=c.icon)}});
const get=id=>IND.find(x=>x.id===id)||null;
const cur=()=>{try{return get(localStorage.getItem('mk_industry'))}catch(e){return null}};
const H=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sb=()=>window.mkSB||(typeof SBc==='function'?SBc():null);

/* CSS صغير للشبكة */
const st=document.createElement('style');
st.textContent='.indG{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin:8px 0;max-height:46vh;overflow:auto}#mkWho .indG button,.indG button{border:2px solid #d5dde0!important;background:#fff!important;color:#17363b!important;border-radius:14px;padding:10px 4px;margin:0!important;width:auto!important;font:inherit;font-size:13px;font-weight:700;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:4px;white-space:normal;overflow-wrap:anywhere;line-height:1.3}.indG button b{font-size:28px;line-height:1}#mkWho .indG button.on,.indG button.on{border-color:#087f8c!important;background:#e6f4f5!important}';
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
    return msg(/registered|already/i.test(t)?'الإيميل ده مسجل قبل كده — ادخل بيه':/not allowed|disabled/i.test(t)?'التسجيل الجديد مقفول من السيرفر — لازم يتفعّل من إعدادات Supabase':/password/i.test(t)?'كلمة السر ضعيفة — خليها ٦ حروف أو أكتر':/invalid/i.test(t)?'الإيميل مكتوب غلط':/rate|seconds/i.test(t)?'استنى دقيقة وجرّب تاني':'مشكلة في التسجيل: '+t)}
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
async function insertItems(id,only){
 const x=get(id);if(!x||!x.catData.length)return 0;const c=sb();
 const ex=await c.from('mk_products').select('name,code');const have=new Set((ex.data||[]).map(r=>r.name)),codes=new Set((ex.data||[]).map(r=>r.code));
 const pre=id.slice(0,2).toUpperCase();let n=0;const rows=[];
 x.catData.forEach(cd=>{if(only&&!only.includes(cd.name))return;cd.items.forEach(nm=>{if(have.has(nm))return;let code;do{n++;code=pre+String(n).padStart(3,'0')}while(codes.has(code));codes.add(code);rows.push({code,name:nm,cat:cd.name,unit:cd.unit,qty:0,price:0,min:5})})});
 for(let i=0;i<rows.length;i+=200){const r=await c.from('mk_products').insert(rows.slice(i,i+200));if(r.error)throw r.error}
 return rows.length}
async function seedProducts(id){
 const x=get(id);if(!x||!x.items.length)return;const c=sb();
 const ex=await c.from('mk_products').select('name,code');const have=new Set((ex.data||[]).map(r=>r.name)),codes=new Set((ex.data||[]).map(r=>r.code));
 const pre=id.slice(0,2).toUpperCase();let n=0;
 const rows=x.items.filter(i=>!have.has(i.n)).map(i=>{let code;do{n++;code=pre+String(n).padStart(3,'0')}while(codes.has(code));codes.add(code);return{code,name:i.n,cat:i.cat,unit:i.unit,qty:0,price:0,min:5}});
 if(rows.length)await c.from('mk_products').insert(rows)
}
/* مكتبة الأصناف الجاهزة: المستخدم يختار الأقسام اللي عايزها */
function catalog(){
 const c=cur();if(!c||!c.catData.length)return change();
 openModal('<div class="modal-head"><h2>📚 أصناف جاهزة — '+H(c.name)+'</h2><button class="close" onclick="closeModal()">✕</button></div><p>اختار الأقسام اللي عايز تضيفها لمخزونك (الكمية والسعر صفر وتظبطهم بعدين). الأصناف الموجودة عندك مش هتتكرر.</p><div id="catL" style="display:flex;flex-direction:column;gap:8px;max-height:50vh;overflow:auto">'+c.catData.map((d,i)=>'<label class="chk" style="border:1px solid #d5dde0;border-radius:12px;padding:10px;display:flex;gap:10px;align-items:center"><input type="checkbox" data-n="'+i+'"><span style="font-size:24px">'+d.icon+'</span><span><b>'+H(d.name)+'</b><br><small style="color:#61777b">'+d.items.length+' صنف: '+H(d.items.slice(0,3).join('، '))+'…</small></span></label>').join('')+'</div><button class="secondary" id="catAll" type="button" style="margin:8px 0">تحديد الكل</button> <button class="primary" id="catGo" type="button">إضافة المحدد</button><div id="catMsg" style="margin-top:8px;font-weight:700"></div>');
 document.getElementById('catAll').onclick=()=>document.querySelectorAll('#catL input').forEach(i=>i.checked=true);
 document.getElementById('catGo').onclick=async()=>{
  const sel=[...document.querySelectorAll('#catL input:checked')].map(i=>c.catData[+i.dataset.n].name);
  const m=document.getElementById('catMsg');if(!sel.length){m.textContent='اختار قسم واحد على الأقل';return}
  m.textContent='⏳ جاري الإضافة…';
  try{const n=await insertItems(c.id,sel);m.style.color='#1f8a4c';m.textContent='✔ اتضاف '+n+' صنف';setTimeout(()=>location.reload(),900)}
  catch(e){m.style.color='#c0392b';m.textContent='مشكلة: '+(e&&e.message||e)}}
}

/* تكييف السيستم على مجال المحل: الاسم والأيقونة + إخفاء أقسام ميكانيزم الخاصة لو المجال مش مطابخ */
const ONLY_KITCHEN=['kits','waorders'];
function adapt(shopName){
 const c=cur();if(!c)return;
 let css=document.getElementById('indAdapt');if(!css){css=document.createElement('style');css.id='indAdapt';document.head.appendChild(css)}
 css.textContent=c.id==='kitchen'?'':ONLY_KITCHEN.map(p=>'[data-page="'+p+'"]').join(',')+'{display:none!important}';
 const b=document.querySelector('.brand>div');
 if(b&&shopName)b.innerHTML=c.icon+' '+H(shopName);
 if(shopName){document.title=shopName;const t=document.querySelector('meta[name="apple-mobile-web-app-title"]');if(t)t.content=shopName}
 const q=(s,f)=>{const e=document.querySelector(s);if(e)f(e)};
 const nm=shopName||'محلك';
 q('#dashboard .title p',e=>e.textContent='إدارة '+nm+' من مكان واحد');
 q('#dashboard .stat:nth-child(1) small',e=>e.textContent='عدد '+c.noun);
 q('#products .title h1',e=>e.textContent='المنتجات والمخزون — '+c.name);
 q('#fontSample',e=>e.textContent=nm+' — '+c.name+' — ١٢٣٤٥٦ ج.م');
 q('#companyAddress',e=>e.placeholder='عنوان المحل (يظهر في الفاتورة)');
 q('#dashboard .grid2',g=>{if(document.getElementById('indDash'))return;
  const Q=window.MK_QUICK||{};
  g.insertAdjacentHTML('beforebegin','<div class="card" id="indDash" style="margin-bottom:14px"><h3>'+c.icon+' مخصص لـ'+H(c.name)+'</h3>'+(c.tip?'<p style="color:var(--muted,#61777b);margin:4px 0 10px">'+H(c.tip)+'</p>':'')+'<div class="quick">'+c.quick.filter(k=>Q[k]).map(k=>'<button onclick="'+Q[k][2].replace(/"/g,'&quot;')+'"><b>'+Q[k][1]+' '+Q[k][0]+'</b></button>').join('')+(c.catData.length?'<button onclick="mkInd.catalog()"><b>📚 أصناف جاهزة</b><small>'+c.catData.reduce((s,d)=>s+d.items.length,0)+' صنف في '+c.catData.length+' قسم</small></button>':'')+'</div></div>')});
 q('#products .title-row .btnrow',r=>{if(r.querySelector('#indCatB')||!c.catData.length)return;r.insertAdjacentHTML('afterbegin','<button class="secondary" id="indCatB" onclick="mkInd.catalog()">📚 أصناف جاهزة</button>')});
 if(!window.__indRP&&typeof window.renderProducts==='function'){window.__indRP=1;const _r=window.renderProducts;window.renderProducts=function(){const r=_r.apply(this,arguments);try{document.querySelectorAll('#productsBody tr.prow').forEach(tr=>{const ct=tr.children[2]&&tr.children[2].textContent.trim(),ic=CAT_ICON[ct],p=tr.querySelector('.pico');if(ic&&p&&!p.dataset.ind){p.dataset.ind=1;p.innerHTML='<span style="font-size:1.1em">'+ic+'</span>'}})}catch(e){}return r};try{window.renderProducts()}catch(e){}}
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
  const co=await c.from('mk_settings').select('value').eq('key','company').maybeSingle();
  const nm=co.data&&co.data.value&&co.data.value.name;try{if(nm)localStorage.setItem('mk_shopname',nm)}catch(e){}
  adapt(nm);if(!window.__indObs){window.__indObs=1;const side=document.querySelector('aside');if(side)new MutationObserver(()=>adapt(localStorage.getItem('mk_shopname'))).observe(side,{childList:true,subtree:true})}
 }catch(e){console.warn('industry',e)}
}

window.mkInd={list:IND,get,cur,signup,change,after,adapt,catalog,
 defCat:()=>{const c=cur();return c?c.cats[0]:'إكسسوارات مطابخ'},
 cats:()=>{const c=cur();return c?c.cats:[]},
 units:d=>{const c=cur();return c?[...new Set(c.units.concat(d))]:d}};
})();
