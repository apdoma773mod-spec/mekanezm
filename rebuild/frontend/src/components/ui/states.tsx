import type { ReactNode } from 'react';

export function Loading({ label = '⏳ جاري التحميل…' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>;
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="empty" style={{ color: 'var(--danger)' }}>
      <p style={{ margin: '0 0 10px', fontWeight: 700 }}>{message}</p>
      {onRetry && (
        <button type="button" className="secondary" onClick={onRetry}>
          جرّب تاني
        </button>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="form-error">
      {message}
    </div>
  );
}

/** Table body states in one place: loading, error, empty, or the rows. */
export function TableState({
  cols,
  loading,
  error,
  empty,
  onRetry,
  children,
}: {
  cols: number;
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry?: () => void;
  children: ReactNode;
}) {
  if (loading || error || empty) {
    return (
      <tr>
        <td colSpan={cols}>
          {loading ? <Loading /> : error ? <ErrorBox message={error} onRetry={onRetry} /> : <Empty>لا توجد بيانات.</Empty>}
        </td>
      </tr>
    );
  }
  return <>{children}</>;
}
