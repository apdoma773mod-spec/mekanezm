'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/app-shell';
import { ErrorState, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { formatDateTime, ROLE_LABELS } from '@/lib/format';
import { useHealth, useMe, useSettings } from '@/lib/queries';

export default function HomePage() {
  const me = useMe();
  const settings = useSettings();
  const health = useHealth();

  if (settings.isPending || !me.data) return <LoadingState />;
  if (settings.isError) {
    return <ErrorState message={errorMessage(settings.error)} onRetry={() => settings.refetch()} />;
  }

  const { store } = settings.data;
  const isAdmin = me.data.role === 'ADMIN';

  return (
    <>
      <PageHeader title={`أهلًا ${me.data.name}`} subtitle={`${store.name} · ${ROLE_LABELS[me.data.role]}`} />

      <div className="grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">بيانات المحل</h2>
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">الاسم</dt>
              <dd className="font-bold">{store.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">التليفونات</dt>
              <dd className="font-bold" dir="ltr">
                {store.phones.length ? store.phones.join(' · ') : '—'}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">العنوان</dt>
              <dd className="font-bold">{store.address || '—'}</dd>
            </div>
          </dl>
          {isAdmin && (
            <Link href="/settings" className="mt-4 inline-block font-bold text-primary">
              تعديل البيانات ←
            </Link>
          )}
        </section>

        <section className="rounded-xl border border-border bg-surface p-5">
          <h2 className="mb-3 text-lg font-bold">حالة السيستم</h2>
          <p className="flex items-center gap-2">
            <span
              aria-hidden
              className={`h-3 w-3 rounded-full ${health.isError ? 'bg-danger' : health.data ? 'bg-success' : 'bg-warning'}`}
            />
            {health.isError ? 'السيرفر مش بيرد' : health.data ? 'السيرفر شغال' : 'جاري الفحص…'}
          </p>
          <p className="mt-3 text-subtle">آخر دخول ليك: {formatDateTime(me.data.lastLoginAt)}</p>
        </section>
      </div>
    </>
  );
}
