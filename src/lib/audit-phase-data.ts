import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import type { DashboardMode } from "@/lib/live-audit";
import type { AuditPhase } from "@/types/audit";

type AuditPhaseRecord = {
  id: string;
  name: string;
  status: string;
  active_phase: string | null;
};

export type AuditPhaseViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  mode: DashboardMode;
};

export async function getAuditPhaseViewModel({
  auditId,
  auditLabel,
  mode,
  prototypePhase,
}: {
  auditId?: string;
  auditLabel?: string;
  mode: DashboardMode;
  prototypePhase: AuditPhase;
}): Promise<AuditPhaseViewModel> {
  if (mode !== "live" || !auditId) {
    return {
      auditId: null,
      auditLabel: auditLabel ?? "Prototype Demo Audit",
      auditStatus: "prototype",
      currentPhase: prototypePhase,
      mode: "prototype",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .select("id, name, status, active_phase")
    .eq("id", auditId)
    .maybeSingle<AuditPhaseRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return {
    auditId,
    auditLabel: data?.name ?? auditLabel ?? "Live audit workspace",
    auditStatus: data?.status ?? "active",
    currentPhase: normalizeAuditPhase(data?.active_phase),
    mode: "live",
  };
}
