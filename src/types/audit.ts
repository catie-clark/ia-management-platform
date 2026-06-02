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

export type ReviewNoteStatus = "OPEN" | "CLEARED" | "CLOSED";
export type ReviewNoteAction = "RAISED" | "COMMENT" | "CLEARED" | "REOPENED" | "CLOSED";

export interface ReviewNoteEvent {
  id: string;
  action: ReviewNoteAction;
  actorName: string;
  actorUserId?: string;
  comment: string;
  createdAt: string;
}

export interface ReviewNote {
  id: string;
  auditId: string;
  documentId: string;
  status: ReviewNoteStatus;
  note: string;
  createdByName: string;
  createdByUserId?: string;
  assignedToName: string;
  assignedToUserId?: string;
  reopenCount: number;
  createdAt: string;
  clearedAt?: string;
  closedAt?: string;
  lastActivityAt: string;
  events: ReviewNoteEvent[];
}

export type ReviewStatus = "upcoming" | "active" | "complete" | "at_risk";
export type AuditPhase = "Planning" | "Fieldwork" | "Reporting";
export type ControlScopeStatus = "UNASSIGNED" | "IN_SCOPE" | "OUT_OF_SCOPE";
export type TestingMatrixAttributeResult = "PASS" | "FAIL" | "NOT_TESTED";

export interface WorkpaperContent {
  controlReference: string;
  keyControl: string;
  typeOfControl: string;
  controlFrequency: string;
  assertions: string;
  descriptionOfTestToBePerformed: string;
  totalPopulationAndSamplingUnits: string;
  populationCompletenessConsideration: string;
  sampleSizeAndSelectionProcedures: string;
  expectedDeviationTypes: string;
  documentationOfTesting: string;
  extensionOfInterimTestingToEndOfPeriod: string;
  matrixExceptionSummary: string;
  numberOfDeviationsDetected: string;
  deviationDescriptionAndCause: string;
  didDeviationsResultFromFraudOrError: string;
  wereDeviationsIsolatedOrPervasive: string;
  finalNumberOfDeviations: string;
  controlEffectivenessConclusion: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  team?: string;
  companyName?: string;
}

export interface Control {
  id: string;
  referenceId?: string;
  name: string;
  description: string;
  importedTestPlan?: string;
  businessUnit: string;
  scopeStatus: ControlScopeStatus;
  hasExplicitScopeAssignment?: boolean;
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

export interface ControlException {
  id: string;
  controlId: string;
  createdAt: string;
  createdBy: string;
  createdByUserId?: string;
  note: string;
}

export interface ControlTestingMatrixAttribute {
  id: string;
  matrixId: string;
  attributeKey: string;
  label: string;
  guidance: string;
  displayOrder: number;
}

export interface ControlTestingMatrixSample {
  id: string;
  matrixId: string;
  sampleIdentifier: string;
  sampleDescription: string;
  sourceReference: string;
  exceptionNoted: string;
  displayOrder: number;
  testedByUserId?: string;
  startedAt?: string;
  completedAt?: string;
  timeSpentMinutes?: number;
}

export interface ControlTestingMatrixResult {
  id: string;
  matrixId: string;
  sampleId: string;
  attributeId: string;
  result: TestingMatrixAttributeResult;
}

export interface ControlTestingMatrix {
  id: string;
  auditId: string;
  controlId: string;
  displayOrder: number;
  title: string;
  populationDescription: string;
  populationSize?: number;
  sampleDescription: string;
  sampleSize?: number;
  budgetedHours?: number;
  conclusion: string;
  attributes: ControlTestingMatrixAttribute[];
  samples: ControlTestingMatrixSample[];
  results: ControlTestingMatrixResult[];
  createdAt: string;
  updatedAt: string;
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
  attachment?: {
    description?: string;
    fileName: string;
    fileSizeBytes?: number;
    mimeType?: string;
    originalFileName?: string;
    storageBucket?: string;
    storagePath?: string;
    uploadedAt?: string;
    uploadedInApp?: boolean;
  };
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
