/**
 * A page drawn in its own frame (invoice preview, PDF) doesn't see the app's fonts, and the Google Fonts link in it
 * can be slow or blocked on a phone, so the text fell back to the system font even with «كايرو» chosen.
 * This copies the @font-face rules the app already loads (Cairo is bundled with the app) into the frame's HTML.
 */
let cached: string | null = null;

export function appFontFaces(): string {
  if (cached !== null) return cached;
  let css = '';
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // another site's stylesheet
      }
      for (const r of Array.from(rules)) {
        if (r instanceof CSSFontFaceRule) css += `${r.cssText}\n`;
      }
    }
  } catch {
    /* no CSSOM: the Google link stays as the fallback */
  }
  if (css) cached = css;
  return css;
}

/** The same HTML with the app's own fonts added to its <head>. */
export function withAppFonts(html: string): string {
  const css = appFontFaces();
  if (!css) return html;
  return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `<style>${css}</style></head>`) : `<style>${css}</style>${html}`;
}
