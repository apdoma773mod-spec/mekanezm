'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setupInput } from '@mk/shared';
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

  const message = errors._ ?? errors.name ?? errors.phone ?? errors.email ?? errors.password ?? errors.confirm;

  return (
    <div className="mklogin">
      <div className="mkbox">
        <h2>ميكانيزم</h2>
        <p>أول تشغيل: اعمل حساب المدير بتاعك</p>
        {status.isPending || status.data === false ? (
          <p>⏳</p>
        ) : status.isError ? (
          <div className="mkerr">{errorMessage(status.error)}</div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label htmlFor="sname">اسمك</label>
            <input id="sname" className="rtl" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <label htmlFor="sphone">رقم موبايلك (هتدخل بيه بعد كده)</label>
            <input id="sphone" type="tel" autoComplete="tel" placeholder="01xxxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <label htmlFor="semail">الإيميل (اختياري)</label>
            <input id="semail" type="email" autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <label htmlFor="spass">كلمة السر (٨ حروف على الأقل)</label>
            <input id="spass" type="password" autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <label htmlFor="sconf">اكتبها تاني</label>
            <input id="sconf" type="password" autoComplete="new-password" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} />
            <button disabled={setup.isPending}>{setup.isPending ? '⏳' : 'ابدأ'}</button>
            <div className="mkerr" role="alert">
              {message}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
