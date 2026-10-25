'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { changePasswordInput } from '@mk/shared';
import { PageHeader } from '@/components/app-shell';
import { Input } from '@/components/ui/field';
import { FormError, Loading } from '@/components/ui/states';
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

  if (!me.data) return <Loading />;

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
      <PageHeader title="حسابي" subtitle={`${me.data.name} — ${ROLE_LABELS[me.data.role]}`} />
      <div className="grid2">
        <div className="card" style={{ lineHeight: 2 }}>
          <h3>بياناتي</h3>
          <div>
            الاسم: <b>{me.data.name}</b>
          </div>
          <div>
            الموبايل: <b dir="ltr">{me.data.phone}</b>
          </div>
          <div>
            الصلاحية: <b>{ROLE_LABELS[me.data.role]}</b>
          </div>
          <div>
            آخر دخول: <b>{formatDateTime(me.data.lastLoginAt)}</b>
          </div>
          <button
            type="button"
            className="secondary danger"
            style={{ marginTop: 12, width: '100%' }}
            disabled={logout.isPending}
            onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })}
          >
            تسجيل الخروج
          </button>
        </div>
        <form className="card" onSubmit={submit} noValidate>
          <h3>تغيير كلمة السر</h3>
          <div className="settings">
            <Input
              label="كلمة السر الحالية"
              type="password"
              autoComplete="current-password"
              value={form.currentPassword}
              onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              error={errors.currentPassword}
            />
            <Input
              label="كلمة السر الجديدة"
              type="password"
              autoComplete="new-password"
              hint="٨ حروف على الأقل"
              value={form.newPassword}
              onChange={(e) => setForm({ ...form, newPassword: e.target.value })}
              error={errors.newPassword}
            />
            <Input
              label="اكتبها تاني"
              type="password"
              autoComplete="new-password"
              value={form.confirm}
              onChange={(e) => setForm({ ...form, confirm: e.target.value })}
              error={errors.confirm}
            />
            <FormError message={errors._} />
            <button className="primary" disabled={change.isPending}>
              حفظ
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
