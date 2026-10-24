'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { loginInput } from '@mk/shared';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/field';
import { FormError } from '@/components/ui/states';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useLogin } from '@/lib/queries';

/** Only same-site relative paths are allowed as a post-login destination. */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const loginMutation = useLogin();
  const [form, setForm] = useState({ login: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});

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

  return (
    <form onSubmit={submit} noValidate className="space-y-5">
      <TextField
        label="رقم الموبايل أو الإيميل"
        name="login"
        inputMode="text"
        autoComplete="username"
        dir="ltr"
        value={form.login}
        error={errors.login}
        onChange={(e) => setForm({ ...form, login: e.target.value })}
      />
      <TextField
        label="كلمة السر"
        name="password"
        type="password"
        autoComplete="current-password"
        dir="ltr"
        value={form.password}
        error={errors.password}
        onChange={(e) => setForm({ ...form, password: e.target.value })}
      />
      <FormError message={errors._} />
      <Button type="submit" block loading={loginMutation.isPending}>
        دخول
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-sm">
        <h1 className="mb-1 text-center text-3xl font-bold text-primary">ميكانيزم</h1>
        <p className="mb-6 text-center text-subtle">سجّل دخولك عشان تكمّل</p>
        <Suspense>
          <LoginForm />
        </Suspense>
      </div>
    </main>
  );
}
