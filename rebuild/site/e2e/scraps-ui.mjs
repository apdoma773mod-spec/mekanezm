// Offcut market in a phone-size browser with the database calls MOCKED (nothing reaches the real database).
//   node e2e/scraps-ui.mjs [URL]
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';

const base = (process.argv[2] || 'http://localhost:3300').replace(/\/$/, '');
const exe = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/opt/pw-browsers/chromium', '/usr/bin/chromium'].find(p => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', e => errors.push(e.message));

const added = [];
await page.route('**/rest/v1/rpc/scrap_*', async route => {
  const fn = route.request().url().split('/').pop();
  const body = JSON.parse(route.request().postData() || '{}');
  const json = d => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(d) });
  if (fn === 'scrap_add') { added.push(body.p); return json({ id: '11111111-1111-1111-1111-111111111111', secret: 'abc' }); }
  if (fn === 'scrap_contact') return json({ name: 'م. أحمد', phone: '01012345678', area: 'فيصل' });
  if (fn === 'scrap_mine') return json([{ id: '11111111-1111-1111-1111-111111111111', category: 'sheet', material: 'HDF', brand: '', code: '1021', color: '', thick: 18, len: 70, wid: 25, qty: 1, cond: 'new', price_mode: 'ask', price: null, area: 'فيصل', imgs: [], status: 'active', created_at: new Date().toISOString(), expires_at: new Date().toISOString() }]);
  return json(true);
});
// The server-side search reads the real (still empty) database, so the result list is mocked at the API.
await page.route('**/api/scraps?*', route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ total: 3, hits: [
  { level: 1, why: 'نفس الكود', waste: 100, s: { id: 'a1', category: 'sheet', material: 'MDF مكسي (ميلامين)', brand: 'جودوود', code: '1021', color: 'جوزي', thick: 18, len: 100, wid: 40, qty: 2, cond: 'new', edge: true, grain: false, price_mode: 'free', price: null, area: 'الهرم', note: '', imgs: [], created_at: new Date().toISOString() } },
  { level: 3, why: 'لون تاني', waste: 400, s: { id: 'a2', category: 'sheet', material: 'MDF مكسي (ميلامين)', brand: 'توبوود', code: '2002', color: '', thick: 18, len: 90, wid: 30, qty: 1, cond: 'used', edge: false, grain: true, price_mode: 'price', price: 150, area: 'فيصل', note: 'فيها خدش صغير', imgs: [], created_at: new Date().toISOString() } },
] }) }));

let failed = 0;
const check = async (name, fn) => { try { await fn(); console.log('✔', name); } catch (e) { failed++; console.log('✘', name, '—', e.message.split('\n')[0]); } };
const must = (ok, what) => { if (!ok) throw new Error(what); };

await check('search page and no sideways scroll', async () => {
  await page.goto(base + '/scraps', { waitUntil: 'networkidle' });
  must(await page.locator('h1').innerText().then(t => t.includes('فضلة')), 'title');
  must(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'sideways scroll');
});
await check('search → grouped results → reveal contact', async () => {
  await page.locator('.sc-chip', { hasText: /^18$/ }).evaluate(e => e.click());
  await page.locator('.sc-dims input').nth(0).fill('70');
  await page.locator('.sc-dims input').nth(1).fill('25');
  await page.getByRole('button', { name: /دوّر/ }).evaluate(e => e.scrollIntoView({ block: 'center' })); await page.getByRole('button', { name: /دوّر/ }).click();
  await page.locator('.scrap').first().waitFor({ timeout: 5000 });
  must(await page.locator('.scrap').count() === 2, 'expected 2 cards');
  must(await page.locator('text=✔ مناسبة').count() === 1 && await page.locator('text=◐ نفس الخامة بلون تاني').count() === 1, 'groups');
  await page.getByRole('button', { name: /اطلبها/ }).first().evaluate(e => e.scrollIntoView({ block: 'center' })); await page.getByRole('button', { name: /اطلبها/ }).first().click();
  await page.locator('.sc-contact').waitFor({ timeout: 5000 });
  must((await page.locator('.sc-contact a.pri').getAttribute('href')).includes('wa.me/201012345678'), 'wa link');
});
await check('add form validates then publishes', async () => {
  await page.goto(base + '/scraps/add', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /انشر الفضلة/ }).click();
  must((await page.locator('.err').first().innerText()).includes('الطول'), 'length message');
  await page.locator('.sc-dims input').nth(0).fill('70');
  await page.locator('.sc-dims input').nth(1).fill('25');
  await page.locator('.sc-chip', { hasText: /^18$/ }).evaluate(e => e.click());
  await page.locator('select').first().selectOption({ label: 'HDF' });
  await page.locator('label:has-text("الاسم") input').fill('نجار تجربة');
  await page.locator('label:has-text("رقم الواتساب") input').fill('01099999999');
  await page.locator('label:has-text("المنطقة") input').fill('فيصل');
  await page.getByRole('button', { name: /انشر الفضلة/ }).click();
  await page.locator('text=اتنشرت فضلتك').waitFor({ timeout: 5000 });
  must(added.length === 1 && added[0].len === 70 && added[0].thick === 18 && added[0].category === 'sheet', 'payload ' + JSON.stringify(added[0]));
});
await check('my scraps lists it', async () => {
  await page.goto(base + '/scraps/mine', { waitUntil: 'networkidle' });
  await page.locator('.scrap').first().waitFor({ timeout: 5000 });
  must(await page.getByRole('button', { name: /اتباعت/ }).count() === 1, 'sold button');
});
await check('home strip + footer link', async () => {
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  must(await page.locator('a[href="/scraps"]').count() >= 2, 'links');
});
await page.screenshot({ path: process.env.SHOT || 'scraps.png' });
must0();
function must0() { if (errors.length) { failed++; console.log('page errors:', errors.slice(0, 3)); } }
await browser.close();
console.log(failed ? `${failed} problem(s)` : 'all good');
process.exit(failed ? 1 : 0);
