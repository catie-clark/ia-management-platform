"use client";

import { PlaceholderPage } from "@/components/dashboard/placeholder-page";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import type { AuditPhase } from "@/types/audit";

export function ReportingView({
  auditId = null,
  auditLabel = "Prototype Demo Audit",
  auditStatus = "prototype",
  currentPhase = "Reporting",
}: {
  auditId?: string | null;
  auditLabel?: string;
  auditStatus?: string;
  currentPhase?: AuditPhase;
}) {
  return (
    <div className="grid gap-6">
      <PhaseCompletionCard auditId={auditId} auditLabel={auditLabel} auditStatus={auditStatus} currentPhase={currentPhase} pagePhase="Reporting" />
      <PlaceholderPage
        eyebrow="Phase 4"
        title="Reporting"
        description="Reporting will handle draft generation, review workflow, comment resolution, and reporting tollgate materials in the final prototype phase."
        phaseStatus={{ label: currentPhase === "Reporting" ? "Active" : `Current phase: ${currentPhase}`, active: currentPhase === "Reporting" }}
        nextDeliverables={[
          "Results summary panel and realistic report draft preview",
          "AIC to manager to director to CAE workflow tracker with send-back states",
          "Comments thread and review log for requested edits",
          "Reporting tollgate draft and demo polish pass",
        ]}
      />
    </div>
  );
}
