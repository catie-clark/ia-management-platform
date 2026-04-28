import { AlertTriangle, BellRing, FolderClock, TrendingUp } from "lucide-react";

import { formatShortDate } from "@/lib/utils";
import type { RiskRow } from "@/types/audit";

const iconMap = {
  Control: TrendingUp,
  Question: BellRing,
  Request: AlertTriangle,
  Document: FolderClock,
};

export function AlertsPanel({
  rows,
  badgeLabel = "active items",
  eyebrow = "Priority alerts",
  title = "Attention needed before the next tollgate",
}: {
  rows: RiskRow[];
  badgeLabel?: string;
  eyebrow?: string;
  title?: string;
}) {
  const alerts = rows.slice(0, 4);

  return (
    <section className="rounded-[20px] bg-[var(--brand-indigo-dark)] px-5 py-4 text-white shadow-[0_16px_36px_rgba(1,30,65,0.12)]">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-on-dark)]">{eyebrow}</p>
          <h2 className="mt-2 text-xl font-semibold leading-tight">{title}</h2>
        </div>
        <span className="rounded-[14px] border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">
          {alerts.length} {badgeLabel}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.area];

          return (
            <article
              key={alert.id}
              className="rounded-[16px] border border-white/10 bg-white/5 px-4 py-3 transition-colors hover:bg-white/[0.08]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-[12px] bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-core)]">
                  <Icon size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted-on-dark)]">
                      {alert.area}
                    </span>
                    <span className="rounded-full bg-[rgba(229,55,107,0.15)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#ff8da7]">
                      {alert.trigger}
                    </span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold leading-5">{alert.title}</h3>
                  <p className="mt-1 text-[13px] text-[var(--muted-on-dark)]">Owner: {alert.owner}</p>
                  {alert.dueDate ? (
                    <p className="mt-2 text-[11px] uppercase tracking-[0.14em] text-[var(--muted-on-dark)]">
                      Due {formatShortDate(alert.dueDate)}
                    </p>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
