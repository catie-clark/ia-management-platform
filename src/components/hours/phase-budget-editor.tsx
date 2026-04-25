"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatHours } from "@/lib/utils";
import type { AuditPhase, BudgetByPhase } from "@/types/audit";

type PhaseBudgetEditorProps = {
  auditId: string | null;
  currentPhase: AuditPhase;
  mode: "live" | "prototype";
  phaseBudgets: BudgetByPhase[];
};

export function PhaseBudgetEditor({ auditId, currentPhase, mode, phaseBudgets }: PhaseBudgetEditorProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [budgetInputs, setBudgetInputs] = useState<Record<AuditPhase, string>>(() => ({
    Planning: getInitialInputValue(phaseBudgets, "Planning"),
    Fieldwork: getInitialInputValue(phaseBudgets, "Fieldwork"),
    Reporting: getInitialInputValue(phaseBudgets, "Reporting"),
  }));

  const canEdit = mode === "live" && Boolean(auditId);
  const hasChanges = useMemo(
    () =>
      ["Planning", "Fieldwork", "Reporting"].some(
        (phase) => budgetInputs[phase as AuditPhase] !== getInitialInputValue(phaseBudgets, phase as AuditPhase),
      ),
    [budgetInputs, phaseBudgets],
  );

  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Phase pacing</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Budget by phase</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {canEdit
              ? "Enter the planned hours for each audit phase. Actual hours stay at zero for future phases until the audit advances."
              : "Phase budgets are editable on saved live audits. Prototype mode shows the current planning scenario only."}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            disabled={isPending || !hasChanges}
            onClick={() => {
              startTransition(async () => {
                try {
                  const response = await fetch(`/api/audits/${auditId}/phase-budgets`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      planningBudgetHours: parseBudgetInput(budgetInputs.Planning),
                      fieldworkBudgetHours: parseBudgetInput(budgetInputs.Fieldwork),
                      reportingBudgetHours: parseBudgetInput(budgetInputs.Reporting),
                    }),
                  });
                  const result = (await response.json()) as { error?: string };

                  if (!response.ok) {
                    throw new Error("Unable to save the phase budgets.");
                  }

                  showNotification({
                    title: "Saved successfully",
                    message: "Phase budgets were saved successfully.",
                    tone: "success",
                  });
                  router.refresh();
                } catch {
                  showNotification({
                    title: "Save failed",
                    message: "There was an error saving the phase budgets.",
                    tone: "error",
                  });
                }
              });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {isPending ? "Saving..." : "Save phase budgets"}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3">
        {phaseBudgets.map((phase) => {
          const phaseVariance = phase.actualHours - phase.plannedHours;
          const tone = phase.phase === currentPhase ? (phaseVariance > 0 ? "risk" : phaseVariance === 0 ? "warning" : "success") : "neutral";

          return (
            <div key={phase.phase} className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[var(--foreground)]">{phase.phase}</p>
                    {phase.phase === currentPhase ? <StatusBadge status="Current phase" tone="warning" /> : null}
                  </div>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {formatHours(phase.actualHours)} actual / {formatHours(phase.plannedHours)} planned
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex flex-col gap-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                    Planned hours
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      disabled={!canEdit || isPending}
                      value={budgetInputs[phase.phase]}
                      onChange={(event) =>
                        setBudgetInputs((current) => ({
                          ...current,
                          [phase.phase]: event.target.value,
                        }))
                      }
                      placeholder="Enter hours"
                      className="w-40 rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
                    />
                  </label>
                  <StatusBadge
                    status={phaseVariance > 0 ? `+${formatHours(phaseVariance)}` : phaseVariance === 0 ? "On plan" : `${formatHours(Math.abs(phaseVariance))} under`}
                    tone={tone}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getInitialInputValue(phaseBudgets: BudgetByPhase[], phase: AuditPhase) {
  const phaseBudget = phaseBudgets.find((item) => item.phase === phase);

  if (!phaseBudget) {
    return "";
  }

  return phaseBudget.isSet ? String(phaseBudget.plannedHours) : "";
}

function parseBudgetInput(value: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}
