import { ControlTestingView } from "@/components/phase-two/control-testing-view";
import { getControlTestingViewModel } from "@/lib/control-testing-data";
import type { AuditPhase } from "@/types/audit";

type ControlTestingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ControlTestingPage({ searchParams }: ControlTestingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const syncCount = getSingleValue(resolvedParams.sync);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const viewModel = await getControlTestingViewModel({ auditId, auditLabel, mode, syncCount });

  return <ControlTestingView {...viewModel} currentPhase={phaseOverride ?? viewModel.currentPhase} />;
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
