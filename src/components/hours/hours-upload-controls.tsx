"use client";

import { useRef, useTransition } from "react";
import { Download, Upload } from "lucide-react";
import { useRouter } from "next/navigation";

import { useNotification } from "@/components/ui/notification-provider";

export function HoursUploadControls({
  auditId,
  mode,
}: {
  auditId: string | null;
  mode: "live" | "prototype";
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const router = useRouter();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const canUpload = mode === "live" && Boolean(auditId);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];

          if (!file || !auditId) {
            event.target.value = "";
            return;
          }

          startTransition(async () => {
            try {
              const formData = new FormData();
              formData.set("file", file);

              const response = await fetch(`/api/audits/${auditId}/hours-import`, {
                method: "POST",
                body: formData,
              });
              const result = (await response.json()) as { error?: string; errors?: string[]; importedCount?: number };

              if (!response.ok) {
                const message = result.errors?.length ? result.errors.slice(0, 3).join(" ") : (result.error ?? "Unable to upload audit hours.");
                throw new Error(message);
              }

              showNotification({
                title: "Hours uploaded",
                message: `${result.importedCount ?? 0} hours rows were saved to Supabase. Existing uploaded hours for this audit were replaced.`,
                tone: "success",
              });
              router.refresh();
            } catch (error) {
              showNotification({
                title: "Upload failed",
                message: error instanceof Error ? error.message : "Unable to upload audit hours.",
                tone: "error",
              });
            } finally {
              event.target.value = "";
            }
          });
        }}
      />

      <button
        type="button"
        disabled={!canUpload || isPending}
        onClick={() => fileInputRef.current?.click()}
        className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-indigo-core)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Upload size={16} />
        {isPending ? "Uploading..." : "Upload hours"}
      </button>

      <button
        type="button"
        disabled={!canUpload || isPending}
        onClick={() => {
          if (!auditId) {
            return;
          }

          window.location.href = `/api/audits/${auditId}/hours-import/sample`;
        }}
        className="inline-flex items-center justify-center gap-2 rounded-md border border-black/10 bg-white px-3.5 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-soft)] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <Download size={16} />
        Download sample CSV
      </button>
    </div>
  );
}
