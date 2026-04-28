"use client";

import { useMemo } from "react";

import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { AtRiskTable } from "@/components/dashboard/at-risk-table";
import { DashboardRefreshButton } from "@/components/dashboard/dashboard-refresh-button";
import { ExecutiveSummary } from "@/components/dashboard/executive-summary";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MilestoneTimeline } from "@/components/dashboard/milestone-timeline";
import { getDashboardKpis, getExecutiveNarrative, getRiskRows } from "@/lib/audit-logic";
import {
  filterDocumentsForControls,
  filterQuestionsForControls,
  filterRequestsForControls,
} from "@/lib/control-visibility";
import type { DashboardViewModel } from "@/lib/dashboard-data";
import { getSyncedHoursData } from "@/lib/demo-time-sync";

const allAuditUser = {
  id: "ALL_AUDIT",
  name: "All Audit Controls",
  role: "DIRECTOR" as const,
};

export function ExecutiveDashboardView({ viewModel }: { viewModel: DashboardViewModel }) {
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
  const syncedHours = useMemo(
    () =>
      getSyncedHoursData({
        activePhase: viewModel.phase,
        budgetByPhase: viewModel.hoursChartData,
        controls: visibleControls,
        syncCount: viewModel.syncCount,
        syncReferenceTime: viewModel.lastSyncedAt,
      }),
    [viewModel.phase, viewModel.hoursChartData, visibleControls, viewModel.syncCount, viewModel.lastSyncedAt],
  );
  const context = useMemo(
    () => ({
      budgetByPhase: syncedHours.budgetByPhase,
      controls: visibleControls,
      documents: visibleDocuments,
      milestones: viewModel.milestoneItems,
      now: viewModel.lastSyncedAt,
      questions: visibleQuestions,
      requests: visibleRequests,
      users: viewModel.users,
    }),
    [syncedHours.budgetByPhase, viewModel.lastSyncedAt, viewModel.milestoneItems, viewModel.users, visibleControls, visibleDocuments, visibleQuestions, visibleRequests],
  );
  const kpis = useMemo(() => getDashboardKpis(viewModel.phase, context), [context, viewModel.phase]);
  const riskRows = useMemo(() => getRiskRows(viewModel.phase, context), [context, viewModel.phase]);
  const narrative = useMemo(() => getExecutiveNarrative(viewModel.phase, context), [context, viewModel.phase]);

  return (
    <div>
      <section className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className={`inline-flex items-center gap-2 self-start rounded-[14px] border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] ${
              viewModel.mode === "live"
                ? "border-[rgba(5,171,140,0.2)] bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]"
                : "border-black/10 bg-[var(--surface-tint)] text-[var(--muted)]"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                viewModel.mode === "live" ? "bg-[var(--brand-teal-core)]" : "bg-[rgba(79,79,79,0.55)]"
              }`}
              aria-hidden="true"
            />
            {`${viewModel.phase} phase · ${viewModel.mode === "live" ? "Supabase live data" : "Prototype data"}`}
          </div>
          {viewModel.mode === "live" ? <DashboardRefreshButton /> : null}
        </div>
      </section>

      <div className="mt-4">
        <ExecutiveSummary narrative={narrative} />
      </div>

      <section className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
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

      <div className="mt-4 grid gap-4 2xl:grid-cols-[1.15fr_0.85fr]">
        <AtRiskTable
          rows={riskRows}
          title={getRiskTableTitle(viewModel.phase)}
          description={getRiskTableDescription(viewModel.phase, viewModel.mode, viewModel.auditLabel)}
          compact
          bodyHeightClassName="h-[320px]"
        />
        <HoursBarChart
          data={syncedHours.budgetByPhase}
          insight={viewModel.hoursChartInsight}
          message={viewModel.hoursChartMessage}
        />
      </div>

      <div className="mt-4">
        <MilestoneTimeline
          items={viewModel.milestoneItems}
          message={viewModel.milestoneMessage}
          setupComplete={viewModel.milestoneSetupComplete}
          setupHref={viewModel.milestoneSetupHref}
        />
      </div>
    </div>
  );
}

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
  if (phase !== "Planning") {
    return undefined;
  }

  const pathname =
    title === "Owners assigned"
      ? "/control-testing"
      : title === "Phase budgets pending" || title === "Target dates set"
        ? "/hours-budget"
        : title === "Planning artifacts ready"
          ? "/planning"
          : undefined;

  if (!pathname) {
    return undefined;
  }

  const params = new URLSearchParams({
    auditLabel,
    mode,
    phase,
  });

  if (auditId) {
    params.set("auditId", auditId);
  }

  return `${pathname}?${params.toString()}`;
}

function getRiskTableTitle(phase: DashboardViewModel["phase"]) {
  if (phase === "Planning") {
    return "Planning gaps that can delay fieldwork";
  }

  if (phase === "Reporting") {
    return "Open items that can delay report issuance";
  }

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
