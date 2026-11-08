// موسيقى بتتولّد على الجهاز (من غير حقوق نشر ومن غير نت): ٤ أمزجة، بنفس سرعة (BPM) القالب عشان القطع يبقى على الضربة.
import type { Mood } from './styles';

const CH: Record<string, number[][]> = { // كوردات (نوتات MIDI)
  calm: [[57, 60, 64, 67], [53, 57, 60, 64], [48, 52, 55, 60], [55, 59, 62, 67]],
  upbeat: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
  luxury: [[50, 57, 62, 65], [46, 53, 58, 62], [43, 50, 55, 58], [45, 52, 57, 61]],
  epic: [[45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59], [40, 47, 52, 56]],
};
const hz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** بيرجّع AudioBuffer جاهز بطول dur ثانية، وبيعمل fade في الأول والآخر. */
export async function makeMusic(mood: Mood, bpm: number, dur: number): Promise<AudioBuffer | null> {
  if (mood === 'none' || !bpm) return null;
  const OAC: any = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext; if (!OAC) return null;
  const sr = 44100, len = Math.ceil((dur + .2) * sr), ac: OfflineAudioContext = new OAC(2, len, sr), beat = 60 / bpm, bar = beat * 4;
  const master = ac.createGain(); master.gain.setValueAtTime(0, 0); master.gain.linearRampToValueAtTime(.8, Math.min(1, dur / 4)); master.gain.setValueAtTime(.8, Math.max(.1, dur - 1.6)); master.gain.linearRampToValueAtTime(0, dur);
  const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3; master.connect(comp); comp.connect(ac.destination);
  // ريفيرب بسيط (صدى متكرر)
  const wet = ac.createGain(); wet.gain.value = mood === 'upbeat' ? .12 : .28; const dl = ac.createDelay(1); dl.delayTime.value = beat * .75; const fb = ac.createGain(); fb.gain.value = .32; const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2400;
  wet.connect(dl); dl.connect(lp); lp.connect(fb); fb.connect(dl); lp.connect(master);
  const noise = (() => { const b = ac.createBuffer(1, sr, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; })();
  const tone = (f: number, t: number, d: number, type: OscillatorType, v: number, a = .01, r = .2, toWet = 0) => {
    if (t >= dur) return; const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.value = f; g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + a); g.gain.setValueAtTime(v, Math.max(t + a, t + d - r)); g.gain.linearRampToValueAtTime(0, t + d);
    o.connect(g); g.connect(master); if (toWet) { const w = ac.createGain(); w.gain.value = toWet; g.connect(w); w.connect(wet); } o.start(t); o.stop(t + d + .05);
  };
  const kick = (t: number, v = .9) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + .14); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .32); o.connect(g); g.connect(master); o.start(t); o.stop(t + .35); };
  const hat = (t: number, v = .12, d = .05) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; f.type = 'highpass'; f.frequency.value = 7000; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + d); s.connect(f); f.connect(g); g.connect(master); s.start(t, Math.random() * .5); s.stop(t + d + .02); };
  const clap = (t: number, v = .35) => { const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); s.buffer = noise; f.type = 'bandpass'; f.frequency.value = 1500; f.Q.value = .8; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .18); s.connect(f); f.connect(g); g.connect(master); const w = ac.createGain(); w.gain.value = .5; g.connect(w); w.connect(wet); s.start(t, Math.random() * .5); s.stop(t + .2); };
  const tom = (t: number, f0: number, v = .6) => { const o = ac.createOscillator(), g = ac.createGain(); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * .5, t + .4); g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(.001, t + .6); o.connect(g); g.connect(master); const w = ac.createGain(); w.gain.value = .4; g.connect(w); w.connect(wet); o.start(t); o.stop(t + .65); };
  const chords = CH[mood] || CH.calm, bars = Math.ceil(dur / bar);
  for (let b = 0; b < bars; b++) {
    const t0 = b * bar, ch = chords[b % chords.length];
    if (mood === 'calm') {
      ch.forEach(n => tone(hz(n), t0, bar, 'sine', .05, .6, .8, .5));
      for (let i = 0; i < 8; i++) tone(hz(ch[(i * 3) % ch.length] + 12), t0 + i * beat / 2, beat * .9, 'triangle', .07, .005, .5, .6);
      tone(hz(ch[0] - 12), t0, bar, 'sine', .12, .05, .4);
      if (b > 0) for (let i = 0; i < 4; i++) hat(t0 + i * beat + beat / 2, .04);
    } else if (mood === 'upbeat') {
      for (let i = 0; i < 4; i++) { kick(t0 + i * beat); hat(t0 + i * beat + beat / 2, .14); if (i % 2) clap(t0 + i * beat); }
      for (let i = 0; i < 8; i++) tone(hz(ch[0] - 12 + (i % 4 === 3 ? 7 : 0)), t0 + i * beat / 2, beat * .45, 'sawtooth', .06, .005, .08);
      ch.forEach(n => [0, 1.5, 2.5].forEach(k => tone(hz(n + 12), t0 + k * beat, beat * .5, 'square', .018, .005, .1, .4)));
    } else if (mood === 'luxury') {
      ch.forEach(n => { tone(hz(n), t0, bar, 'sawtooth', .022, .9, 1, .7); tone(hz(n) * 1.004, t0, bar, 'sawtooth', .02, .9, 1, .7); });
      tone(hz(ch[0] - 12), t0, bar, 'sine', .13, .2, .6); kick(t0, .5); kick(t0 + 2 * beat, .35);
      for (let i = 0; i < 4; i++) tone(hz(ch[(i + 1) % ch.length] + 24), t0 + i * beat, beat * 1.5, 'sine', .035, .01, 1, .9);
    } else { // epic
      ch.forEach(n => tone(hz(n), t0, bar, 'sawtooth', .025, .4, .6, .6)); tone(hz(ch[0] - 24), t0, bar, 'sine', .16, .05, .4);
      for (let i = 0; i < 4; i++) { tom(t0 + i * beat, i % 2 ? 110 : 80, .5); if (b % 2 && i === 3) { tom(t0 + 3.5 * beat, 140, .4); } }
      kick(t0, .9); kick(t0 + 2.5 * beat, .6); hat(t0 + beat, .08); hat(t0 + 3 * beat, .08);
    }
  }
  try { return await ac.startRendering(); } catch { return null; }
}

/** موسيقى من ملف المستخدم (mp3/m4a…) */
export async function decodeMusic(f: File): Promise<AudioBuffer> {
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext, ac = new AC(), buf = await f.arrayBuffer();
  try { return await new Promise<AudioBuffer>((ok, no) => { const p = ac.decodeAudioData(buf, ok, no); if (p && p.then) p.then(ok, no); }); }
  catch { throw new Error('ملف الموسيقى «' + f.name + '» مش بيتقري — جرّب MP3 أو M4A'); } finally { try { ac.close(); } catch { } }
}
