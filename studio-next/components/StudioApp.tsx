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
      const { mountFold } = await import('@/lib/studio/fold');
      const { mountPublish } = await import('@/lib/studio/publish');
      if (off || (window as any).__studioStarted) return;
      (window as any).__studioStarted = 1;
      boot(); main(); gate(); startEngine(); pro();
      try { mountTemplates(); } catch (e) { console.warn('templates', e); }
      try { mountProducts(); } catch (e) { console.warn('mk products', e); }
      try { mountPublish(); } catch (e) { console.warn('publish', e); }
      // بعد ما المحرر يخلّص ترتيب الشاشات (الكروت المتثبتة إلخ) نلمّ الكروت في أيقونات
      Promise.resolve((window as any).__ready).then(() => setTimeout(() => { try { mountFold(); } catch (e) { console.warn('fold', e); } }, 1200));
    })();
    return () => { off = true; };
  }, []);
  return <div suppressHydrationWarning dangerouslySetInnerHTML={{ __html: MARKUP }} />;
}
