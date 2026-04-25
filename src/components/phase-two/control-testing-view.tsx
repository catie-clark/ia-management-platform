"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDownUp, ArrowRight, CircleHelp, Filter, Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { useNotification } from "@/components/ui/notification-provider";
import { DetailPanel } from "@/components/ui/detail-panel";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getControlOwner,
  getControlRiskLevel,
  getControlVariance,
  getDerivedControlStatus,
  getLinkedDocuments,
  getLinkedQuestions,
  getLinkedRequests,
  isControlOverdue,
  isRequestOverdue,
  shouldShowReminder,
} from "@/lib/audit-logic";
import { getControlTestingNow } from "@/lib/control-testing-data";
import type { DashboardMode } from "@/lib/live-audit";
import { cn, formatDateTime, formatHours, formatShortDate } from "@/lib/utils";
import type { AuditDocument, Control, ControlStatus, DocumentReviewStatus, Question, Request, User } from "@/types/audit";

const controlStages: ControlStatus[] = ["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETE"];
const documentReviewStages: DocumentReviewStatus[] = ["NOT_SUBMITTED", "AIC_REVIEW", "MANAGER_REVIEW", "DIRECTOR_REVIEW", "APPROVED"];
type DueFilter = "ALL" | "OVERDUE" | "NEXT_48_HOURS" | "NEXT_7_DAYS" | "FUTURE";
type ControlSort =
  | "DUE_ASC"
  | "DUE_DESC"
  | "OWNER_ASC"
  | "RISK_DESC"
  | "STATUS_ASC"
  | "VARIANCE_DESC";

type ControlTestingViewProps = {
  auditId: string | null;
  auditLabel: string;
  controls: Control[];
  documents: AuditDocument[];
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

type PlanningFormState = {
  dueDate: string;
  ownerId: string;
  plannedHours: string;
};

type ControlPlanningApiResponse = {
  controlId: string;
  assignedOwnerUserId: string | null;
  assignedDueDate: string | null;
  assignedPlannedHours: number | null;
  hasPlanningOverride: boolean;
  planningOverriddenAt: string | null;
};

const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const controlSortOptions: ControlSort[] = ["DUE_ASC", "DUE_DESC", "OWNER_ASC", "RISK_DESC", "STATUS_ASC", "VARIANCE_DESC"];
const riskRank: Record<Control["riskLevel"], number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function ControlTestingView({
  auditId,
  auditLabel,
  controls,
  documents,
  mode,
  questions,
  requests,
  users,
}: ControlTestingViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showNotification } = useNotification();
  const [controlRecords, setControlRecords] = useState(controls);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ControlStatus | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<Control["riskLevel"] | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [sortBy, setSortBy] = useState<ControlSort>("DUE_ASC");
  const [planningForm, setPlanningForm] = useState<PlanningFormState>({ dueDate: "", ownerId: "", plannedHours: "" });
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, startSaving] = useTransition();
  const currentNow = useMemo(() => getControlTestingNow(mode), [mode]);

  useEffect(() => {
    setControlRecords(controls);
  }, [controls]);

  const filteredControls = useMemo(() => {
    return controlRecords
      .filter((control) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          control.referenceId?.toLowerCase().includes(q) ||
          control.id.toLowerCase().includes(q) ||
          control.name.toLowerCase().includes(q) ||
          control.businessUnit.toLowerCase().includes(q);
        const hoursToDue = hoursUntil(control.dueDate, currentNow);
        const matchesDueFilter =
          dueFilter === "ALL" ||
          (dueFilter === "OVERDUE" && hoursToDue < 0) ||
          (dueFilter === "NEXT_48_HOURS" && hoursToDue >= 0 && hoursToDue <= 48) ||
          (dueFilter === "NEXT_7_DAYS" && hoursToDue >= 0 && hoursToDue <= 168) ||
          (dueFilter === "FUTURE" && hoursToDue > 168);

        return (
          matchesSearch &&
          matchesDueFilter &&
          (statusFilter === "ALL" || getDerivedControlStatus(control, getAuditContext(controlRecords, documents, questions, requests, users, currentNow)) === statusFilter) &&
          (riskFilter === "ALL" || getControlRiskLevel(control, getAuditContext(controlRecords, documents, questions, requests, users, currentNow)) === riskFilter) &&
          (ownerFilter === "ALL" || control.ownerId === ownerFilter)
        );
      })
      .sort((left, right) => {
        const context = getAuditContext(controlRecords, documents, questions, requests, users, currentNow);
        const leftRisk = getControlRiskLevel(left, context);
        const rightRisk = getControlRiskLevel(right, context);

        switch (sortBy) {
          case "DUE_ASC":
            return sortDateValue(left.dueDate) - sortDateValue(right.dueDate);
          case "DUE_DESC":
            return sortDateValue(right.dueDate) - sortDateValue(left.dueDate);
          case "OWNER_ASC":
            return getOwnerLabel(left, users).localeCompare(getOwnerLabel(right, users));
          case "RISK_DESC":
            return riskRank[rightRisk] - riskRank[leftRisk];
          case "STATUS_ASC":
            return getDerivedControlStatus(left, context).localeCompare(getDerivedControlStatus(right, context));
          case "VARIANCE_DESC":
            return getControlVariance(right) - getControlVariance(left);
          default:
            return 0;
        }
      });
  }, [controlRecords, currentNow, documents, dueFilter, ownerFilter, questions, requests, riskFilter, search, sortBy, statusFilter, users]);

  const selectedControl = controlRecords.find((control) => control.id === selectedId) ?? null;
  const auditContext = useMemo(
    () => getAuditContext(controlRecords, documents, questions, requests, users, currentNow),
    [controlRecords, currentNow, documents, questions, requests, users],
  );
  const workspaceQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (mode === "live" && auditId) {
      params.set("mode", "live");
      params.set("auditId", auditId);
      params.set("auditLabel", auditLabel);
    } else {
      params.set("mode", "prototype");
      params.set("auditLabel", auditLabel);
    }

    const sync = searchParams.get("sync");

    if (sync) {
      params.set("sync", sync);
    }

    return params;
  }, [auditId, auditLabel, mode, searchParams]);

  useEffect(() => {
    if (!selectedControl) {
      setPlanningForm({ dueDate: "", ownerId: "", plannedHours: "" });
      setSaveError("");
      setSaveSuccess("");
      return;
    }

    setPlanningForm({
      dueDate: toDateInputValue(selectedControl.dueDate),
      ownerId: selectedControl.ownerId,
      plannedHours: selectedControl.plannedHours.toString(),
    });
    setSaveError("");
    setSaveSuccess("");
  }, [selectedControl]);

  return (
    <div className="flex min-h-0 flex-col gap-6 xl:h-[calc(100dvh-13.5rem)]">
      <PageHeader
        eyebrow="Phase 2"
        title="Control Testing"
        description={
          mode === "live"
            ? `Live control planning for ${auditLabel}. Owners, budgeted hours, and due dates can be set in the control detail panel and saved back to Supabase.`
            : "Operational view for control ownership, execution status, hours variance, and due-date follow-up. Linked workpapers surface AIC, manager, and director review progression where that workflow actually occurs."
        }
        phaseStatus={{
          label: mode === "live" ? "Planning edits enabled" : "Prototype detail view",
          active: mode === "live",
        }}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Controls in scope"
          value={`${controlRecords.length}`}
          detail={`${controlRecords.filter((control) => shouldShowReminder(control, currentNow)).length} due inside 48h`}
          tone="warning"
        />
        <SummaryCard
          label="Over budget"
          value={`${controlRecords.filter((control) => getControlVariance(control) > 0).length}`}
          detail="Hours variance flagged inline"
          tone="risk"
        />
        <SummaryCard
          label="Past due"
          value={`${controlRecords.filter((control) => isControlOverdue(control, currentNow)).length}`}
          detail="Escalation candidates for managers"
          tone="risk"
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search controls, reference IDs, or business units"
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-11 py-3 text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Filter size={16} className="text-[var(--muted)]" />
            <Select value={statusFilter} onChange={setStatusFilter} options={["ALL", ...controlStages]} />
            <Select value={riskFilter} onChange={setRiskFilter} options={["ALL", "HIGH", "MEDIUM", "LOW"]} />
            <Select
              value={ownerFilter}
              onChange={setOwnerFilter}
              options={["ALL", ...Array.from(new Set(controlRecords.map((control) => control.ownerId)))]}
              label={(value) => (value === "ALL" ? "All owners" : getOwnerLabel(controlRecords.find((control) => control.ownerId === value) ?? null, users))}
            />
            <Select value={dueFilter} onChange={setDueFilter} options={dueFilterOptions} label={formatDueFilterLabel} />
            <Select value={sortBy} onChange={setSortBy} options={controlSortOptions} label={formatControlSortLabel} icon={<ArrowDownUp size={16} />} />
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="bg-white px-4 py-2">Control</th>
                <th className="bg-white px-4 py-2">Owner</th>
                <th className="bg-white px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    Status
                    <HoverInfoCard text="Overdue controls show Blocked when any linked question, request, or document is also overdue. If the control is overdue but no linked items are overdue, status shows In Progress." />
                  </span>
                </th>
                <th className="bg-white px-4 py-2">Due</th>
                <th className="bg-white px-4 py-2">Hours</th>
                <th className="bg-white px-4 py-2">
                  <span className="inline-flex items-center gap-2">
                    Risk
                    <HoverInfoCard text="Risk is scored from overdue timing, blocked status, budget variance, linked open or overdue questions and requests, document review completion, and higher-sensitivity business areas." />
                  </span>
                </th>
                <th className="bg-white px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredControls.map((control) => {
                const derivedStatus = getDerivedControlStatus(control, auditContext);
                const variance = getControlVariance(control);
                const derivedRiskLevel = getControlRiskLevel(control, auditContext);
                const riskTone = derivedRiskLevel === "HIGH" ? "risk" : derivedRiskLevel === "MEDIUM" ? "warning" : "success";
                const overdue = isControlOverdue(control, currentNow);

                return (
                  <tr
                    key={control.id}
                    className="cursor-pointer bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
                    onClick={() => setSelectedId(control.id)}
                  >
                    <td className={cn("rounded-l-3xl px-4 py-4", overdue && "control-cell-overdue control-cell-overdue-first")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{control.referenceId ?? control.id}</p>
                        {overdue ? <StatusBadge status="Overdue" tone="risk" className="animate-pulse" /> : null}
                      </div>
                      <p className="mt-1 text-sm text-[var(--foreground)]">{control.name}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{control.businessUnit}</p>
                    </td>
                    <td className={cn("px-4 py-4 text-sm text-[var(--muted)]", overdue && "control-cell-overdue")}>{getOwnerLabel(control, users)}</td>
                    <td className={cn("px-4 py-4", overdue && "control-cell-overdue")}>
                      <StatusBadge
                        status={derivedStatus}
                        tone={derivedStatus === "COMPLETE" ? "success" : derivedStatus === "BLOCKED" ? "risk" : "warning"}
                      />
                    </td>
                    <td className={cn("px-4 py-4 text-sm text-[var(--muted)]", overdue && "control-cell-overdue")}>{formatShortDate(control.dueDate)}</td>
                    <td className={cn("px-4 py-4 text-sm text-[var(--muted)]", overdue && "control-cell-overdue")}>
                      {formatHours(control.actualHours)} / {formatHours(control.plannedHours)}
                      <span className={variance > 0 ? "ml-2 text-[var(--brand-coral)]" : "ml-2 text-[var(--brand-teal-core)]"}>
                        {variance > 0 ? `+${formatHours(variance)}` : `${formatHours(Math.abs(variance))} under`}
                      </span>
                    </td>
                    <td className={cn("px-4 py-4", overdue && "control-cell-overdue")}>
                      <StatusBadge status={derivedRiskLevel} tone={riskTone} />
                    </td>
                    <td className={cn("rounded-r-3xl px-4 py-4", overdue && "control-cell-overdue control-cell-overdue-last")}>
                      <div className="flex items-center gap-2">
                        <ReminderButton visible={shouldShowReminder(control, currentNow)} tooltip="Deadline approaching" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(control.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Inspect
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {selectedControl ? (
        <DetailPanel
          title={`${selectedControl.referenceId ?? selectedControl.id} - ${selectedControl.name}`}
          subtitle={selectedControl.description}
          open={Boolean(selectedControl)}
          onClose={() => setSelectedId("")}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            {mode === "live" ? (
              <section className="rounded-[24px] border border-black/5 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Planning decisions</p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Control setup stored on this audit</h3>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      Managers assign the control owner, target due date, and budgeted hours for this audit during planning.
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Control owner</span>
                    <select
                      value={planningForm.ownerId}
                      onChange={(event) => setPlanningForm((current) => ({ ...current, ownerId: event.target.value }))}
                      className="rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
                    >
                      <option value="">Unassigned</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Due date</span>
                    <input
                      type="date"
                      value={planningForm.dueDate}
                      onChange={(event) => setPlanningForm((current) => ({ ...current, dueDate: event.target.value }))}
                      className="rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
                    />
                  </label>

                  <label className="grid gap-2 md:col-span-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Budgeted hours</span>
                    <input
                      type="number"
                      min="0"
                      step="0.25"
                      value={planningForm.plannedHours}
                      onChange={(event) => setPlanningForm((current) => ({ ...current, plannedHours: event.target.value }))}
                      className="rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
                    />
                  </label>
                </div>

                {saveError ? (
                  <p className="mt-4 rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                    {saveError}
                  </p>
                ) : null}
                {saveSuccess ? (
                  <p className="mt-4 rounded-[18px] border border-[rgba(5,171,140,0.18)] bg-[rgba(5,171,140,0.08)] px-4 py-3 text-sm text-[var(--brand-teal-core)]">
                    {saveSuccess}
                  </p>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={isSaving || !auditId}
                    onClick={() => {
                      if (!auditId) {
                        return;
                      }

                      startSaving(async () => {
                        try {
                          setSaveError("");
                          setSaveSuccess("");
                          const payload = buildPlanningPayload(selectedControl, planningForm, auditId);
                          const response = await fetch(`/api/controls/${selectedControl.id}`, {
                            method: "PATCH",
                            headers: {
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify(payload),
                          });
                          const result = (await response.json()) as ControlPlanningApiResponse | { error?: string };

                          if (!response.ok) {
                            throw new Error("error" in result ? result.error : "Unable to save the control.");
                          }

                          const updatedControl = applyControlPlanningResponse(selectedControl, result as ControlPlanningApiResponse);
                          setControlRecords((current) => current.map((control) => (control.id === updatedControl.id ? updatedControl : control)));
                          setPlanningForm({
                            dueDate: toDateInputValue(updatedControl.dueDate),
                            ownerId: updatedControl.ownerId,
                            plannedHours: updatedControl.plannedHours.toString(),
                          });
                          setSaveSuccess("Planning decisions saved to Supabase.");
                          showNotification({
                            title: "Saved successfully",
                            message: "Control planning details were saved successfully.",
                            tone: "success",
                          });
                        } catch (error) {
                          setSaveError(error instanceof Error ? error.message : "Unable to save the control.");
                          showNotification({
                            title: "Save failed",
                            message: "There was an error saving the control planning details.",
                            tone: "error",
                          });
                        }
                      });
                    }}
                    className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.18em] text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving..." : "Save planning details"}
                  </button>
                </div>
              </section>
            ) : null}

            <section className="grid gap-4 md:grid-cols-2">
              <InfoCard label="Owner" value={getOwnerLabel(selectedControl, users)} />
              <InfoCard label="Due date" value={formatDateTime(selectedControl.dueDate)} />
              <InfoCard
                label="Date completed"
                value={selectedControl.completedDate ? formatDateTime(selectedControl.completedDate) : "Not completed"}
              />
              <InfoCard label="Hours" value={`${formatHours(selectedControl.actualHours)} actual / ${formatHours(selectedControl.plannedHours)} planned`} />
              <InfoCard
                label="Last planning edit"
                value={selectedControl.planningOverriddenAt ? formatDateTime(selectedControl.planningOverriddenAt) : "No manual override saved"}
              />
            </section>

            <LinkedSection title="Related risks" empty="No related risks linked yet.">
              {(selectedControl.relatedRisks ?? []).map((risk) => (
                <LinkedRow
                  key={`${selectedControl.id}-${risk.id}`}
                  title={risk.id}
                  meta={risk.statement}
                />
              ))}
            </LinkedSection>

            <LinkedSection title="Linked questions" empty="No questions linked yet.">
              {getLinkedQuestions(selectedControl.id, questions).map((question) => (
                <LinkedRow
                  key={question.id}
                  title={`${question.id} - ${question.assignedTo}`}
                  meta={question.questionText}
                  overdue={question.status === "OVERDUE"}
                  onClick={() => router.push(buildWorkspacePath("/question-log", workspaceQuery, { questionId: question.id }))}
                />
              ))}
            </LinkedSection>

            <LinkedSection title="Linked requests" empty="No requests linked yet.">
              {getLinkedRequests(selectedControl.id, requests).map((request) => (
                <LinkedRow
                  key={request.id}
                  title={`${request.id} - ${request.assignedTo}`}
                  meta={request.description}
                  overdue={isRequestOverdue(request, currentNow)}
                  onClick={() => router.push(buildWorkspacePath("/request-log", workspaceQuery, { requestId: request.id }))}
                />
              ))}
            </LinkedSection>

            <LinkedSection title="Linked documents" empty="No documents linked yet.">
              {getLinkedDocuments(selectedControl.id, documents).map((document) => (
                <DocumentLinkedRow key={document.id} document={document} />
              ))}
            </LinkedSection>
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "warning" | "risk" }) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={tone === "risk" ? "Watchlist" : "Near due"} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  icon,
}: {
  value: T;
  onChange: (value: T) => void;
  options: T[];
  label?: (value: T) => string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {icon ? <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">{icon}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={`rounded-full border border-black/5 bg-[var(--surface-tint)] py-2 text-sm text-[var(--foreground)] outline-none ${icon ? "pl-10 pr-4" : "px-4"}`}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {label ? label(option) : option === "ALL" ? "All" : option.replaceAll("_", " ")}
          </option>
        ))}
      </select>
    </div>
  );
}

function hoursUntil(value: string | undefined, now: string) {
  if (!value) {
    return Number.POSITIVE_INFINITY;
  }

  return (new Date(value).getTime() - new Date(now).getTime()) / (1000 * 60 * 60);
}

function sortDateValue(value: string | undefined) {
  return value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;
}

function formatDueFilterLabel(value: DueFilter) {
  switch (value) {
    case "ALL":
      return "All due dates";
    case "OVERDUE":
      return "Overdue";
    case "NEXT_48_HOURS":
      return "Due in 48h";
    case "NEXT_7_DAYS":
      return "Due in 7 days";
    case "FUTURE":
      return "Future due dates";
  }
}

function formatControlSortLabel(value: ControlSort) {
  switch (value) {
    case "DUE_ASC":
      return "Sort: due soonest";
    case "DUE_DESC":
      return "Sort: due latest";
    case "OWNER_ASC":
      return "Sort: owner";
    case "RISK_DESC":
      return "Sort: highest risk";
    case "STATUS_ASC":
      return "Sort: status";
    case "VARIANCE_DESC":
      return "Sort: highest variance";
  }
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function HoverInfoCard({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--muted)] transition-colors hover:text-[var(--brand-indigo-core)]"
      >
        <CircleHelp size={12} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.65rem)] z-20 w-72 -translate-x-1/2 rounded-[18px] border border-black/5 bg-white px-4 py-3 text-left text-[11px] normal-case tracking-normal text-[var(--foreground)] opacity-0 shadow-[0_18px_40px_rgba(1,30,65,0.14)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function LinkedSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);

  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{title}</p>
      <div className="mt-4 grid gap-3">{hasItems ? children : <p className="text-sm text-[var(--muted)]">{empty}</p>}</div>
    </section>
  );
}

function LinkedRow({ title, meta, overdue = false, onClick }: { title: string; meta: string; overdue?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3 text-left transition-colors hover:bg-[rgba(245,168,0,0.08)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        {overdue ? <StatusBadge status="Overdue" tone="risk" /> : null}
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">{meta}</p>
    </button>
  );
}

function DocumentLinkedRow({ document }: { document: AuditDocument }) {
  const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
  const currentIndex = documentReviewStages.indexOf(reviewStatus);

  return (
    <div className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {document.id} - {document.title}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <StatusBadge
              status={document.status}
              tone={document.status === "COMPLETE" ? "success" : document.status === "NOT_STARTED" ? "warning" : "neutral"}
            />
            <StatusBadge
              status={reviewStatus}
              tone={reviewStatus === "APPROVED" ? "success" : reviewStatus === "NOT_SUBMITTED" ? "warning" : "neutral"}
            />
          </div>
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Document review workflow</p>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-5">
        {documentReviewStages.map((stage, index) => {
          const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
          return <StatusBadge key={stage} status={stage} tone={tone} className="justify-center py-2" />;
        })}
      </div>
    </div>
  );
}

function getAuditContext(
  controls: Control[],
  documents: AuditDocument[],
  questions: Question[],
  requests: Request[],
  users: User[],
  now: string,
) {
  return {
    budgetByPhase: [],
    controls,
    documents,
    milestones: [],
    now,
    questions,
    requests,
    users,
  };
}

function buildWorkspacePath(pathname: string, workspaceQuery: URLSearchParams, extraQuery: Record<string, string>) {
  const params = new URLSearchParams(workspaceQuery.toString());

  for (const [key, value] of Object.entries(extraQuery)) {
    params.set(key, value);
  }

  return `${pathname}?${params.toString()}`;
}

function getOwnerLabel(control: Control | null, users: User[]) {
  if (!control?.ownerId) {
    return "Unassigned";
  }

  return getControlOwner(control, users) || "Unassigned";
}

function toDateInputValue(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function buildPlanningPayload(control: Control, planningForm: PlanningFormState, auditId: string) {
  const normalizedOwnerId = planningForm.ownerId || null;
  const normalizedDueDate = planningForm.dueDate || null;
  const normalizedPlannedHours = planningForm.plannedHours.trim().length === 0 ? null : Number(planningForm.plannedHours);

  return {
    auditId,
    assignedOwnerUserId: normalizedOwnerId === (control.importedOwnerId ?? null) ? null : normalizedOwnerId,
    assignedDueDate: normalizedDueDate === toDateInputValue(control.importedDueDate) ? null : normalizedDueDate,
    assignedPlannedHours:
      normalizedPlannedHours === null || normalizedPlannedHours === (control.importedPlannedHours ?? 0) ? null : normalizedPlannedHours,
  };
}

function applyControlPlanningResponse(control: Control, response: ControlPlanningApiResponse): Control {
  const assignedDueDate = response.assignedDueDate ? `${response.assignedDueDate}T00:00:00.000Z` : undefined;
  const importedDueDate = control.importedDueDate;
  const importedPlannedHours = control.importedPlannedHours ?? 0;

  return {
    ...control,
    ownerId: response.assignedOwnerUserId ?? control.importedOwnerId ?? "",
    assignedOwnerId: response.assignedOwnerUserId ?? undefined,
    dueDate: assignedDueDate ?? importedDueDate,
    assignedDueDate,
    plannedHours: response.assignedPlannedHours ?? importedPlannedHours,
    assignedPlannedHours: response.assignedPlannedHours ?? undefined,
    hasPlanningOverride: response.hasPlanningOverride,
    planningOverriddenAt: response.planningOverriddenAt ?? undefined,
  };
}
