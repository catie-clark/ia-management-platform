"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { useNotification } from "@/components/ui/notification-provider";

type LifecycleMilestoneEditorProps = {
  auditId: string | null;
  currentPhase: "Planning" | "Fieldwork" | "Reporting";
  fieldworkEndDate: string | null;
  fieldworkStartDate: string | null;
  mode: "live" | "prototype";
  periodEnd: string | null;
  periodStart: string | null;
  planningEndDate: string | null;
  planningStartDate: string | null;
  reportingEndDate: string | null;
  reportingStartDate: string | null;
};

export function LifecycleMilestoneEditor({
  auditId,
  currentPhase,
  fieldworkEndDate,
  fieldworkStartDate,
  mode,
  periodEnd,
  periodStart,
  planningEndDate,
  planningStartDate,
  reportingEndDate,
  reportingStartDate,
}: LifecycleMilestoneEditorProps) {
  const router = useRouter();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [periodStartInput, setPeriodStartInput] = useState(() => toDateInputValue(periodStart));
  const [periodEndInput, setPeriodEndInput] = useState(() => toDateInputValue(periodEnd));
  const [planningStartInput, setPlanningStartInput] = useState(() => toDateInputValue(planningStartDate));
  const [planningEndInput, setPlanningEndInput] = useState(() => toDateInputValue(planningEndDate));
  const [fieldworkStartInput, setFieldworkStartInput] = useState(() => toDateInputValue(fieldworkStartDate));
  const [fieldworkEndInput, setFieldworkEndInput] = useState(() => toDateInputValue(fieldworkEndDate));
  const [reportingStartInput, setReportingStartInput] = useState(() => toDateInputValue(reportingStartDate));
  const [reportingEndInput, setReportingEndInput] = useState(() => toDateInputValue(reportingEndDate) || toDateInputValue(periodEnd));

  useEffect(() => {
    if (periodStartInput.length > 0 && planningStartInput !== periodStartInput) {
      setPlanningStartInput(periodStartInput);
    }
  }, [periodStartInput, planningStartInput]);

  useEffect(() => {
    if (periodEndInput.length > 0 && reportingEndInput !== periodEndInput) {
      setReportingEndInput(periodEndInput);
    }
  }, [periodEndInput, reportingEndInput]);

  useEffect(() => {
    if (planningEndInput.length > 0 && fieldworkStartInput !== planningEndInput) {
      setFieldworkStartInput(planningEndInput);
    }
  }, [fieldworkStartInput, planningEndInput]);

  useEffect(() => {
    if (fieldworkEndInput.length > 0 && reportingStartInput !== fieldworkEndInput) {
      setReportingStartInput(fieldworkEndInput);
    }
  }, [fieldworkEndInput, reportingStartInput]);

  const canEdit = mode === "live" && Boolean(auditId) && currentPhase === "Planning";
  const hasChanges = useMemo(
    () =>
      periodStartInput !== toDateInputValue(periodStart) ||
      periodEndInput !== toDateInputValue(periodEnd) ||
      planningStartInput !== toDateInputValue(planningStartDate) ||
      planningEndInput !== toDateInputValue(planningEndDate) ||
      fieldworkStartInput !== toDateInputValue(fieldworkStartDate) ||
      fieldworkEndInput !== toDateInputValue(fieldworkEndDate) ||
      reportingStartInput !== toDateInputValue(reportingStartDate) ||
      reportingEndInput !== toDateInputValue(reportingEndDate),
    [
      fieldworkEndDate,
      fieldworkEndInput,
      fieldworkStartDate,
      fieldworkStartInput,
      periodEnd,
      periodEndInput,
      periodStart,
      periodStartInput,
      planningEndDate,
      planningEndInput,
      planningStartDate,
      planningStartInput,
      reportingEndDate,
      reportingEndInput,
      reportingStartDate,
      reportingStartInput,
    ],
  );

  return (
    <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Audit lifecycle</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Lifecycle milestones</h2>
          <p className="mt-2 text-sm text-[var(--muted)]">
            {canEdit
              ? "Keep the overall audit start and end dates, and set specific start and end dates for planning, fieldwork, and reporting. The executive dashboard milestone section will use the phase dates first."
              : currentPhase !== "Planning"
                ? "Lifecycle milestone dates are editable during planning only. The dashboard will continue using the last saved phase schedule."
                : "Lifecycle milestone dates are editable on saved live audits. Prototype mode shows the current sample schedule only."}
          </p>
        </div>

        {canEdit ? (
          <button
            type="button"
            disabled={isPending || !hasChanges || periodStartInput.length === 0 || periodEndInput.length === 0}
            onClick={() => {
              startTransition(async () => {
                try {
                  const response = await fetch(`/api/audits/${auditId}/milestones`, {
                    method: "PATCH",
                    headers: {
                      "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                      periodStart: periodStartInput,
                      periodEnd: periodEndInput,
                      planningStartDate: toNullableDateInputValue(planningStartInput),
                      planningEndDate: toNullableDateInputValue(planningEndInput),
                      fieldworkStartDate: toNullableDateInputValue(fieldworkStartInput),
                      fieldworkEndDate: toNullableDateInputValue(fieldworkEndInput),
                      reportingStartDate: toNullableDateInputValue(reportingStartInput),
                      reportingEndDate: toNullableDateInputValue(reportingEndInput),
                    }),
                  });
                  const result = (await response.json()) as { error?: string };

                  if (!response.ok) {
                    throw new Error("Unable to save the audit lifecycle milestones.");
                  }

                  showNotification({
                    title: "Saved successfully",
                    message: "Lifecycle milestone dates were saved successfully.",
                    tone: "success",
                  });
                  router.refresh();
                } catch {
                  showNotification({
                    title: "Save failed",
                    message: "There was an error saving the lifecycle milestone dates.",
                    tone: "error",
                  });
                }
              });
            }}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {isPending ? "Saving..." : "Save lifecycle dates"}
          </button>
        ) : null}
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        <label className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Audit start
          <input
            type="date"
            disabled={!canEdit || isPending}
            value={periodStartInput}
            onChange={(event) => setPeriodStartInput(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
          />
        </label>

        <label className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Audit end
          <input
            type="date"
            disabled={!canEdit || isPending}
            value={periodEndInput}
            onChange={(event) => setPeriodEndInput(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4">
        <PhaseDateGroup
          endLabel="Planning end"
          endValue={planningEndInput}
          onEndChange={setPlanningEndInput}
          onStartChange={setPlanningStartInput}
          startLabel="Planning start"
          startValue={planningStartInput}
          disabled={!canEdit || isPending}
        />
        <PhaseDateGroup
          endLabel="Fieldwork end"
          endValue={fieldworkEndInput}
          onEndChange={setFieldworkEndInput}
          onStartChange={setFieldworkStartInput}
          startLabel="Fieldwork start"
          startValue={fieldworkStartInput}
          disabled={!canEdit || isPending}
        />
        <PhaseDateGroup
          endLabel="Reporting end"
          endValue={reportingEndInput}
          onEndChange={setReportingEndInput}
          onStartChange={setReportingStartInput}
          startLabel="Reporting start"
          startValue={reportingStartInput}
          disabled={!canEdit || isPending}
        />
      </div>
    </section>
  );
}

function PhaseDateGroup({
  disabled,
  endLabel,
  endValue,
  onEndChange,
  onStartChange,
  startLabel,
  startValue,
}: {
  disabled: boolean;
  endLabel: string;
  endValue: string;
  onEndChange: (value: string) => void;
  onStartChange: (value: string) => void;
  startLabel: string;
  startValue: string;
}) {
  return (
    <div className="rounded-[22px] bg-[var(--surface-tint)] px-4 py-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {startLabel}
          <input
            type="date"
            disabled={disabled}
            value={startValue}
            onChange={(event) => onStartChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
          />
        </label>

        <label className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          {endLabel}
          <input
            type="date"
            disabled={disabled}
            value={endValue}
            onChange={(event) => onEndChange(event.target.value)}
            className="mt-2 w-full rounded-2xl border border-black/10 bg-white px-3 py-2 text-sm font-medium normal-case tracking-normal text-[var(--foreground)] outline-none disabled:cursor-not-allowed disabled:bg-[#f3f1ec]"
          />
        </label>
      </div>
    </div>
  );
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
