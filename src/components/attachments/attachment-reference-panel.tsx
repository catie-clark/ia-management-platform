"use client";

import { useEffect, useState } from "react";
import { Download, Eye, FileText, Paperclip, X } from "lucide-react";

import { StatusBadge } from "@/components/ui/status-badge";
import { formatDateTime } from "@/lib/utils";
import type { AuditDocument } from "@/types/audit";

type SignedUrlResponse = {
  error?: string;
  url?: string;
};

type AttachmentReferencePanelProps = {
  actionSlot?: React.ReactNode;
  attachments: AuditDocument[];
  auditId: string | null;
  children?: React.ReactNode;
  description?: string;
  emptyMessage: string;
  title?: string;
};

export function AttachmentReferencePanel({
  actionSlot,
  attachments,
  auditId,
  children,
  description,
  emptyMessage,
  title = "Control attachments",
}: AttachmentReferencePanelProps) {
  const [previewDocument, setPreviewDocument] = useState<AuditDocument | null>(null);

  return (
    <section className="border border-[rgba(1,30,65,0.14)] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(1,30,65,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-black/10 pb-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{title}</p>
          {description ? <p className="mt-1 text-xs text-[var(--muted)]">{description}</p> : null}
        </div>
        {actionSlot}
      </div>

      {children ? <div className="mt-3">{children}</div> : null}

      <div className="mt-3 grid gap-2.5">
        {attachments.length > 0 ? (
          attachments.map((document) => (
            <AttachmentRow
              key={document.id}
              auditId={auditId}
              document={document}
              onPreview={() => setPreviewDocument(document)}
            />
          ))
        ) : (
          <p className="text-[13px] text-[var(--muted)]">{emptyMessage}</p>
        )}
      </div>

      <AttachmentPreviewModal auditId={auditId} document={previewDocument} onClose={() => setPreviewDocument(null)} />
    </section>
  );
}

function AttachmentRow({
  auditId,
  document,
  onPreview,
}: {
  auditId: string | null;
  document: AuditDocument;
  onPreview: () => void;
}) {
  const attachment = document.attachment;
  const canDownload = Boolean(auditId && attachment?.storageBucket && attachment.storagePath);

  return (
    <article className="border border-black/5 bg-[var(--surface-tint)] px-3.5 py-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Paperclip size={14} className="text-[var(--brand-indigo-core)]" />
            <p className="text-[13px] font-semibold text-[var(--foreground)]">{document.title}</p>
          </div>
          {attachment?.description ? <p className="mt-1 text-[13px] leading-5 text-[var(--foreground)]">{attachment.description}</p> : null}
          <div className="mt-2 flex flex-wrap gap-2">
            {attachment?.fileSizeBytes !== undefined ? <StatusBadge status={formatFileSize(attachment.fileSizeBytes)} tone="neutral" /> : null}
            {attachment?.uploadedAt ? <StatusBadge status={formatDateTime(attachment.uploadedAt)} tone="warning" /> : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onPreview}
            className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
          >
            <Eye size={14} />
            Preview
          </button>
          <button
            type="button"
            onClick={() => void downloadAttachment(auditId, document)}
            disabled={!canDownload}
            className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </div>
    </article>
  );
}

export function AttachmentPreviewModal({
  auditId,
  document,
  onClose,
}: {
  auditId: string | null;
  document: AuditDocument | null;
  onClose: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState("");
  const [error, setError] = useState("");
  const canPreviewFile = Boolean(document && auditId && document.attachment?.storageBucket && document.attachment.storagePath && isBrowserPreviewable(document));

  useEffect(() => {
    let cancelled = false;
    setSignedUrl("");
    setError("");

    if (!document || !canPreviewFile || !auditId) {
      return;
    }

    fetch(`/api/audits/${auditId}/attachments/${document.id}/signed-url?mode=preview`)
      .then(async (response) => {
        const payload = (await response.json()) as SignedUrlResponse;

        if (!response.ok || !payload.url) {
          throw new Error(payload.error ?? "Unable to create a preview link.");
        }

        if (!cancelled) {
          setSignedUrl(payload.url);
        }
      })
      .catch((previewError) => {
        if (!cancelled) {
          setError(previewError instanceof Error ? previewError.message : "Unable to preview this attachment.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [auditId, canPreviewFile, document]);

  if (!document) {
    return null;
  }

  const attachment = document.attachment;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[rgba(1,30,65,0.38)] p-4 backdrop-blur-sm">
      <div className="flex h-[min(88vh,900px)] w-full max-w-5xl flex-col border border-black/10 bg-[#f8f6f1] shadow-[0_24px_80px_rgba(1,30,65,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Attachment preview</p>
            <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{document.title}</h2>
            {attachment?.description ? <p className="mt-1 max-w-3xl text-sm leading-6 text-[var(--muted)]">{attachment.description}</p> : null}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void downloadAttachment(auditId, document)}
              disabled={!auditId || !attachment?.storageBucket || !attachment.storagePath}
              className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Download size={15} />
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-sm border border-black/10 bg-white text-[var(--brand-indigo-core)]"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-hidden p-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-h-0 overflow-hidden border border-black/10 bg-white">
            {canPreviewFile && signedUrl ? (
              attachment?.mimeType?.startsWith("image/") ? (
                <div className="flex h-full items-center justify-center overflow-auto bg-[#111827] p-4">
                  <img src={signedUrl} alt={document.title} className="max-h-full max-w-full object-contain" />
                </div>
              ) : (
                <iframe title={document.title} src={signedUrl} className="h-full w-full bg-white" />
              )
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                <FileText size={34} className="text-[var(--brand-indigo-core)]" />
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {error || "This file type cannot be previewed directly in the browser."}
                </p>
                <p className="max-w-md text-sm leading-6 text-[var(--muted)]">Use Download to open the original attachment locally.</p>
              </div>
            )}
          </div>

          <aside className="overflow-y-auto border border-black/10 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">File details</p>
            <dl className="mt-3 grid gap-3 text-sm">
              <AttachmentDetail label="Display name" value={document.title} />
              <AttachmentDetail label="Original file" value={attachment?.originalFileName ?? attachment?.fileName ?? "Not available"} />
              <AttachmentDetail label="Type" value={attachment?.mimeType ?? "Unknown"} />
              <AttachmentDetail label="Size" value={attachment?.fileSizeBytes !== undefined ? formatFileSize(attachment.fileSizeBytes) : "Unknown"} />
              <AttachmentDetail label="Uploaded" value={attachment?.uploadedAt ? formatDateTime(attachment.uploadedAt) : "Not available"} />
            </dl>
          </aside>
        </div>
      </div>
    </div>
  );
}

function AttachmentDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</dt>
      <dd className="mt-1 break-words text-[13px] text-[var(--foreground)]">{value}</dd>
    </div>
  );
}

function isBrowserPreviewable(document: AuditDocument) {
  const mimeType = document.attachment?.mimeType?.toLowerCase() ?? "";
  return mimeType.startsWith("image/") || mimeType === "application/pdf" || mimeType.startsWith("text/") || mimeType === "text/csv";
}

async function downloadAttachment(auditId: string | null, document: AuditDocument) {
  if (!auditId || !document.attachment?.storageBucket || !document.attachment.storagePath) {
    return;
  }

  const response = await fetch(`/api/audits/${auditId}/attachments/${document.id}/signed-url?mode=download`);
  const payload = (await response.json()) as SignedUrlResponse;

  if (!response.ok || !payload.url) {
    throw new Error(payload.error ?? "Unable to create a download link.");
  }

  window.location.href = payload.url;
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
