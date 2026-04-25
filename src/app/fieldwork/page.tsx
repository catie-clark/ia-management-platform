import { getAuditPhaseViewModel } from "@/lib/audit-phase-data";
import { FieldworkView } from "@/components/phase-three/fieldwork-view";

type FieldworkPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FieldworkPage({ searchParams }: FieldworkPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseViewModel = await getAuditPhaseViewModel({ auditId, auditLabel, mode, prototypePhase: "Fieldwork" });

  return (
    <FieldworkView
      auditId={phaseViewModel.auditId}
      auditLabel={phaseViewModel.auditLabel}
      auditStatus={phaseViewModel.auditStatus}
      currentPhase={phaseViewModel.currentPhase}
    />
  );
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
