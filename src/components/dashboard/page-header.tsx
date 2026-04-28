import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  phaseStatus,
  actions,
  align = "bottom",
  variant = "default",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  phaseStatus?: {
    label: string;
    active: boolean;
  };
  actions?: ReactNode;
  align?: "top" | "bottom";
  variant?: "default" | "dashboard-compact";
}) {
  const isDashboardCompact = variant === "dashboard-compact";

  return (
    <header
      className={`${
        isDashboardCompact ? "mb-5 rounded-[20px] border border-black/5 bg-white px-5 py-4 shadow-[0_14px_34px_rgba(1,30,65,0.06)]" : "mb-8"
      } flex flex-col gap-4 lg:flex-row lg:justify-between ${align === "top" ? "lg:items-start" : "lg:items-end"}`}
    >
      <div>
        {eyebrow ? <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-indigo-core)]">{eyebrow}</p> : null}
        <h1
          className={`font-semibold tracking-tight text-[var(--foreground)] ${
            eyebrow ? (isDashboardCompact ? "mt-2 text-[2rem] leading-tight lg:text-[2.35rem]" : "mt-3 text-4xl") : isDashboardCompact ? "text-[2rem] leading-tight lg:text-[2.35rem]" : "text-4xl"
          }`}
        >
          {title}
        </h1>
      </div>
      <div className={`flex ${isDashboardCompact ? "max-w-[36rem] gap-3" : "max-w-2xl flex-col items-start gap-3 lg:items-end"}`}>
        {isDashboardCompact ? (
          <div className="flex w-full flex-col gap-3 lg:items-end">
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-start lg:justify-end">
              {phaseStatus ? (
                <div
                  className={`inline-flex items-center gap-2 rounded-[14px] border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
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
              {actions ? <div className="flex justify-start lg:justify-end">{actions}</div> : null}
            </div>
            {description ? <p className="text-[13px] leading-5 text-[var(--muted)] lg:text-right">{description}</p> : null}
          </div>
        ) : (
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
        )}
      </div>
    </header>
  );
}
