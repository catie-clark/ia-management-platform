import { HoursBarChart } from "@/components/charts/hours-bar-chart";
import { AlertsPanel } from "@/components/dashboard/alerts-panel";
import { AtRiskTable } from "@/components/dashboard/at-risk-table";
import { DashboardRefreshButton } from "@/components/dashboard/dashboard-refresh-button";
import { ExecutiveSummary } from "@/components/dashboard/executive-summary";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MilestoneTimeline } from "@/components/dashboard/milestone-timeline";
import { PageHeader } from "@/components/dashboard/page-header";
import { getDashboardViewModel } from "@/lib/dashboard-data";
import type { AuditPhase } from "@/types/audit";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const syncCount = getSingleValue(resolvedParams.sync);
  const viewModel = await getDashboardViewModel({ auditId, auditLabel, mode, phaseOverride, syncCount });

  return (
    <div>
      <PageHeader
        eyebrow="Executive Dashboard"
        title="Internal audit command center"
        description=""
        align="top"
        actions={viewModel.mode === "live" ? <DashboardRefreshButton /> : undefined}
        phaseStatus={{
          label: `${viewModel.phase} phase · ${viewModel.mode === "live" ? "Supabase live data" : "Prototype data"}`,
          active: true,
        }}
      />

      <div className="mt-6">
        <ExecutiveSummary narrative={viewModel.executiveNarrative} />
      </div>

      <section className="mt-6 grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {viewModel.kpis.map((kpi) => (
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

      <div className="mt-6 grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
        <AlertsPanel
          rows={viewModel.riskRows}
          badgeLabel={viewModel.phase === "Planning" ? "setup gaps" : viewModel.phase === "Reporting" ? "closeout items" : "active items"}
          eyebrow={viewModel.phase === "Planning" ? "Planning alerts" : viewModel.phase === "Reporting" ? "Reporting alerts" : "Priority alerts"}
          title={getAlertsTitle(viewModel.phase)}
        />
        <HoursBarChart
          data={viewModel.hoursChartData}
          insight={viewModel.hoursChartInsight}
          message={viewModel.hoursChartMessage}
        />
      </div>

      <div className="mt-6">
        <MilestoneTimeline
          items={viewModel.milestoneItems}
          message={viewModel.milestoneMessage}
          setupComplete={viewModel.milestoneSetupComplete}
          setupHref={viewModel.milestoneSetupHref}
        />
      </div>

      <div className="mt-6">
        <AtRiskTable
          rows={viewModel.riskRows}
          title={getRiskTableTitle(viewModel.phase)}
          description={getRiskTableDescription(viewModel.phase, viewModel.mode, viewModel.auditLabel)}
        />
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
  phase: AuditPhase;
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
          ? "/documents"
          : undefined;

  if (!pathname) {
    return undefined;
  }

  const params = new URLSearchParams({
    auditLabel,
    mode,
  });

  if (auditId) {
    params.set("auditId", auditId);
  }

  return `${pathname}?${params.toString()}`;
}

function getAlertsTitle(phase: AuditPhase) {
  if (phase === "Planning") {
    return "Planning decisions that still need attention";
  }

  if (phase === "Reporting") {
    return "Closeout items still affecting report issuance";
  }

  return "Attention needed before the next tollgate";
}

function getRiskTableTitle(phase: AuditPhase) {
  if (phase === "Planning") {
    return "Setup gaps that can delay fieldwork";
  }

  if (phase === "Reporting") {
    return "Open items that can delay report issuance";
  }

  return "Where the audit could slip";
}

function getRiskTableDescription(phase: AuditPhase, mode: "live" | "prototype", auditLabel: string) {
  if (mode === "live") {
    return `Live ${phase.toLowerCase()} risk view for ${auditLabel}. Rows below are calculated from imported audit records scoped to this audit.`;
  }

  if (phase === "Planning") {
    return "Prototype planning view showing the control setup and planning-package gaps leadership should clear before the team starts execution.";
  }

  if (phase === "Reporting") {
    return "Prototype reporting view showing the remaining controls and deliverables that can still hold up issuance.";
  }

  return "Static prototype view of the reusable at-risk behavior that will expand across tables in later phases.";
}
