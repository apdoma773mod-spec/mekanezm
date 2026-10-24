const ARABIC_INDIC_ZERO = 0x0660;
const PERSIAN_ZERO = 0x06f0;

/** Converts Arabic-Indic (٠-٩) and Persian (۰-۹) digits and the Arabic decimal separator to ASCII. */
export function normalizeDigits(input: string): string {
  let out = '';
  for (const ch of input) {
    const code = ch.charCodeAt(0);
    if (code >= ARABIC_INDIC_ZERO && code <= ARABIC_INDIC_ZERO + 9) {
      out += String(code - ARABIC_INDIC_ZERO);
    } else if (code >= PERSIAN_ZERO && code <= PERSIAN_ZERO + 9) {
      out += String(code - PERSIAN_ZERO);
    } else if (ch === '٫') {
      out += '.';
    } else if (ch === '٬') {
      continue;
    } else {
      out += ch;
    }
  }
  return out;
}

/** Normalizes an Egyptian phone number to the local 11-digit form (01XXXXXXXXX). */
export function normalizePhone(input: string): string {
  let p = normalizeDigits(input).replace(/[\s\-()]/g, '');
  if (p.startsWith('+20')) p = '0' + p.slice(3);
  else if (p.startsWith('0020')) p = '0' + p.slice(4);
  else if (p.startsWith('20') && p.length === 12) p = '0' + p.slice(2);
  return p;
}

export const EG_MOBILE_RE = /^01[0125]\d{8}$/;
