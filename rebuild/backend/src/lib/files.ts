import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';

/**
 * Uploaded photos/videos/PDFs. With SUPABASE_URL + SUPABASE_SERVICE_KEY set (hosted free tier, where the disk is wiped on restart)
 * they go to a Supabase Storage bucket; otherwise they stay in ./uploads (shop PC / Docker volume).
 */
const LOCAL = path.resolve(process.cwd(), 'uploads');
const url = () => (process.env.SUPABASE_URL ?? '').replace(/\/$/, '');
const key = () => process.env.SUPABASE_SERVICE_KEY ?? '';
const bucket = () => process.env.SUPABASE_BUCKET || 'mk-uploads';
const remote = () => Boolean(url() && key());
/** FILES_IN_DB=1 (Vercel): no disk and no storage key, so pictures live in the StoredFile table. */
const inDb = () => process.env.FILES_IN_DB === '1';
let pc: PrismaClient | undefined;
const prisma = () => (pc ??= new PrismaClient());

export async function putFile(name: string, buf: Buffer, contentType: string): Promise<void> {
  if (inDb()) {
    const data = new Uint8Array(buf);
    await prisma().storedFile.upsert({ where: { name }, create: { name, type: contentType, data }, update: { type: contentType, data } });
    return;
  }
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
  if (inDb()) {
    const f = await prisma().storedFile.findUnique({ where: { name }, select: { data: true } });
    return f ? Buffer.from(f.data) : null;
  }
  if (remote()) {
    const r = await fetch(`${url()}/storage/v1/object/${bucket()}/${name}`, { headers: { authorization: `Bearer ${key()}`, apikey: key() } });
    return r.ok ? Buffer.from(await r.arrayBuffer()) : null;
  }
  return readFile(path.join(LOCAL, name)).catch(() => null);
}

/** Deletes a stored file; a missing one is fine. */
export async function removeFile(name: string): Promise<void> {
  if (inDb()) {
    await prisma().storedFile.deleteMany({ where: { name } });
    return;
  }
  if (remote()) {
    await fetch(`${url()}/storage/v1/object/${bucket()}/${name}`, { method: 'DELETE', headers: { authorization: `Bearer ${key()}`, apikey: key() } }).catch(() => undefined);
    return;
  }
  await rm(path.join(LOCAL, name), { force: true }).catch(() => undefined);
}
