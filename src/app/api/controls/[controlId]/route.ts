import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateControlPlanningSchema = z.object({
  auditId: z.string().uuid(),
  assignedOwnerUserId: z.string().uuid().nullable(),
  assignedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  assignedPlannedHours: z.number().min(0).nullable(),
});

type ExistingControlRecord = {
  id: string;
  audit_id: string | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const body = updateControlPlanningSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: existingControl, error: lookupError } = await supabase
      .from("controls")
      .select("id, audit_id")
      .eq("id", controlId)
      .maybeSingle<ExistingControlRecord>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingControl || existingControl.audit_id !== body.auditId) {
      return NextResponse.json({ error: "Control not found for the selected audit." }, { status: 404 });
    }

    const hasPlanningOverride =
      body.assignedOwnerUserId !== null || body.assignedDueDate !== null || body.assignedPlannedHours !== null;
    const { data: updatedControl, error: updateError } = await supabase
      .from("controls")
      .update({
        assigned_owner_user_id: body.assignedOwnerUserId,
        assigned_due_date: body.assignedDueDate,
        assigned_planned_hours: body.assignedPlannedHours,
        planning_overridden_at: hasPlanningOverride ? new Date().toISOString() : null,
      })
      .eq("id", controlId)
      .eq("audit_id", body.auditId)
      .select("id, assigned_owner_user_id, assigned_due_date, assigned_planned_hours, planning_overridden_at")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      controlId,
      assignedOwnerUserId: updatedControl?.assigned_owner_user_id ?? null,
      assignedDueDate: updatedControl?.assigned_due_date ?? null,
      assignedPlannedHours:
        updatedControl?.assigned_planned_hours === null || updatedControl?.assigned_planned_hours === undefined
          ? null
          : Number(updatedControl.assigned_planned_hours),
      hasPlanningOverride,
      planningOverriddenAt: updatedControl?.planning_overridden_at ?? null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid control update payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the control.",
      },
      { status: 400 },
    );
  }
}
