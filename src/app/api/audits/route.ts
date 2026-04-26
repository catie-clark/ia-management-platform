import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditListItem = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  scope_period_start?: string;
  scope_period_end?: string;
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
      .select("id, name, period_start, period_end, scope_period_start, scope_period_end, status, active_phase, created_at")
      .order("created_at", { ascending: false });
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("scope_period_start")) {
      throw error;
    }

    return supabase
      .from("audits")
      .select("id, name, period_start, period_end, status, active_phase, created_at")
      .order("created_at", { ascending: false });
  }
}
