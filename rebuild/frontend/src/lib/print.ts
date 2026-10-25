import type { ContactStatement, InvoiceDto, SettingsMap } from '@mk/shared';
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
  const fam = fontStack(T.invFont === 'same' ? T.font : T.invFont);
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

/** WhatsApp message the old system sent with the invoice. */
export function whatsappLink(inv: InvoiceDto, s: SettingsMap): string | null {
  const digits = inv.phone.replace(/\D/g, '');
  if (!digits) return null;
  const intl = digits.startsWith('0') ? `2${digits}` : digits;
  const msg = `أهلاً ${inv.person || ''}\nدي فاتورتك رقم ${inv.no} من ${s.store.name || 'ميكانيزم'}\nالإجمالي: ${money(inv.total)}\nشكراً لتعاملك معانا 🙏`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}
