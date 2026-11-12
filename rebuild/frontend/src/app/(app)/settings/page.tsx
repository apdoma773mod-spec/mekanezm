'use client';

import { VersionCard } from '@/components/nav-card';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { storeSettings, type StoreSettings } from '@mk/shared';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { BackupCard } from '@/components/backup/backup-card';
import { AutoMessagesCard } from '@/components/auto-messages-card';
import { InstallCard } from '@/components/install-card';
import { useModal } from '@/components/modals/modal-host';
import { Input } from '@/components/ui/field';
import { Tile, TileLink, Tiles } from '@/components/ui/tiles';
import { ErrorBox, FormError, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { serverErrors, validate, type FieldErrors } from '@/lib/form';
import { useLogout, useSaveSetting, useSettings } from '@/lib/queries';

/** Multi-value fields use "/" as the separator, as in the old system. */
const splitPhones = (v: string) =>
  v
    .split(/[\/،,]/)
    .map((p) => p.trim())
    .filter(Boolean);

function CompanyForm({ initial }: { initial: StoreSettings }) {
  const save = useSaveSetting('store');
  const toast = useToast();
  const [f, setF] = useState({ ...initial, phones: initial.phones.join(' / ') });
  const [errors, setErrors] = useState<FieldErrors>({});

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = validate(storeSettings, { ...f, phones: splitPhones(f.phones) });
    if (!v.ok) return setErrors(v.errors);
    setErrors({});
    save.mutate(v.data, {
      onSuccess: (saved) => {
        setF({ ...saved, phones: saved.phones.join(' / ') });
        toast('تم حفظ الإعدادات');
      },
      onError: (err) => setErrors(serverErrors(err)),
    });
  };
  const phoneError = Object.entries(errors).find(([k]) => k.startsWith('phones'))?.[1];

  return (
    <form className="card" onSubmit={submit} noValidate>
      <h3>بيانات الشركة</h3>
      <div className="settings">
        <Input label="اسم الشركة" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
        <Input
          label="رقم واتساب / تليفون المحل"
          hint="لو أكتر من رقم افصل بينهم بـ /"
          placeholder="01xxxxxxxxx"
          dir="ltr"
          inputMode="tel"
          value={f.phones}
          onChange={(e) => setF({ ...f, phones: e.target.value })}
          error={phoneError}
        />
        <Input
          label="عنوان المحل (يظهر في الفاتورة)"
          placeholder="الجيزة - أرض اللواء - شارع ١٠"
          value={f.address}
          onChange={(e) => setF({ ...f, address: e.target.value })}
          error={errors.address}
        />
        <Input
          label="كلام آخر الفاتورة"
          placeholder="شكراً لتعاملكم معنا"
          value={f.invoiceFooter}
          onChange={(e) => setF({ ...f, invoiceFooter: e.target.value })}
          error={errors.invoiceFooter}
        />
        <FormError message={errors._} />
        <button className="primary" disabled={save.isPending}>
          حفظ الإعدادات
        </button>
      </div>
    </form>
  );
}

function SettingsScreen() {
  const settings = useSettings();
  const { open } = useModal();
  const logout = useLogout();
  const router = useRouter();
  if (settings.isPending) return <Loading />;
  if (settings.isError) return <ErrorBox message={errorMessage(settings.error)} onRetry={() => settings.refetch()} />;
  return (
    <>
      <PageHeader
        title="الإدارة والإعدادات"
        subtitle="تحكم كامل في بيانات النظام والمستخدمين"
        action={
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" id="alBtn" className="primary" onClick={() => open({ kind: 'alerts' })}>
              🔔 تنبيهات ضد السرقة
            </button>
            <button type="button" className="primary" onClick={() => open({ kind: 'dayReport' })}>
              📊 تقرير آخر اليوم
            </button>
          </div>
        }
      />
      <Tiles id="settings">
        <Tile icon="🏪" title="بيانات الشركة" sub="الاسم والأرقام والعنوان">
          <CompanyForm initial={settings.data.store} />
        </Tile>
        <Tile icon="🔄" title="تحديث السيستم" sub="النسخة">
          <VersionCard />
        </Tile>
        <TileLink icon="👥" title="المستخدمين والصلاحيات" href="/users" />
        <TileLink icon="📜" title="سجل العمليات" sub="مين عمل إيه" href="/audit" />
        <TileLink icon="🔑" title="حسابي وكلمة السر" href="/account" />
        <TileLink icon="🗂️" title="إعادة تصنيف الأصناف" onClick={() => open({ kind: 'recat' })} />
        <TileLink icon="💬" title="كلمات الواتساب" sub="المفتاحية" href="/keywords" />
        <TileLink icon="🛠️" title="أنظمة الشغل" sub="دلف واستانلس" href="/work" />
        <Tile icon="📲" title="ثبّت السيستم" sub="على الموبايل">
          <InstallCard />
        </Tile>
        <Tile icon="🤖" title="الرسايل التلقائية">
          <AutoMessagesCard />
        </Tile>
        <Tile icon="💾" title="النسخ الاحتياطي">
          <BackupCard />
        </Tile>
        <TileLink icon="🚪" title="تسجيل الخروج" danger onClick={() => logout.mutate(undefined, { onSettled: () => router.replace('/login') })} />
      </Tiles>
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
