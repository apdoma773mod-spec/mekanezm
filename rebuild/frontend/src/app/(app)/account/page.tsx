'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { changePasswordInput } from '@mk/shared';
import { PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { FormError, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { formatDateTime, ROLE_LABELS } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useChangePassword, useLogout, useMe } from '@/lib/queries';

const EMPTY = { currentPassword: '', newPassword: '', confirm: '' };

export default function AccountPage() {
  const me = useMe();
  const router = useRouter();
  const toast = useToast();
  const change = useChangePassword();
  const logout = useLogout();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});

  if (!me.data) return <LoadingState />;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(changePasswordInput, form);
    if (!v.ok) return setErrors(v.errors);
    if (form.newPassword !== form.confirm) return setErrors({ confirm: 'كلمة السر مش متطابقة' });
    setErrors({});
    change.mutate(v.data, {
      onSuccess: () => {
        setForm(EMPTY);
        toast('اتغيرت كلمة السر، وأي جهاز تاني اتسجّل خروجه');
      },
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  return (
    <>
      <PageHeader title="حسابي" />
      <div className="grid max-w-3xl gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-surface p-5">
          <dl className="space-y-2">
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">الاسم</dt>
              <dd className="font-bold">{me.data.name}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">الموبايل</dt>
              <dd className="font-bold" dir="ltr">
                {me.data.phone}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">الصلاحية</dt>
              <dd className="font-bold">{ROLE_LABELS[me.data.role]}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-subtle">آخر دخول</dt>
              <dd className="font-bold">{formatDateTime(me.data.lastLoginAt)}</dd>
            </div>
          </dl>
          <Button
            variant="secondary"
            block
            className="mt-5"
            loading={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
          >
            تسجيل خروج
          </Button>
        </section>

        <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-border bg-surface p-5">
          <h2 className="text-lg font-bold">تغيير كلمة السر</h2>
          <TextField
            label="كلمة السر الحالية"
            type="password"
            autoComplete="current-password"
            dir="ltr"
            value={form.currentPassword}
            error={errors.currentPassword}
            onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
          />
          <TextField
            label="كلمة السر الجديدة"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            hint="٨ حروف على الأقل"
            value={form.newPassword}
            error={errors.newPassword}
            onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
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
          <Button type="submit" block loading={change.isPending}>
            حفظ
          </Button>
        </form>
      </div>
    </>
  );
}
