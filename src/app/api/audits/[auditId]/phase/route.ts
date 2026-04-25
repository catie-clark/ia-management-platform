import { NextResponse } from "next/server";
import { z } from "zod";

import { getNextAuditPhase, normalizeAuditPhase } from "@/lib/audit-phase";
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
