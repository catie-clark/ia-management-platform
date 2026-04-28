import { getPlanningViewModel } from "@/lib/planning-data";
import { PlanningView } from "@/components/phase-three/planning-view";
import type { AuditPhase } from "@/types/audit";

type PlanningPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const planningViewModel = await getPlanningViewModel({ auditId, auditLabel, mode });

  return (
    <PlanningView
      auditId={planningViewModel.auditId}
      auditLabel={planningViewModel.auditLabel}
      auditPeriodLabel={planningViewModel.auditPeriodLabel}
      auditStatus={planningViewModel.auditStatus}
      currentPhase={phaseOverride ?? planningViewModel.currentPhase}
      planningSources={planningViewModel.planningSources}
      rcsaRecords={planningViewModel.rcsaRecords}
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
