export type Role = "AIC" | "STAFF" | "MANAGER" | "DIRECTOR" | "CAE";

export type ControlStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "BLOCKED"
  | "COMPLETE";

export type DocumentReviewStatus =
  | "NOT_SUBMITTED"
  | "AIC_REVIEW"
  | "MANAGER_REVIEW"
  | "DIRECTOR_REVIEW"
  | "APPROVED";

export type AuditFindingStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "READY_FOR_REPORT"
  | "FINALIZED"
  | "CLOSED";

export type ReportArtifactKey = "FINAL_REPORT" | "REPORTING_TOLLGATE";
export type ReportReviewStageStatus = "PENDING" | "ACTIVE" | "APPROVED" | "SENT_BACK";
export type ReportReviewCommentStatus = "OPEN" | "RESOLVED";

export type ReviewStatus = "upcoming" | "active" | "complete" | "at_risk";
export type AuditPhase = "Planning" | "Fieldwork" | "Reporting";
export type ControlScopeStatus = "IN_SCOPE" | "OUT_OF_SCOPE";

export interface WorkpaperContent {
  summary: string;
  objective: string;
  scope: string;
  procedures: string;
  results: string;
  conclusion: string;
  nextSteps: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team?: string;
}

export interface Control {
  id: string;
  referenceId?: string;
  name: string;
  description: string;
  businessUnit: string;
  scopeStatus: ControlScopeStatus;
  ownerId: string;
  importedOwnerId?: string;
  assignedOwnerId?: string;
  status: ControlStatus;
  dueDate?: string;
  importedDueDate?: string;
  assignedDueDate?: string;
  completedDate?: string;
  plannedHours: number;
  importedPlannedHours?: number;
  assignedPlannedHours?: number;
  actualHours: number;
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  relatedRisks?: Array<{
    id: string;
    statement: string;
  }>;
  reviewStageOwner?: string;
  narrative?: string;
  hasPlanningOverride?: boolean;
  planningOverriddenAt?: string;
}

export interface Question {
  id: string;
  displayId?: string;
  controlId: string;
  phaseTag?: AuditPhase;
  parentQuestionId?: string;
  parentRequestId?: string;
  askedBy: string;
  assignedTo: string;
  dateSent: string;
  dueDate: string;
  status: "OPEN" | "RESPONDED" | "OVERDUE";
  questionText: string;
  responseText?: string;
  responseDate?: string;
}

export interface Request {
  id: string;
  displayId?: string;
  controlId?: string;
  phaseTag?: AuditPhase;
  parentQuestionId?: string;
  parentRequestId?: string;
  description: string;
  assignedTo: string;
  dateRequested: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  completedAt?: string;
  receivedDate?: string;
  responseNotes?: string;
}

export interface AuditDocument {
  id: string;
  displayId?: string;
  type: "WORKPAPER" | "EVIDENCE" | "REPORT" | "TOLLGATE" | "PLANNING_NARRATIVE" | "PLANNING_TOLLGATE" | "FIELDWORK_TOLLGATE";
  artifactKey?: ReportArtifactKey;
  title: string;
  linkedControlId?: string;
  linkedQuestionId?: string;
  linkedRequestId?: string;
  status: "NOT_STARTED" | "IN_PROGRESS" | "COMPLETE";
  reviewStatus?: DocumentReviewStatus;
  ownerId: string;
  dueDate?: string;
  templateName?: string;
  reviewComment?: string;
  reviewCommentAuthor?: string;
  reviewCommentDate?: string;
  previewSummary?: string;
  previewSections?: Array<{
    heading: string;
    body: string[];
  }>;
  workpaperContent?: WorkpaperContent;
  generatedMarkdown?: string;
  updatedAt?: string;
}

export interface AuditFinding {
  id: string;
  auditId?: string;
  displayId?: string;
  linkedControlId?: string;
  title: string;
  summary: string;
  severity: "LOW" | "MEDIUM" | "HIGH";
  status: AuditFindingStatus;
  ownerId?: string;
  dueDate?: string;
  impactStatement?: string;
  recommendation?: string;
  managementResponse?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportReviewStage {
  id: string;
  artifactKey: ReportArtifactKey;
  stageOrder: number;
  reviewerRole: Role;
  status: ReportReviewStageStatus;
  actedAt?: string;
  actedByName?: string;
  actionComment?: string;
}

export interface ReportReviewComment {
  id: string;
  artifactKey: ReportArtifactKey;
  reviewStageId?: string;
  authorRole: Role;
  authorName: string;
  comment: string;
  status: ReportReviewCommentStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedByName?: string;
}

export interface PlanningSourceSet {
  id: string;
  sourceType:
    | "THIRD_PARTY"
    | "APPLICATION"
    | "OUTSTANDING_ISSUE"
    | "RCSA"
    | "CONTINUOUS_MONITORING"
    | "PRIOR_FINDING"
    | "NEWS"
    | "REGULATORY_UPDATE";
  title: string;
  summary: string;
  sourceSystem: string;
  lastUpdated: string;
  dataKind: "DATA_FEED" | "SYSTEM_EXPORT" | "TRACKER" | "MEMO" | "DECK" | "ASSESSMENT" | "ARTICLE";
  artifactName: string;
  owner: string;
  refreshCadence: "REAL_TIME" | "DAILY" | "WEEKLY" | "MONTHLY" | "QUARTERLY" | "AD_HOC";
  planningUse: string;
  sampleDetails: string[];
  keyFields: string[];
}

export interface RCSARecord {
  id: string;
  businessUnit: string;
  riskStatement: string;
  keyControls: string[];
  residualRiskRating: "LOW" | "MEDIUM" | "HIGH";
  lastReviewed: string;
}

export interface TimelineItem {
  id: string;
  label: string;
  date: string;
  status: ReviewStatus;
}

export interface KPIProps {
  title: string;
  value: string | number;
  status: "normal" | "warning" | "risk";
  subtitle?: string;
  delta?: string;
}

export interface RiskRow {
  id: string;
  area: "Control" | "Question" | "Request" | "Document";
  title: string;
  owner: string;
  status: string;
  trigger: string;
  dueDate?: string;
  severity: "warning" | "risk";
}

export interface BudgetByPhase {
  phase: "Planning" | "Fieldwork" | "Reporting";
  plannedHours: number;
  actualHours: number;
  isSet?: boolean;
}

export type ExternalTimeSource = "Recorded";

export interface DemoTimeEntry {
  id: string;
  controlId: string;
  userId: string;
  phase: AuditPhase;
  source: ExternalTimeSource;
  hours: number;
  entryDate: string;
  workItemReference: string;
}

export interface TimeSourceSummary {
  source: ExternalTimeSource;
  entryCount: number;
  totalHours: number;
}

export interface PhaseSpotlightCard {
  title: string;
  value: string | number;
  status: "normal" | "warning" | "risk";
  detail: string;
}

export interface PhaseSpotlight {
  eyebrow: string;
  title: string;
  description: string;
  cards: PhaseSpotlightCard[];
}
