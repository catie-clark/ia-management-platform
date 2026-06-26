import { redirect } from "next/navigation";

import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { AuditHoursPlanner } from "@/components/hours/audit-hours-planner";
import { HoursUploadControls } from "@/components/hours/hours-upload-controls";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  WorkspaceHelpButton,
  WorkspaceKpiGrid,
  WorkspacePageHeader,
} from "@/components/workspace/workspace-ui";
import { getHoursBudgetViewModel } from "@/lib/hours-budget-data";
import { cn, formatDateTime, formatHours } from "@/lib/utils";
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
  const currentPhaseBudget = viewModel.phaseBudgets.find((pb) => pb.phase === viewModel.currentPhase);
  const currentPhaseActual = currentPhaseBudget?.actualHours ?? 0;

  const phaseBadge = (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[10px] border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]",
        viewModel.mode === "live"
          ? "border-[rgba(5,171,140,0.2)] bg-[rgba(5,171,140,0.08)] text-[var(--brand-teal-core)]"
          : "border-black/10 bg-[var(--surface-tint)] text-[var(--muted)]",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          viewModel.mode === "live" ? "bg-[var(--brand-teal-core)]" : "bg-[rgba(79,79,79,0.55)]",
        )}
        aria-hidden="true"
      />
      {viewModel.currentPhase} phase
    </span>
  );

  return (
    <div>
      <WorkspacePageHeader
        title="Hours & Budget"
        statusBadge={phaseBadge}
        purposeLine="Budget setup, actuals, and variance tracking for the current audit."
        helpTip="Set phase budgets in the planning workspace. Upload recorded hours to track actuals and variance against plan."
        helpLabel="About hours and budget"
      />

      <WorkspaceKpiGrid
        items={[
          {
            label: "Total audit budget",
            value: viewModel.totalBudgetHours !== null ? formatHours(viewModel.totalBudgetHours) : "Not set",
            status: "normal",
            detail: "Audit-level hour cap",
            helpTip: "The audit-level hour cap set in the phase planner. Phase planned hours should sum to this value.",
          },
          {
            label: "Phase planned hours",
            value: formatHours(viewModel.totalPlanned),
            status:
              viewModel.totalBudgetHours !== null && viewModel.totalPlanned > viewModel.totalBudgetHours
                ? "risk"
                : "normal",
            detail: "Sum across all phases",
          },
          {
            label: `${viewModel.currentPhase} actuals`,
            value: formatHours(currentPhaseActual),
            status: "normal",
            detail: "Logged for current phase",
          },
          {
            label: `${viewModel.currentPhase} variance`,
            value: formatSignedHours(viewModel.currentPhaseVariance),
            status:
              viewModel.currentPhaseVariance > 0
                ? "risk"
                : viewModel.currentPhaseVariance < 0
                  ? "warning"
                  : "normal",
            detail: "Actual minus planned",
            helpTip:
              "Variance is actual hours minus planned hours for the current phase. Positive means over plan.",
          },
          {
            label: "Remaining audit hours",
            value: formatHours(Math.abs(remaining)),
            status: remaining < 0 ? "risk" : "normal",
            detail: remaining < 0 ? "Over budget" : "Available to spend",
            helpTip:
              viewModel.totalBudgetHours === null
                ? "Remaining against the current phase plan total."
                : `Remaining against the total audit budget of ${formatHours(viewModel.totalBudgetHours)}.`,
          },
        ]}
      />

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
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

      {/* Hours ledger */}
      <div className="mt-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Recorded hours by owner</h2>
            <WorkspaceHelpButton
              label="About uploaded actuals"
              tip={
                viewModel.mode === "live"
                  ? "Upload a CSV of recorded hours to replace the audit's saved hour rows and refresh the staffing ledger."
                  : "Prototype mode shows sample staffing totals only."
              }
            />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[12px] text-[var(--muted)]">
              Total recorded:{" "}
              <span className="font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</span>
            </p>
            <HoursUploadControls auditId={viewModel.auditId} mode={viewModel.mode} />
          </div>
        </div>
        <div className="overflow-hidden rounded-[14px] border border-black/6">
          <div className="max-h-[28rem] overflow-auto">
            {viewModel.timeEntries.length > 0 ? (
              <table className="min-w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Audit owner</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Role</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Phase</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Date</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Hours</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {viewModel.hoursEntryRows.map((entry) => (
                    <tr key={entry.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[var(--foreground)]">{entry.ownerName}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">Uploaded recorded hour entry</p>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{entry.ownerRole}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{entry.phase}</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{formatDateTime(entry.entryDate)}</td>
                      <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">{formatHours(entry.hours)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-tint)]">
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Recorded actual total</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">All team members</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">All phases</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">Current audit</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="min-w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Audit owner</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Role</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Actual</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {viewModel.hoursByTester.map((tester) => (
                    <tr key={tester.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[var(--foreground)]">{tester.name}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
                          {viewModel.mode === "live"
                            ? "Current audit totals without uploaded line-item hours"
                            : "Rolled up from current recorded audit totals"}
                        </p>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{tester.role}</td>
                      <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">{formatHours(tester.actualHours)}</td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-tint)]">
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">Recorded actual total</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">All team members</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">{formatHours(viewModel.totalActual)}</td>
                  </tr>
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Control test budgets */}
      {viewModel.controlTestBudgets.hasData ? (
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Budget-to-actual by control test</h2>
              <WorkspaceHelpButton
                label="About control test budget visibility"
                tip="Control test budgets appear when at least one testing matrix sample has a budget hour value assigned. Visibility is limited to matrices with budget data."
              />
            </div>
            <p className="text-[12px] text-[var(--muted)]">
              {formatHours(viewModel.controlTestBudgets.totalActualHours)} logged /{" "}
              {formatHours(viewModel.controlTestBudgets.totalBudgetedHours)} budgeted
            </p>
          </div>
          <div className="overflow-hidden rounded-[14px] border border-black/6">
            <div className="max-h-[28rem] overflow-auto">
              <table className="min-w-full border-collapse text-left text-[13px]">
                <thead>
                  <tr className="bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Control test</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Progress</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Budget</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Actual</th>
                    <th className="sticky top-0 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-black/5 bg-white">
                  {viewModel.controlTestBudgets.rows.map((row) => (
                    <tr key={row.matrixId} className="transition-colors hover:bg-[var(--surface-soft)]">
                      <td className="px-3 py-2.5">
                        <p className="font-medium text-[var(--foreground)]">{row.controlReferenceId}</p>
                        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{row.title}</p>
                      </td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">{row.completed}/{row.samples} samples</td>
                      <td className="px-3 py-2.5 text-[var(--muted)]">
                        {row.budgetedHours !== null ? formatHours(row.budgetedHours) : "—"}
                      </td>
                      <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">{formatHours(row.actualHours)}</td>
                      <td className="px-3 py-2.5">
                        <StatusBadge
                          status={row.varianceHours === null ? "No budget" : formatSignedHours(row.varianceHours)}
                          tone={row.varianceHours === null ? "neutral" : row.varianceHours > 0.05 ? "risk" : "success"}
                        />
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-[var(--surface-tint)]">
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">All control tests</td>
                    <td className="px-3 py-2.5 text-[var(--muted)]">{viewModel.controlTestBudgets.rows.length} tests</td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
                      {formatHours(viewModel.controlTestBudgets.totalBudgetedHours)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
                      {formatHours(viewModel.controlTestBudgets.totalActualHours)}
                    </td>
                    <td className="px-3 py-2.5 font-semibold text-[var(--foreground)]">
                      {formatSignedHours(viewModel.controlTestBudgets.varianceHours)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getPhaseOverride(value?: string): AuditPhase | undefined {
  if (value === "planning" || value === "Planning") return "Planning";
  if (value === "fieldwork" || value === "Fieldwork") return "Fieldwork";
  if (value === "reporting" || value === "Reporting") return "Reporting";
  return undefined;
}

function formatSignedHours(value: number) {
  if (value === 0) return "0h";
  return `${value > 0 ? "+" : "-"}${formatHours(Math.abs(value))}`;
}
