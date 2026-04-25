import { ControlTestingView } from "@/components/phase-two/control-testing-view";
import { getControlTestingViewModel } from "@/lib/control-testing-data";

type ControlTestingPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ControlTestingPage({ searchParams }: ControlTestingPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const syncCount = getSingleValue(resolvedParams.sync);
  const viewModel = await getControlTestingViewModel({ auditId, auditLabel, mode, syncCount });

  return <ControlTestingView {...viewModel} />;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
