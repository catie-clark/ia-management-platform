"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Lightbulb } from "lucide-react";

import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { AtRiskTable } from "@/components/dashboard/at-risk-table";
import { DashboardPhaseSelector } from "@/components/dashboard/dashboard-phase-selector";
import { DashboardRefreshButton } from "@/components/dashboard/dashboard-refresh-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  WorkspaceHelpButton,
  WorkspacePageHeader,
} from "@/components/workspace/workspace-ui";
import { getDashboardKpis, getExecutiveNarrative, getRiskRows } from "@/lib/audit-logic";
import {
  filterDocumentsForControls,
  filterQuestionsForControls,
  filterRequestsForControls,
} from "@/lib/control-visibility";
import { cn, formatShortDate } from "@/lib/utils";
import type { DashboardViewModel } from "@/lib/dashboard-data";
import type { BudgetByPhase, ReviewStatus, TimelineItem } from "@/types/audit";

const allAuditUser = {
  id: "ALL_AUDIT",
  name: "All Audit Controls",
  role: "DIRECTOR" as const,
};

export function ExecutiveDashboardView({
  viewModel,
  hoursChartData,
  hoursChartInsight,
  hoursChartMessage,
}: {
  viewModel: DashboardViewModel;
  hoursChartData: BudgetByPhase[];
  hoursChartInsight: string;
  hoursChartMessage: string;
}) {
  const visibleControls = viewModel.controls;
  const visibleQuestions = useMemo(
    () => filterQuestionsForControls(viewModel.questions, visibleControls, allAuditUser, "ALL"),
    [viewModel.questions, visibleControls],
  );
  const visibleRequests = useMemo(
    () => filterRequestsForControls(viewModel.requests, visibleControls, allAuditUser, "ALL"),
    [viewModel.requests, visibleControls],
  );
  const visibleDocuments = useMemo(
    () => filterDocumentsForControls(viewModel.documents, visibleControls, allAuditUser, "ALL"),
    [viewModel.documents, visibleControls],
  );
  const context = useMemo(
    () => ({
      budgetByPhase: hoursChartData,
      controls: visibleControls,
      documents: visibleDocuments,
      milestones: viewModel.milestoneItems,
      now: viewModel.lastSyncedAt,
      questions: visibleQuestions,
      requests: visibleRequests,
      users: viewModel.users,
    }),
    [hoursChartData, viewModel.lastSyncedAt, viewModel.milestoneItems, viewModel.users, visibleControls, visibleDocuments, visibleQuestions, visibleRequests],
  );
  const kpis = useMemo(() => getDashboardKpis(viewModel.phase, context), [context, viewModel.phase]);
  const riskRows = useMemo(() => getRiskRows(viewModel.phase, context), [context, viewModel.phase]);
  const narrative = useMemo(() => getExecutiveNarrative(viewModel.phase, context), [context, viewModel.phase]);

  const auditQuery = useMemo(() => {
    const params = new URLSearchParams({
      mode: viewModel.mode,
      auditLabel: viewModel.auditLabel,
      phase: viewModel.phase,
    });
    if (viewModel.auditId) params.set("auditId", viewModel.auditId);
    return params.toString();
  }, [viewModel.auditId, viewModel.auditLabel, viewModel.mode, viewModel.phase]);

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
      {viewModel.phase} phase
    </span>
  );

  const dashboardActions = (
    <>
      <DashboardPhaseSelector phase={viewModel.phase} />
      {viewModel.mode === "live" && <DashboardRefreshButton />}
    </>
  );

  return (
    <div>
      <WorkspacePageHeader
        title="Executive Dashboard"
        statusBadge={phaseBadge}
        purposeLine="Current audit posture — what is happening, what needs attention, and where to go next."
        helpTip="The phase selector above controls which audit phase is active across all workspace tabs."
        helpLabel="About the dashboard phase"
        actions={dashboardActions}
      />

      {/* Executive snapshot */}
      <div className="mb-4 flex items-start gap-3 rounded-[14px] border border-black/6 bg-[var(--surface)] px-4 py-3">
        <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgba(245,168,0,0.1)] text-[var(--brand-amber-core)]">
          <Lightbulb size={12} />
        </span>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Executive snapshot</p>
          <p className="mt-1 text-[13px] leading-6 text-[var(--foreground)]">{narrative}</p>
        </div>
      </div>

      {/* KPI cards */}
      <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {kpis.map((kpi) => (
          <KpiCard
            key={kpi.title}
            {...kpi}
            href={getKpiHref({
              auditId: viewModel.auditId,
              auditLabel: viewModel.auditLabel,
              mode: viewModel.mode,
              phase: viewModel.phase,
              title: kpi.title,
            })}
          />
        ))}
      </section>

      {/* At-risk table — primary content */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">
            {getRiskTableTitle(viewModel.phase)}
          </h2>
          <WorkspaceHelpButton
            label="About at-risk calculation"
            tip="Items appear here when they are overdue, blocked, or missing information needed to keep the audit on schedule."
          />
        </div>
        <AtRiskTable
          rows={riskRows}
          title={getRiskTableTitle(viewModel.phase)}
          description={getRiskTableDescription(viewModel.phase, viewModel.mode, viewModel.auditLabel)}
          compact
          bodyHeightClassName="h-[320px]"
        />
      </div>

      {/* Hours chart — secondary */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Hours pacing</h2>
          <WorkspaceHelpButton
            label="About budget variance"
            tip="Variance is the difference between planned and actual hours per phase. A positive variance means the audit is running over plan."
          />
        </div>
        <HoursBarChart
          data={hoursChartData}
          insight={hoursChartInsight}
          message={hoursChartMessage}
        />
      </div>

      {/* Milestone table */}
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-[13px] font-semibold text-[var(--foreground)]">Lifecycle milestones</h2>
          <WorkspaceHelpButton
            label="About milestone status"
            tip="Milestones derive from the audit start and end dates set in Hours & Budget. Status updates automatically as phases progress."
          />
        </div>
        <MilestoneTable
          items={viewModel.milestoneItems}
          setupComplete={viewModel.milestoneSetupComplete}
          setupHref={viewModel.milestoneSetupHref}
          auditQuery={auditQuery}
        />
      </div>
    </div>
  );
}

// ── Milestone table ────────────────────────────────────────────────────────────

const MILESTONE_PHASE_PATHS: Array<[string, string]> = [
  ["planning", "/planning"],
  ["fieldwork", "/fieldwork"],
  ["reporting", "/reporting"],
];

function MilestoneTable({
  items,
  setupComplete,
  setupHref,
  auditQuery,
}: {
  items: TimelineItem[];
  setupComplete: boolean;
  setupHref?: string;
  auditQuery: string;
}) {
  if (!setupComplete) {
    return (
      <div className="rounded-[14px] border border-dashed border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.08)] px-4 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-amber-dark)]">Setup needed</p>
        <p className="mt-1.5 text-[13px] text-[var(--muted)]">
          Set audit lifecycle dates in Hours &amp; Budget to activate milestone tracking.
          {setupHref && (
            <Link
              href={`${setupHref}?${auditQuery}`}
              className="ml-1.5 font-semibold text-[var(--brand-indigo-core)] hover:underline"
            >
              Open Hours &amp; Budget
            </Link>
          )}
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-black/6">
      <table className="min-w-full border-collapse text-left text-[13px]">
        <thead>
          <tr className="bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
            <th className="px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Milestone</th>
            <th className="px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Due</th>
            <th className="px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Status</th>
            <th className="px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-black/5 bg-white">
          {items.map((item) => {
            const tabPath = MILESTONE_PHASE_PATHS.find(([key]) =>
              item.label.toLowerCase().includes(key),
            )?.[1];
            return (
              <tr key={item.id} className="transition-colors hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-2.5 font-medium text-[var(--foreground)]">{item.label}</td>
                <td className="px-3 py-2.5 text-[var(--muted)]">{formatShortDate(item.date)}</td>
                <td className="px-3 py-2.5">
                  <MilestoneStatusBadge status={item.status} />
                </td>
                <td className="px-3 py-2.5">
                  {tabPath ? (
                    <Link
                      href={`${tabPath}?${auditQuery}`}
                      className="text-[12px] font-semibold text-[var(--brand-indigo-core)] hover:underline"
                    >
                      View
                    </Link>
                  ) : (
                    <span className="text-[12px] text-[var(--muted)]">—</span>
                  )}
                </td>
              </tr>
            );
          })}
          {items.length === 0 && (
            <tr>
              <td colSpan={4} className="px-3 py-6 text-center text-[var(--muted)]">
                No milestones configured.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function MilestoneStatusBadge({ status }: { status: ReviewStatus }) {
  const styles: Record<ReviewStatus, string> = {
    upcoming: "bg-[var(--surface)] text-[var(--muted)]",
    active: "bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-dark)]",
    complete: "bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]",
    at_risk: "bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
        styles[status],
      )}
    >
      {status.replace("_", " ")}
    </span>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function getKpiHref({
  auditId,
  auditLabel,
  mode,
  phase,
  title,
}: {
  auditId: string | null;
  auditLabel: string;
  mode: "live" | "prototype";
  phase: DashboardViewModel["phase"];
  title: string;
}) {
  if (phase !== "Planning") return undefined;

  const pathname =
    title === "Owners assigned" || title === "Scope assigned"
      ? "/fieldwork"
      : title === "Phase budgets pending"
        ? "/hours-budget"
        : title === "Planning artifacts ready"
          ? "/planning"
          : undefined;

  if (!pathname) return undefined;

  const params = new URLSearchParams({ auditLabel, mode, phase });
  if (auditId) params.set("auditId", auditId);
  return `${pathname}?${params.toString()}`;
}


function getRiskTableTitle(phase: DashboardViewModel["phase"]) {
  if (phase === "Planning") return "Planning gaps that can delay fieldwork";
  if (phase === "Reporting") return "Open items that can delay report issuance";
  return "Where the audit could slip";
}

function getRiskTableDescription(
  phase: DashboardViewModel["phase"],
  mode: "live" | "prototype",
  auditLabel: string,
) {
  if (mode === "live") {
    return `Live ${phase.toLowerCase()} risk view for ${auditLabel}, covering the full audit.`;
  }
  if (phase === "Planning") {
    return "Prototype planning view showing setup gaps across the full audit before the team starts execution.";
  }
  if (phase === "Reporting") {
    return "Prototype reporting view showing the remaining controls and deliverables across the full audit that can still hold up issuance.";
  }
  return "Prototype fieldwork view showing the main blockers across the full audit.";
}
