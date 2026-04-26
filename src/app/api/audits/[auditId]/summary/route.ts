import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditRecord } from "@/lib/live-audit";
import { formatAuditScopePeriod } from "@/lib/live-audit";

type AuditSummaryRecord = Pick<
  AuditRecord,
  "id" | "name" | "period_start" | "period_end" | "scope_period_start" | "scope_period_end"
>;

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const auditResult = await getAuditSummaryRecord(supabase, auditId);

    if (auditResult.error) {
      throw new Error(auditResult.error.message);
    }

    if (!auditResult.data) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    return NextResponse.json({
      auditId: auditResult.data.id,
      auditLabel: auditResult.data.name,
      scopePeriodLabel: formatAuditScopePeriod(auditResult.data),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load audit summary.",
      },
      { status: 400 },
    );
  }
}

async function getAuditSummaryRecord(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end")
      .eq("id", auditId)
      .maybeSingle<AuditSummaryRecord>();
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, period_start, period_end")
      .eq("id", auditId)
      .maybeSingle<Pick<AuditRecord, "id" | "name" | "period_start" | "period_end">>();
  }
}
