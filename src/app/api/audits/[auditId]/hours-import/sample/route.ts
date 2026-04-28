import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type SampleUserRow = {
  email: string;
  full_name: string;
  id: string;
};

type SampleControlRow = {
  id: string;
  source_record_key: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const [auditResult, usersResult, controlsResult] = await Promise.all([
      supabase.from("audits").select("id, name, period_start, planning_start_date, fieldwork_start_date, reporting_start_date").eq("id", auditId).maybeSingle<{
        fieldwork_start_date: string | null;
        id: string;
        name: string;
        period_start: string | null;
        planning_start_date: string | null;
        reporting_start_date: string | null;
      }>(),
      supabase.from("users").select("id, full_name, email").order("full_name", { ascending: true }).limit(3).returns<SampleUserRow[]>(),
      supabase.from("controls").select("id, source_record_key").eq("audit_id", auditId).order("source_record_key", { ascending: true }).limit(3).returns<SampleControlRow[]>(),
    ]);

    if (auditResult.error) {
      throw new Error(auditResult.error.message);
    }

    if (!auditResult.data) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    if (usersResult.error) {
      throw new Error(usersResult.error.message);
    }

    if (controlsResult.error) {
      throw new Error(controlsResult.error.message);
    }

    const users = usersResult.data ?? [];
    const controls = controlsResult.data ?? [];
    const planningDate = chooseDate(auditResult.data.planning_start_date, auditResult.data.period_start, "2026-04-15");
    const fieldworkDate = chooseDate(auditResult.data.fieldwork_start_date, planningDate, "2026-04-22");
    const reportingDate = chooseDate(auditResult.data.reporting_start_date, fieldworkDate, "2026-05-06");
    const sampleRows = [
      buildSampleRow(users[0], controls[0], "Planning", planningDate, "PLN-001", 6.0, "Planning walkthrough and scoping alignment"),
      buildSampleRow(users[1] ?? users[0], controls[1] ?? controls[0], "Planning", planningDate, "PLN-002", 4.5, "Risk assessment and budget setup"),
      buildSampleRow(users[0], controls[0], "Fieldwork", fieldworkDate, "FW-101", 8.0, "Initial walkthrough and design testing"),
      buildSampleRow(users[1] ?? users[0], controls[1] ?? controls[0], "Fieldwork", fieldworkDate, "FW-102", 7.25, "Sample selection and evidence review"),
      buildSampleRow(users[2] ?? users[0], controls[2] ?? controls[0], "Reporting", reportingDate, "RP-201", 3.5, "Issue drafting and review updates"),
      buildSampleRow(users[1] ?? users[0], controls[1] ?? controls[0], "Reporting", reportingDate, "RP-202", 2.75, "Final report closeout support"),
    ].filter((row): row is string[] => row !== null);

    const csvLines = [
      ["owner_email", "phase", "hours", "entry_date", "control_reference", "work_item_reference", "notes"],
      ...sampleRows,
    ].map((row) => row.map(escapeCsvCell).join(","));

    const filename = `${sanitizeFileName(auditResult.data.name)}-hours-import-sample.csv`;

    return new NextResponse(`${csvLines.join("\n")}\n`, {
      headers: {
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate the sample hours import." },
      { status: 400 },
    );
  }
}

function buildSampleRow(
  user: SampleUserRow | undefined,
  control: SampleControlRow | undefined,
  phase: "Planning" | "Fieldwork" | "Reporting",
  entryDate: string,
  workItemReference: string,
  hours: number,
  notes: string,
) {
  if (!user) {
    return null;
  }

  return [
    user.email,
    phase,
    hours.toFixed(2),
    entryDate,
    control?.source_record_key ?? control?.id ?? "",
    workItemReference,
    notes,
  ];
}

function chooseDate(primary: string | null, secondary: string | null, fallback: string) {
  return (primary ?? secondary ?? fallback).slice(0, 10);
}

function escapeCsvCell(value: string) {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function sanitizeFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "audit";
}
