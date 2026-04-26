import { ReportingView } from "@/components/phase-three/reporting-view";
import { getReportingViewModel } from "@/lib/reporting-data";

type ReportingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ReportingPage({ searchParams }: ReportingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const viewModel = await getReportingViewModel({ auditId, auditLabel, mode });

  return <ReportingView viewModel={viewModel} />;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
