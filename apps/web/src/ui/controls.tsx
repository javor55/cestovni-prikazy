import { useId, type ComponentProps, type ReactNode } from 'react';
import { Link } from 'react-router';

const inputCls =
  'min-h-11 w-full rounded-lg border border-line-strong bg-white px-3 text-base text-ink placeholder:text-subtle disabled:bg-ground aria-[invalid=true]:border-danger';

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  optional?: boolean;
  className?: string;
  children: (id: string, describedBy: string | undefined) => ReactNode;
}

/** Popisek, ovládací prvek, nápověda a chyba – chyba je vždy textem, nejen barvou. */
export function Field({ label, hint, error, optional, className = '', children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold">
        {label}
        {optional && <span className="font-normal text-subtle"> (nepovinné)</span>}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p id={hintId} className="text-[13px] leading-snug text-subtle">
          {hint}
        </p>
      )}
      {error && (
        <p id={errId} className="text-[13px] font-semibold text-danger">
          Chyba: {error}
        </p>
      )}
    </div>
  );
}

type TextProps = Omit<FieldProps, 'children'> & {
  value: string;
  onChange: (v: string) => void;
  type?: string;
  inputMode?: ComponentProps<'input'>['inputMode'];
  placeholder?: string;
  autoComplete?: string;
  min?: string;
  max?: string;
};

export function TextField({ value, onChange, type = 'text', inputMode, placeholder, autoComplete, min, max, ...field }: TextProps) {
  return (
    <Field {...field}>
      {(id, describedBy) => (
        <input
          id={id}
          type={type}
          className={inputCls}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          inputMode={inputMode}
          placeholder={placeholder}
          autoComplete={autoComplete ?? 'off'}
          min={min}
          max={max}
          aria-describedby={describedBy}
          aria-invalid={field.error ? true : undefined}
        />
      )}
    </Field>
  );
}

/** Částka nebo jiné desetinné číslo – na mobilu otevře číselnou klávesnici. */
export const NumberField = (p: Omit<TextProps, 'inputMode' | 'type'>) => <TextField {...p} inputMode="decimal" />;

export function SelectField<T extends string>({
  value,
  onChange,
  options,
  ...field
}: Omit<FieldProps, 'children'> & { value: T; onChange: (v: T) => void; options: readonly (readonly [T, string])[] }) {
  return (
    <Field {...field}>
      {(id, describedBy) => (
        <select id={id} className={inputCls} value={value} onChange={(e) => onChange(e.target.value as T)} aria-describedby={describedBy}>
          {options.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

export function TextArea({ value, onChange, ...field }: Omit<FieldProps, 'children'> & { value: string; onChange: (v: string) => void }) {
  return (
    <Field {...field}>
      {(id, describedBy) => (
        <textarea id={id} rows={3} className={`${inputCls} py-2`} value={value} onChange={(e) => onChange(e.target.value)} aria-describedby={describedBy} />
      )}
    </Field>
  );
}

export function Checkbox({ checked, onChange, children }: { checked: boolean; onChange: (v: boolean) => void; children: ReactNode }) {
  return (
    <label className="flex min-h-11 cursor-pointer items-start gap-3 py-2 text-[15px]">
      <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-accent" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

export function RadioCards<T extends string>({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: T;
  onChange: (v: T) => void;
  options: { value: T; title: string; hint?: string }[];
}) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      {options.map((o) => (
        <label key={o.value} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line-strong bg-white p-3 has-checked:border-accent has-checked:bg-accent-soft">
          <input type="radio" name={name} className="mt-0.5 size-5 shrink-0 accent-accent" checked={value === o.value} onChange={() => onChange(o.value)} />
          <span className="flex flex-col gap-0.5">
            <strong className="text-[15px]">{o.title}</strong>
            {o.hint && <span className="text-[13px] leading-snug text-subtle">{o.hint}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

const btnBase = 'inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 text-base font-semibold no-underline transition-colors';
export const btn = {
  primary: `${btnBase} bg-accent text-white hover:bg-accent-dark`,
  secondary: `${btnBase} border border-line-strong bg-white text-ink hover:bg-ground`,
  danger: `${btnBase} border border-danger-line bg-white text-danger hover:bg-danger-soft`,
  dangerSolid: `${btnBase} bg-danger text-white hover:opacity-90`,
  small: 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-accent hover:bg-accent-soft',
};

export function Button({ variant = 'primary', className = '', ...p }: ComponentProps<'button'> & { variant?: keyof typeof btn }) {
  return <button type="button" className={`${btn[variant]} ${className}`} {...p} />;
}

export function LinkButton({ variant = 'primary', className = '', ...p }: ComponentProps<typeof Link> & { variant?: keyof typeof btn }) {
  return <Link className={`${btn[variant]} ${className}`} {...p} />;
}

export function Card({ className = '', ...p }: ComponentProps<'section'>) {
  return <section className={`flex flex-col gap-4 rounded-2xl border border-line bg-white p-4 ${className}`} {...p} />;
}

export function H2({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-bold">{children}</h2>;
}

export function Notice({ tone = 'info', title, children }: { tone?: 'info' | 'warn' | 'danger'; title?: string; children: ReactNode }) {
  const cls = {
    info: 'border-accent-line bg-accent-soft text-ink',
    warn: 'border-warn-line bg-warn-soft text-warn',
    danger: 'border-danger-line bg-danger-soft text-danger',
  }[tone];
  return (
    <div className={`flex flex-col gap-1 rounded-xl border p-3 text-sm leading-relaxed ${cls}`}>
      {title && <strong>{title}</strong>}
      <div>{children}</div>
    </div>
  );
}

export function Icon({ d, className = 'size-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

export const icons = {
  back: 'M15 18l-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  lock: 'M7 11V7a5 5 0 0 1 10 0v4M5 11h14v10H5z',
  warn: 'M12 3l10 18H2L12 3zM12 10v4M12 17.5v.5',
  check: 'M5 12l5 5 9-10',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 11v6M12 7.5v.5',
  error: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM15 9l-6 6M9 9l6 6',
  doc: 'M6 3h9l4 4v14H6zM9 9h6M9 13h6M9 17h4',
  upload: 'M12 15V3M7 8l5-5 5 5M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp: 'M6 15l6-6 6 6',
  download: 'M12 3v12M7 10l5 5 5-5M4 19h16',
};
