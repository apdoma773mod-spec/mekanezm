'use client';
// «🎨 الألوان»: whole-look presets, one color per role, automatic readable text, and a live preview.
import { DARKS, DEFAULTS, HEX, THEMES, WOODS, contrast, full, gloss, grain, onColor, resolve, woodTheme, type ThemeKey, type ThemeMap } from '@/lib/theme';

const LABEL: Record<Exclude<ThemeKey, 'wood'>, string> = {
  bg: 'خلفية الصفحة', fg: 'لون الكلام على الصفحة', card: 'خلفية الكروت والقوائم', cardFg: 'لون الكلام داخل الكروت',
  accent: 'لون الأزرار والتمييز', accentFg: 'لون الكلام على الأزرار', dark: 'لون الأقسام الداكنة (البترولي)', darkFg: 'لون الكلام على الأقسام الداكنة',
};
// each text color is checked against the background it sits on
const AGAINST: Partial<Record<ThemeKey, ThemeKey>> = { fg: 'bg', cardFg: 'card', accentFg: 'accent', darkFg: 'dark' };
const GROUPS: { title: string; keys: Exclude<ThemeKey, 'wood'>[] }[] = [
  { title: 'الصفحة', keys: ['bg', 'fg'] },
  { title: 'الكروت', keys: ['card', 'cardFg'] },
  { title: 'الأزرار', keys: ['accent', 'accentFg'] },
  { title: 'الأقسام الداكنة', keys: ['dark', 'darkFg'] },
];

export function ThemeTab({ theme, set }: { theme: ThemeMap; set: (t: ThemeMap) => void }) {
  const r = resolve(theme);
  const put = (k: ThemeKey, v: string) => set({ ...theme, [k]: v });
  const text = (k: ThemeKey) => k === 'fg' || k === 'cardFg' || k === 'accentFg' || k === 'darkFg';
  const isTheme = (v: Partial<ThemeMap>) => (Object.keys(DEFAULTS) as ThemeKey[]).every(k => (theme[k] || '').toLowerCase() === (v[k] || '').toLowerCase());

  const woodOn = (h: string) => (theme.wood || '').toLowerCase() === h;
  return <>
    <h3 className="ad-sub">عينات الخشب <small>(لمسة خشب جرافيك: لوح تحت الهيدر، ألواح بمسامير نحاس على العناوين، وحافة للكروت. ألوان الموقع بتفضل زي ما هي)</small></h3>
    <div className="ad-woods">
      {WOODS.map(([n, h]) => (
        <button key={h} type="button" className={woodOn(h) ? 'on' : ''} onClick={() => set({ ...theme, wood: h })} aria-pressed={woodOn(h)}>
          <i style={{ background: grain(h) }} /><b>{n}</b>
        </button>))}
      {theme.wood && <button type="button" className="clr" onClick={() => set({ ...theme, wood: '' })}><i /><b>من غير خشب</b></button>}
    </div>

    <h3 className="ad-sub">ثيمات جاهزة (ضغطة واحدة تغيّر كل الألوان)</h3>
    <div className="ad-themes">
      {THEMES.map(t => {
        const x = resolve(t.v);
        return <button key={t.name} type="button" className={isTheme(t.v) ? 'on' : ''} onClick={() => set({ ...DEFAULTS, accent: '', bg: '', card: '', dark: '', ...t.v })}>
          <span style={{ background: x.bg }}><i style={{ background: x.card }} /><i style={{ background: x.accent }} /><i style={{ background: `linear-gradient(145deg,${x.pl},${x.pa})` }} /></span>{t.name}
        </button>;
      })}
    </div>

    <h3 className="ad-sub">درجات الأقسام الداكنة (المربعات اللامعة)</h3>
    <div className="ad-darks">
      {DARKS.map(([n, c]) => { const g = gloss(c); return (
        <button key={c} type="button" className={r.dark === c ? 'on' : ''} onClick={() => put('dark', c)}>
          <i style={{ background: `linear-gradient(145deg,${g.pl},${g.pa})`, boxShadow: `0 6px 14px ${g.pa}55` }} />{n}
        </button>); })}
    </div>

    <details className="ad-adv"><summary>تخصيص كل لون على حدة</summary>
    {GROUPS.map(g => <div key={g.title} className="ad-grp"><h3 className="ad-sub">{g.title}</h3>
      {g.keys.map(k => {
        const v = theme[k] || '', auto = text(k) && !v, eff = HEX.test(v) ? full(v) : (r as Record<string, string>)[k];
        const vs = AGAINST[k], ratio = vs && !auto ? contrast(eff, (r as Record<string, string>)[vs]) : 99;
        return (
          <div key={k} className="ad-color">
            <label>{LABEL[k]}{auto && <small> — تلقائي (بيتظبط حسب الخلفية)</small>}</label>
            <div>
              <input type="color" value={eff} onChange={e => put(k, e.target.value)} aria-label={LABEL[k]} />
              <input dir="ltr" value={v} placeholder={text(k) ? 'تلقائي' : DEFAULTS[k]} onChange={e => put(k, e.target.value.trim())} maxLength={7} />
              {v && <button type="button" className="lnk" onClick={() => put(k, '')}>{text(k) ? 'تلقائي' : 'الافتراضي'}</button>}
            </div>
            {ratio < 4.5 && vs && <small className="err">اللون ده مش واضح على الخلفية (التباين {ratio.toFixed(1)} من 4.5). <button type="button" className="lnk" onClick={() => put(k, onColor((r as Record<string, string>)[vs]))}>صلّحه تلقائي</button></small>}
          </div>);
      })}
    </div>)}
    </details>

    <h3 className="ad-sub">معاينة حيّة</h3>
    <div className="ad-sw" style={{ background: r.bg, color: r.fg }}>
      {r.wood
        ? <div className="ad-plank" style={{ background: grain(r.wood), color: onColor(r.wood) }}><span className="ad-screw" />الأقسام<span className="ad-screw" /></div>
        : <b>عنوان الصفحة</b>}
      <small style={{ color: r.mut }}>كلام ثانوي على الخلفية</small>
      <div style={{ background: r.card, color: r.cardFg }}><b>كارت منتج</b><span>مفصلة هيدروليك — 30 ج</span><i style={{ background: r.accent, color: r.accentFg }}>أضف للطلب</i>{r.wood && <u className="ad-cedge" style={{ background: grain(r.wood) }} />}</div>
      <div className="ad-dk" style={{ background: `linear-gradient(135deg,${r.pa},${r.pb})`, color: r.darkFg }}>
        {['🔧', '🚪', '🧰'].map(x => <span key={x}><i style={{ background: `linear-gradient(145deg,${r.pl},${r.pa})`, boxShadow: `0 6px 14px ${r.pa}55` }}>{x}</i>قسم</span>)}
      </div>
    </div>
  </>;
}
