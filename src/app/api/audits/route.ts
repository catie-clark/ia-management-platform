import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditListItem = {
  id: string;
  name: string;
  period_start: string;
  period_end: string;
  status: string;
  active_phase: string;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audits")
      .select("id, name, period_start, period_end, status, active_phase, created_at")
      .order("created_at", { ascending: false });

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
