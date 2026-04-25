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
    <section className="rounded-[28px] bg-[var(--brand-indigo-dark)] p-6 text-white shadow-panel">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-on-dark)]">{eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold">{title}</h2>
        </div>
        <span className="rounded-full border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
          {alerts.length} {badgeLabel}
        </span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        {alerts.map((alert) => {
          const Icon = iconMap[alert.area];

          return (
            <article
              key={alert.id}
              className="rounded-[24px] border border-white/10 bg-white/5 p-4 transition-colors hover:bg-white/[0.08]"
            >
              <div className="flex items-start gap-3">
                <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-core)]">
                  <Icon size={18} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted-on-dark)]">
                      {alert.area}
                    </span>
                    <span className="rounded-full bg-[rgba(229,55,107,0.15)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#ff8da7]">
                      {alert.trigger}
                    </span>
                  </div>
                  <h3 className="mt-3 text-base font-semibold">{alert.title}</h3>
                  <p className="mt-1 text-sm text-[var(--muted-on-dark)]">Owner: {alert.owner}</p>
                  {alert.dueDate ? (
                    <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted-on-dark)]">
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
