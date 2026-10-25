'use client';

import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginInput } from '@mk/shared';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useLogin, useSetupStatus } from '@/lib/queries';

/** Only same-site relative paths are allowed as a post-login destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const loginMutation = useLogin();
  const setupStatus = useSetupStatus();
  const [form, setForm] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (setupStatus.data === true) router.replace('/setup');
  }, [setupStatus.data, router]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(loginInput, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    loginMutation.mutate(v.data, {
      onSuccess: () => router.replace(safeNext(params.get('next'))),
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  const message = errors._ ?? errors.login ?? errors.password;

  return (
    <form onSubmit={submit} noValidate>
      <label htmlFor="login">رقم الموبايل أو الإيميل</label>
      <input
        id="login"
        name="login"
        autoComplete="username"
        inputMode="text"
        placeholder="01xxxxxxxxx"
        value={form.login}
        onChange={(e) => setForm({ ...form, login: e.target.value })}
      />
      <label htmlFor="password">الرقم السري</label>
      <div style={{ position: 'relative' }}>
        <input
          id="password"
          name="password"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={show ? 'اخفي الرقم السري' : 'اظهر الرقم السري'}
          style={{ position: 'absolute', left: 6, top: 6, width: 40, padding: 6, margin: 0, background: 'transparent', color: '#718087' }}
        >
          👁
        </button>
      </div>
      <button disabled={loginMutation.isPending}>{loginMutation.isPending ? '⏳ بيدخل…' : 'دخول'}</button>
      <div className="mkerr" role="alert">
        {message}
      </div>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="mklogin">
      <div className="mkbox">
        <h2>ميكانيزم</h2>
        <p>سجّل دخولك عشان تكمّل</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
