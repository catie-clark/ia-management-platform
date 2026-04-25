"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownUp, ArrowRight, Plus, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { DetailPanel } from "@/components/ui/detail-panel";
import { ReminderButton } from "@/components/ui/reminder-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { getQuestionAgeHours, getQuestionRelatedDocuments, shouldShowReminder } from "@/lib/audit-logic";
import { getQuestionLogNow } from "@/lib/question-log-data";
import type { DashboardMode } from "@/lib/live-audit";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, Control, Question, User } from "@/types/audit";

type DueFilter = "ALL" | "OVERDUE" | "NEXT_48_HOURS" | "NEXT_7_DAYS" | "FUTURE";
type QuestionSort = "DUE_ASC" | "DUE_DESC" | "AGE_DESC" | "ASSIGNED_TO_ASC" | "STATUS_ASC";
const dueFilterOptions: DueFilter[] = ["ALL", "OVERDUE", "NEXT_48_HOURS", "NEXT_7_DAYS", "FUTURE"];
const questionSortOptions: QuestionSort[] = ["DUE_ASC", "DUE_DESC", "AGE_DESC", "ASSIGNED_TO_ASC", "STATUS_ASC"];

type QuestionLogViewProps = {
  auditLabel: string;
  controls: Control[];
  documents: AuditDocument[];
  embedded?: boolean;
  mode: DashboardMode;
  questions: Question[];
  users: User[];
};

export function QuestionLogView({
  auditLabel,
  controls,
  documents,
  embedded = false,
  mode,
  questions,
  users,
}: QuestionLogViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [questionRows, setQuestionRows] = useState<Question[]>(questions);
  const [selectedId, setSelectedId] = useState<string>("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<Question["status"] | "ALL">("ALL");
  const [dueFilter, setDueFilter] = useState<DueFilter>("ALL");
  const [sortBy, setSortBy] = useState<QuestionSort>("DUE_ASC");
  const [isCreating, setIsCreating] = useState(false);
  const currentNow = useMemo(() => getQuestionLogNow(mode), [mode]);
  const stakeholderOptions = useMemo(
    () =>
      Array.from(new Set([...questionRows.map((question) => question.assignedTo), "Compliance Director", "Retail Ops Manager", "Application Support Lead"])),
    [questionRows],
  );
  const askerOptions = useMemo(() => Array.from(new Set(questionRows.map((question) => question.askedBy))), [questionRows]);
  const defaultQuestionForm = useMemo(
    () => ({
      controlId: controls[0]?.id ?? "",
      askedBy: users[0]?.name ?? "",
      assignedTo: stakeholderOptions[0] ?? "",
      dueDate: toLocalInputValue(new Date(currentNow)),
      questionText: "",
    }),
    [controls, currentNow, stakeholderOptions, users],
  );
  const [assignedToFilter, setAssignedToFilter] = useState<string>("ALL");
  const [askedByFilter, setAskedByFilter] = useState<string>("ALL");
  const [form, setForm] = useState(defaultQuestionForm);

  useEffect(() => {
    setQuestionRows(questions);
  }, [questions]);

  useEffect(() => {
    setForm(defaultQuestionForm);
  }, [defaultQuestionForm]);

  const filteredQuestions = useMemo(() => {
    return questionRows
      .filter((question) => {
        const q = search.toLowerCase();
        const matchesSearch =
          !q ||
          question.id.toLowerCase().includes(q) ||
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
          (statusFilter === "ALL" || question.status === statusFilter) &&
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
  }, [assignedToFilter, askedByFilter, currentNow, dueFilter, questionRows, search, sortBy, statusFilter]);

  const selectedQuestion = questionRows.find((question) => question.id === selectedId) ?? null;
  const selectedQuestionIdFromUrl = searchParams.get("questionId");

  useEffect(() => {
    if (selectedQuestionIdFromUrl && questionRows.some((question) => question.id === selectedQuestionIdFromUrl)) {
      setSelectedId(selectedQuestionIdFromUrl);
    }
  }, [selectedQuestionIdFromUrl, questionRows]);

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

  function handleCreateQuestion(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextId = `Q-${String(questionRows.length + 1).padStart(2, "0")}`;
    const nextQuestion: Question = {
      id: nextId,
      controlId: form.controlId,
      askedBy: form.askedBy,
      assignedTo: form.assignedTo,
      dateSent: new Date(currentNow).toISOString(),
      dueDate: new Date(form.dueDate).toISOString(),
      status: "OPEN",
      questionText: form.questionText.trim(),
    };

    setQuestionRows((current) => [...current, nextQuestion]);
    setForm(defaultQuestionForm);
    setIsCreating(false);
  }

  return (
    <div className={embedded ? "flex min-h-0 flex-1 flex-col" : "flex min-h-0 flex-col gap-6 xl:h-[calc(100dvh-13.5rem)]"}>
      {!embedded ? (
        <PageHeader
          eyebrow="Phase 2"
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
          <div className="relative w-full lg:max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions or stakeholders"
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-11 py-3 text-sm outline-none"
            />
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
              {askerOptions.map((option) => (
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

            {mode === "prototype" ? (
              <button
                type="button"
                onClick={() => setIsCreating(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(1,30,65,0.18)]"
              >
                <Plus size={16} />
                New Question
              </button>
            ) : (
              <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                Create/edit flow not wired yet
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 min-h-0 flex-1 overflow-auto">
          <table className="min-w-full border-separate border-spacing-y-3">
            <thead>
              <tr className="sticky top-0 z-10 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                <th className="bg-white px-4 py-2">Question</th>
                <th className="bg-white px-4 py-2">Business contact</th>
                <th className="bg-white px-4 py-2">Sent</th>
                <th className="bg-white px-4 py-2">Due</th>
                <th className="bg-white px-4 py-2">Answered</th>
                <th className="bg-white px-4 py-2">Age</th>
                <th className="bg-white px-4 py-2">Status</th>
                <th className="bg-white px-4 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredQuestions.map((question) => {
                const ageHours = getQuestionAgeHours(question, currentNow);
                const tone = question.status === "RESPONDED" ? "success" : question.status === "OVERDUE" ? "risk" : "warning";

                return (
                  <tr
                    key={question.id}
                    className="cursor-pointer bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)] transition-transform duration-200 hover:-translate-y-0.5"
                    onClick={() => openQuestion(question.id)}
                  >
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{question.id}</p>
                      <p className="mt-1 max-w-md text-sm text-[var(--foreground)]">{question.questionText}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">Asked by {question.askedBy} for Control {question.controlId}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{question.assignedTo}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(question.dateSent)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{formatShortDate(question.dueDate)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{question.responseDate ? formatShortDate(question.responseDate) : "Pending"}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{Math.round(ageHours)}h open</td>
                    <td className="px-4 py-4">
                      <StatusBadge status={question.status} tone={tone} />
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
        subtitle="Create a new auditor inquiry without leaving the question log."
        onClose={() => setIsCreating(false)}
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
            <Field label="Ask to">
              <select
                value={form.assignedTo}
                onChange={(event) => setForm((current) => ({ ...current, assignedTo: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {stakeholderOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Asked by">
              <select
                value={form.askedBy}
                onChange={(event) => setForm((current) => ({ ...current, askedBy: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.name}>
                    {user.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Related control">
              <select
                value={form.controlId}
                onChange={(event) => setForm((current) => ({ ...current, controlId: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {controls.map((control) => (
                  <option key={control.id} value={control.id}>
                    {control.id} - {control.name}
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
              className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
            >
              Save Question
            </button>
          </div>
        </form>
      </FormModal>

      {selectedQuestion ? (
        <DetailPanel
          title={`${selectedQuestion.id} · ${selectedQuestion.assignedTo}`}
          subtitle={selectedQuestion.questionText}
          open={Boolean(selectedQuestion)}
          onClose={closeQuestion}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <DetailCard label="Asked by" value={selectedQuestion.askedBy} />
              <DetailCard label="Assigned to" value={selectedQuestion.assignedTo} />
              <DetailCard label="Date sent" value={formatDateTime(selectedQuestion.dateSent)} />
              <DetailCard label="Due date" value={formatDateTime(selectedQuestion.dueDate)} />
              <DetailCard label="Date answered" value={selectedQuestion.responseDate ? formatDateTime(selectedQuestion.responseDate) : "Pending"} />
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Question and response</p>
              <StatusBadge
                status={selectedQuestion.status}
                tone={selectedQuestion.status === "RESPONDED" ? "success" : selectedQuestion.status === "OVERDUE" ? "risk" : "warning"}
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
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Related documents</p>
              <div className="mt-4 grid gap-3">
                {getQuestionRelatedDocuments(selectedQuestion.id, documents).length > 0 ? (
                  getQuestionRelatedDocuments(selectedQuestion.id, documents).map((document) => (
                    <div key={document.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{document.title}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{document.status.replaceAll("_", " ")}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-[var(--muted)]">No linked evidence has been attached in the prototype yet.</p>
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

function DetailCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
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
