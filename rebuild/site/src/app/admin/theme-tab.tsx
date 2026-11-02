'use client';
// «🎨 الألوان والخشب»: real wood finishes, how much wood and where, whole-look presets, one color per role,
// automatic readable text, and a live preview that draws the same wood the store will show.
import { useMemo } from 'react';
import {
  ACCENTS, DARKS, DEFAULTS, HEX, THEMES, WOOD_AREAS, WOOD_FAMILIES, WOOD_LEVELS, WOOD_LIB, chosenWood, contrast, full, gloss, mix, onColor,
  resolve, woodAreas, woodFromHex, woodTheme, woodUrl, type ThemeKey, type ThemeMap, type Wood,
} from '@/lib/theme';

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

const Screw = () => <span className="ad-screw" />;

export function ThemeTab({ theme, set }: { theme: ThemeMap; set: (t: ThemeMap) => void }) {
  const r = resolve(theme);
  const put = (k: ThemeKey, v: string) => set({ ...theme, [k]: v });
  const text = (k: ThemeKey) => k === 'fg' || k === 'cardFg' || k === 'accentFg' || k === 'darkFg';
  const isTheme = (v: Partial<ThemeMap>) => (Object.keys(DEFAULTS) as ThemeKey[]).every(k => (theme[k] || '').toLowerCase() === (v[k] || '').toLowerCase());

  const wood = chosenWood(theme);
  const areas = woodAreas(theme);
  const lvl = theme.woodAt ? '' : (theme.woodLvl || '2');
  const pickWood = (w: Wood) => set({ ...theme, wood: '', woodId: w.id });
  const customHex = theme.wood && HEX.test(theme.wood) ? full(theme.wood) : '#8a5a33';
  const toggleArea = (a: string) => {
    const next = areas.includes(a) ? areas.filter(x => x !== a) : [...areas, a];
    set({ ...theme, woodAt: next.join(',') || 'head', woodLvl: '' });
  };
  const tiles = useMemo(() => WOOD_FAMILIES.map(f => ({ f, list: WOOD_LIB.filter(w => w.family === f) })), []);
  const board = (w: Wood, wd = 560, h = 200, o: { gloss?: boolean; seed?: number } = {}) => `${woodUrl(w, wd, h, { gloss: true, ...o })} center / 100% 100%, ${w.tones[1]}`;

  return <>
    <h3 className="ad-sub">🪵 خامات الخشب <small>(ألواح حقيقية بعروق وحلقات ومسام. بتتطبّق على الموقع كله وبتفضل حادة على أي شاشة 4K)</small></h3>
    {tiles.map(({ f, list }) => (
      <div key={f} className="ad-wfam">
        <h4>{f}</h4>
        <div className="ad-woods lg">
          {list.map(w => (
            <button key={w.id} type="button" className={theme.woodId === w.id && !theme.wood ? 'on' : ''} onClick={() => pickWood(w)} aria-pressed={theme.woodId === w.id && !theme.wood}>
              <i style={{ background: board(w) }} /><b>{w.name}</b>
            </button>))}
        </div>
      </div>
    ))}
    <div className="ad-wfam">
      <h4>لون خشب مخصص</h4>
      <div className="ad-color"><div>
        <input type="color" value={customHex} onChange={e => set({ ...theme, woodId: '', wood: e.target.value })} aria-label="لون الخشب" />
        <input dir="ltr" value={theme.wood || ''} placeholder="#8a5a33" maxLength={7} onChange={e => set({ ...theme, woodId: '', wood: e.target.value.trim() })} />
        <span className="ad-wsw" style={{ background: board(woodFromHex(customHex), 200, 60) }} />
      </div></div>
    </div>

    {wood && <>
      <div className="ad-wbig" style={{ background: board(wood, 960, 300) }}>
        <span><b>{wood.name}</b><small>{wood.family || 'مخصص'}</small></span>
      </div>
      <div className="ad-wact">
        {wood.id !== 'custom' && <button type="button" className="sec" onClick={() => set({ ...theme, ...woodTheme(wood) })}>🎨 طبّق ألوان «{wood.name}» على الموقع كله (خلفية + أزرار + الأقسام الداكنة)</button>}
        <button type="button" className="lnk" onClick={() => set({ ...theme, wood: '', woodId: '', woodLvl: '', woodAt: '' })}>🚫 من غير خشب</button>
      </div>

      <h3 className="ad-sub">كمية الخشب على الموقع</h3>
      <div className="ad-seg">
        {WOOD_LEVELS.map(([k, t]) => <button key={k} type="button" className={lvl === k ? 'on' : ''} onClick={() => set({ ...theme, woodLvl: k, woodAt: '' })}>{t}</button>)}
      </div>
      <h3 className="ad-sub">أو اختار الأماكن بنفسك</h3>
      <div className="ad-chks">
        {WOOD_AREAS.map(([a, t]) => <label key={a} className="ad-ck"><input type="checkbox" checked={areas.includes(a)} onChange={() => toggleArea(a)} /> {t}</label>)}
      </div>
    </>}

    <h3 className="ad-sub">ثيمات جاهزة (ضغطة واحدة تغيّر كل الألوان)</h3>
    <div className="ad-themes">
      {THEMES.map(t => {
        const x = resolve(t.v);
        return <button key={t.name} type="button" className={isTheme(t.v) ? 'on' : ''} onClick={() => set({ ...DEFAULTS, accent: '', bg: '', card: '', dark: '', woodId: theme.woodId, woodLvl: theme.woodLvl, woodAt: theme.woodAt, ...t.v })}>
          <span style={{ background: x.bg }}><i style={{ background: x.card }} /><i style={{ background: x.accent }} /><i style={{ background: `linear-gradient(145deg,${x.pl},${x.pa})` }} /></span>{t.name}
        </button>;
      })}
    </div>

    <h3 className="ad-sub">لون الأزرار والتمييز</h3>
    <div className="ad-darks">
      {ACCENTS.map(([n, c]) => (
        <button key={c} type="button" className={r.accent === c ? 'on' : ''} onClick={() => put('accent', c)}>
          <i style={{ background: `linear-gradient(145deg,${mix(c, '#ffffff', 0.25)},${c} 55%,${mix(c, '#000000', 0.3)})`, boxShadow: `0 6px 14px ${c}55` }} />{n}
        </button>))}
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

    <h3 className="ad-sub">معاينة حيّة (نفس الخشب اللي هيظهر على الموقع)</h3>
    <Preview r={r} wood={wood} areas={areas} />
  </>;
}

function Preview({ r, wood, areas }: { r: ReturnType<typeof resolve>; wood: Wood | null; areas: string[] }) {
  const on = (a: string) => !!wood && areas.includes(a);
  const plank = (h = 120, g = false, seed = 0) => (wood ? { background: `${woodUrl(wood, 640, h, { seed, gloss: g })} center / 100% 100%, ${wood.tones[1]}` } : {});
  const fg = wood ? onColor(wood.tones[1]) : '#fff';
  const pale = wood ? { ...wood, tones: [mix(wood.tones[0], '#fff', 0.82), mix(wood.tones[1], '#fff', 0.88), mix(wood.tones[2], '#fff', 0.92)] as Wood['tones'] } : null;
  return (
    <div className="ad-sw ad-pv" style={on('bg') && pale ? { background: `${woodUrl(pale, 900, 560, { seed: 29 })} center / cover`, color: r.fg } : { background: r.bg, color: r.fg }}>
      <div className="ad-pvh" style={{ background: '#fffffff2' }}><b>ميكانيزم</b>{on('head') && <u style={plank(60, false, 3)} />}</div>
      {on('titles')
        ? <div className="ad-plank" style={{ ...plank(80, true, 9), color: fg }}><Screw />الأقسام<Screw /></div>
        : <b>عنوان الصفحة</b>}
      <small style={{ color: r.mut }}>كلام ثانوي على الخلفية</small>
      <div className="ad-pvc" style={{ background: r.card, color: r.cardFg }}>
        <div className="ad-pvi" style={on('frame') && wood ? { border: `6px solid ${wood.tones[1]}`, boxShadow: `inset 0 0 0 1px ${wood.tones[0]}` } : undefined}>🔩</div>
        <b>مفصلة هيدروليك</b><span>كود 1234 · مفصلات</span>
        <i style={on('btn') ? { ...plank(80, true, 21), color: fg } : { background: r.accent, color: r.accentFg }}>🛒 أضف للطلب</i>
        {on('cards') && <u className="ad-cedge" style={plank(60, false, 5)} />}
      </div>
      <div className="ad-dk" style={{ background: `linear-gradient(135deg,${r.pa},${r.pb})`, color: r.darkFg }}>
        {['🔧', '🚪', '🧰'].map(x => <span key={x}><i style={{ background: `linear-gradient(145deg,${r.pl},${r.pa})`, boxShadow: `0 6px 14px ${r.pa}55` }}>{x}</i>قسم</span>)}
      </div>
      {on('foot') && <div className="ad-pvf" style={plank(60, true, 17)} />}
      {on('nav') && <div className="ad-pvn" style={{ background: r.card }}><u style={plank(50, false, 9)} />الرئيسية · الأقسام · السلة</div>}
    </div>
  );
}
