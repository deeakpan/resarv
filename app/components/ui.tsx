import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Card({
  title,
  open,
  onToggle,
  actions,
  children,
  compact,
  tabs,
}: {
  title: ReactNode;
  open?: boolean;
  onToggle?: () => void;
  actions?: ReactNode;
  children?: ReactNode;
  compact?: boolean;
  tabs?: ReactNode;
}) {
  const expandable = Boolean(onToggle);
  const isOpen = open ?? true;

  return (
    <section className="relative mt-4 overflow-hidden rounded-[28px] bg-[var(--surface)]">
      <div
        className={`flex flex-wrap items-center justify-between gap-x-3 gap-y-3 ${
          compact ? "px-4 py-3" : "px-4 py-3.5 sm:px-5 sm:py-4"
        }`}
      >
        {expandable ? (
          <button
            type="button"
            onClick={onToggle}
            className="min-w-0 flex-1 basis-[min(100%,12rem)] text-left text-[17px] font-semibold tracking-tight text-white hover:opacity-90 sm:text-[18px]"
          >
            {title}
          </button>
        ) : (
          <h2
            className={`min-w-0 flex-1 basis-[min(100%,12rem)] font-semibold tracking-tight text-white ${
              compact ? "text-[15px]" : "text-[17px] sm:text-[18px]"
            }`}
          >
            {title}
          </h2>
        )}
        {tabs ? (
          <div className="ml-auto w-full sm:w-auto sm:shrink-0">{tabs}</div>
        ) : null}
        {expandable && !tabs ? (
          <button
            type="button"
            onClick={onToggle}
            className="text-sm font-medium text-[var(--muted)]"
          >
            {isOpen ? "Hide" : "Open"}
          </button>
        ) : null}
      </div>
      {isOpen && children ? (
        <div className={compact ? "px-4 pb-4" : "px-4 pb-4 sm:px-5 sm:pb-5"}>
          {children}
        </div>
      ) : null}
      {isOpen && actions ? (
        <div className="flex flex-col gap-2 px-4 pb-4 sm:px-5 sm:pb-5">
          {actions}
        </div>
      ) : null}
    </section>
  );
}

export function Tabs({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex w-full shrink-0 rounded-full bg-[var(--input)] p-1 sm:w-auto">
      {options.map((opt) => {
        const active = opt.id === value;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.id)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[13px] font-semibold transition sm:flex-none sm:px-3.5 ${
              active
                ? "bg-[var(--cta)] text-[var(--cta-text)]"
                : "text-[var(--muted)] hover:text-white"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Black amount field — MAX inside; balance/helper as plain text below. */
export function TokenInput({
  value,
  onChange,
  onMax,
  balanceLabel,
  unit,
  iconSrc,
  error,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  onMax?: () => void;
  balanceLabel?: string;
  unit?: string;
  iconSrc?: string;
  error?: string | null;
  id?: string;
}) {
  const inputId = id ?? "token-amount";
  const errorId = `${inputId}-error`;
  const hasError = Boolean(error);

  return (
    <div className="mb-4">
      <div
        className={`flex items-center gap-2 rounded-2xl bg-[var(--input)] px-3 py-3.5 sm:gap-3 sm:px-4 sm:py-4 ${
          hasError ? "ring-1 ring-red-500/70" : ""
        }`}
      >
        {unit ? (
          <span className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--muted)] sm:text-sm">
            {iconSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={iconSrc}
                alt={`${unit} token`}
                width={20}
                height={20}
                className="h-5 w-5 rounded-full object-cover"
              />
            ) : null}
            {unit}
          </span>
        ) : null}
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          placeholder="0.00"
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          className="min-w-0 flex-1 bg-transparent text-left text-[24px] font-semibold tabular-nums text-white outline-none placeholder:text-[#3a3a3a] sm:text-[28px]"
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (next === "" || /^\d*\.?\d*$/.test(next)) onChange(next);
          }}
        />
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            className="shrink-0 text-[13px] font-semibold text-[var(--muted)] hover:text-white"
          >
            MAX
          </button>
        ) : null}
      </div>
      {balanceLabel ? (
        <p className="mt-2 break-words text-[13px] font-medium text-[var(--muted)]">
          {balanceLabel}
        </p>
      ) : null}
      {hasError ? (
        <p
          id={errorId}
          role="alert"
          className="mt-2 text-[13px] font-medium text-red-400"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}

/** Plain label/value row — not in a container. */
export function SummaryRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 text-[13px] sm:gap-4">
      <span className="shrink-0 font-medium text-[var(--muted)]">{label}</span>
      <span className="min-w-0 break-words text-right font-medium text-white">
        {children}
      </span>
    </div>
  );
}

export function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[13px] font-medium tracking-wide text-[var(--muted)]">
      {children}
    </p>
  );
}

export function Field({
  children,
  helper,
}: {
  children: ReactNode;
  helper?: ReactNode;
}) {
  return (
    <div className="mb-3 rounded-2xl bg-[var(--input)] px-3.5 py-3">
      {children}
      {helper ? (
        <p className="mt-1.5 text-[12px] font-medium text-[var(--muted-2)]">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

export function AmountRow({
  label,
  amount,
  unit,
  editable,
  value,
  onChange,
  onMax,
  helper,
}: {
  label: string;
  amount?: string;
  unit: string;
  editable?: boolean;
  value?: string;
  onChange?: (value: string) => void;
  onMax?: () => void;
  helper?: ReactNode;
}) {
  const display = value ?? amount ?? "";

  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <FieldLabel>{label}</FieldLabel>
        {onMax ? (
          <button
            type="button"
            className="text-[11px] font-semibold text-[var(--cta)] hover:brightness-110"
            onClick={onMax}
          >
            MAX
          </button>
        ) : null}
      </div>
      <Field helper={helper}>
        <div className="flex items-baseline gap-2">
          {editable ? (
            <input
              type="text"
              inputMode="decimal"
              autoComplete="off"
              spellCheck={false}
              placeholder="0.00"
              className="min-w-0 flex-1 bg-transparent text-left text-xl font-semibold tabular-nums text-white outline-none placeholder:text-[#3a3a3a]"
              value={display}
              onChange={(e) => {
                const next = e.target.value;
                if (next === "" || /^\d*\.?\d*$/.test(next)) onChange?.(next);
              }}
            />
          ) : (
            <span className="min-w-0 flex-1 text-left text-xl font-semibold tabular-nums text-white">
              {display}
            </span>
          )}
          <span className="shrink-0 text-sm font-medium text-[var(--muted)]">
            {unit}
          </span>
        </div>
      </Field>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <span
      className={`inline-block h-4 w-4 animate-spin rounded-full border-2 ${
        dark
          ? "border-black/25 border-t-black"
          : "border-white/30 border-t-white"
      }`}
      aria-hidden
    />
  );
}

export function PrimaryButton({
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--cta)] px-7 py-3.5 font-semibold text-[var(--cta-text)] hover:bg-[var(--cta-hover)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Spinner dark /> : null}
      {children}
    </button>
  );
}

export function OutlineButton({
  children,
  loading,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--input)] px-7 py-3.5 font-semibold text-white hover:bg-[#111] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}
