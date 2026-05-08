import { redirect } from "next/navigation";

import { AdminView } from "@/components/admin/admin-view";
import { getPlanningViewModel } from "@/lib/planning-data";
import type { AuditPhase } from "@/types/audit";

type AdminPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const resolvedParams = (await searchParams) ?? {};
  const auditId = getSingleValue(resolvedParams.auditId);

  if (!auditId) {
    redirect("/");
  }

  const auditLabel = getSingleValue(resolvedParams.auditLabel);
  const phaseOverride = getPhaseOverride(getSingleValue(resolvedParams.phase));
  const planningViewModel = await getPlanningViewModel({ auditId, auditLabel, mode: "live" });

  return (
    <AdminView
      auditId={auditId}
      auditLabel={planningViewModel.auditLabel ?? "Live audit workspace"}
      auditStatus={planningViewModel.auditStatus}
      currentPhase={phaseOverride ?? planningViewModel.currentPhase}
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
