import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { AuditHoursPlanner } from "@/components/hours/audit-hours-planner";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { getHoursBudgetViewModel } from "@/lib/hours-budget-data";
import { formatDateTime, formatHours } from "@/lib/utils";
import type { AuditPhase } from "@/types/audit";

type HoursBudgetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HoursBudgetPage({ searchParams }: HoursBudgetPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const syncCount = getSingleValue(resolvedParams.sync);
  const viewModel = await getHoursBudgetViewModel({ auditId, auditLabel, mode, phaseOverride, syncCount });
  const trackedCapacity = viewModel.totalBudgetHours ?? viewModel.totalPlanned;
  const remaining = trackedCapacity - viewModel.totalActual;

  return (
    <div>
      <PageHeader
        eyebrow="Phase 2"
        title="Hours and budget"
        scopePeriodLabel={viewModel.auditPeriodLabel}
        description={`Budget pacing for ${viewModel.auditLabel}. Budgeted hours are managed in the platform and actual hours reflect the audit's recorded totals.`}
        phaseStatus={{
          label: `${viewModel.currentPhase} phase · ${viewModel.mode === "live" ? "Live audit budget tracking" : "Prototype budget view"}`,
          active: true,
        }}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HoursCard label="Phase planned hours" value={formatHours(viewModel.totalPlanned)} tone="neutral" detail="Saved across planning, fieldwork, and reporting" />
        <HoursCard
          label="Actual hours"
          value={formatHours(viewModel.totalActual)}
          tone={viewModel.currentPhaseVariance > 0 ? "risk" : "success"}
          detail={`Recorded in ${viewModel.currentPhase.toLowerCase()} so far`}
        />
        <HoursCard
          label={`${viewModel.currentPhase} variance`}
          value={formatSignedHours(viewModel.currentPhaseVariance)}
          tone={viewModel.currentPhaseVariance > 0 ? "risk" : "success"}
          detail={
            viewModel.currentPhaseVariance > 0
              ? `${viewModel.currentPhase} is trending over plan`
              : `${viewModel.currentPhase} is within plan`
          }
        />
        <HoursCard
          label="Remaining audit hours"
          value={formatHours(Math.abs(remaining))}
          tone={remaining < 0 ? "risk" : "warning"}
          detail={
            viewModel.totalBudgetHours === null
              ? remaining < 0
                ? "Recorded actuals are above the currently planned phase hours."
                : "Remaining against the currently saved phase plan."
              : remaining < 0
                ? `Audit total of ${formatHours(viewModel.totalBudgetHours)} has been exceeded.`
                : `${formatHours(viewModel.totalBudgetHours)} total audit hours with ${formatHours(Math.abs(remaining))} remaining.`
          }
        />
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <HoursBarChart
          data={viewModel.phaseBudgets}
          insight="Actual phase totals below reflect the recorded control-level actual hours currently saved for the audit."
          message={`Actuals source: recorded audit hours | Last refreshed ${formatDateTime(viewModel.lastSyncedAt)}`}
        />

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
      </div>

      <div className="mt-6">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Audit staffing</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Recorded hours by owner</h2>
            </div>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Team-level actual hours below are derived from the current control assignments and saved control-level actuals.
            </p>
          </div>
          <div className="mt-4 rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
            Total recorded actual hours in this staffing view: {formatHours(viewModel.totalActual)}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-4">Audit owner</th>
                  <th className="px-4">Role</th>
                  <th className="px-4">Actual</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.hoursByTester.map((tester) => (
                  <tr key={tester.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{tester.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Rolled up from assigned control actuals</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{tester.role}</td>
                    <td className="rounded-r-3xl px-4 py-4 text-sm text-[var(--muted)]">{formatHours(tester.actualHours)}</td>
                  </tr>
                ))}
                <tr className="bg-[var(--surface-tint)]">
                  <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-[var(--foreground)]">Recorded actual total</td>
                  <td className="px-4 py-4 text-sm text-[var(--muted)]">All team members</td>
                  <td className="rounded-r-3xl px-4 py-4 text-sm text-[var(--muted)]">{formatHours(viewModel.totalActual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function HoursCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "warning" | "risk" | "success";
}) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={label} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </article>
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
