'use client';
// 360° viewer: drag with a finger / mouse to turn the product. Frames are one full turn, in order.
// Plays one slow auto-turn on first view so people notice it can be dragged; stops at the first touch.
import { useEffect, useRef, useState } from 'react';

export function SpinViewer({ frames, alt }: { frames: string[]; alt: string }) {
  const n = frames.length;
  const [i, setI] = useState(0);
  const [ready, setReady] = useState(0);
  const [hint, setHint] = useState(true);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; i: number } | null>(null);
  const auto = useRef(true);
  const pos = useRef(0);

  // Preload every frame so dragging never waits on the network.
  useEffect(() => {
    let done = 0, dead = false;
    frames.forEach(src => { const im = new Image(); im.onload = im.onerror = () => { if (!dead) setReady(++done); }; im.src = src; });
    return () => { dead = true; };
  }, [frames]);

  // One slow turn once everything is loaded (skipped when the visitor prefers reduced motion).
  useEffect(() => {
    if (ready < n || !auto.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let t = 0;
    const id = setInterval(() => {
      if (!auto.current) return clearInterval(id);
      pos.current = (pos.current + 1) % n; setI(pos.current);
      if (++t >= n) { clearInterval(id); auto.current = false; }
    }, 70);
    return () => clearInterval(id);
  }, [ready, n]);

  const set = (k: number) => { pos.current = ((k % n) + n) % n; setI(pos.current); };
  const down = (e: React.PointerEvent) => {
    auto.current = false; setHint(false);
    drag.current = { x: e.clientX, i: pos.current };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent) => {
    const d = drag.current, w = box.current?.clientWidth;
    if (!d || !w) return;
    // A drag across the whole width = one full turn.
    set(d.i - Math.round(((e.clientX - d.x) / w) * n));
  };
  const up = () => { drag.current = null; };
  const key = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') { auto.current = false; set(pos.current + 1); }
    if (e.key === 'ArrowRight') { auto.current = false; set(pos.current - 1); }
  };

  return (
    <div className="spin" ref={box} dir="ltr" tabIndex={0} role="img" aria-label={`${alt} — عرض 360 درجة، اسحب للّف`}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key}>
      {/* plain <img>: frames are already preloaded and swapped many times a second */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={frames[i]} alt="" draggable={false} />
      {ready < n && <span className="spin-load">⏳ {Math.round((ready / n) * 100)}%</span>}
      {ready >= n && hint && <span className="spin-hint">↔ اسحب بصباعك للّف 360°</span>}
    </div>
  );
}
