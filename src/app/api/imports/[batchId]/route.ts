import { NextResponse } from "next/server";
import { z } from "zod";

import { supabaseRestRequest } from "@/lib/supabase-rest";

const batchIdSchema = z.string().uuid("Batch id must be a valid UUID.");

type ImportBatchStatusRecord = {
  id: string;
  source_system: string;
  status: string;
  row_count: number;
  uploaded_at: string;
  parse_errors: unknown[];
  archive_metadata: Record<string, unknown>;
  notes: string | null;
  import_files: Array<{
    id: string;
    file_name: string;
    source_entity: string;
    row_count: number;
    parsed_at: string | null;
    created_at: string;
  }>;
};

export async function GET(_: Request, context: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await context.params;
    const parsedBatchId = batchIdSchema.parse(batchId);
    const encodedFilter = encodeURIComponent(parsedBatchId);
    const rows = await supabaseRestRequest<ImportBatchStatusRecord[]>(
      `import_batches?id=eq.${encodedFilter}&select=id,source_system,status,row_count,uploaded_at,parse_errors,archive_metadata,notes,import_files(id,file_name,source_entity,row_count,parsed_at,created_at)`,
    );
    const [batch] = rows;

    if (!batch) {
      return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
    }

    return NextResponse.json(batch);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load import batch.",
      },
      { status: 400 },
    );
  }
}
