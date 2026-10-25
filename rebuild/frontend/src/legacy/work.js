/* eslint-disable */
// @ts-nocheck
/* The old «🛠️ أنظمة الشغل» module, copied as is from index.html (lines 6401–8003) so drawings, cutting plans
   and wording stay exactly the same. It talks to the new system only through the shims in ./runtime.ts. */
export function installWork() {
  if (typeof window === 'undefined' || window.mkWk) return;
(function(){
 var SBc=function(){return window.mkSB||(typeof sbx==='function'?sbx():null)};
 var K={ord:'wk_orders',cfg:'wk_cfg',disp:'wk_display',exp:'wk_showexp',old:'wk_leaf'};
 var TYPES=['دلفة','استانلس','جرار','بامبو','أخرى'];
 var STG={'دلفة':['تم الطلب','قص وتجهيز','تجميع','دهان/تركيب','جاهز','اتسلّم'],'استانلس':['تم الطلب','قص','ثني','لحام وتجميع','جاهز','اتسلّم'],'جرار':['تم الطلب','قص','دهان وتخريم','تجميع','جاهز','اتسلّم'],'بامبو':['اتطلب من المورّد','تحت التصنيع','جاهز عند المورّد','اتسلّم'],'أخرى':['تم الطلب','تحت التنفيذ','جاهز','اتسلّم']};
 var EXPC=['مطبخ العرض','مكت المطبخ','دريسنج العرض','مكت الدريسنج','خامات أرفف','توضيب المخزن','ديكور وإضاءة','عمالة تركيب','أخرى'];
 var PAPERS={a4:'A4 عادي',r80:'رول 80 مم',r58:'رول 58 مم',lab:'ملصق 50×30'};
 var ORD=[],CFG={stages:{},paper:'a4',next:1},F={q:'',stage:'',type:''},NS=0;
 function esc(s){return String(s==null?'':s).replace(/[&<>"]/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}
 function num(v){v=String(v==null?'':v).replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632}).replace(/[۰-۹]/g,function(d){return d.charCodeAt(0)-1776}).replace(/[٫,]/g,'.').replace(/[^\d.\-]/g,'');return parseFloat(v)||0}
 function fmt(n){return (Math.round(n*100)/100).toLocaleString('ar-EG')}
 function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,6)}
 function today(){return new Date().toISOString().slice(0,10)}
 function isAdm(){return !!(window.mkT_user?window.mkT_user.role==='admin':!document.body.classList.contains('emp'))}
 function who(){return (window.mkT_user&&window.mkT_user.name)||''}
 function sysLab(t){return t==='جرار'?'جرار (عود الخوصة)':t==='دلفة'?'دلفة (مفصلي / جرار / شاسيه)':t}
 function stages(t){return (CFG.stages&&CFG.stages[t]&&CFG.stages[t].length)?CFG.stages[t]:(STG[t]||STG['أخرى'])}
 async function get(k,def){try{var r=await SBc().from('mk_settings').select('value').eq('key',k).maybeSingle();return (r.data&&r.data.value)||def}catch(e){return def}}
 async function put(k,v){var r=await SBc().from('mk_settings').upsert([{key:k,value:v}],{onConflict:'key'});if(r.error)throw r.error}
 function errAlert(e){alert('مقدرتش:\n'+[e&&e.message,e&&e.code,e&&e.details,e&&e.hint].filter(Boolean).join('\n'))}
 function contacts(){try{return (typeof db!=='undefined'&&db.contacts)||[]}catch(e){return []}}
 function shop(){try{return (db.settings&&(db.settings.companyName||db.settings.name))||'ميكانيزم'}catch(e){return 'ميكانيزم'}}
 function ordNo(o){return o.code||('WK-'+String(o.no||0).padStart(4,'0'))}
 /* كود الأوردر بتسلسل لكل نوع: دلفة DL / بامبو BM / استانلس ST. o.no يفضل رقم داخلي مش بيتكرر (ورقة التجهيز بتربط بيه) */
 function wkPre(t){return t==='بامبو'?'BM':t==='استانلس'?'ST':'DL'}
 function wkNewCode(o){var p=wkPre(o.type);CFG.cnt=CFG.cnt||{};CFG.cnt[p]=(+CFG.cnt[p]||0)+1;o.code=p+'-'+String(CFG.cnt[p]).padStart(4,'0')}
 function wkFind(C){C=String(C||'').toUpperCase();var m=/^(WK|DL|BM|ST)-?(\d{1,6})/.exec(C);if(!m)return null;var k=m[1]+'-'+('0000'+m[2]).slice(-4);return ORD.find(function(x){return ordNo(x)===k})||null}

 /* ---------- الهيكل والتنسيق ---------- */
 function css(){
  if(document.getElementById('wkCss'))return;
  var s=document.createElement('style');s.id='wkCss';
  s.textContent='#wkApp{position:fixed;inset:0;z-index:45;background:var(--bg,#f5f7f8);overflow:auto;direction:rtl}'+
  '#wkApp .wkh{position:sticky;top:0;background:#fff;border-bottom:1px solid var(--border,#e4eaed);padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;z-index:2}'+
  '#wkApp .wkh h2{margin:0;font-size:19px;flex:1;min-width:140px}'+
  '#wkApp .wkt{display:flex;gap:6px;flex-wrap:wrap;padding:10px 14px;background:#fff;border-bottom:1px solid var(--border,#e4eaed)}'+
  '#wkApp .wkt button{padding:8px 13px;border-radius:10px;background:var(--tint2,#eef6f7);color:var(--blue,#087f8c);font-weight:700}'+
  '#wkApp .wkt button.on{background:var(--blue,#087f8c);color:#fff}'+
  '#wkApp .wkb{padding:14px;max-width:1100px;margin:0 auto}'+
  '#wkApp .wkc{background:#fff;border:1px solid var(--border,#e4eaed);border-radius:14px;padding:14px;margin-bottom:12px}'+
  '#wkApp .wkc h3{margin:0 0 10px;font-size:16px}'+
  '#wkApp .wkg{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px}'+
  '#wkApp .wkf label{display:block;font-size:12px;color:#596a70;margin-bottom:4px}'+
  '#wkApp .wkf input,#wkApp .wkf select,#wkApp .wkf textarea{width:100%;padding:10px;border:1px solid var(--border,#e4eaed);border-radius:10px;background:#fff}'+
  '#wkApp .wkbtn{padding:9px 14px;border-radius:10px;font-weight:700;background:#fff;color:var(--blue,#087f8c);border:1px solid var(--tintb,#cfe3e6)}'+
  '#wkApp .wkbtn.p{background:var(--blue,#087f8c);color:#fff;border-color:var(--blue,#087f8c)}'+
  '#wkApp .wkbtn.d{color:#c0392b}'+
  '#wkApp .wkrow{display:flex;gap:8px;flex-wrap:wrap;align-items:center}'+
  '#wkApp .tl{position:relative;margin:6px 0 0;padding:0 26px 0 0}'+
  '#wkApp .tl .st{position:relative;padding:0 0 18px;min-height:44px}'+
  '#wkApp .tl .st:before{content:"";position:absolute;right:-17px;top:20px;bottom:-2px;width:3px;background:#d9e1e4}'+
  '#wkApp .tl .st:last-child:before{display:none}'+
  '#wkApp .tl .st.done:before{background:#159447}'+
  '#wkApp .tl .dot{position:absolute;right:-26px;top:2px;width:21px;height:21px;border-radius:50%;background:#d9e1e4;color:#fff;font-size:12px;display:flex;align-items:center;justify-content:center}'+
  '#wkApp .tl .done .dot{background:#159447}'+
  '#wkApp .tl .cur .dot{background:var(--gold,#d5a928);box-shadow:0 0 0 5px #d5a92833}'+
  '#wkApp .bar{height:8px;background:#e8eef0;border-radius:99px;overflow:hidden}'+
  '#wkApp .bar i{display:block;height:100%;background:#159447}'+
  '#wkApp .mini{display:flex;gap:3px;margin-top:6px}'+
  '#wkApp .mini i{flex:1;height:6px;border-radius:3px;background:#d9e1e4}'+
  '#wkApp .mini i.on{background:#159447}#wkApp .mini i.cur{background:#d5a928}'+
  '#wkApp table{width:100%;border-collapse:collapse}#wkApp th,#wkApp td{padding:8px;border-bottom:1px solid var(--border,#e4eaed);text-align:right;font-size:14px}'+
  '#wkApp .draw{text-align:center;background:#fff;border:1px solid var(--border,#e4eaed);border-radius:12px;padding:8px;overflow:auto}';
  document.head.appendChild(s);
 }
 function shell(title,backFn){
  WEBLINK=null;css();
  var a=document.getElementById('wkApp');
  if(!a){a=document.createElement('div');a.id='wkApp';document.body.appendChild(a)}
  a.innerHTML='<div class="wkh"><button type="button" class="wkbtn" id="wkBack">'+(backFn?'← رجوع':'')+'</button><h2>'+title+'</h2><button type="button" class="wkbtn d" id="wkX">✕ إغلاق</button></div>'+
   '<div class="wkt" id="wkTabs"></div><div class="wkb" id="wkBody"></div>';
  var b=a.querySelector('#wkBack');if(backFn){b.onclick=backFn}else{b.style.display='none'}
  a.querySelector('#wkX').onclick=close;
  var tabs=[['ord','📋 الأوردرات',viewOrders],['new','➕ أوردر دلفة',function(){viewForm(null,'دلفة')}],['steel','🔩 استانلس',function(){viewSteel(null)}],['bamboo','🎍 بامبو',function(){viewBamboo(null)}],['rods','🧮 حاسبة الأعواد',viewRods],['forf','🔥 فرفورجيه',viewForf],['exp','🧾 مصاريف المعرض',viewExps],['cfg','⚙️ إعدادات',viewCfg]];
  var T=a.querySelector('#wkTabs');
  tabs.forEach(function(t){var b=document.createElement('button');b.type='button';b.textContent=t[1];b.dataset.k=t[0];b.onclick=t[2];T.appendChild(b)});
  a.scrollTop=0;return a.querySelector('#wkBody');
 }
 function mark(k){var T=document.getElementById('wkTabs');if(!T)return;[].forEach.call(T.children,function(b){b.classList.toggle('on',b.dataset.k===k)})}
 function close(){var a=document.getElementById('wkApp');if(a)a.remove();if(window.mkWkClosed)window.mkWkClosed()}
 async function loadAll(){
  CFG=Object.assign({stages:{},paper:'a4',next:1},await get(K.cfg,{}));
  try{var p=localStorage.getItem('wk_paper');if(p&&PAPERS[p])CFG.paper=p}catch(e){}
  ORD=await get(K.ord,null);
  if(!ORD){
   ORD=[];var old=await get(K.old,[]);
   old.forEach(function(l){ORD.push({id:l.id||uid(),no:CFG.next++,type:'دلفة',date:l.date,customer:l.customer,phone:'',crafter:l.crafter,kind:l.kind,w:l.w,h:l.h,qty:l.qty,hinges:l.hinges,hingePos:'',side:'right',mats:[],fee:l.fee,cost:l.cost,price:l.price,paid:0,notes:l.notes,stage:Math.max(0,STG['دلفة'].indexOf(l.status==='جاهز'?'جاهز':l.status==='اتسلّم'?'اتسلّم':'تم الطلب')),hist:[{n:'تم الطلب',at:new Date().toISOString(),by:''}]})});
   if(ORD.length){try{await put(K.ord,ORD);await put(K.cfg,CFG)}catch(e){}}
  }
 }
 var WEBLINK=null,WEBSIG={};
 function webPayload(o){var st=stages(o.type),ix=Math.max(0,Math.min(+o.stage||0,st.length-1));return {work_id:o.id,stages:st,stage_idx:ix,stage:st[ix],status:ix>=st.length-1?'done':'opened'}}
 async function webSync(){var sb=window.mkSB;if(!sb)return;
  for(var k=0;k<ORD.length;k++){var o=ORD[k];if(!(o.src&&o.src.web))continue;var pl=webPayload(o),sig=JSON.stringify(pl);if(WEBSIG[o.id]===sig)continue;
   try{var r=await sb.from('web_custom_orders').update(pl).eq('id',o.src.web);if(!r.error)WEBSIG[o.id]=sig}catch(e){}}
  if(window.loadCustom)window.loadCustom()}
 async function webCancel(o){if(!(o&&o.src&&o.src.web)||!window.mkSB)return;try{await window.mkSB.from('web_custom_orders').update({status:'cancelled',work_id:o.id}).eq('id',o.src.web)}catch(e){}if(window.loadCustom)window.loadCustom()}
 async function saveOrd(){await put(K.ord,ORD);if(WEBLINK){var w=WEBLINK,o=ORD[ORD.length-1];WEBLINK=null;if(o&&!o.src){o.src={web:w.id,img:w.img||''};await put(K.ord,ORD)}}try{await webSync()}catch(e){}}
 async function saveCfg(){await put(K.cfg,CFG)}

 /* ---------- الرسم ---------- */
 function hingePositions(o){
  var h=num(o.h),n=Math.max(2,Math.round(num(o.hinges))||3),manual=String(o.hingePos||'').split(/[,،\s\/]+/).map(num).filter(function(x){return x>0});
  if(manual.length)return manual.sort(function(a,b){return a-b});
  var first=11,hl=10,last=Math.max(first+1,h-11-hl),ys=[];
  for(var i=0;i<n;i++)ys.push(first+(last-first)*i/(n-1));
  return ys.map(function(y){return Math.round(y*10)/10});
 }
 /* رسم الضلفة الجرار (المنزلقة): العجل في الراسين (فوق وتحت)، من أول الراس بمسافة لحد أول العجلة، من الناحيتين — وتفصيلة مكبّرة لقص الفتحة */
 function slideSvg(o){
  var w=Math.max(1,num(o.w)),h=Math.max(1,num(o.h)),wo=num(o.wOff),wl=num(o.wLen),wg=Math.max(num(o.wWing)||0,wl),cs=wo+Math.max(0,(wg-wl)/2),K='#000',q=function(v){return v>0?(Math.round(v*10)/10)+' سم':'؟ اكتب المقاس'};
  var VB=470,sc=Math.min(300/w,250/h),W=w*sc,H=h*sc,x0=(VB-W)/2+12,y0=70,pw=Math.max(10,Math.min(16,H*0.06));
  var wos=wo>0?Math.max(8,wo*sc):W*0.18,wls=wl>0?Math.max(12,wl*sc):Math.max(14,W*0.12);
  function T(x,y,t,sz,anc,wt){return '<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+(sz||16)+'" font-weight="'+(wt||800)+'" fill="'+K+'" text-anchor="'+(anc||'middle')+'" font-family="Cairo,Tahoma,Arial">'+esc(t)+'</text>'}
  function D(x1,y1,x2,y2,t,side,sz,of){var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*side,ny=dx/L*side;of=of||22;var X1=x1+nx*of,Y1=y1+ny*of,X2=x2+nx*of,Y2=y2+ny*of,mx=(X1+X2)/2+nx*15,my=(Y1+Y2)/2+ny*15+6;
   var tx=Math.abs(dy)>Math.abs(dx)?'<g transform="translate('+((X1+X2)/2+nx*14).toFixed(1)+' '+((Y1+Y2)/2).toFixed(1)+') rotate(-90)"><rect x="-46" y="-16" width="92" height="21" fill="#fff"/>'+T(0,0,t,sz||16)+'</g>':'<rect x="'+(mx-48)+'" y="'+(my-18)+'" width="96" height="23" fill="#fff"/>'+T(mx,my,t,sz||16);
   return '<path d="M'+x1+' '+y1+'L'+(X1+nx*5)+' '+(Y1+ny*5)+'M'+x2+' '+y2+'L'+(X2+nx*5)+' '+(Y2+ny*5)+'" stroke="'+K+'" stroke-width="1.2"/><line x1="'+X1+'" y1="'+Y1+'" x2="'+X2+'" y2="'+Y2+'" stroke="'+K+'" stroke-width="2" marker-start="url(#sA)" marker-end="url(#sA)"/>'+tx}
  var s='<defs><marker id="sA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker>'+
   '<pattern id="sH" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V6" stroke="#000" stroke-width="1.3"/></pattern></defs>';
  /* ① الضلفة من قدام */
  s+=T(VB/2,24,'① الضلفة الجرار من قدام',17);
  s+='<rect x="'+x0+'" y="'+y0+'" width="'+W+'" height="'+H+'" fill="#fff" stroke="'+K+'" stroke-width="3"/>'+
   '<rect x="'+(x0+pw)+'" y="'+(y0+pw)+'" width="'+(W-2*pw)+'" height="'+(H-2*pw)+'" fill="none" stroke="'+K+'" stroke-width="1.5"/>'+
   '<path d="M'+(x0+pw)+' '+(y0+pw)+'L'+(x0+W-pw)+' '+(y0+H-pw)+'M'+(x0+W-pw)+' '+(y0+pw)+'L'+(x0+pw)+' '+(y0+H-pw)+'" stroke="#aaa" stroke-width="1" stroke-dasharray="5 5"/>'+
   T(x0+W/2,y0+H*0.3,'الراس',12,'middle',700)+'<g transform="translate('+(x0+pw+14)+' '+(y0+H/2)+') rotate(-90)">'+T(0,0,'القايم',12,'middle',700)+'</g>';
  [[y0,-1],[y0+H,1]].forEach(function(r){var ey=r[0],d=r[1];
   var wgs=wg>0?Math.max(wls,wg*sc):wls,cof=(wgs-wls)/2;
   [x0+wos,x0+W-wos-wgs].forEach(function(wx){var cx=wx+cof;
    s+='<rect x="'+wx+'" y="'+(d<0?ey+1:ey-12)+'" width="'+wgs+'" height="11" fill="none" stroke="'+K+'" stroke-width="1" stroke-dasharray="3 2"/>'+
     '<rect x="'+cx+'" y="'+(d<0?ey:ey-7)+'" width="'+wls+'" height="7" fill="url(#sH)" stroke="'+K+'" stroke-width="1.5"/>'+
     '<circle cx="'+(cx+wls/2)+'" cy="'+(ey+d*5)+'" r="'+Math.min(8,wls/2)+'" fill="#fff" stroke="'+K+'" stroke-width="2"/><circle cx="'+(cx+wls/2)+'" cy="'+(ey+d*5)+'" r="2" fill="#000"/>'})});
  s+=D(x0,y0,x0+wos,y0,q(wo),-1,14,26)+D(x0,y0+H,x0+W,y0+H,'العرض '+q(num(o.w)),1,16,30)+D(x0,y0,x0,y0+H,'الارتفاع '+q(num(o.h)),1,15,24);
  var hd0=o.handle||'one',right0=(o.side||'right')==='right',hdLab={one:'مقبض على '+(right0?'اليمين':'الشمال'),both:'مقبض على الجنبين',none:'من غير مقبض',ext:'مقبض خارجي (لطش)',frame:'شاسيه ثابت (من غير مقبض)'}[hd0];
  if(hdLab)s+=T(x0+W/2,y0+H+112,hdLab,14,'middle',700).replace('fill="'+K+'"','fill="#8a6d10"');
  /* ② تفصيلة مكبّرة للراس: الجناح بيقعد بره، والجزء العالي بس هو اللي بيخش في الخلع */
  var dy=y0+H+150,dx=34,RL=410,RH=46,kk=Math.min(14,300/Math.max(1,(wo||11)+(wg||9))),A=(wo||11)*kk,G=(wg||wl||9)*kk,B=(wl||6)*kk,C=A+(G-B)/2;
  s+=T(VB/2,dy-70,'② تفصيلة قص فتحة العجلة في الراس',17);
  s+='<path d="M'+dx+' '+dy+'H'+(dx+RL)+'l-8 10l8 10l-8 10l8 10l-8 6H'+dx+'Z" fill="#fff" stroke="'+K+'" stroke-width="3"/>'+
   '<g transform="translate('+(dx-10)+' '+(dy+RH/2)+') rotate(-90)">'+T(0,0,'أول الراس',12,'middle',700)+'</g>'+
   '<rect x="'+(dx+A)+'" y="'+(dy-14)+'" width="'+G+'" height="'+(RH+6)+'" rx="4" fill="none" stroke="'+K+'" stroke-width="2" stroke-dasharray="7 4"/>'+
   T(dx+A-6,dy-4,'الجناح',12,'end',800)+
   '<rect x="'+(dx+C)+'" y="'+dy+'" width="'+B+'" height="16" fill="url(#sH)" stroke="'+K+'" stroke-width="2.5"/>'+
   '<circle cx="'+(dx+C+B/2)+'" cy="'+(dy-10)+'" r="'+Math.min(26,B/2+6)+'" fill="#fff" stroke="'+K+'" stroke-width="3"/><circle cx="'+(dx+C+B/2)+'" cy="'+(dy-10)+'" r="7" fill="none" stroke="'+K+'" stroke-width="2.5"/><circle cx="'+(dx+C+B/2)+'" cy="'+(dy-10)+'" r="2.5" fill="#000"/>'+
   D(dx,dy+RH+12,dx+A,dy+RH+12,q(wo),1,15,18)+D(dx+A,dy+RH+12,dx+A+G,dy+RH+12,'جناح '+q(wg),1,14,18)+
   D(dx,dy+RH+12,dx+C,dy+RH+12,'القص بعد '+q(cs),1,15,58)+D(dx+C,dy+RH+12,dx+C+B,dy+RH+12,q(wl),1,15,58)+
   '<path d="M'+(dx+C+B+70)+' '+(dy-30)+'L'+(dx+C+B+4)+' '+(dy+6)+'" stroke="'+K+'" stroke-width="2" marker-end="url(#sA)"/>'+T(dx+C+B+100,dy-36,'قص بالصاروخ',15);
  /* المقاسات بالكلام الكبير */
  var ty=dy+RH+150;
  s+='<rect x="12" y="'+(ty-28)+'" width="'+(VB-24)+'" height="100" rx="8" fill="#fff" stroke="'+K+'" stroke-width="2.5"/>'+
   T(VB/2,ty,'أول العجلة (الجناح) بعد '+q(wo)+' من أول الراس',17)+T(VB/2,ty+28,'القص يبدأ بعد '+q(cs)+' — طول القص '+q(wl),19)+T(VB/2,ty+56,'الجناح '+q(wg)+' بيقعد بره — ٤ فتحات (الراسين، الناحيتين) × '+(num(o.qty)||1),13,'middle',700);
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+VB+' '+(ty+92)+'" style="width:100%;max-width:'+VB+'px;height:auto;background:#fff;direction:ltr">'+s+'</svg>';
 }
 function svg(o,big){
  if(o.kind==='slide'&&(o.type==='دلفة'||o.type==='جرار'))return slideSvg(o);
  var w=Math.max(1,num(o.w)),h=Math.max(1,num(o.h)),maxW=big?300:220,maxH=big?460:320,sc=Math.min(maxW/w,maxH/h),W=w*sc,H=h*sc,x0=70,y0=36,hl=10;
  var right=(o.side||'right')==='right';
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+(W+x0+110)+' '+(H+y0+56)+'" style="width:100%;max-width:'+(W+x0+110)+'px;background:#fff;font-family:Tahoma,Arial">';
  s+='<defs><marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#18343a"/></marker><pattern id="fh" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V8" stroke="#9fc4c9" stroke-width="1.4"/></pattern></defs>';
  s+='<rect x="'+x0+'" y="'+y0+'" width="'+W+'" height="'+H+'" fill="#eef6f7" stroke="#087f8c" stroke-width="3"/>';
  s+='<rect x="'+(x0+6)+'" y="'+(y0+6)+'" width="'+(W-12)+'" height="'+(H-12)+'" fill="none" stroke="#9fc4c9" stroke-width="1" stroke-dasharray="4 3"/>';
  /* القطاعات: جنبين + فوق وتحت، والجنب اللي بمقبض باين بلونه وشكله */
  if(o.type==='دلفة'||o.type==='جرار'){
   var hd=o.handle||'one',pw=12,openL=right,stile=function(x,isH){return isH?'<rect x="'+x+'" y="'+y0+'" width="'+pw+'" height="'+H+'" fill="#f2c94c" stroke="#8a6d10" stroke-width="1.5"/><rect x="'+(x+pw/2-2)+'" y="'+(y0+H*0.12)+'" width="4" height="'+(H*0.76)+'" rx="2" fill="#8a6d10"/>':'<rect x="'+x+'" y="'+y0+'" width="'+pw+'" height="'+H+'" fill="#cfdde0" stroke="#087f8c" stroke-width="1"/>'};
   s+='<rect x="'+x0+'" y="'+y0+'" width="'+W+'" height="'+pw+'" fill="#cfdde0" stroke="#087f8c" stroke-width="1"/><rect x="'+x0+'" y="'+(y0+H-pw)+'" width="'+W+'" height="'+pw+'" fill="#cfdde0" stroke="#087f8c" stroke-width="1"/>';
   var hL=hd==='both'||(hd==='one'&&openL),hR=hd==='both'||(hd==='one'&&!openL);
   s+=stile(x0,hL)+stile(x0+W-pw,hR);
   var lab={one:'مقبض على جنب الفتح',both:'مقبض على الجنبين',none:'من غير مقبض',ext:'مقبض خارجي (لطش)',frame:'شاسيه ثابت (من غير فتح)'}[hd]||'';
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H-pw-8)+'" text-anchor="middle" font-size="12" fill="#8a6d10" font-weight="700">'+lab+'</text>';
  }
  /* شاسيه ثابت: إطار حوالين لوح (مراية أو غيره) — من غير مقبض ولا فتح */
  if(o.kind==='frame'){var fp=Math.max(10,Math.min(18,W*0.08));s+='<rect x="'+(x0+fp)+'" y="'+(y0+fp)+'" width="'+(W-2*fp)+'" height="'+(H-2*fp)+'" fill="url(#fh)" stroke="#087f8c" stroke-width="2"/><text x="'+(x0+W/2)+'" y="'+(y0+H/2+60<y0+H-fp-6?y0+H/2+44:y0+H-fp-8)+'" text-anchor="middle" font-size="12" fill="#18343a" font-weight="700">لوح داخل الإطار (مراية أو غيره)</text>'}
  /* مقبض خارجي (لطش): ماسورة على وش الضلفة، النجار هو اللي بيركبها */
  if((o.handle||'')==='ext'&&o.kind!=='frame'){var hxx=(o.side||'right')==='right'?x0+W*0.14:x0+W*0.86,hh=Math.max(30,Math.min(H*0.3,110));s+='<rect x="'+(hxx-4)+'" y="'+(y0+H/2-hh/2)+'" width="8" height="'+hh+'" rx="4" fill="#f2c94c" stroke="#8a6d10" stroke-width="1.6"/><text x="'+hxx+'" y="'+(y0+H/2-hh/2-6)+'" text-anchor="middle" font-size="11" fill="#8a6d10" font-weight="700">مقبض خارجي (لطش)</text>'}
  if(o.kind==='slide'){
   /* فتحة العجل: تفريغة مستطيلة بركن مدوّر في الركنين اللي فوق، والعجلة جواها */
   var sw=Math.max(18,Math.min(W*0.2,24*sc)),sh=Math.max(14,Math.min(H*0.07,10*sc)),r0=Math.min(6,sh/2);
   [[x0,1],[x0+W,-1]].forEach(function(c){var x=c[0],d=c[1],x2=x+d*sw;
    s+='<path d="M'+x+' '+y0+'L'+x2+' '+y0+'L'+x2+' '+(y0+sh-r0)+'Q'+x2+' '+(y0+sh)+' '+(x2-d*r0)+' '+(y0+sh)+'L'+x+' '+(y0+sh)+'Z" fill="#fff" stroke="#c0392b" stroke-width="1.6"/>'+
     '<circle cx="'+(x+d*sw/2)+'" cy="'+(y0+sh/2+1)+'" r="'+Math.min(sh/2-2,sw/3).toFixed(1)+'" fill="#555" stroke="#222"/><circle cx="'+(x+d*sw/2)+'" cy="'+(y0+sh/2+1)+'" r="1.6" fill="#ddd"/>'});
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H/2)+'" text-anchor="middle" font-size="14" fill="#18343a" font-weight="700">دلفة منزلقة</text>';
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H/2+20)+'" text-anchor="middle" font-size="12" fill="#c0392b">فتحة العجل أعلى الركنين</text>';
  }else if(o.kind==='hinge'){
   var ys=hingePositions(o),hx=right?x0+W:x0-12;
   ys.forEach(function(y,i){
    var py=y0+y*sc;
    s+='<rect x="'+hx+'" y="'+py+'" width="12" height="'+(hl*sc)+'" fill="#c0392b" stroke="#7b241c"/>';
    var tx=right?x0+W+22:x0-22,anchor=right?'start':'end';
    s+='<circle cx="'+(right?x0+W+34:x0-34)+'" cy="'+(py+hl*sc/2)+'" r="11" fill="#c0392b"/><text x="'+(right?x0+W+34:x0-34)+'" y="'+(py+hl*sc/2+4)+'" text-anchor="middle" font-size="12" fill="#fff" font-weight="700">'+(i+1)+'</text>';
    s+='<text x="'+(right?x0+W+52:x0-52)+'" y="'+(py+hl*sc/2+4)+'" text-anchor="'+anchor+'" font-size="12" fill="#18343a">'+(i===0?'11 سم من فوق':Math.round(y*10)/10+' سم')+'</text>';
   });
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H/2)+'" text-anchor="middle" font-size="14" fill="#18343a" font-weight="700">دلفة بمفصلات ('+ys.length+')</text>';
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H/2+20)+'" text-anchor="middle" font-size="12" fill="#596a70">المفصلات على '+(right?'اليمين':'الشمال')+'</text>';
  }else{
   s+='<text x="'+(x0+W/2)+'" y="'+(y0+H/2)+'" text-anchor="middle" font-size="14" fill="#18343a" font-weight="700">'+esc(o.kind==='frame'?'شاسيه ثابت':(o.type||'قطعة'))+'</text>';
  }
  s+='<line x1="'+x0+'" y1="'+(y0+H+22)+'" x2="'+(x0+W)+'" y2="'+(y0+H+22)+'" stroke="#18343a" marker-start="url(#ar)" marker-end="url(#ar)"/>';
  s+='<text x="'+(x0+W/2)+'" y="'+(y0+H+42)+'" text-anchor="middle" font-size="14" font-weight="700">العرض '+esc(num(o.w))+' سم</text>';
  var lx=right?x0-24:x0+W+24+ (o.kind==='hinge'?0:0);
  var lxx=right?x0-30:x0+W+30;
  s+='<line x1="'+lxx+'" y1="'+y0+'" x2="'+lxx+'" y2="'+(y0+H)+'" stroke="#18343a" marker-start="url(#ar)" marker-end="url(#ar)"/>';
  s+='<text transform="translate('+(lxx+(right?-8:16))+','+(y0+H/2)+') rotate(-90)" text-anchor="middle" font-size="14" font-weight="700">الارتفاع '+esc(num(o.h))+' سم</text>';
  return s+'</svg>';
 }

 /* ---------- الطباعة ---------- */
 function cost(o){
  if(o.cost!==''&&o.cost!=null&&num(o.cost)>0)return num(o.cost);
  var m=(o.mats||[]).reduce(function(a,x){return a+num(x.q)*num(x.p)},0);
  return m+num(o.fee)*(num(o.qty)||1);
 }
 function profit(o){return num(o.price)-cost(o)}
 function sheetHTML(o,paper,withPrice){
  var P={a4:'@page{size:A4;margin:10mm}body{margin:0 auto;max-width:190mm;font-size:14px}',r80:'@page{size:80mm auto;margin:0}body{margin:0 auto;width:72mm;padding:2mm;font-size:12px}',r58:'@page{size:58mm auto;margin:0}body{margin:0 auto;width:50mm;padding:2mm;font-size:10px}',lab:'@page{size:50mm 30mm;margin:0}body{margin:0 auto;width:48mm;height:28mm;padding:1mm;overflow:hidden;font-size:9px}'}[paper]||'';
  var st=stages(o.type),code=ordNo(o);
  var head='<meta charset="utf-8"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap"><style>'+P+
   '*{box-sizing:border-box;font-family:Cairo,Tahoma,Arial,sans-serif;color:#000}html{direction:rtl}table{width:100%;border-collapse:collapse}td,th{border:1px solid #000;padding:3px 5px;text-align:right}h2{margin:2px 0}svg{max-width:100%;height:auto}.c{text-align:center}.bx{display:inline-block;width:11px;height:11px;border:1px solid #000;margin-left:4px}</style>';
  var barcode='<svg class="bc" data-v="'+esc(code)+'"></svg>';
  var body;
  if(paper==='lab'){
   body='<div class="c"><b>'+esc(o.customer)+'</b><br>'+esc(num(o.w))+'×'+esc(num(o.h))+' ×'+esc(o.qty||1)+'<br>'+barcode+'</div>';
  }else{
   var mats=(o.mats||[]).filter(function(x){return x.n}).map(function(x){return '<tr><td>'+esc(x.n)+'</td><td>'+esc(x.q)+'</td>'+(withPrice?'<td>'+fmt(num(x.p))+'</td>':'')+'</tr>'}).join('');
   body='<div class="c"><h2>'+esc(shop())+'</h2><b>ورقة تجهيز '+esc(o.type)+'</b><br>'+barcode+'</div>'+
    '<table><tr><td>رقم الأوردر</td><td>'+esc(code)+'</td><td>التاريخ</td><td>'+esc(o.date)+'</td></tr>'+
    '<tr><td>العميل</td><td>'+esc(o.customer)+(o.phone?' — '+esc(o.phone):'')+'</td><td>الصنايعي</td><td>'+esc(o.crafter||'—')+'</td></tr>'+
    '<tr><td>المقاس</td><td>'+esc(num(o.w))+' × '+esc(num(o.h))+' سم</td><td>الكمية</td><td>'+esc(o.qty||1)+'</td></tr>'+
    (o.kind==='hinge'?'<tr><td>المفصلات</td><td>'+esc(hingePositions(o).length)+' (على '+((o.side||'right')==='right'?'اليمين':'الشمال')+')</td><td>مواضعها</td><td>'+hingePositions(o).map(function(y){return esc(y)}).join(' / ')+' سم</td></tr>':'')+
    (o.color||o.profile?'<tr><td>اللون</td><td>'+esc(o.color)+'</td><td>القطاع</td><td>'+esc(o.profile)+'</td></tr>':'')+
    (o.notes?'<tr><td>ملاحظات</td><td colspan="3">'+esc(o.notes)+'</td></tr>':'')+
    (withPrice?'<tr><td>السعر</td><td>'+fmt(num(o.price))+' ج</td><td>العربون</td><td>'+fmt(num(o.paid))+' ج</td></tr>':'')+'</table>'+
    (mats?'<p style="margin:6px 0 2px"><b>الخامات</b></p><table><tr><th>الصنف</th><th>الكمية</th>'+(withPrice?'<th>السعر</th>':'')+'</tr>'+mats+'</table>':'')+
    ((o.kind==='hinge'||o.kind==='slide'||o.kind==='frame')?'<div class="c" style="margin-top:8px">'+svg(o,paper==='a4')+'</div>':'')+
    (o.type==='استانلس'&&o.steel?steelSummary(o,paper):'')+
    (o.bamboo?bambooSummary(o):'')+
    '<p style="margin:8px 0 2px"><b>خط السير</b></p><div>'+st.map(function(s){return '<span style="display:inline-block;margin-left:10px"><i class="bx"></i>'+esc(s)+'</span>'}).join('')+'</div>';
  }
  var bc='<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"><\/script><script>window.onload=function(){document.querySelectorAll("svg.bc").forEach(function(x){try{JsBarcode(x,x.dataset.v,{format:"CODE128",displayValue:true,fontSize:12,margin:0,height:'+(paper==='lab'?'22':'40')+'})}catch(e){}})}<\/script>';
  return '<!doctype html><html dir="rtl"><head>'+head+'</head><body>'+body+bc+'</body></html>';
 }
 function printOrder(o,paper,withPrice){
  var p=paper||CFG.paper||'a4';
  try{localStorage.setItem('wk_paper',p)}catch(e){}
  if(typeof window.mkPrintHTML==='function')window.mkPrintHTML(sheetHTML(o,p,withPrice));
  else{var w=window.open('','_blank');if(w){w.document.write(sheetHTML(o,p,withPrice));w.document.close()}}
 }
 function printMenu(o){
  var opts=Object.keys(PAPERS).map(function(k){return '<option value="'+k+'"'+(k===CFG.paper?' selected':'')+'>'+PAPERS[k]+'</option>'}).join('');
  openModal('<div class="modal-head"><h2>🖨️ طباعة '+esc(ordNo(o))+'</h2></div><div class="form">'+
   '<div class="field full"><label>مقاس الورق</label><select id="wkPp">'+opts+'</select></div>'+
   '<div class="field full"><label class="chk"><input type="checkbox" id="wkPpr"> اطبع السعر والعربون</label></div></div>'+
   '<p style="color:var(--muted);font-size:13px">لو الطباعة بتطلع مقصوصة أو مزاحة، غيّر المقاس لرول 80 أو 58 (حسب الطابعة).</p>'+
   '<div class="modal-foot"><button type="button" class="primary" id="wkPgo">معاينة وطباعة</button><button type="button" class="secondary" onclick="closeModal()">إلغاء</button></div>');
  var m=document.getElementById('modal');
  m.querySelector('#wkPgo').onclick=function(){var p=m.querySelector('#wkPp').value,pr=m.querySelector('#wkPpr').checked;CFG.paper=p;closeModal();saveCfg().catch(function(){});printOrder(o,p,pr)};
 }

 /* ---------- الأوردرات ---------- */
 function curStage(o){return Math.min(Math.max(0,o.stage|0),stages(o.type).length-1)}
 function miniTl(o){var st=stages(o.type),c=curStage(o);return '<div class="mini">'+st.map(function(s,i){return '<i class="'+(i<c?'on':i===c?'cur':'')+'" title="'+esc(s)+'"></i>'}).join('')+'</div>'}
 async function viewOrders(){
  var b=shell('📋 الأوردرات');mark('ord');
  if(!ORD.length&&!NS){await loadAll();NS=1}
  var list=ORD.slice().reverse().filter(function(o){
   if(F.type&&o.type!==F.type)return false;
   if(F.stage!==''&&stages(o.type)[curStage(o)]!==F.stage)return false;
   var q=F.q.trim();if(q){var t=(ordNo(o)+' '+o.customer+' '+o.crafter+' '+o.phone).toLowerCase();if(t.indexOf(q.toLowerCase())<0)return false}
   return true});
  var all={};ORD.forEach(function(o){var s=stages(o.type)[curStage(o)];all[s]=(all[s]||0)+1});
  var tot=ORD.reduce(function(a,o){return a+profit(o)},0);
  var sus=ORD.filter(function(o){return o.type==='جرار'&&o.kind==='slide'&&!o.sysOk});
  var susH=sus.length?'<div class="wkc" style="border:2px solid #f0b46a"><b>⚠️ '+sus.length+' أوردر على نظام «جرار (عود الخوصة)» وشكلهم دلف جرار — راجعهم</b><p style="font-size:13px;color:var(--muted);margin:4px 0 8px">مفيش حاجة هتتغير غير لما تختار.</p>'+sus.map(function(o){return '<div class="sample" style="margin-bottom:6px"><b>'+esc(ordNo(o))+' — '+esc(o.customer||'بدون اسم')+'</b> <small>('+esc(num(o.w))+'×'+esc(num(o.h))+' — المرحلة: '+esc(stages(o.type)[curStage(o)])+')</small><div class="wkrow" style="margin-top:6px"><button type="button" class="wkbtn p" data-sx="'+esc(o.id)+'">حوّله لنظام الدلفة</button><button type="button" class="wkbtn" data-sk="'+esc(o.id)+'">ده عود خوصة — سيبه</button></div></div>'}).join('')+'</div>':'';
  b.innerHTML=susH+'<div class="wkc"><div class="wkrow"><input id="wkQ" placeholder="دوّر بالاسم أو رقم الأوردر، أو امسح الباركود واضغط Enter" value="'+esc(F.q)+'" style="flex:1;min-width:200px;padding:10px;border:1px solid var(--border);border-radius:10px">'+
   '<select id="wkTy" style="padding:10px;border-radius:10px;border:1px solid var(--border)"><option value="">كل الأنواع</option>'+TYPES.map(function(t){return '<option'+(F.type===t?' selected':'')+'>'+t+'</option>'}).join('')+'</select>'+
   '<button type="button" class="wkbtn p" id="wkNew">➕ أوردر جديد</button></div>'+
   '<div class="wkrow" style="margin-top:10px">'+Object.keys(all).map(function(s){return '<button type="button" class="wkbtn'+(F.stage===s?' p':'')+'" data-s="'+esc(s)+'">'+esc(s)+' ('+all[s]+')</button>'}).join('')+(F.stage!==''?'<button type="button" class="wkbtn d" id="wkClr">إلغاء الفلتر</button>':'')+'</div>'+
   '<p style="margin:10px 0 0;color:var(--muted);font-size:13px">عدد الأوردرات: <b>'+ORD.length+'</b> — إجمالي الربح المتوقع: <b>'+fmt(tot)+'</b> ج</p></div>'+
   (list.length?list.map(function(o){var st=stages(o.type)[curStage(o)];
    return '<div class="wkc" style="cursor:pointer" data-id="'+esc(o.id)+'"><div class="wkrow" style="justify-content:space-between"><b>'+esc(ordNo(o))+' — '+esc(o.customer||'بدون اسم')+'</b><span class="badge">'+esc(st)+'</span></div>'+
     '<div style="font-size:13px;color:var(--muted);margin-top:4px">'+esc(sysLab(o.type))+' · '+esc(num(o.w))+'×'+esc(num(o.h))+' ×'+esc(o.qty||1)+(o.crafter?' · '+esc(o.crafter):'')+' · '+esc(o.date)+' · السعر '+fmt(num(o.price))+' ج</div>'+miniTl(o)+'</div>'}).join(''):'<div class="wkc"><div class="empty">مفيش أوردرات. اضغط «أوردر جديد».</div></div>');
  b.querySelector('#wkQ').oninput=function(){F.q=this.value};
  b.querySelector('#wkQ').onkeydown=function(e){if(e.key==='Enter'){var q=this.value.trim().toUpperCase();var o=ORD.find(function(x){return ordNo(x)===q});if(o){viewOrder(o.id);return}viewOrders()}};
  b.querySelector('#wkTy').onchange=function(){F.type=this.value;viewOrders()};
  b.querySelector('#wkNew').onclick=function(){viewForm(null,'دلفة')};
  b.querySelectorAll('[data-s]').forEach(function(x){x.onclick=function(){F.stage=x.dataset.s;viewOrders()}});
  var c=b.querySelector('#wkClr');if(c)c.onclick=function(){F.stage='';viewOrders()};
  b.querySelectorAll('[data-id]').forEach(function(x){x.onclick=function(){viewOrder(x.dataset.id)}});
  b.querySelectorAll('[data-sk]').forEach(function(x){x.onclick=async function(){var L=ORD.filter(function(z){return z.id===x.dataset.sk});if(!L.length)return;L.forEach(function(o){o.sysOk=true});try{await saveOrd();viewOrders()}catch(e){errAlert(e)}}});
  b.querySelectorAll('[data-sx]').forEach(function(x){x.onclick=async function(){var o=ORD.find(function(z){return z.id===x.dataset.sx});if(!o)return;var dups=ORD.filter(function(z){return z.id===o.id});
   if(!(await ask('تحوّل '+ordNo(o)+' لنظام الدلفة؟\nالمراحل هتبدأ من «'+stages('دلفة')[0]+'» (تاريخ المراحل القديمة بيفضل محفوظ).','حوّله','لأ')))return;
   dups.forEach(function(o){o.type='دلفة';o.stage=0;o.sysOk=true;(o.hist=o.hist||[]).push({n:stages('دلفة')[0],at:new Date().toISOString(),by:who(),note:'اتنقل من نظام الجرار'})});try{await saveOrd();toast('✔ اتنقل لنظام الدلفة');viewOrders()}catch(e){errAlert(e)}}});
 }
 function viewOrder(id){
  var o=ORD.find(function(x){return x.id===id});if(!o)return viewOrders();
  var b=shell(esc(ordNo(o))+' — '+esc(o.customer||''),viewOrders);mark('ord');
  var st=stages(o.type),c=curStage(o),pct=Math.round(c/(st.length-1)*100);
  var hist={};(o.hist||[]).forEach(function(h){hist[h.n]=h});
  b.innerHTML='<div class="wkc"><div style="font-size:14px;margin-bottom:4px">النظام: <span class="badge">'+esc(sysLab(o.type))+'</span></div><div class="wkrow" style="justify-content:space-between"><b>'+esc(num(o.w))+'×'+esc(num(o.h))+' ×'+esc(o.qty||1)+'</b><span class="badge">'+esc(st[c])+'</span></div>'+
   '<div class="bar" style="margin:10px 0"><i style="width:'+pct+'%"></i></div>'+
   '<div class="tl">'+st.map(function(s,i){var h=hist[s];return '<div class="st '+(i<c?'done':i===c?'cur':'')+'"><span class="dot">'+(i<c?'✓':i+1)+'</span><b>'+esc(s)+'</b>'+(h?'<div style="font-size:12px;color:var(--muted)">'+esc(String(h.at).slice(0,16).replace('T',' '))+(h.by?' — '+esc(h.by):'')+'</div>':'')+'</div>'}).join('')+'</div>'+
   '<div class="wkrow" style="margin-top:6px">'+(c<st.length-1?'<button type="button" class="wkbtn p" id="wkAdv">⏭️ الخطوة الجاية: '+esc(st[c+1])+'</button>':'<span class="badge green">الأوردر خلص</span>')+(c>0?'<button type="button" class="wkbtn" id="wkPrev">↩︎ رجّع خطوة</button>':'')+'</div></div>'+
   (rodsHtml(o)?'<div class="wkc"><div class="sample">'+rodsHtml(o)+'</div>'+rodStockLine(o)+'</div>':'')+
   '<div class="wkc"><h3>الإجراءات</h3><div class="wkrow">'+
   '<button type="button" class="wkbtn p" id="wkPr">🖨️ طباعة ورقة التجهيز</button>'+
   '<button type="button" class="wkbtn" id="wkLb">🏷️ ملصق بباركود</button>'+
   (offLeft(o).length?'<button type="button" class="wkbtn" id="wkOffL">🏷️ ليبل للفضلات ('+offLeft(o).length+')</button>':'')+
   '<button type="button" class="wkbtn" id="wkInv">🧾 فاتورة بيع للعميل</button>'+
   '<button type="button" class="wkbtn" id="wkWa">📲 ابعت للصنايعي واتساب</button>'+
   '<button type="button" class="wkbtn" id="wkEd">✏️ تعديل</button>'+
   '<button type="button" class="wkbtn" id="wkDup">📄 نسخ</button>'+
   '<button type="button" class="wkbtn d" id="wkDel">🗑️ حذف</button></div></div>'+
   '<div class="wkc"><h3>التفاصيل</h3><table><tr><td>العميل</td><td>'+esc(o.customer)+(o.phone?' — '+esc(o.phone):'')+'</td></tr><tr><td>الصنايعي</td><td>'+esc(o.crafter||'—')+'</td></tr>'+
   '<tr><td>التكلفة</td><td>'+fmt(cost(o))+' ج</td></tr><tr><td>سعر البيع</td><td>'+fmt(num(o.price))+' ج</td></tr><tr><td>الربح</td><td><b>'+fmt(profit(o))+' ج</b></td></tr><tr><td>العربون</td><td>'+fmt(num(o.paid))+' ج (باقي '+fmt(num(o.price)-num(o.paid))+' ج)</td></tr>'+
   (o.notes?'<tr><td>ملاحظات</td><td>'+esc(o.notes)+'</td></tr>':'')+'</table></div>'+
   ((o.kind==='hinge'||o.kind==='slide'||o.kind==='frame')?'<div class="wkc"><h3>الرسم</h3><div class="draw">'+svg(o,true)+'</div></div>':'')+
   (o.steel?'<div class="wkc"><h3>الاستانلس</h3>'+steelSummary(o).replace(/<p[^>]*>.*?<\/p>/,'')+'</div>':'')+
   (o.bamboo?'<div class="wkc"><h3>البامبو</h3>'+bambooSummary(o).replace(/<p[^>]*>.*?<\/p>/,'')+'</div>':'');
  function adv(d){
   var n=Math.min(st.length-1,Math.max(0,c+d));o.stage=n;
   if(d>0){o.hist=o.hist||[];o.hist.push({n:st[n],at:new Date().toISOString(),by:who()})}
   saveOrd().then(function(){viewOrder(id)}).catch(errAlert)}
  var a=b.querySelector('#wkAdv');if(a)a.onclick=function(){adv(1)};
  var p=b.querySelector('#wkPrev');if(p)p.onclick=function(){adv(-1)};
  b.querySelector('#wkPr').onclick=function(){printMenu(o)};
  b.querySelector('#wkLb').onclick=function(){printOrder(o,'lab',false)};
  b.querySelector('#wkEd').onclick=function(){o.type==='بامبو'?viewBamboo(id):viewForm(id,o.type)};
  b.querySelector('#wkDup').onclick=async function(){var n=JSON.parse(JSON.stringify(o));n.id=uid();n.no=CFG.next++;wkNewCode(n);n.stage=0;n.hist=[{n:st[0],at:new Date().toISOString(),by:who()}];n.date=today();ORD.push(n);try{await saveOrd();await saveCfg();toast('✔ اتنسخ');viewOrder(n.id)}catch(e){errAlert(e)}};
  b.querySelector('#wkDel').onclick=async function(){if(await ask('تمسح الأوردر ده؟','مسح','لأ')){var dd=ORD.find(function(x){return x.id===id});ORD=ORD.filter(function(x){return x.id!==id});try{await saveOrd();webCancel(dd);viewOrders()}catch(e){errAlert(e)}}};
  var ol=b.querySelector('#wkOffL');if(ol)ol.onclick=function(){printLeftLabels(o)};
  var rc=b.querySelector('#wkRodCut');if(rc)rc.onclick=async function(){
   var needs=rodNeeds(o),prods=needs.map(function(nd){return {nd:nd,prod:(db.products||[]).find(function(p){return String(p.name).trim()===nd.name})}});
   if(!prods.length||prods.some(function(x){return !x.prod}))return;
   var msg='هتخصم من المخزون:\n'+prods.map(function(x){return '• '+x.nd.need+' عود «'+x.nd.name+'»'}).join('\n')+'\n\nمينفعش يترجع. تتأكد؟';
   if(!(await ask(msg,'خصم','لأ')))return;
   rc.disabled=true;
   try{
    var api=window.mkT&&window.mkT.api;
    for(var i=0;i<prods.length;i++){var x=prods[i];
     if(api){await api.syncNow();await api.rpc('mk_adjust_stock',{p_id:x.prod.id,p_qty:num(x.prod.qty)-x.nd.need,p_note:'خصم أعواد '+ordNo(o)+' ('+o.type+' '+num(o.w)+'×'+num(o.h)+'): '+x.nd.need+' عود'});await api.refreshProducts([x.prod.id]);api.done&&api.done()}
    }
    o.rodsDeducted=true;await saveOrd();toast('✔ الأعواد اتخصمت من المخزون');viewOrder(id);
   }catch(e){rc.disabled=false;errAlert(e)}
  };
  b.querySelector('#wkInv').onclick=function(){
   close();
   var L=[],note=ordNo(o)+' — '+o.type;
   if(o.steel){var st=o.steel,pcs=(st.pieces||[]).filter(function(p){return num(p.a)>0&&num(p.b)>0}),tot=num(o.price)||num(st.sug)||0;
    var dv=function(p){var nb=p.shape==='L'?1:(p.shape==='U'||p.shape==='Z')?2:(p.shape==='مخصص'?num(p.bends):0);return num(p.b)+nb*(num(p.flange)||3)};
    var by={},aT=0;pcs.forEach(function(p){var k=p.shape||'مسطحة',ar=num(p.a)*dv(p)*(num(p.q)||1);aT+=ar;by[k]=by[k]||{q:0,ar:0};by[k].q+=(num(p.q)||1);by[k].ar+=ar});
    Object.keys(by).forEach(function(k){var g=by[k],lt=aT?tot*g.ar/aT:0;L.push({name:'شغل استانلس '+(SHN[k]||k)+(st.grade?' '+st.grade:''),qty:g.q,price:Math.round(lt/g.q*100)/100,svc:true})});
    if(st.sheetProd){L.push({name:st.sheetProd,qty:num(st.frac)||num(st.sheets)||1,price:0,internal:true})}
    else toast('⚠️ مفيش لوح متحدد من المخزون — مش هيتخصم لوح');
    note+=' — '+pcs.map(function(p){return (p.n?p.n+': ':'')+(SHN[p.shape]||p.shape)+' '+num(p.a)+'×'+num(p.b)+(p.shape&&p.shape!=='مسطحة'?' ثنية '+(num(p.flange)||3):'')+' ×'+(num(p.q)||1)}).join(' • ')}
   else note+=' '+num(o.w)+'×'+num(o.h)+' ×'+(o.qty||1);
   if(!o.rodsDeducted)rodNeeds(o).forEach(function(nd){L.push({name:nd.name,qty:nd.need})});
   else note+=' — الأعواد اتخصمت قبل كده';
   (o.mats||[]).forEach(function(m){if(m.n&&num(m.q))L.push({name:m.n,qty:num(m.q),price:m.p!==''?num(m.p):null})});
   prepToInvoice({customer:o.customer,phone:o.phone,paid:o.paid,total:o.steel?0:num(o.price),fillName:'مصنعية تجهيز '+(o.type||'شغل'),lines:L,note:note})};
  b.querySelector('#wkWa').onclick=async function(){
   var c0=contacts().find(function(z){return z.name===o.crafter});
   var ph0=(c0&&c0.phone)||prompt('رقم واتساب الصنايعي','')||'';if(!ph0)return;
   var ph=(typeof waNum==='function')?waNum(ph0):ph0.replace(/\D/g,'');
   if(ph.length<11)return toast('الرقم مش صح: '+ph0+' — اكتبه بالصفر الأول (01xxxxxxxxx)');
   var msg='أوردر '+ordNo(o)+' ('+o.type+')\nالعميل: '+(o.customer||'-')+'\nالمقاس: '+num(o.w)+' × '+num(o.h)+' سم\nالكمية: '+(o.qty||1)+(o.kind==='hinge'?'\nالمفصلات: '+hingePositions(o).join(' / ')+' سم من فوق':'')+(o.notes?'\nملاحظات: '+o.notes:'');
   if(!(await ask('أبعت الرسالة دي من رقم المحل؟\n\n'+msg,'ابعت','لأ')))return;
   try{var r=await SBc().from('wa_out').insert({to_phone:ph,body:msg,imgs:[],by_name:who()});if(r.error)throw r.error;toast('✔ الرسالة في الطريق')}catch(e){errAlert(e)}};
 }

 /* تجهيز ← فاتورة بيع مباشرة: الخامات من المخزون تتحط كأصناف متخصمة، واللي مش موجود يتحط سطر يدوي بتنبيه (مش بيوقف الفاتورة) */
 function prepToInvoice(P){
  var miss=[],lines=[],matTot=0,hasInt=false;
  (P.lines||[]).forEach(function(L){
   if(L.internal)hasInt=true;
   var q=num(L.qty)||1;
   if(L.svc){var pr0=num(L.price);lines.push({name:L.name,qty:q,price:pr0});matTot+=q*pr0;return}
   var prod=(db.products||[]).find(function(p){return String(p.name).trim()===String(L.name).trim()})||(L.pid&&(db.products||[]).find(function(p){return p.id===L.pid}));
   var pr=(L.price!=null&&L.price!=='')?num(L.price):(prod?num(prod.price):0);
   lines.push({productId:prod?prod.id:undefined,name:L.name,qty:q,price:pr});matTot+=q*pr;if(!prod)miss.push(L.name)});
  if(P.total&&num(P.total)>matTot+0.01&&P.fillName)lines.push({name:P.fillName,qty:1,price:Math.round((num(P.total)-matTot)*100)/100});
  window.mkOpenSale({person:P.customer||'',phone:P.phone||'',paid:num(P.paid)||undefined,note:(P.note||'')+(hasInt?' — ⚙️ خامات التجهيز متخصمة من المخزون':''),lines:lines,after:P.after});
  toast(miss.length?'⚠️ مش موجود في المخزون (اتحط سطر يدوي): '+miss.join('، '):'✔ الفاتورة جاهزة — راجعها واحفظ');
 }
 window.mkPrepToInvoice=prepToInvoice;
 /* ---------- 🔥 عود الفرفورجيه: بيع بالمتر (تكلفة وسعر وربح أي طول) + عجل/إكسسوار + «طقم جرار وهيسيب قضيبه» + خط سير الدفعات (اشتريناه ← الفرن ← رجع ← دخل المخزن بفاتورة شراء) ---------- */
 var FST=['🛒 اشتريناه','🔥 عند الفرن','✅ رجع متشطّب','📦 دخل المخزن'];
 var FC={rod:'',L:'',lines:[{t:'swap',set:'',m:'',n:1,pr:'',back:'',bv:''}]};
 var FLEN=[2,2.5,3,3.6,4,4.6,5,6];
 /* swap = طقم كامل من المخزون، الزبون ساب قضيبه وخد قضيب مقصوص من العود. القضيب اللي اتساب بيرجع المخزن (قيمته صفر إلا لو اتكتبت) */
 var FTY=[['swap','🔁 طقم كامل والزبون بدّل قضيبه'],['rod','✂️ قطعة عود بالمتر لوحدها'],['item','📦 صنف زي ما هو (طقم كامل / دلفة / غيره)']];
 function fIsM(p){return !!p&&(/متر/.test(p.unit||'')||/بالمتر/.test(p.name||''))}
 function fProd(nm){nm=String(nm||'').trim();return nm?(db.products||[]).find(function(p){return String(p.name).trim()===nm}):null}
 /* كود FR-0001: نفس الشغل (نفس السطور في نفس اليوم) ياخد نفس الكود. بيتكتب على ورقة التجهيز وملاحظة الفاتورة */
 async function frCode(C2){var d=C2.lines.map(function(l){return l.lab+' × '+l.n}).join(' + ');return window.mkPrepCode?await window.mkPrepCode('forf',today()+'|'+d,null,d):''}
 async function viewForf(){
  var b=shell('🔥 عود الفرفورجيه');mark('forf');
  var FO=await get('wk_forf',[]);
  function sv(){return put('wk_forf',FO)}
  var r2=function(x){return Math.round(x*100)/100},r6=function(x){return Math.round(x*1e6)/1e6};
  /* العود: الطول من بيانات الصنف (len)، وتكلفة المتر = تكلفة العود ÷ طوله — مابتتكتبش بإيد */
  function rodInfo(){var p=fProd(FC.rod),isM=fIsM(p),pl=p&&+p.len>0?+p.len:0,L=isM?1:(pl||num(FC.L)||0);
   return {p:p,isM:isM,pl:pl,L:L,cm:p&&L>0?num(p.cost)/L:0,pm:p&&L>0?num(p.price)/L:0,avM:p?num(p.qty)*L:0}}
  function split(qty,L){var full=Math.floor(qty+1e-6),left=r2((qty-full)*L);if(left<0.005)left=0;return {full:full,left:left}}
  function calcF(){var R=rodInfo(),out=[],cost=0,tot=0,need={},err=[];
   FC.lines.forEach(function(x,i){var n=Math.max(1,num(x.n)||1),pr=num(x.pr),c=0,o={i:i,t:x.t,n:n,pr:pr};
    if(x.t==='rod'||x.t==='swap'){var m=num(x.m);if(!(m>0))return;if(!R.p){err.push('اختار العود من المخزون');return}if(!(R.L>0)){err.push('اكتب طول العود');return}
     var rq=R.isM?m:m/R.L;need[R.p.id]=(need[R.p.id]||0)+rq*n;
     if(x.t==='rod'){o.lab=String(R.p.name).trim()+' — '+m+' م';o.comps=[{id:R.p.id,q:r6(rq)}];c=R.cm*m;o.sug=R.pm*m}
     else{var sp=fProd(x.set);if(!sp){err.push('اختار الطقم من المخزون');return}need[sp.id]=(need[sp.id]||0)+n;var bv=num(x.bv);
      o.lab=String(sp.name).trim()+' — بقضيب '+m+' م بدل قضيبه';o.comps=[{id:sp.id,q:1},{id:R.p.id,q:r6(rq)}];o.m=m;o.sp=sp;o.bv=bv;c=num(sp.cost)-bv+R.cm*m;o.sug=num(sp.price)+R.pm*m;
      o.back={name:(x.back||'').trim()||'قضيب راجع من: '+String(sp.name).trim(),q:n,bv:bv}}}
    else{var ip=fProd(x.set);if(!ip)return;need[ip.id]=(need[ip.id]||0)+n;o.lab=String(ip.name).trim();o.pid=ip.id;o.name=ip.name;o.comps=[{id:ip.id,q:1}];c=num(ip.cost)}
    o.cost=r2(c*n);o.tot=r2(pr*n);cost+=c*n;tot+=pr*n;out.push(o)});
   var short=[];Object.keys(need).forEach(function(id){var p=(db.products||[]).find(function(z){return z.id===id});if(!p||need[id]<=num(p.qty)+1e-6)return;
    short.push(R.p&&id===R.p.id&&!R.isM?String(p.name).trim()+': المطلوب '+fmt(r2(need[id]*R.L))+' م والمتاح '+fmt(r2(R.avM))+' م':String(p.name).trim()+': المطلوب '+fmt(r6(need[id]))+' والمتاح '+fmt(num(p.qty)))});
   return {R:R,lines:out,cost:r2(cost),tot:r2(tot),need:need,short:short,err:err}}
  function lineHtml(x,i,C){var o=C.lines.find(function(z){return z.i===i}),ip=fProd(x.set);
   var f='<div class="sample" style="margin-top:8px;border:1px solid var(--border)"><div class="wkg" style="align-items:end"><div class="wkf" style="grid-column:1/-1"><label>نوع الصنف</label><select data-fl="t" data-i="'+i+'">'+FTY.map(function(t){return '<option value="'+t[0]+'"'+(x.t===t[0]?' selected':'')+'>'+t[1]+'</option>'}).join('')+'</select></div>';
   if(x.t!=='rod')f+='<div class="wkf" style="grid-column:1/-1"><label>'+(x.t==='item'?'الصنف من المخزون':'الطقم الكامل من المخزون (أي طقم)')+'</label><input data-fl="set" data-i="'+i+'" list="fcAll" value="'+esc(x.set||'')+'" placeholder="🔎 دوّر في المخزون"></div>';
   if(x.t==='rod'||x.t==='swap')f+='<div class="wkf" style="grid-column:1/-1"><label>'+(x.t==='swap'?'طول القضيب الجديد من العود (متر) — اختار أو اكتب':'الطول اللي الزبون عايزه (متر)')+'</label><div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">'+FLEN.map(function(v){return '<button type="button" class="wkbtn'+(num(x.m)===v?' p':'')+'" data-fm="'+v+'" data-i="'+i+'" style="min-width:52px">'+v+' م</button>'}).join('')+'</div><input data-fl="m" data-i="'+i+'" value="'+esc(x.m)+'" inputmode="decimal" placeholder="طول تاني"></div>';
   var sug=o&&o.sug>0?r2(o.sug):(ip&&num(ip.price)?num(ip.price):0);
   f+=fiL('n',i,'العدد',x.n||1,'inputmode="numeric"')+fiL('pr',i,'سعر البيع للواحد (ج)',x.pr,'inputmode="decimal" placeholder="'+(sug?'مقترح '+fmt(sug):'اكتب السعر')+'"')+'</div>';
   if(x.t==='swap')f+='<details style="margin-top:6px"'+(x.back||num(x.bv)?' open':'')+'><summary style="cursor:pointer;font-size:13px;font-weight:700">↩️ القضيب اللي الزبون ساب: بيرجع المخزن'+(ip?' باسم «'+esc((x.back||'').trim()||'قضيب راجع من: '+String(ip.name).trim())+'»':'')+' بقيمة '+fmt(num(x.bv))+' ج</summary><div class="wkg" style="margin-top:6px">'+fiL('back',i,'اسمه في المخزن (اختياري)',x.back||'','list="fcAll" placeholder="قضيب راجع من: اسم الطقم"')+fiL('bv',i,'قيمته (ج) — سيبها صفر',x.bv||'','inputmode="decimal" placeholder="0"')+'</div></details>';
   f+='<div style="font-size:13px;margin-top:6px;line-height:1.8">'+(o?'تكلفة الواحد <b>'+fmt(r2(o.cost/o.n))+'</b> ج'+(x.t==='swap'?' (الطقم '+fmt(num(o.sp.cost))+(o.bv?' − القضيب اللي رجع '+fmt(o.bv):'')+' + القضيب الجديد '+o.m+' م '+fmt(r2(C.R.cm*o.m))+')':'')+(o.pr?' — ربح الواحد <b>'+fmt(r2(o.pr-o.cost/o.n))+'</b> ج':''):'<span style="color:var(--muted)">كمّل البيانات</span>')+'</div>';
   return f+'<div class="wkrow" style="margin-top:6px"><button type="button" class="wkbtn d" data-fld="'+i+'">حذف السطر</button></div></div>'}
  /* بعد حفظ الفاتورة: القضبان اللي الزبون سابها تدخل المخزن (الصنف بيتعمل لو مش موجود، بتكلفة = القيمة اللي اتكتبت أو صفر) */
  function backAfter(B){if(!B.length)return null;return async function(){var api=window.mkT&&window.mkT.api;if(!api)return;var g={};B.forEach(function(x){(g[x.name]=g[x.name]||{name:x.name,q:0,bv:x.bv}).q+=x.q});
   var fail=[];for(var k in g){var x=g[k],p=null;try{p=fProd(x.name);
    if(!p){p={id:crypto.randomUUID(),code:typeof nextCode==='function'?nextCode():'',name:x.name,cat:'قضبان راجعة',unit:'قطعة',qty:0,price:0,cost:num(x.bv),min:0,barcode:''};if(window.mkCoOn&&typeof curCo==='function')p.co=curCo();db.products.push(p);try{typeof codeNote==='function'&&codeNote(p)}catch(e){}window.save&&window.save()}
    await api.syncNow();await api.refreshProducts([p.id]);var p2=(db.products||[]).find(function(z){return z.id===p.id})||p;
    await api.rpc('mk_adjust_stock',{p_id:p2.id,p_qty:r6(num(p2.qty)+x.q),p_note:'قضيب سابه الزبون من طقم (بيعة فرفورجيه)'});await api.refreshProducts([p2.id])}
    catch(e){fail.push(x.name+' × '+x.q);if(window.mkPend)await mkPend.add({pid:p&&p.id,name:x.name,delta:x.q,cost:x.bv,cat:'قضبان راجعة',note:'قضيب سابه الزبون من طقم (بيعة فرفورجيه)',err:String(e&&e.message||e).slice(0,120)})}}
   api.done&&api.done();if(fail.length)alert('⚠️ الفاتورة اتحفظت ✔ بس القضيب ده مادخلش المخزن:\n'+fail.join('\n')+'\n\nاتسجّل في «حركات مخزون معلّقة» في لوحة التحكم — دوس «نفّذ» لما النت يبقى كويس.');else toast('✔ القضيب اللي اتساب دخل المخزن')}}
  function fiL(k,i,label,val,extra){return '<div class="wkf"><label>'+label+'</label><input data-fl="'+k+'" data-i="'+i+'" value="'+esc(val)+'" '+(extra||'')+'></div>'}
  function draw(){
   var live=FO.filter(function(x){return x.stage<3}),done=FO.filter(function(x){return x.stage>=3}),C=calcF(),R=C.R;
   var isF=function(p){return /فرفور|فورفور|فورج|فرفج/.test((p.name||'')+' '+(p.cat||''))},rods=(db.products||[]).filter(isF).concat((db.products||[]).filter(function(p){return !isF(p)&&/عود|قضيب|عرد/.test(p.name||'')}));
   var allDL='<datalist id="fcAll">'+(db.products||[]).slice(0,3000).map(function(p){return '<option value="'+esc(String(p.name).trim())+'">'}).join('')+'</datalist>';
   var st='';if(R.p&&R.L>0){var s0=split(num(R.p.qty),R.L);st='الرصيد: <b>'+fmt(r2(R.avM))+'</b> م'+(R.isM||!(num(R.p.qty)>0)?'':' = '+[s0.full?'<b>'+s0.full+'</b> عود كامل':'',s0.left?'باقي عود <b>'+fmt(s0.left)+'</b> م':''].filter(Boolean).join(' + '))+'<br>'+(R.isM?'تكلفة المتر <b>'+fmt(r2(R.cm))+'</b> ج':'العود '+fmt(R.L)+' م بتكلفة '+fmt(num(R.p.cost))+' ج ← تكلفة المتر <b>'+fmt(r2(R.cm))+'</b> ج (أوتوماتيك)');
    var used=C.need[R.p.id]||0;if(used>0){var aq=r6(num(R.p.qty)-used),s1=split(aq,R.L);st+='<br>بعد البيع يفضل: <b>'+fmt(r2(aq*R.L)||0)+'</b> م'+(R.isM||!(aq>0)?'':' = '+([s1.full?s1.full+' عود كامل':'',s1.left?'باقي عود <b>'+fmt(s1.left)+'</b> م':''].filter(Boolean).join(' + ')||'0'))}}
   b.innerHTML='<div class="wkc"><h3>✂️ بيع فرفورجيه من المخزون</h3><div class="wkg">'+
     '<div class="wkf" style="grid-column:1/-1"><label>العود اللي بتقص منه (من المخزون — أي عود)</label><input id="fcP" list="fcL" value="'+esc(FC.rod)+'" placeholder="🔎 عود فرفورجيه 6 م"><datalist id="fcL">'+rods.map(function(p){return '<option value="'+esc(String(p.name).trim())+'">'}).join('')+'</datalist></div>'+
     (R.p&&!R.isM&&!R.pl?'<div class="wkf" style="grid-column:1/-1"><label>⚠️ طول العود مش متسجل في بيانات الصنف — اكتبه (متر)</label><div style="display:flex;gap:6px"><input id="fcT" value="'+esc(FC.L)+'" inputmode="decimal" placeholder="6" style="flex:1;min-width:0">'+(window.mkLenOn?'<button type="button" class="wkbtn p" id="fcTs" style="flex:none">💾 احفظه في الصنف</button>':'')+'</div></div>':'')+'</div>'+
     '<div class="sample" style="margin-top:8px;line-height:1.9">'+(R.p?(R.L>0?st:'اكتب طول العود عشان أحسب تكلفة المتر'):(rods.length?'اختار العود':'⚠️ مفيش عود فرفورجيه في المخزون لسه — سجّل دفعة تحت ولما توصل «دخل المخزن» هتتسجل'))+'</div>'+
     FC.lines.map(function(x,i){return lineHtml(x,i,C)}).join('')+
     '<div class="wkrow" style="margin-top:8px;flex-wrap:wrap">'+FTY.map(function(t){return '<button type="button" class="wkbtn" data-fla="'+t[0]+'">➕ '+t[1].replace(/ \(.*\)/,'')+'</button>'}).join('')+'</div>'+
     '<div style="margin-top:12px;padding:12px;border-radius:12px;background:#e8f7ee;border:2px solid #7bcf9a">'+(C.lines.length?C.lines.map(function(l){return '<div style="display:flex;justify-content:space-between;gap:8px"><span>'+esc(l.lab)+(l.n>1?' × '+l.n:'')+'</span><b>'+fmt(l.tot)+'</b></div>'}).join('')+'<div style="border-top:1px dashed #7bcf9a;margin-top:6px;padding-top:6px;font-size:20px;font-weight:900;display:flex;justify-content:space-between"><span>الإجمالي</span><span>'+fmt(C.tot)+' ج</span></div><div style="font-size:13px">مجموع التكاليف '+fmt(C.cost)+' ج — ربحك <b>'+fmt(r2(C.tot-C.cost))+'</b> ج</div>':'<span style="color:var(--muted)">اختار العود وضيف الأصناف</span>')+'</div>'+
     (C.short.length?'<div style="margin-top:8px;padding:10px;border-radius:10px;background:#fff4e0;color:#a66a00;font-weight:700">⚠️ ناقص في المخزون (الفاتورة هتتعمل عادي والرصيد هيبقى بالسالب):<br>'+C.short.map(esc).join('<br>')+'</div>':'')+
     '<button type="button" class="wkbtn p" id="fcGo" style="margin-top:10px;width:100%;min-height:52px;font-size:17px">🧾 افتح الفاتورة</button>'+
     '<button type="button" class="wkbtn" id="fcPrep" style="margin-top:8px;width:100%">🖨️ طباعة ورق التجهيز</button>'+
     '<div style="margin-top:6px;font-size:12px;color:var(--muted);text-align:center">نسخة السيستم: '+(typeof APP_VER!=='undefined'?APP_VER:'?')+' — لو ناقص في المخزون الفاتورة بتتعمل والرصيد بيبقى بالسالب</div>'+
     (!C.lines.some(function(l){return l.t==='swap'})&&C.lines.length>1?'<button type="button" class="wkbtn" id="fcKit" style="margin-top:8px;width:100%">💾 احفظ الأصناف دي كطقم واحد (كود + باركود)</button>':'')+allDL+'</div>'+
    '<div class="wkc"><h3>➕ دفعة جديدة (حديد بيور من المورد)</h3><div class="wkg">'+fi('foS','اشتريناه من','السبتية')+fi('foN','عدد الأعواد','','inputmode="numeric"')+fi('foL','طول العود (متر)',6,'inputmode="decimal"')+fi('foC','سعر العود الحديد (ج)','','inputmode="decimal"')+fi('foO','الفرن (اختياري)','','')+'</div><button type="button" class="wkbtn p" id="foAdd" style="margin-top:10px">حفظ الدفعة</button></div>'+
    '<div class="wkc"><h3>🚚 في الطريق ('+live.length+')</h3>'+(live.map(card).join('')||'<span class="empty">مفيش دفعات شغالة</span>')+'</div>'+
    (done.length?'<div class="wkc"><h3>📦 اتسجلت في المخزن ('+done.length+')</h3>'+done.slice(0,20).map(card).join('')+'</div>':'');
   var Q=function(i){return b.querySelector('#'+i)};
   var re=function(){var a=document.activeElement&&document.activeElement.id,ds=document.activeElement&&document.activeElement.dataset,pos=document.activeElement&&document.activeElement.selectionStart;draw();var el=a?Q(a):(ds&&ds.fl?b.querySelector('[data-fl="'+ds.fl+'"][data-i="'+ds.i+'"]'):null);if(el){el.focus();try{el.setSelectionRange(pos,pos)}catch(e){}}};
   var deb=function(fn){var t;return function(){var self=this;clearTimeout(t);t=setTimeout(function(){fn.call(self)},450)}};
   Q('fcP').addEventListener('change',function(){FC.rod=this.value.trim();re()});
   if(Q('fcT'))Q('fcT').addEventListener('input',deb(function(){FC.L=Q('fcT').value;re()}));
   if(Q('fcTs'))Q('fcTs').onclick=async function(){var L=num(Q('fcT').value),p=rodInfo().p;if(!(L>0))return toast('اكتب طول العود');if(!p)return;
    this.disabled=true;this.textContent='جاري الحفظ...';p.len=L;try{window.save&&window.save();var api=window.mkT&&window.mkT.api;if(api)await api.syncNow();toast('✔ الطول اتحفظ في بيانات الصنف: '+L+' م')}catch(e){errAlert(e)}draw()};
   b.querySelectorAll('[data-fl]').forEach(function(x){var k=x.dataset.fl;x.addEventListener(k==='t'||k==='set'||k==='back'?'change':'input',(k==='t'||k==='set'||k==='back'?function(f){return f}:deb)(function(){var it=FC.lines[+x.dataset.i];if(!it)return;it[k]=x.value.trim();if(k==='t'&&it.t==='rod')it.set='';re()}))});
   b.querySelectorAll('[data-fm]').forEach(function(x){x.onclick=function(){var it=FC.lines[+x.dataset.i];if(it){it.m=x.dataset.fm;draw()}}});
   b.querySelectorAll('[data-fld]').forEach(function(x){x.onclick=function(){FC.lines.splice(+x.dataset.fld,1);if(!FC.lines.length)FC.lines.push({t:'swap',set:'',m:'',n:1,pr:'',back:'',bv:''});draw()}});
   b.querySelectorAll('[data-fla]').forEach(function(x){x.onclick=function(){FC.lines.push({t:x.dataset.fla,m:'',n:1,pr:'',set:'',back:'',bv:''});draw();var L=b.querySelectorAll('[data-fl="'+(x.dataset.fla==='rod'?'m':'set')+'"]');if(L.length)L[L.length-1].focus()}});
   Q('fcGo').onclick=async function(){var C2=calcF();if(C2.err.length)return toast(C2.err[0]);if(!C2.lines.length)return toast(C2.R.p?'ضيف صنف واكتب الطول':'اختار العود من المخزون');
    var np=C2.lines.find(function(l){return !(l.pr>0)});if(np)return toast('اكتب سعر البيع لـ «'+np.lab+'»');
    if(C2.short.length)toast('⚠️ ناقص في المخزون — الرصيد هيبقى بالسالب');
    var frc=await frCode(C2),note='فرفورجيه: '+C2.lines.map(function(l){return l.lab+(l.n>1?' × '+l.n:'')}).join(' + ')+(frc?' — '+frc:'');
    close();
    prepToInvoice({customer:'',phone:'',note:note,
     lines:C2.lines.filter(function(l){return l.t==='item'}).map(function(l){return {name:l.name,pid:l.pid,qty:l.n,price:l.pr}}),
     kits:C2.lines.filter(function(l){return l.t==='rod'||l.t==='swap'}).map(function(l){return {name:l.lab,n:l.n,price:l.pr,comps:l.comps}}),
     after:backAfter(C2.lines.filter(function(l){return l.back}).map(function(l){return l.back}))})};
   Q('fcPrep').onclick=async function(){var C2=calcF();if(!C2.lines.length)return toast('ضيف أصناف الأول');
    var frc=await frCode(C2);
    window.mkPrepPrint&&mkPrepPrint({code:frc,no:'فرفورجيه',date:today(),src:'بيع فرفورجيه',lines:C2.lines.map(function(l){return {name:l.lab,qty:l.n,unit:'',dims:(l.t==='rod'||l.t==='swap')?'قص '+num(FC.lines[l.i].m)+' م من «'+String(C2.R.p?C2.R.p.name:'').trim()+'»':'',sub:l.t==='swap'?['القضيب الأصلي بتاع الطقم يرجع المخزن']:[]}})})};
   if(Q('fcKit'))Q('fcKit').onclick=async function(){var C2=calcF();if(C2.err.length)return toast(C2.err[0]);if(!C2.lines.length)return toast('ضيف أصناف الأول');
    if(!window.mkKT||!mkKT.addKit)return toast('شاشة الأطقم لسه بتحمّل — جرّب كمان شوية');
    var nm=prompt('اسم الطقم',C2.lines.length===1?C2.lines[0].lab:C2.lines.map(function(l){return l.lab}).join(' + '));if(!nm)return;
    var slots=[];C2.lines.forEach(function(l){l.comps.forEach(function(c){var p=(db.products||[]).find(function(z){return z.id===c.id});if(!p)return;
     if(C2.R.p&&c.id===C2.R.p.id&&!C2.R.isM)slots.push({label:'قضيب / عود '+fmt(r2(c.q*C2.R.L*l.n))+' م',mode:'len',qty:r2(c.q*C2.R.L*l.n),ulen:C2.R.L,per:1,products:[c.id]});
     else slots.push({label:String(p.name).trim(),mode:'fixed',qty:r6(c.q*l.n),per:1,products:[c.id]})})});
    this.disabled=true;this.textContent='جاري الحفظ...';
    try{var k=await mkKT.addKit({name:nm.trim(),param:'طقم',def:1,sp:C2.tot||'',slots:slots});if(k)toast('✔ الطقم اتحفظ — كود '+k.code+' / باركود '+k.barcode+' (في شاشة الأطقم والتركيبات)')}catch(e){errAlert(e)}draw()};
   Q('foAdd').onclick=async function(){var n=num(Q('foN').value),c=num(Q('foC').value);if(!(n>0))return toast('اكتب عدد الأعواد');
    FO.unshift({id:uid(),date:today(),supplier:Q('foS').value.trim(),n:n,len:num(Q('foL').value)||6,steel:c,oven:Q('foO').value.trim(),ovenCost:0,stage:0,hist:[{s:FST[0],at:new Date().toISOString(),by:who()}]});
    try{await sv();toast('✔ اتسجلت');draw()}catch(e){errAlert(e)}};
   b.querySelectorAll('[data-fa]').forEach(function(x){x.onclick=function(){adv(x.dataset.fa)}});
   b.querySelectorAll('[data-fd]').forEach(function(x){x.onclick=async function(){if(!(await ask('تمسح الدفعة دي من المتابعة؟ (المخزن مش هيتأثر)','مسح','لأ')))return;FO=FO.filter(function(z){return z.id!==x.dataset.fd});try{await sv();draw()}catch(e){errAlert(e)}}});
  }
  function card(x){var u=num(x.steel)+num(x.ovenCost);
   return '<div class="sample" style="margin-bottom:8px"><b>'+x.n+' عود × '+x.len+' م</b> — '+esc(x.supplier||'')+' <small>('+esc(x.date)+')</small><div style="margin:6px 0">'+FST.map(function(t,i){return '<span class="badge" style="margin:2px;'+(i<=x.stage?'background:#d7f3dd':'opacity:.5')+'">'+t+'</span>'}).join('')+'</div>'+
    '<div style="font-size:13px;color:var(--muted)">'+x.hist.map(function(h){return esc(h.s)+' '+esc(String(h.at).slice(0,10))}).join(' ← ')+'</div>'+
    '<div style="margin-top:4px">حديد: '+fmt(num(x.steel))+' ج للعود'+(x.stage>=2?' + فرن: '+fmt(num(x.ovenCost))+' = <b>'+fmt(u)+' ج للعود</b> ('+fmt(Math.round(u/(num(x.len)||6)*100)/100)+' ج للمتر)':'')+(x.oven?' · الفرن: '+esc(x.oven):'')+(x.inv?' · فاتورة '+esc(x.inv):'')+'</div>'+
    '<div class="wkrow" style="margin-top:8px">'+(x.stage<3?'<button type="button" class="wkbtn p" data-fa="'+x.id+'">'+['← راح الفرن','← رجع متشطّب','← دخل المخزن'][x.stage]+'</button>':'')+'<button type="button" class="wkbtn d" data-fd="'+x.id+'">حذف</button></div></div>'}
  async function adv(id){
   var x=FO.find(function(z){return z.id===id});if(!x)return;
   try{
    if(x.stage===0){var ov=prompt('اسم الفرن (إلكتروستاتيك)',x.oven||'');if(ov===null)return;x.oven=ov.trim()}
    else if(x.stage===1){var c=prompt('تكلفة الفرن للعود الواحد (ج)',x.ovenCost||'');if(c===null)return;x.ovenCost=num(c)}
    else if(x.stage===2){
     var ex0=(db.products||[]).find(function(p){return /فرفور|فورفور|فورج/.test(p.name||'')&&fIsM(p)});
     var nm=prompt('اسم المنتج في المخزن (بيتسجل بالمتر)',x.pname||(ex0?ex0.name:'عود فرفورجيه (بالمتر)'));if(!nm)return;nm=nm.trim();x.pname=nm;
     var prod=fProd(nm),isM=prod?fIsM(prod):true,L=num(x.len)||6,u=num(x.steel)+num(x.ovenCost);
     var pmIn=prompt('سعر بيع المتر للزبون (ج) — سيبه فاضي لو مش عايز تغيّره',prod&&num(prod.price)?(isM?num(prod.price):Math.round(num(prod.price)/L*100)/100):'');if(pmIn===null)return;
     var paidAll=await ask('هيتعمل فاتورة شراء: '+x.n+' عود × '+L+' م = '+(isM?x.n*L+' متر':x.n+' عود')+'\nالتكلفة '+fmt(u)+' ج للعود (حديد + فرن)\nالإجمالي '+fmt(u*x.n)+' ج\n\nاتدفعت كلها؟','اتدفعت','آجل على المورد');
     var api=window.mkT&&window.mkT.api;if(!api||!api.rpc)throw new Error('السيستم لسه بيحمّل — جرّب كمان شوية');
     var qty=isM?Math.round(x.n*L*1000)/1000:x.n,pr=isM?Math.round(u/L*100)/100:u,tot=Math.round(qty*pr*100)/100;
     var r=await api.rpc('mk_save_invoice',{p:Object.assign({},window.mkCoOn&&typeof curCo==='function'?{co:curCo()}:{},{kind:'purchase',date:new Date().toISOString().slice(0,10),person:x.supplier||'السبتية',paid:paidAll?tot:0,source:'',note:'فرفورجيه: '+x.n+' عود × '+L+' م — حديد '+fmt(num(x.steel))+' + فرن '+fmt(num(x.ovenCost))+' للعود'+(x.oven?' ('+x.oven+')':''),items:[{product_id:prod?prod.id:null,name:nm,qty:qty,price:pr}]})});
     x.inv=(r&&r.no)||'';
     try{await api.refreshInvoices([r.id])}catch(e){}
     try{var c2=window.mkSB,qq=await c2.from('mk_products').select('id').eq('name',nm).limit(1);var pid=qq.data&&qq.data[0]&&qq.data[0].id;
      if(pid){await api.refreshProducts([pid]);var p3=(db.products||[]).find(function(z){return z.id===pid});if(p3){var ch=false;if(!prod){p3.unit='متر';p3.cat=p3.cat||'فرفورجيه';ch=true}if(pmIn!==''&&num(pmIn)>0){p3.price=isM?num(pmIn):Math.round(num(pmIn)*L*100)/100;ch=true}if(ch){window.save&&window.save();await api.syncNow()}}}api.done&&api.done()}catch(e){}
     toast('✔ دخل المخزن: '+(isM?qty+' متر':qty+' عود')+' — تكلفة المتر '+fmt(Math.round(u/L*100)/100)+' ج'+(x.inv?' — فاتورة '+x.inv:''))}
    x.stage++;x.hist.push({s:FST[x.stage],at:new Date().toISOString(),by:who()});await sv();draw()
   }catch(e){errAlert(e)}}
  draw();
 }
 /* ---------- 🪵 حساب الأعواد للضلفة: جنبين (الارتفاع) + فوق وتحت (العرض)، والمقبض على جنب أو الجنبين أو مفيش، أو شاسيه ثابت ---------- */
 /* فئات الأعواد: قابلة للتعديل من إعدادات أنظمة الشغل (عود عادي ومقبض كل واحد ممكن يبقى منتج مختلف). لو عبده ماعدّلش حاجة، بتستخدم القايمة دي كبداية. */
 function rodTypeDefs(){
  if(CFG.rodTypes&&CFG.rodTypes.length)return CFG.rodTypes;
  return [
   {k:'blumG',n:'بلوم G',pLen:600,pProd:'عود بدون 6 م بلوم G',hLen:600,hProd:'عود بمقبض 6 م بلوم'},
   {k:'blumR',n:'بلوم R',pLen:600,pProd:'عود بدون 6 م بلوم R',hLen:600,hProd:'عود بمقبض 6 م بلوم'},
   {k:'blumGG',n:'بلوم GG',pLen:600,pProd:'عود بدون 6 م بلوم GG',hLen:600,hProd:'عود بمقبض 6 م بلوم'},
   {k:'bevL',n:'شطف خفيف',pLen:300,pProd:'بدون 3 متر خفيف',hLen:270,hProd:'بمقبض 3 م خفيف'},
   {k:'bevM',n:'شطف وسط',pLen:300,pProd:'بدون 3 متر وسط',hLen:270,hProd:'بمقبض 3 م وسط'},
   {k:'bevH',n:'شطف تقيل',pLen:300,pProd:'بدون 3 متر تقيل',hLen:270,hProd:'بمقبض 3 م تقيل'}
  ];
 }
 function rodType(k){var L=rodTypeDefs();return L.find(function(x){return x.k===k})||L[0]}
 /* خصم الأعواد من المخزون: العود العادي والمقبض ممكن يبقوا منتجين مختلفين، كل واحد بيتخصم من منتجه */
 function rodNeeds(o){
  var r=rodCalc(o);if(!r)return [];var m={},pN=o.secProd||r.T.pProd,hN=o.secProd||r.T.hProd;
  if(r.pp.length)m[pN]=(m[pN]||0)+r.pp.length;
  if(r.hp.length)m[hN]=(m[hN]||0)+r.hp.length;
  if(o.corner!=='no'&&o.cornerProd)m[o.cornerProd]=(m[o.cornerProd]||0)+4*(num(o.qty)||1);
  return Object.keys(m).map(function(n){return {name:n,need:m[n]}});
 }
 function rodStockLine(o){
  if(o.handle==='frame')return '';
  var needs=rodNeeds(o);if(!needs.length)return '';
  if(o.rodsDeducted)return '<div class="sample" style="margin-top:6px;background:var(--tint2)">✔ الأعواد اتخصمت من المخزون</div>';
  var rows=needs.map(function(nd){
   var prod=(db.products||[]).find(function(p){return String(p.name).trim()===nd.name});
   if(!prod)return '⚠️ مفيش منتج اسمه «'+esc(nd.name)+'» بالظبط في المخزون — سجّله عشان أقدر أخصم منه';
   return '📦 هتاخد <b>'+nd.need+'</b> '+(nd.name===o.cornerProd?'زاوية':'أعواد')+' من «'+esc(nd.name)+'» (المتاح <b>'+esc(prod.qty)+'</b>)'+(num(prod.qty)<nd.need?' <b style="color:var(--danger)">(مش كفاية)</b>':'');
  });
  var allOk=needs.every(function(nd){return (db.products||[]).some(function(p){return String(p.name).trim()===nd.name})});
  return '<div class="sample" style="margin-top:6px;background:var(--tint2)">'+rows.join('<br>')+(allOk?'<div style="margin-top:6px"><button type="button" class="wkbtn p" id="wkRodCut">📦 خصم الأعواد من المخزون</button></div>':'')+'</div>';
 }
 var HANDLES=[['one','جنب واحد بمقبض'],['both','الجنبين بمقبض'],['none','من غير مقبض'],['ext','مقبض خارجي (لطش) — الأعواد كلها عادية'],['frame','شاسيه ثابت (فريم بس)']];
 function rodCalc(o){var w=num(o.w),h=num(o.h),q=Math.max(1,num(o.qty)||1);if(!(w>0&&h>0)||o.kind==='other'||(o.type!=='دلفة'&&o.type!=='جرار'))return null;
  var hc={none:0,one:1,both:2,ext:0,frame:0}[o.handle||'one'];if(hc==null)hc=1;
  var T=Object.assign({},rodType(o.rod)),P=[],H=[],i,k;
  /* الطول من بيانات الصنف (len بالمتر) لو متسجل — غير كده طول الإعدادات زي الأول */
  [['pLen',o.secProd||T.pProd],['hLen',o.secProd||T.hProd]].forEach(function(z){var p=fProd(z[1]);if(p&&+p.len>0)T[z[0]]=Math.round(+p.len*100)});
  for(i=0;i<q;i++){for(k=0;k<2-hc;k++)P.push(h);for(k=0;k<hc;k++)H.push(h);P.push(w,w)}
  return {T:T,P:P,H:H,pp:P.length?plan(P,T.pLen,num(RC.kerf)||0):[],hp:H.length?plan(H,T.hLen,num(RC.kerf)||0):[],bad:P.some(function(x){return x>T.pLen})||H.some(function(x){return x>T.hLen}),meters:Math.round(P.concat(H).reduce(function(a,b){return a+b},0))/100};
 }
 function rodsHtml(o){var r=rodCalc(o);if(!r)return '';
  var lf=r.pp.concat(r.hp).map(function(b){return Math.round(b.left)}).filter(function(x){return x>0});
  return '🪵 <b>الخامات — الأعواد ('+esc(r.T.n)+')</b>: '+(r.pp.length?'<b>'+r.pp.length+'</b> عود «'+esc(r.T.pProd)+'»':'')+(r.pp.length&&r.hp.length?' + ':'')+(r.hp.length?'<b>'+r.hp.length+'</b> عود «'+esc(r.T.hProd)+'»':'')+
   ' — القطع: '+r.P.length+' عادي'+(r.H.length?' + '+r.H.length+' بمقبض':'')+' — إجمالي '+fmt(r.meters)+' م'+
   (lf.length?'<br><small>الفضلات اللي هتفضل: '+lf.join('، ')+' سم</small>':'')+(r.bad?'<br><b style="color:#c0392b">⚠️ في قطعة أطول من العود</b>':'')+'<br><small>الأعواد بتتباع للنجار في فاتورة، والفضلات بتاعته.</small>';
 }
 /* 💰 أسعار المصنعية للضلفة (من الإعدادات، عبده بيغيّرها) */
 function rates(){var r=Object.assign({hF:70,sF:100,hP:100,sP:150},CFG.rates||{});return r}
 function workCalc(o){var q=Math.max(1,num(o.qty)||1),r=rates(),sl=o.kind==='slide';return {q:q,fee:sl?r.sF:r.hF,price:sl?r.sP:r.hP,feeT:q*(sl?r.sF:r.hF),priceT:q*(sl?r.sP:r.hP),sl:sl}}
 /* 🏷️ ليبل للفضلات اللي طلعت من الشغل (بتاعة الزبون) */
 function offLeft(o){var r=rodCalc(o);if(!r)return [];var L=[];[[r.pp,'عادي',r.T.pProd,r.T.pLen],[r.hp,'بمقبض',r.T.hProd,r.T.hLen]].forEach(function(z){z[0].forEach(function(bx){var lf=Math.round(bx.left);if(lf>=10)L.push({len:lf,t:z[1],item:z[2],orig:z[3]})})});return L}
 async function printLeftLabels(o){var L=offLeft(o);if(!L.length)return toast('مفيش فضلات تستاهل ليبل');
  /* كل فضلة بتتسجّل بكودها (FD-) وصاحبها والأوردر اللي طلعت منه — عشان مسح ليبلها يفتح بياناتها هي مش الأوردر. نفس الأوردر لو اتطبع تاني بياخد نفس الأكواد */
  try{var O=await get('wk_offcuts',[]);CFG.offNext=CFG.offNext||1;var mine=O.filter(function(z){return z.orderId===o.id}),isNew=false;
   L.forEach(function(x,i){var rec=mine[i];if(!rec){rec={id:uid(),code:offCode(CFG.offNext++),item:x.item,color:o.color||'',len:x.len,orig:x.orig,place:'',status:'بتاعة الزبون',date:today(),owner:o.customer||'',crafter:o.crafter||'',order:ordNo(o),orderId:o.id};O.push(rec);mine.push(rec);isNew=true}x.code=rec.code});
   if(isNew){await put('wk_offcuts',O);await saveCfg()}}catch(e){return errAlert(e)}
  var pg=L.map(function(x){return '<div class="lb"><b>'+esc(o.customer||'')+'</b><br>فضلة '+esc(x.t)+' — <b style="font-size:13px">'+x.len+' سم</b><br>'+esc(x.code)+(o.color?' — '+esc(o.color):'')+'<br><svg class="bc" data-v="'+esc(x.code)+'"></svg></div>'}).join('');
  var html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:50mm 30mm;margin:0}*{box-sizing:border-box;font-family:Cairo,Tahoma,Arial,sans-serif;color:#000}body{margin:0}.lb{width:48mm;height:28mm;margin:0 auto;padding:1mm;overflow:hidden;font-size:9px;text-align:center;page-break-after:always}svg{max-width:100%}</style></head><body>'+pg+
   '<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"><\/script><script>window.onload=function(){document.querySelectorAll("svg.bc").forEach(function(x){try{JsBarcode(x,x.dataset.v,{format:"CODE128",displayValue:false,margin:0,height:16})}catch(e){}})}<\/script></body></html>';
  if(typeof window.mkPrintHTML==='function')window.mkPrintHTML(html);
 }
 /* 🧮 حاسبة الأعواد: النجار يقولك مقاسات الدرف، والسيستم يقولك هياخدوا كام عود */
 var RC={rows:[{w:'',h:'',q:1,kind:'hinge',handle:'one'}],rod:'blum',kerf:0.5};
 function viewRods(){
  var b=shell('🧮 حاسبة الأعواد');mark('rods');
  /* طول العود من بيانات الصنف في المخزون (len بالمتر). لو مش متسجل: طول الإعدادات + تنبيه — مفيش تخمين من الاسم */
  function rodSrc(nm,cfg){var p=fProd(nm);return p&&+p.len>0?{len:Math.round(+p.len*100),p:p,ok:1}:{len:cfg,p:p,ok:0}}
  function draw(){
   var R0=rodType(RC.rod),SP=rodSrc(R0.pProd,R0.pLen),SH=rodSrc(R0.hProd,R0.hLen),R=Object.assign({},R0,{pLen:SP.len,hLen:SH.len}),P=[],H=[],work={fee:0,price:0,n:0},r0=rates();
   RC.rows.forEach(function(x){var w=num(x.w),h=num(x.h),q=Math.max(1,num(x.q)||1);if(!(w>0&&h>0))return;var hc={none:0,one:1,both:2,ext:0,frame:0}[x.handle];if(hc==null)hc=1;
    for(var i=0;i<q;i++){for(var k=0;k<2-hc;k++)P.push(h);for(k=0;k<hc;k++)H.push(h);P.push(w,w)}
    if(x.handle!=='frame'){work.n+=q;work.fee+=q*(x.kind==='slide'?r0.sF:r0.hF);work.price+=q*(x.kind==='slide'?r0.sP:r0.hP)}});
   var KF=num(RC.kerf)||0,pp=P.length?plan(P,R.pLen,KF):[],hp=H.length?plan(H,R.hLen,KF):[],bad=P.some(function(x){return x>R.pLen})||H.some(function(x){return x>R.hLen});
   var lf=pp.concat(hp).map(function(x){return Math.round(x.left)}).filter(function(x){return x>0});
   b.innerHTML='<div class="wkc"><h3>نوع العود</h3><div class="wkf"><select id="rcR">'+rodTypeDefs().map(function(t){return '<option value="'+t.k+'"'+(RC.rod===t.k?' selected':'')+'>'+esc(t.n)+'</option>'}).join('')+'</select></div><div class="wkf" style="margin-top:8px"><label>سمك المنشار (سم) — اختياري، 0 لو مش عايز</label><input id="rcK" value="'+esc(RC.kerf)+'" inputmode="decimal"></div></div>'+
    '<div class="wkc"><h3>مقاسات الدرف</h3>'+RC.rows.map(function(x,i){return '<div class="wkg" style="margin-bottom:8px;align-items:end">'+
     '<div class="wkf"><label>العرض (سم)</label><input data-r="w" data-i="'+i+'" value="'+esc(x.w)+'" inputmode="decimal"></div><div class="wkf"><label>الارتفاع (سم)</label><input data-r="h" data-i="'+i+'" value="'+esc(x.h)+'" inputmode="decimal"></div>'+
     '<div class="wkf"><label>العدد</label><input data-r="q" data-i="'+i+'" value="'+esc(x.q)+'" inputmode="numeric"></div>'+
     '<div class="wkf"><label>النوع</label><select data-r="kind" data-i="'+i+'"><option value="hinge"'+(x.kind==='hinge'?' selected':'')+'>مفصلي</option><option value="slide"'+(x.kind==='slide'?' selected':'')+'>جرار</option></select></div>'+
     '<div class="wkf"><label>المقبض</label><select data-r="handle" data-i="'+i+'">'+HANDLES.map(function(h){return '<option value="'+h[0]+'"'+(x.handle===h[0]?' selected':'')+'>'+h[1]+'</option>'}).join('')+'</select></div>'+
     '<button type="button" class="wkbtn d" data-x="'+i+'">حذف</button></div>'}).join('')+'<button type="button" class="wkbtn" id="rcA">➕ مقاس تاني</button></div>'+
    '<div class="wkc"><h3>🪵 الخامات (الأعواد)</h3>'+(P.length+H.length?(function(){var t=function(S,nm,lab){return '📏 '+lab+' محسوب على عود <b>'+fmt(S.len/100)+' م</b> «'+esc(nm)+'»'+(S.ok?'':' <span style="color:#b45309">— '+(S.p?'الطول مش متسجل في بيانات الصنف، استخدمت طول الإعدادات. سجّله من شاشة المنتج (خانة «طول العود»)':'الصنف ده مش موجود في المخزون بالاسم ده، استخدمت طول الإعدادات')+'</span>')};
     return '<div class="sample" style="margin-bottom:8px;line-height:1.9;font-size:15px">'+(P.length?t(SP,R.pProd,'العادي'):'')+(P.length&&H.length?'<br>':'')+(H.length?t(SH,R.hProd,'المقبض'):'')+'</div>'})()+'<div class="wkg"><div class="sample">عود من غير مقبض: <b style="font-size:22px">'+pp.length+'</b></div><div class="sample">عود بمقبض: <b style="font-size:22px">'+hp.length+'</b></div><div class="sample">القطع: '+P.length+' عادي + '+H.length+' بمقبض</div><div class="sample">الأمتار: '+fmt(Math.round(P.concat(H).reduce(function(a,c){return a+c},0))/100)+' م</div></div>'+
     (function(){var rowsB=function(arr,nm,len){return arr.map(function(x,i){return '<div style="font-size:13px;padding:4px 0;border-top:1px dashed var(--border)">'+nm+' '+(i+1)+' ('+len+' سم): '+x.cuts.join(' + ')+' ← فضل <b>'+Math.round(x.left)+'</b> سم</div>'}).join('')};
     return '<div style="margin-top:8px"><b>محتاج '+(pp.length+hp.length)+' عود: '+pp.length+' عود عادي + '+hp.length+' عود بمقبض</b>'+rowsB(pp,'عود',R.pLen)+rowsB(hp,'عود مقبض',R.hLen)+'</div><button type="button" class="wkbtn p" id="rcInv" style="margin-top:10px;width:100%;min-height:50px;font-size:17px">🧾 حوّل لفاتورة</button><button type="button" class="wkbtn" id="rcPrep" style="margin-top:8px;width:100%">🖨️ طباعة ورق التجهيز</button>'})()+
     (lf.length?'<p style="margin:8px 0 0;font-size:13px">الفضلات: '+lf.join('، ')+' سم</p><button type="button" class="wkbtn" id="rcOff">🧰 سجّل الفضل الصالح في شاشة الفضل</button>':'')+(bad?'<p style="color:#c0392b">⚠️ في قطعة أطول من العود</p>':''):'<span class="empty">اكتب مقاسات الدرف</span>')+'</div>'+
    '<div class="wkc"><h3>🔧 المصنعية (تقريبي من أسعار الإعدادات)</h3>'+(work.n?'<div class="wkg"><div class="sample">عدد الدرف: <b>'+work.n+'</b></div><div class="sample">للصنايعي: <b>'+fmt(work.fee)+'</b> ج</div><div class="sample">على الزبون: <b>'+fmt(work.price)+'</b> ج</div><div class="sample">ربحك: <b>'+fmt(work.price-work.fee)+'</b> ج</div></div>':'<span class="empty">—</span>')+'</div>';
   b.querySelector('#rcR').onchange=function(){RC.rod=this.value;draw()};
   b.querySelector('#rcK').onchange=function(){RC.kerf=this.value===''?0:num(this.value);draw()};
   var rcP=b.querySelector('#rcPrep');if(rcP)rcP.onclick=function(){var L=[];
    RC.rows.forEach(function(x){if(num(x.w)>0&&num(x.h)>0)L.push({name:'درفة '+(x.kind==='slide'?'جرار':'مفصلي'),qty:Math.max(1,num(x.q)||1),unit:'',dims:num(x.w)+' × '+num(x.h)+' سم — '+(HANDLES.find(function(h){return h[0]===x.handle})||['',''])[1]})});
    pp.forEach(function(x,i){L.push({name:'عود «'+R.pProd+'» '+(i+1),qty:1,unit:'عود',dims:'قص: '+x.cuts.join(' + ')+' سم — يفضل '+Math.round(x.left)+' سم'})});
    hp.forEach(function(x,i){L.push({name:'عود مقبض «'+R.hProd+'» '+(i+1),qty:1,unit:'عود',dims:'قص: '+x.cuts.join(' + ')+' سم — يفضل '+Math.round(x.left)+' سم'})});
    window.mkPrepPrint&&mkPrepPrint({no:'حاسبة الأعواد',date:today(),src:R.n+' — على عود '+fmt(R.pLen/100)+' م',lines:L})};
   var rcI=b.querySelector('#rcInv');if(rcI)rcI.onclick=async function(){var need={};if(pp.length)need[R.pProd]=(need[R.pProd]||0)+pp.length;if(hp.length)need[R.hProd]=(need[R.hProd]||0)+hp.length;
    var miss=[],short=[];Object.keys(need).forEach(function(nm){var p=fProd(nm);if(!p)miss.push(nm);else if(num(p.qty)<need[nm])short.push('«'+nm+'»: محتاج '+need[nm]+' والمتاح '+fmt(num(p.qty)))});
    if(miss.length)return toast('⚠️ مش موجود في المخزون بالاسم ده: '+miss.join('، ')+' — عدّل الاسم من إعدادات أنظمة الشغل');
    if(short.length&&!(await ask('⚠️ المخزون ناقص:\n'+short.join('\n')+'\n\nتفتح الفاتورة برضه؟ (الخصم بيحصل بس لما تحفظ الفاتورة)','افتح الفاتورة','لأ')))return;
    close();prepToInvoice({customer:'',phone:'',note:'حاسبة الأعواد ('+R.n+'): '+RC.rows.filter(function(x){return num(x.w)>0&&num(x.h)>0}).map(function(x){return (Math.max(1,num(x.q)||1))+' درفة '+num(x.w)+'×'+num(x.h)}).join(' + '),
     lines:Object.keys(need).map(function(nm){return {name:nm,qty:need[nm]}})})};
   var rcO=b.querySelector('#rcOff');if(rcO)rcO.onclick=async function(){try{var O=await get('wk_offcuts',[]),mn=num(CFG.minOff)||20,n=0;CFG.offNext=CFG.offNext||1;
     [[pp,R.pLen,R.pProd||('عود '+R.n)],[hp,R.hLen,R.hProd||('عود مقبض '+R.n)]].forEach(function(g){g[0].forEach(function(x){if(x.left>=mn){O.push({id:uid(),code:offCode(CFG.offNext++),item:g[2],color:'',len:Math.floor(x.left),orig:g[1],place:'',status:'متاحة',date:today()});n++}})});
     if(!n)return toast('مفيش فضل صالح (أقل من '+mn+' سم)');await put('wk_offcuts',O);await saveCfg();toast('✔ اتسجّل '+n+' فضلة في شاشة الفضل')}catch(e){errAlert(e)}};
   b.querySelectorAll('[data-r]').forEach(function(x){x.addEventListener(x.tagName==='SELECT'?'change':'change',function(){RC.rows[+x.dataset.i][x.dataset.r]=x.value;draw()})});
   b.querySelectorAll('[data-x]').forEach(function(x){x.onclick=function(){RC.rows.splice(+x.dataset.x,1);if(!RC.rows.length)RC.rows.push({w:'',h:'',q:1,kind:'hinge',handle:'one'});draw()}});
   b.querySelector('#rcA').onclick=function(){RC.rows.push({w:'',h:'',q:1,kind:'hinge',handle:'one'});draw();var L=b.querySelectorAll('[data-r="w"]');if(L.length)L[L.length-1].focus()};
  }
  draw();
 }
 /* ---------- النموذج ---------- */
 function fi(id,label,val,extra,type){return '<div class="wkf"><label>'+label+'</label><input id="'+id+'" '+(type?'type="'+type+'" ':'')+'value="'+esc(val)+'" '+(extra||'')+'></div>'}
 function viewForm(id,type,pre){
  var old=id?ORD.find(function(x){return x.id===id}):null;
  var o=old?JSON.parse(JSON.stringify(old)):{type:type||'دلفة',date:today(),customer:'',phone:'',crafter:'',kind:'hinge',w:'',h:'',qty:1,hinges:3,hingePos:'',side:'right',color:'',profile:'',mats:[{n:'',q:'',p:''}],fee:'',cost:'',price:'',paid:'',notes:'',stage:0,hist:[],handle:'one',rod:'blum',rodP:'',rodH:'',wOff:'11',wWing:'9',wLen:'6'};
  if(!old&&pre)Object.assign(o,pre);
  if(!o.handle)o.handle='one';if(!o.rod)o.rod=rodTypeDefs()[0].k;if(o.handle==='frame')o.kind='frame';if(o.type==='جرار'&&o.kind!=='slide'&&o.kind!=='frame')o.kind='slide';if(o.type==='استانلس'||o.type==='أخرى')o.kind='other';
  var b=shell(old?'تعديل '+esc(ordNo(old)):'➕ أوردر جديد',old?function(){viewOrder(id)}:viewOrders);mark(old?'ord':'new');
  var sups=contacts().filter(function(c){return c.type==='مورد'}),custs=contacts().filter(function(c){return c.type==='عميل'});
  b.innerHTML='<div class="wkc"><h3>بيانات الأوردر</h3><div class="wkg">'+
   '<div class="wkf"><label>النظام (مراحل التصنيع)</label><select id="fT">'+TYPES.map(function(t){return '<option value="'+t+'"'+(t===o.type?' selected':'')+'>'+sysLab(t)+'</option>'}).join('')+'</select></div>'+
   '<div class="wkf"><label>النوع</label><select id="fK"><option value="hinge"'+(o.kind==='hinge'?' selected':'')+'>مفصلي</option><option value="slide"'+(o.kind==='slide'?' selected':'')+'>جرار</option><option value="frame"'+(o.kind==='frame'?' selected':'')+'>شاسيه ثابت (مراية أو غيره)</option><option value="other"'+(o.kind==='other'?' selected':'')+'>أخرى</option></select></div>'+
   fi('fD','التاريخ',o.date,'','date')+
   '<div class="wkf"><label>العميل</label><input id="fC" list="wkCust" value="'+esc(o.customer)+'"><datalist id="wkCust">'+custs.map(function(c){return '<option value="'+esc(c.name)+'">'}).join('')+'</datalist></div>'+
   fi('fP','تليفون العميل',o.phone,'inputmode="tel"')+
   '<div class="wkf"><label>الصنايعي</label><input id="fCr" list="wkSup" value="'+esc(o.crafter)+'"><datalist id="wkSup">'+sups.map(function(c){return '<option value="'+esc(c.name)+'">'}).join('')+'</datalist></div></div></div>'+
   '<div class="wkc"><h3>المقاسات والشكل</h3><div class="wkg">'+
   
   fi('fW','العرض (سم)',o.w,'inputmode="decimal"')+fi('fH','الارتفاع (سم)',o.h,'inputmode="decimal"')+fi('fQ','الكمية',o.qty,'inputmode="numeric"')+
   fi('fN','عدد المفصلات',o.hinges,'inputmode="numeric"')+
   '<div class="wkf"><label>المفصلات ناحية</label><select id="fS"><option value="right"'+(o.side==='right'?' selected':'')+'>اليمين</option><option value="left"'+(o.side==='left'?' selected':'')+'>الشمال</option></select></div>'+
   fi('fHP','مواضع المفصلات (سم من فوق، اختياري)',o.hingePos,'placeholder="مثال: 11, 105, 199"')+
   fi('fWo','من أول الراس لحد أول العجلة (سم)',o.wOff||'','inputmode="decimal"')+fi('fWg','طول جناح العجلة (سم)',o.wWing||'','inputmode="decimal"')+fi('fWl','طول الجزء اللي بيخش في الخلع (سم)',o.wLen||'','inputmode="decimal"')+
   fi('fCo','اللون',o.color)+fi('fPr','القطاع/الموديل',o.profile)+
   '<div class="wkf"><label>المقبض</label><select id="fHd">'+HANDLES.map(function(x){return '<option value="'+x[0]+'"'+(o.handle===x[0]?' selected':'')+'>'+x[1]+'</option>'}).join('')+'</select></div>'+
   '<div class="wkf"><label>نوع العود</label><select id="fRod">'+rodTypeDefs().map(function(t){return '<option value="'+t.k+'"'+(o.rod===t.k?' selected':'')+'>'+esc(t.n)+'</option>'}).join('')+'</select></div>'+
   '<div class="wkf"><label>زاوية التجميع</label><select id="fCn"><option value="yes"'+(o.corner!=='no'?' selected':'')+'>بزاوية (من المخزون)</option><option value="no"'+(o.corner==='no'?' selected':'')+'>من غير زاوية (الصنايعي عنده / زاوية خشب)</option></select></div>'+
   '<div class="wkf" id="fCpW"><label>الزاوية من المخزون</label><input id="fCp" list="wkCorner" value="'+esc(o.cornerProd||'')+'" placeholder="اسم الزاوية بالظبط"><datalist id="wkCorner">'+(db.products||[]).filter(function(p){return /زاوي/.test(p.name||'')}).slice(0,200).map(function(p){return '<option value="'+esc(String(p.name).trim())+'">'}).join('')+'</datalist></div>'+
   '<div class="wkf" style="grid-column:1/-1"><label>عود القطاع من المخزون (قطاعات الألومنيوم بس)</label><button type="button" class="wkbtn" id="fSecB" style="width:100%;min-height:46px">'+(o.secProd?'✔ '+esc(o.secProd):'🔎 اختار العود من المخزون')+'</button></div>'+
   '</div>'+
   '<div class="draw" id="fDr" style="margin-top:10px"></div></div>'+
   '<div class="wkc"><h3>🔧 حسبة المصنعية</h3><div class="wkg">'+
   fi('fFe','الصنايعي بياخد على الدرفة (ج)',o.fee,'inputmode="decimal"')+fi('fPe','على الزبون للدرفة (ج)',o.priceEach!=null&&o.priceEach!==''?o.priceEach:(num(o.price)&&num(o.qty)?Math.round(num(o.price)/num(o.qty)*100)/100:''),'inputmode="decimal"')+
   fi('fPd','العربون اللي الزبون دفعه (ج)',o.paid,'inputmode="decimal"')+'</div>'+
   '<div id="fRes" class="sample" style="margin-top:10px;font-size:15px"></div></div>'+
   '<div class="wkc"><h3>🪵 حسبة الخامات</h3><div id="fRods" class="sample"></div>'+
   '<details style="margin-top:10px"><summary style="cursor:pointer;font-weight:700">خامات تانية اتصرفت على الأوردر (اختياري)</summary><div id="fM" style="margin-top:8px"></div><button type="button" class="wkbtn" id="fMA">➕ خامة</button></details></div>'+
   '<div class="wkc"><div class="wkf"><label>ملاحظات</label><textarea id="fNo" rows="2">'+esc(o.notes)+'</textarea></div></div>'+
   '<div class="wkrow"><button type="button" class="wkbtn p" id="fSave">💾 حفظ</button><button type="button" class="wkbtn" id="fSavePr">💾 حفظ وطباعة</button><button type="button" class="wkbtn" id="fSaveInv">💾 حفظ وفاتورة</button></div>';
  function q(i){return b.querySelector('#'+i)}
  function drawMats(){q('fM').innerHTML=o.mats.map(function(m,i){return '<div class="wkg" style="margin-bottom:6px;align-items:end">'+
   '<div class="wkf"><label>الصنف</label><input data-m="n" data-i="'+i+'" value="'+esc(m.n)+'"></div><div class="wkf"><label>الكمية</label><input data-m="q" data-i="'+i+'" value="'+esc(m.q)+'" inputmode="decimal"></div><div class="wkf"><label>السعر</label><input data-m="p" data-i="'+i+'" value="'+esc(m.p)+'" inputmode="decimal"></div>'+
   '<button type="button" class="wkbtn d" data-md="'+i+'">حذف</button></div>'}).join('');
   b.querySelectorAll('[data-m]').forEach(function(x){x.oninput=function(){o.mats[+x.dataset.i][x.dataset.m]=x.value;res()}});
   b.querySelectorAll('[data-md]').forEach(function(x){x.onclick=function(){o.mats.splice(+x.dataset.md,1);if(!o.mats.length)o.mats.push({n:'',q:'',p:''});drawMats();res()}})}
  function read(){
   o.type=q('fT').value;o.date=q('fD').value;o.customer=q('fC').value.trim();o.phone=q('fP').value.trim();o.crafter=q('fCr').value.trim();
   o.kind=q('fK').value;var T0=q('fT').value;if(o.kind==='other'){if(T0==='دلفة'||T0==='جرار')T0='أخرى'}else if(T0!=='جرار'&&T0!=='دلفة')T0='دلفة';q('fT').value=T0;o.type=T0;if(o.kind==='frame')q('fHd').value='frame';else if(q('fHd').value==='frame')q('fHd').value='one';o.w=num(q('fW').value);o.h=num(q('fH').value);o.qty=num(q('fQ').value)||1;o.hinges=num(q('fN').value)||3;o.side=q('fS').value;o.hingePos=q('fHP').value.trim();
   o.color=q('fCo').value.trim();o.profile=q('fPr').value.trim();o.handle=q('fHd').value;o.rod=q('fRod').value;o.corner=q('fCn').value;o.cornerProd=q('fCp').value.trim();q('fCpW').style.display=o.corner==='no'?'none':'';o.wOff=q('fWo').value.trim();o.wWing=q('fWg').value.trim();o.wLen=q('fWl').value.trim();o.fee=q('fFe').value;o.priceEach=q('fPe').value;o.price=String(Math.round(num(o.priceEach)*(num(o.qty)||1)*100)/100);o.cost='';o.paid=q('fPd').value;o.notes=q('fNo').value.trim();return o}
  function res(){read();var sl=o.kind==='slide',hg=o.kind==='hinge',fr=o.kind==='frame';['fN','fS','fHP'].forEach(function(i){var f=q(i).closest('.wkf');if(f)f.style.display=hg?'':'none'});['fWo','fWg','fWl'].forEach(function(i){var f=q(i).closest('.wkf');if(f)f.style.display=sl?'':'none'});['fHd'].forEach(function(i){var f=q(i).closest('.wkf');if(f)f.style.display=fr||o.kind==='other'?'none':''});['fT','fHd'].forEach(function(i){if(q(i)._lab)q(i)._lab()});q('fDr').innerHTML=(o.w&&o.h&&o.kind!=='other')?svg(o,true):'<span style="color:var(--muted)">اكتب العرض والارتفاع وهيظهر الرسم</span>';var rh=rodsHtml(o);q('fRods').innerHTML=rh;
   var qn=num(o.qty)||1,fT=num(o.fee)*qn,pT=num(o.price),mt=(o.mats||[]).reduce(function(x,m){return x+num(m.q)*num(m.p)},0);
   q('fRes').innerHTML='الصنايعي: '+qn+' × '+fmt(num(o.fee))+' = <b>'+fmt(fT)+'</b> ج<br>على الزبون: '+qn+' × '+fmt(num(o.priceEach))+' = <b>'+fmt(pT)+'</b> ج<br>'+(mt?'خامات تانية: <b>'+fmt(mt)+'</b> ج<br>':'')+'ربحك: <b style="font-size:18px">'+fmt(pT-fT-mt)+'</b> ج — الباقي على الزبون: <b>'+fmt(pT-num(o.paid))+'</b> ج';
   if(!rh){q('fRods').innerHTML='<span style="color:var(--muted)">اكتب العرض والارتفاع وهتظهر الأعواد</span>';q('fRods').style.display=''}}
  b.querySelectorAll('input:not([data-m]),select,textarea').forEach(function(x){x.addEventListener('input',res);x.addEventListener('change',res)});
  q('fMA').onclick=function(){o.mats.push({n:'',q:'',p:''});drawMats()};
  /* اختيارات من تحت (bottom sheet) بدل قايمة الموبايل الأصلية: أخف وأأمن على آيفون وأندرويد */
  function sheetPick(id){try{var s=q(id);if(!s||!s.options)return;
   var bt=document.createElement('button');bt.type='button';
   bt.style.cssText='width:100%;min-height:46px;padding:10px 12px;border:1px solid var(--border,#e4eaed);border-radius:10px;background:#fff;color:#14172e;font:inherit;font-size:16px;font-weight:700;text-align:right';
   function lab(){var op=s.options[s.selectedIndex];bt.textContent=(op?op.text:'')+'  ▾'}
   lab();s._lab=lab;s.style.display='none';s.parentNode.insertBefore(bt,s);
   s.addEventListener('change',lab);
   bt.onclick=function(){
    var old=document.getElementById('wkSheet');if(old)old.remove();
    var ov=document.createElement('div');ov.id='wkSheet';
    ov.style.cssText='position:fixed;left:0;right:0;top:0;bottom:0;z-index:60;background:rgba(0,0,0,.45)';
    var bx=document.createElement('div');
    bx.style.cssText='position:absolute;left:0;right:0;bottom:0;max-height:70%;overflow:auto;background:#fff;color:#14172e;border-radius:20px 20px 0 0;padding:10px 14px 28px;direction:rtl';
    var hd=document.createElement('div');hd.style.cssText='width:44px;height:5px;border-radius:3px;background:#c7ccd6;margin:4px auto 12px';bx.appendChild(hd);
    function shut(){ov.remove()}
    ov.onclick=function(e){if(e.target===ov)shut()};
    for(var i=0;i<s.options.length;i++)(function(i){
     var b=document.createElement('button');b.type='button';b.textContent=s.options[i].text;
     b.style.cssText='display:block;width:100%;min-height:50px;margin:0 0 8px;padding:12px;border-radius:12px;font:inherit;font-size:17px;font-weight:700;text-align:right;border:2px solid '+(i===s.selectedIndex?'#3d5af1':'#d9e1e4')+';background:'+(i===s.selectedIndex?'#e8edff':'#fff')+';color:#14172e';
     b.onclick=function(){s.selectedIndex=i;shut();s.dispatchEvent(new Event('change',{bubbles:true}))};
     bx.appendChild(b)})(i);
    ov.appendChild(bx);document.body.appendChild(ov)}
  }catch(e){var s2=q(id);if(s2)s2.style.display=''}}
  ['fT','fK','fS','fHd','fRod','fCn'].forEach(sheetPick);
  q('fSecB').onclick=function(){
   var re=/قطاع|[أا]لومنيوم|المونيوم|الومتال/,bad=/مفصل|مقبض|مسمار|برغي|سلك|كالون|زاوي/;
   var L=(db.products||[]).filter(function(p){var t=(p.cat||'');return re.test(t)||(re.test(p.name||'')&&!bad.test(p.name||''))}).filter(function(p){return !bad.test(p.name||'')});
   var old=document.getElementById('wkSheet');if(old)old.remove();
   var ov=document.createElement('div');ov.id='wkSheet';ov.style.cssText='position:fixed;left:0;right:0;top:0;bottom:0;z-index:60;background:rgba(0,0,0,.45)';
   var bx=document.createElement('div');bx.style.cssText='position:absolute;left:0;right:0;bottom:0;max-height:80%;overflow:auto;background:#fff;color:#14172e;border-radius:20px 20px 0 0;padding:10px 14px 28px;direction:rtl';
   bx.innerHTML='<div style="width:44px;height:5px;border-radius:3px;background:#c7ccd6;margin:4px auto 12px"></div><input id="wkSq" placeholder="دوّر باسم العود أو اللون" style="width:100%;padding:12px;font-size:16px;border:1px solid #d9e1e4;border-radius:10px;margin-bottom:10px"><div id="wkSl"></div>';
   ov.appendChild(bx);document.body.appendChild(ov);ov.onclick=function(e){if(e.target===ov)ov.remove()};
   function dr(){var t=bx.querySelector('#wkSq').value.trim(),l=bx.querySelector('#wkSl');
    var R=L.filter(function(p){return !t||(String(p.name)+' '+(p.cat||'')).indexOf(t)>-1}).slice(0,60);
    l.innerHTML=R.length?'':'<div style="padding:14px;color:#777">مفيش قطاعات ألومنيوم بالاسم ده في المخزون'+(L.length?'':' — صنّف أعواد القطاعات تحت تصنيف فيه كلمة «قطاع» أو «ألومنيوم»')+'</div>';
    R.forEach(function(p){var bt=document.createElement('button');bt.type='button';bt.style.cssText='display:block;width:100%;min-height:50px;margin:0 0 8px;padding:12px;border-radius:12px;font:inherit;font-size:16px;font-weight:700;text-align:right;border:2px solid #d9e1e4;background:#fff;color:#14172e';
     bt.textContent=String(p.name).trim()+'  ·  رصيد '+(p.qty??0);bt.onclick=function(){o.secProd=String(p.name).trim();if(!q('fPr').value)q('fPr').value=o.secProd;ov.remove();q('fSecB').textContent='✔ '+o.secProd;res()};l.appendChild(bt)})}
   bx.querySelector('#wkSq').oninput=dr;dr()};
  drawMats();res();
  if(!old){var autoW=function(){if(!(o.type==='دلفة'||o.type==='جرار')||o.handle==='frame')return;var wc=workCalc(o);if(!q('fFe').dataset.t)q('fFe').value=wc.fee;if(!q('fPe').dataset.t)q('fPe').value=wc.price;res()};['fFe','fPe'].forEach(function(i){q(i).addEventListener('input',function(){this.dataset.t=1})});['fQ','fK','fT','fHd'].forEach(function(i){q(i).addEventListener('change',autoW);q(i).addEventListener('input',autoW)});autoW()}
  async function save(after){
   read();if(!o.customer)return toast('اكتب اسم العميل');
   o.mats=o.mats.filter(function(m){return m.n||m.q||m.p});
   if(old){var i=ORD.findIndex(function(x){return x.id===id});ORD[i]=Object.assign(ORD[i],o)}
   else{o.id=uid();o.no=CFG.next++;wkNewCode(o);o.stage=0;o.hist=[{n:stages(o.type)[0],at:new Date().toISOString(),by:who()}];ORD.push(o)}
   try{await saveOrd();if(!old)await saveCfg();toast('✔ اتحفظ '+ordNo(o));
    if(after==='print')printMenu(o);else if(after==='inv'){viewOrder(o.id);setTimeout(function(){var x=document.getElementById('wkInv');if(x)x.click()},100)}else viewOrder(o.id)}catch(e){errAlert(e)}}
  q('fSave').onclick=function(){save()};q('fSavePr').onclick=function(){save('print')};q('fSaveInv').onclick=function(){save('inv')};
 }

 /* ---------- الاستانلس ---------- */
 var BEND={'مسطحة':0,'L':1,'U':2,'Z':2,'مخصص':0};
 var SHN={'مسطحة':'شريحة مسطحة','L':'زاوية L','U':'حرف U','Z':'حرف Z','مخصص':'تشكيل خاص'};
 function pack(W,H,pieces,gap){
  var items=[];pieces.forEach(function(p,pi){for(var i=0;i<(p.q||1);i++)items.push({a:p.a,b:p.b,n:p.n,pi:pi})});
  items.sort(function(x,y){return Math.max(y.a,y.b)-Math.max(x.a,x.b)});
  var sheets=[],bad=[];
  items.forEach(function(it){
   var placed=false;
   for(var s=0;s<sheets.length&&!placed;s++){var sh=sheets[s];
    for(var r=0;r<sh.shelves.length&&!placed;r++){var sf=sh.shelves[r];
     [[it.a,it.b],[it.b,it.a]].forEach(function(d){if(placed)return;if(d[1]<=sf.h&&sf.x+d[0]<=W){sh.pl.push({x:sf.x,y:sf.y,w:d[0],h:d[1],n:it.n});sf.x+=d[0]+gap;placed=true}})}
    if(!placed){
     [[it.a,it.b],[it.b,it.a]].forEach(function(d){if(placed)return;if(sh.y+d[1]<=H&&d[0]<=W){var sf={x:d[0]+gap,y:sh.y,h:d[1]};sh.shelves.push(sf);sh.pl.push({x:0,y:sh.y,w:d[0],h:d[1],n:it.n});sh.y+=d[1]+gap;placed=true}})}
   }
   if(!placed){
    var fit=[[it.a,it.b],[it.b,it.a]].find(function(d){return d[0]<=W&&d[1]<=H});
    if(!fit){bad.push(it);return}
    var sh2={y:fit[1]+gap,shelves:[{x:fit[0]+gap,y:0,h:fit[1]}],pl:[{x:0,y:0,w:fit[0],h:fit[1],n:it.n}]};sheets.push(sh2)}
  });
  return {sheets:sheets,bad:bad};
 }
 function sheetSvg(W,H,sh,i){
  var sc=Math.min(260/W,200/H),s='<div style="display:inline-block;margin:6px;text-align:center"><div style="font-size:12px">لوح '+(i+1)+'</div><svg xmlns="http://www.w3.org/2000/svg" width="'+(W*sc+2)+'" height="'+(H*sc+2)+'" style="background:#fff">'+
   '<rect x="1" y="1" width="'+W*sc+'" height="'+H*sc+'" fill="#f3f6f7" stroke="#18343a"/>';
  sh.pl.forEach(function(p,k){s+='<rect x="'+(1+p.x*sc)+'" y="'+(1+p.y*sc)+'" width="'+p.w*sc+'" height="'+p.h*sc+'" fill="#bfe3e8" stroke="#087f8c"/><text x="'+(1+p.x*sc+p.w*sc/2)+'" y="'+(1+p.y*sc+p.h*sc/2+3)+'" text-anchor="middle" font-size="9">'+esc(p.w)+'×'+esc(p.h)+'</text>'});
  return s+'</svg></div>';
 }
 /* ---------- مجسّم 3D للقطعة (بيتحرّك بالسحب) ---------- */
 function shapeBoxes(p,th){
  var a=num(p.a),b=num(p.b),f=num(p.flange)||3,t=Math.max(0.35,th||0.2),B=[[0,0,0,a,t,b]],s=p.shape;
  if(s==='L'){B.push([0,t,0,a,t+f,t])}
  else if(s==='U'){B.push([0,t,0,a,t+f,t]);B.push([0,t,b-t,a,t+f,b])}
  else if(s==='Z'){B.push([0,t,0,a,t+f,t]);B.push([0,-f,b-t,a,t,b])}
  return B;
 }
 function render3d(boxes,yaw,pitch,W,H,zoom){
  var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],i;
  boxes.forEach(function(b){for(i=0;i<3;i++){mn[i]=Math.min(mn[i],b[i],b[i+3]);mx[i]=Math.max(mx[i],b[i],b[i+3])}});
  var c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2];
  var R=Math.sqrt(Math.pow(mx[0]-mn[0],2)+Math.pow(mx[1]-mn[1],2)+Math.pow(mx[2]-mn[2],2))||1;
  var sc=Math.min(W,H)*0.46/R*(zoom||1)*1.6;
  var cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
  function rot(x,y,z){var x1=x*cy+z*sy,z1=-x*sy+z*cy;return [x1,y*cp-z1*sp,y*sp+z1*cp]}
  var faces=[];
  boxes.forEach(function(b){
   var x0=b[0],y0=b[1],z0=b[2],x1=b[3],y1=b[4],z1=b[5];
   var V=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
   [[0,1,2,3,0,0,-1],[4,5,6,7,0,0,1],[0,1,5,4,0,-1,0],[3,2,6,7,0,1,0],[0,3,7,4,-1,0,0],[1,2,6,5,1,0,0]].forEach(function(f){
    var n=rot(f[4],f[5],f[6]);if(n[2]>=0)return;
    var pts=[V[f[0]],V[f[1]],V[f[2]],V[f[3]]].map(function(v){return rot(v[0]-c[0],v[1]-c[1],v[2]-c[2])});
    var d=(pts[0][2]+pts[1][2]+pts[2][2]+pts[3][2])/4;
    var lit=Math.max(0,n[0]*0.35+n[1]*0.8+n[2]*-0.5);
    faces.push({d:d,pts:pts,lit:lit});
   });
  });
  faces.sort(function(a,b){return b.d-a.d});
  var s='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:'+W+'px;background:#fff;touch-action:none;cursor:grab">';
  faces.forEach(function(f){
   var g=Math.round(110+120*Math.min(1,f.lit)),pt=f.pts.map(function(p){return (W/2+p[0]*sc).toFixed(1)+','+(H/2-p[1]*sc).toFixed(1)}).join(' ');
   s+='<polygon points="'+pt+'" fill="rgb('+g+','+(g+6)+','+(g+12)+')" stroke="#37505a" stroke-width="1" stroke-linejoin="round"/>';
  });
  return s+'</svg>';
 }
 function iso(p,th,yaw,pitch,W,H){return render3d(shapeBoxes(p,th),yaw,pitch,W||150,H||110,1)}
 /* مجسّم 3D خفيف (Canvas بدل SVG): بيترسم على نفس اللوحة من غير ما الصفحة تتبني من جديد، بإصبع واحد تلفّه وبإصبعين تكبّر */
 function faces3d(boxes,yaw,pitch){
  var mn=[1e9,1e9,1e9],mx=[-1e9,-1e9,-1e9],i;
  boxes.forEach(function(b){for(i=0;i<3;i++){mn[i]=Math.min(mn[i],b[i],b[i+3]);mx[i]=Math.max(mx[i],b[i],b[i+3])}});
  var c=[(mn[0]+mx[0])/2,(mn[1]+mx[1])/2,(mn[2]+mx[2])/2],R=Math.sqrt(Math.pow(mx[0]-mn[0],2)+Math.pow(mx[1]-mn[1],2)+Math.pow(mx[2]-mn[2],2))||1;
  var cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch),F=[];
  function rot(x,y,z){var x1=x*cy+z*sy,z1=-x*sy+z*cy;return [x1,y*cp-z1*sp,y*sp+z1*cp]}
  boxes.forEach(function(b){var x0=b[0],y0=b[1],z0=b[2],x1=b[3],y1=b[4],z1=b[5],V=[[x0,y0,z0],[x1,y0,z0],[x1,y1,z0],[x0,y1,z0],[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]];
   [[0,1,2,3,0,0,-1],[4,5,6,7,0,0,1],[0,1,5,4,0,-1,0],[3,2,6,7,0,1,0],[0,3,7,4,-1,0,0],[1,2,6,5,1,0,0]].forEach(function(f){var n=rot(f[4],f[5],f[6]);if(n[2]>=0)return;
    var pts=[V[f[0]],V[f[1]],V[f[2]],V[f[3]]].map(function(v){return rot(v[0]-c[0],v[1]-c[1],v[2]-c[2])});
    F.push({d:(pts[0][2]+pts[1][2]+pts[2][2]+pts[3][2])/4,pts:pts,lit:Math.max(0,n[0]*0.35+n[1]*0.8+n[2]*-0.5)})})});
  F.sort(function(a,b){return b.d-a.d});return {F:F,R:R};
 }
 var V3={yaw:-0.7,pitch:0.55,zoom:1};
 function mount3d(el,p,th){
  var boxes=shapeBoxes(p,th),cv=document.createElement('canvas'),ctx=cv.getContext('2d'),W=0,H=0,dpr=Math.min(2,window.devicePixelRatio||1),q=0;
  cv.style.cssText='width:100%;max-width:560px;height:320px;display:block;margin:0 auto;touch-action:none;cursor:grab;border-radius:14px;background:radial-gradient(ellipse at 50% 35%,#ffffff,#e8edf5)';
  el.innerHTML='';el.appendChild(cv);
  function size(){var w=Math.min(560,el.clientWidth||560);if(w===W)return;W=w;H=320;cv.width=W*dpr;cv.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}
  function paint(){q=0;size();var o=faces3d(boxes,V3.yaw,V3.pitch),sc=Math.min(W,H)*0.46/o.R*V3.zoom*1.6;
   ctx.clearRect(0,0,W,H);ctx.fillStyle='rgba(20,30,60,.10)';ctx.beginPath();ctx.ellipse(W/2,H*0.86,W*0.3,14,0,0,Math.PI*2);ctx.fill();
   o.F.forEach(function(f){var g=Math.round(118+122*Math.min(1,f.lit));ctx.beginPath();f.pts.forEach(function(pp,k){var x=W/2+pp[0]*sc,y=H/2-pp[1]*sc;k?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.closePath();
    var gr=ctx.createLinearGradient(0,H/2-o.R*sc,0,H/2+o.R*sc);gr.addColorStop(0,'rgb('+Math.min(255,g+22)+','+Math.min(255,g+28)+','+Math.min(255,g+36)+')');gr.addColorStop(1,'rgb('+(g-14)+','+(g-8)+','+g+')');
    ctx.fillStyle=gr;ctx.fill();ctx.strokeStyle='#3c5160';ctx.lineWidth=1.1;ctx.lineJoin='round';ctx.stroke()});
  }
  function draw(){if(!q){q=1;requestAnimationFrame(paint)}}
  paint();
  var P={},lx=0,ly=0,pd=0;
  cv.onpointerdown=function(e){P[e.pointerId]=[e.clientX,e.clientY];lx=e.clientX;ly=e.clientY;try{cv.setPointerCapture(e.pointerId)}catch(_){}};
  cv.onpointerup=cv.onpointercancel=function(e){delete P[e.pointerId];pd=0};
  cv.onpointermove=function(e){if(!P[e.pointerId])return;P[e.pointerId]=[e.clientX,e.clientY];var ks=Object.keys(P);
   if(ks.length>=2){var a=P[ks[0]],b=P[ks[1]],d=Math.hypot(a[0]-b[0],a[1]-b[1]);if(pd)V3.zoom=Math.max(0.4,Math.min(3,V3.zoom*d/pd));pd=d;draw();return}
   V3.yaw+=(e.clientX-lx)*0.012;V3.pitch=Math.max(-1.45,Math.min(1.45,V3.pitch+(e.clientY-ly)*0.012));lx=e.clientX;ly=e.clientY;draw()};
  cv.onwheel=function(e){e.preventDefault();V3.zoom=Math.max(0.4,Math.min(3,V3.zoom*(e.deltaY<0?1.1:0.9)));draw()};
  return {redraw:draw,rot:function(dy,dp){V3.yaw+=dy;V3.pitch=Math.max(-1.45,Math.min(1.45,V3.pitch+dp));draw()},reset:function(){V3.yaw=-0.7;V3.pitch=0.55;V3.zoom=1;draw()}};
 }
 /* ---------- رسم هندسي 2D للصنايعي: اللوح مفرود + المقطع + منظر علوي + منظر جانبي، بالمقاسات والأسهم وخط الثني ---------- */
 function techSvg(p,th){
  var a=num(p.a),b=num(p.b),f=num(p.flange)||3,s=p.shape,nb=s==='L'?1:(s==='U'||s==='Z')?2:0,Wf=b+nb*f,t=th||0.1,K='#14213d',R='#d62828',BL='#1d4ed8';
  if(!(a>0&&b>0))return '';
  var o='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 820 560" style="width:100%;max-width:820px;background:#fff;direction:ltr" font-family="Cairo,Tahoma,Arial">'+
   '<defs><marker id="tA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="'+BL+'"/></marker></defs>'+
   '<rect x="1" y="1" width="818" height="558" fill="none" stroke="#9aa5b1"/><path d="M410 1V559M1 280H819" stroke="#cfd6de"/>';
  function T(x,y,txt,sz,col,anc){return '<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+(sz||13)+'" font-weight="700" fill="'+(col||K)+'" text-anchor="'+(anc||'middle')+'">'+esc(txt)+'</text>'}
  function D(x1,y1,x2,y2,lab,side){var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*side,ny=dx/L*side,o2=16,X1=x1+nx*o2,Y1=y1+ny*o2,X2=x2+nx*o2,Y2=y2+ny*o2;
   return '<path d="M'+x1+' '+y1+'L'+(X1+nx*4)+' '+(Y1+ny*4)+'M'+x2+' '+y2+'L'+(X2+nx*4)+' '+(Y2+ny*4)+'" stroke="#8aa0c8" stroke-width="1"/>'+
    '<line x1="'+X1+'" y1="'+Y1+'" x2="'+X2+'" y2="'+Y2+'" stroke="'+BL+'" stroke-width="1.4" marker-start="url(#tA)" marker-end="url(#tA)"/>'+
    '<g transform="translate('+((X1+X2)/2+nx*10).toFixed(1)+' '+((Y1+Y2)/2+ny*10+4).toFixed(1)+')"><rect x="-26" y="-13" width="52" height="17" rx="4" fill="#fff"/>'+T(0,0,lab,13,BL)+'</g>'}
  var cm=function(v){return (Math.round(v*10)/10)+' سم'};
  /* 1) اللوح مفرود */
  var s1=Math.min(300/a,170/Wf),x0=205-a*s1/2,y0=150-Wf*s1/2,w1=a*s1,h1=Wf*s1;
  o+=T(205,26,'① الشريحة قبل الثني (بتتقص كده)',15)+'<rect x="'+x0+'" y="'+y0+'" width="'+w1+'" height="'+h1+'" fill="#eef3fb" stroke="'+K+'" stroke-width="2"/>'+D(x0,y0,x0+w1,y0,cm(a),-1)+D(x0+w1,y0,x0+w1,y0+h1,cm(Wf),1);
  if(nb){var fs=f*s1;o+='<line x1="'+x0+'" y1="'+(y0+fs)+'" x2="'+(x0+w1)+'" y2="'+(y0+fs)+'" stroke="'+R+'" stroke-width="2" stroke-dasharray="8 5"/>'+T(x0+w1/2,y0+fs-5,'خط الثني ↑',12,R)+D(x0,y0,x0,y0+fs,cm(f),-1);
   if(nb===2){o+='<line x1="'+x0+'" y1="'+(y0+h1-fs)+'" x2="'+(x0+w1)+'" y2="'+(y0+h1-fs)+'" stroke="'+R+'" stroke-width="2" stroke-dasharray="8 5"/>'+T(x0+w1/2,y0+h1-fs+15,s==='Z'?'خط الثني ↓ (عكس)':'خط الثني ↑',12,R)+D(x0,y0+h1-fs,x0,y0+h1,cm(f),-1)}}
  o+=T(205,268,nb?'الشريحة قبل الثني: '+cm(Wf)+' = '+(nb===2?cm(f)+' + '+cm(b)+' + '+cm(f):cm(f)+' + '+cm(b)):'قطعة مسطحة من غير ثني',12,'#14213d');
  if(s==='U')o+=T(615,48,'المسافة '+cm(b)+' = تخانة الباب',12,BL);
  /* 2) المقطع (المنظر الأمامي) */
  var s2=Math.min(300/b,150/Math.max(f*(s==='Z'?2:1),1)),cx=615-b*s2/2,by=s==='Z'?150:200,fp=f*s2,pts;
  if(s==='L')pts=[[cx,by-fp],[cx,by],[cx+b*s2,by]];else if(s==='U')pts=[[cx,by-fp],[cx,by],[cx+b*s2,by],[cx+b*s2,by-fp]];else if(s==='Z')pts=[[cx,by-fp],[cx,by],[cx+b*s2,by],[cx+b*s2,by+fp]];else pts=[[cx,by],[cx+b*s2,by]];
  o+=T(615,26,'② المقطع (شكل الثنية)',15)+'<polyline points="'+pts.map(function(z){return z[0].toFixed(1)+','+z[1].toFixed(1)}).join(' ')+'" fill="none" stroke="'+K+'" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>'+D(cx,by,cx+b*s2,by,cm(b),1);
  if(nb)o+=D(cx,by-fp,cx,by,cm(f),1)+(s==='U'?D(cx+b*s2,by,cx+b*s2,by-fp,cm(f),1):'')+(s==='Z'?D(cx+b*s2,by,cx+b*s2,by+fp,cm(f),-1):'')+'<path d="M'+(cx+14)+' '+(by-4)+'a12 12 0 0 0 -10 -10" fill="none" stroke="'+R+'" stroke-width="1.5"/>'+T(cx+30,by-12,'90°',11,R);
  o+=T(615,268,'السمك '+(Math.round(t*100)/10)+' مم',12,'#5b6475');
  /* 3) منظر علوي */
  var s3=Math.min(300/a,150/b),x3=205-a*s3/2,y3=420-b*s3/2;
  o+=T(205,306,'③ منظر من فوق',15)+'<rect x="'+x3+'" y="'+y3+'" width="'+(a*s3)+'" height="'+(b*s3)+'" fill="#f4f7fb" stroke="'+K+'" stroke-width="2"/>'+D(x3,y3+b*s3,x3+a*s3,y3+b*s3,cm(a),1)+D(x3+a*s3,y3,x3+a*s3,y3+b*s3,cm(b),-1);
  if(s==='L'||s==='U'||s==='Z')o+='<rect x="'+x3+'" y="'+y3+'" width="'+(a*s3)+'" height="5" fill="'+K+'"/>';
  if(s==='U'||s==='Z')o+='<rect x="'+x3+'" y="'+(y3+b*s3-5)+'" width="'+(a*s3)+'" height="5" fill="'+(s==='Z'?'#94a3b8':K)+'"/>';
  /* 4) منظر جانبي */
  var hh=nb?f:Math.max(t*4,0.6),s4=Math.min(300/a,120/hh),x4=615-a*s4/2,y4=430-hh*s4/2;
  o+=T(615,306,'④ منظر من الجنب',15)+'<rect x="'+x4+'" y="'+y4+'" width="'+(a*s4)+'" height="'+(hh*s4)+'" fill="#f4f7fb" stroke="'+K+'" stroke-width="2"/>'+D(x4,y4+hh*s4,x4+a*s4,y4+hh*s4,cm(a),1)+(nb?D(x4,y4,x4,y4+hh*s4,'ارتفاع '+cm(f),-1):T(615,y4-10,'قطعة مسطحة',12,'#5b6475'));
  o+=T(410,548,(p.n?p.n+' — ':'')+(s==='U'?'عرض الباب '+cm(a)+' × تخانة الباب '+cm(b):cm(a)+' × '+cm(b))+(nb?' — ثنية '+cm(f)+' ('+s+')':'')+(p.q>1?' — العدد '+p.q:''),14,K);
  return o+'</svg>';
 }
 /* رسم الصنايعي لورق الفواتير (رول 80/58): كلام كبير، خطوط تقيلة أبيض وأسود، رسمتين بس (شكل الثنية + اللوح مفرود) تحت بعض */
 function techRoll(p,th){
  var a=num(p.a),b=num(p.b),f=num(p.flange)||3,s=p.shape,nb=s==='L'?1:(s==='U'||s==='Z')?2:0,Wf=b+nb*f;if(!(a>0&&b>0))return '';
  var cm=function(v){return (Math.round(v*10)/10)+' سم'},big='font-size:17px;font-weight:800;line-height:1.55';
  var lab=s==='U'?['عرض الباب','تخانة الباب']:s==='L'?['الطول','عرض القاعدة']:s==='Z'?['الطول','المسافة بين الثنيتين']:['الطول','العرض'];
  var box='<div style="border:2.5px solid #000;border-radius:6px;padding:6px 8px;margin:6px 0;'+big+'">'+(p.n?'<div style="font-size:19px;text-align:center;border-bottom:2px solid #000;margin-bottom:4px">'+esc(p.n)+(num(p.q)>1?' — العدد '+num(p.q):'')+'</div>':(num(p.q)>1?'<div style="text-align:center">العدد '+num(p.q)+'</div>':''))+
   '<div>'+lab[0]+': <span style="font-size:22px">'+cm(a)+'</span></div><div>'+lab[1]+': <span style="font-size:22px">'+cm(b)+'</span></div>'+
   (nb?'<div>ارتفاع الثنية: <span style="font-size:22px">'+cm(f)+'</span>'+(nb===2?' (×2)':'')+'</div><div style="border-top:2px dashed #000;margin-top:4px;padding-top:4px">الشريحة اللي هتتقص قبل الثني:<br><span style="font-size:20px">'+cm(a)+' × '+cm(Wf)+'</span><br><span style="font-size:15px">('+(Math.round(Wf*10)/10)+' = '+(nb===2?(Math.round(f*10)/10)+' + '+(Math.round(b*10)/10)+' + '+(Math.round(f*10)/10):(Math.round(f*10)/10)+' + '+(Math.round(b*10)/10))+')</span></div>':'<div>قطعة مسطحة من غير ثني</div>')+'</div>';
  function T(x,y,t,sz){return '<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+(sz||24)+'" font-weight="800" fill="#000" text-anchor="middle" font-family="Cairo,Tahoma,Arial">'+esc(t)+'</text>'}
  function D(x1,y1,x2,y2,t,side){var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*side,ny=dx/L*side,o=26,X1=x1+nx*o,Y1=y1+ny*o,X2=x2+nx*o,Y2=y2+ny*o,mx=(X1+X2)/2+nx*20,my=(Y1+Y2)/2+ny*20+8;
   return '<path d="M'+x1+' '+y1+'L'+(X1+nx*5)+' '+(Y1+ny*5)+'M'+x2+' '+y2+'L'+(X2+nx*5)+' '+(Y2+ny*5)+'" stroke="#000" stroke-width="1.5"/><line x1="'+X1+'" y1="'+Y1+'" x2="'+X2+'" y2="'+Y2+'" stroke="#000" stroke-width="2.5" marker-start="url(#rA)" marker-end="url(#rA)"/>'+
    '<rect x="'+(mx-52)+'" y="'+(my-24)+'" width="104" height="31" fill="#fff"/>'+T(mx,my,t,24)}
  var defs='<defs><marker id="rA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker></defs>';
  var out=box;
  /* ① شكل الثنية (المقطع) */
  if(nb){var bw=230,fh=s==='Z'?95:150,x0=85,y0=s==='Z'?135:200,pts;
   if(s==='L')pts=[[x0,y0-fh],[x0,y0],[x0+bw,y0]];else if(s==='U')pts=[[x0,y0-fh],[x0,y0],[x0+bw,y0],[x0+bw,y0-fh]];else pts=[[x0,y0-fh],[x0,y0],[x0+bw,y0],[x0+bw,y0+fh]];
   var H1=s==='Z'?330:290;
   out+='<div style="font-size:17px;font-weight:800;text-align:center;margin-top:8px">① شكل الثنية</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 '+H1+'" style="width:100%;height:auto;direction:ltr">'+defs+
    '<polyline points="'+pts.map(function(z){return z.join(',')}).join(' ')+'" fill="none" stroke="#000" stroke-width="9" stroke-linejoin="miter" stroke-linecap="square"/>'+
    D(x0,y0,x0+bw,y0,cm(b),1)+D(x0,y0-fh,x0,y0,cm(f),1)+(s==='U'?D(x0+bw,y0,x0+bw,y0-fh,cm(f),1):'')+(s==='Z'?D(x0+bw,y0,x0+bw,y0+fh,cm(f),-1):'')+
    (s==='U'?T(x0+bw/2,y0-fh/2,'تخانة الباب',22):'')+'</svg>'}
  /* ② اللوح مفرود بخطوط الثني */
  var W2=300,H2=Math.max(110,Math.min(230,W2*Wf/a)),x2=55,y2=40,fs=nb?H2*f/Wf:0;
  out+='<div style="font-size:17px;font-weight:800;text-align:center;margin-top:8px">'+(nb?'② الشريحة قبل الثني (بتتقص كده)':'① القطعة')+'</div><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 '+(H2+120)+'" style="width:100%;height:auto;direction:ltr">'+defs+
   '<rect x="'+x2+'" y="'+y2+'" width="'+W2+'" height="'+H2+'" fill="none" stroke="#000" stroke-width="5"/>'+D(x2,y2+H2,x2+W2,y2+H2,cm(a),1)+D(x2+W2,y2,x2+W2,y2+H2,cm(Wf),-1);
  if(nb){out+='<line x1="'+x2+'" y1="'+(y2+fs)+'" x2="'+(x2+W2)+'" y2="'+(y2+fs)+'" stroke="#000" stroke-width="3.5" stroke-dasharray="14 8"/>'+T(x2+W2/2,y2+fs/2+9,cm(f),22);
   if(nb===2)out+='<line x1="'+x2+'" y1="'+(y2+H2-fs)+'" x2="'+(x2+W2)+'" y2="'+(y2+H2-fs)+'" stroke="#000" stroke-width="3.5" stroke-dasharray="14 8"/>'+T(x2+W2/2,y2+H2-fs/2+9,cm(f),22)}
  out+='</svg>'+(nb?'<div style="font-size:15px;font-weight:800;text-align:center">الخط المتقطّع = مكان الثني'+(s==='Z'?' (التانية عكس الأولى)':'')+'<br>'+(Math.round(Wf*10)/10)+' = '+(nb===2?'ثنية '+(Math.round(f*10)/10)+' + '+lab[1]+' '+(Math.round(b*10)/10)+' + ثنية '+(Math.round(f*10)/10):'ثنية '+(Math.round(f*10)/10)+' + '+(Math.round(b*10)/10))+'</div>':'');
  return '<div style="page-break-inside:avoid;border-top:3px dashed #000;padding-top:6px;margin-top:8px">'+out+'</div>';
 }
 function steelSummary(o,paper){
  var s=o.steel;if(!s)return '';
  var th=num(s.thick)/10,ps=s.pieces||[];
  var rows=ps.map(function(p){return '<tr><td>'+esc(p.n||'قطعة')+'</td><td>'+esc(p.a)+'×'+esc(p.b)+'</td><td>×'+esc(p.q)+'</td><td>'+esc(p.shape)+(p.shape!=='مسطحة'&&p.flange?' (ثنية '+esc(p.flange)+')':'')+'</td></tr>'}).join('');
  var roll=paper==='r80'||paper==='r58';
  var imgs=ps.map(function(p){return roll?techRoll(p,th):'<div style="margin:6px 0;page-break-inside:avoid">'+techSvg(p,th)+'</div>'}).join('');
  var lay='';try{var r=pack(num(s.W),num(s.H),ps,num(s.gap));lay=r.sheets.map(function(sh,i){return sheetSvg(num(s.W),num(s.H),sh,i)}).join('')}catch(e){}
  return '<p style="margin:8px 0 2px"><b>الاستانلس</b></p><table><tr><td>اللوح</td><td>'+esc(s.W)+'×'+esc(s.H)+' سم</td><td>عدد الألواح</td><td>'+esc(s.sheets)+'</td></tr>'+
   '<tr><td>السمك</td><td>'+esc(s.thick||'-')+' مم</td><td>النوع / التشطيب</td><td>'+esc(s.grade||'')+' / '+esc(s.finish||'')+'</td></tr>'+rows+'</table>'+
   '<p style="margin:8px 0 2px"><b>رسم القطع للصنايعي (مقاسات بالسنتي)</b></p><div>'+imgs+'</div>'+(roll?'':'<p style="margin:8px 0 2px"><b>تقطيع الألواح</b></p><div>'+lay+'</div>');
 }
 /* رسمة بالمقاسات للبامبو (المقاسات اللي بتتكتب برّه برّه، لأنها هي مقاس الشاسيه الخشب اللي الدرج بيتسقط فيه): واجهة + منظر من فوق، بشكل شبه النسيج، وتقسيم بعدد فواصل حر (مش قسمة واحدة بس) */
 /* رسمة توضيحية بنفس شكل الموقع (سلة بامبو بالضفيرة والفواصل) */
 const bsF='font-family="Segoe UI,Tahoma,Arial,sans-serif"';
 const bsDimH=(x1,x2,y,t)=>`<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/><path d="M${x1} ${y}l7 -3.5v7zM${x2} ${y}l-7 -3.5v7z"/><line x1="${x1}" y1="${y-5}" x2="${x1}" y2="${y+5}"/><line x1="${x2}" y1="${y-5}" x2="${x2}" y2="${y+5}"/></g><text x="${(x1+x2)/2}" y="${y+16}" text-anchor="middle" font-size="13" font-weight="700" fill="#12202b" ${bsF}>${esc(t)}</text>`;
 const bsDimV=(x,y1,y2,t,side)=>`<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/><path d="M${x} ${y1}l-3.5 7h7zM${x} ${y2}l-3.5 -7h7z"/><line x1="${x-5}" y1="${y1}" x2="${x+5}" y2="${y1}"/><line x1="${x-5}" y1="${y2}" x2="${x+5}" y2="${y2}"/></g><text x="${x+(side||-1)*8}" y="${(y1+y2)/2+4}" text-anchor="${side>0?'start':'end'}" font-size="13" font-weight="700" fill="#12202b" ${bsF}>${esc(t)}</text>`;
 const bsWrap=b=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" direction="ltr" style="direction:ltr;width:100%;height:auto;display:block"><rect width="400" height="300" fill="#fff"/><rect x="2" y="2" width="396" height="296" rx="10" fill="none" stroke="#d9a73a" stroke-width="2"/><text x="200" y="22" text-anchor="middle" font-size="13" font-weight="800" fill="#a8741a" ${bsF}>MEKANEZM — رسم توضيحي للطلب</text>${b}</svg>`;
 function bambooSiteSvg(v){const w=num(v.w),l=num(v.l),h=num(v.h);if(!(w>0&&l>0&&h>0))return '';
  const k=Math.min(200/(w+.28*l),165/(h+.5*l)),fw=w*k,fh=h*k,dx=l*k*.28,dy=-l*k*.5,x0=118+(200-(fw+dx))/2,yb=240,yt=yb-fh;
  const nat=v.kind==='طبيعي',B=nat?['#d9b98a','#eed5a8','#a47c48']:['#c8a05e','#e0bf83','#8c6a30'];
  const dv=v.split==='yes'?Math.max(1,Math.min(10,Math.round(num(v.dv)||0))):0;
  const Fl=[x0,yt],Fr=[x0+fw,yt],Bl=[x0+dx,yt+dy],Br=[x0+fw+dx,yt+dy],P=(a,d)=>`${a[0]},${a[1]+(d||0)}`;
  const poly=(pts,fill,sh)=>`<polygon points="${pts}" fill="${fill}" stroke="#5e4220" stroke-width="1.2" stroke-linejoin="round"/>`+(sh?`<polygon points="${pts}" fill="#2b1a05" opacity="${sh}"/>`:'');
  const defs=`<defs><pattern id="wvB" width="14" height="9" patternUnits="userSpaceOnUse"><rect width="14" height="9" fill="${B[0]}"/><path d="M0 2.2h14M0 6.7h14" stroke="${B[1]}" stroke-width="2.6"/><path d="M0 3.9h14M0 8.4h14" stroke="${B[2]}" stroke-width=".8" opacity=".7"/><path d="M3.5 0v4.2M10.5 4.5v4.5" stroke="${B[2]}" stroke-width="2.4"/><path d="M5 0v4M12 4.5v4.5" stroke="${B[1]}" stroke-width=".8"/></pattern></defs>`;
  const W='url(#wvB)';
  let s=defs;
  s+=poly(`${P(Fl)} ${P(Bl)} ${P(Bl,fh)} ${P(Fl,fh)}`,W,.3);          /* الجدار الداخلي الشمال */
  s+=poly(`${P(Bl)} ${P(Br)} ${P(Br,fh)} ${P(Bl,fh)}`,W,.2);           /* الجدار الداخلي الخلفي */
  s+=poly(`${P(Bl,fh)} ${P(Br,fh)} ${P(Fr,fh)} ${P(Fl,fh)}`,W,.1);     /* الأرضية */
  for(let i=1;i<=dv;i++){const f=i/(dv+1),ax=x0+fw*f,bx=ax+dx;                      /* الفواصل */
   s+=`<polygon points="${ax},${yt} ${bx},${yt+dy} ${bx},${yt+dy+fh} ${ax},${yt+fh}" fill="#e7d3aa" stroke="#5e4220" stroke-width="1.2"/><line x1="${ax}" y1="${yt}" x2="${bx}" y2="${yt+dy}" stroke="#a47c48" stroke-width="3"/>`}
  s+=poly(`${P(Fr)} ${P(Br)} ${P(Br,fh)} ${P(Fr,fh)}`,W,.12);          /* الجنب اليمين من برّه */
  s+=poly(`${P(Fl)} ${P(Fr)} ${P(Fr,fh)} ${P(Fl,fh)}`,W,0);            /* الوش */
  const rim=(a,b)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#7a5a2a" stroke-width="7.5" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="${B[1]}" stroke-width="5.8" stroke-linecap="round"/><line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" stroke="#8d6a38" stroke-width="5.8" stroke-dasharray="2.2 4.6"/>`;
  s+=rim(Bl,Fl)+rim(Bl,Br)+rim(Fr,Br)+rim(Fl,Fr);                       /* الحافة المضفّرة */
  s+=bsDimH(x0,x0+fw,yb+22,'العرض '+w+' سم')+bsDimV(x0-14,yt,yb,'الارتفاع '+h+' سم',-1);
  s+=`<g stroke="#a8741a" stroke-width="1.4" fill="#a8741a"><line x1="${x0+fw+14}" y1="${yt+6}" x2="${x0+fw+dx+14}" y2="${yt+dy+6}"/><path d="M${x0+fw+14} ${yt+6}l-2 -7 8 3zM${x0+fw+dx+14} ${yt+dy+6}l2 7 -8 -3z"/></g><text x="${x0+fw+dx/2+30}" y="${yt+dy/2+6}" font-size="13" font-weight="700" fill="#12202b" ${bsF}>الطول ${l} سم</text>`;
  s+=`<text x="200" y="293" text-anchor="middle" font-size="11" fill="#667" ${bsF}>${esc(v.kind||'')} — ${dv?('متقسم '+dv+' فاصل'):'بدون تقسيم'} — المقاس برّه برّه</text>`;
  return bsWrap(s)}
 function bambooSvg(p){
  var a=num(p.a),b=num(p.b),c=num(p.c),lip=num(p.lip),dv=Math.max(0,Math.round(num(p.div))||0),q=Math.max(1,num(p.q))||1,kind2=p.kind2||'';
  if(!(a>0&&b>0))return '';
  var cm=function(v){return (Math.round(v*10)/10)+' سم'};
  function T(x,y,t,sz,col){return '<text x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" font-size="'+(sz||22)+'" font-weight="800" fill="'+(col||'#000')+'" text-anchor="middle" font-family="Cairo,Tahoma,Arial">'+esc(t)+'</text>'}
  function D(x1,y1,x2,y2,t,side){var dx=x2-x1,dy=y2-y1,L=Math.hypot(dx,dy)||1,nx=-dy/L*side,ny=dx/L*side,o=26,X1=x1+nx*o,Y1=y1+ny*o,X2=x2+nx*o,Y2=y2+ny*o,mx=(X1+X2)/2+nx*20,my=(Y1+Y2)/2+ny*20+8;
   return '<path d="M'+x1+' '+y1+'L'+(X1+nx*5)+' '+(Y1+ny*5)+'M'+x2+' '+y2+'L'+(X2+nx*5)+' '+(Y2+ny*5)+'" stroke="#000" stroke-width="1.5"/><line x1="'+X1+'" y1="'+Y1+'" x2="'+X2+'" y2="'+Y2+'" stroke="#000" stroke-width="2.5" marker-start="url(#bA)" marker-end="url(#bA)"/>'+
    '<rect x="'+(mx-52)+'" y="'+(my-24)+'" width="104" height="31" fill="#fff"/>'+T(mx,my,t,24)}
  function dividers(x,y,w,h){var s='';for(var i=1;i<=dv;i++){var px=x+w*i/(dv+1);s+='<line x1="'+px+'" y1="'+y+'" x2="'+px+'" y2="'+(y+h)+'" stroke="#8a5a1f" stroke-width="3" stroke-dasharray="8 4"/>'}return s}
  var defs='<defs><marker id="bA" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#000"/></marker>'+
   '<pattern id="bWeave" width="11" height="11" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="11" height="11" fill="#ecd3a0"/><line x1="0" y1="0" x2="0" y2="11" stroke="#b9873f" stroke-width="3"/><line x1="5.5" y1="0" x2="5.5" y2="11" stroke="#d9b878" stroke-width="1.4"/></pattern></defs>';
  var box='<div style="border:2.5px solid #000;border-radius:6px;padding:6px 8px;margin:6px 0;font-size:17px;font-weight:800;line-height:1.55">'+(p.n?'<div style="font-size:19px;text-align:center;border-bottom:2px solid #000;margin-bottom:4px">'+esc(p.n)+(q>1?' — العدد '+q:'')+'</div>':(q>1?'<div style="text-align:center">العدد '+q+'</div>':''))+
   (kind2?'<div>النوع: <span style="font-size:19px">'+esc(kind2)+'</span></div>':'')+
   '<div>العرض (برّه برّه): <span style="font-size:22px">'+cm(a)+'</span></div><div>الارتفاع (برّه برّه): <span style="font-size:22px">'+cm(b)+'</span></div>'+(c>0?'<div>العمق (برّه برّه): <span style="font-size:22px">'+cm(c)+'</span></div>':'')+(lip>0?'<div>الشفة البارزة: <span style="font-size:22px">'+cm(lip)+'</span> كل جانب</div>':'')+'<div>التقسيم: <span style="font-size:19px">'+(dv?dv+' فاصل ('+(dv+1)+' خانة)':'من غيره')+'</span></div></div>';
  var W1=230,H1=Math.max(90,Math.min(260,W1*b/a)),x1=85,y1=30;
  var out=box+'<div style="font-size:17px;font-weight:800;text-align:center;margin-top:8px">① الواجهة (برّه برّه — العرض × الارتفاع)</div>'+
   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 '+(H1+110)+'" style="width:100%;height:auto;direction:ltr">'+defs+
   '<rect x="'+x1+'" y="'+y1+'" width="'+W1+'" height="'+H1+'" fill="url(#bWeave)" stroke="#000" stroke-width="5"/>'+
   '<rect x="'+(x1-6)+'" y="'+(y1-6)+'" width="'+(W1+12)+'" height="12" rx="6" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="3 5" stroke-linecap="round"/>'+
   dividers(x1,y1,W1,H1)+
   D(x1,y1+H1,x1+W1,y1+H1,cm(a),1)+D(x1,y1,x1,y1+H1,cm(b),-1)+'</svg>';
  var W2=230,H2=c>0?Math.max(60,Math.min(140,W2*c/a)):70,x2=85,y2=30,sc2=W2/a,lp=lip*sc2;
  out+='<div style="font-size:17px;font-weight:800;text-align:center;margin-top:8px">② منظر من فوق (العرض × العمق'+(lip>0?' — والشفة باينة':'')+')</div>'+
   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 '+(H2+(lip>0?150:110))+'" style="width:100%;height:auto;direction:ltr">'+defs+
   '<rect x="'+x2+'" y="'+y2+'" width="'+W2+'" height="'+H2+'" fill="url(#bWeave)" stroke="#000" stroke-width="5"/>'+
   '<rect x="'+(x2-6)+'" y="'+(y2-6)+'" width="'+(W2+12)+'" height="'+(H2+12)+'" rx="8" fill="none" stroke="#000" stroke-width="5" stroke-dasharray="3 5" stroke-linecap="round"/>'+
   (lip>0&&lp*2<Math.min(W2,H2)?'<rect x="'+(x2+lp)+'" y="'+(y2+lp)+'" width="'+(W2-2*lp)+'" height="'+(H2-2*lp)+'" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="6 4"/>':'')+
   dividers(x2,y2,W2,H2)+
   D(x2,y2+H2,x2+W2,y2+H2,cm(a),1)+D(x2,y2,x2,y2+H2,c>0?cm(c):'-',-1)+
   (lip>0?D(x2,y2,x2,y2+lp,'شفة '+cm(lip),-1):'')+'</svg>';
  var site=c>0?bambooSiteSvg({w:a,l:c,h:b,kind:kind2,split:dv>0?'yes':'no',dv:dv}):'';
  if(site){out=box+'<div style="max-width:560px;margin:8px auto 0">'+site+'</div>'}else{
  /* ③ شكل الدرج بمنظور خفيف: جسم + واجهة بقضبان بامبو أفقية متساوية + مقبض، والأرقام على الأطراف */
  var W3=190,H3=Math.max(60,Math.min(190,W3*b/a)),dd=c>0?Math.max(24,Math.min(100,W3*c/a*0.5)):40,ddx=dd*0.87,ddy=dd*0.5,x3=145,y3=62+ddy,P=function(){return [].slice.call(arguments).map(function(v){return v.toFixed(1)}).join(' ')};
  var ns=Math.max(5,Math.min(22,Math.round(H3/13))),sl='';for(var i=0;i<ns;i++){var sy=y3+5+(H3-10)*(i+0.5)/ns,sh=(H3-10)/ns*0.72;sl+='<rect x="'+(x3+5)+'" y="'+(sy-sh/2).toFixed(1)+'" width="'+(W3-10)+'" height="'+sh.toFixed(1)+'" rx="'+(sh/2).toFixed(1)+'" fill="#d9a865" stroke="#9c6a2c" stroke-width="1.2"/>'}
  out+='<div style="font-size:17px;font-weight:800;text-align:center;margin-top:8px">③ شكل الدرج</div>'+
   '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 440 '+(H3+ddy+130).toFixed(0)+'" style="width:100%;height:auto;direction:ltr">'+defs+
   '<polygon points="'+P(x3,y3,x3+W3,y3,x3+W3+ddx,y3-ddy,x3+ddx,y3-ddy)+'" fill="#6b4318" stroke="#000" stroke-width="3"/>'+
   '<polygon points="'+P(x3+6,y3-2,x3+W3-6,y3-2,x3+W3+ddx-8,y3-ddy+3,x3+ddx+4,y3-ddy+3)+'" fill="#8a5a24"/>'+
   '<polygon points="'+P(x3+W3,y3,x3+W3+ddx,y3-ddy,x3+W3+ddx,y3+H3-ddy,x3+W3,y3+H3)+'" fill="#b98545" stroke="#000" stroke-width="3"/>'+
   '<rect x="'+x3+'" y="'+y3.toFixed(1)+'" width="'+W3+'" height="'+H3.toFixed(1)+'" fill="#f0d6a4" stroke="#000" stroke-width="4"/>'+sl+
   '<rect x="'+(x3+W3*0.35).toFixed(1)+'" y="'+(y3+Math.min(18,H3*0.18)).toFixed(1)+'" width="'+(W3*0.3).toFixed(1)+'" height="9" rx="4.5" fill="#3a3a3a" stroke="#000" stroke-width="1.5"/>'+
   D(x3,y3+H3,x3+W3,y3+H3,cm(a),1)+D(x3,y3,x3,y3+H3,cm(b),1)+(c>0?D(x3+W3,y3,x3+W3+ddx,y3-ddy,cm(c),-1):'')+'</svg>';}
  return '<div style="page-break-inside:avoid;border-top:3px dashed #000;padding-top:6px;margin-top:8px">'+out+'</div>';
 }
 function bambooSummary(o){
  var m=o.bamboo;if(!m)return '';
  return '<p style="margin:8px 0 2px"><b>البامبو'+(m.kind2?' — '+esc(m.kind2):'')+'</b></p><table><tr><td>الاسم</td><td>'+esc(m.n||'-')+'</td><td>المقاس (برّه برّه)</td><td>'+esc(m.a)+'×'+esc(m.b)+(num(m.c)>0?'×'+esc(m.c):'')+' سم</td></tr>'+
   '<tr><td>العدد</td><td>'+esc(m.q||o.qty||1)+'</td><td>الصنايعي</td><td>'+esc(o.crafter||'-')+(o.crafterPhone?' — '+esc(o.crafterPhone):'')+'</td></tr>'+
   (num(m.lip)>0?'<tr><td>الشفة</td><td>'+esc(m.lip)+' سم كل جانب</td><td>التقسيم</td><td>'+(num(m.div)>0?num(m.div)+' فاصل':'من غيره')+'</td></tr>':'<tr><td>التقسيم</td><td colspan="3">'+(num(m.div)>0?num(m.div)+' فاصل':'من غيره')+'</td></tr>')+'</table>'+
   '<p style="margin:8px 0 2px"><b>رسم للصنايعي (مقاسات بالسنتي)</b></p><div>'+bambooSvg(m)+'</div>';
 }
 /* تحويل كل svg جوه عنصر (رسمة البامبو) لصورة JPEG ورفعها وريع لينكات عامة — برسم الـ svg نفسه (مش html2canvas، كان بيعلّق على الباترن/الأسهم) */
 function svgToBlob(svgEl,scale){
  return new Promise(function(resolve,reject){
   var vb=svgEl.viewBox&&svgEl.viewBox.baseVal,w=(vb&&vb.width)||svgEl.clientWidth||600,h=(vb&&vb.height)||svgEl.clientHeight||400;
   var xml=new XMLSerializer().serializeToString(svgEl),svg64=btoa(unescape(encodeURIComponent(xml))),img=new Image();
   img.onload=function(){
    try{
     var c=document.createElement('canvas');c.width=Math.round(w*(scale||2));c.height=Math.round(h*(scale||2));
     var x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(img,0,0,c.width,c.height);
     c.toBlob(function(b){b?resolve(b):reject(new Error('مقدرتش أحوّل الرسمة لصورة'))},'image/jpeg',.92);
    }catch(e){reject(e)}};
   img.onerror=function(){reject(new Error('مقدرتش أحوّل الرسمة لصورة'))};
   img.src='data:image/svg+xml;base64,'+svg64;
  });
 }
 async function elToImgUrls(el){
  var svgs=el.querySelectorAll('svg'),urls=[];
  for(var i=0;i<svgs.length;i++){
   var blob=await svgToBlob(svgs[i]);
   var path='bamboo/'+uid()+'-'+i+'.jpg';
   urls.push(await window.mkUpload(blob));
  }
  return urls;
 }
 /* شاشة بسيطة لأوردر بامبو: البامبو بيتعمل بره عند صنايعي وعبده بيستلمه، فمفيش تجهيز قطع ولا تقطيع لوح — رسمة واحدة بالمقاسات (برّه برّه) بس، تتبعت له على واتساب على طول */
 function viewBamboo(id,pre){
  var old=id?ORD.find(function(x){return x.id===id}):null;
  var m=old&&old.bamboo?JSON.parse(JSON.stringify(old.bamboo)):{n:'',a:'',b:'',c:'',lip:'',div:'',kind2:'طبيعي',q:1};
  if(!old&&pre&&pre.bamboo)m=Object.assign(m,pre.bamboo);
  var b=shell(old?'🎍 تعديل '+esc(ordNo(old)):'🎍 أوردر بامبو',old?function(){viewOrder(id)}:viewOrders);mark('bamboo');
  b.innerHTML='<div class="wkc"><h3>القطعة</h3><div class="wkg">'+fi('bN','الاسم (مثلا: درج بامبو)',m.n)+
   '<div class="wkf"><label>النوع</label><select id="bKind"><option'+(m.kind2==='طبيعي'?' selected':'')+'>طبيعي</option><option'+(m.kind2==='صناعي'?' selected':'')+'>صناعي</option></select></div>'+
   fi('bA','العرض (سم) — برّه برّه (مقاس الشاسيه)',m.a,'inputmode="decimal"')+fi('bB','الارتفاع (سم) — برّه برّه',m.b,'inputmode="decimal"')+fi('bC','العمق (سم) — برّه برّه — اختياري',m.c,'inputmode="decimal"')+fi('bL','الشفة البارزة كل جانب (سم) — اختياري',m.lip,'inputmode="decimal"')+fi('bDv','عدد الفواصل (التقسيم) — 0 لو من غيره',m.div||0,'inputmode="numeric"')+fi('bQ','العدد',m.q||1,'inputmode="numeric"')+'</div></div>'+
   '<div class="wkc"><h3>📐 رسم للصنايعي <small style="color:var(--muted)">(ده اللي بيتطبع أو يتبعت واتساب — المقاس من بره بره)</small></h3><div id="bD" style="overflow:auto"></div>'+
   '<div class="wkrow" style="margin-top:8px"><button type="button" class="wkbtn p" id="bWa">📲 ابعت الرسمة على واتساب الصنايعي</button></div></div>'+
   '<div class="wkc"><h3>بيانات الأوردر</h3><div class="wkg">'+fi('bCu','العميل',old?old.customer:(pre&&pre.customer)||'')+fi('bPh','تليفون العميل',old?old.phone:(pre&&pre.phone)||'')+fi('bCr','اسم الصنايعي (اللي بيصنّعه)',old?old.crafter:'')+fi('bCrPh','تليفون الصنايعي (واتساب)',old?old.crafterPhone:'')+fi('bPc','سعر البيع',old?old.price:'','inputmode="decimal"')+fi('bPd','العربون',old?old.paid:'','inputmode="decimal"')+'</div>'+
   '<div class="wkf" style="margin-top:8px"><label>ملاحظات</label><textarea id="bNo" rows="2">'+esc(old?old.notes:'')+'</textarea></div>'+
   '<div class="wkrow" style="margin-top:10px"><button type="button" class="wkbtn p" id="bSv">💾 حفظ كأوردر</button><button type="button" class="wkbtn" id="bPr">🖨️ حفظ وطباعة</button><button type="button" class="wkbtn" id="bInv">🧾 حفظ وفاتورة</button></div></div>';
  function q(i){return b.querySelector('#'+i)}
  function draw(){var d=q('bD');m.n=q('bN').value;m.kind2=q('bKind').value;m.a=q('bA').value;m.b=q('bB').value;m.c=q('bC').value;m.lip=q('bL').value;m.div=q('bDv').value;m.q=q('bQ').value;
   d.innerHTML=(num(m.a)>0&&num(m.b)>0)?bambooSvg(m):'<span style="color:var(--muted)">اكتب العرض والارتفاع وهتظهر الرسمة</span>'}
  ['bN','bA','bB','bC','bL','bDv','bQ'].forEach(function(i){q(i).addEventListener('input',draw)});
  q('bKind').addEventListener('change',draw);
  draw();
  function read(){m.n=q('bN').value.trim();m.kind2=q('bKind').value;m.a=q('bA').value;m.b=q('bB').value;m.c=q('bC').value;m.lip=q('bL').value;m.div=num(q('bDv').value)||0;m.q=num(q('bQ').value)||1}
  async function save(after){
   read();
   var o=old||{id:uid(),no:CFG.next++,date:today(),hist:[],stage:0,mats:[]};
   o.type='بامبو';if(!old)wkNewCode(o);o.kind='other';o.bamboo=m;o.w=num(m.a);o.h=num(m.b);o.qty=num(m.q)||1;
   o.customer=q('bCu').value.trim();o.phone=q('bPh').value.trim();o.crafter=q('bCr').value.trim();o.crafterPhone=q('bCrPh').value.trim();o.price=q('bPc').value;o.paid=q('bPd').value;o.notes=q('bNo').value.trim();
   if(!old){o.hist.push({n:stages('بامبو')[0],at:new Date().toISOString(),by:who()});ORD.push(o)}
   try{
    await saveOrd();if(!old)await saveCfg();
    toast('✔ اتحفظ '+ordNo(o));
    if(after==='print')printMenu(o);
    else if(after==='inv'){viewOrder(o.id);setTimeout(function(){var x=document.getElementById('wkInv');if(x)x.click()},100)}
    else viewOrder(o.id);
   }catch(e){errAlert(e)}}
  q('bSv').onclick=function(){save()};q('bPr').onclick=function(){save('print')};q('bInv').onclick=function(){save('inv')};
  q('bWa').onclick=async function(){
   read();
   if(!(num(m.a)>0&&num(m.b)>0))return toast('اكتب المقاس الأول');
   var ph0=q('bCrPh').value.trim()||(contacts().find(function(z){return z.name===q('bCr').value.trim()})||{}).phone||prompt('رقم واتساب الصنايعي','')||'';
   if(!ph0)return;
   var ph=(typeof waNum==='function')?waNum(ph0):ph0.replace(/\D/g,'');
   if(ph.length<11)return toast('الرقم مش صح: '+ph0+' — اكتبه بالصفر الأول (01xxxxxxxxx)');
   var msg='رسمة بامبو'+(m.kind2?' ('+m.kind2+')':'')+(m.n?' — '+m.n:'')+'\nالمقاس (برّه برّه): '+num(m.a)+'×'+num(m.b)+(num(m.c)>0?'×'+num(m.c):'')+' سم'+(num(m.lip)>0?'\nالشفة البارزة: '+num(m.lip)+' سم كل جانب':'')+(num(m.div)>0?'\nالتقسيم: '+num(m.div)+' فاصل':'')+(num(m.q)>1?'\nالعدد: '+num(m.q):'')+(q('bNo').value.trim()?'\nملاحظات: '+q('bNo').value.trim():'');
   if(!(await ask('أبعت الرسمة دي لرقم '+ph0+'؟\n\n'+msg,'ابعت','لأ')))return;
   var btn=q('bWa'),old2=btn.textContent;btn.disabled=true;btn.textContent='⏳ بتتبعت الصورة...';
   try{
    var urls=await elToImgUrls(q('bD'));
    var r=await SBc().from('wa_out').insert({to_phone:ph,body:msg,imgs:urls,by_name:who()});
    if(r.error)throw r.error;
    toast('✔ الرسمة في الطريق للصنايعي — لو ماوصلتش خلال شوية تأكد إن جهاز الواتساب في المحل شغال ومتصل');
   }catch(e){errAlert(e)}
   finally{btn.disabled=false;btn.textContent=old2}
  };
 }
 /* قراءة رسالة واتساب: مقاسات (60×120) وعدد وشكل */
 function parseMsg(t){
  t=String(t||'').replace(/[٠-٩]/g,function(d){return d.charCodeAt(0)-1632}).replace(/[٫،]/g,'.');
  var out=[],re=/(\d+(?:\.\d+)?)\s*(?:x|X|×|\*|في|فى|ب)\s*(\d+(?:\.\d+)?)/g,m;
  while((m=re.exec(t))){
   var tail=t.slice(m.index+m[0].length,m.index+m[0].length+25),head=t.slice(Math.max(0,m.index-18),m.index);
   var q=/(\d+)\s*(?:قطع|قطعه|قطعة|حته|حتة|عدد)/.exec(tail)||/(?:عدد|كمية|كميه)\s*(\d+)/.exec(head+tail);
   var ctxS=tail+' | '+head,sh=/(?:^|\s)L(?:\s|$|\|)|حرف\s*ال|ثنيه|ثنية/i.test(ctxS)?'L':/(?:^|\s)U(?:\s|$|\|)|حرف\s*يو/i.test(ctxS)?'U':'مسطحة';
   out.push({n:'',a:m[1],b:m[2],q:q?+q[1]:1,shape:sh,bends:sh==='مسطحة'?0:(sh==='L'?1:2),flange:3});
  }
  return out;
 }
 function viewSteel(id,pre){
  var old=id?ORD.find(function(x){return x.id===id}):null;
  var S=old&&old.steel?JSON.parse(JSON.stringify(old.steel)):{W:120,H:240,gap:0.3,waste:5,thick:1,grade:'304',finish:'لامع',sheetPrice:'',bendPrice:'',fee:'',pieces:[{n:'',a:'',b:'',q:1,shape:'مسطحة',bends:0,flange:3}]};
  if(!old&&pre&&pre.pieces&&pre.pieces.length)S.pieces=pre.pieces;
  S.pieces.forEach(function(p){if(p.flange==null||p.flange==='')p.flange=3});
  var SEL=0,V=null;
  var b=shell(old?'🔩 تجهيز '+esc(ordNo(old)):'🔩 تجهيز قطعة استانلس',old?function(){viewOrder(id)}:viewOrders);mark('steel');
  function opt(arr,cur){return arr.map(function(x){return '<option'+(x===cur?' selected':'')+'>'+x+'</option>'}).join('')}
  b.innerHTML=(pre&&pre.body?'<div class="wkc" style="background:#fff8e1"><b>📩 رسالة الواتساب:</b><div style="white-space:pre-wrap;margin-top:4px">'+esc(pre.body)+'</div></div>':'')+
   '<div class="wkc"><h3>1️⃣ اللوح من المخزون</h3><div class="wkf"><label>اختار اللوح (اللي اشتريته في المشتريات) — المقاس والسعر بيتملوا لوحدهم</label><input id="sSk" list="sSkL" value="'+esc(S.sheetProd||'')+'" placeholder="🔎 اكتب: لوح / استانلس / 120"><datalist id="sSkL">'+(db.products||[]).filter(function(p){return /ستانلس|استانلس|ستانليس|ستيل|لوح|صاج/.test((p.name||'')+' '+(p.cat||''))}).slice(0,300).map(function(p){return '<option value="'+esc(String(p.name).trim())+'">رصيد '+esc(p.qty)+'</option>'}).join('')+'</datalist></div><div id="sSkI" style="font-size:13px;margin-top:6px;color:var(--muted)"></div>'+
   '<div class="wkg" style="margin-top:8px">'+fi('sW','عرض اللوح (سم)',S.W,'inputmode="decimal"')+fi('sH','طول اللوح (سم)',S.H,'inputmode="decimal"')+fi('sG','فاصل القص (سم)',S.gap,'inputmode="decimal"')+
   fi('sTh','السمك (مم)',S.thick,'inputmode="decimal"')+'<div class="wkf"><label>النوع</label><select id="sGr">'+opt(['304','316','201','430'],S.grade)+'</select></div>'+
   '<div class="wkf"><label>التشطيب</label><select id="sFi">'+opt(['لامع','مط','ساتان','هيرلاين','مرايا'],S.finish)+'</select></div></div></div>'+
   '<div class="wkc"><h3>2️⃣ الأسعار</h3><div class="wkg">'+fi('sSP','سعر شراء اللوح (تكلفتك)',S.sheetPrice,'inputmode="decimal"')+fi('sSS','سعر بيع اللوح للزبون',S.sellSheet||'','inputmode="decimal" placeholder="فاضي = سعر الشراء"')+
   fi('sBP','سعر الثنية الواحدة على الزبون',S.bendPrice,'inputmode="decimal"')+fi('sCt','سعر قص القطعة على الزبون',S.cutPrice||'','inputmode="decimal"')+fi('sWa','نسبة الهالك %',S.waste,'inputmode="decimal"')+
   fi('sFe','🔧 أجرة الصنايعي (عليك)',S.fee||'','inputmode="decimal"')+fi('sMg','ربح زيادة % (اختياري)',S.margin||'','inputmode="decimal"')+'</div></div>'+
   '<div class="wkc"><h3>القطع <small style="color:var(--muted)">(اضغط 👁️ لعرضها 3D)</small></h3><div id="sP"></div><button type="button" class="wkbtn" id="sPA">➕ قطعة</button></div>'+
   '<div class="wkc"><h3>المجسّم 3D <small style="color:var(--muted)">(اسحب بإصبعك أو الماوس عشان تلفّه)</small></h3><div class="draw" id="s3d"></div>'+
   '<div class="wkrow" style="margin-top:8px;justify-content:center"><button type="button" class="wkbtn" id="rL">⟲ يمين</button><button type="button" class="wkbtn" id="rR">⟳ شمال</button><button type="button" class="wkbtn" id="rU">⬆</button><button type="button" class="wkbtn" id="rD">⬇</button><button type="button" class="wkbtn" id="rZ">↺ إعادة</button></div></div>'+
   '<div class="wkc"><h3>📐 رسم الصنايعي (2D) <small style="color:var(--muted)">(ده اللي بيتطبع في الورقة)</small></h3><div id="s2d" style="overflow:auto"></div></div>'+
   '<div class="wkc"><h3>النتيجة وتقطيع الألواح</h3><div id="sR"></div><div id="sL"></div></div>'+
   '<div class="wkc"><h3>بيانات الأوردر</h3><div class="wkg">'+fi('sC','العميل',old?old.customer:(pre&&pre.customer)||'')+fi('sPh','تليفون',old?old.phone:(pre&&pre.phone)||'')+fi('sCr','الصنايعي',old?old.crafter:'')+fi('sPc','سعر البيع (بتكتبه إنت)',old?old.price:'','inputmode="decimal"')+fi('sPd','العربون',old?old.paid:'','inputmode="decimal"')+'</div>'+
   '<div class="wkf" style="margin-top:8px"><label>ملاحظات للصنايعي</label><textarea id="sNo" rows="2">'+esc(old?old.notes:(pre&&pre.note)||'')+'</textarea></div>'+
   '<div class="wkrow" style="margin-top:10px"><button type="button" class="wkbtn p" id="sSv">💾 حفظ كأوردر (خط سير)</button><button type="button" class="wkbtn" id="sPr">🖨️ حفظ وطباعة ورقة الصنايعي</button><button type="button" class="wkbtn" id="sPrep">🛠️ حفظ وابدأ التجهيز</button><button type="button" class="wkbtn" id="sInv">🧾 حفظ وفاتورة</button></div></div>';
  function q(i){return b.querySelector('#'+i)}
  function show3d(){
   var p=S.pieces[SEL],el=q('s3d');if(!p)return;
   if(!(num(p.a)>0&&num(p.b)>0)){el.innerHTML='<span style="color:var(--muted)">اكتب طول وعرض القطعة وهيظهر المجسّم</span>';var d0=q('s2d');if(d0)d0.innerHTML='';return}
   V=mount3d(el,{a:num(p.a),b:num(p.b),shape:p.shape,flange:num(p.flange)||3},num(S.thick)/10);
   var d2=q('s2d');if(d2)d2.innerHTML=techSvg({n:p.n,a:num(p.a),b:num(p.b),q:num(p.q)||1,shape:p.shape,flange:num(p.flange)||3},num(S.thick)/10);
  }
  function drawP(){
   q('sP').innerHTML=S.pieces.map(function(p,i){return '<div class="wkg" style="margin-bottom:8px;align-items:end;'+(i===SEL?'background:#eef6f7;padding:6px;border-radius:10px':'')+'">'+
   '<div class="wkf"><label>الاسم</label><input data-k="n" data-i="'+i+'" value="'+esc(p.n)+'"></div>'+
   '<div class="wkf"><label>'+(p.shape==='مسطحة'||p.shape==='مخصص'?'الطول':'الطول (عرض الباب)')+'</label><input data-k="a" data-i="'+i+'" value="'+esc(p.a)+'" inputmode="decimal"></div>'+
   '<div class="wkf"><label>'+(p.shape==='U'?'تخانة الباب (جوه حرف U)':p.shape==='L'?'عرض القاعدة':p.shape==='Z'?'المسافة بين الثنيتين':'العرض')+'</label><input data-k="b" data-i="'+i+'" value="'+esc(p.b)+'" inputmode="decimal"></div>'+
   '<div class="wkf"><label>العدد</label><input data-k="q" data-i="'+i+'" value="'+esc(p.q)+'" inputmode="numeric"></div>'+
   '<div class="wkf"><label>الشكل</label><select data-k="shape" data-i="'+i+'">'+opt(Object.keys(BEND),p.shape)+'</select></div>'+
   '<div class="wkf"><label>ارتفاع الثنية</label><input data-k="flange" data-i="'+i+'" value="'+esc(p.flange)+'" inputmode="decimal"></div>'+
   '<div class="wkf"><label>عدد الثنيات</label><input data-k="bends" data-i="'+i+'" value="'+esc(p.bends)+'" inputmode="numeric"></div>'+
   '<div class="wkrow"><button type="button" class="wkbtn'+(i===SEL?' p':'')+'" data-v="'+i+'">👁️ 3D</button><button type="button" class="wkbtn d" data-d="'+i+'">حذف</button></div></div>'}).join('');
   b.querySelectorAll('[data-k]').forEach(function(x){var ev=x.tagName==='SELECT'?'change':'input';x.addEventListener(ev,function(){var i=+x.dataset.i,p=S.pieces[i];p[x.dataset.k]=x.value;SEL=i;
    if(x.dataset.k==='shape'&&x.value!=='مخصص'){p.bends=BEND[x.value];var bi=b.querySelector('[data-k="bends"][data-i="'+i+'"]');if(bi)bi.value=p.bends}
    if(x.dataset.k==='shape'){drawP()}
    calc();show3d()})});
   b.querySelectorAll('[data-v]').forEach(function(x){x.onclick=function(){SEL=+x.dataset.v;drawP();show3d()}});
   b.querySelectorAll('[data-d]').forEach(function(x){x.onclick=function(){S.pieces.splice(+x.dataset.d,1);if(!S.pieces.length)S.pieces.push({n:'',a:'',b:'',q:1,shape:'مسطحة',bends:0,flange:3});SEL=0;drawP();calc();show3d()}});
  }
  var LAST={};
  function calc(){
   S.W=num(q('sW').value);S.H=num(q('sH').value);S.gap=num(q('sG').value);S.thick=q('sTh').value;S.grade=q('sGr').value;S.finish=q('sFi').value;S.sheetPrice=q('sSP').value;S.bendPrice=q('sBP').value;S.waste=num(q('sWa').value);S.fee=q('sFe').value;S.sheetProd=q('sSk').value.trim();S.sellSheet=q('sSS').value;S.cutPrice=q('sCt').value;S.margin=q('sMg').value;
   var P=S.pieces.map(function(p){return {n:p.n,a:num(p.a),b:num(p.b),q:Math.max(1,num(p.q)||1),shape:p.shape,bends:num(p.bends),flange:num(p.flange)||3}}).filter(function(p){return p.a>0&&p.b>0});
   if(!S.W||!S.H||!P.length){q('sR').innerHTML='<span style="color:var(--muted)">اكتب مقاسات اللوح والقطع</span>';q('sL').innerHTML='';LAST={};return}
   var DV=function(p){var nb=p.shape==='L'?1:(p.shape==='U'||p.shape==='Z')?2:(p.shape==='مخصص'?p.bends:0);return Math.round((p.b+nb*(p.flange||3))*10)/10};
   var PK=P.map(function(p){return {a:p.a,b:DV(p),q:p.q,n:p.n}});
   var r=pack(S.W,S.H,PK,S.gap),n=r.sheets.length;
   var area=PK.reduce(function(a,p){return a+p.a*p.b*p.q},0),use=n?area/(n*S.W*S.H)*100:0;
   var bends=P.reduce(function(a,p){return a+p.bends*p.q},0),bc=bends*num(S.bendPrice);
   var frac=Math.round(area*(1+S.waste/100)/(S.W*S.H)*1000)/1000,cuts=P.reduce(function(a,p){return a+p.q},0),sellS=num(S.sellSheet)||num(S.sheetPrice),mat=frac*num(S.sheetPrice),matS=frac*sellS,cc=cuts*num(S.cutPrice);
   var sug=Math.round((matS+bc+cc)*(1+num(S.margin)/100));
   var byArea=Math.ceil(area*(1+S.waste/100)/(S.W*S.H));
   var fee=num(S.fee),pr=num(q('sPc')&&q('sPc').value);
   LAST={sheets:n,bends:bends,bendCost:bc,matCost:mat,fee:fee,total:Math.round((mat+fee)*100)/100,pieces:P,frac:frac,sug:sug,cuts:cuts};
   var pr2=pr||sug,cost=mat+fee;
   q('sR').innerHTML='<div style="font-size:13px;margin-bottom:6px">'+P.map(function(p){return '📐 '+(p.n?esc(p.n)+': ':'')+(SHN[p.shape]||p.shape)+' — الشريحة قبل الثني <b>'+p.a+' × '+DV(p)+'</b> سم ×'+p.q}).join('<br>')+'</div>'+
    '<div class="wkg"><div class="sample">من المخزون: <b>'+frac+'</b> لوح ('+Math.round(frac*100)+'% من لوح)</div><div class="sample">ألواح تقطيع فعلي: <b>'+n+'</b> — استفادة '+Math.round(use)+'%</div><div class="sample">القطع: <b>'+cuts+'</b> — الثنيات: <b>'+bends+'</b></div></div>'+
    '<div style="margin-top:8px;line-height:2;font-size:15px">🪨 الخامة على الزبون: <b>'+fmt(Math.round(matS))+'</b> ج <small>(تكلفتها '+fmt(Math.round(mat))+')</small><br>🔧 الثني: '+bends+' × '+fmt(num(S.bendPrice))+' = <b>'+fmt(bc)+'</b> ج<br>✂️ القص: '+cuts+' × '+fmt(num(S.cutPrice))+' = <b>'+fmt(cc)+'</b> ج'+(num(S.margin)?'<br>➕ ربح زيادة '+num(S.margin)+'%':'')+'</div>'+
    '<div style="margin-top:8px;padding:12px;border-radius:12px;background:#e8f7ee;border:2px solid #7bcf9a"><div style="font-size:15px">💰 السعر المقترح للزبون</div><div style="font-size:26px;font-weight:900">'+fmt(sug)+' ج</div><div style="font-size:13px">القطعة ≈ '+fmt(cuts?Math.round(sug/cuts):0)+' ج — تكلفتك '+fmt(Math.round(cost))+' ج — ربحك <b>'+fmt(Math.round(pr2-cost))+'</b> ج'+(pr?' (بسعرك '+fmt(pr)+')':'')+'</div>'+
    '<button type="button" class="wkbtn p" id="sUse" style="margin-top:8px">✔ استخدم السعر ده</button></div>'+
    (S.sheetProd?'<p style="font-size:13px;margin:6px 0 0">📦 لما تعمل فاتورة هيتخصم <b>'+frac+'</b> من «'+esc(S.sheetProd)+'»</p>':'<p style="color:#b45309;font-size:13px;margin:6px 0 0">⚠️ اختار اللوح من المخزون فوق عشان يتخصم في الفاتورة</p>')+
    (r.bad.length?'<p style="color:#c0392b">⚠️ '+r.bad.length+' قطعة أكبر من اللوح ومش هتتقطع.</p>':'');
   var us=q('sUse');if(us)us.onclick=function(){q('sPc').value=sug;calc()};
   q('sL').innerHTML=r.sheets.map(function(sh,i){return sheetSvg(S.W,S.H,sh,i)}).join('');
  }
  b.querySelectorAll('#sW,#sH,#sG,#sTh,#sSP,#sBP,#sWa,#sFe,#sPc,#sSS,#sCt,#sMg').forEach(function(x){x.addEventListener('input',function(){calc();show3d()})});
  b.querySelectorAll('#sGr,#sFi').forEach(function(x){x.addEventListener('change',calc)});
  function skFill(force){var nm=q('sSk').value.trim(),p=(db.products||[]).find(function(x){return String(x.name).trim()===nm}),inf=q('sSkI');
   if(!p){inf.textContent=nm?'⚠️ مش لاقي اللوح ده في المخزون':'';calc();return}
   var t=String(p.name).replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d)}),m=t.match(/(\d+(?:\.\d+)?)\s*(?:[×xX*\/]|في)\s*(\d+(?:\.\d+)?)/),th=t.match(/(\d+(?:\.\d+)?)\s*(?:مم|mm|ملي|م م)/i),gr=t.match(/\b(304|316|201|430)\b/);
   if(m&&+m[1]>=30&&+m[2]>=30){q('sW').value=Math.min(+m[1],+m[2]);q('sH').value=Math.max(+m[1],+m[2])}
   if(th)q('sTh').value=th[1];if(gr){q('sGr').value=gr[1]}
   if(force||!q('sSP').value)q('sSP').value=num(p.cost)||'';if(force||!q('sSS').value)q('sSS').value=num(p.price)||'';
   inf.innerHTML='✔ رصيد «'+esc(p.name)+'»: <b>'+esc(p.qty)+'</b> '+esc(p.unit||'')+' — تكلفة '+fmt(num(p.cost))+' — بيع '+fmt(num(p.price));calc();show3d()}
  q('sSk').addEventListener('change',function(){skFill(true)});q('sSk').addEventListener('input',function(){var nm=this.value.trim();if((db.products||[]).some(function(x){return String(x.name).trim()===nm}))skFill(true)});
  if(S.sheetProd)setTimeout(function(){skFill(false)},0);
  q('sPA').onclick=function(){S.pieces.push({n:'',a:'',b:'',q:1,shape:'مسطحة',bends:0,flange:3});SEL=S.pieces.length-1;drawP();show3d()};
  q('rL').onclick=function(){if(V)V.rot(-0.25,0)};q('rR').onclick=function(){if(V)V.rot(0.25,0)};q('rU').onclick=function(){if(V)V.rot(0,-0.2)};q('rD').onclick=function(){if(V)V.rot(0,0.2)};q('rZ').onclick=function(){if(V)V.reset()};
  drawP();calc();show3d();
  async function save(after){
   calc();var cu=q('sC').value.trim();if(!cu)return toast('اكتب اسم العميل');if(!LAST.sheets)return toast('اكتب القطع الأول');
   var steel=Object.assign({},S,{sheets:LAST.sheets,pieces:LAST.pieces,frac:LAST.frac,sug:LAST.sug});
   if(!q('sPc').value&&LAST.sug)q('sPc').value=LAST.sug;
   var o=old||{id:uid(),no:CFG.next++,type:'استانلس',date:today(),kind:'other',w:'',h:'',qty:1,mats:[],fee:'',stage:0,hist:[{n:stages('استانلس')[0],at:new Date().toISOString(),by:who()}]};
   o.customer=cu;o.phone=q('sPh').value.trim();o.crafter=q('sCr').value.trim();o.price=q('sPc').value;o.paid=q('sPd').value;o.notes=q('sNo').value.trim();
   o.cost=String(LAST.total);o.steel=steel;o.w=S.W;o.h=S.H;o.qty=LAST.sheets;
   if(pre&&pre.wa_id)o.src={wa:pre.wa_id};
   if(after==='prep'&&stages('استانلس').length>1&&!old){o.stage=1;o.hist.push({n:stages('استانلس')[1],at:new Date().toISOString(),by:who()})}
   if(!old){wkNewCode(o);ORD.push(o)}
   try{
    await saveOrd();if(!old)await saveCfg();
    if(pre&&pre.wa_id){try{await SBc().from('wa_orders').update({status:'done'}).eq('id',pre.wa_id)}catch(e){}}
    toast('✔ اتحفظ '+ordNo(o));
    if(after==='print')printMenu(o);
    else if(after==='inv'){viewOrder(o.id);setTimeout(function(){var x=document.getElementById('wkInv');if(x)x.click()},100)}
    else viewOrder(o.id);
   }catch(e){errAlert(e)}}
  q('sSv').onclick=function(){save()};q('sPr').onclick=function(){save('print')};q('sPrep').onclick=function(){save('prep')};q('sInv').onclick=function(){save('inv')};
 }
 async function stainlessFrom(ctx){
  if(!isAdm()){toast('الشاشة دي للمدير بس');return}
  await loadAll();NS=1;
  var pcs=parseMsg(ctx&&ctx.body);
  viewSteel(null,{customer:ctx&&ctx.customer,phone:ctx&&ctx.phone,body:ctx&&ctx.body,wa_id:ctx&&ctx.id,pieces:pcs,note:''});
 }

  /* ---------- الفضل (بواقي الأطوال) ---------- */
 var OFS=['متاحة','محجوزة','اتباعت','خردة','بتاعة الزبون'];
 function offCode(n){return 'FD-'+String(n).padStart(4,'0')}
 function prodNames(){try{return (db.products||[]).map(function(p){return p.name})}catch(e){return []}}
 /* تقطيع طولي (1D cutting stock): بيجرّب أكتر من أسلوب ويختار الأقل في عدد الأعواد، وبعدين الأكبر فضلة صالحة لإعادة الاستخدام.
    الأساليب: FFD / BFD / ملء العود بأفضل مجموعة (subset-sum). كل قطعة بتاخد سمك المنشار (kerf) مرة. */
 function planFFD(L,bar,kerf,best){var bars=[];L.forEach(function(x){var pick=null;
   bars.forEach(function(z){var ok=z.left>=x+kerf-1e-9||(z.cuts.length===0&&z.left>=x-1e-9);if(!ok)return;if(!pick||(best&&z.left<pick.left))pick=pick&&!best?pick:z});
   if(!pick){pick={left:bar,cuts:[]};bars.push(pick)}pick.cuts.push(x);pick.left=Math.round((pick.left-x-kerf)*100)/100});return bars}
 function planFill(L,bar,kerf){var rest=L.slice(),bars=[];var U=0.5;
  while(rest.length){var cap=Math.floor(bar/U),first=rest.shift(),b={left:bar,cuts:[first]};b.left=Math.round((b.left-first-kerf)*100)/100;
   /* أحسن مجموعة من الباقي تملا الباقي من العود (DP على 0.5 سم) */
   var room=b.left,W=Math.floor((room+kerf+1e-9)/U),n=rest.length,items=rest.map(function(x){return Math.max(1,Math.round((x+kerf)/U))});
   if(room>0&&n&&n<=120){var dp=new Array(W+1).fill(-1);dp[0]=0;var from=new Array(W+1).fill(-1),pick=[];
    for(var i=0;i<n;i++){if(items[i]>W)continue;for(var w=W;w>=items[i];w--){if(dp[w-items[i]]>=0&&dp[w]<0){dp[w]=i;from[w]=w-items[i]}}}
    var bw=0;for(var w2=W;w2>=0;w2--){if(dp[w2]>=0){bw=w2;break}}
    var used={},w3=bw;while(w3>0&&dp[w3]>=0){var ii=dp[w3];if(used[ii])break;used[ii]=1;w3=from[w3]}
    var keep=[];rest.forEach(function(x,idx){if(used[idx]){b.cuts.push(x);b.left=Math.round((b.left-x-kerf)*100)/100}else keep.push(x)});rest=keep}
   bars.push(b)}return bars}
 function planScore(bars){var left=bars.map(function(b){return b.left}).sort(function(a,c){return c-a});return [bars.length,-(left[0]||0),bars.reduce(function(a,b){return a+b.left},0)]}
 function plan(lens,bar,kerf){
  kerf=kerf||0;var L=lens.slice().filter(function(x){return x>0}).sort(function(a,b){return b-a});if(!L.length)return [];
  var C=[planFFD(L,bar,kerf,false),planFFD(L,bar,kerf,true)];try{C.push(planFill(L,bar,kerf))}catch(e){}
  var bestP=null,bs=null;C.forEach(function(r){var sc=planScore(r);if(!bs||sc[0]<bs[0]||(sc[0]===bs[0]&&(sc[1]<bs[1]||(sc[1]===bs[1]&&sc[2]<bs[2])))){bs=sc;bestP=r}});
  return bestP.map(function(b){b.cuts.sort(function(a,c){return c-a});return b});
 }
 window.mkPlanCut=plan;
 async function viewOff(hl){
  var b=shell('🧰 الفضل (بواقي الأطوال)');mark('off');
  var O=await get('wk_offcuts',[]);
  var minL=num(CFG.minOff)||20,F2={q:'',st:'متاحة'};
  function save(){return put('wk_offcuts',O)}
  function draw(){
   var rows=O.filter(function(o){return (!F2.st||o.status===F2.st)&&(!F2.q||(o.item+' '+o.color+' '+o.place+' '+o.code).indexOf(F2.q)>-1)});
   var by={};O.filter(function(o){return o.status==='متاحة'||o.status==='محجوزة'}).forEach(function(o){var k=o.item+(o.color?' / '+o.color:'');by[k]=(by[k]||0)+num(o.len)});
   var now=Date.now();
   b.innerHTML='<div class="wkc"><h3>موجود في الفضل ولا لا؟</h3><div class="wkg">'+fi('oqI','الصنف','','list="oqL"')+'<datalist id="oqL">'+prodNames().slice(0,400).map(function(n){return '<option value="'+esc(n)+'">'}).join('')+'</datalist>'+
    fi('oqC','اللون','')+fi('oqP','المقاسات المطلوبة (سم) بشرطة /','','placeholder="60/45/120"')+fi('oqB','طول العود (سم)',600,'inputmode="decimal"')+fi('oqK','سمك المنشار (سم)',0.3,'inputmode="decimal"')+'</div>'+
    '<button type="button" class="wkbtn p" id="oqGo" style="margin-top:10px">🔍 دوّر</button><div id="oqR" style="margin-top:10px"></div></div>'+
    '<div class="wkc"><h3>إضافة فضلة</h3><div class="wkg">'+fi('oaI','الصنف','','list="oqL"')+fi('oaC','اللون','')+fi('oaL','الطول (سم)','','inputmode="decimal"')+fi('oaO','طول العود الأصلي (سم)',600,'inputmode="decimal"')+fi('oaP','المكان','')+'</div>'+
    '<div class="wkrow" style="margin-top:10px"><button type="button" class="wkbtn p" id="oaAdd">➕ إضافة وطباعة ملصق</button><button type="button" class="wkbtn" id="oaAdd2">➕ إضافة بس</button></div>'+
    '<p style="color:var(--muted);font-size:13px;margin:8px 0 0">أقل من '+minL+' سم بتتحسب خردة تلقائي (من الإعدادات).</p></div>'+
    '<div class="wkc"><h3>رصيد الفضل بالمتر</h3>'+(Object.keys(by).map(function(k){return '<span class="badge" style="margin:2px">'+esc(k)+': '+fmt(by[k]/100)+' م</span>'}).join('')||'<span class="empty">مفيش</span>')+'</div>'+
    '<div class="wkc"><div class="wkrow"><input id="ofQ" placeholder="دوّر بالصنف أو الكود" value="'+esc(F2.q)+'" style="flex:1;min-width:160px;padding:10px;border:1px solid var(--border);border-radius:10px"><select id="ofS" style="padding:10px;border-radius:10px;border:1px solid var(--border)"><option value="">كل الحالات</option>'+OFS.map(function(s){return '<option'+(F2.st===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></div>'+
    '<div class="table-wrap" style="margin-top:8px"><table><thead><tr><th>الكود</th><th>الصنف</th><th>الطول</th><th>المكان</th><th>العمر</th><th>الحالة</th><th></th></tr></thead><tbody>'+
    (rows.map(function(o){var i=O.indexOf(o),age=Math.floor((now-new Date(o.date).getTime())/864e5);
     return '<tr'+(hl&&o.code===hl?' style="background:#fff8e1"':'')+'><td>'+esc(o.code)+'</td><td>'+esc(o.item)+(o.color?' / '+esc(o.color):'')+'</td><td><b>'+esc(num(o.len))+'</b> سم</td><td>'+esc(o.place)+'</td><td>'+age+' يوم</td><td><span class="badge">'+esc(o.status)+'</span></td>'+
      '<td style="white-space:nowrap"><button type="button" class="wkbtn" data-a="sell" data-i="'+i+'">بيع جزء</button> <button type="button" class="wkbtn" data-a="res" data-i="'+i+'">حجز</button> <button type="button" class="wkbtn" data-a="lab" data-i="'+i+'">🏷️</button> <button type="button" class="wkbtn d" data-a="scr" data-i="'+i+'">خردة</button></td></tr>'}).join('')||'<tr><td colspan="7" class="empty">مفيش فضلات</td></tr>')+'</tbody></table></div></div>';
   b.querySelector('#ofQ').oninput=function(){F2.q=this.value;draw()};b.querySelector('#ofS').onchange=function(){F2.st=this.value;draw()};
   function add(print){
    var it=b.querySelector('#oaI').value.trim(),len=num(b.querySelector('#oaL').value);if(!it||!len)return toast('اكتب الصنف والطول');
    CFG.offNext=CFG.offNext||1;
    var o={id:uid(),code:offCode(CFG.offNext++),item:it,color:b.querySelector('#oaC').value.trim(),len:len,orig:num(b.querySelector('#oaO').value)||600,place:b.querySelector('#oaP').value.trim(),status:len<minL?'خردة':'متاحة',date:today()};
    O.push(o);Promise.all([save(),saveCfg()]).then(function(){toast('✔ اتسجّلت '+o.code);if(print)printOff(o);draw()}).catch(errAlert)}
   b.querySelector('#oaAdd').onclick=function(){add(true)};b.querySelector('#oaAdd2').onclick=function(){add(false)};
   b.querySelector('#oqGo').onclick=function(){
    var it=b.querySelector('#oqI').value.trim(),co=b.querySelector('#oqC').value.trim(),bar=num(b.querySelector('#oqB').value)||600,kerf=num(b.querySelector('#oqK').value),
        need=b.querySelector('#oqP').value.split(/[,،\s\/]+/).map(num).filter(function(x){return x>0}),el=b.querySelector('#oqR');
    if(!it||!need.length){el.innerHTML='<span class="empty">اكتب الصنف والمقاسات</span>';return}
    var pool=O.filter(function(o){return o.status==='متاحة'&&o.item.indexOf(it)>-1&&(!co||String(o.color).indexOf(co)>-1)}).map(function(o){return {o:o,len:num(o.len),used:false}});
    var exact=[],rest=[];
    need.slice().sort(function(a,c){return c-a}).forEach(function(n){
     var c=pool.find(function(p){return !p.used&&Math.abs(p.len-n)<=0.5});
     if(c){c.used=true;exact.push({n:n,o:c.o})}else rest.push(n)});
    /* أقل هدر: مجموعة قطع تتقطع من نفس الفضلة (الهدر = الباقي بعد القص) */
    var fit=[],left=rest.slice(),g=0;
    while(left.length&&g++<20){
     var best=null;
     pool.forEach(function(p){
      if(p.used)return;
      var lim=Math.min(left.length,12);
      for(var mask=1;mask<(1<<lim);mask++){
       var s=0,c=0,idx=[];
       for(var i=0;i<lim;i++)if(mask&(1<<i)){s+=left[i];c++;idx.push(i)}
       var tot=s+kerf*(c-1);
       if(tot>p.len+1e-9)continue;
       var waste=Math.round((p.len-tot)*10)/10;
       if(waste>minL)continue;                       /* الهدر الكبير مش من غير تهدير */
       if(!best||waste<best.waste||(waste===best.waste&&c>best.c))best={p:p,idx:idx,waste:waste,c:c};
      }});
     if(!best)break;
     best.p.used=true;
     var cut=best.idx.map(function(i){return left[i]});
     fit.push({o:best.p.o,cut:cut,waste:best.waste});
     left=left.filter(function(_,i){return best.idx.indexOf(i)<0});
    }
    /* اللي فضل: أقرب فضلة أكبر (مع بيان الهدر) + العود السليم */
    var near=left.map(function(n){
     var c=pool.filter(function(p){return !p.used&&p.len>=n}).sort(function(a,c2){return a.len-c2.len})[0];
     return {n:n,c:c};
    });
    var pl=left.length?plan(left,bar,kerf):[];
    var h='';
    if(exact.length)h+='<div class="sample"><b>✅ موجودة بنفس المقاس:</b><br>'+exact.map(function(f){return esc(f.n)+' سم ← <b>'+esc(f.o.code)+'</b> (مكانها: '+esc(f.o.place||'—')+') <button type="button" class="wkbtn" data-r="'+esc(f.o.code)+'">احجزها</button>'}).join('<br>')+'</div>';
    if(fit.length)h+='<div class="sample" style="margin-top:6px"><b>🟡 مش بنفس المقاس، لكن تتقطع من غير تهدير تقريبًا:</b><br>'+fit.map(function(f){return 'من <b>'+esc(f.o.code)+'</b> ('+esc(num(f.o.len))+' سم، '+esc(f.o.place||'—')+'): قطّع '+f.cut.map(esc).join(' + ')+' سم — الباقي <b>'+esc(f.waste)+'</b> سم <button type="button" class="wkbtn" data-r="'+esc(f.o.code)+'">احجزها</button>'}).join('<br>')+'</div>';
    if(left.length){
     h+='<div class="sample" style="margin-top:6px"><b>❌ مش موجودة في الفضل: '+left.join('، ')+'</b>';
     var nn=near.filter(function(x){return x.c});
     if(nn.length)h+='<br><small>أقرب فضلة أكبر (هدر كبير، مش مفضّل):</small><br>'+nn.map(function(x){return esc(x.n)+' سم ← '+esc(x.c.o.code)+' ('+esc(x.c.len)+' سم) هدر '+esc(Math.round((x.c.len-x.n)*10)/10)+' سم'}).join('<br>');
     h+='<br><b>✂️ الأفضل من عود سليم: '+pl.length+' عود</b><br>'+pl.map(function(x,i){return 'عود '+(i+1)+': '+x.cuts.join(' + ')+' (يتبقى '+esc(x.left)+' سم)'}).join('<br>')+'</div>';
    }
    /* الرصيد بالمتر (أعواد كاملة من المخزون + فضلات) وزرار نفّذ القص اللي بيخصم فعليًا */
    var prod=(db.products||[]).find(function(p){return p.name.trim()===it});
    var offM=pool.reduce(function(s,p){return s+p.len},0)/100,barM=prod?(num(prod.qty)*bar/100):0;
    var balLine='<div class="sample" style="margin-top:6px;background:var(--tint2)"><b>📏 الرصيد الحالي من «'+esc(it)+'»:</b> '+
     (prod?('<b>'+esc(prod.qty)+'</b> عود كامل ('+fmt(barM)+' م)'):'<span style="color:var(--danger)">الصنف ده مش مسجل كمنتج بنفس الاسم بالظبط — سجّله في المخزون عشان أقدر أخصم الأعواد منه تلقائي</span>')+
     (offM?' + <b>'+fmt(offM)+'</b> م فضلة':'')+(prod?' = <b>'+fmt(barM+offM)+'</b> م إجمالي':'')+'</div>';
    var canCut=exact.length||fit.length||pl.length;
    h=balLine+h+((canCut&&prod)?'<div style="margin-top:8px"><button type="button" class="wkbtn p" id="oqCut">✂️ نفّذ القص (يخصم فعليًا من المخزون ويسجّل الفضلة الجديدة)</button></div>':'');
    el.innerHTML=h||'<span class="empty">مفيش</span>';
    el.querySelectorAll('[data-r]').forEach(function(x){x.onclick=function(){var o=O.find(function(z){return z.code===x.dataset.r});if(o){o.status='محجوزة';save().then(function(){toast('✔ اتحجزت '+o.code);draw()}).catch(errAlert)}}});
    var cutBtnEl=el.querySelector('#oqCut');
    if(cutBtnEl)cutBtnEl.onclick=async function(){
     if(pl.length>num(prod.qty))return toast('مفيش عدد كافي من الأعواد — متاح '+prod.qty+' بس، ده محتاج '+pl.length);
     var msg='هتقص دلوقتي: '+(pl.length?pl.length+' عود كامل':'')+(pl.length&&(exact.length+fit.length)?' + ':'')+((exact.length+fit.length)?(exact.length+fit.length)+' فضلة':'')+'. هيتخصم من المخزون على طول ومينفعش يترجع.';
     if(!(await ask(msg,'نفّذ القص','لأ')))return;
     cutBtnEl.disabled=true;
     exact.forEach(function(f){f.o.status='اتباعت'});
     fit.forEach(function(f){f.o.status='اتباعت'});
     var newOffs=[];
     pl.forEach(function(bx){
      var leftover=Math.round(bx.left*10)/10;if(leftover<=0)return;
      CFG.offNext=CFG.offNext||1;var code=offCode(CFG.offNext++);
      var no={id:uid(),code:code,item:it,color:co,len:leftover,orig:bar,place:'',status:leftover<minL?'خردة':'متاحة',date:today()};
      O.push(no);newOffs.push(no);
     });
     var totalM=Math.round(need.reduce(function(s,n){return s+n},0))/100;
     try{
      await Promise.all([save(),saveCfg()]);
      var api=window.mkT&&window.mkT.api;
      if(pl.length&&api){await api.syncNow();await api.rpc('mk_adjust_stock',{p_id:prod.id,p_qty:num(prod.qty)-pl.length,p_note:'قص '+it+(co?' / '+co:'')+': '+fmt(totalM)+' م — '+need.join('+')+' سم'+(newOffs.length?' ('+newOffs.length+' فضلة جديدة)':'')});await api.refreshProducts([prod.id]);api.done&&api.done()}
      toast('✔ نُفّذ القص — '+(pl.length?pl.length+' عود + ':'')+(exact.length+fit.length)+' فضلة، إجمالي '+fmt(totalM)+' م'+(newOffs.length?' — '+newOffs.length+' فضلة جديدة اتسجّلت':''));
      draw();
     }catch(e){cutBtnEl.disabled=false;errAlert(e)}
    };
   };
      b.querySelectorAll('[data-a]').forEach(function(x){x.onclick=async function(){
    var o=O[+x.dataset.i],a=x.dataset.a;if(!o)return;
    if(a==='lab')return printOff(o);
    if(a==='res'){o.status=o.status==='محجوزة'?'متاحة':'محجوزة'}
    else if(a==='scr'){if(!(await ask('تحسبها خردة؟','خردة','لأ')))return;o.status='خردة'}
    else if(a==='sell'){
     var n=num(prompt('بعت كام سم من '+o.code+'؟ (طولها '+num(o.len)+')','')); if(!n||n<=0||n>num(o.len))return;
     var rest=Math.round((num(o.len)-n)*10)/10;
     if(rest<=0)o.status='اتباعت';else{o.len=rest;if(rest<minL){o.status='خردة'}}
     toast('اتخصم '+n+' سم. الباقي '+rest+' سم (سجّل البيع في فاتورة لخصمه من الرصيد)');
    }
    try{await save();draw()}catch(e){errAlert(e)}}});
  }
  draw();
 }
 function printOff(o){
  var html='<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>@page{size:50mm 30mm;margin:0}*{box-sizing:border-box;font-family:Cairo,Tahoma,Arial,sans-serif;color:#000}html{direction:rtl}body{margin:0 auto;width:48mm;height:28mm;padding:1mm;overflow:hidden;font-size:9px;text-align:center}svg{max-width:100%}</style></head><body><b>'+esc(o.item)+(o.color?' / '+esc(o.color):'')+'</b><br>'+esc(num(o.len))+' سم — '+esc(o.date)+'<br><svg class="bc" data-v="'+esc(o.code)+'"></svg>'+
   '<script src="https://cdnjs.cloudflare.com/ajax/libs/jsbarcode/3.11.6/JsBarcode.all.min.js"><\/script><script>window.onload=function(){document.querySelectorAll("svg.bc").forEach(function(x){try{JsBarcode(x,x.dataset.v,{format:"CODE128",displayValue:true,fontSize:11,margin:0,height:20})}catch(e){}})}<\/script></body></html>';
  if(typeof window.mkPrintHTML==='function')window.mkPrintHTML(html);
 }

 /* ---------- العرض والمصاريف ---------- */
 /* ---------- 🏬 بضاعة العرض: الصنف من المخزون بس، والإضافة بتخصم من المخزون والشيل بيرجّعه ---------- */
 async function viewDisp(){
  var b=shell('🏬 بضاعة العرض');mark('disp');
  var D=await get(K.disp,[]),ED=null;
  var P=function(id){return (db.products||[]).find(function(p){return p.id===id})};
  var r3=function(x){return Math.round(x*1000)/1000};
  async function stockMove(pid,delta,note){var A=window.mkT&&window.mkT.api;if(!A||!A.rpc)throw new Error('السيستم لسه بيحمّل — جرّب كمان شوية');
   await A.syncNow();await A.refreshProducts([pid]);var p=P(pid);if(!p)throw new Error('الصنف مش موجود في المخزون');
   await A.rpc('mk_adjust_stock',{p_id:pid,p_qty:r3(num(p.qty)+delta),p_note:note});await A.refreshProducts([pid]);A.done&&A.done()}
  function blank(){return {i:-1,pid:'',qty:'1',loc:'',price:''}}
  function plist(q){q=String(q||'').trim().toLowerCase();var L=(db.products||[]).filter(function(p){return !q||[p.name,p.code,p.barcode].some(function(v){return String(v||'').toLowerCase().indexOf(q)>=0})});
   return L.slice(0,60).map(function(p){return '<button type="button" class="dpI" data-pid="'+p.id+'" style="display:block;width:100%;text-align:right;padding:10px;border:0;border-bottom:1px solid var(--border);background:none;font-size:15px"><b>'+esc(p.name)+'</b><br><small style="color:var(--muted)">'+(p.code?'كود '+esc(p.code)+' — ':'')+'المتاح '+fmt(num(p.qty))+'</small></button>'}).join('')||'<div style="padding:10px;color:var(--muted)">مفيش صنف بالاسم ده في المخزون</div>'}
  function draw(){
   var tot=D.reduce(function(a,d){return a+num(d.value)*num(d.qty)},0),old=D.filter(function(d){return !d.pid}),E=ED||blank(),ep=E.pid?P(E.pid):null,ed=E.i>=0?D[E.i]:null;
   b.innerHTML='<div class="wkc"><p style="margin:0">قيمة العرض: <b>'+fmt(tot)+'</b> ج — '+D.filter(function(d){return num(d.qty)>0}).length+' صنف معروض.<br><small style="color:var(--muted)">الصنف اللي بيتحط في العرض بيتخصم من المخزون، ولما يتشال أو كميته تقل بيرجع المخزون.</small></p></div>'+
    (old.length?'<div class="wkc" style="border:2px solid #f0b46a"><b>⚠️ '+old.length+' صنف قديم في العرض مش مربوط بالمخزون</b><br><small>اربط كل واحد بالصنف الصح (الربط مابيغيّرش المخزون).</small></div>':'')+
    '<div class="wkc"><h3>'+(E.i>=0?'✏️ تعديل '+esc(ed&&ed.name||''):'➕ إضافة صنف للعرض')+'</h3><div class="wkg">'+
     '<div class="wkf" style="grid-column:1/-1;position:relative"><label>الصنف من المخزون</label><input id="dP" type="search" autocomplete="off" value="'+esc(ep?ep.name:'')+'" placeholder="🔎 اضغط واختار — بالاسم أو الكود أو الباركود"><div id="dPL" style="display:none;max-height:300px;overflow:auto;border:1px solid var(--border);border-radius:10px;background:var(--card,#fff);margin-top:4px"></div>'+
     (ep?'<small style="color:var(--muted)">المتاح في المخزون: <b>'+fmt(num(ep.qty))+'</b> '+esc(ep.unit||'')+'</small>':'')+'</div>'+
     fi('dQ','الكمية',E.qty,'inputmode="decimal"')+fi('dL','مكانه في العرض',E.loc,'placeholder="مثلاً: المطبخ اللي على اليمين"')+fi('dV','سعر العرض للقطعة (ج)',E.price,'inputmode="decimal"')+'</div>'+
     (ed&&!ed.fromStock?'<p style="font-size:13px;color:#a66a00">الصنف ده قديم — التعديل مش هيخصم أو يرجّع حاجة من المخزون.</p>':'')+
     '<div class="wkrow" style="margin-top:10px"><button type="button" class="wkbtn p" id="dS" style="min-height:50px;flex:1">💾 '+(E.i>=0?'حفظ التعديل':'حفظ في العرض')+'</button>'+(E.i>=0?'<button type="button" class="wkbtn" id="dC">إلغاء</button>':'')+'</div></div>'+
    '<div class="wkc"><h3>المعروض ('+D.length+')</h3>'+(D.map(function(d,i){var p=d.pid?P(d.pid):null;return '<div class="sample" style="margin-bottom:8px;line-height:1.9"><b>'+esc(d.name)+'</b>'+(d.code?' <small>كود '+esc(d.code)+'</small>':'')+(d.pid?'':' <span class="badge" style="background:#fff4e0;color:#a66a00">مش مربوط</span>')+
     '<br>الكمية: <b>'+fmt(num(d.qty))+'</b>'+(d.loc?' — المكان: '+esc(d.loc):'')+' — سعر العرض: '+fmt(num(d.value))+' ج'+(num(d.qty)?' (الإجمالي '+fmt(num(d.value)*num(d.qty))+')':'')+' <span class="badge">'+esc(d.status||'معروض')+'</span>'+
     '<div class="wkrow" style="margin-top:6px;flex-wrap:wrap">'+(d.pid?'<button type="button" class="wkbtn" data-e="'+i+'">✏️ تعديل</button>'+(num(d.qty)>0?'<button type="button" class="wkbtn" data-s="'+i+'">💰 بيع من العرض</button>':''):'<button type="button" class="wkbtn p" data-e="'+i+'">🔗 اربطه بصنف من المخزون</button>')+'<button type="button" class="wkbtn d" data-d="'+i+'">🗑️ شيل من العرض</button></div></div>'}).join('')||'<span class="empty">لسه مفيش حاجة في العرض</span>')+'</div>';
   var Q=function(i){return b.querySelector('#'+i)},inp=Q('dP'),lst=Q('dPL');
   var keep=function(){ED=ED||blank();ED.qty=Q('dQ').value;ED.loc=Q('dL').value;ED.price=Q('dV').value};
   inp.addEventListener('focus',function(){lst.innerHTML=plist(inp.value===(ep&&ep.name)?'':inp.value);lst.style.display=''});
   inp.addEventListener('input',function(){lst.innerHTML=plist(inp.value);lst.style.display=''});
   lst.addEventListener('click',function(e){var x=e.target.closest('.dpI');if(!x)return;keep();ED.pid=x.dataset.pid;var p=P(ED.pid);if(p&&ED.price==='')ED.price=num(p.price)?String(num(p.price)):'';draw()});
   if(Q('dC'))Q('dC').onclick=function(){ED=null;draw()};
   Q('dS').onclick=async function(){keep();var E2=ED,p=E2.pid?P(E2.pid):null,q=num(E2.qty),btn=this;
    if(!p)return toast('اختار الصنف من القايمة (مينفعش تكتب صنف جديد هنا)');if(!(q>=0)||(E2.i<0&&!(q>0)))return toast('اكتب الكمية');
    var old=E2.i>=0?D[E2.i]:null,fs=old?!!old.fromStock:true,need=0,back=null;
    if(fs){if(old&&old.pid&&old.pid!==p.id){back={pid:old.pid,q:num(old.qty)};need=q}else need=q-(old?num(old.qty):0)}
    if(need>0&&num(p.qty)<need&&!(await ask('المخزون فيه '+fmt(num(p.qty))+' بس من «'+p.name+'» والمطلوب '+fmt(need)+'.\nتكمل والرصيد يبقى بالسالب؟','كمّل','لأ')))return;
    btn.disabled=true;btn.textContent='جاري الحفظ...';
    try{if(back&&back.q)await stockMove(back.pid,back.q,'رجع من بضاعة العرض');
     if(need)await stockMove(p.id,-need,need>0?'نقل لبضاعة العرض'+(E2.loc?' ('+E2.loc+')':''):'رجع من بضاعة العرض');
     var it={id:old?old.id:uid(),pid:p.id,name:p.name,code:p.code||'',qty:q,loc:E2.loc.trim(),value:num(E2.price),status:q>0?'معروض':'اتشال',fromStock:fs,at:old&&old.at||new Date().toISOString()};
     if(old)D[E2.i]=Object.assign({},old,it);else D.push(it);await put(K.disp,D);ED=null;toast('✔ اتحفظ'+(need>0?' — اتخصم '+fmt(need)+' من المخزون':need<0?' — رجع '+fmt(-need)+' للمخزون':''));draw()}
    catch(e){btn.disabled=false;btn.textContent='💾 حفظ';errAlert(e)}};
   b.querySelectorAll('[data-e]').forEach(function(x){x.onclick=function(){var d=D[+x.dataset.e];ED={i:+x.dataset.e,pid:d.pid||'',qty:String(num(d.qty)),loc:d.loc||'',price:String(num(d.value)||'')};draw();b.scrollTop=0;var a=document.getElementById('wkApp');if(a)a.scrollTop=0}});
   b.querySelectorAll('[data-d]').forEach(function(x){x.onclick=async function(){var i=+x.dataset.d,d=D[i],rt=d.fromStock&&d.pid&&num(d.qty)>0;
    if(!(await ask('تشيل «'+d.name+'» من العرض؟'+(rt?'\n'+fmt(num(d.qty))+' هترجع المخزون.':''),'شيل','لأ')))return;
    x.disabled=true;x.textContent='جاري الحفظ...';try{if(rt)await stockMove(d.pid,num(d.qty),'رجع من بضاعة العرض');D.splice(i,1);await put(K.disp,D);if(ED&&ED.i===i)ED=null;toast('✔ اتشال'+(rt?' والكمية رجعت المخزون':''));draw()}catch(e){x.disabled=false;errAlert(e)}}});
   b.querySelectorAll('[data-s]').forEach(function(x){x.onclick=function(){var i=+x.dataset.s,d=D[i],n=num(prompt('تبيع كام من «'+d.name+'»؟ (المعروض '+fmt(num(d.qty))+')','1'));if(!(n>0))return;if(n>num(d.qty))return toast('المعروض '+fmt(num(d.qty))+' بس');
    var id=d.id,fs=d.fromStock,pid=d.pid;close();
    /* الفاتورة بتخصم من المخزون، والقطعة كانت اتخصمت لما اتحطت في العرض — فبنرجّع نفس الكمية للمخزون بعد الحفظ وننقص العرض */
    prepToInvoice({customer:'',phone:'',note:'من بضاعة العرض',lines:[{name:d.name,pid:pid,qty:n,price:num(d.value)||null}],
     after:async function(){var sf=null;if(fs){try{await stockMove(pid,n,'بيع من بضاعة العرض (كان متخصم لما اتحط في العرض)')}catch(e){sf=e;if(window.mkPend)await mkPend.add({pid:pid,name:d.name,delta:n,note:'بيع من بضاعة العرض (كان متخصم لما اتحط في العرض)',err:String(e&&e.message||e).slice(0,120)})}}
      if(sf)alert('⚠️ الفاتورة اتحفظت ✔ بس رجوع '+n+' من «'+d.name+'» للمخزون ماكملش.\nاتسجّل في «حركات مخزون معلّقة» في لوحة التحكم — دوس «نفّذ» لما النت يبقى كويس.');var D2=await get(K.disp,[]),z=D2.find(function(y){return y.id===id});if(z){z.qty=r3(num(z.qty)-n);if(z.qty<=0){z.qty=0;z.status='اتباع'}await put(K.disp,D2)}toast('✔ العرض اتحدّث')}})}});
  }
  draw();
 }
 async function viewExps(){
  var b=shell('🧾 مصاريف المعرض');mark('exp');
  var E=await get(K.exp,[]),by={},tot=0;E.forEach(function(e){by[e.cat]=(by[e.cat]||0)+num(e.amount);tot+=num(e.amount)});
  b.innerHTML='<div class="wkc"><p style="margin:0 0 6px;color:var(--muted);font-size:13px">اللي اتصرف على المعرض نفسه: تغيير مطبخ أو دريسنج العرض، المكت، خامات الأرفف، توضيب المخزن… (مصاريف اليوم والمحل ليها منظومة المصروفات العادية).</p><p style="margin:0">الإجمالي: <b>'+fmt(tot)+'</b> ج</p><div style="margin-top:6px">'+Object.keys(by).map(function(c){return '<span class="badge" style="margin:2px">'+esc(c)+': '+fmt(by[c])+'</span>'}).join('')+'</div></div>'+
   '<div class="wkc"><div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>النوع</th><th>المبلغ</th><th>ملاحظة</th><th></th></tr></thead><tbody>'+
   (E.map(function(e,i){return '<tr><td>'+esc(e.date)+'</td><td>'+esc(e.cat)+'</td><td>'+fmt(num(e.amount))+'</td><td>'+esc(e.note)+'</td><td><button type="button" class="wkbtn d" data-d="'+i+'">حذف</button></td></tr>'}).reverse().join('')||'<tr><td colspan="5" class="empty">مفيش</td></tr>')+'</tbody></table></div></div>'+
   '<div class="wkc"><h3>مصروف جديد</h3><div class="wkg">'+fi('eD','التاريخ',today(),'','date')+'<div class="wkf"><label>النوع</label><select id="eC">'+EXPC.map(function(c){return '<option>'+c+'</option>'}).join('')+'</select></div>'+fi('eA','المبلغ','','inputmode="decimal"')+fi('eN','ملاحظة','')+'</div><button type="button" class="wkbtn p" id="eAdd" style="margin-top:10px">إضافة</button></div>';
  b.querySelector('#eAdd').onclick=async function(){var a=num(b.querySelector('#eA').value);if(!a)return toast('اكتب المبلغ');
   E.push({id:uid(),date:b.querySelector('#eD').value,cat:b.querySelector('#eC').value,amount:a,note:b.querySelector('#eN').value.trim()});try{await put(K.exp,E);viewExps()}catch(e){errAlert(e)}};
  b.querySelectorAll('[data-d]').forEach(function(x){x.onclick=async function(){if(await ask('تمسح المصروف؟','مسح','لأ')){E.splice(+x.dataset.d,1);try{await put(K.exp,E);viewExps()}catch(e){errAlert(e)}}}});
 }

 /* ---------- الإعدادات ---------- */
 function viewCfg(){
  var b=shell('⚙️ إعدادات أنظمة الشغل');mark('cfg');
  b.innerHTML='<div class="wkc"><h3>مقاس ورق الطباعة الافتراضي</h3><div class="wkf"><select id="cP">'+Object.keys(PAPERS).map(function(k){return '<option value="'+k+'"'+(k===CFG.paper?' selected':'')+'>'+PAPERS[k]+'</option>'}).join('')+'</select></div>'+
   '<p style="color:var(--muted);font-size:13px">لو الطباعة بتطلع مقصوصة أو مزاحة لناحية، جرّب رول 80 مم أو 58 مم حسب طابعتك.</p></div>'+
   '<div class="wkc"><h3>مراحل خط السير (سطر لكل مرحلة) — كل نظام لوحده</h3><div class="wkg">'+TYPES.map(function(t){return '<div class="wkf"><label>'+esc(sysLab(t))+' — '+ORD.filter(function(o){return o.type===t&&curStage(o)<stages(t).length-1}).length+' أوردر شغال</label><textarea data-t="'+t+'" rows="7">'+esc(stages(t).join('\n'))+'</textarea></div>'}).join('')+'</div></div>'+
   '<div class="wkc"><h3>💰 أسعار المصنعية للدرفة</h3><div class="wkg">'+(function(r){return fi('cHF','الصنايعي — درفة مفصلي',r.hF,'inputmode="decimal"')+fi('cSF','الصنايعي — درفة جرار',r.sF,'inputmode="decimal"')+fi('cHP','على الزبون — درفة مفصلي',r.hP,'inputmode="decimal"')+fi('cSP','على الزبون — درفة جرار',r.sP,'inputmode="decimal"')})(rates())+'</div></div>'+
   '<div class="wkc"><h3>🪵 فئات الأعواد</h3><p style="margin:0 0 10px;color:var(--muted);font-size:13px">سطر لكل فئة، بالترتيب ده وبينهم شرطة مايلة /: اسم الفئة / طول العود العادي بالسم / اسم منتج العود العادي في المخزون (بالظبط) / طول عود المقبض بالسم / اسم منتج عود المقبض في المخزون (بالظبط). لو العود العادي والمقبض بنفس الاسم والطول، اكتبهم نفس الحاجة في الخانتين.</p>'+
   '<textarea id="cRod" rows="8" style="width:100%;min-height:170px;font-size:16px;line-height:1.9">'+esc(rodTypeDefs().map(function(t){return [t.n,t.pLen,t.pProd,t.hLen,t.hProd].join(' / ')}).join('\n'))+'</textarea></div>'+
   '<button type="button" class="wkbtn p" id="cS">💾 حفظ الإعدادات</button>';
  b.querySelector('#cS').onclick=async function(){
   CFG.rates={hF:num(b.querySelector('#cHF').value),sF:num(b.querySelector('#cSF').value),hP:num(b.querySelector('#cHP').value),sP:num(b.querySelector('#cSP').value)};
   CFG.paper=b.querySelector('#cP').value;CFG.stages=CFG.stages||{};
   var busy=[];b.querySelectorAll('[data-t]').forEach(function(x){var t=x.dataset.t,l=x.value.split('\n').map(function(s){return s.trim()}).filter(Boolean),ol=stages(t);if(l.length<2)return;var by={};
    ORD.forEach(function(o){if(o.type!==t)return;var c=curStage(o);if(c>=ol.length-1)return;if(ol[c]!==l[c])by[ol[c]]=(by[ol[c]]||0)+1});Object.keys(by).forEach(function(n){busy.push('«'+n+'» ('+sysLab(t)+') فيها '+by[n]+' أوردر شغال')})});
   if(busy.length){alert('مينفعش تمسح أو تغيّر مكان مرحلة فيها أوردرات شغالة:\n'+busy.join('\n')+'\n\nخلّص الأوردرات دي أو حرّكها الأول، وبعدين عدّل.');return}
   b.querySelectorAll('[data-t]').forEach(function(x){var l=x.value.split('\n').map(function(s){return s.trim()}).filter(Boolean);if(l.length>=2)CFG.stages[x.dataset.t]=l});
   var rodLines=b.querySelector('#cRod').value.split('\n').map(function(s){return s.trim()}).filter(Boolean);
   var rodRows=rodLines.map(function(ln,i){var f=ln.split('/').map(function(s){return s.trim()});if(f.length<5||!f[0])return null;
    return {k:'rt'+i,n:f[0],pLen:num(f[1])||600,pProd:f[2],hLen:num(f[3])||600,hProd:f[4]};
   }).filter(Boolean);
   if(rodRows.length)CFG.rodTypes=rodRows;
   try{localStorage.setItem('wk_paper',CFG.paper)}catch(e){}
   try{await saveCfg();toast('✔ اتحفظت الإعدادات')}catch(e){errAlert(e)}};
 }

 async function open(){
  if(!isAdm()){toast('الشاشة دي للمدير بس');return}
  await loadAll();NS=1;viewOrders();
 }
 function addCard(){
  var st=document.getElementById('settings');if(!st||document.getElementById('wkCard'))return;
  if(!isAdm())return;
  var c=document.createElement('div');c.className='card';c.id='wkCard';c.style.marginTop='14px';
  c.innerHTML='<h3>🛠️ أنظمة الشغل</h3><p style="margin:0 0 10px;color:var(--muted);font-size:13px">أوردرات دلف واستانلس بخط سير، طباعة وباركود، العرض والمصاريف.</p><button type="button" class="primary" onclick="mkWk.open()">فتح</button>';
  st.appendChild(c);
 }
 /* 📒 مسح ملصق وإنت في اليومية: فضلة (FD-) تتباع وتتخصم من الفضل، أوردر (WK-) يتسجّل ويتعلّم إنه اتسلّم */
 async function dbWork(code){
  var C=String(code).toUpperCase(),M;
  if(/^FD/.test(C)){
   var O=await get('wk_offcuts',[]),k=offCode(parseInt(C.replace(/^FD-?/,''),10)),o=O.find(function(x){return x.code===k});
   if(!o){toast('مفيش فضلة بالكود '+k);return}
   if(o.status==='اتباعت'||o.status==='خردة'||o.status==='بتاعة الزبون'){toast(k+' حالتها «'+o.status+'» — مش متاحة للبيع');return}
   var p=(db.products||[]).find(function(x){return String(x.name).trim()===String(o.item).trim()});
   var pm=function(len){if(!p||!(+p.price>0))return 0;var u=String(p.unit||'');return Math.round(/متر/.test(u)?p.price*len/100:p.price*len/(num(o.orig)||600))};
   openModal('<div class="modal-head"><h2>🧰 بيع فضلة '+esc(o.code)+'</h2></div>'+
    '<div class="card" style="background:var(--tint2);border:0;line-height:1.9"><b>'+esc(o.item)+(o.color?' / '+esc(o.color):'')+'</b><br>الطول المتاح: <b>'+esc(num(o.len))+' سم</b>'+(o.place?' · المكان: '+esc(o.place):'')+(o.status==='محجوزة'?'<br><span style="color:#b3261e">⚠️ الفضلة دي محجوزة</span>':'')+'</div>'+
    '<div class="form"><div class="field"><label>بعت كام سم؟</label><input id="dwL" inputmode="decimal" value="'+esc(num(o.len))+'" style="font-size:20px;font-weight:700"></div>'+
    '<div class="field"><label>السعر (ج)</label><input id="dwP" inputmode="decimal" value="'+(pm(num(o.len))||'')+'" style="font-size:20px;font-weight:700"></div></div>'+
    '<div id="dwI" class="sample" style="margin-top:8px"></div>'+
    '<div class="modal-foot"><button type="button" class="primary" id="dwOk">✔ سجّل في اليومية واخصم</button><button type="button" class="secondary" onclick="closeModal()">إلغاء</button></div>');
   M=document.getElementById('modal');var L=M.querySelector('#dwL'),P=M.querySelector('#dwP'),I=M.querySelector('#dwI'),pt=false;
   function info(){var n=num(L.value),r=Math.round((num(o.len)-n)*10)/10;I.innerHTML=n>0&&n<=num(o.len)?('الباقي بعد البيع: <b>'+r+' سم</b>'+(r>0&&r<(num(CFG.minOff)||20)?' (هتتحسب خردة)':r<=0?' (الفضلة هتخلص)':'')):'<span style="color:#b3261e">الطول لازم يكون من 1 لـ '+num(o.len)+' سم</span>'}
   L.oninput=function(){if(!pt){var v=pm(num(L.value));if(v)P.value=v}info()};P.oninput=function(){pt=true};info();L.focus();L.select();
   M.querySelector('#dwOk').onclick=async function(){
    var n=num(L.value),pr=num(P.value);if(!(n>0&&n<=num(o.len)))return toast('اكتب الطول صح');
    this.disabled=true;
    var r=await dbAdd({name:'فضلة '+o.code+' · '+o.item+(o.color?' / '+o.color:'')+' · '+n+' سم',qty:1,price:pr,note:'فضلة '+o.code});
    if(!r){this.disabled=false;return}
    var rest=Math.round((num(o.len)-n)*10)/10;
    if(rest<=0)o.status='اتباعت';else{o.len=rest;if(rest<(num(CFG.minOff)||20))o.status='خردة'}
    o.sold=(o.sold||[]).concat([{at:new Date().toISOString(),len:n,price:pr}]);
    try{await put('wk_offcuts',O)}catch(e){errAlert(e)}
    closeModal();toast('✔ اتسجّلت في اليومية واتخصم '+n+' سم من '+o.code+(rest>0?' (الباقي '+rest+' سم)':''));
   };
   return;
  }
  if(!/^(WK|DL|BM|ST)-?\d/.test(C))return;
  await loadAll();var od=wkFind(C);
  if(!od){toast('مفيش أوردر برقم '+C);return}
  var last=(STG[od.type]||[]).length-1,done=od.stage>=last,rem=Math.max(0,num(od.price)-num(od.paid));
  openModal('<div class="modal-head"><h2>🛠️ '+esc(ordNo(od))+' — '+esc(od.type||'')+'</h2></div>'+
   '<div class="card" style="background:var(--tint2);border:0;line-height:1.9">العميل: <b>'+esc(od.customer||'—')+'</b><br>المرحلة: <b>'+esc((STG[od.type]||[])[od.stage]||'')+'</b><br>السعر: <b>'+fmt(num(od.price))+' ج</b> · العربون: <b>'+fmt(num(od.paid))+' ج</b> · الباقي: <b style="color:#b3261e">'+fmt(rem)+' ج</b>'+(done?'<br>⚠️ الأوردر ده متسجّل إنه اتسلّم قبل كده':'')+'</div>'+
   '<div class="form"><div class="field full"><label>المبلغ اللي هيتسجّل في اليومية (ج)</label><input id="dwA" inputmode="decimal" value="'+rem+'" style="font-size:20px;font-weight:700"></div></div>'+
   '<div class="modal-foot"><button type="button" class="primary" id="dwOk">✔ سجّل في اليومية وعلّمه اتسلّم</button><button type="button" class="secondary" id="dwV">فتح الأوردر</button><button type="button" class="secondary" onclick="closeModal()">إلغاء</button></div>');
  M=document.getElementById('modal');
  M.querySelector('#dwV').onclick=function(){closeModal();NS=1;viewOrder(od.id)};
  M.querySelector('#dwOk').onclick=async function(){
   var a=num(M.querySelector('#dwA').value);this.disabled=true;
   var r=await dbAdd({name:(od.type||'أوردر')+' '+ordNo(od)+(od.w&&od.h?' ('+num(od.w)+'×'+num(od.h)+')':''),qty:1,price:a,person:od.customer||undefined,note:ordNo(od)});
   if(!r){this.disabled=false;return}
   if(!done){od.stage=last;od.hist=(od.hist||[]).concat([{n:(STG[od.type]||[])[last]||'اتسلّم',at:new Date().toISOString(),by:(window.mkT_user&&mkT_user.name)||''}])}
   od.paid=num(od.paid)+a;
   try{await saveOrd()}catch(e){errAlert(e)}
   closeModal();toast('✔ '+ordNo(od)+' اتسجّل في اليومية'+(done?'':' واتعلّم إنه اتسلّم'));
  };
 }
 /* مسح الباركود (WK-0001 أو WK-0001-2) من أي شاشة يفتح الأوردر على طول، وبيشتغل مع أي لغة كيبورد */
 (function(){
  var buf='',last=0,sEl=null,sVal=null,bad=false;
  var CODE={Minus:'-',NumpadSubtract:'-',KeyW:'W',KeyK:'K',KeyF:'F',KeyD:'D',KeyL:'L',KeyB:'B',KeyM:'M',KeyS:'S',KeyT:'T'};
  function ch(e){
   if(CODE[e.code])return CODE[e.code];
   var m=/^(Digit|Numpad)(\d)$/.exec(e.code||'');if(m)return m[2];
   return /^[A-Za-z0-9\-]$/.test(e.key||'')?e.key.toUpperCase():null;
  }
  async function go(code){
   code=String(code||'');
   var dbOn=(function(){var d=document.getElementById('daybook');var m=document.getElementById('modal');return !!(d&&d.classList.contains('active')&&!(m&&m.offsetParent!==null&&m.innerHTML.trim()))})();
   if(dbOn&&typeof dbAdd==='function'){try{await dbWork(code)}catch(e){errAlert(e)}return}
   if(/^FD/i.test(code)){try{closeModal()}catch(e){}await offInfo(code);return}if(!/^(WK|DL|BM|ST)-?\d/i.test(code))return;
   try{closeModal()}catch(e){}
   try{
    await loadAll();NS=1;
    var o=wkFind(code);
    if(!o){toast('مفيش أوردر برقم '+code);return}
    viewOrder(o.id);toast('✔ فتحت '+ordNo(o));
   }catch(e){errAlert(e)}
  }
  window.mkWkScan=function(c){if(isAdm())return go(c)};
  document.addEventListener('keydown',function(e){
   if(!isAdm())return;
   var t=Date.now();
   if(t-last>70){buf='';bad=false;sEl=document.activeElement;sVal=(sEl&&typeof sEl.value==='string')?sEl.value:null}
   last=t;
   if(e.key==='Enter'){
    var ok=!bad&&buf.length>=5&&/^(WK|FD|DL|BM|ST)-?\d{1,6}(-\d+)?$/.test(buf);
    if(ok){
     e.preventDefault();e.stopPropagation();
     if(sEl&&sVal!==null&&typeof sEl.value==='string'){sEl.value=sVal;try{sEl.dispatchEvent(new Event('input',{bubbles:true}))}catch(_){}}
     var code=buf;buf='';go(code);return;
    }
    buf='';return;
   }
   if(e.key==='Shift'||e.key==='Control'||e.key==='Alt')return;
   var c=ch(e);if(c)buf+=c;else bad=true;
  },true);
 })();


 /* 📟 مسح ليبل فضلة: بياناتها (صاحبها، الأوردر، تاريخ الإنتاج، الحالة) من غير ما يفتح الأوردر — الأوردر بزرار جوه البيانات */
 async function openOrderNo(no){try{closeModal()}catch(e){}await loadAll();NS=1;var o=/[A-Za-z]/.test(String(no))?wkFind(no):ORD.find(function(x){return (x.no|0)===(parseInt(no,10)||-1)});if(!o){toast('الأوردر مش موجود');return}viewOrder(o.id)}
 async function offInfo(code){
  var k=offCode(parseInt(String(code).toUpperCase().replace(/^FD-?/,''),10)),O=await get('wk_offcuts',[]),o=O.find(function(x){return x.code===k});
  if(!o){toast('مفيش فضلة بالكود '+k);return}
  var age=Math.floor((Date.now()-new Date(o.date).getTime())/864e5),own=o.owner?('العميل: <b>'+esc(o.owner)+'</b>'+(o.crafter?' — الصنايعي: <b>'+esc(o.crafter)+'</b>':'')):'فضلة المحل';
  openModal('<div class="modal-head"><h2>🧰 فضلة '+esc(o.code)+'</h2></div><div class="card" style="background:var(--tint2);border:0;line-height:2">'+
   '<b style="font-size:17px">'+esc(o.item)+(o.color?' / '+esc(o.color):'')+'</b><br>الطول: <b>'+esc(num(o.len))+' سم</b>'+(o.orig?' (من عود '+esc(num(o.orig))+' سم)':'')+(o.place?' — المكان: '+esc(o.place):'')+'<br>'+own+
   '<br>الأوردر: <b>'+esc(o.order||'—')+'</b><br>تاريخ الإنتاج: <b>'+esc(o.date||'—')+'</b>'+(isNaN(age)?'':' ('+age+' يوم)')+'<br>الحالة: <span class="badge">'+esc(o.status)+'</span></div>'+
   '<div class="modal-foot">'+(o.order&&o.orderId?'<button type="button" class="primary" id="ofiO">📋 الأوردر '+esc(o.order)+'</button>':'')+'<button type="button" class="secondary" id="ofiF">🧰 شاشة الفضل</button><button type="button" class="secondary" onclick="closeModal()">إغلاق</button></div>');
  var bo=document.getElementById('ofiO');if(bo)bo.onclick=function(){var x=ORD.find(function(z){return z.id===o.orderId});if(x){closeModal();viewOrder(x.id)}else openOrderNo(o.order)};
  document.getElementById('ofiF').onclick=async function(){closeModal();await loadAll();NS=1;viewOff(o.code)}}
 window.mkWkOrderNo=openOrderNo;window.mkWkOffInfo=offInfo;
 async function openWeb(r){
  if(!isAdm()){toast('الشاشة دي للمدير بس');return}
  await loadAll();NS=1;var sp=r.spec||{},w=num(sp.w),h=num(sp.h),q=num(sp.q)||1,cu=r.name||'',ph=r.phone||'',note=(r.summary||'')+(r.note?'\n'+r.note:'');
  if(r.kind==='steel'){var t=num(sp.t),hf=num(sp.hf),hb=num(sp.hb);
   viewSteel(null,{customer:cu,phone:ph,body:note,pieces:[{n:'حماية باب',a:w,b:hf+t+hb,q:q,shape:'مسطحة',bends:2,flange:3}],note:''})}
  else if(r.kind==='bamboo'){
   viewBamboo(null,{customer:cu,phone:ph,bamboo:{n:'درج بامبو',kind2:sp.kind==='صناعي'?'صناعي':'طبيعي',a:w,b:h,c:num(sp.l)||'',lip:'',div:sp.split==='yes'?(num(sp.dv)||''):'',q:q}})}
  else{var sl=sp.type==='slide',hd=sp.handle==='both'?'both':sp.handle==='none'?'none':'one';
   var nt=note+'\nخامة: '+(sp.mat||'')+(sp.handle==='one'?'\nالمقبض ناحية: '+(sp.hside==='left'?'الشمال':'اليمين'):'')+(sl?(sp.wheel==='yes'?'\nيتخلّع لفتحة العجلة':''):(sp.drill==='yes'?'\nتخريم مفصلات':'\nمن غير تخريم'));
   viewForm(null,sl?'جرار':'دلفة',{customer:cu,phone:ph,kind:sl?'slide':'hinge',w:w||'',h:h||'',qty:q,handle:hd,side:sp.hinge==='left'?'left':'right',hinges:sl?'':(num(sp.hn)||''),notes:nt})}
  WEBLINK={id:r.id,img:r.img||''}}
 window.mkWk={openWeb:openWeb,go:async function(k){if(!isAdm()){toast('الشاشة دي للمدير بس');return}await loadAll();NS=1;({ord:viewOrders,new:function(){viewForm(null,'دلفة')},steel:function(){viewSteel(null)},bamboo:function(){viewBamboo(null)},off:function(){viewOff()},rods:viewRods,forf:viewForf,disp:viewDisp,exp:viewExps}[k]||viewOrders)()},menu:open,leaf:open,disp:open,exps:open,steel:function(){loadAll().then(function(){NS=1;viewSteel(null)})},stainlessFrom:stainlessFrom,open:open};
})();
}
