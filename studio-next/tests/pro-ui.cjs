// يفتح الاستوديو في كروم حقيقي، يفتح المونتاج الذكي، ويتأكد إن لوحة الأدوات الاحترافية ظاهرة وشغالة.
const { spawn } = require('child_process');const URL_ = process.argv[2] || 'http://localhost:3412/', PORT = 9351;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-sandbox', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/pro-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => (await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true })).result.result.value;
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`document.querySelector('[data-go="smart"]').click()`); await sleep(2500);
  const r = await ev(`JSON.stringify({pro:!!document.getElementById('sm_pro'),btns:['sm_p_qa','sm_p_hk','sm_p_pc','sm_p_cv'].map(x=>!!document.getElementById(x)),sc:!!document.getElementById('sm_sc')})`);
  console.log('panel:', r);
  // بيانات تحليل جاهزة نحقنها عبر الواجهة الاختبارية للمحرك
  await ev(`(()=>{const T=window.mkzSmart&&window.mkzSmart._test;if(T&&T.setD)T.setD({title:'',dur:40,seg:[{s:1,e:4,t:'ليه الدرج الصامت أحسن من العادي؟'},{s:5,e:9,t:'سعره ٣٥٠ جنيه بس'}],ev:[],vad:[[1,4],[5,9]],ch:[[0,40]],loud:{db:-21.4,gain:1.8},peak:.6})})()`);
  await ev(`document.getElementById('sm_p_hk')&&document.getElementById('sm_p_hk').click()`); await sleep(300);
  const hk = await ev(`document.getElementById('sm_p_out')&&document.getElementById('sm_p_out').innerText`); console.log('hook out:', JSON.stringify(hk));
  await ev(`document.getElementById('sm_p_qa')&&document.getElementById('sm_p_qa').click()`); await sleep(300);
  const qa = await ev(`document.getElementById('sm_p_out')&&document.getElementById('sm_p_out').innerText`); console.log('qa out:', JSON.stringify(qa));
  console.log('errors:', errs.length, errs.slice(0, 3));
  ws.close(); chrome.kill(); process.exit(0);
})();
