/**
 * اختبار «القارئ يوديني للحاجة نفسها»: بيعمل شحنة وفاتورة تجربة، ويحاكي جهاز الباركود (ضغط سريع + Enter) من ٣ شاشات،
 * وبيتأكد إن كل كود بيفتح شاشته (شحنة / فاتورة / كارت منتج) مش شاشة جديدة فاضية.
 * تشغيل: UI=http://localhost:3299 API=https://… LOGIN=01xxxxxxxxx PASS=… PRODUCT_CODE=P0997 node e2e/scan-codes.mjs
 * (بيعمل بيانات باسم «[تجربة]» — امسحها بعد التجربة)
 */
import { chromium, devices } from 'playwright-core';
const UI = process.env.UI ?? 'http://localhost:3299';
const API = process.env.API ?? UI;
const LOGIN = process.env.LOGIN, PASS = process.env.PASS, PRODUCT = process.env.PRODUCT_CODE ?? 'P0997';
if (!LOGIN || !PASS) throw new Error('LOGIN و PASS مطلوبين');
const b = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await b.newContext({ ...devices['iPhone 13'], locale: 'ar-EG' });
const p = await ctx.newPage();
await p.goto(UI + '/login');
const r = await p.request.post(API + '/api/v1/auth/login', { data: { login: LOGIN, password: PASS } });
if (!r.ok()) throw new Error('login ' + r.status());
const post = async (path, data) => (await p.request.post(API + '/api/v1' + path, { data })).json();
const pr = await post('/products', { name: '[تجربة] صنف', category: 'تجربة', unit: 'قطعة', price: 10, cost: 5, qty: 5 });
const inv = await post('/invoices', { kind: 'SALE', items: [{ productId: pr.product.id, qty: 1, price: 10 }], person: '[تجربة] عميل', paid: 10 });
const sh = await post('/shipments', { kind: 'SHIP', name: '[تجربة] شحنة', phone: '01099999902', gov: 'القاهرة', address: 'تجربة', carrier: 'تجربة', pieces: 1, cod: 0, fee: 0 });
const cases = [[sh.shipment.no, sh.shipment.no], [inv.invoice.no, inv.invoice.no], [PRODUCT, '📟']];
let bad = 0;
for (const where of ['/', '/shipping', '/products']) {
  for (const [code, expect] of cases) {
    await p.goto(UI + where, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    for (const ch of code) await p.keyboard.press(ch === '-' ? 'Minus' : /\d/.test(ch) ? 'Digit' + ch : 'Key' + ch.toUpperCase(), { delay: 0 });
    await p.keyboard.press('Enter');
    await p.waitForTimeout(3500);
    const txt = (await p.evaluate(() => document.querySelector('.modal')?.textContent ?? 'NO MODAL')).slice(0, 80);
    const ok = txt.includes(expect) && !txt.includes('شحنة جديدة');
    if (!ok) bad++;
    console.log(ok ? 'ok ' : 'BAD', where.padEnd(10), code.padEnd(8), '→', txt);
  }
}
await b.close();
process.exit(bad ? 1 : 0);
