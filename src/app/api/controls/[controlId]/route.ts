import { NextResponse } from "next/server";
import { z } from "zod";

import { createNotificationForUserId } from "@/lib/audit-notifications";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateControlPlanningSchema = z.object({
  auditId: z.string().uuid(),
  assignedOwnerUserId: z.string().uuid().nullable(),
  clearAssignedOwner: z.boolean().optional(),
  assignedDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  assignedPlannedHours: z.number().min(0).nullable(),
  scopeStatus: z.enum(["IN_SCOPE", "OUT_OF_SCOPE"]).optional(),
});

type ExistingControlRecord = {
  assigned_owner_user_id: string | null;
  control_name: string;
  id: string;
  audit_id: string | null;
  source_payload: Record<string, unknown>;
};

export async function PATCH(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const body = updateControlPlanningSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: existingControl, error: lookupError } = await supabase
      .from("controls")
      .select("id, audit_id, assigned_owner_user_id, control_name, source_payload")
      .eq("id", controlId)
      .maybeSingle<ExistingControlRecord>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingControl || existingControl.audit_id !== body.auditId) {
      return NextResponse.json({ error: "Control not found for the selected audit." }, { status: 404 });
    }

    const clearAssignedOwner = body.clearAssignedOwner === true;
    const hasPlanningOverride =
      body.assignedOwnerUserId !== null || clearAssignedOwner || body.assignedDueDate !== null || body.assignedPlannedHours !== null;
    const nextSourcePayload: Record<string, unknown> = {
      ...(existingControl.source_payload ?? {}),
    };

    if (body.scopeStatus !== undefined) {
      nextSourcePayload.scope_status = body.scopeStatus;
    }

    if (clearAssignedOwner) {
      nextSourcePayload.assigned_owner_cleared = true;
    } else {
      delete nextSourcePayload.assigned_owner_cleared;
    }
    const { data: updatedControl, error: updateError } = await supabase
      .from("controls")
      .update({
        assigned_owner_user_id: body.assignedOwnerUserId,
        assigned_due_date: body.assignedDueDate,
        assigned_planned_hours: body.assignedPlannedHours,
        planning_overridden_at: hasPlanningOverride ? new Date().toISOString() : null,
        source_payload: nextSourcePayload,
      })
      .eq("id", controlId)
      .eq("audit_id", body.auditId)
      .select("id, assigned_owner_user_id, assigned_due_date, assigned_planned_hours, planning_overridden_at, source_payload")
      .maybeSingle();

    if (updateError) {
      throw new Error(updateError.message);
    }

    if (body.assignedOwnerUserId && body.assignedOwnerUserId !== existingControl.assigned_owner_user_id) {
      await safelyCreateNotification(() =>
        createNotificationForUserId({
          auditId: body.auditId,
          detail: `${existingControl.control_name} was assigned to you in Fieldwork.`,
          entityId: controlId,
          entityType: "control",
          eventType: "CONTROL_ASSIGNED",
          linkHref: `/fieldwork?mode=live&auditId=${body.auditId}`,
          title: "A control was assigned to you",
          tone: "warning",
          userId: body.assignedOwnerUserId!,
        }),
      );
    }

    return NextResponse.json({
      controlId,
      assignedOwnerUserId: updatedControl?.assigned_owner_user_id ?? null,
      clearAssignedOwner,
      effectiveOwnerUserId: clearAssignedOwner ? null : updatedControl?.assigned_owner_user_id ?? null,
      assignedDueDate: updatedControl?.assigned_due_date ?? null,
      assignedPlannedHours:
        updatedControl?.assigned_planned_hours === null || updatedControl?.assigned_planned_hours === undefined
          ? null
          : Number(updatedControl.assigned_planned_hours),
      hasPlanningOverride,
      planningOverriddenAt: updatedControl?.planning_overridden_at ?? null,
      scopeStatus:
        updatedControl?.source_payload && typeof updatedControl.source_payload.scope_status === "string"
          ? updatedControl.source_payload.scope_status
          : body.scopeStatus ?? "IN_SCOPE",
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

async function safelyCreateNotification(callback: () => Promise<void>) {
  try {
    await callback();
  } catch (error) {
    console.error("Unable to create control notification", error);
  }
}
