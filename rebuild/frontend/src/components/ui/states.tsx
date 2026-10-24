import type { ReactNode } from 'react';

export function Spinner({ className = 'h-8 w-8' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="جاري التحميل"
      className={`inline-block animate-spin rounded-full border-[3px] border-current border-t-transparent ${className}`}
    />
  );
}

export function LoadingState({ label = 'جاري التحميل…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-subtle">
      <Spinner />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-14 text-center">
      <p className="text-lg font-bold">{title}</p>
      {hint && <p className="text-subtle">{hint}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl bg-danger/10 px-4 py-10 text-center text-danger">
      <p className="font-bold">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="min-h-11 rounded-xl bg-danger px-5 font-bold text-white">
          جرّب تاني
        </button>
      )}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm font-bold text-danger">
      {message}
    </p>
  );
}
