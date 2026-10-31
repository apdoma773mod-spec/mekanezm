// Offline check: node try-image.cjs <enrol photo> <frame.jpg> [tiles]
// Prints how many faces are found in the frame, their size, and the similarity to the enrolment photo.
const fs = require('fs');
const vision = require('./vision.cjs');
(async () => {
  const [enrol, frame, tiles = '1'] = process.argv.slice(2);
  await vision.init(__dirname);
  const ref = (await vision.detect(vision.decode(fs.readFileSync(enrol)), 1))[0];
  console.log('enrol face:', ref ? `${Math.round(ref.box[2])}px score ${ref.score.toFixed(2)}` : 'NONE');
  const img = vision.decode(fs.readFileSync(frame));
  const t0 = Date.now();
  const faces = await vision.detect(img, Number(tiles));
  console.log(`${frame}: ${img.w}x${img.h}, tiles ${tiles}, ${faces.length} face(s) in ${Date.now() - t0} ms`);
  for (const f of faces) console.log(`  box ${f.box.map((v) => Math.round(v)).join(',')} width ${Math.round(f.box[2])}px score ${f.score.toFixed(2)} similarity to enrolled ${ref ? vision.similarity(ref.embedding, f.embedding).toFixed(3) : '-'}`);
  process.exit(0);
})().catch((e) => { console.error('FAILED', e.message); process.exit(1); });
