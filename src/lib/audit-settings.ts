import type { DocumentReviewStatus } from "@/types/audit";

export const reviewWorkflowStages: DocumentReviewStatus[] = [
  "NOT_SUBMITTED",
  "AIC_REVIEW",
  "MANAGER_REVIEW",
  "DIRECTOR_REVIEW",
  "APPROVED",
];

export type ReviewWorkflowStageLabels = Record<DocumentReviewStatus, string>;

export type AuditWorkspaceSettings = {
  reviewWorkflowStageLabels: ReviewWorkflowStageLabels;
  showControlBudgetHours: boolean;
};

export const defaultReviewWorkflowStageLabels: ReviewWorkflowStageLabels = {
  NOT_SUBMITTED: "Not submitted",
  AIC_REVIEW: "AIC review",
  MANAGER_REVIEW: "Manager review",
  DIRECTOR_REVIEW: "Director review",
  APPROVED: "Approved",
};

export const defaultAuditWorkspaceSettings: AuditWorkspaceSettings = {
  showControlBudgetHours: true,
  reviewWorkflowStageLabels: defaultReviewWorkflowStageLabels,
};

export function normalizeAuditWorkspaceSettings(
  value: Record<string, unknown> | null | undefined,
): AuditWorkspaceSettings {
  return {
    showControlBudgetHours:
      typeof value?.showControlBudgetHours === "boolean"
        ? value.showControlBudgetHours
        : defaultAuditWorkspaceSettings.showControlBudgetHours,
    reviewWorkflowStageLabels: normalizeReviewWorkflowStageLabels(value?.reviewWorkflowStageLabels),
  };
}

export function formatReviewWorkflowStageLabel(
  stage: DocumentReviewStatus,
  settings?: Pick<AuditWorkspaceSettings, "reviewWorkflowStageLabels"> | null,
) {
  return settings?.reviewWorkflowStageLabels?.[stage] ?? defaultReviewWorkflowStageLabels[stage];
}

function normalizeReviewWorkflowStageLabels(value: unknown): ReviewWorkflowStageLabels {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return reviewWorkflowStages.reduce<ReviewWorkflowStageLabels>((labels, stage) => {
    const candidate = source[stage];
    labels[stage] =
      typeof candidate === "string" && candidate.trim().length > 0 ? candidate.trim() : defaultReviewWorkflowStageLabels[stage];
    return labels;
  }, { ...defaultReviewWorkflowStageLabels });
}
