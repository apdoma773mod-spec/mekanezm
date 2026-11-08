// next/image loader: Supabase storage photos are resized by Supabase's image CDN,
// local files (/pw covers, icons) are already small and are served as they are.
const PUBLIC = /^(https:\/\/[a-z0-9]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?]+\.(?:jpe?g|png|webp))$/i;

// Photos uploaded in the system live on the shop PC (full-size, behind a tunnel): resize + cache them on the site's own image server so they open fast and keep showing even if the PC is off.
const SYSTEM = /^https:\/\/mekanezm-admin\.vercel\.app\/api\/v1\/work\/files\//;

// Few distinct sizes, so each photo is resized (and cached) only a handful of times.
const SIZES = [256, 640, 1200, 1920];

/** Same photo, already inside the gold frame (zoom view). Other URLs are returned as they are. */
export const framedUrl = (src: string) => SYSTEM.test(src) ? `/mkimg/${src.slice(src.lastIndexOf('/') + 1)}?w=1920&f=1&v=2` : src;

export default function loader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  const m = PUBLIC.exec(src);
  if (SYSTEM.test(src)) return `/mkimg/${src.slice(src.lastIndexOf('/') + 1)}?w=${SIZES.find(x => x >= width) ?? 1920}&v=2`;
  if (m) return `${m[1]}/storage/v1/render/image/public/${m[2]}?width=${width}&quality=${quality ?? 72}&resize=contain`;
  return src.startsWith('/') ? `${src}${src.includes('?') ? '&' : '?'}w=${width}` : src;
}
