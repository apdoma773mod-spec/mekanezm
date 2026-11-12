// Real check of «ارفع رسمتك» on a running site (phone size): uploads a drawn wardrobe elevation and prints what
// the AI read and what was counted. Uses the real AI (one request).
//   node e2e/takeoff-live.mjs https://mekanezm.vercel.app
// Expected for this drawing: 4 hinged doors 50×210 → 16 hinges; 3 drawers depth 50 → 3 pairs of 45 cm slides;
// 6 movable shelves; 2 rails of 96 cm; wardrobe 200×240×60 on a base, chest 80×90×50.
import { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';

const B = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
const door = x => `<rect x="${x}" y="200" width="250" height="1050" fill="#fff" stroke="#000" stroke-width="5"/><circle cx="${x + 125}" cy="760" r="10"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="2200" height="1600" font-family="Arial" font-size="42"><rect width="2200" height="1600" fill="#fff"/>
<text x="60" y="80" font-size="54" font-weight="bold">WARDROBE - FRONT ELEVATION (cm)</text>
<rect x="150" y="200" width="1000" height="1100" fill="none" stroke="#000" stroke-width="8"/>${[150, 400, 650, 900].map(door).join('')}
<rect x="150" y="1250" width="1000" height="50" fill="#ddd" stroke="#000" stroke-width="5"/>
<text x="520" y="1380">W = 200</text><text x="1170" y="760">H = 240</text><text x="150" y="170">4 hinged doors 50 x 210 - depth 60 - plinth 10</text>
<text x="150" y="1450">inside: 6 adjustable shelves, 2 hanging rails 96 cm</text>
<rect x="1500" y="850" width="400" height="450" fill="none" stroke="#000" stroke-width="8"/>${[850, 1000, 1150].map(y => `<rect x="1510" y="${y + 8}" width="380" height="134" fill="#fff" stroke="#000" stroke-width="5"/><line x1="1650" y1="${y + 75}" x2="1750" y2="${y + 75}" stroke="#000" stroke-width="8"/>`).join('')}
<text x="1560" y="1380">W = 80</text><text x="1920" y="1090">H = 90</text><text x="1480" y="810">3 drawers - depth 50</text></svg>`;
const file = path.join(os.tmpdir(), 'takeoff-wardrobe.png');
await sharp(Buffer.from(svg)).png().toFile(file);

const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true })).newPage();
const errs = [];
page.on('pageerror', e => errs.push(e.message.slice(0, 200)));
let raw = null;
page.on('response', async r => { if (r.url().includes('/mkapi/web/public/takeoff')) { try { raw = { status: r.status(), body: await r.text() }; } catch { /* */ } } });
await page.goto(B + '/takeoff', { waitUntil: 'networkidle' });
await page.locator('input[type=file]').setInputFiles(file);
const t0 = Date.now();
await page.locator('.tk-go').click();
await Promise.race([page.locator('.tk-line').first().waitFor({ timeout: 140000 }), page.locator('.tk-err').waitFor({ timeout: 140000 })]);
console.log('took', Math.round((Date.now() - t0) / 1000) + 's — status', raw?.status);
let failed = 0;
if (await page.locator('.tk-err').count()) { failed = 1; console.log('✘', (await page.locator('.tk-err').innerText()).split('\n')[0], '\n', raw?.body?.slice(0, 500)); }
else {
  try { const j = JSON.parse(raw.body); console.log('doubt:', j.doubt, 'reads:', j.reads, '\nUNITS:', JSON.stringify(j.model.units)); console.log('questions:', j.model.questions, 'assumptions:', j.model.assumptions); } catch { /* */ }
  console.log('SUMMARY:', (await page.locator('.tk-sum').innerText()).replace(/\n/g, ' | '));
  const lines = await page.evaluate(() => [...document.querySelectorAll('.tk-line')].map(l => l.querySelector('.tk-lt b').childNodes[0].textContent + (l.querySelector('.tk-dbt') ? ' [اتأكد]' : '') + ' = ' + l.querySelector('.tk-step input').value + ' ' + l.querySelector('.tk-lq small').textContent + '  → ' + (l.querySelector('.tk-lt a')?.textContent || 'مش على الموقع')));
  console.log('LINES:\n  ' + lines.join('\n  '));
  if (process.env.SHOT) { await page.screenshot({ path: path.join(process.env.SHOT, 'live-takeoff.png'), fullPage: true }); await page.locator('.tk-uh').first().click(); await page.locator('.tk-svg svg').waitFor(); await page.locator('.tk-unit.on').screenshot({ path: path.join(process.env.SHOT, 'live-unit.png') }); }
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)) { failed = 1; console.log('✘ horizontal overflow'); }
}
if (errs.length) { failed = 1; console.log('✘ script errors', errs); }
await browser.close();
process.exit(failed);
