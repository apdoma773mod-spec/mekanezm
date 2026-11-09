// صفحة معاينة لكل القوالب بصور آيفون حقيقية: node tests/tpl-cards.cjs <url> <photosDir> <outDir> [count]
const { spawn } = require('child_process'), fs = require('fs'), path = require('path');
const URL_ = process.argv[2] || 'http://localhost:3412/', DIR = process.argv[3], OUT = process.argv[4], N = +(process.argv[5] || 6), PORT = 9381;
const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--no-sandbox', `--remote-debugging-port=${PORT}`, '--window-size=430,932', '--user-data-dir=' + require('os').tmpdir() + '/tpl-cards-prof', 'about:blank'], { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  let tabs; for (let i = 0; i < 60; i++) { try { tabs = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json(); if (tabs.length) break } catch { } await sleep(500) }
  const ws = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl); await new Promise(r => ws.onopen = r);
  let id = 0; const pend = new Map(), errs = []; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id) } if (d.method === 'Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text) };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) });
  const ev = async e => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); return r.result.result ? r.result.result.value : r; };
  await send('Runtime.enable'); await send('Page.enable'); await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 1, mobile: true });
  await send('Page.navigate', { url: URL_ }); await sleep(9000);
  await ev(`(()=>{const g=document.getElementById('gt-ov');if(g)g.remove();setInterval(()=>{const g=document.getElementById('gt-ov');if(g)g.remove()},500)})()`);
  await ev(`document.querySelector('#rail [data-go="tpl"]').click()`); await sleep(1500);
  const files = fs.readdirSync(DIR).filter(f => /\.(heic|jpe?g|png)$/i.test(f)).slice(0, N).map(f => path.join(DIR, f));
  const doc = await send('DOM.getDocument', { depth: -1 }); const q = await send('DOM.querySelector', { nodeId: doc.result.root.nodeId, selector: '#tp_f' });
  await send('DOM.setFileInputFiles', { nodeId: q.result.nodeId, files });
  for (let i = 0; i < 240; i++) { await sleep(1000); const s = await ev(`document.getElementById('tp_pg').innerText`); if (s && !/⏳/.test(s)) { console.log('loaded:', s.slice(0, 80)); break } }
  await ev(`document.getElementById('tp_next').click()`); await sleep(2000);
  await ev(`document.querySelector('[data-c="trend"]').click()`); await sleep(9000);
  const names = await ev(`JSON.stringify([...document.querySelectorAll('.tp-card')].map(c=>c.dataset.st))`); console.log('trend styles:', names);
  const sheet = await ev(`(()=>{const cs=[...document.querySelectorAll('.tp-card canvas')],n=cs.length,cols=5,w=cs[0].width,h=cs[0].height,rows=Math.ceil(n/cols),c=document.createElement('canvas');c.width=cols*w;c.height=rows*h;const x=c.getContext('2d');cs.forEach((k,i)=>x.drawImage(k,(i%cols)*w,Math.floor(i/cols)*h));return c.toDataURL('image/jpeg',.9)})()`);
  fs.writeFileSync(path.join(OUT, 'sheet.jpg'), Buffer.from(sheet.split(',')[1], 'base64'));
  console.log('errors:', errs.length, errs.slice(0, 5));
  ws.close(); chrome.kill(); process.exit(0);
})();
