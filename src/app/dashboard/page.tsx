import { ExecutiveDashboardView } from "@/components/dashboard/executive-dashboard-view";
import { getDashboardViewModel } from "@/lib/dashboard-data";
import { getHoursBudgetViewModel } from "@/lib/hours-budget-data";
import { unstable_noStore as noStore } from "next/cache";
import type { AuditPhase } from "@/types/audit";

type DashboardPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  noStore();
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const syncCount = getSingleValue(resolvedParams.sync);
  const [viewModel, hoursBudgetViewModel] = await Promise.all([
    getDashboardViewModel({ auditId, auditLabel, mode, phaseOverride, syncCount }),
    getHoursBudgetViewModel({ auditId, auditLabel, mode, phaseOverride, syncCount }),
  ]);

  return (
    <ExecutiveDashboardView
      viewModel={viewModel}
      hoursChartData={hoursBudgetViewModel.phaseBudgets}
      hoursChartInsight={
        hoursBudgetViewModel.mode === "live" && hoursBudgetViewModel.timeEntries.length > 0
          ? "Actual phase totals below reflect the uploaded recorded hour entries currently saved for this audit."
          : "Actual phase totals below reflect the current recorded totals available for this audit."
      }
      hoursChartMessage={`Actuals source: recorded audit hours | Last refreshed ${new Date(hoursBudgetViewModel.lastSyncedAt).toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`}
    />
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
