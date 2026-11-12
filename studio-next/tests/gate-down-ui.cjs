// الستوديو يفضل شغال لما سيرفر Supabase واقف (402/نت): node tests/gate-down-ui.cjs <url>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9372;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/gate-down-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.addScriptToEvaluateOnNewDocument', { source: "(()=>{const of=window.fetch;window.fetch=function(u,o){if(String(u).includes('rzvncstjattlklpdtkfn')&&!String(u).includes('functions'))return Promise.resolve(new Response(JSON.stringify({message:'Service for this project is restricted due to the following violations: exceed_egress_quota.'}),{status:402,headers:{'content-type':'application/json'}}));return of.apply(this,arguments)}})()" });
  await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`(()=>{localStorage.setItem('mkz-gate-cfg',JSON.stringify({gate:true,trial_days:7,contact:''}));localStorage.setItem('sb-rzvncstjattlklpdtkfn-auth-token',JSON.stringify({access_token:'x',refresh_token:'y',expires_at:4102444800,user:{id:'u',email:'a@b.c'}}))})()`);
  await send('Page.navigate', { url: URL_ }); await sleep(22000);
  console.log('gate state:', await ev(`JSON.stringify({overlayShown:getComputedStyle(document.getElementById('gt-ov')||document.body).display!=='none'&&!!document.getElementById('gt-ov'),bar:(document.getElementById('gt-bar')||{}).textContent,studio:!!document.getElementById('rail')})`));
  console.log('errors:', errs.length, errs.slice(0, 3));
  ws.close(); chrome.kill(); process.exit(0);
})();
