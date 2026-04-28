import { ReportingView } from "@/components/phase-three/reporting-view";
import { getReportingViewModel } from "@/lib/reporting-data";
import { redirect } from "next/navigation";
import type { AuditPhase } from "@/types/audit";

type ReportingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportingPage({ searchParams }: ReportingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = "live" as const;
  const auditId = getSingleValue(resolvedParams.auditId);
  if (!auditId) {
    redirect("/");
  }
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const viewModel = await getReportingViewModel({ auditId, auditLabel, mode });

  return (
    <ReportingView
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
