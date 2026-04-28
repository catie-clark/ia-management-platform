import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type CsvUploadRow = {
  controlReference: string;
  entryDate: string;
  hours: string;
  notes: string;
  ownerEmail: string;
  phase: string;
  workItemReference: string;
};

type AuditUserRow = {
  email: string;
  full_name: string;
  id: string;
};

type AuditControlRow = {
  id: string;
  source_record_key: string | null;
};

type InsertAuditTimeEntryRow = {
  audit_id: string;
  control_id: string | null;
  entry_date: string;
  hours: number;
  notes: string | null;
  phase: "Planning" | "Fieldwork" | "Reporting";
  source: string;
  source_payload: Record<string, unknown>;
  updated_at: string;
  user_id: string;
  work_item_reference: string | null;
};

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload a CSV file to import audit hours." }, { status: 400 });
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      return NextResponse.json({ error: "Only .csv uploads are supported for audit hours." }, { status: 400 });
    }

    const csvText = await file.text();
    const parsedRows = parseHoursCsv(csvText);

    if (parsedRows.length === 0) {
      return NextResponse.json({ error: "The CSV file does not contain any data rows." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const [auditResult, usersResult, controlsResult] = await Promise.all([
      supabase.from("audits").select("id").eq("id", auditId).maybeSingle<{ id: string }>(),
      supabase.from("users").select("id, full_name, email").returns<AuditUserRow[]>(),
      supabase.from("controls").select("id, source_record_key").eq("audit_id", auditId).returns<AuditControlRow[]>(),
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

    const userIdByEmail = new Map((usersResult.data ?? []).map((user) => [user.email.trim().toLowerCase(), user.id]));
    const controlIdByReference = new Map<string, string>();

    for (const control of controlsResult.data ?? []) {
      controlIdByReference.set(control.id.trim().toLowerCase(), control.id);

      if (control.source_record_key) {
        controlIdByReference.set(control.source_record_key.trim().toLowerCase(), control.id);
      }
    }

    const now = new Date().toISOString();
    const importErrors: string[] = [];
    const insertRows: InsertAuditTimeEntryRow[] = [];

    parsedRows.forEach((row, index) => {
      const lineNumber = index + 2;
      const phase = normalizePhase(row.phase);

      if (!phase) {
        importErrors.push(`Row ${lineNumber}: phase must be Planning, Fieldwork, or Reporting.`);
        return;
      }

      const normalizedEmail = row.ownerEmail.trim().toLowerCase();
      const userId = userIdByEmail.get(normalizedEmail);

      if (!userId) {
        importErrors.push(`Row ${lineNumber}: no user found for owner email "${row.ownerEmail}".`);
        return;
      }

      const parsedHours = Number(row.hours);

      if (!Number.isFinite(parsedHours) || parsedHours < 0) {
        importErrors.push(`Row ${lineNumber}: hours must be a non-negative number.`);
        return;
      }

      if (!/^\d{4}-\d{2}-\d{2}$/.test(row.entryDate)) {
        importErrors.push(`Row ${lineNumber}: entry_date must use YYYY-MM-DD.`);
        return;
      }

      const normalizedControlReference = row.controlReference.trim().toLowerCase();
      const controlId =
        normalizedControlReference.length === 0 ? null : (controlIdByReference.get(normalizedControlReference) ?? null);

      if (normalizedControlReference.length > 0 && !controlId) {
        importErrors.push(`Row ${lineNumber}: control_reference "${row.controlReference}" was not found on this audit.`);
        return;
      }

      insertRows.push({
        audit_id: auditId,
        control_id: controlId,
        entry_date: row.entryDate,
        hours: roundToQuarter(parsedHours),
        notes: toNullableText(row.notes),
        phase,
        source: "uploaded_csv",
        source_payload: {
          original_control_reference: toNullableText(row.controlReference),
          owner_email: normalizedEmail,
          original_work_item_reference: toNullableText(row.workItemReference),
        },
        updated_at: now,
        user_id: userId,
        work_item_reference: toNullableText(row.workItemReference),
      });
    });

    if (importErrors.length > 0) {
      return NextResponse.json(
        {
          error: "The hours import has validation errors.",
          errors: importErrors,
        },
        { status: 400 },
      );
    }

    const { error: deleteError } = await supabase.from("audit_time_entries").delete().eq("audit_id", auditId).eq("source", "uploaded_csv");

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { error: insertError } = await supabase.from("audit_time_entries").insert(insertRows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    return NextResponse.json({
      importedCount: insertRows.length,
      phasesIncluded: Array.from(new Set(insertRows.map((row) => row.phase))),
      totalHours: insertRows.reduce((sum, row) => sum + row.hours, 0),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to import audit hours." },
      { status: 400 },
    );
  }
}

function parseHoursCsv(csvText: string) {
  const rows = parseCsvRows(csvText);

  if (rows.length < 2) {
    return [];
  }

  const [headerRow, ...valueRows] = rows;
  const headerIndex = new Map(
    headerRow.map((header, index) => [header.trim().toLowerCase(), index]),
  );
  const requiredHeaders = [
    "owner_email",
    "phase",
    "hours",
    "entry_date",
    "control_reference",
    "work_item_reference",
    "notes",
  ];

  for (const header of requiredHeaders) {
    if (!headerIndex.has(header)) {
      throw new Error(`Missing required CSV column: ${header}.`);
    }
  }

  return valueRows
    .filter((row) => row.some((value) => value.trim().length > 0))
    .map<CsvUploadRow>((row) => ({
      controlReference: readCell(row, headerIndex, "control_reference"),
      entryDate: readCell(row, headerIndex, "entry_date"),
      hours: readCell(row, headerIndex, "hours"),
      notes: readCell(row, headerIndex, "notes"),
      ownerEmail: readCell(row, headerIndex, "owner_email"),
      phase: readCell(row, headerIndex, "phase"),
      workItemReference: readCell(row, headerIndex, "work_item_reference"),
    }));
}

function parseCsvRows(csvText: string) {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentValue = "";
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const character = csvText[index];

    if (character === '"') {
      if (inQuotes && csvText[index + 1] === '"') {
        currentValue += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }

      continue;
    }

    if (character === "," && !inQuotes) {
      currentRow.push(currentValue);
      currentValue = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !inQuotes) {
      if (character === "\r" && csvText[index + 1] === "\n") {
        index += 1;
      }

      currentRow.push(currentValue);
      rows.push(currentRow);
      currentRow = [];
      currentValue = "";
      continue;
    }

    currentValue += character;
  }

  if (currentValue.length > 0 || currentRow.length > 0) {
    currentRow.push(currentValue);
    rows.push(currentRow);
  }

  return rows;
}

function readCell(row: string[], headerIndex: Map<string, number>, columnName: string) {
  const index = headerIndex.get(columnName);
  return index === undefined ? "" : (row[index] ?? "").trim();
}

function normalizePhase(value: string) {
  const normalized = value.trim().toLowerCase();

  if (normalized === "planning") {
    return "Planning" as const;
  }

  if (normalized === "fieldwork") {
    return "Fieldwork" as const;
  }

  if (normalized === "reporting") {
    return "Reporting" as const;
  }

  return null;
}

function toNullableText(value: string) {
  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function roundToQuarter(value: number) {
  return Math.round(value * 4) / 4;
}
