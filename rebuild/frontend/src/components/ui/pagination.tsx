interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <nav aria-label="الصفحات" className="btnrow" style={{ justifyContent: 'center', alignItems: 'center', marginTop: 14 }}>
      <button type="button" className="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span style={{ color: 'var(--muted)' }}>
        {page} من {pages}
      </span>
      <button type="button" className="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </nav>
  );
}
