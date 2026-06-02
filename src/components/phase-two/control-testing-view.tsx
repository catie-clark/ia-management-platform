"use client";

import { useEffect, useMemo, useState, useTransition, type Dispatch, type FormEvent, type SetStateAction, type TransitionStartFunction } from "react";
import { ArrowDownUp, ArrowRight, CircleHelp, Filter, Search, Upload } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";

import { AttachmentReferencePanel } from "@/components/attachments/attachment-reference-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { useNotification } from "@/components/ui/notification-provider";
import { DetailPanel } from "@/components/ui/detail-panel";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { TestingMatrixDetailPanel } from "@/components/testing-matrices/testing-matrix-detail-panel";
import { WorkpaperDetailPanel } from "@/components/workpapers/workpaper-detail-panel";
import { defaultAuditWorkspaceSettings, formatReviewWorkflowStageLabel, type AuditWorkspaceSettings } from "@/lib/audit-settings";
import {
  getControlOwner,
  getControlRiskLevel,
  getControlVariance,
  getDerivedControlStatus,
  getQuestionDisplayStatus,
  getLinkedDocuments,
  getLinkedQuestions,
  getLinkedRequests,
  isControlOverdue,
  isRequestOverdue,
  shouldShowReminder,
} from "@/lib/audit-logic";
import {
  canUserSeeAllControls,
  getDefaultScopeFilter,
  type ControlAudienceFilter,
  type ScopeFilter,
} from "@/lib/control-visibility";
import { getControlTestingNow } from "@/lib/control-testing-data";
import { mapDocument, type AuditDocumentRow, type DashboardMode } from "@/lib/live-audit";
import { cn, formatDateTime, formatHours, formatShortDate } from "@/lib/utils";
import type {
  AuditDocument,
  AuditPhase,
  Control,
  ControlException,
  ControlScopeStatus,
  ControlStatus,
  ControlTestingMatrix,
  DocumentReviewStatus,
  Question,
  Request,
  User,
} from "@/types/audit";

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
  auditPeriodLabel: string;
  controls: Control[];
  controlExceptions: ControlException[];
  testingMatrices: ControlTestingMatrix[];
  currentPhase: AuditPhase;
  documents: AuditDocument[];
  embedded?: boolean;
  fieldworkBudgetHours?: number | null;
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

type PlanningFormState = {
  dueDate: string;
  ownerId: string;
  plannedHours: string;
  scopeStatus: "" | ControlScopeStatus;
};

type ControlPlanningApiResponse = {
  controlId: string;
  assignedOwnerUserId: string | null;
  clearAssignedOwner?: boolean;
  effectiveOwnerUserId?: string | null;
  assignedDueDate: string | null;
  assignedPlannedHours: number | null;
  hasPlanningOverride: boolean;
  planningOverriddenAt: string | null;
  scopeStatus?: ControlScopeStatus;
};

const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const controlSortOptions: ControlSort[] = ["DUE_ASC", "DUE_DESC", "OWNER_ASC", "RISK_DESC", "STATUS_ASC", "VARIANCE_DESC"];
const riskRank: Record<Control["riskLevel"], number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

export function ControlTestingView({
  auditId,
  auditLabel,
  auditPeriodLabel,
  controls,
  controlExceptions,
  testingMatrices,
  currentPhase,
  documents,
  embedded = false,
  fieldworkBudgetHours = null,
  mode,
  questions,
  requests,
  users,
}: ControlTestingViewProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [controlRecords, setControlRecords] = useState(controls);
  const [documentRows, setDocumentRows] = useState(documents);
  const [testingMatrixRows, setTestingMatrixRows] = useState(testingMatrices);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedWorkpaperId, setSelectedWorkpaperId] = useState<string>("");
  const [selectedTestingMatrixControlId, setSelectedTestingMatrixControlId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ControlStatus | "ALL">("ALL");
  const [riskFilter, setRiskFilter] = useState<Control["riskLevel"] | "ALL">("ALL");
  const [ownerFilter, setOwnerFilter] = useState<string>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [audienceFilter, setAudienceFilter] = useState<ControlAudienceFilter>("ALL");
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>(getDefaultScopeFilter(currentPhase));
  const [sortBy, setSortBy] = useState<ControlSort>("DUE_ASC");
  const [showFilters, setShowFilters] = useState(false);
  const [planningForm, setPlanningForm] = useState<PlanningFormState>({ dueDate: "", ownerId: "", plannedHours: "", scopeStatus: "" });
  const [workspaceSettings, setWorkspaceSettings] = useState<AuditWorkspaceSettings>(defaultAuditWorkspaceSettings);
  const [controlExceptionsByControlId, setControlExceptionsByControlId] = useState<Record<string, ControlException[]>>(
    () => groupControlExceptions(controlExceptions),
  );
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");
  const [isSaving, startSaving] = useTransition();
  const currentNow = useMemo(() => getControlTestingNow(mode), [mode]);

  useEffect(() => {
    setControlRecords(controls);
  }, [controls]);

  useEffect(() => {
    setDocumentRows(documents);
  }, [documents]);

  useEffect(() => {
    setTestingMatrixRows(testingMatrices);
  }, [testingMatrices]);

  useEffect(() => {
    setControlExceptionsByControlId(groupControlExceptions(controlExceptions));
  }, [controlExceptions]);

  useEffect(() => {
    setOwnerFilter("ALL");
  }, [activeUser.id]);

  useEffect(() => {
    if (!workspaceSettings.showControlBudgetHours && sortBy === "VARIANCE_DESC") {
      setSortBy("DUE_ASC");
    }
  }, [sortBy, workspaceSettings.showControlBudgetHours]);

  useEffect(() => {
    if (!auditId) {
      setWorkspaceSettings(defaultAuditWorkspaceSettings);
      return;
    }

    let cancelled = false;

    async function loadWorkspaceSettings() {
      try {
        const response = await fetch(`/api/audits/${auditId}/settings`, { cache: "no-store" });
        const payload = (await response.json()) as { settings?: AuditWorkspaceSettings };

        if (!response.ok) {
          throw new Error("Unable to load workspace settings.");
        }

        if (!cancelled) {
          setWorkspaceSettings(payload.settings ?? defaultAuditWorkspaceSettings);
        }
      } catch {
        if (!cancelled) {
          setWorkspaceSettings(defaultAuditWorkspaceSettings);
        }
      }
    }

    void loadWorkspaceSettings();

    const handleSettingsUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ auditId?: string; settings?: AuditWorkspaceSettings }>).detail;

      if (detail?.auditId === auditId && detail.settings) {
        setWorkspaceSettings(detail.settings);
      }
    };

    window.addEventListener("audit-settings-updated", handleSettingsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("audit-settings-updated", handleSettingsUpdated);
    };
  }, [auditId]);

  const visibleControls = useMemo(
    () =>
      controlRecords.filter((control) => {
        const matchesAudience =
          audienceFilter === "ALL" || canUserSeeAllControls(activeUser) || isControlAssignedToUser(control, activeUser, users);
        const matchesScope = control.scopeStatus === scopeFilter;

        return matchesAudience && matchesScope;
      }),
    [activeUser, audienceFilter, controlRecords, scopeFilter, users],
  );

  const filteredControls = useMemo(() => {
    return visibleControls
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
          (statusFilter === "ALL" || getDerivedControlStatus(control, getAuditContext(visibleControls, documentRows, questions, requests, users, currentNow)) === statusFilter) &&
          (riskFilter === "ALL" || getControlRiskLevel(control, getAuditContext(visibleControls, documentRows, questions, requests, users, currentNow)) === riskFilter) &&
          (ownerFilter === "ALL" || control.ownerId === ownerFilter || control.assignedOwnerId === ownerFilter)
        );
      })
      .sort((left, right) => {
        const context = getAuditContext(visibleControls, documentRows, questions, requests, users, currentNow);
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
  }, [currentNow, documentRows, dueFilter, ownerFilter, questions, requests, riskFilter, search, sortBy, statusFilter, users, visibleControls]);

  const selectedControl = controlRecords.find((control) => control.id === selectedId) ?? null;
  const canEditPlanningDecisions =
    activeUser.role === "MANAGER" || activeUser.role === "AIC" || activeUser.role === "DIRECTOR";
  const auditContext = useMemo(
    () => getAuditContext(visibleControls, documentRows, questions, requests, users, currentNow),
    [currentNow, documentRows, questions, requests, users, visibleControls],
  );
  const workspaceQuery = useMemo(() => {
    const params = new URLSearchParams();

    if (auditId) {
      params.set("mode", "live");
      params.set("auditId", auditId);
      params.set("auditLabel", auditLabel);
    }

    const sync = searchParams.get("sync");

    if (sync) {
      params.set("sync", sync);
    }

    const phase = searchParams.get("phase");

    if (phase) {
      params.set("phase", phase);
    }

    return params;
  }, [auditId, auditLabel, mode, searchParams]);

  useEffect(() => {
    if (!selectedControl) {
      setPlanningForm({ dueDate: "", ownerId: "", plannedHours: "", scopeStatus: "" });
      setSelectedWorkpaperId("");
      setSelectedTestingMatrixControlId("");
      setSaveError("");
      setSaveSuccess("");
      return;
    }

    setPlanningForm({
      dueDate: toDateInputValue(selectedControl.dueDate),
      ownerId: selectedControl.ownerId,
      plannedHours: selectedControl.plannedHours.toString(),
      scopeStatus: selectedControl.scopeStatus === "UNASSIGNED" ? "" : selectedControl.scopeStatus,
    });
    setSelectedWorkpaperId("");
    setSelectedTestingMatrixControlId("");
    setSaveError("");
    setSaveSuccess("");
    // Only reset when the user actually selects a different control. The
    // selectedControl object reference changes on every save/refresh (router.refresh,
    // setControlRecords), which used to close any open workpaper/matrix panel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedControl?.id]);

  const linkedWorkpapers = useMemo(
    () => (selectedControl ? getLinkedDocuments(selectedControl.id, documentRows).filter((document) => document.type === "WORKPAPER") : []),
    [documentRows, selectedControl],
  );
  const selectedWorkpaper = linkedWorkpapers.find((document) => document.id === selectedWorkpaperId) ?? null;
  const linkedNonWorkpaperDocuments = useMemo(
    () => (selectedControl ? getLinkedDocuments(selectedControl.id, documentRows).filter((document) => document.type !== "WORKPAPER") : []),
    [documentRows, selectedControl],
  );
  const selectedTestingMatrices =
    selectedTestingMatrixControlId.length > 0
      ? getMatricesForControl(testingMatrixRows, selectedTestingMatrixControlId)
      : [];

  return (
    <div className={embedded ? "flex min-h-0 shrink-0 flex-col gap-4" : "flex min-h-0 flex-col gap-4 xl:h-[calc(100dvh-13rem)]"}>
      {!embedded ? (
        <>
          <PageHeader
            title="Control Testing"
            description={
              workspaceSettings.showControlBudgetHours
                ? "Monitor control completion, linked support, due dates, and budget variance across the active audit scope."
                : "Monitor control completion, linked support, due dates, and blockers across the active audit scope."
            }
            phaseStatus={{ label: currentPhase === "Fieldwork" ? "Active execution phase" : `Current phase: ${currentPhase}`, active: currentPhase === "Fieldwork" }}
          />

          <section className={`grid gap-3 ${workspaceSettings.showControlBudgetHours ? "md:grid-cols-3" : "md:grid-cols-2"}`}>
            <SummaryCard
              label="Controls in view"
              value={`${visibleControls.length}`}
              detail={`${visibleControls.filter((control) => shouldShowReminder(control, currentNow)).length} due inside 48h`}
              tone="warning"
            />
            {workspaceSettings.showControlBudgetHours ? (
              <SummaryCard
                label="Over budget"
                value={`${visibleControls.filter((control) => getControlVariance(control) > 0).length}`}
                detail="Hours variance flagged inline"
                tone="risk"
              />
            ) : null}
            <SummaryCard
              label="Past due"
              value={`${visibleControls.filter((control) => isControlOverdue(control, currentNow)).length}`}
              detail="Escalation candidates for managers"
              tone="risk"
            />
          </section>
        </>
      ) : null}

      <section
        className={
          embedded
            ? "relative flex h-[760px] min-h-0 flex-col overflow-hidden rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_14px_34px_rgba(1,30,65,0.07)]"
            : "flex min-h-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-black/5 bg-white p-4 shadow-[0_14px_34px_rgba(1,30,65,0.07)]"
        }
      >
        {embedded ? (
          <div className="mb-4">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Control testing</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Manage control execution</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {workspaceSettings.showControlBudgetHours
                ? "Monitor control completion, linked support, due dates, budget variance, and blockers without leaving the Fieldwork tab."
                : "Monitor control completion, linked support, due dates, and blockers without leaving the Fieldwork tab."}
            </p>
          </div>
        ) : null}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative w-full xl:max-w-xl">
              <Search size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search controls, reference IDs, or business units"
                className="w-full rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-10 py-2.5 text-[13px] outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className={showFilters ? "inline-flex items-center gap-2 rounded-md border border-[var(--brand-indigo-core)] bg-[var(--surface-soft)] px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]" : "inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"}
              >
                <Filter size={16} />
                Filter
              </button>
            </div>
          </div>

          {showFilters ? (
            <div className="flex flex-col gap-3 border border-black/5 bg-[var(--surface-soft)] p-4">
              <div className="flex flex-wrap items-center gap-2">
                {!canUserSeeAllControls(activeUser) ? (
                  <>
                    <FilterPill label="My controls" active={audienceFilter === "ASSIGNED"} onClick={() => setAudienceFilter("ASSIGNED")} />
                    <FilterPill label="All audit controls" active={audienceFilter === "ALL"} onClick={() => setAudienceFilter("ALL")} />
                  </>
                ) : (
                  <FilterPill label="All audit controls" active />
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
                <Select value={scopeFilter} onChange={setScopeFilter} options={["IN_SCOPE", "OUT_OF_SCOPE", "UNASSIGNED"]} label={formatScopeFilterLabel} />
                <Select value={statusFilter} onChange={setStatusFilter} options={["ALL", ...controlStages]} />
                <Select value={riskFilter} onChange={setRiskFilter} options={["ALL", "HIGH", "MEDIUM", "LOW"]} />
                <Select
                  value={ownerFilter}
                  onChange={setOwnerFilter}
                  options={["ALL", ...Array.from(new Set(visibleControls.map((control) => control.ownerId)))]}
                  label={(value) => (value === "ALL" ? "All owners" : getOwnerLabel(visibleControls.find((control) => control.ownerId === value) ?? null, users))}
                />
                <Select value={dueFilter} onChange={setDueFilter} options={dueFilterOptions} label={formatDueFilterLabel} />
                <Select
                  value={sortBy}
                  onChange={setSortBy}
                  options={workspaceSettings.showControlBudgetHours ? controlSortOptions : controlSortOptions.filter((option) => option !== "VARIANCE_DESC")}
                  label={formatControlSortLabel}
                  icon={<ArrowDownUp size={16} />}
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className={embedded ? "mt-4 overflow-auto" : "mt-4 min-h-0 flex-1 overflow-auto"}>
          <table className="min-w-full border-separate border-spacing-y-2">
            <thead className="sticky top-0 z-10 bg-[#fbfaf7]">
              <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                <th className="bg-white px-3 py-2">Control</th>
                <th className="bg-white px-3 py-2">Owner</th>
                <th className="bg-white px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    Status
                    <HoverInfoCard text="Overdue controls show Blocked when any linked question, request, or document is also overdue. If the control is overdue but no linked items are overdue, status shows In Progress." />
                  </span>
                </th>
                <th className="bg-white px-3 py-2">Due</th>
                {workspaceSettings.showControlBudgetHours ? <th className="bg-white px-3 py-2">Hours</th> : null}
                <th className="bg-white px-3 py-2">Scope</th>
                <th className="bg-white px-3 py-2">
                  <span className="inline-flex items-center gap-2">
                    Risk
                    <HoverInfoCard
                      text={
                        workspaceSettings.showControlBudgetHours
                          ? "Risk is scored from overdue timing, blocked status, budget variance, linked open or overdue questions and requests, document review completion, and higher-sensitivity business areas."
                          : "Risk is scored from overdue timing, blocked status, linked open or overdue questions and requests, document review completion, and higher-sensitivity business areas."
                      }
                    />
                  </span>
                </th>
                <th className="bg-white px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredControls.map((control) => {
                const derivedStatus = getDerivedControlStatus(control, auditContext);
                const variance = getControlVariance(control);
                const derivedRiskLevel = getControlRiskLevel(control, auditContext);
                const riskTone = derivedRiskLevel === "HIGH" ? "risk" : derivedRiskLevel === "MEDIUM" ? "warning" : "success";
                const overdue = isControlOverdue(control, currentNow);
                const exceptionCount = controlExceptionsByControlId[control.id]?.length ?? 0;

                return (
                  <tr
                    key={control.id}
                    className="cursor-pointer bg-[#fcfbf8] shadow-[0_10px_24px_rgba(1,30,65,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
                    onClick={() => setSelectedId(control.id)}
                  >
                    <td className={cn("rounded-l-[18px] px-3 py-3", overdue && "control-cell-overdue control-cell-overdue-first")}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-semibold text-[var(--foreground)]">{control.referenceId ?? control.id}</p>
                        {overdue ? <StatusBadge status="Overdue" tone="risk" className="animate-pulse" /> : null}
                        {exceptionCount > 0 ? (
                          <StatusBadge
                            status={exceptionCount === 1 ? "Exception Found" : `${exceptionCount} Exceptions`}
                            tone="warning"
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 text-[13px] text-[var(--foreground)]">{control.name}</p>
                      <p className="mt-0.5 text-[11px] text-[var(--muted)]">{control.businessUnit}</p>
                    </td>
                    <td className={cn("px-3 py-3 text-[13px] text-[var(--muted)]", overdue && "control-cell-overdue")}>{getOwnerLabel(control, users)}</td>
                    <td className={cn("px-3 py-3", overdue && "control-cell-overdue")}>
                      <StatusBadge
                        status={derivedStatus}
                        tone={derivedStatus === "COMPLETE" ? "success" : derivedStatus === "BLOCKED" ? "risk" : "warning"}
                      />
                    </td>
                    <td className={cn("px-3 py-3 text-[13px] text-[var(--muted)]", overdue && "control-cell-overdue")}>{formatShortDate(control.dueDate)}</td>
                    {workspaceSettings.showControlBudgetHours ? (
                      <td className={cn("px-3 py-3 text-[13px] text-[var(--muted)]", overdue && "control-cell-overdue")}>
                        {formatHours(control.actualHours)} / {formatHours(control.plannedHours)}
                        <span className={variance > 0 ? "ml-2 text-[var(--brand-coral)]" : "ml-2 text-[var(--brand-teal-core)]"}>
                          {variance > 0 ? `+${formatHours(variance)}` : `${formatHours(Math.abs(variance))} under`}
                        </span>
                      </td>
                    ) : null}
                    <td className={cn("px-3 py-3", overdue && "control-cell-overdue")}>
                      <StatusBadge status={formatScopeStatus(control.scopeStatus)} tone={getScopeTone(control.scopeStatus)} />
                    </td>
                    <td className={cn("px-3 py-3", overdue && "control-cell-overdue")}>
                      <StatusBadge status={derivedRiskLevel} tone={riskTone} />
                    </td>
                    <td className={cn("rounded-r-[18px] px-3 py-3", overdue && "control-cell-overdue control-cell-overdue-last")}>
                      <div className="flex items-center gap-2">
                        <ReminderButton visible={shouldShowReminder(control, currentNow)} tooltip="Deadline approaching" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedId(control.id);
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Inspect
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredControls.length === 0 ? (
                <tr>
                  <td colSpan={workspaceSettings.showControlBudgetHours ? 8 : 7} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
                    No controls match the current filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {selectedControl && embedded ? (
          <>
            <button
              type="button"
              aria-label="Close control detail"
              onClick={() => setSelectedId("")}
              className="absolute inset-0 z-10 bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
            />
            <aside className="absolute inset-y-0 right-0 z-20 flex w-full max-w-2xl flex-col overflow-hidden border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Control detail</p>
                  <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{`${selectedControl.referenceId ?? selectedControl.id} - ${selectedControl.name}`}</h2>
                  <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">{selectedControl.description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId("")}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
                >
                  <ArrowRight size={18} className="rotate-180" />
                </button>
              </div>
              <div className="mt-8 min-h-0 flex-1 overflow-y-auto pr-1">
                <ControlDetailContent
                  auditId={auditId}
                  canEditPlanningDecisions={canEditPlanningDecisions}
                  currentNow={currentNow}
                  currentUserId={activeUser.id}
                  exceptions={controlExceptionsByControlId[selectedControl.id] ?? []}
                  fieldworkBudgetHours={fieldworkBudgetHours}
                  isSaving={isSaving}
                  allControls={controlRecords}
                  linkedNonWorkpaperDocuments={linkedNonWorkpaperDocuments}
                  linkedTestingMatrices={selectedControl ? getMatricesForControl(testingMatrixRows, selectedControl.id) : []}
                  linkedWorkpapers={linkedWorkpapers}
                  mode={mode}
                  planningForm={planningForm}
                  questions={questions}
                  requests={requests}
                  saveError={saveError}
                  saveSuccess={saveSuccess}
                  selectedControl={selectedControl}
                  setControlRecords={setControlRecords}
                  setPlanningForm={setPlanningForm}
                  setDocumentRows={setDocumentRows}
                  setSaveError={setSaveError}
                  setSaveSuccess={setSaveSuccess}
                  setSelectedTestingMatrixControlId={setSelectedTestingMatrixControlId}
                  setSelectedWorkpaperId={setSelectedWorkpaperId}
                  showNotification={showNotification}
                  startSaving={startSaving}
                  users={users}
                  workspaceSettings={workspaceSettings}
                  workspaceQuery={workspaceQuery}
                  router={router}
                />
              </div>
            </aside>
          </>
        ) : null}

        {selectedWorkpaper && embedded ? (
          <WorkpaperDetailPanel
            auditId={auditId}
            authorUserId={selectedControl?.ownerId}
            contained
            controlAttachments={linkedNonWorkpaperDocuments}
            controls={controlRecords}
            document={selectedWorkpaper}
            mode={mode}
            now={currentNow}
            onClose={() => setSelectedWorkpaperId("")}
            onDocumentUpdated={(nextDocument) => {
              setDocumentRows((current) => current.map((document) => (document.id === nextDocument.id ? nextDocument : document)));
            }}
            questions={questions}
            requests={requests}
            users={users}
            workspaceSettings={workspaceSettings}
          />
        ) : null}

        {selectedControl && selectedTestingMatrixControlId === selectedControl.id && embedded ? (
          <TestingMatrixDetailPanel
            auditId={auditId}
            contained
            control={selectedControl}
            controlAttachments={linkedNonWorkpaperDocuments}
            allMatrices={testingMatrixRows}
            matrices={selectedTestingMatrices}
            fieldworkBudgetHours={fieldworkBudgetHours}
            mode={mode}
            onClose={() => setSelectedTestingMatrixControlId("")}
            onMatricesUpdated={(nextMatrices) => {
              setTestingMatrixRows((current) => replaceMatricesForControl(current, selectedControl.id, nextMatrices));
            }}
            users={users}
          />
        ) : null}
      </section>

      {selectedControl ? (
        embedded ? null : (
          <DetailPanel
            title={`${selectedControl.referenceId ?? selectedControl.id} - ${selectedControl.name}`}
            subtitle={selectedControl.description}
            open={Boolean(selectedControl)}
            onClose={() => setSelectedId("")}
            panelClassName="bottom-4 right-4 top-4 h-auto rounded-[20px] border border-black/5 border-l"
          >
            <ControlDetailContent
              auditId={auditId}
              canEditPlanningDecisions={canEditPlanningDecisions}
              currentNow={currentNow}
              currentUserId={activeUser.id}
              isSaving={isSaving}
              exceptions={controlExceptionsByControlId[selectedControl.id] ?? []}
              fieldworkBudgetHours={fieldworkBudgetHours}
              allControls={controlRecords}
              linkedNonWorkpaperDocuments={linkedNonWorkpaperDocuments}
              linkedTestingMatrices={selectedControl ? getMatricesForControl(testingMatrixRows, selectedControl.id) : []}
              linkedWorkpapers={linkedWorkpapers}
              mode={mode}
              planningForm={planningForm}
              questions={questions}
              requests={requests}
              saveError={saveError}
              saveSuccess={saveSuccess}
              selectedControl={selectedControl}
              setControlRecords={setControlRecords}
              setPlanningForm={setPlanningForm}
              setDocumentRows={setDocumentRows}
              setSaveError={setSaveError}
              setSaveSuccess={setSaveSuccess}
              setSelectedTestingMatrixControlId={setSelectedTestingMatrixControlId}
              setSelectedWorkpaperId={setSelectedWorkpaperId}
              showNotification={showNotification}
              startSaving={startSaving}
              users={users}
              workspaceSettings={workspaceSettings}
              workspaceQuery={workspaceQuery}
              router={router}
            />
          </DetailPanel>
        )
      ) : null}

      {selectedWorkpaper ? (
        embedded ? null : (
        <WorkpaperDetailPanel
          auditId={auditId}
          authorUserId={selectedControl?.ownerId}
          controls={controlRecords}
          controlAttachments={linkedNonWorkpaperDocuments}
          document={selectedWorkpaper}
          mode={mode}
          now={currentNow}
          onClose={() => setSelectedWorkpaperId("")}
          onDocumentUpdated={(nextDocument) => {
            setDocumentRows((current) => current.map((document) => (document.id === nextDocument.id ? nextDocument : document)));
          }}
          questions={questions}
          requests={requests}
          users={users}
          workspaceSettings={workspaceSettings}
        />
        )
      ) : null}

      {selectedControl && selectedTestingMatrixControlId === selectedControl.id ? (
        embedded ? null : (
          <TestingMatrixDetailPanel
            auditId={auditId}
            control={selectedControl}
            controlAttachments={linkedNonWorkpaperDocuments}
            allMatrices={testingMatrixRows}
            matrices={selectedTestingMatrices}
            fieldworkBudgetHours={fieldworkBudgetHours}
            mode={mode}
            onClose={() => setSelectedTestingMatrixControlId("")}
            onMatricesUpdated={(nextMatrices) => {
              setTestingMatrixRows((current) => replaceMatricesForControl(current, selectedControl.id, nextMatrices));
            }}
            users={users}
          />
        )
      ) : null}
    </div>
  );
}

function ControlDetailContent({
  auditId,
  canEditPlanningDecisions,
  currentNow,
  currentUserId,
  exceptions,
  fieldworkBudgetHours,
  isSaving,
  allControls,
  linkedNonWorkpaperDocuments,
  linkedTestingMatrices,
  linkedWorkpapers,
  mode,
  planningForm,
  questions,
  requests,
  saveError,
  saveSuccess,
  selectedControl,
  setControlRecords,
  setPlanningForm,
  setDocumentRows,
  setSaveError,
  setSaveSuccess,
  setSelectedTestingMatrixControlId,
  setSelectedWorkpaperId,
  showNotification,
  startSaving,
  users,
  workspaceSettings,
  workspaceQuery,
  router,
}: {
  auditId: string | null;
  canEditPlanningDecisions: boolean;
  currentNow: string;
  currentUserId: string;
  exceptions: ControlException[];
  fieldworkBudgetHours?: number | null;
  isSaving: boolean;
  allControls: Control[];
  linkedNonWorkpaperDocuments: AuditDocument[];
  linkedTestingMatrices: ControlTestingMatrix[];
  linkedWorkpapers: AuditDocument[];
  mode: DashboardMode;
  planningForm: PlanningFormState;
  questions: Question[];
  requests: Request[];
  saveError: string;
  saveSuccess: string;
  selectedControl: Control;
  setControlRecords: Dispatch<SetStateAction<Control[]>>;
  setPlanningForm: Dispatch<SetStateAction<PlanningFormState>>;
  setDocumentRows: Dispatch<SetStateAction<AuditDocument[]>>;
  setSaveError: Dispatch<SetStateAction<string>>;
  setSaveSuccess: Dispatch<SetStateAction<string>>;
  setSelectedTestingMatrixControlId: Dispatch<SetStateAction<string>>;
  setSelectedWorkpaperId: Dispatch<SetStateAction<string>>;
  showNotification: (args: { title: string; message: string; tone: "success" | "error" }) => void;
  startSaving: TransitionStartFunction;
  users: User[];
  workspaceSettings: AuditWorkspaceSettings;
  workspaceQuery: URLSearchParams;
  router: { push: (href: string) => void; refresh: () => void };
}) {
  const [isAddingAttachment, setIsAddingAttachment] = useState(false);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentName, setAttachmentName] = useState("");
  const [attachmentDescription, setAttachmentDescription] = useState("");
  const controlHoursGuide = useMemo(
    () =>
      buildControlFieldworkHoursGuide({
        controls: allControls,
        fieldworkBudgetHours,
        plannedHoursInput: planningForm.plannedHours,
        selectedControlId: selectedControl.id,
      }),
    [allControls, fieldworkBudgetHours, planningForm.plannedHours, selectedControl.id],
  );

  useEffect(() => {
    resetAttachmentForm();
  }, [selectedControl.id]);

  function resetAttachmentForm() {
    setIsAddingAttachment(false);
    setAttachmentFile(null);
    setAttachmentName("");
    setAttachmentDescription("");
  }

  function handleAttachmentFileChange(file: File | null) {
    setAttachmentFile(file);

    if (file && attachmentName.trim().length === 0) {
      setAttachmentName(file.name);
    }
  }

  function handleAttachmentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!attachmentFile) {
      return;
    }

    const file = attachmentFile;
    const displayName = attachmentName.trim() || file.name;
    const description = attachmentDescription.trim();

    startSaving(async () => {
      try {
        const nextDocument =
          mode === "live" && auditId
            ? await uploadControlAttachment({
                auditId,
                controlId: selectedControl.id,
                description,
                displayName,
                file,
                ownerUserId: currentUserId,
              })
            : createPrototypeControlAttachmentDocument({
                description,
                displayName,
                file,
                linkedControlId: selectedControl.id,
                now: currentNow,
                ordinal: linkedNonWorkpaperDocuments.length,
                ownerId: currentUserId,
              });

        setDocumentRows((current) => [...current, nextDocument]);
        resetAttachmentForm();
        showNotification({
          title: "Attachment uploaded",
          message: `${displayName} was linked to this control.`,
          tone: "success",
        });
      } catch (error) {
        showNotification({
          title: "Upload failed",
          message: error instanceof Error ? error.message : "Unable to upload the selected attachment.",
          tone: "error",
        });
      }
    });
  }

  return (
    <div className="grid gap-4">
      {mode === "live" && canEditPlanningDecisions ? (
        <section className="rounded-[18px] border border-black/5 bg-white p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Planning decisions</p>
              <h3 className="mt-1.5 text-base font-semibold text-[var(--foreground)]">Control setup stored on this audit</h3>
              <p className="mt-1.5 text-[13px] text-[var(--muted)]">
                {workspaceSettings.showControlBudgetHours
                  ? "Managers, the AIC, and the director can assign the control owner, target due date, budgeted hours, and scope for this audit during planning."
                  : "Managers, the AIC, and the director can assign the control owner, target due date, and scope for this audit during planning."}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Control owner</span>
              <select
                value={planningForm.ownerId}
                onChange={(event) => setPlanningForm((current) => ({ ...current, ownerId: event.target.value }))}
                className="rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-3.5 py-2.5 text-[13px] outline-none"
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
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Due date</span>
              <input
                type="date"
                value={planningForm.dueDate}
                onChange={(event) => setPlanningForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-3.5 py-2.5 text-[13px] outline-none"
              />
            </label>

            {workspaceSettings.showControlBudgetHours ? (
              <label className="grid gap-2 md:col-span-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Budgeted hours</span>
                <input
                  type="number"
                  min="0"
                  step="0.25"
                  value={planningForm.plannedHours}
                  onChange={(event) => setPlanningForm((current) => ({ ...current, plannedHours: event.target.value }))}
                  className="rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-3.5 py-2.5 text-[13px] outline-none"
                />
                <FieldworkHoursGuide guide={controlHoursGuide} />
              </label>
            ) : null}

            <label className="grid gap-2 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Scope decision</span>
              <select
                value={planningForm.scopeStatus}
                onChange={(event) => setPlanningForm((current) => ({ ...current, scopeStatus: event.target.value as "" | ControlScopeStatus }))}
                className="rounded-[16px] border border-black/5 bg-[var(--surface-tint)] px-3.5 py-2.5 text-[13px] outline-none"
              >
                <option value="">Leave unassigned</option>
                <option value="IN_SCOPE">In scope</option>
                <option value="OUT_OF_SCOPE">Out of scope</option>
              </select>
            </label>
          </div>

          {saveError ? (
            <p className="mt-3 rounded-[14px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-3.5 py-2.5 text-[13px] text-[var(--brand-coral)]">
              {saveError}
            </p>
          ) : null}
          {saveSuccess ? (
            <p className="mt-3 rounded-[14px] border border-[rgba(5,171,140,0.18)] bg-[rgba(5,171,140,0.08)] px-3.5 py-2.5 text-[13px] text-[var(--brand-teal-core)]">
              {saveSuccess}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
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
                    const payload = buildPlanningPayload(selectedControl, planningForm, auditId, workspaceSettings.showControlBudgetHours);
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
                      scopeStatus: updatedControl.scopeStatus === "UNASSIGNED" ? "" : updatedControl.scopeStatus,
                    });
                    router.refresh();
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
              className="inline-flex items-center justify-center rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save planning details"}
            </button>
          </div>
        </section>
      ) : null}

      <section className="grid gap-3 md:grid-cols-2">
        <InfoCard label="Owner" value={getOwnerLabel(selectedControl, users)} />
        <InfoCard label="Due date" value={formatDateTime(selectedControl.dueDate)} />
        <InfoCard
          label="Date completed"
          value={selectedControl.completedDate ? formatDateTime(selectedControl.completedDate) : "Not completed"}
        />
        {workspaceSettings.showControlBudgetHours ? (
          <InfoCard label="Hours" value={`${formatHours(selectedControl.actualHours)} actual / ${formatHours(selectedControl.plannedHours)} planned`} />
        ) : null}
        <InfoCard
          label="Last planning edit"
          value={selectedControl.planningOverriddenAt ? formatDateTime(selectedControl.planningOverriddenAt) : "No manual override saved"}
        />
        <InfoCard
          label="Scope"
          value={
            selectedControl.scopeStatus === "OUT_OF_SCOPE"
              ? "Out of scope"
              : selectedControl.scopeStatus === "IN_SCOPE"
                ? "In scope"
                : "Unassigned"
          }
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

      <section className="rounded-[18px] border border-black/5 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Control Exceptions</p>
            <p className="mt-1.5 text-[13px] text-[var(--muted)]">Capture testing exceptions identified while reviewing this control.</p>
          </div>
        </div>

        <div className="mt-3 grid gap-2.5">
          {exceptions.length > 0 ? (
            exceptions.map((exception) => (
              <div key={exception.id} className="rounded-[14px] bg-[var(--surface-tint)] px-3.5 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[13px] font-semibold text-[var(--foreground)]">{exception.createdBy}</p>
                  <span className="text-[11px] text-[var(--muted)]">{formatDateTime(exception.createdAt)}</span>
                </div>
                <p className="mt-1.5 text-[13px] text-[var(--foreground)]">{exception.note}</p>
              </div>
            ))
          ) : (
            <p className="text-[13px] text-[var(--muted)]">No control exceptions have been added yet.</p>
          )}
        </div>
      </section>

      <LinkedSection title="Linked questions" empty="No questions linked yet.">
        {getLinkedQuestions(selectedControl.id, questions).map((question) => (
          <LinkedRow
            key={question.id}
            title={`${question.displayId ?? question.id} - ${question.assignedTo}`}
            meta={question.questionText}
            overdue={getQuestionDisplayStatus(question, currentNow) === "OVERDUE"}
            onClick={() => router.push(buildWorkspacePath("/question-log", workspaceQuery, { questionId: question.id }))}
          />
        ))}
      </LinkedSection>

      <LinkedSection title="Linked requests" empty="No requests linked yet.">
        {getLinkedRequests(selectedControl.id, requests).map((request) => (
          <LinkedRow
            key={request.id}
            title={`${request.displayId ?? request.id} - ${request.assignedTo}`}
            meta={request.description}
            overdue={isRequestOverdue(request, currentNow)}
            onClick={() => router.push(buildWorkspacePath("/request-log", workspaceQuery, { requestId: request.id }))}
          />
        ))}
      </LinkedSection>

      <LinkedSection title="Linked testing artifacts" empty="No testing artifacts are linked to this control yet.">
        {linkedWorkpapers.map((document) => (
          <DocumentLinkedRow
            key={document.id}
            actionLabel="Launch workpaper"
            document={document}
            onAction={() => setSelectedWorkpaperId(document.id)}
            workspaceSettings={workspaceSettings}
          />
        ))}
        <TestingMatrixLinkedRow
          control={selectedControl}
          matrices={linkedTestingMatrices}
          onAction={() => setSelectedTestingMatrixControlId(selectedControl.id)}
        />
      </LinkedSection>

      <AttachmentReferencePanel
        actionSlot={
          <button
            type="button"
            onClick={() => setIsAddingAttachment((current) => !current)}
            className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]"
          >
            <Upload size={14} />
            Upload attachment
          </button>
        }
        attachments={linkedNonWorkpaperDocuments}
        auditId={auditId}
        description="Files and screenshots linked to this control for testing support."
        emptyMessage="No control attachments have been uploaded yet."
      >
        {isAddingAttachment ? (
          <form onSubmit={handleAttachmentSubmit} className="grid gap-3 border border-black/5 bg-[var(--surface-tint)] p-3 md:grid-cols-2">
            <label className="grid gap-1 md:col-span-2">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Attachment file</span>
              <input
                type="file"
                onChange={(event) => handleAttachmentFileChange(event.target.files?.[0] ?? null)}
                className="border border-black/10 bg-white px-3 py-2 text-[13px] outline-none"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Display name</span>
              <input
                value={attachmentName}
                onChange={(event) => setAttachmentName(event.target.value)}
                placeholder={attachmentFile?.name ?? "Defaults to uploaded file name"}
                className="border border-black/10 bg-white px-3 py-2 text-[13px] outline-none"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Description</span>
              <input
                value={attachmentDescription}
                onChange={(event) => setAttachmentDescription(event.target.value)}
                placeholder="Optional context for this attachment"
                className="border border-black/10 bg-white px-3 py-2 text-[13px] outline-none"
              />
            </label>
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <button
                type="submit"
                disabled={isSaving || !attachmentFile}
                className="inline-flex items-center gap-2 rounded-sm bg-[var(--brand-indigo-core)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                Upload
              </button>
              <button
                type="button"
                onClick={resetAttachmentForm}
                className="inline-flex items-center gap-2 rounded-sm border border-black/10 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}
      </AttachmentReferencePanel>
    </div>
  );
}

function SummaryCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: "warning" | "risk" }) {
  return (
    <article className="rounded-[18px] border border-black/5 bg-white p-4 shadow-[0_14px_34px_rgba(1,30,65,0.07)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <div className="mt-2 flex items-end gap-2.5">
        <p className="text-[1.7rem] font-semibold leading-none text-[var(--foreground)]">{value}</p>
        <StatusBadge status={tone === "risk" ? "Watchlist" : "Near due"} tone={tone} />
      </div>
      <p className="mt-2 text-[13px] text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function FilterPill({ active = false, label, onClick }: { active?: boolean; label: string; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
        active
          ? "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-dark)]"
          : "border-black/5 bg-[var(--surface-tint)] text-[var(--muted)]",
      )}
    >
      {label}
    </button>
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
      {icon ? <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]">{icon}</span> : null}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className={`rounded-full border border-black/5 bg-[var(--surface-tint)] py-2 text-[13px] text-[var(--foreground)] outline-none ${icon ? "pl-9 pr-3.5" : "px-3.5"}`}
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

function formatScopeFilterLabel(value: ScopeFilter) {
  switch (value) {
    case "IN_SCOPE":
      return "In scope";
    case "OUT_OF_SCOPE":
      return "Out of scope";
    case "UNASSIGNED":
      return "Unassigned";
  }
}

function formatScopeStatus(value: ControlScopeStatus) {
  switch (value) {
    case "IN_SCOPE":
      return "In scope";
    case "OUT_OF_SCOPE":
      return "Out of scope";
    case "UNASSIGNED":
      return "Unassigned";
  }
}

function getScopeTone(value: ControlScopeStatus): "neutral" | "warning" | "risk" {
  switch (value) {
    case "IN_SCOPE":
      return "neutral";
    case "OUT_OF_SCOPE":
      return "risk";
    case "UNASSIGNED":
      return "warning";
  }
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[16px] border border-black/5 bg-white p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
      <p className="mt-1.5 text-[13px] font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

type FieldworkHoursGuideModel = {
  fieldworkBudgetHours: number | null;
  otherAllocatedHours: number;
  remainingHours: number | null;
  selectedBudgetHours: number;
  totalAllocatedHours: number;
};

function FieldworkHoursGuide({ guide }: { guide: FieldworkHoursGuideModel }) {
  if (guide.fieldworkBudgetHours === null) {
    return (
      <span className="border-l-2 border-[rgba(0,46,98,0.18)] pl-3 text-[12px] leading-5 text-[var(--muted)]">
        Fieldwork hours have not been set in planning yet. This control budget will save independently.
      </span>
    );
  }

  const remainingTone = guide.remainingHours !== null && guide.remainingHours < 0 ? "text-[var(--brand-coral)]" : "text-[var(--brand-teal-core)]";

  return (
    <span className="grid gap-1 border-l-2 border-[rgba(0,46,98,0.18)] pl-3 text-[12px] leading-5 text-[var(--muted)]">
      <span>
        Fieldwork pool: <strong className="font-semibold text-[var(--foreground)]">{formatGuideHours(guide.fieldworkBudgetHours)}</strong>
      </span>
      <span>
        Other controls allocated: <strong className="font-semibold text-[var(--foreground)]">{formatGuideHours(guide.otherAllocatedHours)}</strong>
      </span>
      <span>
        Available after this control: <strong className={cn("font-semibold", remainingTone)}>{formatGuideHours(guide.remainingHours ?? 0)}</strong>
      </span>
    </span>
  );
}

function buildControlFieldworkHoursGuide({
  controls,
  fieldworkBudgetHours,
  plannedHoursInput,
  selectedControlId,
}: {
  controls: Control[];
  fieldworkBudgetHours?: number | null;
  plannedHoursInput: string;
  selectedControlId: string;
}): FieldworkHoursGuideModel {
  const normalizedFieldworkBudget = normalizeGuideHours(fieldworkBudgetHours);
  const selectedBudgetHours = normalizeGuideHours(Number(plannedHoursInput)) ?? 0;
  const otherAllocatedHours = controls.reduce((sum, control) => {
    if (control.id === selectedControlId) {
      return sum;
    }

    return sum + (normalizeGuideHours(control.plannedHours) ?? 0);
  }, 0);
  const totalAllocatedHours = otherAllocatedHours + selectedBudgetHours;

  return {
    fieldworkBudgetHours: normalizedFieldworkBudget,
    otherAllocatedHours,
    remainingHours: normalizedFieldworkBudget === null ? null : normalizedFieldworkBudget - totalAllocatedHours,
    selectedBudgetHours,
    totalAllocatedHours,
  };
}

function normalizeGuideHours(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value) || value < 0) {
    return value === null || value === undefined ? null : 0;
  }

  return Math.round(value * 4) / 4;
}

function formatGuideHours(value: number) {
  return `${value.toFixed(value % 1 === 0 ? 0 : 2)}h`;
}

function HoverInfoCard({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--muted)] transition-colors hover:text-[var(--brand-indigo-core)]"
      >
        <CircleHelp size={12} />
      </button>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.55rem)] z-20 w-72 -translate-x-1/2 rounded-[14px] border border-black/5 bg-white px-3.5 py-3 text-left text-[11px] normal-case tracking-normal text-[var(--foreground)] opacity-0 shadow-[0_16px_32px_rgba(1,30,65,0.14)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function LinkedSection({ title, empty, children }: { title: string; empty: string; children: React.ReactNode }) {
  const items = Array.isArray(children) ? children : [children];
  const hasItems = items.some(Boolean);

  return (
    <section className="rounded-[18px] border border-black/5 bg-white p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{title}</p>
      <div className="mt-3 grid gap-2.5">{hasItems ? children : <p className="text-[13px] text-[var(--muted)]">{empty}</p>}</div>
    </section>
  );
}

function LinkedRow({ title, meta, overdue = false, onClick }: { title: string; meta: string; overdue?: boolean; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[14px] bg-[var(--surface-tint)] px-3.5 py-3 text-left transition-colors hover:bg-[rgba(245,168,0,0.08)]"
    >
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-[13px] font-semibold text-[var(--foreground)]">{title}</p>
        {overdue ? <StatusBadge status="Overdue" tone="risk" /> : null}
      </div>
      <p className="mt-1 text-[13px] text-[var(--muted)]">{meta}</p>
    </button>
  );
}

function DocumentLinkedRow({
  actionLabel,
  document,
  onAction,
  workspaceSettings,
}: {
  actionLabel?: string;
  document: AuditDocument;
  onAction?: () => void;
  workspaceSettings: AuditWorkspaceSettings;
}) {
  const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";
  const currentIndex = documentReviewStages.indexOf(reviewStatus);

  return (
    <div className="rounded-[14px] bg-[var(--surface-tint)] px-3.5 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            {document.displayId ?? document.id} - {document.title}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <StatusBadge
              status={document.status}
              tone={document.status === "COMPLETE" ? "success" : document.status === "NOT_STARTED" ? "warning" : "neutral"}
            />
            <StatusBadge
              status={formatReviewWorkflowStageLabel(reviewStatus, workspaceSettings)}
              tone={reviewStatus === "APPROVED" ? "success" : reviewStatus === "NOT_SUBMITTED" ? "warning" : "neutral"}
            />
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Document review workflow</p>
          {onAction ? (
            <button
              type="button"
              onClick={onAction}
              className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-indigo-core)]"
            >
              {actionLabel ?? "Open"}
              <ArrowRight size={14} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-5">
        {documentReviewStages.map((stage, index) => {
          const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
          return (
            <StatusBadge
              key={stage}
              status={formatReviewWorkflowStageLabel(stage, workspaceSettings)}
              tone={tone}
              className="justify-center py-2"
            />
          );
        })}
      </div>
    </div>
  );
}

function TestingMatrixLinkedRow({
  control,
  matrices,
  onAction,
}: {
  control: Control;
  matrices: ControlTestingMatrix[];
  onAction: () => void;
}) {
  const exceptionRowCount = matrices.reduce(
    (total, matrix) =>
      total +
      matrix.samples.filter((sample) => sample.exceptionNoted.trim().length > 0 || matrix.results.some((result) => result.sampleId === sample.id && result.result === "FAIL")).length,
    0,
  );
  const sampleCount = matrices.reduce((total, matrix) => total + matrix.samples.length, 0);
  const attributeCount = matrices.reduce((total, matrix) => total + matrix.attributes.length, 0);
  const primaryMatrix = matrices[0] ?? null;

  return (
    <div className="rounded-[14px] bg-[var(--surface-tint)] px-3.5 py-3.5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[13px] font-semibold text-[var(--foreground)]">
            {primaryMatrix?.title ?? `${control.name} Testing Matrix`}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <StatusBadge status={`${matrices.length} ${matrices.length === 1 ? "matrix" : "matrices"}`} tone="neutral" />
            <StatusBadge status={`${sampleCount} samples`} tone="neutral" />
            <StatusBadge status={`${attributeCount} attributes`} tone="warning" />
            <StatusBadge status={`${exceptionRowCount} exception rows`} tone={exceptionRowCount > 0 ? "risk" : "success"} />
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 lg:items-end">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Structured attribute testing</p>
          <button
            type="button"
            onClick={onAction}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-[11px] font-semibold text-[var(--brand-indigo-core)]"
          >
            Launch testing matrix
            <ArrowRight size={14} />
          </button>
        </div>
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

async function uploadControlAttachment({
  auditId,
  controlId,
  description,
  displayName,
  file,
  ownerUserId,
}: {
  auditId: string;
  controlId: string;
  description: string;
  displayName: string;
  file: File;
  ownerUserId: string;
}) {
  const payload = new FormData();
  payload.set("file", file);
  payload.set("controlId", controlId);
  payload.set("fileName", displayName);

  if (isUuid(ownerUserId)) {
    payload.set("ownerUserId", ownerUserId);
  }

  if (description) {
    payload.set("description", description);
  }

  const response = await fetch(`/api/audits/${auditId}/response-attachments`, {
    method: "POST",
    body: payload,
  });
  const result = (await response.json()) as (AuditDocumentRow & { error?: string }) | { error?: string };

  if (!response.ok) {
    throw new Error("error" in result ? result.error ?? "Unable to upload attachment." : "Unable to upload attachment.");
  }

  return mapDocument(result as AuditDocumentRow);
}

function createPrototypeControlAttachmentDocument({
  description,
  displayName,
  file,
  linkedControlId,
  now,
  ordinal,
  ownerId,
}: {
  description: string;
  displayName: string;
  file: File;
  linkedControlId: string;
  now: string;
  ordinal: number;
  ownerId: string;
}): AuditDocument {
  return {
    id: `control-attachment-${ordinal + 1}`,
    type: "EVIDENCE",
    title: displayName,
    linkedControlId,
    ownerId,
    status: "COMPLETE",
    previewSummary: description || `Uploaded attachment linked to this control on ${formatDateTime(now)}.`,
    previewSections: [
      {
        heading: "Attachment metadata",
        body: [
          `Display name: ${displayName}`,
          `Original file name: ${file.name}`,
          ...(description ? [`Description: ${description}`] : []),
          `File size: ${formatFileSize(file.size)}`,
          `File type: ${file.type || "Unknown"}`,
        ],
      },
    ],
    attachment: {
      description: description || undefined,
      fileName: displayName,
      fileSizeBytes: file.size,
      mimeType: file.type || undefined,
      originalFileName: file.name,
      uploadedAt: now,
      uploadedInApp: true,
    },
    updatedAt: now,
  };
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function getMatricesForControl(matrices: ControlTestingMatrix[], controlId: string) {
  return matrices
    .filter((matrix) => matrix.controlId === controlId)
    .sort((left, right) => left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt));
}

function replaceMatricesForControl(current: ControlTestingMatrix[], controlId: string, nextMatrices: ControlTestingMatrix[]) {
  return [...current.filter((matrix) => matrix.controlId !== controlId), ...nextMatrices].sort(
    (left, right) => left.controlId.localeCompare(right.controlId) || left.displayOrder - right.displayOrder || left.createdAt.localeCompare(right.createdAt),
  );
}

function getOwnerLabel(control: Control | null, users: User[]) {
  if (!control?.ownerId) {
    return "Unassigned";
  }

  return getControlOwner(control, users) || "Unassigned";
}

function isControlAssignedToUser(control: Control, activeUser: User, users: User[]) {
  const ownerCandidates = [control.ownerId, control.assignedOwnerId].filter(Boolean) as string[];
  const normalizedActiveName = activeUser.name.trim().toLowerCase();
  const normalizedActiveEmail = activeUser.email.trim().toLowerCase();

  return ownerCandidates.some((ownerId) => {
    if (ownerId === activeUser.id) {
      return true;
    }

    const matchedUser = users.find((user) => user.id === ownerId);
    if (!matchedUser) {
      return false;
    }

    return (
      matchedUser.name.trim().toLowerCase() === normalizedActiveName ||
      matchedUser.email.trim().toLowerCase() === normalizedActiveEmail
    );
  });
}

function toDateInputValue(value?: string) {
  return value ? value.slice(0, 10) : "";
}

function buildPlanningPayload(control: Control, planningForm: PlanningFormState, auditId: string, showControlBudgetHours: boolean) {
  const normalizedOwnerId = planningForm.ownerId || null;
  const normalizedDueDate = planningForm.dueDate || null;
  const normalizedPlannedHours =
    !showControlBudgetHours || planningForm.plannedHours.trim().length === 0 ? null : Number(planningForm.plannedHours);

  return {
    auditId,
    assignedOwnerUserId: normalizedOwnerId === (control.importedOwnerId ?? null) ? null : normalizedOwnerId,
    clearAssignedOwner: normalizedOwnerId === null,
    assignedDueDate: normalizedDueDate === toDateInputValue(control.importedDueDate) ? null : normalizedDueDate,
    assignedPlannedHours:
      normalizedPlannedHours === null || normalizedPlannedHours === (control.importedPlannedHours ?? 0) ? null : normalizedPlannedHours,
    scopeStatus: planningForm.scopeStatus || undefined,
  };
}

function applyControlPlanningResponse(control: Control, response: ControlPlanningApiResponse): Control {
  const assignedDueDate = response.assignedDueDate ? `${response.assignedDueDate}T00:00:00.000Z` : undefined;
  const importedDueDate = control.importedDueDate;
  const importedPlannedHours = control.importedPlannedHours ?? 0;

  return {
    ...control,
    ownerId: response.clearAssignedOwner ? "" : response.effectiveOwnerUserId ?? response.assignedOwnerUserId ?? control.importedOwnerId ?? "",
    assignedOwnerId: response.assignedOwnerUserId ?? undefined,
    dueDate: assignedDueDate ?? importedDueDate,
    assignedDueDate,
    plannedHours: response.assignedPlannedHours ?? importedPlannedHours,
    assignedPlannedHours: response.assignedPlannedHours ?? undefined,
    hasPlanningOverride: response.hasPlanningOverride,
    planningOverriddenAt: response.planningOverriddenAt ?? undefined,
    scopeStatus: response.scopeStatus ?? control.scopeStatus ?? "UNASSIGNED",
  };
}

function groupControlExceptions(exceptions: ControlException[]) {
  return exceptions.reduce<Record<string, ControlException[]>>((grouped, exception) => {
    grouped[exception.controlId] = [...(grouped[exception.controlId] ?? []), exception];
    return grouped;
  }, {});
}
