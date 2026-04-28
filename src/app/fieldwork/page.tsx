import { getFieldworkViewModel } from "@/lib/fieldwork-data";
import { FieldworkView } from "@/components/phase-three/fieldwork-view";
import type { AuditPhase } from "@/types/audit";

type FieldworkPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function FieldworkPage({ searchParams }: FieldworkPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const viewModel = await getFieldworkViewModel({ auditId, auditLabel, mode });

  return (
    <FieldworkView
      viewModel={{
        ...viewModel,
        currentPhase: phaseOverride ?? viewModel.currentPhase,
      }}
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
