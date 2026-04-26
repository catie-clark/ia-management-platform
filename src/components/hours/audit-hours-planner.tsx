"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, PieChart, Save } from "lucide-react";

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
  const [isModalOpen, setIsModalOpen] = useState(false);
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

  return (
    <>
      <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Planning allocator</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Phase hours planner</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              {canEdit
                ? "Launch the planner to set the audit total, split hours by percentage or manual entry, and lock in the phase start schedule."
                : currentPhase !== "Planning"
                  ? "This planner is editable during planning only. Later phases keep the saved budget and schedule."
                  : "Prototype mode shows the current sample allocation only."}
            </p>
          </div>

          <button
            type="button"
            disabled={!canEdit}
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PieChart size={16} />
            Open planner
          </button>
        </div>

        <div className="mt-6 grid gap-3">
          <SummaryRow
            label="Audit total target"
            value={totalBudgetHours === null ? "Not set" : formatHours(totalBudgetHours)}
            detail="Budget target captured at the audit level and used to guide phase allocations."
          />
          {phaseBudgets.map((phaseBudget) => (
            <SummaryRow
              key={phaseBudget.phase}
              label={`${phaseBudget.phase} plan`}
              value={phaseBudget.isSet ? formatHours(phaseBudget.plannedHours) : "Not set"}
              detail={
                phaseBudget.phase === "Planning"
                  ? `Starts ${formatShortDate(planningStartDate ?? periodStart ?? undefined)} and ends ${formatShortDate(fieldworkStartDate ?? undefined)}`
                  : phaseBudget.phase === "Fieldwork"
                    ? `Starts ${formatShortDate(fieldworkStartDate ?? undefined)} and ends ${formatShortDate(reportingStartDate ?? undefined)}`
                    : `Starts ${formatShortDate(reportingStartDate ?? undefined)} and ends ${formatShortDate(periodEnd ?? undefined)}`
              }
            />
          ))}
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(1,30,65,0.42)] p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
            <div className="w-full max-w-5xl rounded-[30px] border border-black/5 bg-[#fbfaf7] p-6 text-[var(--foreground)] shadow-[0_24px_80px_rgba(1,30,65,0.22)] sm:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Hours and schedule planner</p>
                  <h3 className="mt-3 text-2xl font-semibold">Allocate total audit hours across phases</h3>
                  <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                    Start with the audit total, use percentages to distribute hours, then adjust planned hours directly if needed.
                    Phase end dates are derived automatically from the next phase start and the audit end date.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                >
                  Close
                </button>
              </div>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
                <section className="grid gap-4">
                  <div className="rounded-[24px] border border-black/5 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-tint)] text-[var(--brand-indigo-core)]">
                        <PieChart size={18} />
                      </span>
                      <div className="flex-1">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Budget target</p>
                        <Field label="Total audit hours">
                          <input
                            type="number"
                            min="0"
                            step="0.25"
                            value={totalBudgetInput}
                            onChange={(event) => setTotalBudgetInput(event.target.value)}
                            className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none"
                          />
                        </Field>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <StatPill label="Phase hour sum" value={formatHours(plannedHourSum)} tone={exceedsTotalBudget ? "risk" : "neutral"} />
                      <StatPill
                        label="Entered split"
                        value={`${enteredPercentageSum.toFixed(0)}%`}
                        tone={enteredPercentageSum === 100 || !hasUsableTotalBudget ? "success" : "warning"}
                      />
                    </div>
                    {parsedTotalBudget === null ? (
                      <p className="mt-4 rounded-[18px] border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--muted)]">
                        Add a total hour target to enable percentage-based allocation. Manual phase-hour entry still works.
                      </p>
                    ) : null}
                    {exceedsTotalBudget ? (
                      <p className="mt-4 rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                        Planned phase hours exceed the audit total by {formatHours(plannedHourSum - parsedTotalBudget)}. You can still save this override.
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3">
                    {phases.map((phase) => {
                      const actualHours = phaseBudgets.find((item) => item.phase === phase)?.actualHours ?? 0;

                      return (
                        <div key={phase} className="rounded-[24px] border border-black/5 bg-white p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-[var(--foreground)]">{phase}</p>
                                {phase === currentPhase ? <StatusBadge status="Current phase" tone="warning" /> : null}
                              </div>
                              <p className="mt-1 text-sm text-[var(--muted)]">{formatHours(actualHours)} actual synced so far</p>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <Field label="Percent of total">
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={!hasUsableTotalBudget}
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
                                className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
                              />
                            </Field>
                            <Field label="Planned hours">
                              <input
                                type="number"
                                min="0"
                                step="0.25"
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
                                className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none"
                              />
                            </Field>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>

                <section className="grid gap-4">
                  <div className="rounded-[24px] border border-black/5 bg-white p-5">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-tint)] text-[var(--brand-indigo-core)]">
                        <CalendarRange size={18} />
                      </span>
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Phase schedule</p>
                        <h4 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Set audit and phase start dates</h4>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <Field label="Audit start">
                        <input
                          type="date"
                          value={periodStartInput}
                          onChange={(event) => {
                            setPeriodStartInput(event.target.value);
                            if (!planningStartInput || planningStartInput < event.target.value) {
                              setPlanningStartInput(event.target.value);
                            }
                          }}
                          className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none"
                        />
                      </Field>
                      <Field label="Audit end">
                        <input
                          type="date"
                          value={periodEndInput}
                          onChange={(event) => setPeriodEndInput(event.target.value)}
                          className="w-full rounded-2xl border border-black/10 bg-[#fbfaf7] px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none"
                        />
                      </Field>
                    </div>

                    <div className="mt-4 grid gap-3">
                      <PlannerDateRow
                        label="Planning"
                        startValue={planningStartInput}
                        endValue={planningEndPreview}
                        onStartChange={setPlanningStartInput}
                      />
                      <PlannerDateRow
                        label="Fieldwork"
                        startValue={fieldworkStartInput}
                        endValue={fieldworkEndPreview}
                        onStartChange={setFieldworkStartInput}
                      />
                      <PlannerDateRow
                        label="Reporting"
                        startValue={reportingStartInput}
                        endValue={reportingEndPreview}
                        onStartChange={setReportingStartInput}
                      />
                    </div>

                    {hasInvalidDateRange ? (
                      <p className="mt-4 rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                        Dates must stay in order: audit start, planning start, fieldwork start, reporting start, then audit end.
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-black/5 bg-white p-5">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Derived schedule</p>
                    <div className="mt-4 grid gap-3">
                      <ScheduleLine label="Planning end" value={planningEndPreview} />
                      <ScheduleLine label="Fieldwork end" value={fieldworkEndPreview} />
                      <ScheduleLine label="Reporting end" value={reportingEndPreview} />
                    </div>
                  </div>
                </section>
              </div>

              <div className="mt-6 flex flex-col gap-3 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-[var(--muted)]">
                  Saving updates the audit total, phase budgets, and phase start schedule in one step.
                </p>
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
                        setIsModalOpen(false);
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
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-5 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={16} />
                  {isPending ? "Saving..." : "Save planner"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function SummaryRow({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">{label}</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{detail}</p>
        </div>
        <p className="text-sm font-semibold text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: string; tone: "neutral" | "warning" | "risk" | "success" }) {
  return (
    <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-center gap-2">
        <p className="text-lg font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={label} tone={tone} />
      </div>
    </div>
  );
}

function PlannerDateRow({
  label,
  startValue,
  endValue,
  onStartChange,
}: {
  label: string;
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
}) {
  return (
    <div className="rounded-[20px] bg-[var(--surface-tint)] px-4 py-4">
      <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
        <Field label={`${label} start`}>
          <input
            type="date"
            value={startValue}
            onChange={(event) => onStartChange(event.target.value)}
            className="w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium text-[var(--foreground)] outline-none"
          />
        </Field>
        <div className="rounded-full bg-white px-4 py-2 text-sm font-medium text-[var(--foreground)]">
          Ends: {endValue === "Not set" ? endValue : formatShortDate(endValue)}
        </div>
      </div>
    </div>
  );
}

function ScheduleLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
      <p className="text-sm font-medium text-[var(--foreground)]">{label}</p>
      <p className="text-sm text-[var(--muted)]">{value === "Not set" ? value : formatShortDate(value)}</p>
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
