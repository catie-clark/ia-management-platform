import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  scopePeriodLabel,
  phaseStatus,
  actions,
  align = "bottom",
}: {
  eyebrow: string;
  title: string;
  description: string;
  scopePeriodLabel?: string;
  phaseStatus?: {
    label: string;
    active: boolean;
  };
  actions?: ReactNode;
  align?: "top" | "bottom";
}) {
  return (
    <header className={`mb-8 flex flex-col gap-4 lg:flex-row lg:justify-between ${align === "top" ? "lg:items-start" : "lg:items-end"}`}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-indigo-core)]">{eyebrow}</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{title}</h1>
        {scopePeriodLabel ? (
          <p className="mt-3 text-sm font-medium text-[var(--muted)]">
            Scope period: <span className="text-[var(--foreground)]">{scopePeriodLabel}</span>
          </p>
        ) : null}
      </div>
      <div className="flex max-w-2xl flex-col items-start gap-3 lg:items-end">
        {actions ? <div className="flex w-full justify-start lg:justify-end">{actions}</div> : null}
        {phaseStatus ? (
          <div
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] ${
              phaseStatus.active
                ? "border-[rgba(5,171,140,0.2)] bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]"
                : "border-black/10 bg-[var(--surface-tint)] text-[var(--muted)]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                phaseStatus.active ? "bg-[var(--brand-teal-core)]" : "bg-[rgba(79,79,79,0.55)]"
              }`}
              aria-hidden="true"
            />
            {phaseStatus.label}
          </div>
        ) : null}
        {description ? <p className="text-sm leading-6 text-[var(--muted)] lg:text-right">{description}</p> : null}
      </div>
    </header>
  );
}
