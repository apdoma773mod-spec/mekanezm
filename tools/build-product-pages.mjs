// يبني صفحة ثابتة لكل منتج (p/<id>.html) فيها صورة واسم المنتج عشان معاينة اللينك على واتساب وفيسبوك وجوجل،
// والزبون نفسه بيتحوّل على طول لصفحة المنتج في المتجر. ويحدّث sitemap.xml.
// تشغيل: node tools/build-product-pages.mjs  (بيشتغل لوحده كل كام ساعة من .github/workflows/product-pages.yml)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SB_URL = 'https://tkzfjeizvanfptnqvrmr.supabase.co';
const SB_KEY = 'sb_publishable_8QP_KfvoYOyF_bZC4-fw1w_qCkfEpvZ';
const SITE = 'https://apdoma773mod-spec.github.io/mekanezm/';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const safeId = id => /^[a-z0-9_-]{1,40}$/i.test(String(id || ''));

const r = await fetch(`${SB_URL}/rest/v1/site_content?id=eq.main&select=data`, { headers: { apikey: SB_KEY } });
if (!r.ok) throw new Error('site_content ' + r.status);
const D = (await r.json())[0]?.data;
if (!D || !Array.isArray(D.products)) throw new Error('no products');

const wa = t => {
  let ph = String(D.phone || '').replace(/\D/g, '');
  if (ph[0] === '0') ph = '20' + ph.slice(1);
  return ph ? `https://wa.me/${ph}?text=${encodeURIComponent(t)}` : SITE + 'shop.html';
};

const dir = path.join(ROOT, 'p');
fs.mkdirSync(dir, { recursive: true });
const keep = new Set();
const prods = D.products.filter(p => safeId(p.id) && p.name);

for (const p of prods) {
  const sec = (D.sections || []).find(s => s.id === p.sec) || {};
  const imgs = (Array.isArray(p.imgs) && p.imgs.length ? p.imgs : [p.img]).filter(Boolean);
  const url = `${SITE}p/${p.id}.html`, canon = `${SITE}shop.html?p=${p.id}`, shop = `../shop.html?p=${p.id}`;
  const desc = String(p.desc || `${p.name} من ميكانيزم: إكسسوارات المطابخ والدريسنج روم.`).replace(/\s+/g, ' ').trim().slice(0, 200);
  const title = `${p.name}${p.code ? ' — كود ' + p.code : ''} | ميكانيزم`;
  const ld = {
    '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: desc, sku: p.code || p.id,
    image: imgs.slice(0, 4), brand: { '@type': 'Brand', name: 'ميكانيزم' }, category: sec.name || undefined, url: canon,
  };
  const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${canon}"><link rel="icon" href="../icon-192.png">
<meta property="og:type" content="product"><meta property="og:locale" content="ar_EG"><meta property="og:site_name" content="ميكانيزم | Mechanism">
<meta property="og:title" content="${esc(p.name)}"><meta property="og:description" content="${esc(desc)}">
${imgs[0] ? `<meta property="og:image" content="${esc(imgs[0])}"><meta property="og:image:alt" content="${esc(p.name)}">` : `<meta property="og:image" content="${SITE}og.jpg">`}
<meta property="og:url" content="${url}"><meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
<script>location.replace(${JSON.stringify(shop)})</script>
<style>body{margin:0;font-family:Cairo,Tahoma,sans-serif;background:#f3f4f2;color:#10202c;text-align:center;padding:16px}main{max-width:520px;margin:auto;background:#fff;border-radius:18px;padding:16px;box-shadow:0 4px 18px #0001}img{width:100%;height:auto;border-radius:12px;background:#fff}h1{font-size:22px;margin:12px 0 6px}p{color:#555;line-height:1.7}a{display:block;margin:10px 0;padding:13px;border-radius:14px;font-weight:800;text-decoration:none}.w{background:#25D366;color:#fff}.s{background:#10202c;color:#f6d77a}</style>
</head><body><main>
${imgs[0] ? `<img src="${esc(imgs[0])}" alt="${esc(p.name)}" width="800" height="800">` : ''}
<h1>${esc(p.name)}</h1>${p.code ? `<p>كود: ${esc(p.code)}</p>` : ''}<p>${esc(desc)}</p>
<a class="w" href="${esc(wa(`السلام عليكم، عايز أسأل عن: ${p.name}${p.code ? ' (كود ' + p.code + ')' : ''}\n${url}`))}">💬 اسأل عن السعر على الواتساب</a>
<a class="s" href="${shop}">🛒 افتح المنتج في المتجر</a>
</main></body></html>
`;
  const f = path.join(dir, p.id + '.html');
  keep.add(p.id + '.html');
  if (!fs.existsSync(f) || fs.readFileSync(f, 'utf8') !== html) fs.writeFileSync(f, html);
}
for (const f of fs.readdirSync(dir)) if (f.endsWith('.html') && !keep.has(f)) fs.unlinkSync(path.join(dir, f));

// sitemap: الصفحات الثابتة + رابط لكل منتج في المتجر (التاريخ يتغيّر بس لو قايمة الصفحات اتغيّرت)
const sm = path.join(ROOT, 'sitemap.xml');
const locs = ['shop.html', 'custom.html', 'custom.html?k=steel', 'custom.html?k=bamboo', 'custom.html?k=delf', ...prods.map(p => `shop.html?p=${p.id}`)];
const old = fs.existsSync(sm) ? fs.readFileSync(sm, 'utf8') : '';
const oldLocs = [...old.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]).join('|');
if (oldLocs !== locs.map(l => esc(SITE + l)).join('|')) {
  const day = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(sm, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${locs.map(l => `  <url><loc>${esc(SITE + l)}</loc><lastmod>${day}</lastmod></url>`).join('\n')}\n</urlset>\n`);
}
console.log('pages:', prods.length);
