import { LogHubView } from "@/components/phase-two/log-hub-view";
import { getQuestionLogViewModel } from "@/lib/question-log-data";

type QuestionLogPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function QuestionLogPage({ searchParams }: QuestionLogPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const mode = getSingleValue(resolvedParams.mode) === "live" ? "live" : "prototype";
  const auditId = getSingleValue(resolvedParams.auditId);
  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const viewModel = await getQuestionLogViewModel({ auditId, auditLabel, mode });

  return <LogHubView {...viewModel} />;
}

function getSingleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
