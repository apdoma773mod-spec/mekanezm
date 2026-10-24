interface Props {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPage }: Props) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const btn = 'min-h-11 rounded-xl bg-muted px-4 font-bold disabled:opacity-40';
  return (
    <nav aria-label="الصفحات" className="flex items-center justify-center gap-3 pt-4">
      <button className={btn} disabled={page <= 1} onClick={() => onPage(page - 1)}>
        السابق
      </button>
      <span className="text-subtle">
        {page} من {pages}
      </span>
      <button className={btn} disabled={page >= pages} onClick={() => onPage(page + 1)}>
        التالي
      </button>
    </nav>
  );
}
