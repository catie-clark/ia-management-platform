"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { useNotification } from "@/components/ui/notification-provider";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatHours, formatShortDate } from "@/lib/utils";
import type { AuditPhase, BudgetByPhase } from "@/types/audit";

type AuditHoursPlannerProps = {
  auditId: string | null;
  currentPhase: AuditPhase;
  mode: "live" | "prototype";
  phaseBudgets: BudgetByPhase[];
  totalBudgetHours: number | null;
  periodEnd: string | null;
  periodStart: string | null;
  planningStartDate: string | null;
  fieldworkStartDate: string | null;
  reportingStartDate: string | null;
};

const phases: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];

export function AuditHoursPlanner({
  auditId,
  currentPhase,
  mode,
  phaseBudgets,
  totalBudgetHours,
  periodEnd,
  periodStart,
  planningStartDate,
  fieldworkStartDate,
  reportingStartDate,
}: AuditHoursPlannerProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [totalBudgetInput, setTotalBudgetInput] = useState(toNumericInputValue(totalBudgetHours));
  const [periodStartInput, setPeriodStartInput] = useState(toDateInputValue(periodStart));
  const [periodEndInput, setPeriodEndInput] = useState(toDateInputValue(periodEnd));
  const [planningStartInput, setPlanningStartInput] = useState(toDateInputValue(planningStartDate) || toDateInputValue(periodStart));
  const [fieldworkStartInput, setFieldworkStartInput] = useState(toDateInputValue(fieldworkStartDate));
  const [reportingStartInput, setReportingStartInput] = useState(toDateInputValue(reportingStartDate));
  const [percentageInputs, setPercentageInputs] = useState<Record<AuditPhase, string>>(() =>
    buildInitialPercentageInputs(phaseBudgets, totalBudgetHours),
  );
  const [hourInputs, setHourInputs] = useState<Record<AuditPhase, string>>(() => buildInitialHourInputs(phaseBudgets));

  const canEdit = mode === "live" && Boolean(auditId) && currentPhase === "Planning";
  const parsedTotalBudget = parseNullableNumber(totalBudgetInput);
  const parsedHours = useMemo(
    () => ({
      Planning: parseNullableNumber(hourInputs.Planning),
      Fieldwork: parseNullableNumber(hourInputs.Fieldwork),
      Reporting: parseNullableNumber(hourInputs.Reporting),
    }),
    [hourInputs],
  );
  const plannedHourSum = phases.reduce((sum, phase) => sum + (parsedHours[phase] ?? 0), 0);
  const enteredPercentageSum = phases.reduce((sum, phase) => sum + (parseNullableNumber(percentageInputs[phase]) ?? 0), 0);
  const exceedsTotalBudget = parsedTotalBudget !== null && plannedHourSum > parsedTotalBudget;
  const hasUsableTotalBudget = parsedTotalBudget !== null && parsedTotalBudget > 0;
  const hasInvalidDateRange =
    periodStartInput.length === 0 ||
    periodEndInput.length === 0 ||
    periodStartInput > periodEndInput ||
    planningStartInput.length === 0 ||
    planningStartInput < periodStartInput ||
    (fieldworkStartInput.length > 0 && fieldworkStartInput < planningStartInput) ||
    (reportingStartInput.length > 0 && fieldworkStartInput.length > 0 && reportingStartInput < fieldworkStartInput) ||
    (reportingStartInput.length > 0 && reportingStartInput > periodEndInput);
  const hasInvalidHours =
    (parsedTotalBudget !== null && parsedTotalBudget < 0) ||
    phases.some((phase) => hourInputs[phase].trim().length > 0 && parsedHours[phase] === null) ||
    phases.some((phase) => percentageInputs[phase].trim().length > 0 && parseNullableNumber(percentageInputs[phase]) === null);

  const hasChanges =
    totalBudgetInput !== toNumericInputValue(totalBudgetHours) ||
    periodStartInput !== toDateInputValue(periodStart) ||
    periodEndInput !== toDateInputValue(periodEnd) ||
    planningStartInput !== (toDateInputValue(planningStartDate) || toDateInputValue(periodStart)) ||
    fieldworkStartInput !== toDateInputValue(fieldworkStartDate) ||
    reportingStartInput !== toDateInputValue(reportingStartDate) ||
    phases.some((phase) => hourInputs[phase] !== getInitialInputValue(phaseBudgets, phase));

  useEffect(() => {
    setTotalBudgetInput(toNumericInputValue(totalBudgetHours));
    setPeriodStartInput(toDateInputValue(periodStart));
    setPeriodEndInput(toDateInputValue(periodEnd));
    setPlanningStartInput(toDateInputValue(planningStartDate) || toDateInputValue(periodStart));
    setFieldworkStartInput(toDateInputValue(fieldworkStartDate));
    setReportingStartInput(toDateInputValue(reportingStartDate));
    setPercentageInputs(buildInitialPercentageInputs(phaseBudgets, totalBudgetHours));
    setHourInputs(buildInitialHourInputs(phaseBudgets));
  }, [fieldworkStartDate, periodEnd, periodStart, phaseBudgets, planningStartDate, reportingStartDate, totalBudgetHours]);

  const planningEndPreview = fieldworkStartInput || "Not set";
  const fieldworkEndPreview = reportingStartInput || "Not set";
  const reportingEndPreview = periodEndInput || "Not set";
  const phaseEndPreviewByPhase: Record<AuditPhase, string> = {
    Planning: planningEndPreview,
    Fieldwork: fieldworkEndPreview,
    Reporting: reportingEndPreview,
  };
  const phaseStartInputByPhase: Record<AuditPhase, string> = {
    Planning: planningStartInput,
    Fieldwork: fieldworkStartInput,
    Reporting: reportingStartInput,
  };
  const liveAuditTotalValue = parsedTotalBudget === null ? "Not set" : formatHours(parsedTotalBudget);
  const livePlannedHoursValue = formatHours(plannedHourSum);
  const liveEnteredSplitValue = hasUsableTotalBudget ? `${formatPercent(enteredPercentageSum)}%` : "Not active";
  const liveScheduleStart = planningStartInput || periodStartInput;
  const liveScheduleEnd = reportingEndPreview !== "Not set" ? reportingEndPreview : periodEndInput;
  const liveScheduleWindowValue =
    liveScheduleStart && liveScheduleEnd ? `${formatShortDate(liveScheduleStart)} - ${formatShortDate(liveScheduleEnd)}` : "Not set";

  return (
    <section className="border border-black/5 bg-white shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
      <div className="border-b border-black/5 px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Planning workspace</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Phase hours plan</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              {canEdit
                ? "Set the audit total, allocate hours by phase and maintain the working schedule in one workspace."
                : currentPhase !== "Planning"
                  ? "This workspace is editable during planning only. Later phases keep the saved budget and schedule."
                  : "Prototype mode shows the current sample allocation only."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 lg:justify-end">
            <StatusBadge status={currentPhase === "Planning" ? "Editable in planning" : "Read only"} tone={currentPhase === "Planning" && canEdit ? "success" : "neutral"} />
            <button
              type="button"
              disabled={isPending || !canEdit || !hasChanges || hasInvalidDateRange || hasInvalidHours || periodStartInput.length === 0 || periodEndInput.length === 0}
              onClick={() => {
                startTransition(async () => {
                  try {
                    const response = await fetch(`/api/audits/${auditId}/planner`, {
                      method: "PATCH",
                      headers: {
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({
                        totalBudgetHours: parsedTotalBudget,
                        planningBudgetHours: parsedHours.Planning,
                        fieldworkBudgetHours: parsedHours.Fieldwork,
                        reportingBudgetHours: parsedHours.Reporting,
                        periodStart: periodStartInput,
                        periodEnd: periodEndInput,
                        planningStartDate: toNullableDateInputValue(planningStartInput) ?? periodStartInput,
                        fieldworkStartDate: toNullableDateInputValue(fieldworkStartInput),
                        reportingStartDate: toNullableDateInputValue(reportingStartInput),
                      }),
                    });
                    const result = (await response.json()) as { error?: string };

                    if (!response.ok) {
                      throw new Error(result.error ?? "Unable to save the audit planner.");
                    }

                    showNotification({
                      title: "Planner saved",
                      message: exceedsTotalBudget
                        ? "Planner saved with a manual over-allocation above the audit total."
                        : "Audit hours and phase schedule were saved successfully.",
                      tone: "success",
                    });
                    router.refresh();
                  } catch (error) {
                    showNotification({
                      title: "Save failed",
                      message: error instanceof Error ? error.message : "There was an error saving the audit planner.",
                      tone: "error",
                    });
                  }
                });
              }}
              className="inline-flex items-center justify-center gap-2 rounded-md bg-[var(--brand-indigo-core)] px-3.5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save size={16} />
              {isPending ? "Saving..." : "Save plan"}
            </button>
          </div>
        </div>
      </div>

      <div className="px-5 py-4 sm:px-6">
        <div className="grid gap-px border border-black/5 bg-black/5 sm:grid-cols-2 xl:grid-cols-4">
          <CompactStat label="Audit total target" value={liveAuditTotalValue} detail="Audit-level budget target" />
          <CompactStat label="Planned hours" value={livePlannedHoursValue} detail="Current phase plan total" />
          <CompactStat
            label="Entered split"
            value={liveEnteredSplitValue}
            detail={hasUsableTotalBudget ? "Percent of total allocated" : "Add a total to enable split logic"}
          />
          <CompactStat
            label="Schedule window"
            value={liveScheduleWindowValue}
            detail="Current working schedule range"
          />
        </div>

        {(parsedTotalBudget === null || exceedsTotalBudget || hasInvalidDateRange || hasInvalidHours) ? (
          <div className="mt-4 grid gap-2">
            {parsedTotalBudget === null ? (
              <AlertRow tone="warning">
                Add a total hour target to enable percentage-based allocation. Manual phase-hour entry still works.
              </AlertRow>
            ) : null}
            {exceedsTotalBudget ? (
              <AlertRow tone="risk">
                Planned phase hours exceed the audit total by {formatHours(plannedHourSum - parsedTotalBudget)}. You can still save this override.
              </AlertRow>
            ) : null}
            {hasInvalidDateRange ? (
              <AlertRow tone="risk">
                Dates must stay in order: audit start, planning start, fieldwork start, reporting start, then audit end.
              </AlertRow>
            ) : null}
            {hasInvalidHours ? (
              <AlertRow tone="risk">
                Review the entered hours and percentages. Values must be non-negative numbers.
              </AlertRow>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 overflow-x-auto border border-black/5">
          <table className="min-w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <th className="border-b border-black/5 px-4 py-3">Phase</th>
                <th className="border-b border-black/5 px-4 py-3">Actual</th>
                <th className="border-b border-black/5 px-4 py-3">Percent of total</th>
                <th className="border-b border-black/5 px-4 py-3">Planned hours</th>
                <th className="border-b border-black/5 px-4 py-3">Phase start</th>
                <th className="border-b border-black/5 px-4 py-3">Phase end</th>
                <th className="border-b border-black/5 px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black/5 bg-[var(--surface-soft)] align-top">
                <td className="px-4 py-3 text-sm font-medium text-[var(--foreground)]">Audit total</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">All phases</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{hasUsableTotalBudget ? "100%" : "Not active"}</td>
                <td className="px-4 py-3">
                  <input
                    type="number"
                    min="0"
                    step="0.25"
                    disabled={!canEdit}
                    value={totalBudgetInput}
                    onChange={(event) => setTotalBudgetInput(event.target.value)}
                    className="w-full min-w-[140px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-tint)]"
                  />
                </td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{periodStartInput ? formatShortDate(periodStartInput) : "Not set"}</td>
                <td className="px-4 py-3 text-sm text-[var(--muted)]">{periodEndInput ? formatShortDate(periodEndInput) : "Not set"}</td>
                <td className="px-4 py-3"><StatusBadge status="Audit baseline" tone="neutral" /></td>
              </tr>
              {phases.map((phase) => {
                const actualHours = phaseBudgets.find((item) => item.phase === phase)?.actualHours ?? 0;

                return (
                  <tr key={phase} className="border-b border-black/5 bg-white align-top last:border-b-0">
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">{phase}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">Phase allocation and start boundary</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">{formatHours(actualHours)}</td>
                    <td className="px-4 py-3">
                      <div className="relative min-w-[132px]">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          disabled={!canEdit || !hasUsableTotalBudget}
                          value={percentageInputs[phase]}
                          onChange={(event) => {
                            const value = event.target.value;
                            setPercentageInputs((current) => ({ ...current, [phase]: value }));
                            const parsedPercentage = parseNullableNumber(value);
                            setHourInputs((current) => ({
                              ...current,
                              [phase]:
                                parsedPercentage === null || parsedTotalBudget === null
                                  ? value.trim().length === 0
                                    ? ""
                                    : current[phase]
                                  : formatPlannerNumber((parsedTotalBudget * parsedPercentage) / 100),
                            }));
                          }}
                          className="w-full rounded-md border border-black/10 bg-white px-3 py-2 pr-8 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-tint)]"
                        />
                        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--muted)]">%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        disabled={!canEdit}
                        value={hourInputs[phase]}
                        onChange={(event) => {
                          const value = event.target.value;
                          setHourInputs((current) => ({ ...current, [phase]: value }));
                          const parsedValue = parseNullableNumber(value);
                          setPercentageInputs((current) => ({
                            ...current,
                            [phase]:
                              parsedValue === null || parsedTotalBudget === null || parsedTotalBudget === 0
                                ? value.trim().length === 0
                                  ? ""
                                  : current[phase]
                                : formatPlannerNumber((parsedValue / parsedTotalBudget) * 100),
                          }));
                        }}
                        className="w-full min-w-[132px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-tint)]"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="date"
                        disabled={!canEdit}
                        value={phaseStartInputByPhase[phase]}
                        onChange={(event) => {
                          const nextValue = event.target.value;
                          if (phase === "Planning") {
                            setPlanningStartInput(nextValue);
                            return;
                          }
                          if (phase === "Fieldwork") {
                            setFieldworkStartInput(nextValue);
                            return;
                          }
                          setReportingStartInput(nextValue);
                        }}
                        className="w-full min-w-[160px] rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[var(--surface-tint)]"
                      />
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--muted)]">
                      {phaseEndPreviewByPhase[phase] === "Not set" ? "Not set" : formatShortDate(phaseEndPreviewByPhase[phase])}
                    </td>
                    <td className="px-4 py-3">
                      {phase === currentPhase ? <StatusBadge status="Current phase" tone="warning" /> : <StatusBadge status="Planned phase" tone="neutral" />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-col gap-2 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[var(--muted)]">Saving updates the audit total, phase budgets and phase start schedule in one step.</p>
          {!canEdit ? <p className="text-sm font-medium text-[var(--muted)]">Editing is available on live audits during planning.</p> : null}
        </div>
      </div>
    </section>
  );
}

function CompactStat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="bg-white px-4 py-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
    </div>
  );
}

function AlertRow({ tone, children }: { tone: "warning" | "risk"; children: React.ReactNode }) {
  return (
    <div
      className={
        tone === "risk"
          ? "border border-[rgba(229,55,107,0.2)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]"
          : "border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--muted)]"
      }
    >
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
      {label}
      {children}
    </label>
  );
}

function buildInitialHourInputs(phaseBudgets: BudgetByPhase[]) {
  return {
    Planning: getInitialInputValue(phaseBudgets, "Planning"),
    Fieldwork: getInitialInputValue(phaseBudgets, "Fieldwork"),
    Reporting: getInitialInputValue(phaseBudgets, "Reporting"),
  };
}

function buildInitialPercentageInputs(phaseBudgets: BudgetByPhase[], totalBudgetHours: number | null): Record<AuditPhase, string> {
  if (totalBudgetHours === null || totalBudgetHours <= 0) {
    return {
      Planning: "",
      Fieldwork: "",
      Reporting: "",
    };
  }

  return {
    Planning: formatPlannerNumber(((phaseBudgets.find((phase) => phase.phase === "Planning")?.plannedHours ?? 0) / totalBudgetHours) * 100),
    Fieldwork: formatPlannerNumber(((phaseBudgets.find((phase) => phase.phase === "Fieldwork")?.plannedHours ?? 0) / totalBudgetHours) * 100),
    Reporting: formatPlannerNumber(((phaseBudgets.find((phase) => phase.phase === "Reporting")?.plannedHours ?? 0) / totalBudgetHours) * 100),
  };
}

function getInitialInputValue(phaseBudgets: BudgetByPhase[], phase: AuditPhase) {
  const phaseBudget = phaseBudgets.find((item) => item.phase === phase);

  if (!phaseBudget) {
    return "";
  }

  return phaseBudget.isSet ? String(phaseBudget.plannedHours) : "";
}

function parseNullableNumber(value: string) {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function toNumericInputValue(value: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return "";
  }

  return value.includes("T") ? value.slice(0, 10) : value;
}

function toNullableDateInputValue(value: string) {
  return value.trim().length === 0 ? null : value;
}

function formatPlannerNumber(value: number) {
  if (!Number.isFinite(value)) {
    return "";
  }

  const rounded = Math.round(value * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function formatPercent(value: number) {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}
