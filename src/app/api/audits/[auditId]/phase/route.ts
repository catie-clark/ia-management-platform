import { NextResponse } from "next/server";
import { z } from "zod";

import { getNextAuditPhase, normalizeAuditPhase } from "@/lib/audit-phase";
import { getReportArtifactSourceRecordKey, isWorkflowComplete } from "@/lib/reporting-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const completePhaseSchema = z.object({
  currentPhase: z.enum(["Planning", "Fieldwork", "Reporting"]),
});

type AuditPhaseRecord = {
  id: string;
  status: string;
  active_phase: string | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = completePhaseSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: audit, error: lookupError } = await supabase
      .from("audits")
      .select("id, status, active_phase")
      .eq("id", auditId)
      .maybeSingle<AuditPhaseRecord>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const currentActivePhase = normalizeAuditPhase(audit.active_phase);

    if (currentActivePhase !== body.currentPhase) {
      return NextResponse.json(
        { error: `This audit is currently in ${currentActivePhase}, not ${body.currentPhase}.` },
        { status: 409 },
      );
    }

    if (body.currentPhase === "Reporting") {
      const artifactKeys = ["FINAL_REPORT", "REPORTING_TOLLGATE"] as const;
      const expectedRecordKeys = artifactKeys.map((artifactKey) => getReportArtifactSourceRecordKey(artifactKey, auditId));
      const [{ data: artifactDocuments, error: documentError }, { data: reviewStages, error: reviewError }, { data: reviewComments, error: commentError }] = await Promise.all([
        supabase
          .from("audit_documents")
          .select("source_record_key, status")
          .eq("audit_id", auditId)
          .in("source_record_key", expectedRecordKeys),
        supabase
          .from("report_review_stages")
          .select("artifact_key, status")
          .eq("audit_id", auditId),
        supabase
          .from("report_review_comments")
          .select("artifact_key, status")
          .eq("audit_id", auditId)
          .eq("status", "open"),
      ]);

      if (documentError) {
        throw new Error(documentError.message);
      }

      if (reviewError) {
        throw new Error(reviewError.message);
      }

      if (commentError) {
        throw new Error(commentError.message);
      }

      const missingArtifacts = expectedRecordKeys.filter(
        (recordKey) => !artifactDocuments?.some((document) => document.source_record_key === recordKey && document.status === "complete"),
      );

      if (missingArtifacts.length > 0) {
        return NextResponse.json(
          {
            error: "Complete the final report and reporting tollgate artifacts before closing the audit.",
          },
          { status: 409 },
        );
      }

      for (const artifactKey of artifactKeys) {
        const artifactStages = (reviewStages ?? []).filter((stage) => stage.artifact_key === artifactKey);
        if (!isWorkflowComplete(artifactStages)) {
          return NextResponse.json(
            {
              error: `${artifactKey === "FINAL_REPORT" ? "Final report" : "Reporting tollgate"} review is not fully approved yet.`,
            },
            { status: 409 },
          );
        }
      }

      if ((reviewComments ?? []).length > 0) {
        return NextResponse.json(
          {
            error: "Resolve all open reporting review comments before closing the audit.",
          },
          { status: 409 },
        );
      }
    }

    const nextPhase = getNextAuditPhase(body.currentPhase);
    const nextStatus = nextPhase ? audit.status : "complete";
    const nextActivePhase = nextPhase ?? body.currentPhase;
    const { data: updatedAudit, error: updateError } = await supabase
      .from("audits")
      .update({
        active_phase: nextActivePhase,
        status: nextStatus,
      })
      .eq("id", auditId)
      .select("id, status, active_phase")
      .maybeSingle<AuditPhaseRecord>();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      auditId,
      status: updatedAudit?.status ?? nextStatus,
      activePhase: normalizeAuditPhase(updatedAudit?.active_phase ?? nextActivePhase),
      completedPhase: body.currentPhase,
      nextPhase,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid phase update payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the audit phase.",
      },
      { status: 400 },
    );
  }
}
