import { NextResponse } from "next/server";

import { loadControlTestingMatricesForControl } from "@/lib/control-testing-matrix-persistence";
import { loadWorkpaperForControl } from "@/lib/fieldwork-workpaper-persistence";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildXlsxWorkbook, type WorkbookCell, type WorkbookCellStyle } from "@/lib/xlsx";
import type { ControlTestingMatrix, TestingMatrixAttributeResult, WorkpaperContent } from "@/types/audit";

type ControlExportRow = {
  id: string;
  source_record_key: string | null;
  control_name: string;
};

type WorkbookSheetInput = Parameters<typeof buildXlsxWorkbook>[0][number];

export async function GET(request: Request, context: { params: Promise<{ controlId: string }> }) {
  try {
    const { controlId } = await context.params;
    const { searchParams } = new URL(request.url);
    const auditId = searchParams.get("auditId");

    if (!auditId) {
      return NextResponse.json({ error: "auditId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { data: control, error } = await supabase
      .from("controls")
      .select("id, source_record_key, control_name")
      .eq("audit_id", auditId)
      .eq("id", controlId)
      .maybeSingle<ControlExportRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!control) {
      return NextResponse.json({ error: "The requested control was not found for this audit." }, { status: 404 });
    }

    const [workpaper, matrices] = await Promise.all([
      loadWorkpaperForControl(auditId, controlId),
      loadControlTestingMatricesForControl(auditId, controlId),
    ]);

    const sheets: WorkbookSheetInput[] = [
      buildWorkpaperSheet({ control, content: workpaper?.content ?? null, updatedAt: workpaper?.document.updatedAt ?? null }),
      ...matrices.map((matrix, index) => buildMatrixSheet(matrix, control, index)),
    ];

    const workbook = buildXlsxWorkbook(sheets);

    return new NextResponse(new Uint8Array(workbook), {
      headers: {
        "Content-Disposition": `attachment; filename="${buildExportFileName(control)}"`,
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to export testing artifacts.",
      },
      { status: 400 },
    );
  }
}

type WorkpaperSection = {
  title: string;
  fields: Array<{ label: string; getValue: (content: WorkpaperContent) => string }>;
};

const workpaperSections: WorkpaperSection[] = [
  {
    title: "Control Details",
    fields: [
      { label: "Control Reference", getValue: (c) => c.controlReference },
      { label: "Key Control (Key / Non-Key)", getValue: (c) => c.keyControl },
      { label: "Type of Control", getValue: (c) => c.typeOfControl },
      { label: "Control Frequency", getValue: (c) => c.controlFrequency },
      { label: "Assertion(s)", getValue: (c) => c.assertions },
    ],
  },
  {
    title: "Testing Design",
    fields: [
      { label: "Description of Test to Be Performed", getValue: (c) => c.descriptionOfTestToBePerformed },
      { label: "Total Population and Sampling Units", getValue: (c) => c.totalPopulationAndSamplingUnits },
      { label: "Population Completeness Consideration", getValue: (c) => c.populationCompletenessConsideration },
      { label: "Sample Size and Selection Procedures", getValue: (c) => c.sampleSizeAndSelectionProcedures },
      { label: "Expected Deviation Types", getValue: (c) => c.expectedDeviationTypes },
    ],
  },
  {
    title: "Execution",
    fields: [
      { label: "Documentation of Testing", getValue: (c) => c.documentationOfTesting },
      { label: "Extension of Interim Testing to End of Period", getValue: (c) => c.extensionOfInterimTestingToEndOfPeriod },
    ],
  },
  {
    title: "Deviations",
    fields: [
      { label: "Matrix Exception Summary", getValue: (c) => c.matrixExceptionSummary },
      { label: "Number of Deviations Detected", getValue: (c) => c.numberOfDeviationsDetected },
      { label: "Deviation Description and Cause", getValue: (c) => c.deviationDescriptionAndCause },
      { label: "Did Deviations Result From Fraud or Error?", getValue: (c) => c.didDeviationsResultFromFraudOrError },
      { label: "Were Deviations Isolated or Pervasive?", getValue: (c) => c.wereDeviationsIsolatedOrPervasive },
      { label: "Final Number of Deviations", getValue: (c) => c.finalNumberOfDeviations },
    ],
  },
  {
    title: "Conclusion",
    fields: [
      { label: "Control Effectiveness Conclusion", getValue: (c) => c.controlEffectivenessConclusion },
    ],
  },
];

function buildWorkpaperSheet({
  content,
  control,
  updatedAt,
}: {
  content: WorkpaperContent | null;
  control: ControlExportRow;
  updatedAt: string | null;
}): WorkbookSheetInput {
  const rows: WorkbookSheetInput["rows"] = [];
  const merges: string[] = [];
  let rowNumber = 0;

  const pushRow = (row: WorkbookSheetInput["rows"][number]) => {
    rows.push(row);
    rowNumber += 1;
    return rowNumber;
  };

  pushRow([styled(`Testing Workpaper — ${formatControlName(control)}`, "title"), ""]);
  merges.push(`A${rowNumber}:B${rowNumber}`);

  pushRow([styled("Control", "metaKey"), styled(formatControlName(control), "metaValue")]);
  pushRow([styled("Last saved", "metaKey"), styled(formatExportTimestamp(updatedAt) || "Not saved yet", "metaValue")]);
  pushRow([styled("Exported", "metaKey"), styled(formatExportTimestamp(new Date().toISOString()), "metaValue")]);
  pushRow(["", ""]);

  for (const section of workpaperSections) {
    pushRow([styled(section.title, "sectionBand"), ""]);
    merges.push(`A${rowNumber}:B${rowNumber}`);

    for (const field of section.fields) {
      const rawValue = content ? field.getValue(content).trim() : "";
      const value = rawValue.length > 0 ? rawValue : content === null ? "(No saved testing workpaper)" : "—";
      pushRow([styled(field.label, "label"), styled(value, "tableCell")]);
    }
  }

  return {
    name: "Testing Workpaper",
    rows,
    columns: [{ width: 38 }, { width: 95 }],
    merges,
    freezeRow: 1,
  };
}

function buildMatrixSheet(matrix: ControlTestingMatrix, control: ControlExportRow, index: number): WorkbookSheetInput {
  const rows: WorkbookSheetInput["rows"] = [];
  const merges: string[] = [];
  const sampleColumnCount = 3 + matrix.attributes.length + 1; // ID, Description, Source ref, ...attributes, Exception
  const lastColumnLetter = indexToColumnLetters(sampleColumnCount - 1);
  let rowNumber = 0;

  const pushRow = (row: WorkbookSheetInput["rows"][number]) => {
    rows.push(row);
    rowNumber += 1;
    return rowNumber;
  };

  // Title
  pushRow([styled(matrix.title || `Test Plan ${index + 1}`, "title"), ...padBlanks(sampleColumnCount - 1)]);
  merges.push(`A${rowNumber}:${lastColumnLetter}${rowNumber}`);

  // Metadata block
  pushRow([styled("Control", "metaKey"), styled(formatControlName(control), "metaValue"), ...padBlanks(sampleColumnCount - 2)]);
  merges.push(`B${rowNumber}:${lastColumnLetter}${rowNumber}`);
  pushRow([
    styled("Population size", "metaKey"),
    styled(matrix.populationSize === undefined || matrix.populationSize === null ? "—" : String(matrix.populationSize), "metaValue"),
    ...padBlanks(sampleColumnCount - 2),
  ]);
  merges.push(`B${rowNumber}:${lastColumnLetter}${rowNumber}`);
  pushRow([
    styled("Sample size", "metaKey"),
    styled(String(matrix.sampleSize ?? matrix.samples.length), "metaValue"),
    ...padBlanks(sampleColumnCount - 2),
  ]);
  merges.push(`B${rowNumber}:${lastColumnLetter}${rowNumber}`);
  pushRow([
    styled("Population description", "metaKey"),
    styled(matrix.populationDescription || "—", "metaValue"),
    ...padBlanks(sampleColumnCount - 2),
  ]);
  merges.push(`B${rowNumber}:${lastColumnLetter}${rowNumber}`);
  pushRow([
    styled("Test plan", "metaKey"),
    styled(matrix.sampleDescription || "—", "metaValue"),
    ...padBlanks(sampleColumnCount - 2),
  ]);
  merges.push(`B${rowNumber}:${lastColumnLetter}${rowNumber}`);

  // Spacer
  pushRow(padBlanks(sampleColumnCount));

  // Table header
  const headerRow: WorkbookSheetInput["rows"][number] = [
    styled("Sample", "tableHeader"),
    styled("Description", "tableHeader"),
    styled("Source reference", "tableHeader"),
    ...matrix.attributes.map((attribute) => styled(attribute.label || "Untitled attribute", "tableHeader")),
    styled("Exception noted", "tableHeader"),
  ];
  const headerRowNumber = pushRow(headerRow);

  // Sample rows
  const resultLookup = new Map<string, TestingMatrixAttributeResult>();
  for (const result of matrix.results) {
    resultLookup.set(`${result.sampleId}:${result.attributeId}`, result.result);
  }

  for (const sample of matrix.samples) {
    const exceptionText = sample.exceptionNoted.trim();
    pushRow([
      styled(sample.sampleIdentifier, "tableCell"),
      styled(sample.sampleDescription || "", "tableCell"),
      styled(sample.sourceReference || "", "tableCell"),
      ...matrix.attributes.map((attribute) => {
        const value = resultLookup.get(`${sample.id}:${attribute.id}`) ?? "NOT_TESTED";
        return styled(formatResultLabel(value), resultStyle(value));
      }),
      styled(exceptionText, exceptionText.length > 0 ? "exception" : "tableCell"),
    ]);
  }

  const columns: Array<{ width: number }> = [
    { width: 12 },
    { width: 50 },
    { width: 22 },
    ...matrix.attributes.map(() => ({ width: 18 })),
    { width: 50 },
  ];

  return {
    name: sanitizeSheetName(matrix.title || `Test Plan ${index + 1}`),
    rows,
    columns,
    merges,
    freezeRow: headerRowNumber,
  };
}

function styled(value: string | number | null | undefined, style: WorkbookCellStyle): WorkbookCell {
  return { value, style };
}

function padBlanks(count: number) {
  return Array.from({ length: Math.max(0, count) }, () => "" as const);
}

function resultStyle(value: TestingMatrixAttributeResult): WorkbookCellStyle {
  if (value === "PASS") {
    return "pass";
  }

  if (value === "FAIL") {
    return "fail";
  }

  return "notTested";
}

function formatResultLabel(value: TestingMatrixAttributeResult) {
  if (value === "PASS") {
    return "Pass";
  }

  if (value === "FAIL") {
    return "Fail";
  }

  return "Not tested";
}

function formatExportTimestamp(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatControlName(control: ControlExportRow) {
  return [control.source_record_key, control.control_name].filter(Boolean).join(" - ");
}

function buildExportFileName(control: ControlExportRow) {
  const baseName = formatControlName(control) || "testing-bundle";
  const sanitized = baseName.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "testing-bundle";

  return `${sanitized}-testing-bundle.xlsx`;
}

function sanitizeSheetName(value: string) {
  return value.replace(/[\[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, 31);
}

function indexToColumnLetters(index: number) {
  let value = index + 1;
  let letters = "";

  while (value > 0) {
    const remainder = (value - 1) % 26;
    letters = String.fromCharCode(65 + remainder) + letters;
    value = Math.floor((value - 1) / 26);
  }

  return letters;
}
