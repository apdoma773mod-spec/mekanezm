'use client';
import { useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { MARKUP } from '@/lib/studio/markup';

// استوديو ميكانيزم كله جوه Next: الهيكل (MARKUP) + المخزن + المحرر + البوابة + المونتاج الذكي + التحسينات.
// الترتيب نفس ترتيب index.html القديم: boot → main → gate → smart → pro.
export default function StudioApp() {
  useEffect(() => {
    let off = false;
    (window as any).supabase = (window as any).supabase || { createClient };
    (async () => {
      const { boot } = await import('@/lib/studio/boot');
      const { main } = await import('@/lib/studio/main');
      const { gate } = await import('@/lib/studio/gate');
      const { startEngine } = await import('@/lib/montage/engine');
      const { pro } = await import('@/lib/studio/pro');
      const { mountTemplates } = await import('@/lib/templates/ui');
      const { mountProducts } = await import('@/lib/studio/mkprod');
      if (off || (window as any).__studioStarted) return;
      (window as any).__studioStarted = 1;
      boot(); main(); gate(); startEngine(); pro();
      try { mountTemplates(); } catch (e) { console.warn('templates', e); }
      try { mountProducts(); } catch (e) { console.warn('mk products', e); }
    })();
    return () => { off = true; };
  }, []);
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
