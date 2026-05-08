import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { mapControlException, type ControlExceptionRow } from "@/lib/live-audit";

const createControlExceptionSchema = z.object({
  auditId: z.string().uuid(),
  createdByName: z.string().trim().min(1),
  createdByUserId: z.string().trim().optional().nullable(),
  note: z.string().trim().min(1),
});

type ExistingControlRecord = {
  audit_id: string | null;
  id: string;
};

export async function POST(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const body = createControlExceptionSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const { data: existingControl, error: controlLookupError } = await supabase
      .from("controls")
      .select("id, audit_id")
      .eq("id", controlId)
      .maybeSingle<ExistingControlRecord>();

    if (controlLookupError) {
      throw new Error(controlLookupError.message);
    }

    if (!existingControl || existingControl.audit_id !== body.auditId) {
      return NextResponse.json({ error: "Control not found for the selected audit." }, { status: 404 });
    }

    const { data: createdException, error: insertError } = await supabase
      .from("control_exceptions")
      .insert({
        audit_id: body.auditId,
        control_id: controlId,
        created_by_name: body.createdByName,
        created_by_user_id: normalizeOptionalUuid(body.createdByUserId),
        note: body.note,
      })
      .select("id, control_id, created_at, created_by_name, created_by_user_id, note")
      .maybeSingle<ControlExceptionRow>();

    if (insertError) {
      throw new Error(insertError.message);
    }

    if (!createdException) {
      throw new Error("Unable to save the control exception.");
    }

    return NextResponse.json(mapControlException(createdException), { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid control exception payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save the control exception.",
      },
      { status: 400 },
    );
  }
}

function normalizeOptionalUuid(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  return z.string().uuid().safeParse(value).success ? value : null;
}
