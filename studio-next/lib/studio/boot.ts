// @ts-nocheck
// تجهيز مخزن الستوديو (__KV / IndexedDB / نسخ احتياطي) — منقول من index.html
export function boot(){
window.__ready=(async()=>{const KV=new Map(),Q=new Map();let db=null,tm=0;window.__KV=KV;window.__put=(k,v)=>{KV.set(k,v)};try{
const open=()=>new Promise((ok,no)=>{const r=indexedDB.open('mkz',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('kv');d.createObjectStore('snap')};r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)});
try{const T=(pr,ms)=>Promise.race([pr,new Promise(r=>setTimeout(()=>r('TO'),ms))]),o=await T(open(),2500);if(o==='TO'||!o)throw 0;db=o;const rd=await T(new Promise(ok=>{const rq=db.transaction('kv').objectStore('kv').openCursor();rq.onsuccess=e=>{const c=e.target.result;if(c){KV.set(c.key,c.value);c.continue()}else ok()};rq.onerror=ok}),4000);if(rd==='TO')throw 0}catch(e){db=null;KV.clear()}
let migrated=false;try{if(!KV.size){for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);KV.set(k,localStorage.getItem(k))}migrated=KV.size>0}}catch(e){}
const flush=()=>{tm=0;if(!db||!Q.size)return;try{const st=db.transaction('kv','readwrite').objectStore('kv');Q.forEach((v,k)=>st.put(v,k));Q.clear()}catch(e){}};
window.__put=(k,v)=>{KV.set(k,v);if(db){Q.set(k,v);if(!tm)tm=setTimeout(flush,300)}else{try{localStorage.setItem(k,v)}catch(e){}}};
if(db&&migrated)KV.forEach((v,k)=>Q.set(k,v));flush();
addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush()});
try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}
const sn=(m,f)=>new Promise((ok,no)=>{try{const st=db.transaction('snap',m).objectStore('snap'),r=f(st);r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)}catch(e){no(e)}});
window.__snapNow=async()=>{if(!db||!KV.size)return false;try{flush();const d=new Date().toISOString().slice(0,10),data=Object.fromEntries(KV);await sn('readwrite',st=>st.put({t:Date.now(),data,size:JSON.stringify(data).length},d));const ks=(await sn('readonly',st=>st.getAllKeys())).sort();for(const k of ks.slice(0,Math.max(0,ks.length-3)))await sn('readwrite',st=>st.delete(k));return true}catch(e){return false}};
window.__snaps=async()=>{if(!db)return[];try{const ks=(await sn('readonly',st=>st.getAllKeys())).sort().reverse(),out=[];for(const k of ks){const v=await sn('readonly',st=>st.get(k));out.push({date:k,size:v.size||0})}return out}catch(e){return[]}};
window.__restoreSnap=async d=>{try{const v=await sn('readonly',st=>st.get(d));if(!v||!v.data)return false;KV.clear();for(const k in v.data){KV.set(k,v.data[k]);Q.set(k,v.data[k])}await new Promise(ok=>{const st=db.transaction('kv','readwrite'),o=st.objectStore('kv');o.clear();Q.forEach((x,k)=>o.put(x,k));Q.clear();st.oncomplete=ok;st.onerror=ok});location.reload();return true}catch(e){return false}};
try{if(db){const t=new Date().toISOString().slice(0,10),ks=await sn('readonly',st=>st.getAllKeys());if(KV.size&&!ks.includes(t))window.__snapNow()}}catch(e){}
}catch(e){console.warn('boot',e)}})();
}
