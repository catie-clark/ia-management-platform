"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FolderKanban, ShieldCheck, Upload, X } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";
import { useActiveUser } from "@/components/layout/active-user-context";
import { DetailPanel } from "@/components/ui/detail-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { controls, documents, mockNow, questions, requests, users } from "@/lib/data/mock-data";
import { formatDateTime, formatShortDate } from "@/lib/utils";
import type { AuditDocument } from "@/types/audit";

type TypeFilter = AuditDocument["type"] | "ALL";
type StatusFilter = AuditDocument["status"] | "ALL";

const requiredArtifacts: AuditDocument["type"][] = ["PLANNING_NARRATIVE", "TOLLGATE", "WORKPAPER", "EVIDENCE", "REPORT"];

export function DocumentsView() {
  const { activeUser } = useActiveUser();
  const defaultOwnerId = users.find((user) => user.role === "STAFF")?.id ?? users[0]?.id ?? "";
  const [selectedId, setSelectedId] = useState<string>("");
  const [openedDocumentId, setOpenedDocumentId] = useState<string>("");
  const [documentRows, setDocumentRows] = useState<AuditDocument[]>(documents);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [isUploading, setIsUploading] = useState(false);
  const [isSendBackFormOpen, setIsSendBackFormOpen] = useState(false);
  const [sendBackComment, setSendBackComment] = useState("");
  const [uploadForm, setUploadForm] = useState({
    fileName: "",
    type: "WORKPAPER" as AuditDocument["type"],
    dueDate: toLocalInputValue(new Date(mockNow)),
    ownerId: defaultOwnerId,
  });

  const filteredDocuments = useMemo(() => {
    return documentRows.filter((document) => {
      return (typeFilter === "ALL" || document.type === typeFilter) && (statusFilter === "ALL" || document.status === statusFilter);
    });
  }, [documentRows, typeFilter, statusFilter]);

  const selectedDocument = documentRows.find((document) => document.id === selectedId) ?? null;
  const openedDocument = documentRows.find((document) => document.id === openedDocumentId) ?? null;
  const missingArtifacts = getMissingArtifacts(documentRows);
  const canManagerReview =
    activeUser.role === "MANAGER" &&
    selectedDocument?.type === "WORKPAPER" &&
    selectedDocument.reviewStatus === "MANAGER_REVIEW";
  const canStaffSubmit =
    activeUser.role === "STAFF" &&
    selectedDocument?.type === "WORKPAPER" &&
    selectedDocument.ownerId === activeUser.id &&
    selectedDocument.reviewStatus === "NOT_SUBMITTED";

  useEffect(() => {
    setUploadForm((current) => {
      if (current.ownerId) {
        return current;
      }

      return {
        ...current,
        ownerId: defaultOwnerId,
      };
    });
  }, [defaultOwnerId]);

  useEffect(() => {
    setIsSendBackFormOpen(false);
    setSendBackComment("");
  }, [selectedId]);

  function handleUploadDocument(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextId = `D-${String(documentRows.length + 1).padStart(2, "0")}`;
    const nextDocument: AuditDocument = {
      id: nextId,
      title: uploadForm.fileName.replace(/\.[^/.]+$/, "") || uploadForm.fileName,
      type: uploadForm.type,
      ownerId: uploadForm.ownerId,
      dueDate: new Date(uploadForm.dueDate).toISOString(),
      status: "NOT_STARTED",
      reviewStatus: "NOT_SUBMITTED",
      templateName: uploadForm.fileName,
    };

    setDocumentRows((current) => [...current, nextDocument]);
    setUploadForm({
      fileName: "",
      type: "WORKPAPER",
      dueDate: toLocalInputValue(new Date(mockNow)),
      ownerId: activeUser.role === "STAFF" ? activeUser.id : defaultOwnerId,
    });
    setIsUploading(false);
  }

  function updateSelectedDocument(nextValues: Partial<AuditDocument>) {
    if (!selectedDocument) {
      return;
    }

    setDocumentRows((current) =>
      current.map((document) =>
        document.id === selectedDocument.id
          ? { ...document, ...nextValues }
          : document,
      ),
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-6 xl:h-[calc(100dvh-13.5rem)]">
      <PageHeader
        eyebrow="Phase 3"
        title="Documents and audit evidence"
        description="Document governance keeps planning artifacts, workpapers, and evidence visible so missing support becomes obvious before review and reporting bottlenecks build."
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DocumentMetric icon={<FolderKanban size={18} />} label="Tracked documents" value={`${documentRows.length}`} detail="Narratives, tollgates, workpapers, evidence, and report artifacts" tone="neutral" />
        <DocumentMetric icon={<ShieldCheck size={18} />} label="Approved" value={`${documentRows.filter((document) => document.reviewStatus === "APPROVED").length}`} detail="Fully reviewed artifacts available for downstream use" tone="success" />
        <DocumentMetric icon={<AlertTriangle size={18} />} label="Not started" value={`${documentRows.filter((document) => document.status === "NOT_STARTED").length}`} detail="Artifacts that still require owner attention" tone="risk" />
        <DocumentMetric icon={<AlertTriangle size={18} />} label="Coverage gaps" value={`${missingArtifacts.length}`} detail="Required artifact types that are missing or still not started" tone="warning" />
      </section>

      <div className="mt-6 grid min-h-0 flex-1 gap-6 2xl:grid-cols-[0.75fr_1.25fr]">
        <section className="min-h-0 overflow-auto rounded-[28px] border border-black/5 bg-[var(--surface-tint)] p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(229,55,107,0.12)] text-[var(--brand-coral)]">
              <AlertTriangle size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Completion assurance</p>
              <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Missing-document warnings</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3">
            {missingArtifacts.map((item) => (
              <div key={item.title} className="rounded-[20px] bg-white px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                  <StatusBadge status={item.status} tone={item.status === "MISSING" ? "risk" : "warning"} />
                </div>
                <p className="mt-2 text-sm text-[var(--muted)]">{item.detail}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Document inventory</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Tracked artifacts by type and status</h2>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsUploading(true)}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white shadow-[0_14px_28px_rgba(1,30,65,0.18)]"
              >
                <Upload size={16} />
                Upload document
              </button>
              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}
                className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm text-[var(--foreground)] outline-none"
              >
                <option value="ALL">All types</option>
                {requiredArtifacts.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm text-[var(--foreground)] outline-none"
              >
                <option value="ALL">All statuses</option>
                <option value="NOT_STARTED">Not started</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="COMPLETE">Complete</option>
              </select>
            </div>
          </div>

          <div className="mt-6 min-h-0 flex-1 overflow-auto">
            <table className="min-w-full border-separate border-spacing-y-3">
              <thead>
                <tr className="sticky top-0 z-10 text-left text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
                  <th className="bg-white px-4 py-2">Document</th>
                  <th className="bg-white px-4 py-2">Owner</th>
                  <th className="bg-white px-4 py-2">Linked to</th>
                  <th className="bg-white px-4 py-2">Due</th>
                  <th className="bg-white px-4 py-2">Status</th>
                  <th className="bg-white px-4 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDocuments.map((document) => (
                  <tr key={document.id} className="bg-[#fcfbf8] shadow-[0_12px_34px_rgba(1,30,65,0.06)]">
                    <td className="rounded-l-3xl px-4 py-4">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{document.id}</p>
                      <p className="mt-1 text-sm text-[var(--foreground)]">{document.title}</p>
                      <p className="mt-1 text-xs text-[var(--muted)]">{document.type.replaceAll("_", " ")}</p>
                    </td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{getOwnerName(document.ownerId)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{getLinkSummary(document)}</td>
                    <td className="px-4 py-4 text-sm text-[var(--muted)]">{document.dueDate ? formatShortDate(document.dueDate) : "TBD"}</td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <StatusBadge status={document.status} tone={document.status === "COMPLETE" ? "success" : document.status === "NOT_STARTED" ? "risk" : "warning"} />
                        <StatusBadge status={document.reviewStatus ?? "NOT_SUBMITTED"} tone={document.reviewStatus === "APPROVED" ? "success" : "neutral"} />
                      </div>
                    </td>
                    <td className="rounded-r-3xl px-4 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setOpenedDocumentId(document.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Open
                          <ArrowRight size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedId(document.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Inspect
                          <ArrowRight size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedDocument ? (
        <DetailPanel
          title={`${selectedDocument.id} · ${selectedDocument.title}`}
          subtitle="Document metadata, ownership, and linked audit context are grouped here so review readiness is easy to inspect."
          open={Boolean(selectedDocument)}
          onClose={() => setSelectedId("")}
          panelClassName="bottom-4 right-4 top-4 h-auto rounded-[28px] border border-black/5 border-l"
        >
          <div className="grid gap-6">
            <section className="grid gap-4 md:grid-cols-2">
              <DocumentInfoCard label="Owner" value={getOwnerName(selectedDocument.ownerId)} />
              <DocumentInfoCard label="Type" value={selectedDocument.type.replaceAll("_", " ")} />
              <DocumentInfoCard label="Due date" value={selectedDocument.dueDate ? formatDateTime(selectedDocument.dueDate) : "Not set"} />
              <DocumentInfoCard label="Template" value={selectedDocument.templateName ?? "None"} />
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Status and review state</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <StatusBadge status={selectedDocument.status} tone={selectedDocument.status === "COMPLETE" ? "success" : selectedDocument.status === "NOT_STARTED" ? "risk" : "warning"} />
                <StatusBadge status={selectedDocument.reviewStatus ?? "NOT_SUBMITTED"} tone={selectedDocument.reviewStatus === "APPROVED" ? "success" : "neutral"} />
                <StatusBadge status={isOverdue(selectedDocument) ? "OVERDUE" : "ON_TRACK"} tone={isOverdue(selectedDocument) ? "risk" : "success"} />
                <button
                  type="button"
                  onClick={() => setOpenedDocumentId(selectedDocument.id)}
                  className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-indigo-core)]"
                >
                  Open document
                  <ArrowRight size={14} />
                </button>
              </div>
              {canManagerReview ? (
                <div className="mt-5 rounded-[20px] border border-[rgba(245,168,0,0.2)] bg-[rgba(245,168,0,0.08)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-dark)]">Manager review actions</p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">
                    Signed in as {activeUser.name}. This workpaper is currently in manager review and can be approved or sent back at a static prototype level.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDocument({
                          reviewStatus: "DIRECTOR_REVIEW",
                          reviewComment: undefined,
                          reviewCommentAuthor: undefined,
                          reviewCommentDate: undefined,
                        })
                      }
                      className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsSendBackFormOpen((current) => !current)}
                      className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                    >
                      Send back
                    </button>
                  </div>
                  {isSendBackFormOpen ? (
                    <div className="mt-4 rounded-[18px] border border-black/5 bg-white p-4">
                      <label className="grid gap-2">
                        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                          Reviewer comment
                        </span>
                        <textarea
                          value={sendBackComment}
                          onChange={(event) => setSendBackComment(event.target.value)}
                          rows={4}
                          placeholder="Explain what needs to be updated before this workpaper can move forward."
                          className="w-full resize-none rounded-[18px] border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm text-[var(--foreground)] outline-none"
                        />
                      </label>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            updateSelectedDocument({
                              reviewStatus: "AIC_REVIEW",
                              reviewComment: sendBackComment.trim() || "Please update the workpaper before resubmission.",
                              reviewCommentAuthor: activeUser.name,
                              reviewCommentDate: mockNow,
                            });
                            setIsSendBackFormOpen(false);
                            setSendBackComment("");
                          }}
                          className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
                        >
                          Confirm send back
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSendBackFormOpen(false);
                            setSendBackComment("");
                          }}
                          className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {canStaffSubmit ? (
                <div className="mt-5 rounded-[20px] border border-[rgba(5,171,140,0.16)] bg-[rgba(5,171,140,0.08)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-teal-core)]">Staff preparation actions</p>
                  <p className="mt-2 text-sm text-[var(--foreground)]">
                    Signed in as {activeUser.name}. This workpaper is ready to move from staff preparation into AIC review.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        updateSelectedDocument({
                          reviewStatus: "AIC_REVIEW",
                          reviewComment: undefined,
                          reviewCommentAuthor: undefined,
                          reviewCommentDate: undefined,
                        })
                      }
                      className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
                    >
                      Send to AIC Review
                    </button>
                  </div>
                </div>
              ) : null}
              {selectedDocument.reviewComment ? (
                <div className="mt-5 rounded-[20px] border border-[rgba(229,55,107,0.16)] bg-[rgba(229,55,107,0.08)] p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-coral)]">Reviewer send-back note</p>
                  <p className="mt-2 text-sm leading-6 text-[var(--foreground)]">{selectedDocument.reviewComment}</p>
                  <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                    {selectedDocument.reviewCommentAuthor ?? "Reviewer"}
                    {selectedDocument.reviewCommentDate ? ` · ${formatDateTime(selectedDocument.reviewCommentDate)}` : ""}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="rounded-[24px] border border-black/5 bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--muted)]">Linked audit context</p>
              <div className="mt-4 grid gap-3">
                {getLinkedContext(selectedDocument).map((item) => (
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

      <UploadDocumentModal
        open={isUploading}
        form={uploadForm}
        onClose={() => setIsUploading(false)}
        onSubmit={handleUploadDocument}
        onChange={setUploadForm}
      />

      <DocumentPreviewModal document={openedDocument} onClose={() => setOpenedDocumentId("")} />
    </div>
  );
}

function DocumentMetric({
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

function DocumentInfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-medium text-[var(--foreground)]">{value}</p>
    </div>
  );
}

function getMissingArtifacts(documentItems: AuditDocument[]) {
  return requiredArtifacts
    .map((type) => {
      const docsForType = documentItems.filter((document) => document.type === type);

      if (docsForType.length === 0) {
        return {
          title: type.replaceAll("_", " "),
          status: "MISSING",
          detail: "No artifact of this required type exists yet in the inventory.",
        };
      }

      if (docsForType.every((document) => document.status === "NOT_STARTED")) {
        return {
          title: type.replaceAll("_", " "),
          status: "NOT_STARTED",
          detail: "The artifact exists in the inventory but has not moved into active preparation.",
        };
      }

      return null;
    })
    .filter(Boolean) as Array<{ title: string; status: "MISSING" | "NOT_STARTED"; detail: string }>;
}

function getOwnerName(ownerId: string) {
  return users.find((user) => user.id === ownerId)?.name ?? ownerId;
}

function getLinkSummary(document: AuditDocument) {
  if (document.linkedControlId) {
    return `Control ${document.linkedControlId}`;
  }

  if (document.linkedQuestionId) {
    return `Question ${document.linkedQuestionId}`;
  }

  if (document.linkedRequestId) {
    return `Request ${document.linkedRequestId}`;
  }

  return "Unlinked";
}

function getLinkedContext(document: AuditDocument) {
  const items: Array<{ id: string; title: string; detail: string; status: string; tone: "warning" | "risk" | "success" }> = [];

  if (document.linkedControlId) {
    const control = controls.find((item) => item.id === document.linkedControlId);
    if (control) {
      items.push({
        id: control.id,
        title: control.name,
        detail: `${control.businessUnit} control with due date ${formatShortDate(control.dueDate)}.`,
        status: control.status,
        tone: control.status === "COMPLETE" ? "success" : control.status === "BLOCKED" ? "risk" : "warning",
      });
    }
  }

  if (document.linkedQuestionId) {
    const question = questions.find((item) => item.id === document.linkedQuestionId);
    if (question) {
      items.push({
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
      items.push({
        id: request.id,
        title: "Linked request",
        detail: request.description,
        status: request.status,
        tone: request.status === "COMPLETED" ? "success" : "warning",
      });
    }
  }

  return items;
}

function isOverdue(document: AuditDocument) {
  if (!document.dueDate) {
    return false;
  }

  return new Date(document.dueDate).getTime() < new Date(mockNow).getTime() && document.status !== "COMPLETE";
}

function DocumentPreviewModal({ document, onClose }: { document: AuditDocument | null; onClose: () => void }) {
  if (!document) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-[rgba(1,30,65,0.38)] p-4 backdrop-blur-sm">
      <div className="flex h-[min(88vh,900px)] w-full max-w-4xl flex-col rounded-[28px] border border-black/5 bg-[#f8f6f1] shadow-[0_24px_80px_rgba(1,30,65,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-black/5 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Document preview</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{document.title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{document.previewSummary ?? "Prototype document preview for demo purposes."}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-black/5 px-6 py-4">
          <StatusBadge status={document.type} tone="neutral" />
          <StatusBadge status={document.status} tone={document.status === "COMPLETE" ? "success" : document.status === "NOT_STARTED" ? "risk" : "warning"} />
          <StatusBadge status={document.reviewStatus ?? "NOT_SUBMITTED"} tone={document.reviewStatus === "APPROVED" ? "success" : "neutral"} />
          <StatusBadge status={getOwnerName(document.ownerId)} tone="neutral" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-3xl rounded-[24px] border border-black/5 bg-white p-8 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
            <div className="border-b border-dashed border-black/10 pb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{document.id}</p>
              <h3 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">{document.title}</h3>
              <p className="mt-3 text-sm leading-7 text-[var(--muted)]">
                {document.previewSummary ?? "No preview content has been attached to this prototype document yet."}
              </p>
            </div>

            <div className="mt-6 grid gap-6">
              {document.previewSections && document.previewSections.length > 0 ? (
                document.previewSections.map((section) => (
                  <section key={section.heading}>
                    <h4 className="text-lg font-semibold text-[var(--foreground)]">{section.heading}</h4>
                    <div className="mt-3 grid gap-3">
                      {section.body.map((paragraph) => (
                        <p key={paragraph} className="text-sm leading-7 text-[var(--foreground)]">
                          {paragraph}
                        </p>
                      ))}
                    </div>
                  </section>
                ))
              ) : (
                <p className="text-sm leading-7 text-[var(--foreground)]">
                  This uploaded document has been added to the prototype inventory, but no preview content has been authored for it yet.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UploadDocumentModal({
  open,
  form,
  onClose,
  onSubmit,
  onChange,
}: {
  open: boolean;
  form: {
    fileName: string;
    type: AuditDocument["type"];
    dueDate: string;
    ownerId: string;
  };
  onClose: () => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onChange: React.Dispatch<
    React.SetStateAction<{
      fileName: string;
      type: AuditDocument["type"];
      dueDate: string;
      ownerId: string;
    }>
  >;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(1,30,65,0.32)] p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[28px] border border-black/5 bg-[#fbfaf7] p-6 shadow-[0_24px_80px_rgba(1,30,65,0.22)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Upload document</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">Add a document to the inventory</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Upload a file reference, classify the document, assign an owner, and set the due date.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
          >
            <X size={18} />
          </button>
        </div>

        <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Document file</span>
            <input
              required
              type="file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                onChange((current) => ({ ...current, fileName: file?.name ?? "" }));
              }}
              className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[var(--surface-tint)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--brand-indigo-core)]"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Document type</span>
              <select
                value={form.type}
                onChange={(event) => onChange((current) => ({ ...current, type: event.target.value as AuditDocument["type"] }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {requiredArtifacts.map((type) => (
                  <option key={type} value={type}>
                    {type.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Owner</span>
              <select
                value={form.ownerId}
                onChange={(event) => onChange((current) => ({ ...current, ownerId: event.target.value }))}
                className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
              >
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Due date</span>
            <input
              required
              type="datetime-local"
              value={form.dueDate}
              onChange={(event) => onChange((current) => ({ ...current, dueDate: event.target.value }))}
              className="w-full rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-4 py-3 text-sm outline-none"
            />
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white"
            >
              Add document
            </button>
          </div>
        </form>
      </div>
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
