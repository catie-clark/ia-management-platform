import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updatePhaseBudgetsSchema = z.object({
  fieldworkBudgetHours: z.number().min(0).nullable(),
  planningBudgetHours: z.number().min(0).nullable(),
  reportingBudgetHours: z.number().min(0).nullable(),
});

type AuditBudgetRecord = {
  fieldwork_budget_hours: number | null;
  id: string;
  planning_budget_hours: number | null;
  reporting_budget_hours: number | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updatePhaseBudgetsSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: audit, error: lookupError } = await supabase
      .from("audits")
      .select("id, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .eq("id", auditId)
      .maybeSingle<AuditBudgetRecord>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const { data: updatedAudit, error: updateError } = await supabase
      .from("audits")
      .update({
        planning_budget_hours: body.planningBudgetHours,
        fieldwork_budget_hours: body.fieldworkBudgetHours,
        reporting_budget_hours: body.reportingBudgetHours,
      })
      .eq("id", auditId)
      .select("id, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours")
      .maybeSingle<AuditBudgetRecord>();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      auditId,
      fieldworkBudgetHours:
        updatedAudit?.fieldwork_budget_hours === null || updatedAudit?.fieldwork_budget_hours === undefined
          ? null
          : Number(updatedAudit.fieldwork_budget_hours),
      planningBudgetHours:
        updatedAudit?.planning_budget_hours === null || updatedAudit?.planning_budget_hours === undefined
          ? null
          : Number(updatedAudit.planning_budget_hours),
      reportingBudgetHours:
        updatedAudit?.reporting_budget_hours === null || updatedAudit?.reporting_budget_hours === undefined
          ? null
          : Number(updatedAudit.reporting_budget_hours),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid budget update payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the phase budgets.",
      },
      { status: 400 },
    );
  }
}
