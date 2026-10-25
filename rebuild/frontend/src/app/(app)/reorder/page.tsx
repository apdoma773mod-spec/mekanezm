'use client';

import { useMemo, useState } from 'react';
import type { ReorderSuggestion } from '@mk/shared';
import { AdminOnly } from '@/components/app-shell';
import { ErrorBox, Loading } from '@/components/ui/states';
import { useToast } from '@/components/ui/toast';
import { errorMessage } from '@/lib/api';
import { useSettings } from '@/lib/queries';
import { useReorder } from '@/lib/trade-queries';

const num = (n: number) => Number(n || 0).toLocaleString('ar-EG', { maximumFractionDigits: 1 });
function waLink(phone: string, text: string) {
  let d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) d = `20${d.slice(1)}`;
  return `https://wa.me/${d}?text=${encodeURIComponent(text)}`;
}

function CoverTag({ s }: { s: ReorderSuggestion }) {
  if (s.qty <= 0) return <span className="rtag r0">خلصان</span>;
  if (s.cover === null) return <span className="rtag r1">تحت الحد</span>;
  const d = Math.floor(s.cover);
  return <span className={`rtag ${d <= 7 ? 'r0' : 'r1'}`}>يكفي {d <= 0 ? 'أقل من يوم' : `${d} يوم`}</span>;
}

function SupplierCard({ sup, L, shop }: { sup: string; L: ReorderSuggestion[]; shop: string }) {
  const toast = useToast();
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [qty, setQty] = useState<Record<string, string>>({});
  const phone = L[0]?.supplierPhone ?? '';

  const text = () => {
    const lines = L.filter((s) => !off[s.productId]).map((s) => `• ${s.name} — ${Math.max(1, Math.round(Number(qty[s.productId] ?? s.need) || 0))} ${s.unit || 'قطعة'}`);
    if (!lines.length) {
      toast('اختار صنف واحد على الأقل', 'bad');
      return null;
    }
    const who = sup ? ` أستاذ ${sup}` : '';
    return `السلام عليكم${who} 👋\nمعاك ${shop}.\nمحتاجين نطلب الأصناف دي:\n\n${lines.join('\n')}\n\nياريت تأكدلي المتاح والسعر ومعاد التسليم. شكراً 🙏`;
  };

  return (
    <div className="card rosup">
      <h3>
        <span>{sup ? `🏭 ${sup}` : '❔ مورد غير محدد'}</span>
        <small style={{ color: 'var(--muted)' }}>
          {L.length} صنف{sup && !phone ? ' • مفيش رقم للمورد' : ''}
        </small>
      </h3>
      {L.map((s) => (
        <div key={s.productId} className="rorow">
          <input type="checkbox" checked={!off[s.productId]} onChange={(e) => setOff({ ...off, [s.productId]: !e.target.checked })} />
          <div className="nm">
            {s.name}
            <small>
              المتاح {num(s.qty)} {s.unit}
              {s.daily > 0 ? ` • بيتباع ${num(s.daily * 30)} / شهر` : ' • مفيش مبيعات حديثة'} <CoverTag s={s} />
            </small>
          </div>
          <input
            className="q"
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            value={qty[s.productId] ?? String(s.need)}
            onChange={(e) => setQty({ ...qty, [s.productId]: e.target.value })}
          />
        </div>
      ))}
      <div className="btnrow" style={{ marginTop: 10 }}>
        <button
          type="button"
          className="primary"
          onClick={() => {
            const t = text();
            if (t) window.open(waLink(phone, t), '_blank');
          }}
        >
          💬 {sup ? `ابعت لـ ${sup}` : 'ابعت على الواتساب'}
        </button>
        <button
          type="button"
          className="secondary"
          onClick={async () => {
            const t = text();
            if (!t) return;
            try {
              await navigator.clipboard.writeText(t);
              toast('الطلب اتنسخ');
            } catch {
              toast('مقدرتش أنسخ', 'bad');
            }
          }}
        >
          📋 انسخ الطلب
        </button>
      </div>
    </div>
  );
}

function ReorderScreen() {
  const [days, setDays] = useState(30);
  const data = useReorder(days);
  const shop = useSettings().data?.store.name || 'ميكانيزم';
  const groups = useMemo(() => {
    const G = new Map<string, ReorderSuggestion[]>();
    for (const s of data.data ?? []) G.set(s.supplier, [...(G.get(s.supplier) ?? []), s]);
    return [...G.entries()].sort((a, b) => (a[0] === '' ? 1 : 0) - (b[0] === '' ? 1 : 0) || b[1].length - a[1].length);
  }, [data.data]);
  const n = data.data?.length ?? 0;

  return (
    <section id="reorder">
      <div className="title-row">
        <div className="title">
          <h1>📦 اقتراحات الطلب من الموردين</h1>
          <p>الأصناف اللي قربت تخلص حسب سرعة بيعها — جاهزة تتبعت للمورد على الواتساب</p>
        </div>
      </div>
      <div className="toolbar">
        <span style={{ alignSelf: 'center', color: 'var(--muted)' }}>غطّيني لمدة:</span>
        {[15, 30, 45, 60].map((d) => (
          <button key={d} type="button" className={d === days ? 'primary' : 'secondary'} onClick={() => setDays(d)}>
            {d} يوم
          </button>
        ))}
      </div>
      {data.isPending ? (
        <Loading />
      ) : data.isError ? (
        <ErrorBox message={errorMessage(data.error)} onRetry={() => data.refetch()} />
      ) : !n ? (
        <div className="card">
          <div className="empty">مفيش أصناف محتاجة طلب دلوقتي 👌</div>
        </div>
      ) : (
        <>
          <p style={{ margin: '0 0 10px', color: 'var(--muted)' }}>
            {n} صنف محتاج طلب — مترتبين بالأسرع خلوصاً. غيّر الكمية أو شيل علامة الصنف اللي مش عايزه قبل ما تبعت.
          </p>
          {groups.map(([sup, L]) => (
            <SupplierCard key={`${sup}-${days}`} sup={sup} L={L} shop={shop} />
          ))}
        </>
      )}
    </section>
  );
}

export default function ReorderPage() {
  return (
    <AdminOnly>
      <ReorderScreen />
    </AdminOnly>
  );
}
