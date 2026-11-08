// تاريخ التصوير من صور الآيفون الحقيقية (HEIC + JPG) — node tests/exif.test.cjs <dir>
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
(async () => {
  const M = await import(pathToFileURL(path.join(__dirname, '../lib/templates/media.ts')).href), dir = process.argv[2] || 'G:/عبده';
  const files = fs.readdirSync(dir).filter(f => /\.(heic|jpe?g|png)$/i.test(f)); let found = 0;
  files.forEach((f, i) => { const b = fs.readFileSync(path.join(dir, f)), d = M.exifDate(b.buffer.slice(b.byteOffset, b.byteOffset + b.length)); if (d) found++; if (i < 4 || /jpe?g|png/i.test(f)) console.log(f, d ? new Date(d).toISOString() : 'no date'); });
  console.log('with date:', found, 'of', files.length);
})();
