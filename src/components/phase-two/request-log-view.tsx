"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowDownUp, ArrowRight, CircleHelp, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getRequestChainDelayHours,
  getRequestCurrentDelayHours,
  getRequestFollowUps,
  getRequestRealizedDelayHours,
  getRequestRelatedDocuments,
  isRequestOverdue,
  shouldShowReminder,
} from "@/lib/audit-logic";
import { getQuestionLogNow } from "@/lib/question-log-data";
import type { DashboardMode } from "@/lib/live-audit";
import { formatDateTime, formatHours, formatShortDate } from "@/lib/utils";
import type { AuditDocument, AuditPhase, Control, Question, Request, User } from "@/types/audit";

type DueFilter = "ALL" | "OVERDUE" | "NEXT_48_HOURS" | "NEXT_7_DAYS" | "FUTURE";
type RequestSort = "DUE_ASC" | "DUE_DESC" | "REQUESTED_DESC" | "ASSIGNED_TO_ASC" | "STATUS_ASC";

const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const requestSortOptions: RequestSort[] = ["DUE_ASC", "DUE_DESC", "REQUESTED_DESC", "ASSIGNED_TO_ASC", "STATUS_ASC"];
const phaseTagOptions: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];

type RequestLogViewProps = {
  auditId: string | null;
  auditLabel: string;
  controls: Control[];
  documents: AuditDocument[];
  embedded?: boolean;
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

export function RequestLogView({
  auditId,
  auditLabel,
  controls,
  documents,
  embedded = false,
  mode,
  questions,
  requests,
  users,
}: RequestLogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [requestRows, setRequestRows] = useState<Request[]>(requests);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Request["status"] | "ALL">("ALL");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [sortBy, setSortBy] = useState<RequestSort>("DUE_ASC");
  const [isCreating, setIsCreating] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<{ parentQuestionId?: string; parentRequestId?: string } | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const currentNow = useMemo(() => getQuestionLogNow(mode), [mode]);
  const requestOwners = useMemo(
    () => Array.from(new Set([...users.map((user) => user.name), ...requestRows.map((request) => request.assignedTo)])),
    [requestRows, users],
  );
  const defaultRequestForm = useMemo(
    () => ({
      controlId: controls[0]?.id ?? "",
      assignedTo: requestOwners[0] ?? "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      phaseTag: "Planning" as AuditPhase,
      parentQuestionId: undefined as string | undefined,
      parentRequestId: undefined as string | undefined,
      description: "",
    }),
    [controls, currentNow, requestOwners],
  );
  const [form, setForm] = useState(defaultRequestForm);
  const openCreateMode = searchParams.get("openCreate");
  const followUpQuestionId = searchParams.get("followUpQuestionId");

  useEffect(() => {
    setRequestRows(requests);
  }, [requests]);

  useEffect(() => {
    setForm(defaultRequestForm);
  }, [defaultRequestForm]);

  useEffect(() => {
    if (openCreateMode !== "request" || !followUpQuestionId) {
      return;
    }

    const followUpQuestion = questions.find((item) => item.id === followUpQuestionId);

    if (!followUpQuestion) {
      return;
    }

    setForm({
      ...defaultRequestForm,
      assignedTo: followUpQuestion.assignedTo,
      controlId: followUpQuestion.controlId,
      parentQuestionId: followUpQuestion.id,
      parentRequestId: undefined,
      phaseTag: followUpQuestion.phaseTag ?? defaultRequestForm.phaseTag,
    });
    setFollowUpTarget({ parentQuestionId: followUpQuestion.id });
    setIsCreating(true);
  }, [defaultRequestForm, followUpQuestionId, openCreateMode, questions]);

  const filteredRequests = useMemo(() => {
    return requestRows
      .filter((request) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          request.id.toLowerCase().includes(q) ||
          getRequestLabel(request).toLowerCase().includes(q) ||
          request.description.toLowerCase().includes(q) ||
          request.assignedTo.toLowerCase().includes(q);
        const hoursToDue = hoursUntil(request.dueDate, currentNow);
        const matchesDueFilter =
          dueFilter === "ALL" ||
          (dueFilter === "OVERDUE" && hoursToDue < 0) ||
          (dueFilter === "NEXT_48_HOURS" && hoursToDue >= 0 && hoursToDue <= 48) ||
          (dueFilter === "NEXT_7_DAYS" && hoursToDue >= 0 && hoursToDue <= 168) ||
          (dueFilter === "FUTURE" && hoursToDue > 168);

        return (
          matchesSearch &&
          matchesDueFilter &&
          (statusFilter === "ALL" || request.status === statusFilter) &&
          (assignedToFilter === "ALL" || request.assignedTo === assignedToFilter)
        );
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "DUE_ASC":
            return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
          case "DUE_DESC":
            return new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime();
          case "REQUESTED_DESC":
            return new Date(right.dateRequested).getTime() - new Date(left.dateRequested).getTime();
          case "ASSIGNED_TO_ASC":
            return left.assignedTo.localeCompare(right.assignedTo);
          case "STATUS_ASC":
            return left.status.localeCompare(right.status);
          default:
            return 0;
        }
      });
  }, [assignedToFilter, currentNow, dueFilter, requestRows, search, sortBy, statusFilter]);

  const selectedRequest = requestRows.find((request) => request.id === selectedId) ?? null;
  const selectedRequestIdFromUrl = searchParams.get("requestId");
  const canCreateInLiveMode = mode === "live" && Boolean(auditId);
  const canRespondToRequest = selectedRequest
    ? selectedRequest.assignedTo === activeUser.name || ["MANAGER", "DIRECTOR", "CAE"].includes(activeUser.role)
    : false;

  useEffect(() => {
    if (selectedRequestIdFromUrl && requestRows.some((request) => request.id === selectedRequestIdFromUrl)) {
      setSelectedId(selectedRequestIdFromUrl);
    }
  }, [selectedRequestIdFromUrl, requestRows]);

  useEffect(() => {
    setResponseDraft(selectedRequest?.responseNotes ?? "");
  }, [selectedRequest?.id, selectedRequest?.responseNotes]);

  function openRequest(requestId: string) {
    setSelectedId(requestId);
    const params = new URLSearchParams(searchParams.toString());
    if (embedded) {
      params.set("tab", "requests");
    }
    params.set("requestId", requestId);
    params.delete("questionId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeRequest() {
    setSelectedId("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("requestId");
    if (embedded) {
      params.set("tab", "requests");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearCreateQueryParams() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openCreate");
    params.delete("followUpQuestionId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function closeCreateModal() {
    setIsCreating(false);
    setFollowUpTarget(null);
    setForm(defaultRequestForm);
    clearCreateQueryParams();
  }

  function handleCreateRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canCreateInLiveMode && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/requests`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              assignedTo: form.assignedTo,
              controlId: form.controlId,
              dueDate: form.dueDate,
              phaseTag: form.phaseTag,
              parentQuestionId: form.parentQuestionId,
              parentRequestId: form.parentRequestId,
              description: form.description.trim(),
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to create request.");
          }

          setForm(defaultRequestForm);
          setFollowUpTarget(null);
          setIsCreating(false);
          clearCreateQueryParams();
          router.refresh();
        } catch (error) {
          showNotification({
            title: "Create failed",
            message: error instanceof Error ? error.message : "Unable to create request.",
            tone: "error",
          });
        }
      });
      return;
    }

    const nextId = `R-${String(requestRows.length + 1).padStart(2, "0")}`;
    const nextRequest: Request = {
      id: nextId,
      displayId: nextId,
      controlId: form.controlId,
      phaseTag: form.phaseTag,
      parentQuestionId: form.parentQuestionId,
      parentRequestId: form.parentRequestId,
      assignedTo: form.assignedTo,
      dateRequested: new Date(currentNow).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      description: form.description.trim(),
      status: "OPEN",
    };

    setRequestRows((current) => [...current, nextRequest]);
    setForm(defaultRequestForm);
    setFollowUpTarget(null);
    setIsCreating(false);
    clearCreateQueryParams();
  }

  function handleSubmitResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedRequest || responseDraft.trim().length === 0) {
      return;
    }

    if (mode === "live" && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/requests/${selectedRequest.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              responseNotes: responseDraft.trim(),
              status: "COMPLETED",
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to save request response.");
          }

          router.refresh();
        } catch (error) {
          showNotification({
            title: "Update failed",
            message: error instanceof Error ? error.message : "Unable to save request response.",
            tone: "error",
          });
        }
      });

      return;
    }

    setRequestRows((current) =>
      current.map((request) =>
        request.id === selectedRequest.id
          ? {
              ...request,
              responseNotes: responseDraft.trim(),
              completedAt: new Date(currentNow).toISOString(),
              status: "COMPLETED",
            }
          : request,
      ),
    );
  }

  function openRequestFollowUp(request: Request) {
    setForm({
      ...defaultRequestForm,
      assignedTo: request.assignedTo,
      controlId: request.controlId ?? defaultRequestForm.controlId,
      parentQuestionId: undefined,
      parentRequestId: request.id,
      phaseTag: request.phaseTag ?? defaultRequestForm.phaseTag,
    });
    setFollowUpTarget({ parentRequestId: request.id });
    setIsCreating(true);
  }

  function openCrossTypeFollowUpQuestion(request: Request) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", "questions");
    params.set("openCreate", "question");
    params.set("followUpRequestId", request.id);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className={embedded ? "flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-col gap-6 xl:h-[calc(100dvh-13.5rem)]"}>
      {!embedded ? (
        <PageHeader
          eyebrow="Phase 2"
          title="Request log"
          description={
            mode === "live"
              ? `Request tracking for ${auditLabel}. Live rows and response notes are loaded from Supabase for this audit.`
              : "Evidence-request tracking with overdue highlighting, fulfillment notes, and document placeholders tied back to audit controls."
          }
          phaseStatus={{
            label: mode === "live" ? "Live audit data" : "Prototype mode",
            active: mode === "live",
          }}
        />
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full lg:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search requests or owners"
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-11 py-3 text-sm outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Request["status"] | "ALL")}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="COMPLETED">Completed</option>
            </select>
            <select
              value={assignedToFilter}
              onChange={(event) => setAssignedToFilter(event.target.value)}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              <option value="ALL">All contacts</option>
              {requestOwners.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={dueFilter}
              onChange={(event) => setDueFilter(event.target.value as DueFilter)}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              {dueFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {formatDueFilterLabel(option)}
                </option>
              ))}
            </select>
            <div className="relative">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]">
                <ArrowDownUp size={16} />
              </span>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as RequestSort)}
                className="rounded-full border border-black/5 bg-[var(--surface-tint)] py-2 pl-10 pr-4 text-sm"
              >
                {requestSortOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatRequestSortLabel(option)}
                  </option>
                ))}
              </select>
            </div>

            {mode === "prototype" || canCreateInLiveMode ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(1,30,65,0.18)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus size={16} />
                New Request
              </button>
            ) : (
              <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Select a live audit to create requests
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="bg-white px-4 py-2">Request</th>
                <th className="bg-white px-4 py-2">Tagged person</th>
                <th className="bg-white px-4 py-2">Requested</th>
                <th className="bg-white px-4 py-2">Due</th>
                <th className="bg-white px-4 py-2">Delay impact</th>
                <th className="bg-white px-4 py-2">Status</th>
                <th className="bg-white px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.map((request) => {
                const overdue = isRequestOverdue(request, currentNow);
                const currentDelayHours = getRequestCurrentDelayHours(request, currentNow);
                const realizedDelayHours = getRequestRealizedDelayHours(request);
                const chainDelayHours = getRequestChainDelayHours(request, questions, requestRows, currentNow);
                const tone = request.status === "COMPLETED" ? "success" : overdue ? "risk" : "warning";

                return (
                  <tr
                    key={request.id}
                    className="cursor-pointer bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
                    onClick={() => openRequest(request.id)}
                  >
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{getRequestLabel(request)}</p>
                      <p className="mt-1 max-w-md text-sm text-[var(--foreground)]">{request.description}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        {request.controlId ? `Control ${request.controlId}` : "General request"} · {request.phaseTag ?? "Planning"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{request.assignedTo}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(request.dateRequested)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(request.dueDate)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">
                      {formatRequestDelayImpactLabel({ chainDelayHours, currentDelayHours, realizedDelayHours })}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={overdue ? "OVERDUE" : request.status} tone={tone} />
                    </td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ReminderButton visible={shouldShowReminder(request, currentNow)} tooltip="Need-by date approaching" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openRequest(request.id);
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

      <FormModal
        open={isCreating}
        title="New Request"
        subtitle={
          followUpTarget
            ? "Create a linked follow-up request when the prior response or evidence package was incomplete."
            : "Create a new evidence or document request and tag the person responsible for fulfilling it."
        }
        onClose={closeCreateModal}
      >
        <form className="grid gap-4" onSubmit={handleCreateRequest}>
          <Field label="Request">
            <textarea
              required
              rows={4}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              placeholder="Describe the evidence or document needed"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tag person">
              <select
                value={form.assignedTo}
                onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {requestOwners.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Need by">
              <input
                required
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <Field label="Related control">
            <select
              value={form.controlId}
              onChange={(event) => setForm((current) => ({ ...current, controlId: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
            >
              {controls.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlLabel(control)} - {control.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Phase">
            <select
              value={form.phaseTag}
              onChange={(event) => setForm((current) => ({ ...current, phaseTag: event.target.value as AuditPhase }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
            >
              {phaseTagOptions.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </Field>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save Request
            </button>
          </div>
        </form>
      </FormModal>

      {selectedRequest ? (
        <DetailPanel
          title={`${getRequestLabel(selectedRequest)} · ${selectedRequest.assignedTo}`}
          subtitle={selectedRequest.description}
          open={Boolean(selectedRequest)}
          onClose={closeRequest}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Tagged person" value={selectedRequest.assignedTo} />
              <DetailCard label="Linked control" value={selectedRequest.controlId ?? "Not linked"} />
              <DetailCard label="Phase" value={selectedRequest.phaseTag ?? "Planning"} />
              <DetailCard label="Date requested" value={formatDateTime(selectedRequest.dateRequested)} />
              <DetailCard label="Due date" value={formatDateTime(selectedRequest.dueDate)} />
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              <DetailCard
                label="Current delay"
                value={formatHours(getRequestCurrentDelayHours(selectedRequest, currentNow))}
                helpText="Hours currently past the due date for an open or in-progress request. This drops to zero once the request is completed."
              />
              <DetailCard
                label="Realized delay"
                value={formatHours(getRequestRealizedDelayHours(selectedRequest))}
                helpText="Hours the request ended up late when it was completed, measured from due date to completion timestamp."
              />
              <DetailCard
                label="Chain delay impact"
                value={formatHours(getRequestChainDelayHours(selectedRequest, questions, requestRows, currentNow))}
                helpText="Total delay impact across this request and any linked follow-up questions or requests created because the original response package was incomplete."
              />
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Fulfillment status</p>
              <StatusBadge
                status={isRequestOverdue(selectedRequest, currentNow) ? "OVERDUE" : selectedRequest.status}
                tone={selectedRequest.status === "COMPLETED" ? "success" : isRequestOverdue(selectedRequest, currentNow) ? "risk" : "warning"}
                className="mt-4"
              />
              <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                {selectedRequest.responseNotes ?? "Awaiting evidence package. Follow-up remains open in the operating queue."}
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Completed at: {selectedRequest.completedAt ?? selectedRequest.receivedDate ? formatDateTime(selectedRequest.completedAt ?? selectedRequest.receivedDate ?? "") : "Pending"}
              </p>
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Follow-ups</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Create a linked follow-up when the response package was incomplete or did not answer the ask.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openCrossTypeFollowUpQuestion(selectedRequest)}
                    className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                  >
                    Follow-up question
                  </button>
                  <button
                    type="button"
                    onClick={() => openRequestFollowUp(selectedRequest)}
                    className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Follow-up request
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {renderRequestFollowUpRows(getRequestFollowUps(selectedRequest, questions, requestRows))}
              </div>
            </section>

            {canRespondToRequest ? (
              <section className="rounded-[24px] border border-black/5 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Post fulfillment notes</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Add the response or fulfillment notes for this request and mark it complete.
                </p>
                <form className="mt-4 grid gap-4" onSubmit={handleSubmitResponse}>
                  <textarea
                    required
                    rows={5}
                    value={responseDraft}
                    onChange={(event) => setResponseDraft(event.target.value)}
                    className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
                    placeholder="Type the request fulfillment notes"
                  />
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isPending || responseDraft.trim().length === 0}
                      className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save Notes
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Evidence placeholders</p>
              <div className="mt-4 grid gap-3">
                {getRequestRelatedDocuments(selectedRequest.id, documents).length > 0 ? (
                  getRequestRelatedDocuments(selectedRequest.id, documents).map((document) => (
                    <div key={document.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{document.status.replaceAll("_", " ")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No direct file placeholder linked yet.</p>
                )}
              </div>
            </section>
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}

function FormModal({
  open,
  title,
  subtitle,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,30,65,0.32)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-black/5 bg-[#fbfaf7] p-6 shadow-[0_24px_80px_rgba(1,30,65,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Create item</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
          >
            <X size={18} />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function DetailCard({ label, value, helpText }: { label: string; value: string; helpText?: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
        {helpText ? <HoverInfoCard text={helpText} /> : null}
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function HoverInfoCard({ text }: { text: string }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--muted)] transition-colors hover:text-[var(--brand-indigo-core)]"
        aria-label="More information"
      >
        <CircleHelp size={12} />
      </span>
      <span className="pointer-events-none absolute left-1/2 top-[calc(100%+0.65rem)] z-20 w-72 -translate-x-1/2 rounded-[18px] border border-black/5 bg-white px-4 py-3 text-left text-[11px] normal-case tracking-normal text-[var(--foreground)] opacity-0 shadow-[0_18px_40px_rgba(1,30,65,0.14)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function toLocalInputValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  const hours = `${value.getHours()}`.padStart(2, "0");
  const minutes = `${value.getMinutes()}`.padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function hoursUntil(value: string, now: string) {
  return (new Date(value).getTime() - new Date(now).getTime()) / (1000 * 60 * 60);
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

function formatRequestSortLabel(value: RequestSort) {
  switch (value) {
    case "DUE_ASC":
      return "Sort: due soonest";
    case "DUE_DESC":
      return "Sort: due latest";
    case "REQUESTED_DESC":
      return "Sort: newest requests";
    case "ASSIGNED_TO_ASC":
      return "Sort: contact";
    case "STATUS_ASC":
      return "Sort: status";
  }
}

function getRequestLabel(request: Request) {
  return request.displayId ?? request.id;
}

function getControlLabel(control: Control) {
  return control.referenceId ?? control.id;
}

function formatRequestDelayImpactLabel({
  chainDelayHours,
  currentDelayHours,
  realizedDelayHours,
}: {
  chainDelayHours: number;
  currentDelayHours: number;
  realizedDelayHours: number;
}) {
  if (chainDelayHours > 0) {
    return `${formatHours(chainDelayHours)} chain delay`;
  }

  if (currentDelayHours > 0) {
    return `${formatHours(currentDelayHours)} overdue`;
  }

  if (realizedDelayHours > 0) {
    return `${formatHours(realizedDelayHours)} realized`;
  }

  return "On time";
}

function renderRequestFollowUpRows(followUps: { questions: Question[]; requests: Request[] }) {
  if (followUps.questions.length === 0 && followUps.requests.length === 0) {
    return <p className="text-sm text-[var(--muted)]">No linked follow-up items yet.</p>;
  }

  return (
    <>
      {followUps.questions.map((question) => (
        <div key={`question-${question.id}`} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">{question.displayId ?? question.id} · Question</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{question.questionText}</p>
        </div>
      ))}
      {followUps.requests.map((request) => (
        <div key={`request-${request.id}`} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
          <p className="text-sm font-semibold text-[var(--foreground)]">{request.displayId ?? request.id} · Request</p>
          <p className="mt-1 text-sm text-[var(--muted)]">{request.description}</p>
        </div>
      ))}
    </>
  );
}
