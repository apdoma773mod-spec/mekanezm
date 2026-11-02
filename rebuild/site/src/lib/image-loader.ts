// next/image loader: Supabase storage photos are resized by Supabase's image CDN,
// local files (/pw covers, icons) are already small and are served as they are.
const PUBLIC = /^(https:\/\/[a-z0-9]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?]+\.(?:jpe?g|png|webp))$/i;

export default function loader({ src, width, quality }: { src: string; width: number; quality?: number }) {
  const m = PUBLIC.exec(src);
  if (m) return `${m[1]}/storage/v1/render/image/public/${m[2]}?width=${width}&quality=${quality ?? 72}&resize=contain`;
  return src.startsWith('/') ? `${src}${src.includes('?') ? '&' : '?'}w=${width}` : src;
}
