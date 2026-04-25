import { StatusBadge } from "@/components/ui/status-badge";
import { cn, formatShortDate } from "@/lib/utils";
import type { RiskRow } from "@/types/audit";

export function AtRiskTable({
  description,
  rows,
  title = "Where the audit could slip",
}: {
  description: string;
  rows: RiskRow[];
  title?: string;
}) {

  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">At-risk items</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
        </div>
        <p className="max-w-sm text-right text-sm text-[var(--muted)]">{description}</p>
      </div>

      <div className="mt-6 overflow-hidden rounded-[24px] border border-black/5">
        <table className="min-w-full divide-y divide-black/5 text-left">
          <thead className="bg-[rgba(1,30,65,0.04)]">
            <tr className="text-xs uppercase tracking-[0.18em] text-[var(--muted)]">
              <th className="px-5 py-4 font-semibold">Area</th>
              <th className="px-5 py-4 font-semibold">Item</th>
              <th className="px-5 py-4 font-semibold">Owner</th>
              <th className="px-5 py-4 font-semibold">Status</th>
              <th className="px-5 py-4 font-semibold">Due</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white">
            {rows.map((row) => (
              <tr key={row.id} className="transition-colors hover:bg-[rgba(245,168,0,0.06)]">
                <td className="px-5 py-4">
                  <span
                    className={cn(
                      "rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]",
                      row.severity === "risk"
                        ? "bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]"
                        : "bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-dark)]",
                    )}
                  >
                    {row.area}
                  </span>
                </td>
                <td className="max-w-[320px] px-5 py-4 text-sm font-medium text-[var(--foreground)]">{row.title}</td>
                <td className="px-5 py-4 text-sm text-[var(--muted)]">{row.owner}</td>
                <td className="px-5 py-4">
                  <StatusBadge status={row.status} tone={getStatusTone(row.status)} />
                </td>
                <td className="px-5 py-4 text-sm text-[var(--muted)]">{row.dueDate ? formatShortDate(row.dueDate) : "N/A"}</td>
              </tr>
            ))}
          </tbody>
        </table>
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
