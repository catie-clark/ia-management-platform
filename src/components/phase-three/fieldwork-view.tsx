"use client";

import { useMemo, useState } from "react";
import { ArrowRight, ClipboardCheck, FileSearch, Link2, Workflow } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { PhaseCompletionCard } from "@/components/phase-three/phase-completion-card";
import { DetailPanel } from "@/components/ui/detail-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { controls, documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument, AuditPhase, DocumentReviewStatus } from "@/types/audit";

const workflowStages: DocumentReviewStatus[] = ["NOT_SUBMITTED", "AIC_REVIEW", "MANAGER_REVIEW", "DIRECTOR_REVIEW", "APPROVED"];

export function FieldworkView({
  auditId = null,
  auditLabel = "Prototype Demo Audit",
  auditStatus = "prototype",
  currentPhase = "Fieldwork",
}: {
  auditId?: string | null;
  auditLabel?: string;
  auditStatus?: string;
  currentPhase?: AuditPhase;
}) {
  const [selectedId, setSelectedId] = useState<string>("");

  const workpapers = useMemo(
    () => documents.filter((document) => document.type === "WORKPAPER" || document.type === "EVIDENCE"),
    [],
  );

  const selectedDocument = workpapers.find((document) => document.id === selectedId) ?? null;
  const completeCount = workpapers.filter((document) => document.reviewStatus === "APPROVED").length;
  const atRiskCount = workpapers.filter((document) => isAtRisk(document)).length;

  return (
    <div>
      <PageHeader
        eyebrow="Phase 3"
        title="Fieldwork"
        description="Fieldwork tracks workpaper completion, review progression, and linked blockers so execution pressure stays visible before the phase gate."
        phaseStatus={{ label: currentPhase === "Fieldwork" ? "Active" : `Current phase: ${currentPhase}`, active: currentPhase === "Fieldwork" }}
      />

      <div className="mb-6">
        <PhaseCompletionCard auditId={auditId} auditLabel={auditLabel} auditStatus={auditStatus} currentPhase={currentPhase} pagePhase="Fieldwork" />
      </div>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <FieldworkMetric icon={<FileSearch size={18} />} label="Tracked workpapers" value={`${workpapers.length}`} detail="Evidence and workpapers active in execution" tone="neutral" />
        <FieldworkMetric icon={<ClipboardCheck size={18} />} label="Approved" value={`${completeCount}`} detail="Items fully through director review" tone="success" />
        <FieldworkMetric icon={<Workflow size={18} />} label="In review" value={`${workpapers.filter((item) => item.reviewStatus && item.reviewStatus !== "APPROVED" && item.reviewStatus !== "NOT_SUBMITTED").length}`} detail="Flowing through AIC, manager, and director checkpoints" tone="warning" />
        <FieldworkMetric icon={<Link2 size={18} />} label="At risk" value={`${atRiskCount}`} detail="Items with overdue dates or unresolved blockers" tone="risk" />
      </section>

      <div className="mt-6 grid gap-6 2xl:grid-cols-[0.8fr_1.2fr]">
        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workflow progression</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Review stages across active workpapers</h2>
          <div className="mt-6 grid gap-4">
            {workflowStages.map((stage) => {
              const stageItems = workpapers.filter((document) => (document.reviewStatus ?? "NOT_SUBMITTED") === stage);

              return (
                <div key={stage} className="rounded-[22px] bg-[var(--surface-tint)] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{stage.replaceAll("_", " ")}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{stageItems.length} workpapers</p>
                    </div>
                    <StatusBadge status={`${stageItems.length}`} tone={stage === "APPROVED" ? "success" : stage === "NOT_SUBMITTED" ? "risk" : "warning"} />
                  </div>
                  <div className="mt-4 grid gap-2">
                    {stageItems.length > 0 ? (
                      stageItems.map((document) => (
                        <button
                          key={document.id}
                          type="button"
                          onClick={() => setSelectedId(document.id)}
                          className="rounded-[18px] bg-white px-4 py-3 text-left transition-transform duration-200 hover:-translate-y-0.5"
                        >
                          <p className="text-sm font-semibold text-[var(--foreground)]">{document.id} · {document.title}</p>
                          <p className="mt-1 text-sm text-[var(--muted)]">{getOwnerName(document.ownerId)}</p>
                        </button>
                      ))
                    ) : (
                      <p className="text-sm text-[var(--muted)]">No workpapers currently sitting in this stage.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Workpaper tracker</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Execution queue with linked blockers</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="px-4">Workpaper</th>
                  <th className="px-4">Owner</th>
                  <th className="px-4">Due</th>
                  <th className="px-4">Review stage</th>
                  <th className="px-4">Linked blockers</th>
                  <th className="px-4">Action</th>
                </tr>
              </thead>
              <tbody>
                {workpapers.map((document) => {
                  const blockerCount = getLinkedBlockers(document).length;
                  const reviewStatus = document.reviewStatus ?? "NOT_SUBMITTED";

                  return (
                    <tr key={document.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                      <td className="rounded-l-3xl px-4 py-4">
                        <p className="text-sm font-semibold text-[var(--foreground)]">{document.id}</p>
                        <p className="mt-1 text-sm text-[var(--foreground)]">{document.title}</p>
                        <p className="mt-1 text-xs text-[var(--muted)]">{document.type}</p>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">{getOwnerName(document.ownerId)}</td>
                      <td className="px-4 py-4 text-sm text-[var(--muted)]">{document.dueDate ? formatShortDate(document.dueDate) : "TBD"}</td>
                      <td className="px-4 py-4">
                        <StatusBadge status={reviewStatus} tone={reviewStatus === "APPROVED" ? "success" : reviewStatus === "NOT_SUBMITTED" ? "risk" : "warning"} />
                      </td>
                      <td className="px-4 py-4">
                        <StatusBadge status={`${blockerCount} open`} tone={blockerCount > 0 ? "risk" : "success"} />
                      </td>
                      <td className="rounded-r-3xl px-4 py-4">
                        <button
                          type="button"
                          onClick={() => setSelectedId(document.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Inspect
                          <ArrowRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedDocument ? (
        <DetailPanel
          title={`${selectedDocument.id} · ${selectedDocument.title}`}
          subtitle="Fieldwork detail surfaces review progression, linked support, and blocking dependencies."
          open={Boolean(selectedDocument)}
          onClose={() => setSelectedId("")}
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <FieldworkInfoCard label="Owner" value={getOwnerName(selectedDocument.ownerId)} />
              <FieldworkInfoCard label="Type" value={selectedDocument.type.replaceAll("_", " ")} />
              <FieldworkInfoCard label="Due date" value={selectedDocument.dueDate ? formatDateTime(selectedDocument.dueDate) : "Not set"} />
              <FieldworkInfoCard label="Review stage" value={(selectedDocument.reviewStatus ?? "NOT_SUBMITTED").replaceAll("_", " ")} />
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Review workflow</p>
              <div className="mt-4 grid gap-2 md:grid-cols-5">
                {workflowStages.map((stage, index) => {
                  const currentIndex = workflowStages.indexOf(selectedDocument.reviewStatus ?? "NOT_SUBMITTED");
                  const tone = index < currentIndex ? "success" : index === currentIndex ? "warning" : "neutral";
                  return <StatusBadge key={stage} status={stage} tone={tone} className="justify-center py-2" />;
                })}
              </div>
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked blockers and evidence context</p>
              <div className="mt-4 grid gap-3">
                {getLinkedBlockers(selectedDocument).map((item) => (
                  <div key={item.id} className="rounded-[18px] bg-[var(--surface-tint)] px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{item.id} · {item.title}</p>
                      <StatusBadge status={item.status} tone={item.tone} />
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted)]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </DetailPanel>
      ) : null}
    </div>
  );
}

function FieldworkMetric({
  icon,
  label,
  value,
  detail,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  tone: "neutral" | "warning" | "risk" | "success";
}) {
  return (
    <article className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">{label}</p>
        <span className="text-[var(--brand-indigo-core)]">{icon}</span>
      </div>
      <div className="mt-3 flex items-end gap-3">
        <p className="text-3xl font-semibold text-[var(--foreground)]">{value}</p>
        <StatusBadge status={label} tone={tone} />
      </div>
      <p className="mt-3 text-sm text-[var(--muted)]">{detail}</p>
    </article>
  );
}

function FieldworkInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function getOwnerName(ownerId: string) {
  return users.find((user) => user.id === ownerId)?.name ?? ownerId;
}

function getLinkedBlockers(document: AuditDocument) {
  const blockers: Array<{ id: string; title: string; detail: string; status: string; tone: "warning" | "risk" | "success" }> = [];

  if (document.linkedControlId) {
    const control = controls.find((item) => item.id === document.linkedControlId);
    if (control) {
      blockers.push({
        id: control.id,
        title: control.name,
        detail: `Control status ${control.status.replaceAll("_", " ")} with due date ${formatShortDate(control.dueDate)}.`,
        status: control.status,
        tone: control.status === "BLOCKED" ? "risk" : control.status === "COMPLETE" ? "success" : "warning",
      });
    }
  }

  if (document.linkedQuestionId) {
    const question = questions.find((item) => item.id === document.linkedQuestionId);
    if (question) {
      blockers.push({
        id: question.id,
        title: "Linked question",
        detail: question.questionText,
        status: question.status,
        tone: question.status === "RESPONDED" ? "success" : question.status === "OVERDUE" ? "risk" : "warning",
      });
    }
  }

  if (document.linkedRequestId) {
    const request = requests.find((item) => item.id === document.linkedRequestId);
    if (request) {
      blockers.push({
        id: request.id,
        title: "Linked request",
        detail: request.description,
        status: request.status,
        tone: request.status === "COMPLETED" ? "success" : "warning",
      });
    }
  }

  return blockers;
}

function isAtRisk(document: AuditDocument) {
  if (!document.dueDate) {
    return false;
  }

  return new Date(document.dueDate).getTime() < new Date(mockNow).getTime() || (document.reviewStatus ?? "NOT_SUBMITTED") === "NOT_SUBMITTED";
}
