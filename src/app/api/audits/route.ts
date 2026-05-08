import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditListItem = {
  id: string;
  name: string;
  company_name?: string | null;
  period_start: string;
  period_end: string;
  scope_period_start?: string;
  scope_period_end?: string;
  total_budget_hours?: number | null;
  planning_budget_hours?: number | null;
  fieldwork_budget_hours?: number | null;
  reporting_budget_hours?: number | null;
  status: string;
  active_phase: string;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await getAuditList(supabase);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json((data ?? []) as AuditListItem[]);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load audits.",
      },
      { status: 400 },
    );
  }
}

async function getAuditList(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  try {
    return await supabase
      .from("audits")
      .select(
        "id, name, company_name, period_start, period_end, scope_period_start, scope_period_end, total_budget_hours, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, status, active_phase, created_at",
      )
      .order("created_at", { ascending: false });
  } catch (error) {
    if (error instanceof Error && error.message.includes("company_name")) {
      return supabase
        .from("audits")
        .select(
          "id, name, period_start, period_end, scope_period_start, scope_period_end, total_budget_hours, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, status, active_phase, created_at",
        )
        .order("created_at", { ascending: false });
    }

    if (
      error instanceof Error &&
      (error.message.includes("planning_budget_hours") ||
        error.message.includes("fieldwork_budget_hours") ||
        error.message.includes("reporting_budget_hours"))
    ) {
      return supabase
        .from("audits")
        .select("id, name, company_name, period_start, period_end, scope_period_start, scope_period_end, total_budget_hours, status, active_phase, created_at")
        .order("created_at", { ascending: false });
    }

    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, company_name, period_start, period_end, total_budget_hours, status, active_phase, created_at")
      .order("created_at", { ascending: false });
  }
}
