import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { PageHeader } from "@/components/dashboard/page-header";
import { LifecycleMilestoneEditor } from "@/components/hours/lifecycle-milestone-editor";
import { PhaseBudgetEditor } from "@/components/hours/phase-budget-editor";
import { StatusBadge } from "@/components/ui/status-badge";
import { getHoursBudgetViewModel } from "@/lib/hours-budget-data";
import { formatDateTime, formatHours } from "@/lib/utils";

type HoursBudgetPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function HoursBudgetPage({ searchParams }: HoursBudgetPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const syncCount = getSingleValue(resolvedParams.sync);
  const viewModel = await getHoursBudgetViewModel({ auditId, auditLabel, mode, syncCount });
  const remaining = viewModel.totalPlanned - viewModel.totalActual;

  return (
    <div>
      <PageHeader
        eyebrow="Phase 2"
        title="Hours and budget"
        description={`Budget pacing for ${viewModel.auditLabel}. Budgeted hours remain manager-set in the platform while actual hours are synchronized from the Workday connection.`}
        phaseStatus={{
          label: viewModel.mode === "live" ? "Workday connection on live audit" : "Prototype Workday feed",
          active: true,
        }}
      />

      <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <HoursCard label="Budgeted hours" value={formatHours(viewModel.totalPlanned)} tone="neutral" detail="Set across planning, fieldwork, and reporting" />
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
          label="Remaining capacity"
          value={formatHours(Math.abs(remaining))}
          tone={remaining < 0 ? "risk" : "warning"}
          detail={remaining < 0 ? "Budget already exceeded" : "Capacity remaining before overrun"}
        />
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.1fr_0.9fr]">
        <HoursBarChart
          data={viewModel.phaseBudgets}
          insight="Actual phase totals below are aggregated from synced time entries rather than typed directly into the audit record."
          message={`${viewModel.sourceSummaries.map((summary) => `${summary.source} ${summary.totalHours.toFixed(0)}h`).join(" | ")} | Last synced ${formatDateTime(viewModel.lastSyncedAt)}`}
        />

        <PhaseBudgetEditor
          auditId={viewModel.auditId}
          currentPhase={viewModel.currentPhase}
          mode={viewModel.mode}
          phaseBudgets={viewModel.phaseBudgets}
        />
      </div>

      <div className="mt-6 grid gap-6 2xl:grid-cols-2">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workday team allocation</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Hours by team member</h2>
            </div>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Team-level planned and actual hours are shown as a Workday-synced staffing view for the audit.
            </p>
          </div>
          <div className="mt-4 rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)]">
            Total synced actual hours in this allocation view: {formatHours(viewModel.totalActual)}
          </div>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-4">Workday user</th>
                  <th className="px-4">Role</th>
                  <th className="px-4">Actual</th>
                </tr>
              </thead>
              <tbody>
                {viewModel.hoursByTester.map((tester) => (
                  <tr key={tester.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{tester.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Synced from Workday allocation feed</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{tester.role}</td>
                    <td className="rounded-r-3xl px-4 py-4 text-sm text-[var(--muted)]">{formatHours(tester.actualHours)}</td>
                  </tr>
                ))}
                <tr className="bg-[var(--surface-tint)]">
                  <td className="rounded-l-3xl px-4 py-4 text-sm font-semibold text-[var(--foreground)]">Workday synced total</td>
                  <td className="px-4 py-4 text-sm text-[var(--muted)]">All team members</td>
                  <td className="rounded-r-3xl px-4 py-4 text-sm text-[var(--muted)]">{formatHours(viewModel.totalActual)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <LifecycleMilestoneEditor
          auditId={viewModel.auditId}
          currentPhase={viewModel.currentPhase}
          fieldworkEndDate={viewModel.fieldworkEndDate}
          fieldworkStartDate={viewModel.fieldworkStartDate}
          mode={viewModel.mode}
          periodEnd={viewModel.auditPeriodEnd}
          periodStart={viewModel.auditPeriodStart}
          planningEndDate={viewModel.planningEndDate}
          planningStartDate={viewModel.planningStartDate}
          reportingEndDate={viewModel.reportingEndDate}
          reportingStartDate={viewModel.reportingStartDate}
        />
      </div>

      <div className="mt-6">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workday connector activity</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Synced time entries</h2>
            </div>
            <p className="max-w-sm text-sm text-[var(--muted)]">
              Full Workday feed shown below. Total synced actual hours: {formatHours(viewModel.totalActual)}.
            </p>
          </div>
          <div className="mt-6 max-h-[640px] overflow-auto">
            <div className="grid gap-3">
            {viewModel.timeEntries.map((entry) => (
              <div key={entry.id} className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-[var(--foreground)]">
                      {entry.workItemReference} | {entry.controlId}
                    </p>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {entry.phase} | {entry.source} | {formatHours(entry.hours)}
                    </p>
                  </div>
                  <StatusBadge status={formatDateTime(entry.entryDate)} tone="neutral" />
                </div>
              </div>
            ))}
            </div>
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

function formatSignedHours(value: number) {
  if (value === 0) {
    return "0h";
  }

  return `${value > 0 ? "+" : "-"}${formatHours(Math.abs(value))}`;
}
