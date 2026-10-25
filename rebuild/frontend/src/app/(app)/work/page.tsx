'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';
import { AdminOnly } from '@/components/app-shell';
import { useModal } from '@/components/modals/modal-host';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useMe } from '@/lib/queries';
import { invalidateTrade } from '@/lib/trade-queries';
import { installRuntime } from '@/legacy/runtime';
import { installWork } from '@/legacy/work';

const KEYS = ['ord', 'new', 'steel', 'bamboo', 'off', 'rods', 'forf', 'disp', 'exp'];

/** «🛠️ أنظمة الشغل»: the old screen itself, drawn by ./legacy/work.js over the page as it always was. */
function Work() {
  const k = useSearchParams().get('k') ?? 'ord';
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const { open } = useModal();
  const [err, setErr] = useState('');
  const [ready, setReady] = useState(false);
  const leaving = useRef(false);

  // Fresh hooks each render, read through a ref so the old code always calls the current ones.
  const hooks = useRef({ toast, open, qc, router });
  hooks.current = { toast, open, qc, router };

  useEffect(() => {
    const u = me.data;
    if (!u) return;
    let alive = true;
    installRuntime({
      user: { name: u.name, admin: u.role === 'ADMIN' },
      toast: (t) => hooks.current.toast(t),
      changed: () => invalidateTrade(hooks.current.qc),
      openSale: (p) =>
        hooks.current.open({
          kind: 'transaction',
          type: 'SALE',
          preset: { person: p.person, phone: p.phone, paid: p.paid, note: p.note, lines: p.lines, onSaved: p.after },
        }),
    })
      .then(() => {
        if (!alive) return;
        installWork();
        (window as unknown as { mkWkClosed: () => void }).mkWkClosed = () => {
          if (leaving.current) return;
          leaving.current = true;
          hooks.current.router.push('/');
        };
        setReady(true);
      })
      .catch((e) => alive && setErr(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [me.data]);

  useEffect(() => {
    if (!ready) return;
    leaving.current = false;
    const w = window as unknown as { mkWk?: { go: (k: string) => Promise<void> } };
    void w.mkWk?.go(KEYS.includes(k) ? k : 'ord');
  }, [ready, k]);

  // Leaving by the sidebar or the back button: take the old screen off the page.
  useEffect(
    () => () => {
      leaving.current = true;
      document.getElementById('wkApp')?.remove();
      document.getElementById('modal')?.remove();
    },
    [],
  );

  if (err) return <ErrorBox message={err} />;
  return <Loading />;
}

export default function WorkPage() {
  return (
    <AdminOnly>
      <Suspense fallback={<Loading />}>
        <Work />
      </Suspense>
    </AdminOnly>
  );
}
