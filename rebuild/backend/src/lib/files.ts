import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Uploaded photos/videos/PDFs. With SUPABASE_URL + SUPABASE_SERVICE_KEY set (hosted free tier, where the disk is wiped on restart)
 * they go to a Supabase Storage bucket; otherwise they stay in ./uploads (shop PC / Docker volume).
 */
const LOCAL = path.resolve(process.cwd(), 'uploads');
const url = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY ?? '';
const bucket = () => process.env.SUPABASE_BUCKET || 'mk-uploads';
const remote = () => Boolean(url() && key());

export async function putFile(name: string, buf: Buffer, contentType: string): Promise<void> {
  if (remote()) {
    const r = await fetch(`${url()}/storage/v1/object/${bucket()}/${name}`, {
      method: 'POST',
      headers: { authorization: `Bearer ${key()}`, apikey: key(), 'content-type': contentType, 'x-upsert': 'true' },
      body: new Uint8Array(buf),
    });
    if (!r.ok) throw new Error(`storage upload failed: ${r.status}`);
    return;
  }
  await mkdir(LOCAL, { recursive: true });
  await writeFile(path.join(LOCAL, name), buf);
}

/** Returns null when the file does not exist. */
export async function getFile(name: string): Promise<Buffer | null> {
  if (remote()) {
    const r = await fetch(`${url()}/storage/v1/object/${bucket()}/${name}`, { headers: { authorization: `Bearer ${key()}`, apikey: key() } });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  return readFile(path.join(LOCAL, name)).catch(() => null);
}
