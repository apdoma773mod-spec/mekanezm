/**
 * يصغّر الفيديو على التليفون نفسه قبل الرفع (من غير ما يتقصّر): فك الضغط ← إعادة ترميز H.264 بجودة أقل ← mp4 جديد.
 * بيستخدم WebCodecs (سفاري ١٦٫٤+ وكروم). الصوت بيتنقل زي ما هو من غير تغيير.
 * لو المتصفح مش بيدعم حاجة بيرمي خطأ بعربي واضح.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
type Say = (label: string) => void;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function compressVideo(file: File, targetBytes: number, say: Say): Promise<File> {
  const w = globalThis as any;
  if (!w.VideoEncoder || !w.VideoDecoder) throw new Error('المتصفح ده مش بيدعم ضغط الفيديو — حدّث المتصفح أو استخدم كروم');
  say('بيجهّز الفيديو… 0%');
  const [{ createFile, DataStream }, { Muxer, ArrayBufferTarget }] = await Promise.all([import('mp4box') as Promise<any>, import('mp4-muxer')]);

  // ---- 1) فك الملف لعينات فيديو وصوت ----
  const mp4 = createFile();
  const vs: any[] = [];
  const as: any[] = [];
  let info: any = null;
  let vTrack: any = null;
  let aTrack: any = null;
  let failed: unknown = null;
  mp4.onError = (e: unknown) => (failed = e);
  mp4.onReady = (i: any) => {
    info = i;
    vTrack = i.videoTracks?.[0] ?? null;
    aTrack = i.audioTracks?.[0] ?? null;
    if (vTrack) mp4.setExtractionOptions(vTrack.id, 'v', { nbSamples: 500 });
    if (aTrack && /^mp4a/.test(aTrack.codec)) mp4.setExtractionOptions(aTrack.id, 'a', { nbSamples: 500 });
    else aTrack = null;
    mp4.start();
  };
  mp4.onSamples = (_id: number, user: string, samples: any[]) => (user === 'v' ? vs : as).push(...samples);
  const SLICE = 4 * 1024 * 1024;
  for (let o = 0; o < file.size; ) {
    const ab: any = await file.slice(o, o + SLICE).arrayBuffer();
    ab.fileStart = o;
    const next = mp4.appendBuffer(ab);
    o = typeof next === 'number' && next > o ? next : o + ab.byteLength;
    say(`بيجهّز الفيديو… ${Math.min(99, Math.round((o / file.size) * 100))}%`);
    if (failed) break;
  }
  mp4.flush();
  if (failed || !info || !vTrack || !vs.length) throw new Error('معرفتش أقرا الفيديو ده (الصيغة مش مدعومة) — جرّب فيديو تاني أو لينك يوتيوب');

  // ---- 2) إعداد المفككّ والمرمّز ----
  const trak = mp4.getTrackById(vTrack.id);
  const entry = trak.mdia.minf.stbl.stsd.entries[0];
  const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
  if (!box) throw new Error('نوع ترميز الفيديو مش مدعوم للضغط');
  const ds = new DataStream(undefined, 0, DataStream.BIG_ENDIAN);
  box.write(ds);
  const description = new Uint8Array(ds.buffer, 8);
  const decCfg: any = { codec: vTrack.codec.startsWith('vp08') ? 'vp8' : vTrack.codec, codedWidth: vTrack.video.width, codedHeight: vTrack.video.height, description };
  if (!(await w.VideoDecoder.isConfigSupported(decCfg)).supported) throw new Error('المتصفح ده مش بيفك ترميز الفيديو ده — جرّب من سفاري أو كروم محدّث');

  const duration = info.duration / info.timescale;
  const srcW = vTrack.video.width as number;
  const srcH = vTrack.video.height as number;
  const k = Math.min(1, 1280 / Math.max(srcW, srcH));
  const outW = Math.max(2, Math.round((srcW * k) / 2) * 2);
  const outH = Math.max(2, Math.round((srcH * k) / 2) * 2);
  const aBytes = as.reduce((n, s) => n + s.size, 0);
  const aBps = duration > 0 ? (aBytes * 8) / duration : 0;
  const vBps = Math.round(Math.min(6_000_000, Math.max(300_000, (targetBytes * 8 * 0.9) / Math.max(1, duration) - aBps)));
  const fps = Math.min(60, Math.max(10, Math.round(vs.length / Math.max(1, duration))));
  let encCfg: any = null;
  for (const codec of ['avc1.640032', 'avc1.4d0032', 'avc1.42001f']) {
    const c = { codec, width: outW, height: outH, bitrate: vBps, framerate: fps, avc: { format: 'avc' } };
    if ((await w.VideoEncoder.isConfigSupported(c)).supported) {
      encCfg = c;
      break;
    }
  }
  if (!encCfg) throw new Error('المتصفح ده مش بيدعم ضغط الفيديو — جرّب كروم أو سفاري محدّث');

  const m = (trak.tkhd?.matrix ?? [65536, 0, 0, 0, 65536, 0, 0, 0, 1073741824]) as number[];
  const ang = (((Math.round((Math.atan2(m[1]! / 65536, m[0]! / 65536) * 180) / Math.PI) % 360) + 360) % 360) as 0 | 90 | 180 | 270;
  const rotation = ([0, 90, 180, 270] as const).includes(ang) ? ang : 0;

  const asc: Uint8Array | undefined = aTrack ? mp4.getTrackById(aTrack.id).mdia.minf.stbl.stsd.entries[0].esds?.esd?.descs?.[0]?.descs?.[0]?.data : undefined;
  if (aTrack && !asc) aTrack = null; // صوت بصيغة غريبة: أحسن فيديو من غير صوت من إنه يفشل
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: outW, height: outH, rotation },
    ...(aTrack ? { audio: { codec: 'aac', numberOfChannels: aTrack.audio.channel_count, sampleRate: aTrack.audio.sample_rate } } : {}),
    fastStart: 'in-memory',
    firstTimestampBehavior: 'cross-track-offset',
  });

  // الصوت بيتنقل زي ما هو
  if (aTrack) {
    let first = true;
    for (const s of as) {
      const meta = first ? { decoderConfig: { codec: 'mp4a.40.2', numberOfChannels: aTrack.audio.channel_count, sampleRate: aTrack.audio.sample_rate, description: asc } } : undefined;
      first = false;
      muxer.addAudioChunkRaw(new Uint8Array(s.data), s.is_sync ? 'key' : 'delta', Math.round((s.cts * 1e6) / s.timescale), Math.round((s.duration * 1e6) / s.timescale), meta);
    }
  }

  let encErr: unknown = null;
  const encoder = new w.VideoEncoder({ output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta), error: (e: unknown) => (encErr = e) });
  encoder.configure(encCfg);
  const canvas = k < 1 ? new OffscreenCanvas(outW, outH) : null;
  const ctx = canvas?.getContext('2d') as OffscreenCanvasRenderingContext2D | null;
  let n = 0;
  let decErr: unknown = null;
  const decoder = new w.VideoDecoder({
    output: (frame: any) => {
      try {
        let f = frame;
        if (canvas && ctx) {
          ctx.drawImage(frame, 0, 0, outW, outH);
          f = new w.VideoFrame(canvas, { timestamp: frame.timestamp, duration: frame.duration ?? undefined });
        }
        encoder.encode(f, { keyFrame: n % (fps * 2) === 0 });
        n++;
        if (f !== frame) f.close();
      } finally {
        frame.close();
      }
    },
    error: (e: unknown) => (decErr = e),
  });
  decoder.configure(decCfg);

  // ---- 3) تمرير الإطارات (بنستنى لو الطابور زحمة عشان الذاكرة) ----
  for (let i = 0; i < vs.length; i++) {
    if (decErr || encErr) break;
    while (decoder.decodeQueueSize > 6 || encoder.encodeQueueSize > 6) await sleep(4);
    const s = vs[i];
    decoder.decode(new w.EncodedVideoChunk({ type: s.is_sync ? 'key' : 'delta', timestamp: Math.round((s.cts * 1e6) / s.timescale), duration: Math.round((s.duration * 1e6) / s.timescale), data: s.data }));
    if (i % 15 === 0) say(`بيصغّر الفيديو… ${Math.round((i / vs.length) * 100)}%`);
  }
  await decoder.flush();
  await encoder.flush();
  if (decErr || encErr) throw new Error('حصلت مشكلة وهو بيصغّر الفيديو — جرّب فيديو أقصر أو لينك يوتيوب');
  muxer.finalize();
  decoder.close();
  encoder.close();
  const out = new File([target.buffer], 'video.mp4', { type: 'video/mp4' });
  if (out.size > 50 * 1024 * 1024) throw new Error(`الفيديو طويل جدًا حتى بعد الضغط (${Math.round(out.size / 1048576)} ميجا) — ارفعه يوتيوب غير مدرج وحط اللينك`);
  return out;
}
