'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { createUserInput, resetPasswordInput, updateUserInput, type PublicUser, type Role } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Icon } from '@/components/icon';
import { Input, Select } from '@/components/ui/field';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { FormError, TableState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { formatDateTime, ROLE_LABELS } from '@/lib/format';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useCreateUser, useDeactivateUser, useMe, useResetPassword, useUpdateUser, useUsers } from '@/lib/queries';

const ROLE_OPTIONS = [
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
];

type Mode = { kind: 'create' } | { kind: 'edit'; user: PublicUser } | { kind: 'reset'; user: PublicUser } | null;

function CreateForm({ onDone }: { onDone: () => void }) {
  const create = useCreateUser();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', email: '', role: 'STAFF' as Role, password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(createUserInput, f);
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
    <form onSubmit={submit} noValidate>
      <div className="form">
        <Input label="الاسم" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input label="الموبايل" type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
        <Input label="الإيميل (اختياري)" type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select label="الصلاحية" options={ROLE_OPTIONS} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })} />
        <Input
          label="كلمة السر"
          type="password"
          autoComplete="new-password"
          hint="٨ حروف على الأقل"
          value={f.password}
          onChange={(e) => setF({ ...f, password: e.target.value })}
          error={errors.password}
          full
        />
        <FormError message={errors._} />
      </div>
      <div className="modal-foot">
        <button className="primary" disabled={create.isPending}>
          إضافة
        </button>
        <button type="button" className="secondary" onClick={onDone}>
          إلغاء
        </button>
      </div>
    </form>
  );
}

function EditForm({ user, isSelf, onDone }: { user: PublicUser; isSelf: boolean; onDone: () => void }) {
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();
  const toast = useToast();
  const [f, setF] = useState({ name: user.name, phone: user.phone, email: user.email ?? '', role: user.role });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [confirmOff, setConfirmOff] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(updateUserInput, f);
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
    const cb = { onSuccess: onDone, onError: (err: unknown) => setErrors(serverErrors(err)) };
    if (user.active) deactivate.mutate(user.id, cb);
    else update.mutate({ id: user.id, input: { active: true } }, cb);
  };

  return (
    <form onSubmit={submit} noValidate>
      <div className="form">
        <Input label="الاسم" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input label="الموبايل" type="tel" dir="ltr" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} error={errors.phone} />
        <Input label="الإيميل (اختياري)" type="email" dir="ltr" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} error={errors.email} />
        <Select
          label="الصلاحية"
          options={ROLE_OPTIONS}
          value={f.role}
          disabled={isSelf}
          onChange={(e) => setF({ ...f, role: e.target.value as Role })}
        />
        <FormError message={errors._} />
      </div>
      <div className="modal-foot">
        <button className="primary" disabled={update.isPending}>
          حفظ
        </button>
        {!isSelf &&
          (confirmOff || !user.active ? (
            <button type="button" className="secondary danger" disabled={deactivate.isPending} onClick={toggleActive}>
              {user.active ? 'متأكد؟ إيقاف الحساب' : 'تفعيل الحساب تاني'}
            </button>
          ) : (
            <button type="button" className="secondary danger" onClick={() => setConfirmOff(true)}>
              إيقاف الحساب
            </button>
          ))}
        <button type="button" className="secondary" onClick={onDone}>
          إلغاء
        </button>
      </div>
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
    <form onSubmit={submit} noValidate>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>هيتسجّل خروجه من كل الأجهزة، وإنت تديله كلمة السر الجديدة.</p>
      <div className="form">
        <Input
          label="كلمة السر الجديدة"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          full
        />
        <FormError message={errors._} />
      </div>
      <div className="modal-foot">
        <button className="primary" disabled={reset.isPending}>
          تغيير
        </button>
      </div>
    </form>
  );
}

function UsersScreen() {
  const me = useMe();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [mode, setMode] = useState<Mode>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const users = useUsers({ q: search || undefined, page, pageSize: 50 });
  const items = users.data?.items ?? [];
  const done = () => setMode(null);

  return (
    <>
      <PageHeader
        title="المستخدمين"
        subtitle="مين يقدر يدخل السيستم وصلاحيته"
        action={
          <button type="button" className="primary" onClick={() => setMode({ kind: 'create' })}>
            <Icon name="plus" /> مستخدم جديد
          </button>
        }
      />
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو الموبايل..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>الاسم</th>
                <th>الموبايل</th>
                <th>الصلاحية</th>
                <th>آخر دخول</th>
                <th>الحالة</th>
                <th>إجراء</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={6}
                loading={users.isPending}
                error={users.isError ? errorMessage(users.error) : null}
                empty={!items.length}
                onRetry={() => users.refetch()}
              >
                {items.map((u) => (
                  <tr key={u.id} style={{ opacity: u.active ? 1 : 0.6 }}>
                    <td>
                      <b>{u.name}</b>
                    </td>
                    <td dir="ltr" style={{ textAlign: 'right' }}>
                      {u.phone}
                    </td>
                    <td>
                      <span className={`badge ${u.role === 'ADMIN' ? '' : 'green'}`}>{ROLE_LABELS[u.role]}</span>
                    </td>
                    <td>{formatDateTime(u.lastLoginAt)}</td>
                    <td>{u.active ? <span className="badge green">شغال</span> : <span className="badge red">موقوف</span>}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button type="button" className="secondary" onClick={() => setMode({ kind: 'edit', user: u })}>
                        تعديل
                      </button>{' '}
                      <button type="button" className="secondary" onClick={() => setMode({ kind: 'reset', user: u })}>
                        كلمة السر
                      </button>
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {users.data && <Pagination page={users.data.page} pageSize={users.data.pageSize} total={users.data.total} onPage={setPage} />}
      </div>

      {mode?.kind === 'create' && (
        <Modal title="مستخدم جديد" onClose={done}>
          <CreateForm onDone={done} />
        </Modal>
      )}
      {mode?.kind === 'edit' && (
        <Modal title={`تعديل ${mode.user.name}`} onClose={done}>
          <EditForm user={mode.user} isSelf={mode.user.id === me.data?.id} onDone={done} />
        </Modal>
      )}
      {mode?.kind === 'reset' && (
        <Modal title={`كلمة سر ${mode.user.name}`} onClose={done}>
          <ResetForm user={mode.user} onDone={done} />
        </Modal>
      )}
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
