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

export type ReviewStatus = "upcoming" | "active" | "complete" | "at_risk";
export type AuditPhase = "Planning" | "Fieldwork" | "Reporting";

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
  controlId: string;
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
  controlId?: string;
  description: string;
  assignedTo: string;
  dateRequested: string;
  dueDate: string;
  status: "OPEN" | "IN_PROGRESS" | "COMPLETED";
  receivedDate?: string;
  responseNotes?: string;
}

export interface AuditDocument {
  id: string;
  type: "WORKPAPER" | "EVIDENCE" | "REPORT" | "TOLLGATE" | "PLANNING_NARRATIVE";
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

export type ExternalTimeSource = "Workday";

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
