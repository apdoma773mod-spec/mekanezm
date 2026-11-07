// سحب الصوت من الفيديو (16kHz mono) + تجهيزه للذكاء. نقل من smart.js — يشتغل في المتصفح بس.
export const fmt = (t: number) => { t = Math.max(0, t | 0); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
type Prog = (m: string) => void;

export async function pcmFromFile(file: File, prog: Prog = () => {}): Promise<Float32Array> {
  const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
  if (file.size <= 260e6) {
    try {
      prog('🎧 بسحب الصوت من الفيديو…');
      const buf = await file.arrayBuffer(), ac = new AC();
      const ab: AudioBuffer = await new Promise((ok, no) => { const p: any = ac.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); });
      ac.close && ac.close();
      const off = new OfflineAudioContext(1, Math.ceil(ab.duration * 16000), 16000), src = off.createBufferSource();
      src.buffer = ab; src.connect(off.destination); src.start();
      return (await off.startRendering()).getChannelData(0);
    } catch (e) { console.warn('decode', e); }
  }
  // فيديو كبير أو صيغة مش بتتفك: نسمعه وهو شغال (بياخد نفس مدة الفيديو)
  return await new Promise<Float32Array>((ok, no) => {
    const v = document.createElement('video'); v.src = URL.createObjectURL(file); v.playsInline = true; v.muted = false;
    const ac = new AC(), src = ac.createMediaElementSource(v), sp = ac.createScriptProcessor(4096, 1, 1), parts: Float32Array[] = [], g = ac.createGain();
    g.gain.value = 0; src.connect(sp); sp.connect(g); g.connect(ac.destination); const rate = ac.sampleRate;
    sp.onaudioprocess = e => { parts.push(new Float32Array(e.inputBuffer.getChannelData(0))); prog('🎧 بسمع الفيديو… ' + fmt(v.currentTime) + ' من ' + fmt(v.duration)); };
    const wake = () => { if (v.ended || !v.paused || document.visibilityState !== 'visible') return; ac.resume().then(() => v.play()).catch(() => {}); };
    document.addEventListener('visibilitychange', wake); v.onpause = () => { if (!v.ended) setTimeout(wake, 400); }; const wd = setInterval(wake, 2500);
    v.onended = () => {
      document.removeEventListener('visibilitychange', wake); clearInterval(wd); sp.disconnect(); ac.close && ac.close();
      const n = parts.reduce((a, p) => a + p.length, 0), all = new Float32Array(n); let o = 0; parts.forEach(p => { all.set(p, o); o += p.length; });
      const k = rate / 16000, out = new Float32Array(Math.floor(n / k)); for (let i = 0; i < out.length; i++) out[i] = all[Math.floor(i * k)];
      URL.revokeObjectURL(v.src); ok(out);
    };
    v.onerror = () => no(new Error('الفيديو مش بيشتغل على الموبايل ده'));
    ac.resume().then(() => v.play()).catch(no);
  });
}

/** WAV 16kHz base64 (مع تعلية الصوت الواطي) — اللي بيتبعت لدالة video-ai. */
export function wav64(f32: Float32Array): string {
  const n = f32.length, b = new ArrayBuffer(44 + n * 2), d = new DataView(b);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) d.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); d.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 16000, true); d.setUint32(28, 32000, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, 'data'); d.setUint32(40, n * 2, true);
  let peak = 0; for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(f32[i]));
  const g = peak > 0.001 ? Math.min(8, 0.9 / peak) : 1;
  for (let i = 0; i < n; i++) d.setInt16(44 + i * 2, Math.max(-1, Math.min(1, f32[i] * g)) * 32767, true);
  let s = ''; const u = new Uint8Array(b); for (let i = 0; i < u.length; i += 32768) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 32768)));
  return btoa(s);
}

/** تقسيم على أماكن السكوت عشان مانقطعش كلمة في النص (أجزاء ~len ثانية). */
export function splitPoints(f32: Float32Array, len: number): number[] {
  const R = 16000, out = [0]; let at = 0;
  while (at + len * R < f32.length) {
    const tgt = at + len * R; let best = tgt, bv = 1e9;
    for (let i = tgt - 4 * R; i < tgt + 2 * R && i < f32.length; i += 800) { let e = 0; for (let j = i; j < i + 800 && j < f32.length; j++) e += Math.abs(f32[j]); if (e < bv) { bv = e; best = i; } }
    at = best; out.push(at);
  }
  out.push(f32.length); return out;
}
