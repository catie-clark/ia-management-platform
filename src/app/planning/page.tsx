import { getPlanningViewModel } from "@/lib/planning-data";
import { PlanningView } from "@/components/phase-three/planning-view";

type PlanningPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PlanningPage({ searchParams }: PlanningPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const planningViewModel = await getPlanningViewModel({ auditId, auditLabel, mode });

  return (
    <PlanningView
      auditId={planningViewModel.auditId}
      auditLabel={planningViewModel.auditLabel}
      auditPeriodLabel={planningViewModel.auditPeriodLabel}
      auditStatus={planningViewModel.auditStatus}
      currentPhase={planningViewModel.currentPhase}
      planningSources={planningViewModel.planningSources}
      rcsaRecords={planningViewModel.rcsaRecords}
    />
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
