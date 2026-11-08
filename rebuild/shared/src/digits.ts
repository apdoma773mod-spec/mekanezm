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

/**
 * باركود اتقري والكيبورد عربي: جهاز الباركود بيدوس نفس زراير الكيبورد، فلو اللغة عربي «P» بتطلع «ح» أو «؛».
 * ده بيرجّع الحروف لمكانها على الكيبورد الإنجليزي (لوحة Arabic 101 على ويندوز/ماك)، والأرقام العربي لأرقام عادية.
 */
const AR_KEYS: Record<string, string> = {
  ض: 'Q', ص: 'W', ث: 'E', ق: 'R', ف: 'T', غ: 'Y', ع: 'U', ه: 'I', خ: 'O', ح: 'P', ج: '[', د: ']',
  ش: 'A', س: 'S', ي: 'D', ب: 'F', ل: 'G', ا: 'H', ت: 'J', ن: 'K', م: 'L', ك: ';', ط: "'",
  ئ: 'Z', ء: 'X', ؤ: 'C', ر: 'V', ى: 'N', ة: 'M', و: ',', ز: '.', ظ: '/',
  'َ': 'Q', 'ً': 'W', 'ُ': 'E', 'ٌ': 'R', إ: 'Y', '÷': 'I', '×': 'O', '؛': 'P', 'ِ': 'A', 'ٍ': 'S',
  أ: 'H', 'ـ': 'J', '،': 'K', '~': 'Z', 'ْ': 'X', آ: 'N', '’': 'M', '؟': '/', 'ذ': '`',
};
const AR_PAIRS: Record<string, string> = { لا: 'B', لإ: 'T', لأ: 'G', لآ: 'B' };

export function arabicKeysToLatin(input: string): string {
  let s = normalizeDigits(input);
  for (const [k, v] of Object.entries(AR_PAIRS)) s = s.split(k).join(v);
  let out = '';
  for (const ch of s) out += AR_KEYS[ch] ?? ch;
  return out;
}

/** فيه حروف عربي؟ (يعني غالبًا اتكتب والكيبورد عربي) */
export const hasArabic = (s: string) => /[؀-ۿ]/.test(s);
