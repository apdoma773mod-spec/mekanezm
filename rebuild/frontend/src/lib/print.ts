import type { ContactStatement, InvoiceDto, QuoteDto, SettingsMap, ShipmentDto } from '@mk/shared';
import { code128Svg } from './code128';
import { arDate, fontStack, mix, money, qtyText, textOn } from './format';

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/**
 * Prints a full HTML document through a hidden iframe, so each print keeps its own page size
 * (A4 for invoices, 80mm for receipts) without touching the app's styles.
 */
export function printHtml(html: string) {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const go = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
  // Give fonts and images a moment, as the old system did.
  if (doc.readyState === 'complete') setTimeout(go, 600);
  else frame.onload = () => setTimeout(go, 600);
}

const FONT_LINKS = `<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&family=Tajawal:wght@400;700;800&family=Almarai:wght@400;700;800&family=Noto+Kufi+Arabic:wght@400;700;800&family=Amiri:wght@400;700&family=Changa:wght@400;700;800&display=swap">`;

const KIND_TITLE = { SALE: 'فاتورة بيع', PURCHASE: 'فاتورة شراء' } as const;

/** The old system's A4 invoice (invoiceHTML), same layout and colors. */
export function invoiceA4Html(inv: InvoiceDto, s: SettingsMap): string {
  const T = s.theme;
  const H = T.invSync ? T.primary : T.invHeader;
  const A = T.invSync ? T.accent : T.invAccent;
  const HT = textOn(H);
  const tint = mix(H, 0.08);
  // used inside style="…": double quotes in the font names ("Cairo") would cut the attribute and drop the font
  const fam = fontStack(T.invFont === 'same' ? T.font : T.invFont).replace(/"/g, "'");
  const shop = esc(s.store.name || 'ميكانيزم');
  const addr = esc(s.store.address);
  const ph = esc(s.store.phones.join(' - '));
  const isSale = inv.kind === 'SALE';
  const logo = T.logoInv && T.logo;
  const wm = T.watermark && T.logo
    ? `<img src="${T.logo}" style="position:absolute;top:50%;left:50%;width:420px;transform:translate(-50%,-50%);opacity:.06;object-fit:contain">`
    : '';
  const header = logo
    ? `<div style="position:relative;background:${H};line-height:0"><img src="${T.logo}" style="width:100%;display:block"></div>
  <div style="position:relative;background:${H};color:${HT};padding:14px 44px 16px;display:flex;justify-content:space-between;align-items:center;gap:16px">
   <div><div style="display:flex;align-items:center;gap:10px;font-size:22px;font-weight:800;line-height:1.3"><span>${shop}</span></div><div style="margin-top:4px;font-size:13px;opacity:.9;line-height:1.6">${addr}${ph ? ` &nbsp;•&nbsp; تليفون: <span dir="ltr">${ph}</span>` : ''}</div></div>
   <div style="font-size:20px;font-weight:800;white-space:nowrap">${KIND_TITLE[inv.kind]}</div></div>`
    : `<div style="position:relative;background:${H};color:${HT};padding:34px 44px;display:flex;justify-content:space-between;align-items:center">
   <div><div style="font-size:38px;font-weight:800">${shop}</div><div style="margin-top:8px;font-size:15px;opacity:.9">${addr}</div>${ph ? `<div style="margin-top:4px;font-size:15px;opacity:.9">تليفون: <span dir="ltr">${ph}</span></div>` : ''}</div>
   <div style="text-align:left"><div style="font-size:30px;font-weight:800;color:${A}">${KIND_TITLE[inv.kind]}</div></div></div>`;
  const rows = inv.items
    .map(
      (x) => `<tr style="border-bottom:1px solid #e4eaed"><td style="padding:14px 12px"><b>${esc(x.name)}</b></td><td style="padding:14px 12px;text-align:center">${qtyText(x.qty)} ${esc(x.unit)}</td><td style="padding:14px 12px;text-align:center">${money(x.price)}</td><td style="padding:14px 12px;text-align:center;font-weight:700">${money(x.total)}</td></tr>`,
    )
    .join('');
  const extras =
    inv.shipping || inv.discount
      ? `<div style="display:flex;justify-content:flex-start;margin-top:20px"><div style="width:320px;font-size:17px;line-height:2.1;padding:0 6px"><div style="display:flex;justify-content:space-between"><span>إجمالي الأصناف</span><b>${money(inv.subtotal)}</b></div>${inv.discount ? `<div style="display:flex;justify-content:space-between"><span>الخصم</span><b>${money(inv.discount)}</b></div>` : ''}${inv.shipping ? `<div style="display:flex;justify-content:space-between"><span>مصاريف النقل</span><b>${money(inv.shipping)}</b></div>` : ''}</div></div>`
      : '';
  const footer = esc(s.store.invoiceFooter) || `شكراً لتعاملكم معنا — ${shop}`;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(inv.no)}</title>${FONT_LINKS}
<style>@page{size:A4;margin:0}body{margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact;box-sizing:border-box}</style></head><body>
<div style="width:794px;min-height:1123px;background:#fff;direction:rtl;font-family:${fam};color:${T.text};position:relative;overflow:hidden">${wm}
 ${header}
 <div style="position:relative;height:6px;background:${A}"></div>
 <div style="position:relative;padding:30px 44px">
  <div style="display:flex;justify-content:space-between;gap:20px">
   <div style="flex:1;background:${tint};border-radius:12px;padding:16px 18px;line-height:2"><div style="font-weight:800;color:${H};margin-bottom:4px">${isSale ? 'بيانات العميل' : 'بيانات المورد'}</div><div>الاسم: <b>${esc(inv.person || (isSale ? 'عميل نقدي' : '—'))}</b></div>${inv.phone ? `<div>التليفون: <b dir="ltr">${esc(inv.phone)}</b></div>` : ''}${inv.address ? `<div>العنوان: <b>${esc(inv.address)}</b></div>` : ''}</div>
   <div style="width:260px;background:${tint};border-radius:12px;padding:16px 18px;line-height:2"><div style="font-weight:800;color:${H};margin-bottom:4px">بيانات الفاتورة</div><div>رقم الفاتورة: <b>${esc(inv.no)}</b></div><div>التاريخ: <b>${esc(arDate(inv.date))}</b></div><div style="height:42px;margin-top:4px">${code128Svg(inv.no, 42).replace('<svg ', '<svg style="width:100%;height:42px" ')}</div></div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:28px;font-size:16px">
   <thead><tr style="background:${H};color:${HT}"><th style="padding:12px;text-align:right;border-radius:0 10px 0 0">البيان</th><th style="padding:12px;text-align:center">الكمية</th><th style="padding:12px;text-align:center">سعر الوحدة</th><th style="padding:12px;text-align:center;border-radius:10px 0 0 0">الإجمالي</th></tr></thead>
   <tbody>${rows}</tbody></table>
  ${extras}
  <div style="display:flex;justify-content:flex-start;margin-top:${extras ? 10 : 26}px"><div style="width:320px;background:${H};color:${HT};border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;font-size:20px"><span>الإجمالي المطلوب</span><b style="font-size:24px">${money(inv.total)}</b></div></div>
  <div style="display:flex;justify-content:flex-start;margin-top:12px"><div style="width:320px;font-size:17px;line-height:2.3;padding:0 6px"><div style="display:flex;justify-content:space-between"><span>المدفوع</span><b>${money(inv.paid)}</b></div><div style="display:flex;justify-content:space-between;color:${inv.remaining > 0 ? '#c0392b' : '#159447'}"><span>المتبقي</span><b>${money(inv.remaining)}</b></div></div></div>
  ${inv.note ? `<div style="margin-top:18px;color:#596a70">ملاحظات: ${esc(inv.note)}</div>` : ''}
 </div>
 <div style="position:absolute;bottom:0;right:0;left:0;text-align:center;padding:20px;border-top:1px solid #e4eaed;color:#718087;font-size:14px">${footer}</div></div>
</body></html>`;
}

/** The old system's 80mm thermal receipt (printReceipt). */
export function receiptHtml(inv: InvoiceDto, s: SettingsMap): string {
  const rows = inv.items
    .map(
      (x) =>
        `<tr><td colspan="2"><b>${esc(x.name)}</b></td></tr><tr class="sm"><td>${qtyText(x.qty)} × ${money(x.price)}</td><td class="l">${money(x.total)}</td></tr>`,
    )
    .join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(inv.no)}</title>${FONT_LINKS}
<style>@page{size:80mm auto;margin:0}body{margin:0;width:80mm}*{font-family:Cairo,Tahoma,sans-serif;color:#000}.w{width:72mm;margin:0 auto;padding:3mm 0;font-size:11pt}.c{text-align:center}.b{font-weight:800}hr{border:0;border-top:1px dashed #000;margin:2mm 0}table{width:100%;border-collapse:collapse}td{padding:1mm 0;vertical-align:top}.l{text-align:left;white-space:nowrap}.sm{font-size:9pt}.big{font-size:14pt}</style></head><body><div class="w">
 ${s.theme.logo ? `<div class="c"><img src="${s.theme.logo}" style="max-width:40mm;max-height:18mm"></div>` : ''}
 <div class="c b big">${esc(s.store.name || 'ميكانيزم')}</div>${s.store.address ? `<div class="c sm">${esc(s.store.address)}</div>` : ''}${s.store.phones.length ? `<div class="c sm" dir="ltr">${esc(s.store.phones.join(' - '))}</div>` : ''}<hr>
 <div class="sm">فاتورة: <b>${esc(inv.no)}</b><br>التاريخ: ${esc(arDate(inv.date))}<br>${inv.kind === 'SALE' ? 'العميل' : 'المورد'}: ${esc(inv.person || 'عميل نقدي')}${inv.phone ? ` — <span dir="ltr">${esc(inv.phone)}</span>` : ''}</div>
 <div class="c" style="line-height:0;margin:2mm 0;height:14mm">${code128Svg(inv.no, 40).replace('<svg ', '<svg style="width:100%;height:14mm" ')}</div><hr>
 <table>${rows}</table><hr>
 <table>${inv.shipping || inv.discount ? `<tr><td>إجمالي الأصناف</td><td class="l">${money(inv.subtotal)}</td></tr>` : ''}${inv.discount ? `<tr><td>الخصم</td><td class="l">${money(inv.discount)}</td></tr>` : ''}${inv.shipping ? `<tr><td>النقل</td><td class="l">${money(inv.shipping)}</td></tr>` : ''}<tr class="b big"><td>الإجمالي</td><td class="l">${money(inv.total)}</td></tr><tr><td>المدفوع</td><td class="l">${money(inv.paid)}</td></tr>${inv.remaining > 0 ? `<tr class="b"><td>المتبقي</td><td class="l">${money(inv.remaining)}</td></tr>` : ''}</table><hr>
 <div class="c sm">${inv.createdBy ? `سجّلها: ${esc(inv.createdBy.name)}<br>` : ''}شكراً لتعاملكم معنا</div></div></body></html>`;
}

/** «📄 كشف حساب» for a customer or supplier, on A4. */
export function statementHtml(st: ContactStatement, s: SettingsMap): string {
  const T = s.theme;
  const H = T.invSync ? T.primary : T.invHeader;
  const HT = textOn(H);
  const c = st.contact;
  const range = st.from || st.to ? `من ${st.from ? arDate(st.from) : 'البداية'} لحد ${st.to ? arDate(st.to) : 'النهارده'}` : 'كل الفترات';
  const rows = st.lines
    .map(
      (l) =>
        `<tr><td>${esc(arDate(l.date))}</td><td>${esc(l.label)}</td><td>${l.debit ? money(l.debit) : ''}</td><td>${l.credit ? money(l.credit) : ''}</td><td><b>${money(l.balance)}</b></td></tr>`,
    )
    .join('');
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>كشف حساب ${esc(c.name)}</title>${FONT_LINKS}
<style>@page{size:A4;margin:12mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:${fontStack(T.font)};color:#18343a}
h1{margin:0;font-size:24px}table{width:100%;border-collapse:collapse;margin-top:14px;font-size:13px}th{background:${H};color:${HT};padding:8px;text-align:right}td{padding:7px 8px;border-bottom:1px solid #e4eaed}.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid ${H};padding-bottom:10px}</style></head><body>
<div class="head"><div><h1>${esc(s.store.name)}</h1><div style="color:#718087">${esc(s.store.address)}</div></div><div style="text-align:left"><b style="font-size:20px">كشف حساب</b><div>${esc(range)}</div></div></div>
<p style="font-size:16px">${c.type === 'CUSTOMER' ? 'العميل' : 'المورد'}: <b>${esc(c.name)}</b>${c.phone ? ` — <span dir="ltr">${esc(c.phone)}</span>` : ''}</p>
${st.from ? `<p>رصيد أول المدة: <b>${money(st.opening)}</b></p>` : ''}
<table><thead><tr><th>التاريخ</th><th>البيان</th><th>عليه</th><th>له</th><th>الرصيد</th></tr></thead><tbody>${rows || '<tr><td colspan="5" style="text-align:center;color:#718087">مفيش حركات</td></tr>'}</tbody></table>
<p style="font-size:18px;margin-top:16px">الرصيد الحالي: <b>${money(st.closing)}</b></p>
<p style="color:#718087;font-size:12px">اتطبع ${esc(new Date().toLocaleString('ar-EG'))}</p></body></html>`;
}

/** The old quoteHTML(): «عرض سعر» page in the invoice colours. */
export function quoteHtml(q: QuoteDto, s: SettingsMap): string {
  const T = s.theme;
  const H = T.invSync ? T.primary : T.invHeader;
  const A = T.invSync ? T.accent : T.invAccent;
  const HT = textOn(H);
  const tint = mix(H, 0.08);
  const shop = esc(s.store.name || 'ميكانيزم');
  const logo = T.logoInv && T.logo ? `<img src="${T.logo}" style="height:80px;max-width:160px;object-fit:contain;background:#fff;border-radius:12px;padding:6px;margin-left:20px">` : '';
  const ph = esc(s.store.phones.join(' / '));
  const sub = Math.round((q.total - q.shipping) * 100) / 100;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>عرض سعر ${esc(q.no)}</title>${FONT_LINKS}
<style>@page{size:A4;margin:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{margin:0}</style></head><body>
<div style="width:794px;min-height:1000px;margin:0 auto;background:#fff;direction:rtl;font-family:${fontStack(T.font).replace(/"/g, "'")};color:#18343a;position:relative;overflow:hidden">
<div style="background:${H};color:${HT};padding:30px 44px;display:flex;justify-content:space-between;align-items:center"><div style="display:flex;align-items:center">${logo}<div><div style="font-size:34px;font-weight:800">${shop}</div><div style="margin-top:6px;font-size:14px;opacity:.9">${esc(s.store.address)}${ph ? ` • تليفون: <span dir="ltr">${ph}</span>` : ''}</div></div></div><div style="font-size:30px;font-weight:800;color:${A}">عرض سعر</div></div>
<div style="height:6px;background:${A}"></div>
<div style="padding:30px 44px"><div style="display:flex;gap:20px"><div style="flex:1;background:${tint};border-radius:12px;padding:16px 18px;line-height:2"><div style="font-weight:800;color:${H}">مقدّم إلى</div><div>الاسم: <b>${esc(q.person || '—')}</b></div>${q.phone ? `<div>التليفون: <b dir="ltr">${esc(q.phone)}</b></div>` : ''}</div>
<div style="width:260px;background:${tint};border-radius:12px;padding:16px 18px;line-height:2"><div style="font-weight:800;color:${H}">بيانات العرض</div><div>رقم العرض: <b>${esc(q.no)}</b></div><div>التاريخ: <b>${esc(arDate(q.date))}</b></div></div></div>
<table style="width:100%;border-collapse:collapse;margin-top:28px;font-size:16px"><thead><tr style="background:${H};color:${HT}"><th style="padding:12px;text-align:right">البيان</th><th style="padding:12px;text-align:center">الكمية</th><th style="padding:12px;text-align:center">سعر الوحدة</th><th style="padding:12px;text-align:center">الإجمالي</th></tr></thead>
<tbody>${q.items
    .map(
      (x) =>
        `<tr style="border-bottom:1px solid #e4eaed"><td style="padding:14px 12px"><b>${esc(x.name)}</b></td><td style="padding:14px 12px;text-align:center">${x.qty} ${esc(x.unit || '')}</td><td style="padding:14px 12px;text-align:center">${money(x.price)}</td><td style="padding:14px 12px;text-align:center;font-weight:700">${money(x.total)}</td></tr>`,
    )
    .join('')}</tbody></table>
${q.shipping ? `<div style="width:320px;font-size:17px;line-height:2.1;margin-top:18px"><div style="display:flex;justify-content:space-between"><span>إجمالي الأصناف</span><b>${money(sub)}</b></div><div style="display:flex;justify-content:space-between"><span>مصاريف النقل</span><b>${money(q.shipping)}</b></div></div>` : ''}
<div style="width:320px;background:${H};color:${HT};border-radius:12px;padding:16px 20px;display:flex;justify-content:space-between;align-items:center;font-size:20px;margin-top:14px"><span>الإجمالي</span><b style="font-size:24px">${money(q.total)}</b></div>
${q.note ? `<div style="margin-top:22px;background:${tint};border-radius:12px;padding:14px 18px;line-height:1.9">${esc(q.note)}</div>` : ''}</div>
<div style="position:absolute;bottom:0;right:0;left:0;text-align:center;padding:20px;border-top:1px solid #e4eaed;color:#718087;font-size:14px">عرض السعر ده للعلم ومش فاتورة — ${shop}</div></div></body></html>`;
}

/** A report as an A4 page (landscape when it has many columns), like the old mkPrintA4. */
export function reportHtml(
  r: { title: string; range: string; sum: [string, string][]; head: string[]; rows: string[][] },
  s: SettingsMap,
): string {
  const T = s.theme;
  const H = T.invSync ? T.primary : T.invHeader;
  const HT = textOn(H);
  const land = r.head.length > 6;
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${esc(r.title)}</title>${FONT_LINKS}
<style>@page{size:A4${land ? ' landscape' : ''};margin:10mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:${fontStack(T.font)};color:#18343a}
h1{margin:0;font-size:22px}table{width:100%;border-collapse:collapse;margin-top:12px;font-size:12px}th{background:${H};color:${HT};padding:7px;text-align:right}td{padding:6px 7px;border-bottom:1px solid #e4eaed}
.head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:4px solid ${H};padding-bottom:8px}.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-top:10px}.stats div{border:1px solid #e4eaed;border-radius:8px;padding:6px 8px}.stats small{display:block;color:#718087;font-size:11px}</style></head><body>
<div class="head"><div><h1>${esc(s.store.name)}</h1></div><div style="text-align:left"><b style="font-size:18px">${esc(r.title)}</b><div>${esc(r.range)}</div></div></div>
<div class="stats">${r.sum
    .slice(0, 8)
    .map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`)
    .join('')}</div>
<table><thead><tr>${r.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${r.rows
    .map((row) => `<tr>${row.map((v) => `<td>${esc(v)}</td>`).join('')}</tr>`)
    .join('')}</tbody></table>
<p style="color:#718087;font-size:11px">اتطبع ${esc(new Date().toLocaleString('ar-EG'))}</p></body></html>`;
}

/** WhatsApp message the old system sent with the invoice. */
export function whatsappLink(inv: InvoiceDto, s: SettingsMap): string | null {
  const digits = inv.phone.replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') ? `2${digits}` : digits;
  const msg = `أهلاً ${inv.person || ''}\nدي فاتورتك رقم ${inv.no} من ${s.store.name || 'ميكانيزم'}\nالإجمالي: ${money(inv.total)}\nشكراً لتعاملك معانا 🙏`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

/** The old A4 shipping label: one page per parcel, big name/phone/governorate, Code128 of the parcel number. */
export function shipLabelHtml(sh: ShipmentDto, s: SettingsMap): string {
  const n = Math.max(1, sh.pieces || 1);
  const day = new Date(sh.createdAt).toLocaleDateString('ar-EG');
  const who = sh.kind === 'SHIP' ? sh.carrier : sh.driver || sh.carrier;
  const phones = s.store.phones.filter(Boolean);
  const logo = s.theme.logo ? `<img src="${s.theme.logo}" class="lg" alt="">` : `<div class="sn">${esc(s.store.name)}</div>`;
  const page = (i: number) => `<div class="pg"><div class="hd">${logo}${phones.length ? `<div class="cp" dir="ltr">${phones.map(esc).join('   •   ')}</div>` : ''}${s.store.address ? `<div class="ca">${esc(s.store.address)}</div>` : ''}</div>
<div class="to"><div class="lb"><span>المستلم</span><span class="tg">${sh.kind === 'SHIP' ? '📦 شحن' : '🛵 توصيل'}${n > 1 ? ` — طرد ${i} من ${n}` : ''}</span></div>
<div class="nm">${esc(sh.name || '—')}</div><div class="ph" dir="ltr">${esc(sh.phone)}</div>${sh.phone2 ? `<div class="ph2" dir="ltr">${esc(sh.phone2)}</div>` : ''}
${sh.gov || sh.area ? `<div class="gv">${esc([sh.gov, sh.area].filter(Boolean).join(' — '))}</div>` : ''}${sh.address ? `<div class="ad">${esc(sh.address)}</div>` : ''}</div>
${sh.note ? `<div class="nt">📝 ${esc(sh.note)}</div>` : ''}
<div class="ft"><div class="gr"><span>شحنة <b dir="ltr">${esc(sh.no)}</b></span>${sh.invoiceNo ? `<span>فاتورة <b dir="ltr">${esc(sh.invoiceNo)}</b></span>` : ''}<span>${esc(day)}</span>${who ? `<span>${esc(who)}</span>` : ''}${sh.tracking ? `<span>بوليصة <b dir="ltr">${esc(sh.tracking)}</b></span>` : ''}</div><div class="bc">${code128Svg(sh.no)}</div></div></div>`;
  let pages = '';
  for (let i = 1; i <= n; i++) pages += page(i);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>ملصق ${esc(sh.no)}</title>${FONT_LINKS}
<style>@page{size:A4;margin:8mm}*{font-family:Cairo,Tahoma,sans-serif;box-sizing:border-box}body{margin:0;color:#000}
.pg{height:279mm;overflow:hidden;page-break-after:always;border:3px solid #000;border-radius:5mm;padding:8mm;display:flex;flex-direction:column;gap:6mm}.pg:last-child{page-break-after:auto}
.hd{text-align:center;border-bottom:3px solid #000;padding-bottom:4mm}.lg{width:165mm;max-height:62mm;object-fit:contain;display:block;margin:0 auto 3mm}.sn{font-size:40pt;font-weight:900}.cp{font-size:16pt;font-weight:800}.ca{font-size:13pt;font-weight:600}
.to{flex:1;border:4px solid #000;border-radius:5mm;padding:6mm 8mm;display:flex;flex-direction:column;justify-content:center;gap:4mm}
.lb{display:flex;justify-content:space-between;align-items:center;font-size:18pt;font-weight:800}.lb .tg{background:#000;color:#fff;border-radius:3mm;padding:0 5mm}
.nm{font-size:56pt;font-weight:900;line-height:1.2}.ph{font-size:50pt;font-weight:900;line-height:1.15;text-align:right;letter-spacing:1px}.ph2{font-size:34pt;font-weight:800;text-align:right}
.gv{font-size:42pt;font-weight:900;line-height:1.25}.ad{font-size:30pt;font-weight:700;line-height:1.45}
.nt{font-size:16pt;font-weight:700;border:2px dashed #000;border-radius:4mm;padding:3mm 5mm}
.ft{display:flex;align-items:center;justify-content:space-between;gap:5mm;border-top:2px solid #000;padding-top:3mm}.gr{display:flex;flex-wrap:wrap;gap:2mm 6mm;font-size:12pt;font-weight:600}.gr b{font-weight:800}.bc{width:60mm;height:18mm;flex:none}.bc svg{width:100%;height:100%}</style></head><body>${pages}</body></html>`;
}
/** 🏷️ طباعة ليبل (old mkInvLabel): 50×30 mm sticker per carton with the invoice number as a barcode, scanning it opens the invoice. */
export function invoiceLabelHtml(inv: InvoiceDto, s: SettingsMap, n = 1): string {
  const items = inv.items.filter((x) => x.qty > 0);
  const pcs = items.reduce((t, x) => t + x.qty, 0);
  const shop = s.store.name || 'ميكانيزم';
  const lab = (i: number) =>
    `<div class="lb"><div class="top"><b>${esc(shop)}</b><span>${esc(inv.date)}</span></div><div class="who">${esc(inv.person || 'عميل نقدي')}${inv.phone ? ` · <span dir="ltr">${esc(inv.phone)}</span>` : ''}</div><div class="bc">${code128Svg(inv.no, 38)}<div class="nm">${esc(inv.no)}</div></div><div class="bot"><span>${items.length} صنف · ${pcs} قطعة</span>${n > 1 ? `<b>كرتونة ${i + 1} من ${n}</b>` : `<b>${esc(money(inv.total))}</b>`}</div></div>`;
  let pages = '';
  for (let i = 0; i < n; i++) pages += lab(i);
  return `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>ليبل ${esc(inv.no)}</title>${FONT_LINKS}<style>@page{size:50mm 30mm;margin:0}body{margin:0}*{box-sizing:border-box;font-family:Cairo,Tahoma,sans-serif;color:#000}.lb{width:50mm;height:30mm;padding:1.2mm 1.6mm;page-break-after:always;overflow:hidden;display:flex;flex-direction:column;justify-content:space-between}.top,.bot{display:flex;justify-content:space-between;align-items:center;font-size:7pt;line-height:1.1}.top b{font-size:8pt}.who{font-size:8pt;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}.bc svg{width:100%;height:11mm;display:block}.nm{text-align:center;font-size:7pt;font-weight:700;direction:ltr}</style></head><body>${pages}</body></html>`;
}
// ---------- 🖨️ ورق التجهيز (index.html 11355): من غير أسعار ولا إجماليات ولا اسم العميل. A4 بخط كبير ----------
export interface PrepSheet {
  code?: string;
  owner?: string;
  no?: string;
  date?: string;
  src?: string;
  lines: { name: string; qty?: number | string; unit?: string; dims?: string; sub?: string[] }[];
  notes?: string;
  stages?: string[];
  cur?: number;
}

/** مقاس مكتوب في اسم الصنف: «٦٠×٤٠» أو «١٢٠ سم» (نفس dimOf القديمة). */
export const dimOf = (n: string) => {
  const m = String(n || '').match(/(\d+(?:[.,]\d+)?\s*[x×*]\s*\d+(?:[.,]\d+)?(?:\s*[x×*]\s*\d+(?:[.,]\d+)?)?)|(\d+(?:[.,]\d+)?\s*(?:سم|مم|م|متر)(?=\s|$))/);
  return m ? m[0] : '';
};

export function prepSheetHtml(P: PrepSheet): string {
  const css =
    '@page{size:A4;margin:12mm}*{box-sizing:border-box;font-family:Cairo,Tahoma,Arial,sans-serif}body{margin:0;color:#000}table{width:100%;border-collapse:collapse;margin:8px 0}th{background:#222;color:#fff;padding:8px;font-size:13pt;text-align:right}td{padding:10px 8px;border-bottom:2px solid #999;vertical-align:middle}.bx{display:inline-block;width:15mm;height:15mm;border:3px solid #000;border-radius:3px;background:#fff}tr{page-break-inside:avoid}thead{display:table-header-group}';
  const head = `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;border-bottom:4px solid #000;padding-bottom:8px;margin-bottom:8px"><div>${
    P.code ? `<div style="font-size:38pt;font-weight:900;letter-spacing:2px;line-height:1.1" dir="ltr">${esc(P.code)}</div>` : ''
  }<div style="font-size:20pt;font-weight:800;margin-top:4px">ورقة تجهيز${P.owner ? ': ' + esc(P.owner) : ''}</div><div style="font-size:14pt;margin-top:4px">${
    P.date ? 'التاريخ: <b>' + esc(P.date) + '</b>' : ''
  }${P.no ? ' &nbsp;•&nbsp; ' + esc(P.src || '') + ' <b>' + esc(P.no) + '</b>' : P.src ? ' &nbsp;•&nbsp; ' + esc(P.src) : ''}</div></div></div>`;
  const rows = P.lines
    .map(
      (x, i) =>
        `<tr><td style="font-size:15pt">${i + 1}</td><td style="font-size:16pt"><b>${esc(x.name)}</b>${
          (x.sub || []).length ? '<div style="font-size:12pt;color:#333">' + x.sub!.map(esc).join('<br>') + '</div>' : ''
        }</td><td style="font-size:18pt;font-weight:800">${esc(x.qty != null ? String(x.qty) : '')} ${esc(x.unit || '')}</td><td style="font-size:15pt">${esc(x.dims || '')}</td><td style="text-align:center"><span class="bx"></span></td></tr>`,
    )
    .join('');
  const body = `${head}<table><thead><tr><th style="width:12mm">#</th><th>الصنف</th><th style="width:30mm">الكمية</th><th>المقاس / تفاصيل</th><th style="width:22mm;text-align:center">✔</th></tr></thead><tbody>${rows}</tbody></table>${
    P.notes ? `<div style="border:3px solid #000;border-radius:8px;padding:10px;margin:10px 0;font-size:15pt"><b>ملاحظات التصنيع:</b><br>${esc(P.notes).replace(/\n/g, '<br>')}</div>` : ''
  }${
    (P.stages || []).length
      ? `<div style="margin-top:10px;font-size:15pt"><b>المراحل:</b><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:6px">${P.stages!
          .map((s, i) => `<span style="border:2px solid #000;border-radius:8px;padding:4px 10px;${i === P.cur ? 'background:#ffe9a8;font-weight:800' : ''}">☐ ${esc(s)}</span>`)
          .join('')}</div></div>`
      : ''
  }<div style="margin-top:24px;font-size:15pt">اسم الجاهز: ______________________ &nbsp;&nbsp; التوقيع: ______________________</div>`;
  return `<!doctype html><html dir="rtl"><head><meta charset="utf-8"><title>ورقة تجهيز ${esc(P.code || P.no || '')}</title><style>${css}</style></head><body>${body}</body></html>`;
}
