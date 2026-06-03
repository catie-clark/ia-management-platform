"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ArrowRight, ChevronDown, ChevronRight, CircleHelp, Filter, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { formatBusinessContactLabel, type BusinessContact } from "@/lib/business-contacts";
import {
  getQuestionChainDelayHours,
  getQuestionCurrentDelayHours,
  getQuestionDisplayStatus,
  getQuestionRealizedDelayHours,
  getQuestionRelatedDocuments,
  getRequestChainDelayHours,
  getRequestCurrentDelayHours,
  getRequestDisplayStatus,
  getRequestRealizedDelayHours,
  getRequestRelatedDocuments,
  shouldShowReminder,
} from "@/lib/audit-logic";
import {
  filterDocumentsForControls,
  filterQuestionsForControls,
  filterRequestsForControls,
  matchesStakeholderUser,
} from "@/lib/control-visibility";
import { getQuestionLogNow } from "@/lib/question-log-data";
import type { DashboardMode } from "@/lib/live-audit";
import { formatDateTime, formatHours, formatShortDate } from "@/lib/utils";
import type { AuditDocument, AuditPhase, Control, Question, Request, User } from "@/types/audit";

type DueFilter = "ALL" | "OVERDUE" | "NEXT_48_HOURS" | "NEXT_7_DAYS" | "FUTURE";
type LogSort = "DUE_ASC" | "DUE_DESC" | "CREATED_DESC" | "ASSIGNED_TO_ASC" | "STATUS_ASC";
type LogStatusFilter = "ALL" | "OPEN" | "OVERDUE" | "IN_PROGRESS" | "FOLLOW_UP_PENDING" | "RESPONDED" | "COMPLETED";
type LogDisplayStatus = Exclude<LogStatusFilter, "ALL">;
type LogKind = "question" | "request";

type CombinedLogViewProps = {
  auditId: string | null;
  controls: Control[];
  currentPhase: AuditPhase;
  documents: AuditDocument[];
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

type LogItem = {
  assignedTo: string;
  controlId?: string;
  createdAt: string;
  dueDate: string;
  id: string;
  item: Question | Request;
  key: string;
  kind: LogKind;
  label: string;
  parentKey?: string;
  text: string;
};

const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const statusFilterOptions: LogStatusFilter[] = [
  "ALL",
  "OPEN",
  "OVERDUE",
  "IN_PROGRESS",
  "FOLLOW_UP_PENDING",
  "RESPONDED",
  "COMPLETED",
];
const sortOptions: LogSort[] = ["DUE_ASC", "DUE_DESC", "CREATED_DESC", "ASSIGNED_TO_ASC", "STATUS_ASC"];
const phaseTagOptions: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];
const fieldControlClass = "w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none";
const stakeholderRoleOptions = [
  "Avery Collins",
  "IT Ops Lead",
  "Treasury Manager",
  "Consumer Lending Manager",
  "Compliance Director",
  "Vendor Governance Lead",
  "BSA Operations Lead",
  "Data Governance Manager",
  "Operations Manager",
] as const;

export function CombinedLogView({
  auditId,
  controls,
  currentPhase,
  documents,
  mode,
  questions,
  requests,
  users,
}: CombinedLogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [businessContacts, setBusinessContacts] = useState<BusinessContact[]>([]);
  const [isPending, startTransition] = useTransition();
  const [questionRows, setQuestionRows] = useState<Question[]>(questions);
  const [requestRows, setRequestRows] = useState<Request[]>(requests);
  const [documentRows, setDocumentRows] = useState<AuditDocument[]>(documents);
  const [selectedItem, setSelectedItem] = useState<{ kind: LogKind; id: string } | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<LogStatusFilter>("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [assignedToFilter, setAssignedToFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState<LogSort>("DUE_ASC");
  const [showFilters, setShowFilters] = useState(false);
  const [questionFormOpen, setQuestionFormOpen] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [responseDraft, setResponseDraft] = useState("");
  const currentNow = useMemo(() => getQuestionLogNow(mode), [mode]);

  useEffect(() => setQuestionRows(questions), [questions]);
  useEffect(() => setRequestRows(requests), [requests]);
  useEffect(() => setDocumentRows(documents), [documents]);

  useEffect(() => {
    if (!auditId) {
      setBusinessContacts([]);
      return;
    }

    let cancelled = false;

    async function loadBusinessContacts() {
      try {
        const response = await fetch(`/api/audits/${auditId}/business-contacts`, { cache: "no-store" });
        const payload = (await response.json()) as { contacts?: BusinessContact[]; error?: string };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load business contacts.");
        }

        if (!cancelled) {
          setBusinessContacts(payload.contacts ?? []);
        }
      } catch {
        if (!cancelled) {
          setBusinessContacts([]);
        }
      }
    }

    void loadBusinessContacts();
    const handleContactsUpdated = () => {
      void loadBusinessContacts();
    };
    window.addEventListener("business-contacts-updated", handleContactsUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("business-contacts-updated", handleContactsUpdated);
    };
  }, [auditId]);

  const visibleControls = useMemo(() => controls, [controls]);
  const visibleQuestions = useMemo(
    () => filterQuestionsForControls(questionRows, visibleControls, activeUser, "ALL"),
    [activeUser, questionRows, visibleControls],
  );
  const visibleRequests = useMemo(
    () => filterRequestsForControls(requestRows, visibleControls, activeUser, "ALL"),
    [activeUser, requestRows, visibleControls],
  );
  const visibleDocuments = useMemo(
    () => filterDocumentsForControls(documentRows, visibleControls, activeUser, "ALL"),
    [activeUser, documentRows, visibleControls],
  );
  const controlLabelById = useMemo(() => new Map(controls.map((control) => [control.id, getControlLabel(control)])), [controls]);
  const createControlOptions = useMemo(() => controls, [controls]);
  const businessContactLabels = useMemo(
    () => businessContacts.map((contact) => formatBusinessContactLabel(contact)),
    [businessContacts],
  );
  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...stakeholderRoleOptions,
          ...businessContactLabels,
          ...visibleQuestions.map((question) => question.assignedTo),
          ...visibleRequests.map((request) => request.assignedTo),
        ]),
      ),
    [businessContactLabels, visibleQuestions, visibleRequests],
  );

  const logItems = useMemo(() => {
    const questionItems: LogItem[] = visibleQuestions.map((question) => ({
      assignedTo: question.assignedTo,
      controlId: question.controlId,
      createdAt: question.dateSent,
      dueDate: question.dueDate,
      id: question.id,
      item: question,
      key: getLogKey("question", question.id),
      kind: "question",
      label: question.displayId ?? question.id,
      parentKey: question.parentQuestionId
        ? getLogKey("question", question.parentQuestionId)
        : question.parentRequestId
          ? getLogKey("request", question.parentRequestId)
          : undefined,
      text: question.questionText,
    }));
    const requestItems: LogItem[] = visibleRequests.map((request) => ({
      assignedTo: request.assignedTo,
      controlId: request.controlId,
      createdAt: request.dateRequested,
      dueDate: request.dueDate,
      id: request.id,
      item: request,
      key: getLogKey("request", request.id),
      kind: "request",
      label: request.displayId ?? request.id,
      parentKey: request.parentQuestionId
        ? getLogKey("question", request.parentQuestionId)
        : request.parentRequestId
          ? getLogKey("request", request.parentRequestId)
          : undefined,
      text: request.description,
    }));

    return [...questionItems, ...requestItems];
  }, [visibleQuestions, visibleRequests]);

  const itemByKey = useMemo(() => new Map(logItems.map((item) => [item.key, item])), [logItems]);
  const childrenByParent = useMemo(() => {
    const grouped = new Map<string, LogItem[]>();

    for (const item of logItems) {
      if (!item.parentKey) {
        continue;
      }

      const children = grouped.get(item.parentKey) ?? [];
      children.push(item);
      grouped.set(item.parentKey, children);
    }

    for (const children of grouped.values()) {
      children.sort(compareLogItems("CREATED_DESC", currentNow, grouped));
    }

    return grouped;
  }, [currentNow, logItems]);

  const filteredRootItems = useMemo(() => {
    const roots = logItems.filter((item) => !item.parentKey || !itemByKey.has(item.parentKey));

    return roots
      .filter((item) => itemMatchesFilters(item, childrenByParent, search, statusFilter, dueFilter, assignedToFilter, currentNow, controlLabelById))
      .sort(compareLogItems(sortBy, currentNow, childrenByParent));
  }, [assignedToFilter, childrenByParent, controlLabelById, currentNow, dueFilter, itemByKey, logItems, search, sortBy, statusFilter]);

  const selectedQuestion =
    selectedItem?.kind === "question" ? visibleQuestions.find((question) => question.id === selectedItem.id) ?? null : null;
  const selectedRequest =
    selectedItem?.kind === "request" ? visibleRequests.find((request) => request.id === selectedItem.id) ?? null : null;
  const selectedLogItem = selectedItem ? itemByKey.get(getLogKey(selectedItem.kind, selectedItem.id)) ?? null : null;
  const selectedItemIsRoot = selectedLogItem ? !selectedLogItem.parentKey : true;
  const selectedDisplayStatus = selectedLogItem ? getLogItemStatus(selectedLogItem, currentNow, childrenByParent) : null;
  const selectedStatusTone = selectedLogItem ? getLogStatusTone(selectedLogItem, currentNow, childrenByParent) : "neutral";
  const canRespondToQuestion = selectedQuestion ? matchesStakeholderUser(activeUser, selectedQuestion.assignedTo) : false;
  const canRespondToRequest = selectedRequest ? matchesStakeholderUser(activeUser, selectedRequest.assignedTo) : false;

  const selectedQuestionIdFromUrl = searchParams.get("questionId");
  const selectedRequestIdFromUrl = searchParams.get("requestId");

  useEffect(() => {
    if (selectedQuestionIdFromUrl && visibleQuestions.some((question) => question.id === selectedQuestionIdFromUrl)) {
      setSelectedItem({ kind: "question", id: selectedQuestionIdFromUrl });
      return;
    }

    if (selectedRequestIdFromUrl && visibleRequests.some((request) => request.id === selectedRequestIdFromUrl)) {
      setSelectedItem({ kind: "request", id: selectedRequestIdFromUrl });
    }
  }, [selectedQuestionIdFromUrl, selectedRequestIdFromUrl, visibleQuestions, visibleRequests]);

  useEffect(() => {
    if (selectedQuestion) {
      setResponseDraft(selectedQuestion.responseText ?? "");
      return;
    }

    if (selectedRequest) {
      setResponseDraft(selectedRequest.responseNotes ?? "");
      return;
    }

    setResponseDraft("");
  }, [selectedQuestion, selectedRequest]);

  const defaultQuestionForm = useMemo(
    () => ({
      assignedTo: assigneeOptions[0] ?? "",
      controlId: createControlOptions[0]?.id ?? "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      parentQuestionId: undefined as string | undefined,
      parentRequestId: undefined as string | undefined,
      phaseTag: currentPhase,
      questionText: "",
    }),
    [assigneeOptions, createControlOptions, currentNow, currentPhase],
  );
  const [questionForm, setQuestionForm] = useState(defaultQuestionForm);

  const defaultRequestForm = useMemo(
    () => ({
      assignedTo: assigneeOptions[0] ?? "",
      controlId: createControlOptions[0]?.id ?? "",
      description: "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      parentQuestionId: undefined as string | undefined,
      parentRequestId: undefined as string | undefined,
      phaseTag: currentPhase,
    }),
    [assigneeOptions, createControlOptions, currentNow, currentPhase],
  );
  const [requestForm, setRequestForm] = useState(defaultRequestForm);

  useEffect(() => setQuestionForm(defaultQuestionForm), [defaultQuestionForm]);
  useEffect(() => setRequestForm(defaultRequestForm), [defaultRequestForm]);

  function openItem(item: LogItem) {
    setSelectedItem({ kind: item.kind, id: item.id });
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tab");

    if (item.kind === "question") {
      params.set("questionId", item.id);
      params.delete("requestId");
    } else {
      params.set("requestId", item.id);
      params.delete("questionId");
    }

    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeItem() {
    setSelectedItem(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete("questionId");
    params.delete("requestId");
    params.delete("tab");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function toggleRow(key: string) {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function openQuestionModal(parent?: LogItem | null) {
    setQuestionForm({
      ...defaultQuestionForm,
      assignedTo: parent?.assignedTo ?? defaultQuestionForm.assignedTo,
      controlId: parent?.controlId ?? defaultQuestionForm.controlId,
      parentQuestionId: parent?.kind === "question" ? parent.id : undefined,
      parentRequestId: parent?.kind === "request" ? parent.id : undefined,
      phaseTag: currentPhase,
    });
    setQuestionFormOpen(true);
  }

  function openRequestModal(parent?: LogItem | null) {
    setRequestForm({
      ...defaultRequestForm,
      assignedTo: parent?.assignedTo ?? defaultRequestForm.assignedTo,
      controlId: parent?.controlId ?? defaultRequestForm.controlId,
      parentQuestionId: parent?.kind === "question" ? parent.id : undefined,
      parentRequestId: parent?.kind === "request" ? parent.id : undefined,
      phaseTag: currentPhase,
    });
    setRequestFormOpen(true);
  }

  function closeQuestionModal() {
    setQuestionFormOpen(false);
    setQuestionForm(defaultQuestionForm);
  }

  function closeRequestModal() {
    setRequestFormOpen(false);
    setRequestForm(defaultRequestForm);
  }

  function handleCreateQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "live" && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/questions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              askedByUserId: activeUser.id,
              assignedTo: questionForm.assignedTo,
              controlId: questionForm.controlId,
              dueDate: questionForm.dueDate,
              parentQuestionId: questionForm.parentQuestionId,
              parentRequestId: questionForm.parentRequestId,
              phaseTag: questionForm.phaseTag,
              questionText: questionForm.questionText.trim(),
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to create question.");
          }

          closeQuestionModal();
          router.refresh();
        } catch (error) {
          showNotification({
            title: "Create failed",
            message: error instanceof Error ? error.message : "Unable to create question.",
            tone: "error",
          });
        }
      });
      return;
    }

    const nextId = `Q-${String(questionRows.length + 1).padStart(2, "0")}`;
    setQuestionRows((current) => [
      ...current,
      {
        id: nextId,
        displayId: nextId,
        askedBy: activeUser.name,
        assignedTo: questionForm.assignedTo,
        controlId: questionForm.controlId,
        dateSent: new Date(currentNow).toISOString(),
        dueDate: new Date(questionForm.dueDate).toISOString(),
        parentQuestionId: questionForm.parentQuestionId,
        parentRequestId: questionForm.parentRequestId,
        phaseTag: questionForm.phaseTag,
        questionText: questionForm.questionText.trim(),
        status: "OPEN",
      },
    ]);
    closeQuestionModal();
  }

  function handleCreateRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (mode === "live" && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/requests`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              assignedTo: requestForm.assignedTo,
              controlId: requestForm.controlId,
              description: requestForm.description.trim(),
              dueDate: requestForm.dueDate,
              parentQuestionId: requestForm.parentQuestionId,
              parentRequestId: requestForm.parentRequestId,
              phaseTag: requestForm.phaseTag,
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to create request.");
          }

          closeRequestModal();
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
    setRequestRows((current) => [
      ...current,
      {
        id: nextId,
        displayId: nextId,
        assignedTo: requestForm.assignedTo,
        controlId: requestForm.controlId,
        dateRequested: new Date(currentNow).toISOString(),
        description: requestForm.description.trim(),
        dueDate: new Date(requestForm.dueDate).toISOString(),
        parentQuestionId: requestForm.parentQuestionId,
        parentRequestId: requestForm.parentRequestId,
        phaseTag: requestForm.phaseTag,
        status: "OPEN",
      },
    ]);
    closeRequestModal();
  }

  function handleSubmitResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (responseDraft.trim().length === 0) {
      return;
    }

    if (selectedQuestion) {
      if (mode === "live" && auditId) {
        startTransition(async () => {
          try {
            const response = await fetch(`/api/audits/${auditId}/questions/${selectedQuestion.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ responseText: responseDraft.trim() }),
            });
            const result = (await response.json()) as { error?: string };

            if (!response.ok) {
              throw new Error(result.error ?? "Unable to save response.");
            }

            router.refresh();
          } catch (error) {
            showNotification({
              title: "Response failed",
              message: error instanceof Error ? error.message : "Unable to save response.",
              tone: "error",
            });
          }
        });
        return;
      }

      setQuestionRows((current) =>
        current.map((question) =>
          question.id === selectedQuestion.id
            ? { ...question, responseDate: new Date(currentNow).toISOString(), responseText: responseDraft.trim(), status: "RESPONDED" }
            : question,
        ),
      );
      return;
    }

    if (selectedRequest) {
      if (mode === "live" && auditId) {
        startTransition(async () => {
          try {
            const response = await fetch(`/api/audits/${auditId}/requests/${selectedRequest.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ responseNotes: responseDraft.trim(), status: "COMPLETED" }),
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
            ? { ...request, completedAt: new Date(currentNow).toISOString(), responseNotes: responseDraft.trim(), status: "COMPLETED" }
            : request,
        ),
      );
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-[24px] border border-black/5 bg-white">
      <div className="flex flex-col gap-3 border-b border-black/5 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-3 py-2">
          <Search size={16} className="text-[var(--muted)]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            placeholder="Search questions, requests, assignees, or controls"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowFilters((current) => !current)}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
          >
            <Filter size={15} />
            Filters
          </button>
          <button
            type="button"
            onClick={() => openQuestionModal()}
            className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
          >
            <Plus size={15} />
            New Question
          </button>
          <button
            type="button"
            onClick={() => openRequestModal()}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Plus size={15} />
            New Request
          </button>
        </div>
      </div>

      {showFilters ? (
        <div className="grid gap-3 border-b border-black/5 bg-[var(--surface-tint)] p-4 md:grid-cols-4">
          <Field label="Status">
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as LogStatusFilter)} className={fieldControlClass}>
              {statusFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {formatStatusFilterLabel(option)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <select value={dueFilter} onChange={(event) => setDueFilter(event.target.value as DueFilter)} className={fieldControlClass}>
              {dueFilterOptions.map((option) => (
                <option key={option} value={option}>
                  {formatDueFilterLabel(option)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Assigned to">
            <select value={assignedToFilter} onChange={(event) => setAssignedToFilter(event.target.value)} className={fieldControlClass}>
              <option value="ALL">All assignees</option>
              {assigneeOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Sort">
            <select value={sortBy} onChange={(event) => setSortBy(event.target.value as LogSort)} className={fieldControlClass}>
              {sortOptions.map((option) => (
                <option key={option} value={option}>
                  {formatSortLabel(option)}
                </option>
              ))}
            </select>
          </Field>
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-full border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--surface-strong)]">
            <tr className="text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <th className="w-12 border-b border-black/5 px-4 py-3" />
              <th className="border-b border-black/5 px-4 py-3">Item</th>
              <th className="border-b border-black/5 px-4 py-3">Tagged person</th>
              <th className="border-b border-black/5 px-4 py-3">Sent</th>
              <th className="border-b border-black/5 px-4 py-3">Due</th>
              <th className="border-b border-black/5 px-4 py-3">Delay impact</th>
              <th className="border-b border-black/5 px-4 py-3">Status</th>
              <th className="border-b border-black/5 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRootItems.length > 0 ? (
              filteredRootItems.flatMap((item) => renderLogRows(item, 0))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-sm text-[var(--muted)]">
                  No questions or requests match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <FormModal
        open={questionFormOpen}
        title={questionForm.parentQuestionId || questionForm.parentRequestId ? "Follow-up Question" : "New Question"}
        subtitle="Assign a question to a stakeholder and link it to the related control."
        onClose={closeQuestionModal}
      >
        <form className="grid gap-4" onSubmit={handleCreateQuestion}>
          <Field label="Question">
            <textarea
              required
              rows={4}
              value={questionForm.questionText}
              onChange={(event) => setQuestionForm((current) => ({ ...current, questionText: event.target.value }))}
              className={`${fieldControlClass} min-h-28`}
              placeholder="Type the question"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tag person">
              <select value={questionForm.assignedTo} onChange={(event) => setQuestionForm((current) => ({ ...current, assignedTo: event.target.value }))} className={fieldControlClass}>
                {assigneeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Response needed by">
              <input
                required
                type="datetime-local"
                value={questionForm.dueDate}
                onChange={(event) => setQuestionForm((current) => ({ ...current, dueDate: event.target.value }))}
                className={fieldControlClass}
              />
            </Field>
          </div>
          <Field label="Related control">
            <select value={questionForm.controlId} onChange={(event) => setQuestionForm((current) => ({ ...current, controlId: event.target.value }))} className={fieldControlClass}>
              {createControlOptions.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlLabel(control)} - {control.name}
                </option>
              ))}
            </select>
          </Field>
          <FormActions isPending={isPending} onCancel={closeQuestionModal} submitLabel="Save Question" />
        </form>
      </FormModal>

      <FormModal
        open={requestFormOpen}
        title={requestForm.parentQuestionId || requestForm.parentRequestId ? "Follow-up Request" : "New Request"}
        subtitle="Assign an evidence request to a stakeholder and link it to the related control."
        onClose={closeRequestModal}
      >
        <form className="grid gap-4" onSubmit={handleCreateRequest}>
          <Field label="Request">
            <textarea
              required
              rows={4}
              value={requestForm.description}
              onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
              className={`${fieldControlClass} min-h-28`}
              placeholder="Describe the evidence or document needed"
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tag person">
              <select value={requestForm.assignedTo} onChange={(event) => setRequestForm((current) => ({ ...current, assignedTo: event.target.value }))} className={fieldControlClass}>
                {assigneeOptions.map((option) => (
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
                value={requestForm.dueDate}
                onChange={(event) => setRequestForm((current) => ({ ...current, dueDate: event.target.value }))}
                className={fieldControlClass}
              />
            </Field>
          </div>
          <Field label="Related control">
            <select value={requestForm.controlId} onChange={(event) => setRequestForm((current) => ({ ...current, controlId: event.target.value }))} className={fieldControlClass}>
              {createControlOptions.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlLabel(control)} - {control.name}
                </option>
              ))}
            </select>
          </Field>
          <FormActions isPending={isPending} onCancel={closeRequestModal} submitLabel="Save Request" />
        </form>
      </FormModal>

      {selectedQuestion ? (
        <DetailPanel
          title={`${selectedQuestion.displayId ?? selectedQuestion.id} - ${selectedQuestion.assignedTo}`}
          subtitle={selectedQuestion.questionText}
          open={Boolean(selectedQuestion)}
          onClose={closeItem}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Asked by" value={selectedQuestion.askedBy} />
              <DetailCard label="Tagged person" value={selectedQuestion.assignedTo} />
              <DetailCard label="Linked control" value={getControlDisplayLabel(selectedQuestion.controlId, controlLabelById)} />
              <DetailCard label="Phase" value={selectedQuestion.phaseTag ?? "Planning"} />
              <DetailCard label="Date sent" value={formatDateTime(selectedQuestion.dateSent)} />
              <DetailCard label="Due date" value={formatDateTime(selectedQuestion.dueDate)} />
              <DetailCard label="Date answered" value={selectedQuestion.responseDate ? formatDateTime(selectedQuestion.responseDate) : "Pending"} />
            </section>

            {selectedItemIsRoot ? (
              <section className="grid gap-4 md:grid-cols-3">
                <DetailCard
                  label="Current delay"
                  value={formatHours(getQuestionCurrentDelayHours(selectedQuestion, currentNow))}
                  helpText="Hours currently past the due date for an open or overdue parent item. This drops to zero once the parent item is resolved."
                />
                <DetailCard
                  label="Realized delay"
                  value={formatHours(getQuestionRealizedDelayHours(selectedQuestion, visibleQuestions, visibleRequests))}
                  helpText="Hours the parent item ended up late after its response and linked follow-up chain were resolved, measured from the original due date to the latest response or completion."
                />
                <DetailCard
                  label="Chain delay impact"
                  value={formatHours(getQuestionChainDelayHours(selectedQuestion, visibleQuestions, visibleRequests, currentNow))}
                  helpText="Total delay impact across this parent item and any linked follow-up questions or requests, measured from the original due date through the latest resolved follow-up or now if the chain is still open."
                  helpAlign="end"
                />
              </section>
            ) : null}

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Question and response</p>
              <StatusBadge
                status={selectedDisplayStatus ?? getQuestionDisplayStatus(selectedQuestion, currentNow)}
                tone={selectedStatusTone}
                className="mt-4"
              />
              <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                {selectedQuestion.responseText ?? "No response captured yet. This item is still blocking control completion."}
              </p>
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Follow-ups</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Follow-up items are nested under this row in the table.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openQuestionModal(selectedLogItem)} className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]">
                    Follow-up question
                  </button>
                  <button type="button" onClick={() => openRequestModal(selectedLogItem)} className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white">
                    Follow-up request
                  </button>
                </div>
              </div>
            </section>

            {canRespondToQuestion ? <ResponseForm label="Respond" placeholder="Type the response for this question" /> : null}

            <RelatedDocuments
              documents={getQuestionRelatedDocuments(selectedQuestion.id, visibleDocuments)}
              emptyText="No linked evidence has been attached yet."
            />
          </div>
        </DetailPanel>
      ) : null}

      {selectedRequest ? (
        <DetailPanel
          title={`${selectedRequest.displayId ?? selectedRequest.id} - ${selectedRequest.assignedTo}`}
          subtitle={selectedRequest.description}
          open={Boolean(selectedRequest)}
          onClose={closeItem}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Tagged person" value={selectedRequest.assignedTo} />
              <DetailCard label="Linked control" value={getControlDisplayLabel(selectedRequest.controlId, controlLabelById)} />
              <DetailCard label="Phase" value={selectedRequest.phaseTag ?? "Planning"} />
              <DetailCard label="Date requested" value={formatDateTime(selectedRequest.dateRequested)} />
              <DetailCard label="Due date" value={formatDateTime(selectedRequest.dueDate)} />
              <DetailCard label="Completed at" value={selectedRequest.completedAt ?? selectedRequest.receivedDate ? formatDateTime(selectedRequest.completedAt ?? selectedRequest.receivedDate ?? "") : "Pending"} />
            </section>

            {selectedItemIsRoot ? (
              <section className="grid gap-4 md:grid-cols-3">
                <DetailCard
                  label="Current delay"
                  value={formatHours(getRequestCurrentDelayHours(selectedRequest, currentNow))}
                  helpText="Hours currently past the due date for an open or in-progress parent request. This drops to zero once the parent request is completed."
                />
                <DetailCard
                  label="Realized delay"
                  value={formatHours(getRequestRealizedDelayHours(selectedRequest, visibleQuestions, visibleRequests))}
                  helpText="Hours the parent request ended up late after its fulfillment and linked follow-up chain were resolved, measured from the original due date to the latest response or completion."
                />
                <DetailCard
                  label="Chain delay impact"
                  value={formatHours(getRequestChainDelayHours(selectedRequest, visibleQuestions, visibleRequests, currentNow))}
                  helpText="Total delay impact across this parent request and any linked follow-up questions or requests, measured from the original due date through the latest resolved follow-up or now if the chain is still open."
                  helpAlign="end"
                />
              </section>
            ) : null}

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Fulfillment status</p>
              <StatusBadge
                status={selectedDisplayStatus ?? getRequestDisplayStatus(selectedRequest, currentNow)}
                tone={selectedStatusTone}
                className="mt-4"
              />
              <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                {selectedRequest.responseNotes ?? "Awaiting evidence package. Follow-up remains open in the operating queue."}
              </p>
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Follow-ups</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">Follow-up items are nested under this row in the table.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => openQuestionModal(selectedLogItem)} className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]">
                    Follow-up question
                  </button>
                  <button type="button" onClick={() => openRequestModal(selectedLogItem)} className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white">
                    Follow-up request
                  </button>
                </div>
              </div>
            </section>

            {canRespondToRequest ? <ResponseForm label="Post fulfillment notes" placeholder="Type the request fulfillment notes" /> : null}

            <RelatedDocuments
              documents={getRequestRelatedDocuments(selectedRequest.id, visibleDocuments)}
              emptyText="No direct file placeholder linked yet."
            />
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );

  function renderLogRows(item: LogItem, level: number): React.ReactElement[] {
    const children = childrenByParent.get(item.key) ?? [];
    const isExpanded = expandedRows.has(item.key);
    const status = getLogItemStatus(item, currentNow, childrenByParent);
    const tone = getLogStatusTone(item, currentNow, childrenByParent);
    const createdLabel = item.kind === "question" ? "Sent" : "Requested";
    const delayImpactLabel =
      level === 0
        ? getLogDelayImpactLabel(item, children.length > 0, visibleQuestions, visibleRequests, childrenByParent, currentNow)
        : "-";
    const rows = [
      <tr
        key={item.key}
        className="cursor-pointer border-b border-black/5 transition-colors hover:bg-[var(--surface-soft)]"
        onClick={() => openItem(item)}
      >
        <td className="px-4 py-4 align-top">
          {children.length > 0 ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                toggleRow(item.key);
              }}
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
              aria-label={isExpanded ? "Collapse follow-ups" : "Expand follow-ups"}
            >
              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
          ) : (
            <span className="block h-8 w-8" />
          )}
        </td>
        <td className="px-4 py-4">
          <div style={{ paddingLeft: `${Math.min(level, 3) * 1.5}rem` }}>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={item.kind} tone={item.kind === "question" ? "neutral" : "warning"} />
              <p className="text-sm font-semibold text-[var(--foreground)]">{item.label}</p>
            </div>
            <p className="mt-1 max-w-xl text-sm text-[var(--foreground)]">{item.text}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {createdLabel} for Control {getControlDisplayLabel(item.controlId, controlLabelById)}
            </p>
          </div>
        </td>
        <td className="px-4 py-4 text-sm text-[var(--muted)]">{item.assignedTo}</td>
        <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(item.createdAt)}</td>
        <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(item.dueDate)}</td>
        <td className="px-4 py-4 text-sm text-[var(--muted)]">{delayImpactLabel}</td>
        <td className="px-4 py-4">
          <StatusBadge status={status} tone={tone} />
        </td>
        <td className="px-4 py-4">
          <div className="flex items-center gap-2">
            <ReminderButton visible={shouldShowReminder(item.item as Question | Request, currentNow)} tooltip="Due inside 48 hours" />
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                openItem(item);
              }}
              className="inline-flex items-center gap-2 rounded-md border border-black/10 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
            >
              Inspect
              <ArrowRight size={14} />
            </button>
          </div>
        </td>
      </tr>,
    ];

    if (isExpanded) {
      for (const child of children) {
        rows.push(...renderLogRows(child, level + 1));
      }
    }

    return rows;
  }

  function ResponseForm({ label, placeholder }: { label: string; placeholder: string }) {
    return (
      <section className="rounded-[24px] border border-black/5 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">{label}</p>
        <form className="mt-4 grid gap-4" onSubmit={handleSubmitResponse}>
          <textarea
            required
            rows={5}
            value={responseDraft}
            onChange={(event) => setResponseDraft(event.target.value)}
            className={fieldControlClass}
            placeholder={placeholder}
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isPending || responseDraft.trim().length === 0}
              className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </form>
      </section>
    );
  }
}

function getLogKey(kind: LogKind, id: string) {
  return `${kind}:${id}`;
}

function getLogItemStatus(
  item: LogItem,
  now: string,
  childrenByParent: Map<string, LogItem[]>,
): LogDisplayStatus {
  if (hasPendingFollowUps(item, childrenByParent, now, new Set<string>())) {
    return "FOLLOW_UP_PENDING";
  }

  return item.kind === "question"
    ? getQuestionDisplayStatus(item.item as Question, now)
    : getRequestDisplayStatus(item.item as Request, now);
}

function getLogStatusTone(
  item: LogItem,
  now: string,
  childrenByParent: Map<string, LogItem[]>,
): "neutral" | "warning" | "risk" | "success" {
  const status = getLogItemStatus(item, now, childrenByParent);

  if (status === "RESPONDED" || status === "COMPLETED") {
    return "success";
  }

  if (status === "OVERDUE") {
    return "risk";
  }

  return "warning";
}

function hasPendingFollowUps(
  item: LogItem,
  childrenByParent: Map<string, LogItem[]>,
  now: string,
  visitedKeys: Set<string>,
): boolean {
  if (visitedKeys.has(item.key)) {
    return false;
  }

  visitedKeys.add(item.key);

  return (childrenByParent.get(item.key) ?? []).some((child) => {
    const childIsResolved =
      child.kind === "question"
        ? getQuestionDisplayStatus(child.item as Question, now) === "RESPONDED"
        : getRequestDisplayStatus(child.item as Request, now) === "COMPLETED";

    return !childIsResolved || hasPendingFollowUps(child, childrenByParent, now, visitedKeys);
  });
}

function getLogDelayImpactLabel(
  item: LogItem,
  hasFollowUps: boolean,
  questions: Question[],
  requests: Request[],
  childrenByParent: Map<string, LogItem[]>,
  now: string,
) {
  const currentDelayHours =
    item.kind === "question"
      ? getQuestionCurrentDelayHours(item.item as Question, now)
      : getRequestCurrentDelayHours(item.item as Request, now);
  const realizedDelayHours =
    item.kind === "question"
      ? getQuestionRealizedDelayHours(item.item as Question, questions, requests)
      : getRequestRealizedDelayHours(item.item as Request, questions, requests);
  const chainDelayHours =
    item.kind === "question"
      ? getQuestionChainDelayHours(item.item as Question, questions, requests, now)
      : getRequestChainDelayHours(item.item as Request, questions, requests, now);
  const status = getLogItemStatus(item, now, childrenByParent);

  if (hasFollowUps && chainDelayHours > 0) {
    return `${formatHours(chainDelayHours)} chain delay`;
  }

  if (currentDelayHours > 0) {
    return `${formatHours(currentDelayHours)} overdue`;
  }

  if (realizedDelayHours > 0) {
    return `${formatHours(realizedDelayHours)} realized`;
  }

  if (status === "RESPONDED" || status === "COMPLETED") {
    return "On time";
  }

  return "Current";
}

function itemMatchesFilters(
  item: LogItem,
  childrenByParent: Map<string, LogItem[]>,
  search: string,
  statusFilter: LogStatusFilter,
  dueFilter: DueFilter,
  assignedToFilter: string,
  now: string,
  controlLabelById: Map<string, string>,
): boolean {
  if (matchesSingleItem(item, childrenByParent, search, statusFilter, dueFilter, assignedToFilter, now, controlLabelById)) {
    return true;
  }

  return (childrenByParent.get(item.key) ?? []).some((child) =>
    itemMatchesFilters(child, childrenByParent, search, statusFilter, dueFilter, assignedToFilter, now, controlLabelById),
  );
}

function matchesSingleItem(
  item: LogItem,
  childrenByParent: Map<string, LogItem[]>,
  search: string,
  statusFilter: LogStatusFilter,
  dueFilter: DueFilter,
  assignedToFilter: string,
  now: string,
  controlLabelById: Map<string, string>,
) {
  const normalizedSearch = search.trim().toLowerCase();
  const status = getLogItemStatus(item, now, childrenByParent);
  const hoursToDue = hoursUntil(item.dueDate, now);
  const controlLabel = getControlDisplayLabel(item.controlId, controlLabelById);
  const matchesSearch =
    normalizedSearch.length === 0 ||
    item.label.toLowerCase().includes(normalizedSearch) ||
    item.text.toLowerCase().includes(normalizedSearch) ||
    item.assignedTo.toLowerCase().includes(normalizedSearch) ||
    item.kind.toLowerCase().includes(normalizedSearch) ||
    controlLabel.toLowerCase().includes(normalizedSearch);
  const matchesStatus = statusFilter === "ALL" || status === statusFilter;
  const matchesDue =
    dueFilter === "ALL" ||
    (dueFilter === "OVERDUE" && hoursToDue < 0) ||
    (dueFilter === "NEXT_48_HOURS" && hoursToDue >= 0 && hoursToDue <= 48) ||
    (dueFilter === "NEXT_7_DAYS" && hoursToDue >= 0 && hoursToDue <= 168) ||
    (dueFilter === "FUTURE" && hoursToDue > 168);
  const matchesAssignee = assignedToFilter === "ALL" || item.assignedTo === assignedToFilter;

  return matchesSearch && matchesStatus && matchesDue && matchesAssignee;
}

function compareLogItems(sortBy: LogSort, now: string, childrenByParent: Map<string, LogItem[]>) {
  return (left: LogItem, right: LogItem) => {
    switch (sortBy) {
      case "DUE_ASC":
        return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
      case "DUE_DESC":
        return new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime();
      case "CREATED_DESC":
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      case "ASSIGNED_TO_ASC":
        return left.assignedTo.localeCompare(right.assignedTo);
      case "STATUS_ASC":
        return getLogItemStatus(left, now, childrenByParent).localeCompare(getLogItemStatus(right, now, childrenByParent));
    }
  };
}

function RelatedDocuments({ documents, emptyText }: { documents: AuditDocument[]; emptyText: string }) {
  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Related documents</p>
      <div className="mt-4 grid gap-3">
        {documents.length > 0 ? (
          documents.map((document) => (
            <div key={document.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
              <p className="mt-1 text-sm text-[var(--muted)]">{document.status.replaceAll("_", " ")}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-[var(--muted)]">{emptyText}</p>
        )}
      </div>
    </section>
  );
}

function FormActions({ isPending, onCancel, submitLabel }: { isPending: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitLabel}
      </button>
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
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(1,30,65,0.32)] p-4 backdrop-blur-sm">
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

function DetailCard({
  label,
  value,
  helpText,
  helpAlign = "center",
}: {
  label: string;
  value: string;
  helpText?: string;
  helpAlign?: "center" | "end";
}) {
  return (
    <div className="min-w-0 rounded-[22px] border border-black/5 bg-white p-4">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
        {helpText ? <HoverInfoCard text={helpText} align={helpAlign} /> : null}
      </div>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function HoverInfoCard({ text, align = "center" }: { text: string; align?: "center" | "end" }) {
  return (
    <span className="group relative inline-flex">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-black/10 bg-white text-[var(--muted)] transition-colors hover:text-[var(--brand-indigo-core)]"
        aria-label="More information"
      >
        <CircleHelp size={12} />
      </span>
      <span
        className={`pointer-events-none absolute top-[calc(100%+0.65rem)] z-20 w-64 max-w-[calc(100vw-6rem)] rounded-[18px] border border-black/5 bg-white px-4 py-3 text-left text-[11px] normal-case tracking-normal text-[var(--foreground)] opacity-0 shadow-[0_18px_40px_rgba(1,30,65,0.14)] transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100 md:w-72 ${
          align === "end" ? "right-0 translate-x-0" : "left-1/2 -translate-x-1/2"
        }`}
      >
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

function getControlLabel(control: Control) {
  return control.referenceId ?? control.id;
}

function getControlDisplayLabel(controlId: string | undefined, controlLabelById: Map<string, string>) {
  if (!controlId) {
    return "Not linked";
  }

  return controlLabelById.get(controlId) ?? controlId;
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

function formatStatusFilterLabel(value: LogStatusFilter) {
  return value === "ALL" ? "All statuses" : value.replaceAll("_", " ");
}

function formatSortLabel(value: LogSort) {
  switch (value) {
    case "DUE_ASC":
      return "Sort: due soonest";
    case "DUE_DESC":
      return "Sort: due latest";
    case "CREATED_DESC":
      return "Sort: newest";
    case "ASSIGNED_TO_ASC":
      return "Sort: contact";
    case "STATUS_ASC":
      return "Sort: status";
  }
}
