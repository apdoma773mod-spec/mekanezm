import type { ButtonHTMLAttributes } from 'react';
import { Spinner } from './states';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-on-primary hover:bg-primary/90',
  secondary: 'bg-muted text-fg hover:bg-border',
  danger: 'bg-danger text-white hover:bg-danger/90',
  ghost: 'bg-transparent text-fg hover:bg-muted',
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
  block?: boolean;
}

export function Button({ variant = 'primary', loading, block, className = '', disabled, children, ...rest }: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-5 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${block ? 'w-full' : ''} ${className}`}
    >
      {loading && <Spinner className="h-5 w-5" />}
      {children}
    </button>
  );
}
