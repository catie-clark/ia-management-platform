"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { ArrowDownUp, ArrowRight, CircleHelp, Plus, Search, Upload, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { useNotification } from "@/components/ui/notification-provider";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  getQuestionAgeHours,
  getQuestionChainDelayHours,
  getQuestionCurrentDelayHours,
  getQuestionDisplayStatus,
  getQuestionFollowUps,
  getQuestionRealizedDelayHours,
  getQuestionRelatedDocuments,
  shouldShowReminder,
} from "@/lib/audit-logic";
import {
  filterDocumentsForControls,
  filterQuestionsForControls,
  filterRequestsForControls,
  matchesStakeholderUser,
} from "@/lib/control-visibility";
import { mapDocument, type AuditDocumentRow } from "@/lib/live-audit";
import { getQuestionLogNow } from "@/lib/question-log-data";
import type { DashboardMode } from "@/lib/live-audit";
import { formatDateTime, formatHours, formatShortDate } from "@/lib/utils";
import type { AuditDocument, AuditPhase, Control, Question, Request, User } from "@/types/audit";

type DueFilter = "ALL" | "OVERDUE" | "NEXT_48_HOURS" | "NEXT_7_DAYS" | "FUTURE";
type QuestionSort = "DUE_ASC" | "DUE_DESC" | "AGE_DESC" | "ASSIGNED_TO_ASC" | "STATUS_ASC";

const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const questionSortOptions: QuestionSort[] = ["DUE_ASC", "DUE_DESC", "AGE_DESC", "ASSIGNED_TO_ASC", "STATUS_ASC"];
const phaseTagOptions: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];
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

type QuestionLogViewProps = {
  auditId: string | null;
  auditLabel: string;
  controls: Control[];
  currentPhase: AuditPhase;
  documents: AuditDocument[];
  embedded?: boolean;
  mode: DashboardMode;
  questions: Question[];
  requests: Request[];
  users: User[];
};

export function QuestionLogView({
  auditId,
  auditLabel,
  controls,
  currentPhase,
  documents,
  embedded = false,
  mode,
  questions,
  requests,
  users,
}: QuestionLogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [questionRows, setQuestionRows] = useState<Question[]>(questions);
  const [requestRows, setRequestRows] = useState<Request[]>(requests);
  const [documentRows, setDocumentRows] = useState<AuditDocument[]>(documents);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Question["status"] | "ALL">("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [sortBy, setSortBy] = useState<QuestionSort>("DUE_ASC");
  const [isCreating, setIsCreating] = useState(false);
  const [followUpTarget, setFollowUpTarget] = useState<{ parentQuestionId?: string; parentRequestId?: string } | null>(null);
  const [responseDraft, setResponseDraft] = useState("");
  const questionAttachmentInputRef = useRef<HTMLInputElement | null>(null);
  const currentNow = useMemo(() => getQuestionLogNow(mode), [mode]);
  const [assignedToFilter, setAssignedToFilter] = useState<string>("ALL");
  const [askedByFilter, setAskedByFilter] = useState<string>("ALL");
  const openCreateMode = searchParams.get("openCreate");
  const followUpRequestId = searchParams.get("followUpRequestId");

  useEffect(() => {
    setQuestionRows(questions);
  }, [questions]);

  useEffect(() => {
    setRequestRows(requests);
  }, [requests]);

  useEffect(() => {
    setDocumentRows(documents);
  }, [documents]);

  const visibleControls = useMemo(() => controls, [controls]);
  const visibleRequests = useMemo(
    () => filterRequestsForControls(requestRows, visibleControls, activeUser, "ALL"),
    [activeUser, requestRows, visibleControls],
  );
  const visibleQuestions = useMemo(
    () => filterQuestionsForControls(questionRows, visibleControls, activeUser, "ALL"),
    [activeUser, questionRows, visibleControls],
  );
  const visibleDocuments = useMemo(
    () => filterDocumentsForControls(documentRows, visibleControls, activeUser, "ALL"),
    [activeUser, documentRows, visibleControls],
  );
  const controlLabelById = useMemo(() => new Map(controls.map((control) => [control.id, getControlLabel(control)])), [controls]);
  const createControlOptions = useMemo(() => controls, [controls]);
  const stakeholderOptions = useMemo(
    () => Array.from(new Set([...stakeholderRoleOptions, ...visibleQuestions.map((question) => question.assignedTo)])),
    [visibleQuestions],
  );
  const requestOwners = useMemo(
    () => Array.from(new Set([...stakeholderRoleOptions, ...visibleRequests.map((request) => request.assignedTo)])),
    [visibleRequests],
  );
  const defaultQuestionForm = useMemo(
    () => ({
      controlId: createControlOptions[0]?.id ?? visibleControls[0]?.id ?? controls[0]?.id ?? "",
      askedByUserId: activeUser.id,
      assignedTo: stakeholderOptions[0] ?? "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      phaseTag: currentPhase,
      parentQuestionId: undefined as string | undefined,
      parentRequestId: undefined as string | undefined,
      questionText: "",
    }),
    [activeUser.id, controls, createControlOptions, currentNow, currentPhase, stakeholderOptions, visibleControls],
  );
  const [form, setForm] = useState(defaultQuestionForm);
  const defaultRequestForm = useMemo(
    () => ({
      controlId: createControlOptions[0]?.id ?? visibleControls[0]?.id ?? controls[0]?.id ?? "",
      assignedTo: requestOwners[0] ?? "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      phaseTag: currentPhase,
      parentQuestionId: undefined as string | undefined,
      parentRequestId: undefined as string | undefined,
      description: "",
    }),
    [controls, createControlOptions, currentNow, currentPhase, requestOwners, visibleControls],
  );
  const [isCreatingRequest, setIsCreatingRequest] = useState(false);
  const [requestFollowUpTarget, setRequestFollowUpTarget] = useState<{ parentQuestionId?: string; parentRequestId?: string } | null>(null);
  const [requestForm, setRequestForm] = useState(defaultRequestForm);
  const questionAssigneeOptions = useMemo(
    () => Array.from(new Set([...stakeholderOptions, form.assignedTo].filter(Boolean))),
    [form.assignedTo, stakeholderOptions],
  );
  const requestAssigneeOptions = useMemo(
    () => Array.from(new Set([...requestOwners, requestForm.assignedTo].filter(Boolean))),
    [requestForm.assignedTo, requestOwners],
  );
  const questionControlOptions = useMemo(() => {
    const selectedControl = controls.find((control) => control.id === form.controlId);
    return selectedControl && !createControlOptions.some((control) => control.id === selectedControl.id)
      ? [...createControlOptions, selectedControl]
      : createControlOptions;
  }, [controls, createControlOptions, form.controlId]);
  const requestControlOptions = useMemo(() => {
    const selectedControl = controls.find((control) => control.id === requestForm.controlId);
    return selectedControl && !createControlOptions.some((control) => control.id === selectedControl.id)
      ? [...createControlOptions, selectedControl]
      : createControlOptions;
  }, [controls, createControlOptions, requestForm.controlId]);

  useEffect(() => {
    setForm(defaultQuestionForm);
  }, [defaultQuestionForm]);

  useEffect(() => {
    setRequestForm(defaultRequestForm);
  }, [defaultRequestForm]);

  useEffect(() => {
    if (openCreateMode !== "question" || !followUpRequestId) {
      return;
    }

    const followUpRequest = requests.find((item) => item.id === followUpRequestId);

    if (!followUpRequest) {
      return;
    }

    setForm({
      ...defaultQuestionForm,
      assignedTo: followUpRequest.assignedTo,
      controlId:
        (followUpRequest.controlId && createControlOptions.some((control) => control.id === followUpRequest.controlId))
          ? followUpRequest.controlId
          : defaultQuestionForm.controlId,
      parentQuestionId: undefined,
      parentRequestId: followUpRequest.id,
      phaseTag: followUpRequest.phaseTag ?? defaultQuestionForm.phaseTag,
    });
    setFollowUpTarget({ parentRequestId: followUpRequest.id });
    setIsCreating(true);
  }, [createControlOptions, defaultQuestionForm, followUpRequestId, openCreateMode, requests]);

  const filteredQuestions = useMemo(() => {
    return visibleQuestions
      .filter((question) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          question.id.toLowerCase().includes(q) ||
          getQuestionLabel(question).toLowerCase().includes(q) ||
          question.questionText.toLowerCase().includes(q) ||
          question.assignedTo.toLowerCase().includes(q);
        const hoursToDue = hoursUntil(question.dueDate, currentNow);
        const matchesDueFilter =
          dueFilter === "ALL" ||
          (dueFilter === "OVERDUE" && hoursToDue < 0) ||
          (dueFilter === "NEXT_48_HOURS" && hoursToDue >= 0 && hoursToDue <= 48) ||
          (dueFilter === "NEXT_7_DAYS" && hoursToDue >= 0 && hoursToDue <= 168) ||
          (dueFilter === "FUTURE" && hoursToDue > 168);

        return (
          matchesSearch &&
          matchesDueFilter &&
          (statusFilter === "ALL" || getQuestionDisplayStatus(question, currentNow) === statusFilter) &&
          (assignedToFilter === "ALL" || question.assignedTo === assignedToFilter) &&
          (askedByFilter === "ALL" || question.askedBy === askedByFilter)
        );
      })
      .sort((left, right) => {
        switch (sortBy) {
          case "DUE_ASC":
            return new Date(left.dueDate).getTime() - new Date(right.dueDate).getTime();
          case "DUE_DESC":
            return new Date(right.dueDate).getTime() - new Date(left.dueDate).getTime();
          case "AGE_DESC":
            return getQuestionAgeHours(right, currentNow) - getQuestionAgeHours(left, currentNow);
          case "ASSIGNED_TO_ASC":
            return left.assignedTo.localeCompare(right.assignedTo);
          case "STATUS_ASC":
            return left.status.localeCompare(right.status);
          default:
            return 0;
        }
      });
  }, [assignedToFilter, askedByFilter, currentNow, dueFilter, search, sortBy, statusFilter, visibleQuestions]);

  const selectedQuestion = visibleQuestions.find((question) => question.id === selectedId) ?? null;
  const selectedQuestionIdFromUrl = searchParams.get("questionId");
  const canCreateInLiveMode = mode === "live" && Boolean(auditId);
  const canRespondToQuestion = selectedQuestion ? matchesStakeholderUser(activeUser, selectedQuestion.assignedTo) : false;

  useEffect(() => {
    if (selectedQuestionIdFromUrl && visibleQuestions.some((question) => question.id === selectedQuestionIdFromUrl)) {
      setSelectedId(selectedQuestionIdFromUrl);
    }
  }, [selectedQuestionIdFromUrl, visibleQuestions]);

  useEffect(() => {
    setResponseDraft(selectedQuestion?.responseText ?? "");
  }, [selectedQuestion?.id, selectedQuestion?.responseText]);

  function openQuestion(questionId: string) {
    setSelectedId(questionId);
    const params = new URLSearchParams(searchParams.toString());
    if (embedded) {
      params.set("tab", "questions");
    }
    params.set("questionId", questionId);
    params.delete("requestId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  function closeQuestion() {
    setSelectedId("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("questionId");
    if (embedded) {
      params.set("tab", "questions");
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function clearCreateQueryParams() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("openCreate");
    params.delete("followUpRequestId");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function closeCreateModal() {
    setIsCreating(false);
    setFollowUpTarget(null);
    setForm(defaultQuestionForm);
    clearCreateQueryParams();
  }

  function closeCreateRequestModal() {
    setIsCreatingRequest(false);
    setRequestFollowUpTarget(null);
    setRequestForm(defaultRequestForm);
  }

  function handleCreateQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (canCreateInLiveMode && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/questions`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              askedByUserId: form.askedByUserId,
              assignedTo: form.assignedTo,
              controlId: form.controlId,
              dueDate: form.dueDate,
              phaseTag: form.phaseTag,
              parentQuestionId: form.parentQuestionId,
              parentRequestId: form.parentRequestId,
              questionText: form.questionText.trim(),
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to create question.");
          }

          setForm(defaultQuestionForm);
          setFollowUpTarget(null);
          setIsCreating(false);
          clearCreateQueryParams();
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

    const askedByUser = users.find((user) => user.id === form.askedByUserId) ?? activeUser;

    const nextId = `Q-${String(questionRows.length + 1).padStart(2, "0")}`;
    const nextQuestion: Question = {
      id: nextId,
      displayId: nextId,
      controlId: form.controlId,
      phaseTag: form.phaseTag,
      parentQuestionId: form.parentQuestionId,
      parentRequestId: form.parentRequestId,
      askedBy: askedByUser.name,
      assignedTo: form.assignedTo,
      dateSent: new Date(currentNow).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      status: "OPEN",
      questionText: form.questionText.trim(),
    };

    setQuestionRows((current) => [...current, nextQuestion]);
    setForm(defaultQuestionForm);
    setFollowUpTarget(null);
    setIsCreating(false);
    clearCreateQueryParams();
  }

  function handleSubmitResponse(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!selectedQuestion || responseDraft.trim().length === 0) {
      return;
    }

    if (mode === "live" && auditId) {
      startTransition(async () => {
        try {
          const response = await fetch(`/api/audits/${auditId}/questions/${selectedQuestion.id}`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              responseText: responseDraft.trim(),
            }),
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
          ? {
              ...question,
              responseText: responseDraft.trim(),
              responseDate: new Date(currentNow).toISOString(),
              status: "RESPONDED",
            }
          : question,
      ),
    );
  }

  function triggerQuestionAttachmentUpload() {
    questionAttachmentInputRef.current?.click();
  }

  function handleQuestionAttachmentSelection(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);

    if (!selectedQuestion || files.length === 0) {
      event.target.value = "";
      return;
    }

    startTransition(async () => {
      try {
        const nextDocuments =
          mode === "live" && auditId
            ? await Promise.all(
                files.map(async (file) => {
                  const payload = new FormData();
                  payload.set("file", file);
                  payload.set("controlId", selectedQuestion.controlId);
                  payload.set("fileName", file.name);
                  payload.set("ownerUserId", activeUser.id);
                  payload.set("questionId", selectedQuestion.id);
                  const response = await fetch(`/api/audits/${auditId}/response-attachments`, {
                    method: "POST",
                    body: payload,
                  });
                  const result = (await response.json()) as (AuditDocumentRow & { error?: string }) | { error?: string };

                  if (!response.ok) {
                    throw new Error("error" in result ? result.error ?? "Unable to attach file." : "Unable to attach file.");
                  }

                  return mapDocument(result as AuditDocumentRow);
                }),
              )
            : files.map((file, index) => createPrototypeResponseAttachmentDocument({
                file,
                linkedControlId: selectedQuestion.controlId,
                linkedQuestionId: selectedQuestion.id,
                ownerId: activeUser.id,
                now: currentNow,
                ordinal: documentRows.length + index,
              }));

        setDocumentRows((current) => [...current, ...nextDocuments]);
        showNotification({
          title: files.length === 1 ? "File attached" : "Files attached",
          message: files.length === 1 ? `${files[0]?.name} was linked to this question.` : `${files.length} files were linked to this question.`,
          tone: "success",
        });
      } catch (error) {
        showNotification({
          title: "Upload failed",
          message: error instanceof Error ? error.message : "Unable to attach the selected file.",
          tone: "error",
        });
      } finally {
        event.target.value = "";
      }
    });
  }

  function openQuestionFollowUp(question: Question) {
    setForm({
      ...defaultQuestionForm,
      assignedTo: question.assignedTo,
      controlId: question.controlId,
      parentQuestionId: question.id,
      parentRequestId: undefined,
      phaseTag: question.phaseTag ?? defaultQuestionForm.phaseTag,
    });
    setFollowUpTarget({ parentQuestionId: question.id });
    setIsCreating(true);
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
              assignedTo: requestForm.assignedTo,
              controlId: requestForm.controlId,
              dueDate: requestForm.dueDate,
              phaseTag: requestForm.phaseTag,
              parentQuestionId: requestForm.parentQuestionId,
              parentRequestId: requestForm.parentRequestId,
              description: requestForm.description.trim(),
            }),
          });
          const result = (await response.json()) as { error?: string };

          if (!response.ok) {
            throw new Error(result.error ?? "Unable to create request.");
          }

          closeCreateRequestModal();
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
      controlId: requestForm.controlId,
      phaseTag: requestForm.phaseTag,
      parentQuestionId: requestForm.parentQuestionId,
      parentRequestId: requestForm.parentRequestId,
      assignedTo: requestForm.assignedTo,
      dateRequested: new Date(currentNow).toISOString(),
      dueDate: new Date(requestForm.dueDate).toISOString(),
      description: requestForm.description.trim(),
      status: "OPEN",
    };

    setRequestRows((current) => [...current, nextRequest]);
    closeCreateRequestModal();
  }

  function openCrossTypeFollowUpRequest(question: Question) {
    setRequestForm({
      ...defaultRequestForm,
      assignedTo: question.assignedTo,
      controlId: question.controlId,
      parentQuestionId: question.id,
      parentRequestId: undefined,
      phaseTag: question.phaseTag ?? defaultRequestForm.phaseTag,
    });
    setRequestFollowUpTarget({ parentQuestionId: question.id });
    setIsCreatingRequest(true);
  }

  return (
    <div className={embedded ? "flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-col gap-4 xl:h-[calc(100dvh-13rem)]"}>
      {!embedded ? (
        <PageHeader
          title="Question log"
          description={
            mode === "live"
              ? `Question tracking for ${auditLabel}. Live rows and saved responses are loaded from Supabase for this audit.`
              : "Centralized management for auditor inquiries, response turnaround, and blocked analysis. This log is for actual questions, separate from the evidence-request workflow."
          }
          phaseStatus={{
            label: mode === "live" ? "Live audit data" : "Prototype mode",
            active: mode === "live",
          }}
        />
      ) : null}

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex w-full flex-col gap-3 lg:max-w-xl">
            <div className="relative w-full">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search questions or stakeholders"
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-11 py-3 text-sm outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as Question["status"] | "ALL")}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              <option value="ALL">All statuses</option>
              <option value="OPEN">Open</option>
              <option value="OVERDUE">Overdue</option>
              <option value="RESPONDED">Responded</option>
            </select>
            <select
              value={assignedToFilter}
              onChange={(event) => setAssignedToFilter(event.target.value)}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              <option value="ALL">All contacts</option>
              {stakeholderOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              value={askedByFilter}
              onChange={(event) => setAskedByFilter(event.target.value)}
              className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm"
            >
              <option value="ALL">All askers</option>
              {users.map((option) => (
                <option key={option.id} value={option.name}>
                  {option.name}
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
                onChange={(event) => setSortBy(event.target.value as QuestionSort)}
                className="rounded-full border border-black/5 bg-[var(--surface-tint)] py-2 pl-10 pr-4 text-sm"
              >
                {questionSortOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatQuestionSortLabel(option)}
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
                New Question
              </button>
            ) : (
              <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Select a live audit to create questions
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="bg-white px-4 py-2">Question</th>
                <th className="bg-white px-4 py-2">Tagged person</th>
                <th className="bg-white px-4 py-2">Sent</th>
                <th className="bg-white px-4 py-2">Due</th>
                <th className="bg-white px-4 py-2">Answered</th>
                <th className="bg-white px-4 py-2">Delay impact</th>
                <th className="bg-white px-4 py-2">Status</th>
                <th className="bg-white px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((question) => {
                const ageHours = getQuestionAgeHours(question, currentNow);
                const currentDelayHours = getQuestionCurrentDelayHours(question, currentNow);
                const realizedDelayHours = getQuestionRealizedDelayHours(question);
                const chainDelayHours = getQuestionChainDelayHours(question, visibleQuestions, visibleRequests, currentNow);
                const displayStatus = getQuestionDisplayStatus(question, currentNow);
                const tone = displayStatus === "RESPONDED" ? "success" : displayStatus === "OVERDUE" ? "risk" : "warning";

                return (
                  <tr
                    key={question.id}
                    className="cursor-pointer bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
                    onClick={() => openQuestion(question.id)}
                  >
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{getQuestionLabel(question)}</p>
                      <p className="mt-1 max-w-md text-sm text-[var(--foreground)]">{question.questionText}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">
                        Asked by {question.askedBy} for Control {getControlDisplayLabel(question.controlId, controlLabelById)} · {question.phaseTag ?? "Planning"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{question.assignedTo}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(question.dateSent)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(question.dueDate)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{question.responseDate ? formatShortDate(question.responseDate) : "Pending"}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">
                      {formatDelayImpactLabel({
                        ageHours,
                        chainDelayHours,
                        currentDelayHours,
                        realizedDelayHours,
                        status: displayStatus,
                      })}
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={displayStatus} tone={tone} />
                    </td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <div className="flex items-center gap-2">
                        <ReminderButton visible={shouldShowReminder(question, currentNow)} tooltip="Awaiting response > 48h" />
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            openQuestion(question.id);
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
        title="New Question"
        subtitle={
          followUpTarget
            ? "Create a linked follow-up question when the prior response was incomplete or incorrect."
            : "Create a new auditor inquiry and tag the person responsible for responding."
        }
        onClose={closeCreateModal}
      >
        <form className="grid gap-4" onSubmit={handleCreateQuestion}>
          <Field label="Question">
            <textarea
              required
              rows={4}
              value={form.questionText}
              onChange={(event) => setForm((current) => ({ ...current, questionText: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              placeholder="Enter the question you want to send"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tag person">
              <select
                value={form.assignedTo}
                onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {questionAssigneeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Asked by">
              <input
                value={activeUser.name}
                readOnly
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--muted)] outline-none"
              />
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Related control">
              <select
              value={form.controlId}
              onChange={(event) => setForm((current) => ({ ...current, controlId: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
            >
              {questionControlOptions.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlLabel(control)} - {control.name}
                </option>
              ))}
            </select>
          </Field>

            <Field label="Response needed by">
              <input
                required
                type="datetime-local"
                value={form.dueDate}
                onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

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
              onClick={closeCreateModal}
              className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save Question
            </button>
          </div>
        </form>
      </FormModal>

      <FormModal
        open={isCreatingRequest}
        title="New Request"
        subtitle={
          requestFollowUpTarget
            ? "Create a linked follow-up request when the prior response package was incomplete."
            : "Create a new evidence or document request and tag the person responsible for fulfilling it."
        }
        onClose={closeCreateRequestModal}
      >
        <form className="grid gap-4" onSubmit={handleCreateRequest}>
          <Field label="Request">
            <textarea
              required
              rows={4}
              value={requestForm.description}
              onChange={(event) => setRequestForm((current) => ({ ...current, description: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              placeholder="Describe the evidence or document needed"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Tag person">
              <select
                value={requestForm.assignedTo}
                onChange={(event) => setRequestForm((current) => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {requestAssigneeOptions.map((option) => (
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
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              />
            </Field>
          </div>

          <Field label="Related control">
            <select
              value={requestForm.controlId}
              onChange={(event) => setRequestForm((current) => ({ ...current, controlId: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
            >
              {requestControlOptions.map((control) => (
                <option key={control.id} value={control.id}>
                  {getControlLabel(control)} - {control.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Phase">
            <select
              value={requestForm.phaseTag}
              onChange={(event) => setRequestForm((current) => ({ ...current, phaseTag: event.target.value as AuditPhase }))}
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
              onClick={closeCreateRequestModal}
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

      {selectedQuestion ? (
        <DetailPanel
          title={`${getQuestionLabel(selectedQuestion)} · ${selectedQuestion.assignedTo}`}
          subtitle={selectedQuestion.questionText}
          open={Boolean(selectedQuestion)}
          onClose={closeQuestion}
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

            <section className="grid gap-4 md:grid-cols-3">
              <DetailCard
                label="Current delay"
                value={formatHours(getQuestionCurrentDelayHours(selectedQuestion, currentNow))}
                helpText="Hours currently past the due date for an open or overdue item. This drops to zero once the item is resolved."
              />
              <DetailCard
                label="Realized delay"
                value={formatHours(getQuestionRealizedDelayHours(selectedQuestion))}
                helpText="Hours the item ended up late when it was answered, measured from due date to response date."
              />
              <DetailCard
                label="Chain delay impact"
                value={formatHours(getQuestionChainDelayHours(selectedQuestion, visibleQuestions, visibleRequests, currentNow))}
                helpText="Total delay impact across this item and any linked follow-up questions or requests created because the first response did not fully resolve the issue."
                helpAlign="end"
              />
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Question and response</p>
              <StatusBadge
                status={getQuestionDisplayStatus(selectedQuestion, currentNow)}
                tone={getQuestionDisplayStatus(selectedQuestion, currentNow) === "RESPONDED" ? "success" : getQuestionDisplayStatus(selectedQuestion, currentNow) === "OVERDUE" ? "risk" : "warning"}
                className="mt-4"
              />
              <p className="mt-4 text-sm leading-7 text-[var(--foreground)]">
                {selectedQuestion.responseText ?? "No response captured yet. This item is still blocking control completion."}
              </p>
              <p className="mt-3 text-sm text-[var(--muted)]">
                Response date: {selectedQuestion.responseDate ? formatDateTime(selectedQuestion.responseDate) : "Pending"}
              </p>
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Follow-ups</p>
                  <p className="mt-2 text-sm text-[var(--muted)]">
                    Spawn a linked follow-up when the prior response did not fully unblock the audit.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => openQuestionFollowUp(selectedQuestion)}
                    className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                  >
                    Follow-up question
                  </button>
                  <button
                    type="button"
                    onClick={() => openCrossTypeFollowUpRequest(selectedQuestion)}
                    className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
                  >
                    Follow-up request
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3">
                {renderFollowUpRows(getQuestionFollowUps(selectedQuestion, visibleQuestions, visibleRequests))}
              </div>
            </section>

            {canRespondToQuestion ? (
              <section className="rounded-[24px] border border-black/5 bg-white p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Respond</p>
                <p className="mt-2 text-sm text-[var(--muted)]">
                  Save the tagged person&apos;s response directly from the question panel.
                </p>
                <form className="mt-4 grid gap-4" onSubmit={handleSubmitResponse}>
                  <input
                    ref={questionAttachmentInputRef}
                    type="file"
                    multiple
                    onChange={handleQuestionAttachmentSelection}
                    className="hidden"
                  />
                  <textarea
                    required
                    rows={5}
                    value={responseDraft}
                    onChange={(event) => setResponseDraft(event.target.value)}
                    className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
                    placeholder="Type the response for this question"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={triggerQuestionAttachmentUpload}
                      disabled={isPending}
                      className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <Upload size={15} />
                      Upload file
                    </button>
                    <button
                      type="submit"
                      disabled={isPending || responseDraft.trim().length === 0}
                      className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Save Response
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Related documents</p>
              <div className="mt-4 grid gap-3">
                {getQuestionRelatedDocuments(selectedQuestion.id, visibleDocuments).length > 0 ? (
                  getQuestionRelatedDocuments(selectedQuestion.id, visibleDocuments).map((document) => (
                    <div key={document.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{document.status.replaceAll("_", " ")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No linked evidence has been attached yet.</p>
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

function FilterPill({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? "border-[rgba(1,30,65,0.08)] bg-[var(--brand-indigo-core)] text-white"
          : "border-black/5 bg-white text-[var(--muted)]"
      }`}
    >
      {label}
    </button>
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

function formatQuestionSortLabel(value: QuestionSort) {
  switch (value) {
    case "DUE_ASC":
      return "Sort: due soonest";
    case "DUE_DESC":
      return "Sort: due latest";
    case "AGE_DESC":
      return "Sort: oldest first";
    case "ASSIGNED_TO_ASC":
      return "Sort: contact";
    case "STATUS_ASC":
      return "Sort: status";
  }
}

function getQuestionLabel(question: Question) {
  return question.displayId ?? question.id;
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

function formatDelayImpactLabel({
  ageHours,
  chainDelayHours,
  currentDelayHours,
  realizedDelayHours,
  status,
}: {
  ageHours: number;
  chainDelayHours: number;
  currentDelayHours: number;
  realizedDelayHours: number;
  status: Question["status"];
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

  if (status === "RESPONDED") {
    return "On time";
  }

  return `${Math.round(ageHours)}h open`;
}

function renderFollowUpRows(followUps: { questions: Question[]; requests: Request[] }) {
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

function createPrototypeResponseAttachmentDocument({
  file,
  linkedControlId,
  linkedQuestionId,
  ownerId,
  now,
  ordinal,
}: {
  file: File;
  linkedControlId?: string;
  linkedQuestionId?: string;
  ownerId: string;
  now: string;
  ordinal: number;
}): AuditDocument {
  return {
    id: `response-attachment-question-${ordinal + 1}`,
    type: "EVIDENCE",
    title: file.name,
    linkedControlId,
    linkedQuestionId,
    ownerId,
    status: "COMPLETE",
    previewSummary: `Attached from the question response panel on ${formatDateTime(now)}.`,
    previewSections: [
      {
        heading: "Attachment metadata",
        body: [
          `File name: ${file.name}`,
          `File size: ${formatFileSize(file.size)}`,
          `File type: ${file.type || "Unknown"}`,
        ],
      },
    ],
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
