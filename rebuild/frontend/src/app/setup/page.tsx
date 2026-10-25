'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setupInput } from '@mk/shared';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { ErrorState, FormError, LoadingState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useSetup, useSetupStatus } from '@/lib/queries';

export default function SetupPage() {
  const router = useRouter();
  const status = useSetupStatus();
  const setup = useSetup();
  const [form, setForm] = useState({ name: '', phone: '', email: '', password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (status.data === false) router.replace('/login');
  }, [status.data, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(setupInput, form);
    if (!v.ok) return setErrors(v.errors);
    if (form.password !== form.confirm) return setErrors({ confirm: 'كلمة السر مش متطابقة' });
    setErrors({});
    setup.mutate(v.data, {
      onSuccess: () => router.replace('/'),
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-primary">ميكانيزم</h1>
        <p className="mb-6 text-center text-subtle">أول تشغيل: اعمل حساب المدير بتاعك</p>
        {status.isPending || status.data === false ? (
          <LoadingState />
        ) : status.isError ? (
          <ErrorState message={errorMessage(status.error)} onRetry={() => status.refetch()} />
        ) : (
          <form onSubmit={submit} noValidate className="space-y-4">
            <TextField label="اسمك" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <TextField
              label="رقم موبايلك"
              hint="هتدخل بيه بعد كده"
              inputMode="tel"
              autoComplete="tel"
              dir="ltr"
              value={form.phone}
              error={errors.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <TextField
              label="الإيميل (اختياري)"
              type="email"
              autoComplete="email"
              dir="ltr"
              value={form.email}
              error={errors.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <TextField
              label="كلمة السر"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              hint="٨ حروف على الأقل"
              value={form.password}
              error={errors.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <TextField
              label="اكتبها تاني"
              type="password"
              autoComplete="new-password"
              dir="ltr"
              value={form.confirm}
              error={errors.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
            />
            <FormError message={errors._} />
            <Button type="submit" block loading={setup.isPending}>
              ابدأ
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
