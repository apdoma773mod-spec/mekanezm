// Smoke test of the built site in a real browser (phone size). Never sends orders or forms.
//   npm run test:e2e                      → http://localhost:3300
//   npm run test:e2e -- https://mekanezm.com
// Chrome: CHROME_PATH, else the usual Windows / Linux locations.
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
const errors = [];
page.on('pageerror', e => errors.push(`script error on ${page.url()}: ${e.message}`));
page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(base) && !r.url().includes('/api/log')) errors.push(`${r.status()} ${r.url()}`); });
let failed = 0;
const check = async (name, fn) => {
  try { await fn(); console.log('✔', name); } catch (e) { failed++; console.log('✘', name, '—', e.message.split('\n')[0]); }
};
const must = (ok, what) => { if (!ok) throw new Error(what); };
const go = async path => { const r = await page.goto(base + path, { waitUntil: 'networkidle' }); must(r && r.ok(), `${path} → ${r?.status()}`); };

await check('home shows products', async () => { await go('/'); must(await page.locator('.prow .card').count() > 0, 'no product cards'); });
await check('add to cart opens the order bar', async () => {
  await page.locator('.prow .card .add').first().click();
  await page.locator('.cstep').first().waitFor({ timeout: 5000 });
});
await check('cart opens with shipping choice', async () => {
  await page.evaluate(() => scrollTo(0, 0));
  await page.locator('.tb button[aria-label*="طلب"], .nv button').last().click();
  await page.locator('input[name="shm"]').first().waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
});
let pid = '';
await check('product page', async () => {
  pid = (await page.locator('.prow .card h3 a').first().getAttribute('href')) || '';
  await go(pid);
  must(await page.locator('h1').count() === 1, 'no title');
  must(await page.locator('.cmpb').count() === 1, 'no compare button');
});
await check('price request sheet opens', async () => {
  await page.locator('.pvpbtn').click();
  await page.locator('h3', { hasText: 'ابعتلي السعر' }).waitFor({ timeout: 5000 });
  await page.keyboard.press('Escape');
});
await check('search', async () => { await go('/search?q=' + encodeURIComponent('درج')); must(await page.locator('h1, .card, .empty').count() > 0, 'empty page'); });
await check('category page', async () => {
  await go('/');
  const c = await page.locator('a[href^="/c/"]').first().getAttribute('href');
  must(!!c, 'no category link'); await go(c);
});
for (const p of ['/guide', '/guide/hinges', '/trade', '/about', '/privacy', '/terms', '/policy', '/contact', '/quick', '/orders', '/fav', '/custom', '/story', '/compare']) await check(p, () => go(p));
await check('old links redirect', async () => { await page.goto(base + '/shop.html'); must(new URL(page.url()).pathname === '/', 'shop.html did not go home'); });
await check('404 page', async () => { const r = await page.goto(base + '/no-such-page'); must(r?.status() === 404, 'status ' + r?.status()); });
await check('sitemap / robots / health', async () => {
  for (const p of ['/sitemap.xml', '/robots.txt', '/manifest.webmanifest', '/api/health']) { const r = await page.request.get(base + p); must(r.ok(), `${p} → ${r.status()}`); }
});
errors.splice(0, errors.length, ...errors.filter(e => !e.includes('/no-such-page')));
if (errors.length) { failed++; console.log('✘ errors:\n  ' + errors.join('\n  ')); }
await browser.close();
console.log(failed ? `\n${failed} problem(s)` : '\nall good');
process.exit(failed ? 1 : 0);
