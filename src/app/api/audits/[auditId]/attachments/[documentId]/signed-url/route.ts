import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttachmentDocumentRecord = {
  id: string;
  source_payload: Record<string, unknown> | null;
  title: string;
};

export async function GET(request: Request, context: { params: Promise<{ auditId: string; documentId: string }> }) {
  try {
    const { auditId, documentId } = await context.params;
    const { searchParams } = new URL(request.url);
    const mode = searchParams.get("mode") === "download" ? "download" : "preview";
    const supabase = createSupabaseAdminClient();
    const { data: document, error } = await supabase
      .from("audit_documents")
      .select("id, title, source_payload")
      .eq("audit_id", auditId)
      .eq("id", documentId)
      .maybeSingle<AttachmentDocumentRecord>();

    if (error) {
      throw new Error(error.message);
    }

    if (!document) {
      return NextResponse.json({ error: "Attachment was not found for this audit." }, { status: 404 });
    }

    const storageBucket = readText(document.source_payload ?? {}, "storage_bucket");
    const storagePath = readText(document.source_payload ?? {}, "storage_path");

    if (!storageBucket || !storagePath) {
      return NextResponse.json({ error: "This document does not have a stored attachment." }, { status: 400 });
    }

    const expiresIn = 300;
    const { data, error: signedUrlError } = await supabase.storage.from(storageBucket).createSignedUrl(
      storagePath,
      expiresIn,
      mode === "download" ? { download: buildDownloadFileName(document) } : undefined,
    );

    if (signedUrlError) {
      throw new Error(signedUrlError.message);
    }

    return NextResponse.json({ expiresIn, url: data.signedUrl });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to create an attachment link.",
      },
      { status: 400 },
    );
  }
}

function buildDownloadFileName(document: AttachmentDocumentRecord) {
  return readText(document.source_payload ?? {}, "original_file_name") ?? readText(document.source_payload ?? {}, "file_name") ?? document.title;
}

function readText(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}
