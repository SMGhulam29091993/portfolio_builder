/**
 * The CMS's small set of accessible building blocks (`cms-panel-shell`; `int-standards.nextjs.md`
 * → Accessibility): every field has a visible label, its error and hint are tied to it with
 * `aria-describedby`, and every control shows a visible focus ring. Styling uses Tailwind's
 * palette classes only — no hex or font literal (`int-standards.nextjs.md` → Styling).
 */
import { forwardRef, useId, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';

const FOCUS = 'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-lime-300';

export interface TextInputProps extends InputHTMLAttributes<HTMLInputElement> {
  readonly label: string;
  readonly error?: string;
  readonly hint?: ReactNode;
}

/** A labelled single-line input with its error and hint. */
export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { label, error, hint, id, className, ...input },
  ref,
) {
  const generated = useId();
  const inputId = id ?? generated;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-neutral-200">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errorId].filter(Boolean).join(' ') || undefined}
        className={`rounded-lg border bg-neutral-900 px-3 py-2 text-neutral-100 placeholder:text-neutral-500 ${
          error ? 'border-red-400' : 'border-neutral-700'
        } ${FOCUS} ${className ?? ''}`}
        {...input}
      />
      {hint ? (
        <p id={hintId} className="text-xs text-neutral-400">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
});

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  readonly variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  readonly busy?: boolean;
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-lime-300 text-neutral-950 hover:bg-lime-200 disabled:bg-neutral-700 disabled:text-neutral-400',
  secondary: 'border border-neutral-600 text-neutral-100 hover:border-neutral-400 disabled:text-neutral-500',
  danger: 'bg-red-500 text-white hover:bg-red-400 disabled:bg-neutral-700',
  ghost: 'text-neutral-300 hover:text-white disabled:text-neutral-600',
};

/** A button; `busy` keeps it disabled and says so to assistive technology. */
export function Button({ variant = 'primary', busy = false, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      disabled={(disabled ?? false) || busy}
      aria-busy={busy || undefined}
      className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${VARIANTS[variant]} ${FOCUS} ${className ?? ''}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** A link styled like a button. */
export function ButtonLink({ href, children, variant = 'secondary' }: { href: string; children: ReactNode; variant?: 'primary' | 'secondary' }) {
  return (
    <a href={href} className={`inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium ${VARIANTS[variant]} ${FOCUS}`}>
      {children}
    </a>
  );
}

/** An error (`role="alert"`, announced at once) or a status note (`role="status"`). */
export function Notice({ tone, children }: { tone: 'error' | 'info' | 'success'; children: ReactNode }) {
  const styles = {
    error: 'border-red-400/50 bg-red-950/40 text-red-200',
    info: 'border-neutral-600 bg-neutral-900 text-neutral-200',
    success: 'border-lime-300/50 bg-lime-950/30 text-lime-100',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>
      {children}
    </div>
  );
}

/** A focusable text link with the CMS focus ring. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className={`text-sm text-lime-300 underline-offset-4 hover:underline ${FOCUS} rounded`}>
      {children}
    </a>
  );
}

export const focusRing = FOCUS;
