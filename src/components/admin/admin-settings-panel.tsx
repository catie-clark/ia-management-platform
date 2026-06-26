"use client";

import { useEffect, useState, useTransition } from "react";

import { useNotification } from "@/components/ui/notification-provider";
import {
  defaultAuditWorkspaceSettings,
  formatReviewWorkflowStageLabel,
  reviewWorkflowStages,
  type AuditWorkspaceSettings,
} from "@/lib/audit-settings";
import type { DocumentReviewStatus } from "@/types/audit";

export function AdminSettingsPanel({ auditId }: { auditId: string | null }) {
  const { showNotification } = useNotification();
  const [settings, setSettings] = useState<AuditWorkspaceSettings>(defaultAuditWorkspaceSettings);
  const [stageLabelsDraft, setStageLabelsDraft] = useState(defaultAuditWorkspaceSettings.reviewWorkflowStageLabels);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!auditId) {
      setSettings(defaultAuditWorkspaceSettings);
      setStageLabelsDraft(defaultAuditWorkspaceSettings.reviewWorkflowStageLabels);
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/settings`, { cache: "no-store" });
        const payload = (await response.json()) as { error?: string; settings?: AuditWorkspaceSettings };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load audit settings.");
        }

        if (!cancelled) {
          const nextSettings = payload.settings ?? defaultAuditWorkspaceSettings;
          setSettings(nextSettings);
          setStageLabelsDraft(nextSettings.reviewWorkflowStageLabels);
        }
      } catch (error) {
        if (!cancelled) {
          setSettings(defaultAuditWorkspaceSettings);
          setStageLabelsDraft(defaultAuditWorkspaceSettings.reviewWorkflowStageLabels);
          showNotification({
            title: "Settings unavailable",
            message: error instanceof Error ? error.message : "Unable to load audit settings.",
            tone: "error",
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditId, showNotification]);

  if (!auditId) {
    return null;
  }

  const hasStageLabelChanges = reviewWorkflowStages.some(
    (stage) => stageLabelsDraft[stage].trim() !== settings.reviewWorkflowStageLabels[stage],
  );

  return (
    <section className="border border-black/6 bg-white p-5">
      <div className="divide-y divide-black/5">
        <div className="pb-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[var(--foreground)]">Show control budgeted hours</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                When off, control planning focuses on owner and due date only. Planned hours stay stored in the data model but are hidden from the control testing workspace.
              </p>
            </div>

            <button
              type="button"
              aria-pressed={settings.showControlBudgetHours}
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const nextValue = !settings.showControlBudgetHours;

                  try {
                    const response = await fetch(`/api/audits/${auditId}/settings`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        showControlBudgetHours: nextValue,
                      }),
                    });
                    const payload = (await response.json()) as { error?: string; settings?: AuditWorkspaceSettings };

                    if (!response.ok) {
                      throw new Error(payload.error ?? "Unable to save audit settings.");
                    }

                    const nextSettings = payload.settings ?? { ...settings, showControlBudgetHours: nextValue };
                    setSettings(nextSettings);
                    window.dispatchEvent(new CustomEvent("audit-settings-updated", { detail: { auditId, settings: nextSettings } }));
                    showNotification({
                      title: "Settings updated",
                      message: nextValue
                        ? "Control budgeted hours are visible again."
                        : "Control budgeted hours are now hidden for this audit.",
                      tone: "success",
                    });
                  } catch (error) {
                    showNotification({
                      title: "Unable to save settings",
                      message: error instanceof Error ? error.message : "Unable to save audit settings.",
                      tone: "error",
                    });
                  }
                })
              }
              className={`relative inline-flex h-12 w-24 shrink-0 items-center rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                settings.showControlBudgetHours
                  ? "border-[rgba(1,30,65,0.08)] bg-[var(--brand-indigo-core)]"
                  : "border-black/10 bg-[rgba(1,30,65,0.12)]"
              }`}
            >
              <span
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full bg-white text-[11px] font-semibold text-[var(--brand-indigo-core)] shadow-[0_8px_20px_rgba(1,30,65,0.12)] transition-transform ${
                  settings.showControlBudgetHours ? "translate-x-[2.8rem]" : "translate-x-1"
                }`}
              >
                {settings.showControlBudgetHours ? "On" : "Off"}
              </span>
            </button>
          </div>
        </div>

        <div className="pt-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-[var(--foreground)]">Workflow review stage labels</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                Rename the visible review stages for this audit workspace. The routing logic stays the same; only the labels change.
              </p>
            </div>

            <button
              type="button"
              disabled={!hasStageLabelChanges || isPending}
              onClick={() =>
                startTransition(async () => {
                  try {
                    const response = await fetch(`/api/audits/${auditId}/settings`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        reviewWorkflowStageLabels: stageLabelsDraft,
                      }),
                    });
                    const payload = (await response.json()) as { error?: string; settings?: AuditWorkspaceSettings };

                    if (!response.ok) {
                      throw new Error(payload.error ?? "Unable to save audit settings.");
                    }

                    const nextSettings = payload.settings ?? {
                      ...settings,
                      reviewWorkflowStageLabels: stageLabelsDraft,
                    };
                    setSettings(nextSettings);
                    setStageLabelsDraft(nextSettings.reviewWorkflowStageLabels);
                    window.dispatchEvent(new CustomEvent("audit-settings-updated", { detail: { auditId, settings: nextSettings } }));
                    showNotification({
                      title: "Settings updated",
                      message: "Workflow review stage labels were saved.",
                      tone: "success",
                    });
                  } catch (error) {
                    showNotification({
                      title: "Unable to save settings",
                      message: error instanceof Error ? error.message : "Unable to save audit settings.",
                      tone: "error",
                    });
                  }
                })
              }
              className="inline-flex items-center justify-center rounded-md border border-black/10 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save stage labels
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            {reviewWorkflowStages.map((stage) => (
              <label key={stage} className="grid gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {formatDefaultStageName(stage)}
                </span>
                <input
                  type="text"
                  value={stageLabelsDraft[stage]}
                  disabled={isPending}
                  onChange={(event) =>
                    setStageLabelsDraft((current) => ({
                      ...current,
                      [stage]: event.target.value,
                    }))
                  }
                  placeholder={formatReviewWorkflowStageLabel(stage)}
                  className="h-9 border border-black/10 bg-white px-3 text-sm text-[var(--foreground)] outline-none transition focus:border-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </label>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function formatDefaultStageName(stage: DocumentReviewStatus) {
  return `${formatReviewWorkflowStageLabel(stage)} default`;
}
