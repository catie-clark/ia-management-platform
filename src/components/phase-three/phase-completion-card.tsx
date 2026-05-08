"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useNotification } from "@/components/ui/notification-provider";
import { getNextAuditPhase } from "@/lib/audit-phase";
import type { AuditPhase } from "@/types/audit";

type PhaseCompletionCardProps = {
  auditId: string | null;
  auditLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
  pagePhase: AuditPhase;
};

type PhaseUpdateResponse = {
  auditId: string;
  status: string;
  activePhase: AuditPhase;
  completedPhase: AuditPhase;
  nextPhase: AuditPhase | null;
};

export function PhaseCompletionCard({
  auditId,
  auditLabel,
  auditStatus,
  currentPhase,
  pagePhase,
}: PhaseCompletionCardProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const nextPhase = getNextAuditPhase(pagePhase);
  const workspaceQuery = useMemo(() => {
    const params = new URLSearchParams(searchParams.toString());

    if (auditId) {
      params.set("mode", "live");
      params.set("auditId", auditId);
      params.set("auditLabel", auditLabel);
    }

    return params;
  }, [auditId, auditLabel, searchParams]);

  if (!auditId) {
    return (
      <section className="border border-black/5 bg-[var(--surface-soft)] p-5 shadow-[0_8px_24px_rgba(1,30,65,0.05)]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Phase transition</p>
        <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">No audit selected</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
          Marking a phase complete requires a saved audit because it updates the audit record in Supabase.
        </p>
      </section>
    );
  }

  const isAuditComplete = auditStatus.trim().toLowerCase() === "complete";
  const isCurrentPageActive = currentPhase === pagePhase;

  return (
    <section className="border border-black/5 bg-[var(--surface-soft)] p-5 shadow-[0_8px_24px_rgba(1,30,65,0.05)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Phase transition</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {isAuditComplete ? "This audit is already complete" : `${pagePhase} completion control`}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            {isAuditComplete
              ? `${auditLabel} has already been marked complete.`
              : isCurrentPageActive
                ? nextPhase
                  ? `Marking ${pagePhase.toLowerCase()} complete will advance the audit to ${nextPhase.toLowerCase()}.`
                  : "Marking reporting complete will close the audit."
                : `${auditLabel} is currently in ${currentPhase.toLowerCase()}, so this page cannot complete the phase right now.`}
          </p>
        </div>

        {!isAuditComplete && isCurrentPageActive ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() => {
              startTransition(async () => {
                try {
                  const response = await fetch(`/api/audits/${auditId}/phase`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ currentPhase: pagePhase }),
                  });
                  const result = (await response.json()) as PhaseUpdateResponse | { error?: string };

                  if (!response.ok) {
                    throw new Error(("error" in result && result.error) || "Unable to update the phase.");
                  }

                  const successResult = result as PhaseUpdateResponse;

                  const nextPath =
                    successResult.nextPhase === "Fieldwork"
                      ? "/fieldwork"
                      : successResult.nextPhase === "Reporting"
                        ? "/reporting"
                        : null;

                  showNotification({
                    title: "Saved successfully",
                    message: successResult.nextPhase
                      ? `${pagePhase} was completed and the audit moved to ${successResult.nextPhase}.`
                      : "Reporting was completed and the audit is now complete.",
                    tone: "success",
                  });

                  if (nextPath) {
                    router.push(`${nextPath}?${workspaceQuery.toString()}`);
                    return;
                  }

                  router.refresh();
                } catch (error) {
                  showNotification({
                    title: "Save failed",
                    message: error instanceof Error ? error.message : "There was an error updating the phase.",
                    tone: "error",
                  });
                }
              });
            }}
            className="inline-flex items-center justify-center rounded-md bg-[var(--brand-indigo-core)] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Updating..." : `Mark ${pagePhase.toLowerCase()} complete`}
          </button>
        ) : null}
      </div>
    </section>
  );
}
