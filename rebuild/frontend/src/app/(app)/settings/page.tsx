'use client';

import { useState, type FormEvent } from 'react';
import { storeSettings, themeSettings, type StoreSettings, type ThemeSettings } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { Button } from '@/components/ui/button';
import { SelectField, TextField } from '@/components/ui/field';
import { ErrorState, FormError, LoadingState } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useSaveSetting, useSettings } from '@/lib/queries';

/** Multi-value fields use "/" as the separator, the same as the old system. */
const splitPhones = (v: string) =>
  v
    .split(/[\/،,]/)
    .map((p) => p.trim())
    .filter(Boolean);

function phonesError(errors: FieldErrors): string | undefined {
  const key = Object.keys(errors).find((k) => k.startsWith('phones'));
  return key ? errors[key] : undefined;
}

function StoreForm({ initial }: { initial: StoreSettings }) {
  const save = useSaveSetting('store');
  const toast = useToast();
  const [form, setForm] = useState({ ...initial, phones: initial.phones.join(' / ') });
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(storeSettings, { ...form, phones: splitPhones(form.phones) });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data, {
      onSuccess: (saved) => {
        setForm({ ...saved, phones: saved.phones.join(' / ') });
        toast('اتحفظت بيانات المحل');
      },
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">بيانات المحل</h2>
      <TextField label="اسم المحل" value={form.name} error={errors.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <TextField
        label="التليفونات"
        hint="افصل بين الأرقام بـ /"
        inputMode="tel"
        dir="ltr"
        value={form.phones}
        error={phonesError(errors)}
        onChange={(e) => setForm({ ...form, phones: e.target.value })}
      />
      <TextField label="العنوان" value={form.address} error={errors.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      <TextField
        label="كلام آخر الفاتورة"
        value={form.invoiceFooter}
        error={errors.invoiceFooter}
        onChange={(e) => setForm({ ...form, invoiceFooter: e.target.value })}
      />
      <FormError message={errors._} />
      <Button type="submit" block loading={save.isPending}>
        حفظ
      </Button>
    </form>
  );
}

function ThemeForm({ initial }: { initial: ThemeSettings }) {
  const save = useSaveSetting('theme');
  const toast = useToast();
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(themeSettings, form);
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data, {
      onSuccess: () => toast('اتحفظ المظهر'),
      onError: (err) => setErrors(serverErrors(err)),
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4 rounded-xl border border-border bg-surface p-5">
      <h2 className="text-lg font-bold">المظهر</h2>
      <div className="space-y-1.5">
        <label htmlFor="primary" className="block text-sm font-bold">
          اللون الأساسي
        </label>
        <div className="flex items-center gap-3">
          <input
            id="primary"
            type="color"
            value={form.primary}
            onChange={(e) => setForm({ ...form, primary: e.target.value })}
            className="h-12 w-16 cursor-pointer rounded-xl border border-border bg-surface"
          />
          <span dir="ltr" className="font-bold">
            {form.primary}
          </span>
        </div>
        {errors.primary && <p className="text-sm text-danger">{errors.primary}</p>}
      </div>
      <SelectField
        label="الوضع"
        options={[
          { value: 'system', label: 'زي الموبايل' },
          { value: 'light', label: 'فاتح' },
          { value: 'dark', label: 'غامق' },
        ]}
        value={form.mode}
        error={errors.mode}
        onChange={(e) => setForm({ ...form, mode: e.target.value as ThemeSettings['mode'] })}
      />
      <FormError message={errors._} />
      <Button type="submit" block loading={save.isPending}>
        حفظ
      </Button>
    </form>
  );
}

function SettingsScreen() {
  const settings = useSettings();
  if (settings.isPending) return <LoadingState />;
  if (settings.isError) return <ErrorState message={errorMessage(settings.error)} onRetry={() => settings.refetch()} />;
  return (
    <>
      <PageHeader title="الإعدادات" />
      <div className="grid max-w-4xl gap-4 lg:grid-cols-2">
        <StoreForm initial={settings.data.store} />
        <ThemeForm initial={settings.data.theme} />
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <AdminOnly>
      <SettingsScreen />
    </AdminOnly>
  );
}
