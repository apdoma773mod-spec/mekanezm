'use client';

import { useEffect, useState, type FormEvent } from 'react';
import {
  createUserInput,
  resetPasswordInput,
  updateUserInput,
  type PublicUser,
  type Role,
} from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { Pagination } from '@/components/ui/pagination';
import { Sheet } from '@/components/ui/sheet';
import { EmptyState, ErrorState, FormError, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { formatDateTime, ROLE_LABELS } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import {
  useCreateUser,
  useDeactivateUser,
  useMe,
  useResetPassword,
  useUpdateUser,
  useUsers,
} from '@/lib/queries';

const ROLE_OPTIONS = [
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
];

type Mode = { kind: 'create' } | { kind: 'edit'; user: PublicUser } | { kind: 'reset'; user: PublicUser } | null;

function CreateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateUser();
  const toast = useToast();
  const [form, setForm] = useState({ name: '', phone: '', email: '', role: 'STAFF' as Role, password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(createUserInput, form);
    if (!v.ok) return setErrors(v.errors);
    create.mutate(v.data, {
      onSuccess: (u) => {
        toast(`اتضاف ${u.name}`);
        onDone();
      },
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField label="الاسم" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextField label="الموبايل" inputMode="tel" dir="ltr" value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <TextField label="الإيميل (اختياري)" type="email" dir="ltr" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <SelectField label="الصلاحية" options={ROLE_OPTIONS} value={form.role} error={errors.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })} />
      <TextField label="كلمة السر" type="password" autoComplete="new-password" dir="ltr" hint="٨ حروف على الأقل" value={form.password} error={errors.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
      <FormError message={errors._} />
      <Button type="submit" block loading={create.isPending}>
        إضافة
      </Button>
    </form>
  );
}

function EditForm({ user, isSelf, onDone }: { user: PublicUser; isSelf: boolean; onDone: () => void }) {
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();
  const toast = useToast();
  const [form, setForm] = useState({ name: user.name, phone: user.phone, email: user.email ?? '', role: user.role });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmOff, setConfirmOff] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(updateUserInput, form);
    if (!v.ok) return setErrors(v.errors);
    update.mutate(
      { id: user.id, input: v.data },
      {
        onSuccess: () => {
          toast('اتحفظ التعديل');
          onDone();
        },
        onError: (err) => setErrors(serverErrors(err)),
      },
    );
  };

  const toggleActive = () => {
    const done = { onSuccess: onDone, onError: (err: unknown) => setErrors(serverErrors(err)) };
    if (user.active) deactivate.mutate(user.id, done);
    else update.mutate({ id: user.id, input: { active: true } }, done);
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <TextField label="الاسم" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextField label="الموبايل" inputMode="tel" dir="ltr" value={form.phone} error={errors.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
      <TextField label="الإيميل (اختياري)" type="email" dir="ltr" value={form.email} error={errors.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      <SelectField
        label="الصلاحية"
        options={ROLE_OPTIONS}
        value={form.role}
        disabled={isSelf}
        error={errors.role}
        onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
      />
      <FormError message={errors._} />
      <Button type="submit" block loading={update.isPending}>
        حفظ
      </Button>
      {!isSelf &&
        (confirmOff || !user.active ? (
          <Button
            type="button"
            variant={user.active ? 'danger' : 'secondary'}
            block
            loading={deactivate.isPending}
            onClick={toggleActive}
          >
            {user.active ? 'متأكد؟ إيقاف الحساب' : 'تفعيل الحساب تاني'}
          </Button>
        ) : (
          <Button type="button" variant="ghost" block className="text-danger" onClick={() => setConfirmOff(true)}>
            إيقاف الحساب
          </Button>
        ))}
    </form>
  );
}

function ResetForm({ user, onDone }: { user: PublicUser; onDone: () => void }) {
  const reset = useResetPassword();
  const toast = useToast();
  const [newPassword, setNewPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(resetPasswordInput, { newPassword });
    if (!v.ok) return setErrors(v.errors);
    reset.mutate(
      { id: user.id, newPassword: v.data.newPassword },
      {
        onSuccess: () => {
          toast(`اتغيرت كلمة سر ${user.name}`);
          onDone();
        },
        onError: (err) => setErrors(serverErrors(err)),
      },
    );
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-subtle">هيتسجّل خروجه من كل الأجهزة، وتديله كلمة السر الجديدة بنفسك.</p>
      <TextField
        label="كلمة السر الجديدة"
        type="password"
        autoComplete="new-password"
        dir="ltr"
        value={newPassword}
        error={errors.newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
      />
      <FormError message={errors._} />
      <Button type="submit" block loading={reset.isPending}>
        تغيير
      </Button>
    </form>
  );
}

function UsersScreen() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<'' | Role>('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const users = useUsers({ q: search || undefined, role: role || undefined, page, pageSize: 30 });
  const close = () => setMode(null);

  return (
    <>
      <PageHeader title="المستخدمين" subtitle="مين يقدر يدخل السيستم" action={<Button onClick={() => setMode({ kind: 'create' })}>+ مستخدم جديد</Button>} />

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <TextField label="بحث" placeholder="اسم أو موبايل" value={q} onChange={(e) => setQ(e.target.value)} />
        <SelectField
          label="الصلاحية"
          options={[{ value: '', label: 'الكل' }, ...ROLE_OPTIONS]}
          value={role}
          onChange={(e) => {
            setRole(e.target.value as '' | Role);
            setPage(1);
          }}
        />
      </div>

      {users.isPending ? (
        <LoadingState />
      ) : users.isError ? (
        <ErrorState message={errorMessage(users.error)} onRetry={() => users.refetch()} />
      ) : users.data.items.length === 0 ? (
        <EmptyState title="مفيش مستخدمين" hint={search || role ? 'جرّب بحث تاني' : undefined} />
      ) : (
        <>
          <ul className={`grid gap-3 md:grid-cols-2 xl:grid-cols-3 ${users.isFetching ? 'opacity-70' : ''}`}>
            {users.data.items.map((u) => (
              <li key={u.id} className={`rounded-xl border border-border bg-surface p-4 ${u.active ? '' : 'opacity-60'}`}>
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-lg font-bold">{u.name}</p>
                  <span className={`rounded-lg px-2 py-0.5 text-sm font-bold ${u.role === 'ADMIN' ? 'bg-primary/15 text-primary' : 'bg-muted'}`}>
                    {ROLE_LABELS[u.role]}
                  </span>
                </div>
                <p dir="ltr" className="text-end text-subtle">
                  {u.phone}
                </p>
                <p className="text-sm text-subtle">
                  {u.active ? `آخر دخول: ${formatDateTime(u.lastLoginAt)}` : 'موقوف'}
                </p>
                <div className="mt-3 flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setMode({ kind: 'edit', user: u })}>
                    تعديل
                  </Button>
                  <Button variant="secondary" className="flex-1" onClick={() => setMode({ kind: 'reset', user: u })}>
                    كلمة السر
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPage={setPage} />
        </>
      )}

      <Sheet open={mode?.kind === 'create'} title="مستخدم جديد" onClose={close}>
        {mode?.kind === 'create' && <CreateForm onDone={close} />}
      </Sheet>
      <Sheet open={mode?.kind === 'edit'} title="تعديل مستخدم" onClose={close}>
        {mode?.kind === 'edit' && <EditForm key={mode.user.id} user={mode.user} isSelf={mode.user.id === me.data?.id} onDone={close} />}
      </Sheet>
      <Sheet open={mode?.kind === 'reset'} title={mode?.kind === 'reset' ? `كلمة سر ${mode.user.name}` : ''} onClose={close}>
        {mode?.kind === 'reset' && <ResetForm user={mode.user} onDone={close} />}
      </Sheet>
    </>
  );
}

export default function UsersPage() {
  return (
    <AdminOnly>
      <UsersScreen />
    </AdminOnly>
  );
}
