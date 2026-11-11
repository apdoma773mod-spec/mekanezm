// رفع الفيديو/الصورة من الموبايل مباشرة لمخزن الستوديو (Vercel Blob) — أي حجم (بيترفع على أجزاء)، للمستخدم المسجّل بس.
// الملف بيتمسح بعد النشر (/api/blob/del)، ولو اتنسى بيتمسح لوحده بعد يومين.
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { del } from '@vercel/blob';
import type { NextRequest } from 'next/server';
import { whoami } from '@/lib/social/server';

export const dynamic = 'force-dynamic';
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });

export async function POST(req: NextRequest) {
  const body = (await req.json()) as HandleUploadBody & { del?: string; tok?: string };
  try {
    if (body && (body as any).del) {                                   // مسح ملف بعد النشر
      const u = await whoami(String(body.tok || '')); if (!u) return json({ error: 'سجّل دخول' }, 401);
      const url = String(body.del);
      if (!/^https:\/\/[\w.-]+\.public\.blob\.vercel-storage\.com\/pub\//.test(url)) return json({ error: 'مش مسموح' }, 400);
      await del(url); return json({ ok: true });
    }
    const r = await handleUpload({
      body, request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let tok = ''; try { tok = JSON.parse(clientPayload || '{}').tok || ''; } catch { /* */ }
        const u = await whoami(tok); if (!u) throw new Error('سجّل دخول الستوديو الأول');
        if (!pathname.startsWith('pub/')) throw new Error('مسار مش مسموح');
        return { allowedContentTypes: ['video/*', 'image/*'], maximumSizeInBytes: 4 * 1024 * 1024 * 1024, addRandomSuffix: true, ttlDays: 2 };
      },
    });
    return json(r);
  } catch (e) {
    return json({ error: String((e as Error).message || e) }, 400);
  }
}
