import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateFindingSchema = z.object({
  linkedControlId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  title: z.string().min(1),
  summary: z.string().min(1),
  severity: z.enum(["LOW", "MEDIUM", "HIGH"]),
  status: z.enum(["OPEN", "IN_PROGRESS", "READY_FOR_REPORT", "FINALIZED", "CLOSED"]),
  ownerId: z.string().uuid().optional().or(z.literal("")).transform((value) => value || undefined),
  dueDate: z.string().optional().or(z.literal("")).transform((value) => value || undefined),
  impactStatement: z.string().optional(),
  recommendation: z.string().optional(),
  managementResponse: z.string().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string; findingId: string }> }) {
  try {
    const { auditId, findingId } = await context.params;
    const body = updateFindingSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_findings")
      .update({
        control_id: body.linkedControlId ?? null,
        title: body.title,
        summary: body.summary,
        severity: body.severity.toLowerCase(),
        status: body.status.toLowerCase(),
        owner_user_id: body.ownerId ?? null,
        due_date: body.dueDate ?? null,
        impact_statement: body.impactStatement?.trim() || null,
        recommendation: body.recommendation?.trim() || null,
        management_response: body.managementResponse?.trim() || null,
      })
      .eq("audit_id", auditId)
      .eq("id", findingId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      finding: {
        id: data?.id ?? findingId,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid finding payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the finding.",
      },
      { status: 400 },
    );
  }
}
