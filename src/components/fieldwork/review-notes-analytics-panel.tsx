"use client";

import { useMemo } from "react";
import { CheckCircle2, ClipboardList, Clock3, TimerReset } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getReviewNoteAnalytics } from "@/lib/review-notes-analytics";
import type { ReviewNote, User } from "@/types/audit";

export function ReviewNotesAnalyticsPanel({ reviewNotes, users }: { reviewNotes: ReviewNote[]; users: User[] }) {
  const analytics = useMemo(() => getReviewNoteAnalytics({ notes: reviewNotes, users }), [reviewNotes, users]);

  if (!analytics.hasData) {
    return (
      <section className="flex h-[360px] flex-col justify-center border border-black/5 bg-white p-6 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Review notes</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">No review notes raised yet</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Reviewers can raise notes inside each workpaper. Once notes are raised and cleared, this view summarizes
          time-to-clear by preparer and overall.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<ClipboardList size={18} />}
          label="Total review notes"
          value={`${analytics.total}`}
          detail={`${analytics.open} open, ${analytics.cleared} cleared, ${analytics.closed} closed.`}
          tone={analytics.open > 0 ? "warning" : "success"}
        />
        <MetricCard
          icon={<TimerReset size={18} />}
          label="Avg time to clear"
          value={analytics.avgClearHours !== null ? formatHours(analytics.avgClearHours) : "—"}
          detail="Average from raised to cleared (the tester's responsiveness)."
          tone="neutral"
        />
        <MetricCard
          icon={<Clock3 size={18} />}
          label="Median / avg to close"
          value={analytics.medianClearHours !== null ? formatHours(analytics.medianClearHours) : "—"}
          detail={
            analytics.avgCloseHours !== null
              ? `Median time-to-clear. Avg cleared → closed ${formatHours(analytics.avgCloseHours)}.`
              : "Median time-to-clear across cleared notes."
          }
          tone="neutral"
        />
        <MetricCard
          icon={<CheckCircle2 size={18} />}
          label="Reopened (churn)"
          value={`${analytics.reopenedNoteCount}`}
          detail={`${analytics.totalReopens} total send-backs across notes that were reopened.`}
          tone={analytics.reopenedNoteCount > 0 ? "warning" : "success"}
        />
      </section>

      <section className="flex h-[420px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
        <div className="border-b border-black/5 px-5 py-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Time to clear by preparer</p>
          <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Review-note workload and clearance speed per tester</h3>
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surface-strong)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              <tr>
                <th className="border-b border-black/5 px-4 py-3">Preparer</th>
                <th className="border-b border-black/5 px-4 py-3">Total</th>
                <th className="border-b border-black/5 px-4 py-3">Open</th>
                <th className="border-b border-black/5 px-4 py-3">Resolved</th>
                <th className="border-b border-black/5 px-4 py-3">Avg time to clear</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byTester.map((tester) => (
                <tr key={tester.key} className="border-b border-black/5">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{tester.name}</p>
                    <p className="text-xs text-[var(--muted)]">{tester.role}</p>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--foreground)]">{tester.total}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={`${tester.open}`} tone={tester.open > 0 ? "warning" : "success"} />
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--foreground)]">{tester.resolved}</td>
                  <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">
                    {tester.avgClearHours !== null ? formatHours(tester.avgClearHours) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  detail,
  icon,
  label,
  tone,
  value,
}: {
  detail: string;
  icon: React.ReactNode;
  label: string;
  tone: "neutral" | "warning" | "risk" | "success";
  value: string;
}) {
  return (
    <article className="border border-black/5 bg-white p-5 shadow-[0_8px_24px_rgba(1,30,65,0.05)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
        <span className="text-[var(--brand-indigo-core)]">{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={label} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function formatHours(hours: number) {
  if (hours < 24) {
    return `${hours.toFixed(1)}h`;
  }
  return `${(hours / 24).toFixed(1)}d`;
}
