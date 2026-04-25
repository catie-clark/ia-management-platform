import { ReportingView } from "@/components/phase-three/reporting-view";
import { getAuditPhaseViewModel } from "@/lib/audit-phase-data";

type ReportingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportingPage({ searchParams }: ReportingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseViewModel = await getAuditPhaseViewModel({ auditId, auditLabel, mode, prototypePhase: "Reporting" });

  return (
    <ReportingView
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
