'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
import { downloadCsv, generatePassword, passwordStrength, STRENGTH_LABELS } from '@/lib/admin-tools';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useCreateUser, useDeactivateUser, useMe, useResetPassword, useUpdateUser, useUsers } from '@/lib/queries';

const ROLE_OPTIONS = [
  { value: 'STAFF', label: ROLE_LABELS.STAFF },
  { value: 'ADMIN', label: ROLE_LABELS.ADMIN },
];

/** Password field with show/hide, random generator, copy and a strength bar. */
function PasswordTools({
  label,
  value,
  onChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  hint?: string;
}) {
  const toast = useToast();
  const [show, setShow] = useState(false);
  const score = passwordStrength(value);
  return (
    <div style={{ gridColumn: '1 / -1' }}>
      <Input
        label={label}
        type={show ? 'text' : 'password'}
        dir="ltr"
        autoComplete="new-password"
        hint={hint}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        full
      />
      {value && (
        <div style={{ marginTop: 6 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: 5,
                  borderRadius: 3,
                  background: i < score ? ['#d93025', '#e8710a', '#f9ab00', '#1e8e3e'][score - 1] : 'var(--border)',
                }}
              />
            ))}
          </div>
          <small style={{ color: 'var(--muted)' }}>قوة كلمة السر: {STRENGTH_LABELS[score]}</small>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
        <button type="button" className="secondary" onClick={() => setShow(!show)}>
          {show ? 'إخفاء' : 'إظهار'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => {
            onChange(generatePassword());
            setShow(true);
          }}
        >
          🎲 توليد كلمة سر
        </button>
        <button
          type="button"
          className="secondary"
          disabled={!value}
          onClick={() => navigator.clipboard?.writeText(value).then(() => toast('اتنسخت كلمة السر'), () => toast('مقدرتش أنسخ'))}
        >
          📋 نسخ
        </button>
      </div>
    </div>
  );
}

type Mode ={ kind: 'create' } | { kind: 'edit'; user: PublicUser } | { kind: 'reset'; user: PublicUser } | null;

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
        <PasswordTools
          label="كلمة السر"
          hint="٨ حروف على الأقل"
          value={f.password}
          onChange={(v) => setF({ ...f, password: v })}
          error={errors.password}
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
        <PasswordTools label="كلمة السر الجديدة" value={newPassword} onChange={setNewPassword} error={errors.newPassword} />
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
  const [role, setRole] = useState<'' | Role>('');
  const [status, setStatus] = useState<'' | 'on' | 'off'>('');
  const [sort, setSort] = useState<'name' | 'login' | 'role'>('name');

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const users = useUsers({ q: search || undefined, page, pageSize: 200 });
  const all = users.data?.items ?? [];
  const items = useMemo(() => {
    const list = all.filter((u) => (!role || u.role === role) && (!status || (status === 'on') === u.active));
    const t = (d: string | null) => (d ? new Date(d).getTime() : 0);
    return [...list].sort((a, b) =>
      sort === 'login'
        ? t(b.lastLoginAt) - t(a.lastLoginAt)
        : sort === 'role'
          ? a.role.localeCompare(b.role) || a.name.localeCompare(b.name, 'ar')
          : a.name.localeCompare(b.name, 'ar'),
    );
  }, [all, role, status, sort]);
  const stats = {
    total: all.length,
    active: all.filter((u) => u.active).length,
    admins: all.filter((u) => u.role === 'ADMIN').length,
    off: all.filter((u) => !u.active).length,
  };
  const exportCsv = () =>
    downloadCsv('users.csv', [
      ['الاسم', 'الموبايل', 'الإيميل', 'الصلاحية', 'الحالة', 'آخر دخول'],
      ...items.map((u) => [u.name, u.phone, u.email, ROLE_LABELS[u.role], u.active ? 'شغال' : 'موقوف', formatDateTime(u.lastLoginAt)]),
    ]);
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
      <div className="stats" style={{ marginBottom: 14 }}>
        <div className="stat"><small>كل المستخدمين</small><strong>{stats.total}</strong></div>
        <div className="stat"><small>شغالين</small><strong>{stats.active}</strong></div>
        <div className="stat"><small>مديرين</small><strong>{stats.admins}</strong></div>
        <div className="stat"><small>موقوفين</small><strong>{stats.off}</strong></div>
      </div>
      <div className="toolbar">
        <input className="search" placeholder="ابحث بالاسم أو الموبايل..." value={q} onChange={(e) => setQ(e.target.value)} />
        <select className="search" style={{ maxWidth: 150 }} value={role} onChange={(e) => setRole(e.target.value as '' | Role)} aria-label="الصلاحية">
          <option value="">كل الصلاحيات</option>
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="search" style={{ maxWidth: 140 }} value={status} onChange={(e) => setStatus(e.target.value as '' | 'on' | 'off')} aria-label="الحالة">
          <option value="">كل الحالات</option>
          <option value="on">شغال</option>
          <option value="off">موقوف</option>
        </select>
        <select className="search" style={{ maxWidth: 170 }} value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'login' | 'role')} aria-label="ترتيب">
          <option value="name">ترتيب: الاسم</option>
          <option value="login">ترتيب: آخر دخول</option>
          <option value="role">ترتيب: الصلاحية</option>
        </select>
        <button type="button" className="secondary" onClick={exportCsv} disabled={!items.length}>
          ⬇️ تصدير Excel
        </button>
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
                    <td>{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span style={{ color: 'var(--muted)' }}>لسه ما دخلش</span>}</td>
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
