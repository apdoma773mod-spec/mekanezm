/* eslint-disable */
// @ts-nocheck
/* «ميكانيزم برو» artwork copied as is from the old index.html (lines 8944-9144): an icon color + drawing per screen,
   the big 3D drawings for the launcher tiles, and the moving Mekanizm logo. */
 var P='<svg viewBox="0 0 24 24" aria-hidden="true">',E='</svg>';
 /* [اللون، الرسمة] — كل شاشة لون مختلف عشان تقول «افتح الأيقونة البرتقاني» */
 var I={
  dashboard:['#1E3A8A','<rect x="3" y="3" width="7" height="8" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="15" width="7" height="6" rx="1.5"/>'],
  daybook:['#16A34A','<path d="M4 5.5q4-1.5 8 .5v14q-4-2-8-.5zM20 5.5q-4-1.5-8 .5v14q4-2 8-.5z"/><path d="M14.5 13l1.5 1.5 2.5-2.7"/>'],
  sales:['#84CC16','<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h3"/>'],
  saleNew:['#10B981','<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M12 8v7M8.5 11.5h7"/>'],
  purchases:['#2563EB','<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M12 10v7M9 14l3 3 3-3"/>'],
  purchaseNew:['#6366F1','<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="M12 9v7M8.5 12.5h7"/>'],
  products:['#EA580C','<path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M3 7l9 4.5L21 7M12 11.5V21.5"/>'],
  productNew:['#FB923C','<path d="M12 2.5 21 7v10l-9 4.5L3 17V7z"/><path d="M12 9v7M8.5 12.5h7"/>'],
  returns:['#881337','<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'],
  contacts:['#7C3AED','<circle cx="9" cy="8" r="3.2"/><path d="M3 20a6 6 0 0 1 12 0"/><path d="M16 4.5a3 3 0 0 1 0 6M18.5 20a5 5 0 0 0-2.5-4.3"/>'],
  cash:['#4D7C0F','<path d="M3 7h15a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H3z"/><path d="M3 7l11-3.5V7M16 13.5h2"/>'],
  reports:['#A855F7','<path d="M4 20V11M10 20V5M16 20v-6M3 20h18"/>'],
  theme:['#FB7185','<path d="M12 3a9 9 0 1 0 0 18c1.6 0 2.2-1 2.2-2.1 0-1.4-1.2-2 0-3.2.9-.9 2-.7 3-.7A3.8 3.8 0 0 0 21 11.2C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/>'],
  settings:['#64748B','<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M4.2 7.5l2.1 1.2M17.7 15.3l2.1 1.2M4.2 16.5l2.1-1.2M17.7 8.7l2.1-1.2"/>'],
  weborders:['#EC4899','<path d="M3 4h2l2.4 11h10.2L20 7.5H6.3"/><circle cx="9" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/>'],
  quotes:['#C026D3','<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12.5h6M9 16.5h4"/>'],
  count:['#78350F','<path d="M9 3.5h6v3H9z"/><path d="M7 5H5v16h14V5h-2"/><path d="m9 13.5 2 2 4-4"/>'],
  shipping:['#CA8A04','<path d="M2.5 6h11v10h-11zM13.5 9.5h4l3.5 3.5v3h-7.5"/><circle cx="7" cy="17.5" r="1.9"/><circle cx="17" cy="17.5" r="1.9"/>'],
  debts:['#DC2626','<path d="M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z"/><path d="M10 21h4M12 8.5v3.5"/>'],
  reorder:['#155E75','<path d="M20 12a8 8 0 1 1-2.4-5.7"/><path d="M20 4v4.5h-4.5"/>'],
  waorders:['#0D9488','<path d="M5.5 17.5A8.5 8.5 0 1 1 8.6 20L4 21z"/><path d="M9 10h6M9 13.5h4"/>'],
  staff:['#57534E','<path d="M4 17h16M6 17a6 6 0 0 1 12 0"/><path d="M12 7v4.5M9 9.6v2.2M15 9.6v2.2"/>'],
  biz:['#BE185D','<path d="m3 17 6-6 4 4 8-8"/><path d="M14.5 7H21v6.5"/>'],
  kits:['#047857','<path d="M12 3 21 8l-9 5-9-5z"/><path d="m3 13 9 5 9-5"/>'],
  mkSideWk:['#B45309','<circle cx="9" cy="15" r="4.5"/><circle cx="9" cy="15" r="1.4"/><path d="M9 9v1.5M9 19.5V21M3 15h1.5M13.5 15H15M14 4h6v9h-6z"/>'],
  mkSideKw:['#F59E0B','<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M14.5 8.5l2 2"/>'],
  tf:['#0EA5E9','<rect x="3" y="4" width="8" height="15" rx="2"/><path d="M14 9h7v8h-7z"/><path d="M8 3.5c4-1.5 8 0 10 4"/>'],
  site:['#4338CA','<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'],
  custTerms:['#94A3B8','<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8" r="1.4"/>'],
  wkOrd:['#9A3412','<path d="M8 4h8v3H8z"/><path d="M6 5.5H5v15h14v-15h-1"/><path d="m8.5 11 1.5 1.5 3-3M8.5 16.5h7"/>'],
  wkLeaf:['#A16207','<path d="M6 3h11v18H6z"/><path d="M9 6h5v12H9zM15 11v3"/>'],
  wkSteel:['#3F5873','<path d="M3 11l9-5 9 5-9 5z"/><path d="M3 11v4l9 5 9-5v-4"/>'],
  wkOff:['#86198F','<path d="M3 18h16M5 14h11M4 10h7M6 6h4"/>'],
  wkForf:['#C2410C','<path d="M12 3c1 3 4 4 4 8a4 4 0 0 1-8 0c0-2 1-3 2-4 0 2 1 2 2 1 1-1 0-3 0-5z"/><path d="M4 21h16"/>'],
  wkRods:['#0891B2','<path d="M3 18h12M3 13h9M3 8h6"/><rect x="15" y="4" width="6" height="9" rx="1"/><path d="M17 7h2M17 10h2"/>'],
  wkDisp:['#4C1D95','<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M4 9h16M4 15h16"/>'],
  wkExp:['#7F1D1D','<path d="M6 3h11v18l-2.7-1.8-2.8 1.8-2.8-1.8L6 21z"/><path d="M9 8h5M9 12h5"/>'],
  hy:['#0F766E','<path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M9 21v-6h6v6M9 11h.01M15 11h.01"/>'],
  logout:['#111827','<path d="M14 4h5v16h-5"/><path d="M10 8l-4 4 4 4M6 12h10"/>']
 };
 I.mkSideSt=I.wkSteel;I.mkSideFf=I.wkForf;
 function ic(k){var d=I[k];return d?'<span class="mkic" style="--c:'+d[0]+'">'+P+d[1]+E+'</span>':''}
 function gp(cx,cy,r,n,th){var ri=r-th,F=[[ri,0],[ri,.2],[r,.32],[r,.68],[ri,.8]],d='';for(var i=0;i<n;i++)for(var j=0;j<F.length;j++){var a=(i+F[j][1])/n*Math.PI*2;d+=(d?'L':'M')+(cx+F[j][0]*Math.cos(a)).toFixed(1)+' '+(cy+F[j][0]*Math.sin(a)).toFixed(1)}return d+'Z'}
 function pt(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}
 function iso(cx,cy,a,h){var L=[cx-a,cy-a/2],R=[cx+a,cy-a/2],O=[cx,cy],B=[cx,cy-a],u=function(p){return [p[0],p[1]-h]};
  return '<path class="w9" d="M'+[L,O,u(O),u(L)].map(pt).join('L')+'Z"/><path class="ws" d="M'+[O,R,u(R),u(O)].map(pt).join('L')+'Z"/><path class="w" d="M'+[u(L),u(O),u(R),u(B)].map(pt).join('L')+'Z"/>'+
   '<path class="ml" style="stroke-width:3" d="M'+pt([cx-a/2,cy-h-a*.75])+'L'+pt([cx+a/2,cy-h-a*.25])+'"/>'}
 function rc(x,y,w,h,cls){var z='',n=6,st=w/n;for(var i=n;i>=0;i--)z+='L'+pt([x+i*st,y+h-(i%2?3.5:0)]);return '<path class="'+cls+'" d="M'+x+' '+y+'H'+(x+w)+'V'+(y+h)+z+'Z"/>'}
 function sh(s){return '<g transform="translate(2.5 3)">'+s.replace(/class="(w|w9|ws)"/g,'class="sh"')+'</g>'+s}
 var TX='font-family="Cairo,Tajawal,Arial" font-weight="900" text-anchor="middle"';
 /* رسومات كبيرة معبّرة (64×64) للمربعات وزراير لوحة التحكم */
 var IL={
  daybook:'<path class="sh" d="M5 47 32 53 59 47 59 51 32 57 5 51z"/><path class="w" d="M5 14Q18.5 9.5 32 15V52Q18.5 46.5 5 51z"/><path class="w9" d="M59 14Q45.5 9.5 32 15V52Q45.5 46.5 59 51z"/><path class="sh" style="fill-opacity:.12" d="M29 15.5h6V52h-6z"/><path class="kt" d="M10 22.5q8-2.2 16 .8M10 29.5q8-2.2 16 .8M10 36.5q8-2.2 16 .8M10 43.5q5-1.4 10 .2M37 22.5q7-2 13 0M37 29.5q7-2 10 0"/><path class="k" style="stroke-width:2" d="M37.5 38l2.4 2.4 4.4-4.6"/><g transform="rotate(38 50 24)"><rect class="rs" x="46" y="0" width="8" height="5" rx="2"/><rect class="g" x="46" y="4.5" width="8" height="2.6"/><rect class="m" x="46" y="7" width="8" height="26"/><rect class="md" x="50.5" y="7" width="3.5" height="26"/><path class="w" d="M46 33h8l-4 8.5z"/><path class="kf" d="M48.6 38.6h2.8L50 41.5z"/></g>',
  waorders:'<path class="sh" d="M16.5 44.5A21 21 0 1 1 26.5 53L12 57z"/><path class="w" d="M14.5 41.5A21 21 0 1 1 24.5 50L10 54z"/><circle class="kf" cx="22" cy="23" r="1.9"/><circle class="kf" cx="22" cy="30" r="1.9"/><circle class="kf" cx="22" cy="37" r="1.9"/><path class="k" d="M27 23h15M27 30h15M27 37h9"/><circle class="md" cx="50.5" cy="13.5" r="9"/><circle class="m" cx="50" cy="12.5" r="9"/><text x="50" y="17" font-size="12.5" fill="#2A1D00" '+TX+'>3</text>',
  tf:'<rect class="sh" x="10.5" y="12" width="21" height="38" rx="5"/><rect class="w" x="8" y="9" width="21" height="38" rx="5"/><rect class="sc" x="11" y="14" width="15" height="25" rx="2"/><path class="kt" d="M14 20h9M14 25h6M14 30h8"/><rect class="kf" x="15" y="42" width="7" height="2" rx="1"/><g transform="rotate(-14 46 42)"><rect class="sh" x="34.5" y="36" width="27" height="16" rx="2.5"/><rect class="w" x="32" y="33" width="27" height="16" rx="2.5"/><circle class="k" style="stroke-width:2" cx="45.5" cy="41" r="4.6"/><path class="kt" d="M36 37.5v7M55 37.5v7"/></g><path class="ml" d="M31 15Q46 6 53 24"/><path class="ml" d="M48.5 21.5l4.5 3 2-5"/><circle class="md" cx="27.5" cy="45.5" r="7"/><circle class="m" cx="27" cy="44.5" r="7"/><path class="mi" style="stroke-width:2.2" d="M23.8 44.6l2.3 2.3 4.2-4.4"/>',
  mkSideWk:'<path class="ws" d="M44 8.5l7 3.5v42l-7 3.5z"/><path class="w" d="M15 8.5h29V57.5H15z"/><rect class="k" style="stroke-width:2" x="20" y="14" width="19" height="38" rx="1.5"/><rect class="kf" x="35" y="28" width="2.8" height="11" rx="1.4"/><circle class="sh" cx="20.5" cy="47" r="13"/><g class="spin"><path class="m" d="'+gp(19,45,13.5,9,4.2)+'"/><circle class="md" cx="19" cy="45" r="5.2"/><circle class="w" cx="19" cy="45" r="2.8"/></g><g class="spin" style="animation-direction:reverse;animation-duration:6.3s"><path class="d" d="'+gp(34.5,53.5,7.5,6,2.6)+'"/><circle class="g" cx="34.5" cy="53.5" r="2"/></g>',
  products:'<ellipse class="sh" cx="33" cy="58" rx="27" ry="4"/>'+iso(22,58,13,16)+iso(44,58,13,16)+iso(33,41.5,12,14)+'<path class="kt" style="stroke-width:1.3" d="M34.5 46v-7M36.5 47v-7M39 48.2v-7M41 49.2v-7"/>',
  contacts:'<ellipse class="sh" cx="30" cy="57" rx="24" ry="3.5"/><circle class="ws" cx="43" cy="19" r="7.5"/><path class="ws" d="M30.5 46a12.5 12.5 0 0 1 25 0v4h-25z"/><circle class="w" cx="24" cy="23" r="9"/><path class="w" d="M8 56a16 16 0 0 1 32 0z"/><path class="k" style="stroke-width:2" d="M18.5 42l5.5 5 5.5-5"/><path class="m" d="M24 46.5l-2.6 3 2.6 6.5 2.6-6.5z"/><circle class="md" cx="50.5" cy="47.5" r="8"/><circle class="m" cx="50" cy="46.5" r="8"/><text x="50" y="50.8" font-size="11" fill="#3a2600" '+TX+'>ج</text>',
  debts:'<path class="ml" style="stroke-width:2.6" d="M11 17q-4.5 7 0 14M6 14q-6.5 10 0 20M53 17q4.5 7 0 14M58 14q6.5 10 0 20"/><path class="w" d="M32 7.5a3.2 3.2 0 0 1 3.2 3.2v1.4A14.5 14.5 0 0 1 46.5 26.2V37l4.5 6.5H13L17.5 37V26.2A14.5 14.5 0 0 1 28.8 12.1v-1.4A3.2 3.2 0 0 1 32 7.5z"/><path class="sh" style="fill-opacity:.12" d="M32 12.5a14 14 0 0 1 14.5 13.7V37l4.5 6.5H32z"/><path class="w9" d="M26.5 45.5a5.5 5.5 0 0 0 11 0z"/><path class="k" style="stroke-width:3" d="M32 20.5v10"/><circle class="kf" cx="32" cy="36" r="1.9"/><ellipse class="md" cx="48" cy="57" rx="9.5" ry="3.6"/><rect class="md" x="38.5" y="50" width="19" height="7"/><ellipse class="m" cx="48" cy="50" rx="9.5" ry="3.6"/><ellipse class="md" cx="48" cy="50" rx="5.5" ry="1.8" style="fill-opacity:.7"/>',
  shipping:'<ellipse class="sh" cx="32" cy="53.5" rx="27" ry="3.2"/><path class="wl" style="stroke-opacity:.85;stroke-width:2.2" d="M1 23h5M0 30h7M2 37h4"/><path class="ws" d="M9 17l6-5.5h29l-6 5.5z"/><path class="w9" d="M38 17l6-5.5V39l-6 6z"/><path class="w" d="M9 17h29v28H9z"/><rect class="k" style="stroke-width:2" x="15" y="23" width="13" height="11" rx="1"/><path class="kt" d="M21.5 23v4M13 39.5h21"/><path class="md" d="M38 25l5-4h9l-4.5 4z"/><path class="m" d="M38 25h9.5l8.5 10v10H38z"/><path class="w9" d="M41 28h5.6l5.5 6.5H41z"/><rect class="w" x="53" y="38" width="3" height="3" rx="1"/><circle class="d" cx="17" cy="46" r="6.3"/><circle class="g" cx="17" cy="46" r="2.6"/><circle class="d" cx="47" cy="46" r="6.3"/><circle class="g" cx="47" cy="46" r="2.6"/>',
  saleNew:sh(rc(12,7,28,44,'w'))+'<path class="kt" d="M17 15h18M17 21h18M17 27h12"/><path class="k" d="M17 36h18"/><circle class="md" cx="46" cy="41" r="11"/><circle class="m" cx="45" cy="39.5" r="11"/><circle style="fill:none;stroke:#E8A600;stroke-width:1.6" cx="45" cy="39.5" r="7.8"/><path class="mi" d="M45 45V34M40.5 38.5l4.5-4.5 4.5 4.5"/><path class="wl" style="stroke-width:2" d="M54 14v6M51 17h6"/>',
  purchaseNew:sh(rc(8,4,26,40,'w'))+'<path class="kt" d="M13 12h16M13 18h16M13 24h10"/>'+iso(46,60,12,14)+'<path class="ml" d="M46 13v15M40.5 22.5 46 28l5.5-5.5"/>',
  productNew:'<ellipse class="sh" cx="30" cy="57" rx="22" ry="3.5"/>'+iso(30,56,18,22)+'<path class="kt" style="stroke-width:1.4" d="M16 39v-8M18.5 40.2v-8M21.5 41.8v-8M24 43v-8"/><circle class="md" cx="49.5" cy="17.5" r="11"/><circle class="m" cx="49" cy="16" r="11"/><path class="mi" style="stroke-width:3.2" d="M49 10v12M43 16h12"/>',
  quotes:sh('<path class="w" d="M12 6h23l11 11v40H12z"/>')+'<path class="ws" d="M35 6v11h11z"/><path class="kt" d="M17 22h20M17 28h20M17 34h13"/><g transform="rotate(-18 46 45)"><path class="md" d="M34 41.5h15l6.5 6.5-6.5 6.5H34z"/><path class="m" d="M33 40h15l6.5 6.5L48 53H33z"/><circle class="w" cx="37.5" cy="46.5" r="2"/><path class="mi" style="stroke-width:2" d="M42 44.5h5M42 48.5h3.5"/></g>',
  sales:'<g transform="rotate(-8 30 32)">'+rc(16,8,26,40,'ws')+'</g>'+sh(rc(10,8,28,42,'w'))+'<path class="kt" d="M15 16h18M15 22h18M15 28h12M15 34h16"/><circle style="fill:none;stroke:#FFC21A;stroke-width:3.4" cx="46" cy="45" r="10"/><path class="ml" d="M41 45l3.5 3.5 6.5-7"/>',
  wkOrd:sh('<rect class="w" x="12" y="10" width="34" height="46" rx="4"/>')+'<rect class="g" x="21" y="6" width="16" height="9" rx="3"/><path class="k" d="M18 24l3 3 5-5M18 35l3 3 5-5"/><path class="kt" d="M30 25h10M30 36h10M18 46h22"/><circle class="sh" cx="49.5" cy="48" r="11"/><g class="spin"><path class="m" d="'+gp(48,46,11,8,3.4)+'"/><circle class="md" cx="48" cy="46" r="4.2"/><circle class="w" cx="48" cy="46" r="2.2"/></g>',
  wkLeaf:'<path class="ws" d="M42 8l8 4v42l-8 4z"/><path class="w" d="M14 8h28v50H14z"/><rect class="k" style="stroke-width:2" x="19" y="13" width="18" height="40" rx="1.5"/><circle class="g" cx="17.5" cy="18" r="3"/><circle class="g" cx="17.5" cy="48" r="3"/><rect class="m" x="33" y="27" width="3" height="12" rx="1.5"/><g transform="rotate(35 50 40)"><rect class="m" x="47" y="20" width="6" height="26"/><rect class="md" x="50" y="20" width="3" height="26"/><path class="w" d="M47 46h6l-3 6z"/><path class="kf" d="M49 50h2l-1 2z"/></g>',
  wkSteel:'<ellipse class="sh" cx="33" cy="56" rx="26" ry="3.5"/><path class="w" d="M8 30 32 18 58 30 34 42z"/><path class="w9" d="M8 30 34 42v10L8 40z"/><path class="ws" d="M34 42 58 30v10L34 52z"/><path class="kt" d="M18 29.5l13-6.5M25 33l13-6.5M32 36.5l13-6.5"/><path class="ml" style="stroke-width:2.4" d="M9 22 31 11"/><path class="ml" style="stroke-width:2.4" d="M26.5 10.5 31 11l-1.8 4.2M13.5 23.5 9 22l1.8-4.2"/><circle class="md" cx="50.5" cy="15.5" r="6"/><circle class="m" cx="50" cy="14.5" r="6"/><path class="mi" style="stroke-width:1.8" d="M47.5 14.5h5M50 12v5"/>',
  wkOff:(function(){var b=function(x,y,l){return '<path class="w" d="M'+x+' '+y+'h'+l+'l5-4h-'+l+'z"/><rect class="w9" x="'+x+'" y="'+y+'" width="'+l+'" height="7"/><path class="ws" d="M'+(x+l)+' '+y+'l5-4v7l-5 4z"/>'};return '<ellipse class="sh" cx="32" cy="58" rx="26" ry="3"/>'+b(6,50,46)+b(10,40,34)+b(8,30,22)+b(12,20,13)})()+'<rect class="md" x="41" y="11" width="16" height="16" rx="4"/><rect class="m" x="40" y="10" width="16" height="16" rx="4"/><circle class="md" cx="48" cy="18" r="4"/><path class="m" d="M40 21H24v4h16z"/><path class="kt" style="stroke:#7a4d00;stroke-width:1.2" d="M27 21v2M31 21v2M35 21v2"/>',
  wkForf:'<ellipse class="sh" cx="33" cy="56" rx="26" ry="3.5"/><path class="w" d="M32 10c3 9 14 12 14 26a14 14 0 0 1-28 0c0-7 4-10 7-14 0 6 3 7 6 3 3-4 1-10 1-15z"/>',
  wkRods:(function(){var b=function(x,y,l){return '<path class="w" d="M'+x+' '+y+'h'+l+'l5-4h-'+l+'z"/><rect class="w9" x="'+x+'" y="'+y+'" width="'+l+'" height="7"/><path class="ws" d="M'+(x+l)+' '+y+'l5-4v7l-5 4z"/>'};return '<ellipse class="sh" cx="30" cy="58" rx="26" ry="3"/>'+b(4,50,40)+b(4,40,40)+b(4,30,28)})()+'<rect class="md" x="39" y="9" width="21" height="28" rx="4"/><rect class="m" x="38" y="7" width="21" height="28" rx="4"/><rect class="w" x="41" y="10" width="15" height="7" rx="1.5"/><path class="mi" style="stroke-width:2.2" d="M43 22h3M51 22h3M43 29h3M51 29h3"/>',
  wkDisp:'<rect class="sh" x="10.5" y="11" width="48" height="50" rx="3"/><rect class="w" x="8" y="8" width="48" height="50" rx="3"/><rect class="sc" x="12" y="12" width="40" height="42" rx="2"/><rect class="w" x="12" y="27" width="40" height="3"/><rect class="w" x="12" y="42" width="40" height="3"/><rect class="m" x="16" y="18" width="8" height="9" rx="1"/><rect class="md" x="27" y="15" width="6" height="12" rx="1"/><rect class="kf" x="37" y="21" width="12" height="3" rx="1.5"/><rect class="kf" x="16" y="35" width="3" height="7" rx="1"/><rect class="m" x="24" y="33" width="10" height="9" rx="1"/><circle class="md" cx="43" cy="38" r="4"/><rect class="m" x="16" y="48" width="30" height="5" rx="1"/><path class="wl" style="stroke-width:2" d="M58 4v6M55 7h6"/>',
  wkExp:sh(rc(10,6,26,40,'w'))+'<path class="kt" d="M15 14h16M15 20h16M15 26h10"/><g transform="rotate(-12 44 44)"><rect class="sh" x="30.5" y="37" width="30" height="17" rx="2.5"/><rect class="w" x="28" y="34" width="30" height="17" rx="2.5"/><circle class="k" style="stroke-width:2" cx="43" cy="42.5" r="4.6"/><path class="kt" d="M32 38.5v8M54 38.5v8"/></g><path class="ml" d="M46 22l9-9M48 13h7v7"/>',
  purchases:'<g transform="rotate(-8 28 30)">'+rc(14,6,24,38,'ws')+'</g>'+sh(rc(8,6,26,40,'w'))+'<path class="kt" d="M13 14h16M13 20h16M13 26h10M13 32h14"/>'+iso(46,59,12,13)
 };
 IL.mkSideSt=IL.wkSteel;IL.mkSideFf=IL.wkForf;
 function ill(k){var s=IL[k],d=I[k];return s&&d?'<span class="mkill" style="--c:'+d[0]+'"><svg viewBox="0 0 64 64" aria-hidden="true">'+s+'</svg></span>':ic(k)}
 function logoSVG(){
  var W='x="850" y="134" '+TX+' font-size="148" textLength="860" lengthAdjust="spacingAndGlyphs"',
   K='stroke="#0a1450" stroke-width="1.3" stroke-linejoin="round"',
   P=function(a,f,x){return '<path d="M'+a.map(function(p){return p[0].toFixed(1)+' '+p[1].toFixed(1)}).join('L')+'Z" fill="'+f+'" '+(x||K)+'/>'},
   /* حركة: يفتح، يستنى، يقفل، يستنى */
   mv=function(type,a,b,dur,beg,add){return '<animateTransform attributeName="transform" type="'+type+'" values="'+a+';'+b+';'+b+';'+a+';'+a+'" keyTimes="0;.18;.42;.6;1" calcMode="spline" keySplines=".5 0 .2 1;0 0 1 1;.5 0 .2 1;0 0 1 1" dur="'+dur+'s" begin="'+beg+'s" repeatCount="indefinite"'+(add?' additive="sum"':'')+'/>'},
   slide=function(x0,y,len,dir,beg){var s=len*.42*dir,b='';for(var i=1;i<6;i++)b+='<circle cx="'+(x0+len*i/6).toFixed(1)+'" cy="'+(y+7)+'" r="2.4" fill="#4a5a8c"/>';
    return '<rect x="'+x0+'" y="'+y+'" width="'+len+'" height="14" rx="4" fill="url(#mkSteel)" '+K+'/><g><rect x="'+(x0+4)+'" y="'+(y+2.5)+'" width="'+(len-8)+'" height="9" rx="3" fill="#eef3ff" stroke="#8090b8" stroke-width="1"/>'+b+
     '<g><rect x="'+(x0+8)+'" y="'+(y+4.5)+'" width="'+(len-16)+'" height="5" rx="2.5" fill="url(#mkGoldH)"/><rect x="'+(dir<0?x0+6:x0+len-14)+'" y="'+(y-3)+'" width="8" height="20" rx="2" fill="url(#mkGoldH)" '+K+'/>'+mv('translate','0 0',s+' 0',5,beg)+'</g>'+mv('translate','0 0',s+' 0',5,beg)+'</g>'},
   jar=function(x,y,c){return '<rect x="'+x+'" y="'+(y-13)+'" width="10" height="13" rx="2" fill="'+c+'" stroke="#0a1450" stroke-width="1"/><rect x="'+(x-1)+'" y="'+(y-16)+'" width="12" height="4" rx="1.5" fill="#FFC21A"/>'},
   L='',R='',i,y;
  /* ── شمال: دولاب حيطة بباب على مفصلة بيفتح ويقفل ── */
  L+=P([[40,18],[170,18],[200,8],[70,8]],'#e9eef8')+P([[170,18],[200,8],[200,102],[170,112]],'#c3cde3')+'<rect x="40" y="18" width="130" height="94" fill="#0d1638" '+K+'/>'+
   '<rect x="42" y="63" width="126" height="4" fill="#c3cde3"/>'+jar(56,62,'#ff7a7a')+jar(74,62,'#7dd3a8')+jar(92,62,'#8fb3ff')+jar(126,62,'#ffd36b')+jar(60,110,'#ffd36b')+jar(84,110,'#ff9ecb')+jar(130,110,'#7dd3a8')+
   '<rect x="42" y="28" width="7" height="12" rx="2" fill="#FFC21A"/><rect x="42" y="88" width="7" height="12" rx="2" fill="#FFC21A"/>'+
   '<g transform="translate(40 0)"><g><rect x="0" y="18" width="130" height="94" rx="3" fill="#f7f9fd" '+K+'/><rect x="10" y="28" width="110" height="74" rx="3" fill="none" stroke="#c3cde3" stroke-width="2"/><rect x="108" y="48" width="6" height="34" rx="3" fill="url(#mkGoldH)"/>'+mv('scale','1 1','.13 1',6,0)+mv('skewY','0','-16',6,0,1)+'</g></g>';
  /* ── شمال تحت: مجرى أدراج تلسكوبي ── */
  L+=slide(110,150,92,-1,-1.2);
  /* ── شمال: وحدة أدراج (3 أدراج بتفتح وتقفل واحد ورا التاني) + رخامة ── */
  L+='<rect x="240" y="40" width="120" height="146" fill="#0d1638" '+K+'/>';
  for(i=2;i>=0;i--){y=42+i*48;
   L+='<g>'+P([[244,y+8],[358,y+8],[396.5,y-4.6],[282.5,y-4.6]],'#a9b5d0')+P([[358,y+8],[396.5,y-4.6],[396.5,y+33.4],[358,y+46]],'#d4dbea')+
    '<path d="M358 '+(y+44)+'L396.5 '+(y+31.4)+'" stroke="#FFC21A" stroke-width="3" stroke-linecap="round"/>'+
    '<rect x="242" y="'+y+'" width="116" height="46" rx="3" fill="#f7f9fd" '+K+'/><rect x="278" y="'+(y+19)+'" width="44" height="7" rx="3.5" fill="url(#mkGoldH)" '+K+'/>'+
    mv('translate','0 0','-38.5 12.6',7.5,-(2-i)*2.5)+'</g>'}
  L+=P([[360,40],[404,25.6],[404,171.6],[360,186]],'#c3cde3')+P([[232,34],[368,34],[412,19.6],[276,19.6]],'#fff6d6')+'<rect x="232" y="34" width="136" height="7" fill="url(#mkGoldH)" '+K+'/>'+P([[368,34],[412,19.6],[412,26.6],[368,41]],'#c98a00');
  /* ── يمين: مفصلة مطبخ (منظر من فوق): الباب بيفتح ويقفل على جنب الدولاب ── */
  R+='<rect x="1326" y="26" width="16" height="80" rx="2" fill="#e9eef8" '+K+'/><rect x="1342" y="62" width="14" height="22" rx="3" fill="url(#mkSteel)" '+K+'/>'+
   '<g transform="translate(1344 102)"><g><rect x="0" y="-12" width="96" height="12" rx="2" fill="#f7f9fd" '+K+'/><circle cx="18" cy="-12" r="8" fill="url(#mkSteel)" '+K+'/><path d="M18 -12 L5 -31" stroke="url(#mkGoldH)" stroke-width="6" stroke-linecap="round"/><rect x="84" y="-12" width="5" height="12" fill="url(#mkGoldH)"/>'+mv('rotate','0','-92',5.5,-.6)+'</g><circle r="4" fill="#FFF2B8"/></g>';
  /* ── يمين تحت: مجرى أدراج ── */
  R+=slide(1302,150,92,1,-2.6);
  /* ── يمين: دولاب سوبر ماركت (كارجو طويل) بسلال وحاجات، بيطلع ويدخل ── */
  R+='<rect x="1460" y="22" width="100" height="164" fill="#0d1638" '+K+'/><g>';
  [42,80,118,156].forEach(function(yb,k){var C=['#ff7a7a','#7dd3a8','#8fb3ff','#ffd36b','#ff9ecb'];
   R+=P([[1462,yb-24],[1422.4,yb-37],[1422.4,yb-13],[1462,yb]],'rgba(255,194,26,.14)','stroke="#FFC21A" stroke-width="2" stroke-linejoin="round"')+
    '<path d="M1452 '+(yb-27.3)+'v24M1442 '+(yb-30.6)+'v24M1432 '+(yb-33.9)+'v24" stroke="#FFC21A" stroke-width="1" stroke-opacity=".7"/>'+
    jar(1448,yb-4.6,C[k])+jar(1434,yb-9.2,C[(k+2)%5])});
  R+='<rect x="1462" y="24" width="96" height="160" rx="3" fill="#f7f9fd" '+K+'/><rect x="1472" y="34" width="76" height="140" rx="3" fill="none" stroke="#c3cde3" stroke-width="2"/><rect x="1476" y="74" width="7" height="60" rx="3.5" fill="url(#mkGoldH)" '+K+'/>'+mv('translate','0 0','44 9.6',6.5,-3.2)+'</g>'+
   P([[1460,22],[1416,12.4],[1416,176.4],[1460,186]],'#c3cde3')+P([[1460,22],[1560,22],[1516,12.4],[1416,12.4]],'#e9eef8');
  return '<svg viewBox="0 0 1700 200" preserveAspectRatio="xMidYMid meet" role="img" aria-label="ميكانيزم">'+
  '<defs>'+
   '<linearGradient id="mkGold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF7CF"/><stop offset=".3" stop-color="#FFD54F"/><stop offset=".55" stop-color="#FFBE0B"/><stop offset=".8" stop-color="#E08A00"/><stop offset="1" stop-color="#FFD66B"/></linearGradient>'+
   '<linearGradient id="mkGoldH" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFE58A"/><stop offset=".5" stop-color="#FFBE0B"/><stop offset="1" stop-color="#C98400"/></linearGradient>'+
   '<linearGradient id="mkBlue" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9DB8FF"/><stop offset=".45" stop-color="#3D6BFF"/><stop offset="1" stop-color="#1B3FD6"/></linearGradient>'+
   '<linearGradient id="mkSteel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".5" stop-color="#c3cde6"/><stop offset="1" stop-color="#e9eefa"/></linearGradient>'+
   '<radialGradient id="mkShadow"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>'+
   '<pattern id="mkGrid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#fff" stroke-opacity=".07"/></pattern>'+
   '<text id="mkW" '+W+'>ميكانيزم</text>'+
  '</defs>'+
  '<rect width="1700" height="200" fill="url(#mkGrid)"/>'+
  '<ellipse cx="200" cy="190" rx="200" ry="10" fill="url(#mkShadow)"/><ellipse cx="1500" cy="190" rx="200" ry="10" fill="url(#mkShadow)"/>'+L+R+
  '<ellipse cx="850" cy="186" rx="330" ry="12" fill="url(#mkShadow)"/>'+
  '</svg>'}
export { I, IL, ic, ill, logoSVG };
