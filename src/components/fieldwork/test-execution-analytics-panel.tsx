"use client";

import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Clock, GaugeCircle, ListChecks, Timer } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { getTestExecutionAnalytics } from "@/lib/test-execution-analytics";
import type { Control, ControlTestingMatrix, User } from "@/types/audit";

export function TestExecutionAnalyticsPanel({
  controls,
  testingMatrices,
  users,
}: {
  controls: Control[];
  testingMatrices: ControlTestingMatrix[];
  users: User[];
}) {
  const analytics = useMemo(
    () => getTestExecutionAnalytics({ controls, matrices: testingMatrices, users }),
    [controls, testingMatrices, users],
  );

  if (!analytics.hasData) {
    return (
      <section className="flex h-[360px] flex-col justify-center border border-black/5 bg-white p-6 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Test execution analytics</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">No test execution timing recorded yet</h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          Timing is captured automatically as testers record PASS/FAIL results in the testing matrices. Once sample testing
          begins, this view summarizes cycle time, logged effort, and throughput by tester and overall.
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<ListChecks size={18} />}
          label="Samples completed"
          value={`${analytics.completedSamples}/${analytics.totalSamples}`}
          detail={`${Math.round(analytics.completionRate * 100)}% of sample items fully tested.`}
          tone={analytics.completionRate >= 0.75 ? "success" : analytics.completionRate >= 0.4 ? "warning" : "risk"}
        />
        <MetricCard
          icon={<Timer size={18} />}
          label="Avg cycle time"
          value={analytics.avgCycleHours !== null ? `${analytics.avgCycleHours.toFixed(1)}h` : "—"}
          detail="Average elapsed time from first result to completion per sample."
          tone="neutral"
        />
        <MetricCard
          icon={<Clock size={18} />}
          label="Logged effort"
          value={`${analytics.loggedHours.toFixed(1)}h`}
          detail="Total tester-entered minutes across all sample items."
          tone="neutral"
        />
        <MetricCard
          icon={<GaugeCircle size={18} />}
          label="Avg effort / test"
          value={analytics.avgLoggedMinutes !== null ? `${analytics.avgLoggedMinutes}m` : "—"}
          detail="Average logged minutes per sample item with recorded effort."
          tone="neutral"
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <div className="flex h-[340px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="border-b border-black/5 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">By tester</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cycle time and effort</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surface-strong)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th className="border-b border-black/5 px-4 py-3">Tester</th>
                  <th className="border-b border-black/5 px-4 py-3">Completed</th>
                  <th className="border-b border-black/5 px-4 py-3">Avg cycle</th>
                  <th className="border-b border-black/5 px-4 py-3">Effort</th>
                </tr>
              </thead>
              <tbody>
                {analytics.testers.map((tester) => (
                  <tr key={tester.userId} className="border-b border-black/5">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{tester.name}</p>
                      <p className="text-xs text-[var(--muted)]">{tester.role}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                      {tester.samplesCompleted}/{tester.samplesStarted}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                      {tester.avgCycleHours !== null ? `${tester.avgCycleHours.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                      {tester.loggedMinutes > 0 ? `${(tester.loggedMinutes / 60).toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex h-[340px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="border-b border-black/5 px-5 py-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">By control test</p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Progress and cycle time</h3>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surface-strong)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th className="border-b border-black/5 px-4 py-3">Control</th>
                  <th className="border-b border-black/5 px-4 py-3">Completed</th>
                  <th className="border-b border-black/5 px-4 py-3">Avg cycle</th>
                  <th className="border-b border-black/5 px-4 py-3">Effort</th>
                </tr>
              </thead>
              <tbody>
                {analytics.controls.map((control) => (
                  <tr key={control.controlId} className="border-b border-black/5">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{control.referenceId}</p>
                      <p className="text-xs text-[var(--muted)]">{control.name}</p>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={`${control.completed}/${control.samples}`}
                        tone={control.completed === control.samples ? "success" : control.started > 0 ? "warning" : "neutral"}
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                      {control.avgCycleHours !== null ? `${control.avgCycleHours.toFixed(1)}h` : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">
                      {control.loggedMinutes > 0 ? `${(control.loggedMinutes / 60).toFixed(1)}h` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {analytics.testBudgets.hasData ? (
        <section className="flex h-[380px] min-h-0 flex-col overflow-hidden border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-black/5 px-5 py-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Budget vs actual by control test</p>
              <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Per-test budgeted hours against logged effort</h3>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {analytics.testBudgets.totalActualHours.toFixed(1)}h logged / {analytics.testBudgets.totalBudgetedHours.toFixed(1)}h budgeted
              </p>
              <p className={`text-xs font-semibold ${varianceTone(analytics.testBudgets.varianceHours)}`}>{varianceLabel(analytics.testBudgets.varianceHours)}</p>
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="min-w-full border-collapse">
              <thead className="sticky top-0 z-10 bg-[var(--surface-strong)] text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                <tr>
                  <th className="border-b border-black/5 px-4 py-3">Control test</th>
                  <th className="border-b border-black/5 px-4 py-3">Progress</th>
                  <th className="border-b border-black/5 px-4 py-3">Budget</th>
                  <th className="border-b border-black/5 px-4 py-3">Actual</th>
                  <th className="border-b border-black/5 px-4 py-3">Variance</th>
                </tr>
              </thead>
              <tbody>
                {analytics.testBudgets.rows.map((row) => (
                  <tr key={row.matrixId} className="border-b border-black/5">
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{row.controlReferenceId}</p>
                      <p className="text-xs text-[var(--muted)]">{row.title}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.completed}/{row.samples}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.budgetedHours !== null ? `${row.budgetedHours.toFixed(1)}h` : "—"}</td>
                    <td className="px-4 py-3 text-sm text-[var(--foreground)]">{row.actualHours.toFixed(1)}h</td>
                    <td className={`px-4 py-3 text-sm font-semibold ${varianceTone(row.varianceHours)}`}>{varianceLabel(row.varianceHours)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {analytics.timeline.length > 0 ? (
        <section className="flex h-[340px] min-h-0 flex-col border border-black/5 bg-white px-5 py-5 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
          <div className="shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Completion timeline</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Sample items completed per day</h2>
          </div>
          <div className="mt-4 min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.timeline} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: "var(--chart-axis)", fontSize: 12 }} />
                <Tooltip
                  cursor={{ fill: "rgba(245,168,0,0.08)" }}
                  formatter={(value: number) => [value, "Completed"]}
                  contentStyle={{
                    borderRadius: 10,
                    border: "1px solid var(--chart-tooltip-border)",
                    background: "var(--chart-tooltip-bg)",
                    boxShadow: "0 18px 44px rgba(1,30,65,0.12)",
                  }}
                />
                <Bar dataKey="completed" radius={[6, 6, 0, 0]} fill="var(--chart-actual)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      ) : null}
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

function varianceLabel(variance: number | null) {
  if (variance === null) {
    return "No budget";
  }

  if (variance > 0.05) {
    return `${variance.toFixed(1)}h over`;
  }

  if (variance < -0.05) {
    return `${Math.abs(variance).toFixed(1)}h under`;
  }

  return "On budget";
}

function varianceTone(variance: number | null) {
  if (variance === null) {
    return "text-[var(--muted)]";
  }

  if (variance > 0.05) {
    return "text-[var(--brand-coral)]";
  }

  if (variance < -0.05) {
    return "text-[var(--brand-teal-core)]";
  }

  return "text-[var(--foreground)]";
}
