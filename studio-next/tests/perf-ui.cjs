// قياس التهنيج: CPU أبطأ ٤ مرات زي الموبايل، مهام طويلة وهو ساكت ووقت فتح كل شاشة: node tests/perf-ui.cjs <url>
// node tests/pro2-ui.cjs <url> <outDir>
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', OUT = process.argv[3], PORT = 9368;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${PORT}`, '--user-data-dir=' + require('os').tmpdir() + '/perf-ui-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.result.exceptionDetails) return 'EXC ' + (r.result.exceptionDetails.exception?.description || r.result.exceptionDetails.text); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2, mobile: true });
  await send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await sleep(4000);
  await ev(`(()=>{window.__lt=[];new PerformanceObserver(l=>{l.getEntries().forEach(e=>window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]))}).observe({entryTypes:['longtask']});
    window.__mut=0;new MutationObserver(m=>{window.__mut+=m.length}).observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true});
    window.__iv=0;const si=window.setInterval;window.setInterval=function(){window.__iv++;return si.apply(this,arguments)};return 1})()`);
  await sleep(15000);
  console.log('idle 15s (smart page open at start?):', await ev(`(()=>{const L=window.__lt;return 'longtasks '+L.length+' total '+L.reduce((s,x)=>s+x[1],0)+'ms max '+Math.max(0,...L.map(x=>x[1]))+'ms, DOM mutations '+window.__mut})()`));
  const views = String(await ev(`[...new Set([...document.querySelectorAll('#rail [data-go]')].map(b=>b.dataset.go))].join(',')`)).split(',');
  for (const v of views) {
    const r = await ev(`(async()=>{window.__lt=[];window.__mut=0;const t0=performance.now();document.querySelector('#rail [data-go="${v}"]').click();await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));const t1=performance.now();await new Promise(r=>setTimeout(r,2500));const L=window.__lt;return '${v}: '+Math.round(t1-t0)+'ms to paint, longtasks '+L.length+' ('+L.reduce((s,x)=>s+x[1],0)+'ms, max '+Math.max(0,...L.map(x=>x[1]))+'), mutations '+window.__mut})()`);
    console.log(r);
  }
  console.log('idle on last view 10s:', await ev(`(async()=>{window.__lt=[];window.__mut=0;await new Promise(r=>setTimeout(r,10000));const L=window.__lt;return 'longtasks '+L.length+' total '+L.reduce((s,x)=>s+x[1],0)+'ms, mutations '+window.__mut})()`));
  const m = await send('Performance.getMetrics'); 
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
