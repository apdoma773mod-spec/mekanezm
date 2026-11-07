// منقول من إدارة الموقع (rebuild/site/src/app/admin) عشان الإدارة كلها تبقى جوه السيستم وتحفظ في نفس المكان اللي الموقع بيقرا منه.
/** Arabic-friendly search text: أ/إ/آ→ا، ة→ه، ى→ي، no diacritics, Arabic digits → Latin. */
export const norm = (s: string) => String(s || '').toLowerCase()
  .replace(/[ً-ْـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
  .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  // Common spellings of the same word, so «ألومنيوم» finds «المنيوم» and «دريسينج» finds «دريسنج».
  .replace(/دريسينج/g, 'دريسنج').replace(/الومنيوم|المونيوم/g, 'المنيوم').replace(/\s+/g, ' ').trim();
