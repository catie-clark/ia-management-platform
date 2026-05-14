import { NextResponse } from "next/server";
import { z } from "zod";

import {
  defaultAuditWorkspaceSettings,
  normalizeAuditWorkspaceSettings,
  reviewWorkflowStages,
} from "@/lib/audit-settings";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updateAuditSettingsSchema = z.object({
  showControlBudgetHours: z.boolean().optional(),
  reviewWorkflowStageLabels: z
    .object(
      Object.fromEntries(reviewWorkflowStages.map((stage) => [stage, z.string().trim().min(1).max(80)])) as Record<
        string,
        z.ZodString
      >,
    )
    .partial()
    .optional(),
});

type AuditSettingsRow = {
  admin_settings: Record<string, unknown> | null;
  id: string;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const row = await loadAuditSettingsRow(supabase, auditId);

    return NextResponse.json({
      settings: normalizeAuditWorkspaceSettings(row.admin_settings),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load audit settings.",
        settings: defaultAuditWorkspaceSettings,
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updateAuditSettingsSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const existingRow = await loadAuditSettingsRow(supabase, auditId);
    const nextSettings = normalizeAuditWorkspaceSettings({
      ...(existingRow.admin_settings ?? {}),
      ...(body.showControlBudgetHours !== undefined ? { showControlBudgetHours: body.showControlBudgetHours } : {}),
      ...(body.reviewWorkflowStageLabels
        ? {
            reviewWorkflowStageLabels: {
              ...(existingRow.admin_settings?.reviewWorkflowStageLabels &&
              typeof existingRow.admin_settings.reviewWorkflowStageLabels === "object"
                ? (existingRow.admin_settings.reviewWorkflowStageLabels as Record<string, unknown>)
                : {}),
              ...body.reviewWorkflowStageLabels,
            },
          }
        : {}),
    });

    const { data, error } = await supabase
      .from("audits")
      .update({
        admin_settings: nextSettings,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auditId)
      .select("id, admin_settings")
      .maybeSingle<AuditSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Audit not found.");
    }

    return NextResponse.json({
      settings: normalizeAuditWorkspaceSettings(data.admin_settings),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid settings payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to save audit settings.",
      },
      { status: 400 },
    );
  }
}

async function loadAuditSettingsRow(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  try {
    const { data, error } = await supabase
      .from("audits")
      .select("id, admin_settings")
      .eq("id", auditId)
      .maybeSingle<AuditSettingsRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Audit not found.");
    }

    return data;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("admin_settings")) {
      throw error;
    }

    const { data, error: fallbackError } = await supabase.from("audits").select("id").eq("id", auditId).maybeSingle<{ id: string }>();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    if (!data) {
      throw new Error("Audit not found.");
    }

    return { id: data.id, admin_settings: defaultAuditWorkspaceSettings };
  }
}
