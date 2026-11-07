'use client';

import { AdminOnly, PageHeader } from '@/components/app-shell';
import { CatalogStudio } from '@/components/catalog/studio';

export default function CatalogPage() {
  return (
    <AdminOnly>
      <PageHeader title="📖 إدارة الكتالوج" />
      <CatalogStudio />
    </AdminOnly>
  );
}
