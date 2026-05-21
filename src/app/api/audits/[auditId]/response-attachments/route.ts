import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const RESPONSE_ATTACHMENTS_BUCKET = "response-attachments";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && uuidPattern.test(value.trim()) ? value.trim() : undefined),
  z.string().uuid().optional(),
);

const createResponseAttachmentSchema = z
  .object({
    controlId: z.string().uuid().optional(),
    description: z.string().trim().optional(),
    fileName: z.string().trim().min(1),
    fileSizeBytes: z.number().int().nonnegative().optional(),
    mimeType: z.string().trim().min(1).optional(),
    ownerUserId: optionalUuid,
    questionId: z.string().uuid().optional(),
    requestId: z.string().uuid().optional(),
  })
  .refine((value) => !(value.questionId && value.requestId), {
    message: "An attachment can reference either a question or a request, but not both.",
    path: ["questionId"],
  })
  .refine((value) => Boolean(value.controlId || value.questionId || value.requestId), {
    message: "An attachment must be linked to a control, question, or request.",
    path: ["questionId"],
  });

type AuditDocumentRecord = {
  id: string;
  document_type: string;
  title: string;
  control_id: string | null;
  question_id: string | null;
  request_id: string | null;
  owner_user_id: string | null;
  status: string;
  due_date: string | null;
  template_name: string | null;
  source_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required." }, { status: 400 });
    }

    const body = createResponseAttachmentSchema.parse({
      controlId: getOptionalString(formData, "controlId"),
      description: getOptionalString(formData, "description"),
      fileName: getOptionalString(formData, "fileName") ?? file.name,
      fileSizeBytes: file.size,
      mimeType: file.type || undefined,
      ownerUserId: getOptionalString(formData, "ownerUserId"),
      questionId: getOptionalString(formData, "questionId"),
      requestId: getOptionalString(formData, "requestId"),
    });
    const supabase = createSupabaseAdminClient();
    const linkedEntityType = body.questionId ? "question" : body.requestId ? "request" : "control";
    const linkedEntityId = body.questionId ?? body.requestId ?? body.controlId ?? "unlinked";
    const storagePath = buildStoragePath({
      auditId,
      fileName: body.fileName,
      linkedEntityId,
      linkedEntityType,
    });

    const { error: uploadError } = await supabase.storage.from(RESPONSE_ATTACHMENTS_BUCKET).upload(storagePath, file, {
      cacheControl: "3600",
      contentType: body.mimeType,
      upsert: false,
    });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const { data: createdAttachment, error } = await supabase
      .from("audit_documents")
      .insert({
        audit_id: auditId,
        source_system: "manual",
        source_record_key: `manual-response-attachment-${crypto.randomUUID()}`,
        document_type: "EVIDENCE",
        title: body.fileName,
        control_id: body.controlId ?? null,
        question_id: body.questionId ?? null,
        request_id: body.requestId ?? null,
        owner_user_id: body.ownerUserId ?? null,
        status: "complete",
        source_payload: {
          attached_in_control_panel: linkedEntityType === "control",
          attached_in_response_panel: linkedEntityType === "question" || linkedEntityType === "request",
          attachment_description: body.description ?? null,
          file_name: body.fileName,
          original_file_name: file.name,
          file_size_bytes: body.fileSizeBytes ?? null,
          mime_type: body.mimeType ?? null,
          storage_bucket: RESPONSE_ATTACHMENTS_BUCKET,
          storage_path: storagePath,
          linked_entity_type: linkedEntityType,
          linked_entity_id: linkedEntityId,
          uploaded_at: new Date().toISOString(),
          uploaded_in_app: true,
          preview_summary: body.description ?? `Uploaded attachment linked to this ${linkedEntityType}.`,
          preview_sections: [
            {
              heading: "Attachment metadata",
              body: [
                `Display name: ${body.fileName}`,
                `Original file name: ${file.name}`,
                ...(body.description ? [`Description: ${body.description}`] : []),
                `File size: ${formatFileSize(body.fileSizeBytes ?? 0)}`,
                `File type: ${body.mimeType ?? "Unknown"}`,
                `Storage bucket: ${RESPONSE_ATTACHMENTS_BUCKET}`,
              ],
            },
          ],
        },
      })
      .select("id, document_type, title, control_id, question_id, request_id, owner_user_id, status, due_date, template_name, source_payload, created_at, updated_at")
      .maybeSingle<AuditDocumentRecord>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json(createdAttachment, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid response attachment payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create response attachment.",
      },
      { status: 400 },
    );
  }
}

function getOptionalString(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function buildStoragePath({
  auditId,
  fileName,
  linkedEntityId,
  linkedEntityType,
}: {
  auditId: string;
  fileName: string;
  linkedEntityId: string;
  linkedEntityType: "control" | "question" | "request";
}) {
  const safeFileName = sanitizeFileName(fileName);
  return `${auditId}/${linkedEntityType}/${linkedEntityId}/${Date.now()}-${crypto.randomUUID()}-${safeFileName}`;
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-");
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}
