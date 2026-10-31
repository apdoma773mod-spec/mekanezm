'use client';
// «يمين ولا شمال» as a looping motion graphic (top view, like a kitchen plan): the door swings open, the trays glide out toward
// the open side, and the FIXED side stays lit with a label. «corner»: magic corner / bean pull-out. «door»: a hinged door.
// Everything is drawn for the RIGHT version; the LEFT one is the same scene mirrored (texts are HTML, so they never flip).
import { useId } from 'react';
import { HAND_LABEL, opposite, type Hand } from '@/lib/hand';

// bean-shaped tray, centred on 0,0 (≈156 × 90)
const BEAN = 'M-78,-6 C-78,-34 -48,-46 -14,-44 C14,-42 30,-30 52,-34 C72,-38 80,-18 78,4 C76,30 54,44 24,44 C-2,44 -16,30 -42,36 C-66,42 -78,24 -78,-6 Z';

function Corner({ u }: { u: string }) {
  return (
    <>
      {/* walls (the fixed side sits against the side wall) */}
      <rect x="6" y="12" width="388" height="16" rx="3" fill="#cfd6de" />
      <rect x="6" y="12" width="18" height="214" rx="3" fill="#cfd6de" />
      <rect x="6" y="26" width="388" height="4" fill="#00000014" />
      {/* cabinet body: darker copy underneath = thickness */}
      <path d="M40,36 H330 V222 H314 V52 H56 V222 H40 Z" fill="#9c7440" transform="translate(0,8)" />
      <path d="M40,36 H330 V222 H314 V52 H56 V222 H40 Z" fill={`url(#${u}w)`} stroke="#8a6232" strokeWidth="1.5" />
      <rect x="56" y="52" width="258" height="170" fill="#00000010" />
      {/* the fixed part: lit all the time */}
      <rect className="hm-fixed" x="38" y="34" width="20" height="190" rx="4" fill="none" stroke="#f59e0b" strokeWidth="5" />
      <rect className="hm-fixedfill" x="40" y="36" width="16" height="186" fill="#f59e0b" />
      {/* back tray, then front tray */}
      <g className="hm-t2"><g transform="translate(176,104) scale(.92)"><TrayShape u={u} /></g></g>
      <g className="hm-t1"><g transform="translate(150,160)"><TrayShape u={u} /></g></g>
      {/* where they go: bold arrow above the trays */}
      <g className="hm-guide">
        <path d="M168,176 Q232,186 286,262" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
        <path d="M168,176 Q232,186 286,262" fill="none" stroke="#1e6fd9" strokeWidth="6" strokeLinecap="round" strokeDasharray="14 11" className="hm-dash" />
        <path d="M262,236 L296,276 L248,272 Z" fill="#1e6fd9" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      </g>
      {/* door: hinged on the fixed side, swings toward you */}
      <g className="hm-door" style={{ transformOrigin: '56px 214px' }}>
        <rect x="56" y="214" width="98" height="9" rx="2" fill="#7b5a30" transform="translate(0,5)" />
        <rect x="56" y="214" width="98" height="9" rx="2" fill="#f4f1ea" stroke="#b9b1a2" strokeWidth="1.2" />
        <rect x="140" y="212" width="12" height="4" rx="2" fill="#6b7480" />
      </g>
      <circle cx="56" cy="218" r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
    </>
  );
}

function TrayShape({ u }: { u: string }) {
  return (
    <g className="hm-tray">
      <path d={BEAN} fill="#3f4854" transform="translate(0,6)" />
      <path d={BEAN} fill="#e9eef3" stroke="#b7c0ca" strokeWidth="1.5" />
      <path d={BEAN} fill={`url(#${u}t)`} transform="scale(.9)" />
      <path d={BEAN} fill="none" stroke="#ffffff55" strokeWidth="2" transform="scale(.8)" />
    </g>
  );
}

function Door({ u }: { u: string }) {
  return (
    <>
      <rect x="6" y="12" width="388" height="16" rx="3" fill="#cfd6de" />
      <rect x="6" y="26" width="388" height="4" fill="#00000014" />
      <path d="M104,36 H296 V222 H280 V52 H120 V222 H104 Z" fill="#9c7440" transform="translate(0,8)" />
      <path d="M104,36 H296 V222 H280 V52 H120 V222 H104 Z" fill={`url(#${u}w)`} stroke="#8a6232" strokeWidth="1.5" />
      <rect x="120" y="52" width="160" height="170" fill="#00000010" />
      {/* shelf inside, so the opening reads as a cabinet */}
      <rect x="128" y="120" width="144" height="6" rx="2" fill="#c8a06a" />
      <rect x="128" y="168" width="144" height="6" rx="2" fill="#c8a06a" />
      {/* hinge side: lit all the time */}
      <rect className="hm-fixed" x="278" y="34" width="20" height="190" rx="4" fill="none" stroke="#f59e0b" strokeWidth="5" />
      <rect className="hm-fixedfill" x="280" y="36" width="16" height="186" fill="#f59e0b" />
      <g className="hm-door2" style={{ transformOrigin: '280px 216px' }}>
        <rect x="150" y="216" width="130" height="9" rx="2" fill="#7b5a30" transform="translate(0,5)" />
        <rect x="150" y="216" width="130" height="9" rx="2" fill="#f4f1ea" stroke="#b9b1a2" strokeWidth="1.2" />
        <rect x="156" y="214" width="12" height="4" rx="2" fill="#6b7480" />
      </g>
      <circle cx="280" cy="220" r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
      <circle cx="280" cy="70" r="5" fill="#f59e0b" stroke="#fff" strokeWidth="2" />
      <g className="hm-guide">
        <path d="M262,234 Q214,262 186,322" fill="none" stroke="#fff" strokeWidth="11" strokeLinecap="round" />
        <path d="M262,234 Q214,262 186,322" fill="none" stroke="#1e6fd9" strokeWidth="6" strokeLinecap="round" strokeDasharray="14 11" className="hm-dash" />
        <path d="M168,300 L184,340 L210,304 Z" fill="#1e6fd9" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      </g>
    </>
  );
}

export function HandMotion({ hand, kind }: { hand: Hand; kind: 'corner' | 'door' }) {
  const u = 'hm' + useId().replace(/[^a-z0-9]/gi, '');
  const mir = hand === 'L' ? 'translate(400,0) scale(-1,1)' : undefined;
  const fixedSide = kind === 'corner' ? opposite(hand) : hand; // corner: fixed part is opposite the exit; door: hinges are on the named side
  const L = HAND_LABEL;
  // label + the x of the lit panel it points to
  const left = fixedSide === 'L';
  const lx = kind === 'corner' ? (left ? 84 : 316) : (left ? 78 : 322);
  const px = kind === 'corner' ? (left ? 48 : 352) : (left ? 112 : 288);
  const steps = kind === 'corner'
    ? [['١', 'افتح الضلفة'], ['٢', `الصواني بتطلع ناحية ${L[hand]}`], ['٣', `الجزء الثابت على ${L[fixedSide]}`]]
    : [['١', `الضلفة بتفتح ناحية ${L[opposite(hand)]}`], ['٢', `المفصلات على ${L[hand]}`]];
  return (
    <figure className={`hm hm-k-${kind}`}>
      <div className="hm-stage">
        <svg viewBox="0 -44 400 424" role="img" aria-label={kind === 'corner' ? `ماجيك كورنر ${L[hand]}` : `ضلفة ${L[hand]}`}>
          <defs>
            <linearGradient id={u + 'w'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecd2a6" /><stop offset="1" stopColor="#d1a76c" /></linearGradient>
            <linearGradient id={u + 't'} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#9aa4b1" /><stop offset="1" stopColor="#626c7a" /></linearGradient>
            <linearGradient id={u + 'f'} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7f9fb" /><stop offset="1" stopColor="#e6ebf0" /></linearGradient>
            <pattern id={u + 'p'} width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44 0H0V44" fill="none" stroke="#d9dfe6" strokeWidth="1.2" /></pattern>
          </defs>
          <rect y="-44" width="400" height="424" rx="22" fill={`url(#${u}f)`} />
          <rect y="-44" width="400" height="424" rx="22" fill={`url(#${u}p)`} opacity=".7" />
          <g transform={mir}>{kind === 'corner' ? <Corner u={u} /> : <Door u={u} />}</g>
          {/* fixed-part label with a leader line to the lit side (never mirrored, so the text stays readable) */}
          <g>
            <path className="hm-lab" d={`M${lx},0 L${px},36`} stroke="#f59e0b" strokeWidth="3" strokeDasharray="5 5" fill="none" />
            <g transform={`translate(${lx},-16)`}>
              <g className="hm-lab">
                <rect x={kind === 'corner' ? -62 : -50} y="-17" width={kind === 'corner' ? 124 : 100} height="34" rx="17" fill="#f59e0b" />
                <text textAnchor="middle" y="6" className="hm-tx">{kind === 'corner' ? '📌 الجزء الثابت' : '📌 المفصلات'}</text>
              </g>
            </g>
          </g>
          {/* you */}
          <g transform="translate(200,362)"><circle r="11" fill="#1f2937" /><text textAnchor="middle" y="5" className="hm-tx w">👁</text></g>
          <text x="58" y="367" textAnchor="middle" className="hm-lr">◀ شمال</text>
          <text x="342" y="367" textAnchor="middle" className="hm-lr">يمين ▶</text>
        </svg>
        <span className={'hm-badge ' + hand}>{L[hand]}</span>
      </div>
      <ol className="hm-steps">{steps.map(([n, t], i) => <li key={n} className={'hm-c' + (i + 1)}><b>{n}</b>{t}</li>)}</ol>
      <figcaption>وانت واقف قدام الدولاب <small>(بتبص عليه من فوق)</small></figcaption>
    </figure>
  );
}
