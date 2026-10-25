import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

interface ShellProps {
  label: ReactNode;
  error?: string;
  hint?: string;
  full?: boolean;
  children: (id: string) => ReactNode;
}

function Shell({ label, error, hint, full, children }: ShellProps) {
  const id = useId();
  return (
    <div className={`field${full ? ' full' : ''}`}>
      <label htmlFor={id}>{label}</label>
      {children(id)}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

type InputProps = InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; error?: string; hint?: string; full?: boolean };

export function Input({ label, error, hint, full, className = '', ...rest }: InputProps) {
  return (
    <Shell label={label} error={error} hint={hint} full={full}>
      {(id) => <input id={id} aria-invalid={!!error} className={`${error ? 'bad ' : ''}${className}`} {...rest} />}
    </Shell>
  );
}

/** Numeric field like the old system: text keyboard with decimal pad, Arabic digits converted while typing. */
export function NumberInput(props: InputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="decimal"
      dir="ltr"
      onChange={(e) => {
        e.target.value = e.target.value
          .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
          .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
          .replace(/[٫,،]/g, '.')
          .replace(/[^0-9.\-]/g, '');
        props.onChange?.(e);
      }}
    />
  );
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
  label: ReactNode;
  error?: string;
  full?: boolean;
  options: { value: string; label: string }[];
};

export function Select({ label, error, full, options, className = '', ...rest }: SelectProps) {
  return (
    <Shell label={label} error={error} full={full}>
      {(id) => (
        <select id={id} aria-invalid={!!error} className={`${error ? 'bad ' : ''}${className}`} {...rest}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}
    </Shell>
  );
}

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & { label: ReactNode; error?: string; full?: boolean };

export function Textarea({ label, error, full, ...rest }: TextareaProps) {
  return (
    <Shell label={label} error={error} full={full}>
      {(id) => <textarea id={id} aria-invalid={!!error} rows={3} {...rest} />}
    </Shell>
  );
}
