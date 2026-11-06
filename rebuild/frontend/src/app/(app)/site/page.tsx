'use client';

import { AdminOnly } from '@/components/app-shell';
import { AdminApp } from '@/site-mgr/admin-app';
import '@/site-mgr/admin.css';

/** 🌐 إدارة الموقع: كل حاجة تخص الموقع في مكان واحد جوه السيستم (المنتجات، الأقسام، الألوان، البنرات، النصوص، الأعمال، الآراء، الفنيين، التوصيل، الاستيراد). */
export default function SitePage() {
  return (
    <AdminOnly>
      <main className="adm">
        <AdminApp />
      </main>
    </AdminOnly>
  );
}
