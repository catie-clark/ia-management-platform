import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { normalizeAuditPhase } from "@/lib/audit-phase";
import { formatAuditScopePeriod, type AuditRecord } from "@/lib/live-audit";
import type { DashboardMode } from "@/lib/live-audit";
import type { AuditPhase } from "@/types/audit";

type AuditPhaseRecord = {
  id: string;
  name: string;
  period_end: string;
  period_start: string;
  status: string;
  active_phase: string | null;
};

export type AuditPhaseViewModel = {
  auditId: string | null;
  auditLabel: string;
  auditPeriodLabel: string;
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
      auditPeriodLabel: "Static sample data",
      auditStatus: "prototype",
      currentPhase: prototypePhase,
      mode: "prototype",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audits")
    .select("id, name, period_start, period_end, scope_period_start, scope_period_end, status, active_phase")
    .eq("id", auditId)
    .maybeSingle<AuditPhaseRecord & Pick<AuditRecord, "scope_period_start" | "scope_period_end">>();

  if (error && error.message.includes("scope_period_start")) {
    const fallback = await supabase
      .from("audits")
      .select("id, name, period_start, period_end, status, active_phase")
      .eq("id", auditId)
      .maybeSingle<AuditPhaseRecord>();

    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return {
      auditId,
      auditLabel: fallback.data?.name ?? auditLabel ?? "Live audit workspace",
      auditPeriodLabel:
        fallback.data?.period_start && fallback.data?.period_end ? formatAuditScopePeriod(fallback.data) : "Saved audit",
      auditStatus: fallback.data?.status ?? "active",
      currentPhase: normalizeAuditPhase(fallback.data?.active_phase),
      mode: "live",
    };
  }

  if (error) {
    throw new Error(error.message);
  }

  return {
    auditId,
    auditLabel: data?.name ?? auditLabel ?? "Live audit workspace",
    auditPeriodLabel:
      data?.period_start && data?.period_end ? formatAuditScopePeriod(data) : "Saved audit",
    auditStatus: data?.status ?? "active",
    currentPhase: normalizeAuditPhase(data?.active_phase),
    mode: "live",
  };
}
