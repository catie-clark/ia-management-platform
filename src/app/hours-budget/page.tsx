import type { ReactNode } from "react";

import { redirect } from "next/navigation";

import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { AuditHoursPlanner } from "@/components/hours/audit-hours-planner";
import { HoursUploadControls } from "@/components/hours/hours-upload-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import { getHoursBudgetViewModel } from "@/lib/hours-budget-data";
import { formatDateTime, formatHours } from "@/lib/utils";
import type { AuditPhase } from "@/types/audit";

type HoursBudgetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HoursBudgetPage({ searchParams }: HoursBudgetPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = "live" as const;
  const auditId = getSingleValue(resolvedParams.auditId);
  if (!auditId) {
    redirect("/");
  }
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const syncCount = getSingleValue(resolvedParams.sync);
  const viewModel = await getHoursBudgetViewModel({ auditId, auditLabel, mode, phaseOverride, syncCount });
  const trackedCapacity = viewModel.totalBudgetHours ?? viewModel.totalPlanned;
  const remaining = trackedCapacity - viewModel.totalActual;

  return (
    <div>
      <PageHeader
        title="Hours and budget"
        description=""
        phaseStatus={{
          label: `${viewModel.currentPhase} phase - ${viewModel.mode === "live" ? "Live audit budget tracking" : "Prototype budget view"}`,
          active: true,
        }}
        variant="dashboard-compact"
      />

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="contents">
          <SummaryCell label="Phase planned hours" value={formatHours(viewModel.totalPlanned)} detail="Saved across planning, fieldwork and reporting" />
          <SummaryCell
            label="Actual hours"
            value={formatHours(viewModel.totalActual)}
            detail={`Recorded in ${viewModel.currentPhase.toLowerCase()} so far`}
            badge={<StatusBadge status="Actuals" tone={viewModel.currentPhaseVariance > 0 ? "risk" : "success"} />}
          />
          <SummaryCell
            label={`${viewModel.currentPhase} variance`}
            value={formatSignedHours(viewModel.currentPhaseVariance)}
            detail={
              viewModel.currentPhaseVariance > 0
                ? `${viewModel.currentPhase} is trending over plan`
                : `${viewModel.currentPhase} is within plan`
            }
            badge={<StatusBadge status="Variance" tone={viewModel.currentPhaseVariance > 0 ? "risk" : "success"} />}
          />
          <SummaryCell
            label="Remaining audit hours"
            value={formatHours(Math.abs(remaining))}
            detail={
              viewModel.totalBudgetHours === null
                ? remaining < 0
                  ? "Recorded actuals are above the current phase plan."
                  : "Remaining against the currently saved phase plan."
                : remaining < 0
                  ? `Audit total of ${formatHours(viewModel.totalBudgetHours)} has been exceeded.`
                  : `${formatHours(viewModel.totalBudgetHours)} total audit hours with ${formatHours(Math.abs(remaining))} remaining.`
            }
            badge={<StatusBadge status="Capacity" tone={remaining < 0 ? "risk" : "warning"} />}
          />
        </div>
      </section>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <AuditHoursPlanner
          auditId={viewModel.auditId}
          currentPhase={viewModel.currentPhase}
          fieldworkStartDate={viewModel.fieldworkStartDate}
          mode={viewModel.mode}
          phaseBudgets={viewModel.phaseBudgets}
          periodEnd={viewModel.auditPeriodEnd}
          periodStart={viewModel.auditPeriodStart}
          planningStartDate={viewModel.planningStartDate}
          reportingStartDate={viewModel.reportingStartDate}
          totalBudgetHours={viewModel.totalBudgetHours}
        />

        <HoursBarChart
          data={viewModel.phaseBudgets}
          insight={
            viewModel.mode === "live" && viewModel.timeEntries.length > 0
              ? "Actual phase totals reflect the uploaded recorded hour entries currently saved for this audit."
              : "Actual phase totals reflect the current recorded totals available for this audit."
          }
          message={`Actuals source: recorded audit hours | Last refreshed ${formatDateTime(viewModel.lastSyncedAt)}`}
          variant="workspace"
        />
      </div>

      <div className="mt-6">
        <section className="border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="border-b border-black/5 px-5 py-4 sm:px-6">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Hours ledger</p>
                <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Recorded hours by owner</h2>
              </div>
              <div className="flex flex-col items-start gap-3 lg:items-end">
                <p className="max-w-md text-sm leading-6 text-[var(--muted)] lg:text-right">
                  {viewModel.mode === "live"
                    ? "Upload a CSV of recorded hours to replace the audit's saved hour rows and refresh the staffing ledger."
                    : "Prototype mode shows the current sample staffing totals only."}
                </p>
                <HoursUploadControls auditId={viewModel.auditId} mode={viewModel.mode} />
              </div>
            </div>
          </div>

          <div className="border-b border-black/5 bg-[var(--surface-soft)] px-5 py-3 text-sm text-[var(--muted)] sm:px-6">
            Total recorded actual hours in this staffing view: <span className="font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</span>
          </div>

          <div className="overflow-x-auto">
            {viewModel.timeEntries.length > 0 ? (
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <th className="border-b border-black/5 px-5 py-3 sm:px-6">Audit owner</th>
                    <th className="border-b border-black/5 px-5 py-3">Role</th>
                    <th className="border-b border-black/5 px-5 py-3">Phase</th>
                    <th className="border-b border-black/5 px-5 py-3">Date</th>
                    <th className="border-b border-black/5 px-5 py-3">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {viewModel.hoursEntryRows.map((entry, index) => (
                    <tr key={entry.id} className={index % 2 === 0 ? "bg-white" : "bg-[var(--surface-soft)]"}>
                      <td className="border-b border-black/5 px-5 py-4 sm:px-6">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{entry.ownerName}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Uploaded recorded hour entry</p>
                      </td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm text-[var(--muted)]">{entry.ownerRole}</td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm text-[var(--muted)]">{entry.phase}</td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm text-[var(--muted)]">{formatDateTime(entry.entryDate)}</td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm font-medium text-[var(--foreground)]">{formatHours(entry.hours)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-tint)]">
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--foreground)] sm:px-6">Recorded actual total</td>
                    <td className="px-5 py-4 text-sm text-[var(--muted)]">All team members</td>
                    <td className="px-5 py-4 text-sm text-[var(--muted)]">All phases</td>
                    <td className="px-5 py-4 text-sm text-[var(--muted)]">Current audit</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="min-w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
                  <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    <th className="border-b border-black/5 px-5 py-3 sm:px-6">Audit owner</th>
                    <th className="border-b border-black/5 px-5 py-3">Role</th>
                    <th className="border-b border-black/5 px-5 py-3">Actual</th>
                  </tr>
                </thead>
                <tbody>
                  {viewModel.hoursByTester.map((tester, index) => (
                    <tr key={tester.id} className={index % 2 === 0 ? "bg-white" : "bg-[var(--surface-soft)]"}>
                      <td className="border-b border-black/5 px-5 py-4 sm:px-6">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{tester.name}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">
                          {viewModel.mode === "live"
                            ? "Current audit totals without uploaded line-item hours"
                            : "Rolled up from current recorded audit totals"}
                        </p>
                      </td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm text-[var(--muted)]">{tester.role}</td>
                      <td className="border-b border-black/5 px-5 py-4 text-sm font-medium text-[var(--foreground)]">{formatHours(tester.actualHours)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-tint)]">
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--foreground)] sm:px-6">Recorded actual total</td>
                    <td className="px-5 py-4 text-sm text-[var(--muted)]">All team members</td>
                    <td className="px-5 py-4 text-sm font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  detail,
  badge,
}: {
  label: string;
  value: string;
  detail: string;
  badge?: ReactNode;
}) {
  return (
    <div className="border border-black/5 bg-white px-5 py-4 shadow-[0_6px_18px_rgba(1,30,65,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
          <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{value}</p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
        </div>
        {badge}
      </div>
    </div>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPhaseOverride(value?: string): AuditPhase | undefined {
  if (value === "planning" || value === "Planning") {
    return "Planning";
  }

  if (value === "fieldwork" || value === "Fieldwork") {
    return "Fieldwork";
  }

  if (value === "reporting" || value === "Reporting") {
    return "Reporting";
  }

  return undefined;
}

function formatSignedHours(value: number) {
  if (value === 0) {
    return "0h";
  }

  return `${value > 0 ? "+" : "-"}${formatHours(Math.abs(value))}`;
}
