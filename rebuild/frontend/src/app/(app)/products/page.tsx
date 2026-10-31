'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { AdminOnly, PageHeader } from '@/components/app-shell';
import { useCompany } from '@/components/company';
import { Icon } from '@/components/icon';
import { useModal } from '@/components/modals/modal-host';
import { Pagination } from '@/components/ui/pagination';
import { TableState } from '@/components/ui/states';
import { errorMessage } from '@/lib/api';
import { money, qtyText } from '@/lib/format';
import { PhotoSearch } from "@/components/modals/photo-search";
import { CameraScanner } from '@/components/scan/camera-scanner';
import { useToast } from '@/components/ui/toast';
import { useIsAdmin } from '@/components/use-role';
import { lookupProduct, useProducts } from '@/lib/trade-queries';

type StockFilter = 'all' | 'low' | 'out';

function ProductsScreen() {
  const { open } = useModal();
  const toast = useToast();
  const isAdmin = useIsAdmin();
  const [scanning, setScanning] = useState(false);
  const [photo, setPhoto] = useState(false);
  const params = useSearchParams();
  const [q, setQ] = useState('');
  const [search, setSearch] = useState('');
  const [stock, setStock] = useState<StockFilter>((params.get('stock') as StockFilter) || 'all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(q.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const { co } = useCompany();
  const products = useProducts({ q: search || undefined, stock, company: co, page, pageSize: 50 });
  const items = products.data?.items ?? [];

  return (
    <>
      <PageHeader
        title="المنتجات والمخزون"
        subtitle="أضف الأصناف وتابع الكميات والأسعار"
        action={
          <div className="btnrow">
            <button type="button" className="secondary" onClick={() => open({ kind: 'gifts' })}>
              🎁 الهدايا
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'oldGoods' })}>
              💰 بضاعة قديمة
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'printProducts', q: search, stock })}>
              🖨️ طباعة
            </button>
            <button type="button" className="secondary" onClick={() => setScanning(true)}>
              📷 بالباركود
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'labels' })}>
              🏷️ ملصقات
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'labels', all: true })}>
              🏷️ ملصقات كل المنتجات
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'bulkPrice' })}>
              💲 أسعار جماعي
            </button>
            <a className="secondary" href="/count" style={{ textDecoration: 'none' }}>
              🧮 جرد
            </a>
            <button type="button" className="secondary" onClick={() => open({ kind: 'importFile' })}>
              <Icon name="file" /> استيراد من ملف
            </button>
            {isAdmin && (
              <button type="button" className="primary" id="spNewBtn" onClick={() => open({ kind: 'siteProduct' })}>
                ➕ منتج جديد على الموقع
              </button>
            )}
            <button type="button" className="primary" onClick={() => open({ kind: 'product' })}>
              <Icon name="plus" /> منتج جديد
            </button>
            <button type="button" className="secondary" onClick={() => open({ kind: 'split' })}>
              🔪 فك لفة / تقسيم
            </button>
          </div>
        }
      />
      <div className="toolbar" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input className="search" style={{ flex: 1, minWidth: 0 }} placeholder="ابحث باسم المنتج أو الكود..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="primary vsbtn" id="vsProdBtn" title="صوّر القطعة يطلعلك الصنف" onClick={() => setPhoto(true)}>
          📷
        </button>
        <button type="button" className="secondary vsbtn" title="مطلوب ومش عندنا" onClick={() => open({ kind: 'wanted' })}>
          🔎
        </button>
        <a className="secondary vsbtn" title="صور الواتساب" href="/transfers" style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center' }}>
          📲
        </a>
        <select
          className="search"
          style={{ maxWidth: 180 }}
          value={stock}
          onChange={(e) => {
            setStock(e.target.value as StockFilter);
            setPage(1);
          }}
        >
          <option value="all">كل المخزون</option>
          <option value="low">منخفض</option>
          <option value="out">نفد</option>
        </select>
      </div>
      {photo && (
        <PhotoSearch
          ctx="prod"
          onClose={() => setPhoto(false)}
          onPick={(pr) => {
            setPhoto(false);
            open({ kind: "product", id: pr.id });
          }}
        />
      )}
      {scanning && (
        <CameraScanner
          title="امسح باركود الصنف"
          onClose={() => setScanning(false)}
          onCode={async (code) => {
            try {
              const p = await lookupProduct(code);
              setTimeout(() => open({ kind: 'product', id: p.id }), 300);
              return p.name;
            } catch {
              if (!isAdmin) {
                toast(`باركود مش متسجل: ${code}`, 'bad');
                return false;
              }
              setTimeout(() => open({ kind: 'linkBarcode', code }), 300);
              return 'جديد';
            }
          }}
        />
      )}
      {products.data && <div className="count-line">{products.data.total.toLocaleString('ar-EG')} صنف</div>}
      <div className="card">
        <div className="table-wrap">
          <table className="table" style={{ opacity: products.isFetching && !products.isPending ? 0.7 : 1 }}>
            <thead>
              <tr>
                <th>الكود</th>
                <th>المنتج</th>
                <th>التصنيف</th>
                <th>الكمية</th>
                <th>سعر الشراء</th>
                <th>سعر البيع</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              <TableState
                cols={7}
                loading={products.isPending}
                error={products.isError ? errorMessage(products.error) : null}
                empty={!items.length}
                onRetry={() => products.refetch()}
              >
                {items.map((p) => (
                  <tr key={p.id} className="prow" onClick={() => open({ kind: 'product', id: p.id })}>
                    <td>{p.code}</td>
                    <td>
                      <span className="pico">
                        <Icon name="box" />
                      </span>
                      <b>{p.name}</b>
                    </td>
                    <td>{p.category}</td>
                    <td>
                      {qtyText(p.qty)} {p.unit}
                    </td>
                    <td>{money(p.cost)}</td>
                    <td>{money(p.price)}</td>
                    <td>
                      {p.qty <= 0 ? (
                        <span className="badge red">نفد</span>
                      ) : p.qty <= p.minQty ? (
                        <span className="badge red">منخفض</span>
                      ) : (
                        <span className="badge green">متوفر</span>
                      )}
                    </td>
                  </tr>
                ))}
              </TableState>
            </tbody>
          </table>
        </div>
        {products.data && (
          <Pagination page={products.data.page} pageSize={products.data.pageSize} total={products.data.total} onPage={setPage} />
        )}
      </div>
    </>
  );
}

export default function ProductsPage() {
  return (
    <AdminOnly>
      <Suspense>
        <ProductsScreen />
      </Suspense>
    </AdminOnly>
  );
}
