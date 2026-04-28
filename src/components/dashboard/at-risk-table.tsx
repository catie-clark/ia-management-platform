import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatShortDate } from "@/lib/utils";
import type { RiskRow } from "@/types/audit";

export function AtRiskTable({
  description,
  bodyHeightClassName,
  compact = false,
  rows,
  title = "Where the audit could slip",
}: {
  description: string;
  bodyHeightClassName?: string;
  compact?: boolean;
  rows: RiskRow[];
  title?: string;
}) {
  const columnClassNames = {
    area: compact ? "w-[90px]" : "w-[110px]",
    item: compact ? "w-[42%]" : "w-[40%]",
    owner: compact ? "w-[22%]" : "w-[20%]",
    status: compact ? "w-[130px]" : "w-[150px]",
    due: compact ? "w-[90px]" : "w-[110px]",
  };

  return (
    <section className={`rounded-[20px] border border-black/5 bg-white shadow-[0_16px_36px_rgba(1,30,65,0.07)] ${compact ? "px-4 py-4" : "px-5 py-4"}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className={`font-semibold uppercase text-[var(--muted)] ${compact ? "text-[11px] tracking-[0.18em]" : "text-xs tracking-[0.28em]"}`}>At-risk items</p>
          <h2 className={`font-semibold text-[var(--foreground)] ${compact ? "mt-1.5 text-lg leading-tight" : "mt-2 text-xl"}`}>{title}</h2>
        </div>
        <p className={`max-w-sm text-right text-[var(--muted)] ${compact ? "text-[12px] leading-5" : "text-[13px] leading-5"}`}>{description}</p>
      </div>

      <div className="mt-4 overflow-hidden rounded-[16px] border border-black/5">
        <table className="min-w-full table-fixed text-left">
          <colgroup>
            <col className={columnClassNames.area} />
            <col className={columnClassNames.item} />
            <col className={columnClassNames.owner} />
            <col className={columnClassNames.status} />
            <col className={columnClassNames.due} />
          </colgroup>
          <thead className="bg-[rgba(1,30,65,0.04)]">
            <tr className="text-[11px] uppercase tracking-[0.16em] text-[var(--muted)]">
              <th className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} font-semibold`}>Area</th>
              <th className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} font-semibold`}>Item</th>
              <th className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} font-semibold`}>Owner</th>
              <th className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} font-semibold`}>Status</th>
              <th className={`${compact ? "px-3 py-2.5" : "px-4 py-3"} font-semibold`}>Due</th>
            </tr>
          </thead>
        </table>
        <div className={bodyHeightClassName ? `overflow-y-auto ${bodyHeightClassName}` : ""}>
          <table className="min-w-full table-fixed text-left">
            <colgroup>
              <col className={columnClassNames.area} />
              <col className={columnClassNames.item} />
              <col className={columnClassNames.owner} />
              <col className={columnClassNames.status} />
              <col className={columnClassNames.due} />
            </colgroup>
            <tbody className="divide-y divide-black/5 bg-white">
              {rows.map((row) => (
                <tr key={row.id} className="transition-colors hover:bg-[rgba(245,168,0,0.06)]">
                  <td className={compact ? "px-3 py-2.5 align-top" : "px-4 py-3 align-top"}>
                  <span
                    className={cn(
                      `rounded-full font-semibold uppercase tracking-[0.14em] ${compact ? "px-2 py-1 text-[10px]" : "px-2.5 py-1 text-[11px]"}`,
                      row.severity === "risk"
                        ? "bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]"
                        : "bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-dark)]",
                    )}
                  >
                    {row.area}
                  </span>
                  </td>
                  <td className={`font-medium leading-5 text-[var(--foreground)] ${compact ? "px-3 py-2.5 text-[12px]" : "px-4 py-3 text-[13px]"}`}>{row.title}</td>
                  <td className={compact ? "px-3 py-2.5 align-top text-[12px] text-[var(--muted)]" : "px-4 py-3 align-top text-[13px] text-[var(--muted)]"}>{row.owner}</td>
                  <td className={compact ? "px-3 py-2.5 align-top" : "px-4 py-3 align-top"}>
                    <StatusBadge status={row.status} tone={getStatusTone(row.status)} />
                  </td>
                  <td className={compact ? "px-3 py-2.5 align-top text-[12px] text-[var(--muted)]" : "px-4 py-3 align-top text-[13px] text-[var(--muted)]"}>{row.dueDate ? formatShortDate(row.dueDate) : "N/A"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

function getStatusTone(status: string) {
  switch (status) {
    case "COMPLETE":
    case "COMPLETED":
    case "RESPONDED":
    case "APPROVED":
      return "success" as const;
    case "OVERDUE":
    case "BLOCKED":
      return "risk" as const;
    case "IN_PROGRESS":
    case "OPEN":
    case "NOT_STARTED":
    case "NOT_SUBMITTED":
      return "warning" as const;
    default:
      if (status.toLowerCase().includes("pending")) {
        return "warning" as const;
      }

      return "neutral" as const;
  }
}
