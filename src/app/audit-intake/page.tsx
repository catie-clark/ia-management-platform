"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SetStateAction,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowUpRight, CheckCircle2, ChevronDown, FolderOpen, Lock, Plus, Search, Upload, X } from "lucide-react";

import { DEFAULT_COMPANY_NAME } from "@/lib/company";

// ── Types ─────────────────────────────────────────────────────────────────────

type UploadRequirement = {
  id:
    | "controls"
    | "rcm"
    | "questions"
    | "requests"
    | "documents"
    | "applications"
    | "users"
    | "thirdParties"
    | "risks"
    | "riskControlLinks"
    | "rcsaRecords"
    | "issues"
    | "monitoringResults"
    | "priorAuditFindings";
  label: string;
  description: string;
  helpText: string;
  accept: string;
  required: boolean;
  category: "core" | "workflow" | "advanced";
  sourceEntity:
    | "controls"
    | "rcm"
    | "questions"
    | "requests"
    | "documents"
    | "applications"
    | "users"
    | "third_parties"
    | "risks"
    | "risk_control_links"
    | "rcsa_records"
    | "issues"
    | "monitoring_results"
    | "prior_audit_findings";
  keywords: string[];
};

type UploadMode = "guided" | "folder";

type AuditForm = {
  auditName: string;
  auditPeriodStart: string;
  auditPeriodEnd: string;
  scopePeriodStart: string;
  scopePeriodEnd: string;
  totalBudgetHours: string;
  importSourceAuditId: string;
};

type UploadedFiles = Record<UploadRequirement["id"], File | null>;

type AuditApiItem = {
  id: string;
  name: string;
  company_name?: string | null;
  period_start: string;
  period_end: string;
  scope_period_start?: string | null;
  scope_period_end?: string | null;
  total_budget_hours?: number | null;
  planning_budget_hours?: number | null;
  fieldwork_budget_hours?: number | null;
  reporting_budget_hours?: number | null;
  status: string;
  active_phase: string;
  created_at?: string;
};

type AuditWorkspaceRow = {
  id: string;
  name: string;
  companyName: string;
  scopePeriod: string;
  auditTimeframe: string;
  activePhase: string;
  status: string;
  budget: string;
  createdAt: string;
  dashboardUrl: string;
  totalBudgetHours: number | null;
  planningBudgetHours: number | null;
  fieldworkBudgetHours: number | null;
  reportingBudgetHours: number | null;
};

type LockedAuditRow = {
  id: string;
  name: string;
  companyName: string;
  scopePeriod: string;
  auditTimeframe: string;
  activePhase: string;
  status: string;
  budget: string;
};

const LOCKED_AUDIT_ROWS: LockedAuditRow[] = [
  {
    id: "locked-1",
    name: "FY2024 IT General Controls Audit",
    companyName: "First National Corp",
    scopePeriod: "Jan 1, 2024 – Dec 31, 2024",
    auditTimeframe: "Feb 3, 2025 – Apr 18, 2025",
    activePhase: "Reporting",
    status: "completed",
    budget: "320h",
  },
  {
    id: "locked-2",
    name: "Q3 SOX ITGC Control Testing",
    companyName: "Meridian Financial Group",
    scopePeriod: "Jul 1, 2024 – Sep 30, 2024",
    auditTimeframe: "Oct 14, 2024 – Dec 6, 2024",
    activePhase: "Reporting",
    status: "completed",
    budget: "210h",
  },
  {
    id: "locked-3",
    name: "Annual Cybersecurity Controls Review",
    companyName: "Hartwell Industries",
    scopePeriod: "Jan 1, 2024 – Dec 31, 2024",
    auditTimeframe: "Jan 20, 2025 – Mar 28, 2025",
    activePhase: "Fieldwork",
    status: "active",
    budget: "275h",
  },
  {
    id: "locked-4",
    name: "ITGC Readiness Assessment",
    companyName: "Summit Healthcare Systems",
    scopePeriod: "Jan 1, 2025 – Jun 30, 2025",
    auditTimeframe: "May 5, 2025 – Jun 20, 2025",
    activePhase: "Planning",
    status: "active",
    budget: "180h",
  },
  {
    id: "locked-5",
    name: "Third-Party Risk Controls Audit",
    companyName: "Lakeview Capital Partners",
    scopePeriod: "Jul 1, 2024 – Dec 31, 2024",
    auditTimeframe: "Jan 8, 2025 – Feb 21, 2025",
    activePhase: "Reporting",
    status: "completed",
    budget: "155h",
  },
  {
    id: "locked-6",
    name: "SOC 2 Readiness & Controls Gap Review",
    companyName: "Veridian Technologies",
    scopePeriod: "Jan 1, 2025 – Dec 31, 2025",
    auditTimeframe: "Mar 3, 2025 – May 9, 2025",
    activePhase: "Fieldwork",
    status: "active",
    budget: "240h",
  },
];

type FolderMappedFile = {
  id: string;
  file: File;
  suggestedTarget: UploadRequirement["id"] | null;
  assignedTarget: UploadRequirement["id"] | null;
  suggestionScore: number;
  suggestionReason: string[];
  relativePath: string;
};

type SavedImportSummary = {
  auditId?: string;
  batchId: string;
  status: string;
  rowCount: number;
  fileCount: number;
  totalBudgetHours?: number | null;
  parseErrors: Array<{
    fileName: string;
    fieldName: UploadRequirement["id"];
    message: string;
  }>;
  transformSummary?: {
    businessUnitsUpserted: number;
    usersUpserted: number;
    controlsUpserted: number;
    riskControlLinksUpserted: number;
    questionsUpserted: number;
    requestsUpserted: number;
    documentsUpserted: number;
    rowsValidated: number;
  };
};

type StageFilter = "all" | "planning" | "fieldwork" | "reporting";

// ── Upload requirements data ──────────────────────────────────────────────────

const uploadRequirements: UploadRequirement[] = [
  {
    id: "controls",
    label: "Controls dataset",
    description:
      "Primary control population for the audit. This file defines which controls are in scope for the workspace.",
    helpText:
      "Expected examples: controls export, scope list, test population, or Archer control inventory.",
    accept: ".csv",
    required: true,
    category: "core",
    sourceEntity: "controls",
    keywords: [
      "control",
      "controls",
      "control inventory",
      "control population",
      "control list",
      "control universe",
      "scope",
      "scope list",
      "scoped controls",
      "population",
      "test population",
      "testing",
      "control testing",
      "archer",
    ],
  },
  {
    id: "rcm",
    label: "RCM workbook",
    description:
      "Optional risk control matrix workbook used to pre-populate testing matrices and testing workpapers for imported controls.",
    helpText:
      "Expected examples: RCM workbook, risk control matrix, control test plan workbook. The workbook must include an `RCM` worksheet.",
    accept: ".xlsx",
    required: false,
    category: "core",
    sourceEntity: "rcm",
    keywords: [
      "rcm",
      "risk control matrix",
      "risk-control-matrix",
      "control matrix",
      "testing matrix",
      "test plan",
      "test steps",
      "rcm workbook",
      "workbook",
    ],
  },
  {
    id: "questions",
    label: "Question log dataset",
    description:
      "Optional auditor questions or inquiry tracking so the question log can load from imported data.",
    helpText: "Expected examples: questions, inquiries, auditor asks, response tracker.",
    accept: ".csv",
    required: false,
    category: "workflow",
    sourceEntity: "questions",
    keywords: [
      "question",
      "questions",
      "inquiry",
      "inquiries",
      "ask",
      "asks",
      "issue log",
      "qlog",
      "query",
    ],
  },
  {
    id: "requests",
    label: "Request log dataset",
    description:
      "Optional PBC, evidence, or request tracker data for the request management workflow.",
    helpText: "Expected examples: requests, pbc, evidence request, fulfillment tracker.",
    accept: ".csv",
    required: false,
    category: "workflow",
    sourceEntity: "requests",
    keywords: [
      "request",
      "requests",
      "pbc",
      "provided by client",
      "evidence",
      "evidence request",
      "fulfillment",
      "supporting request",
      "support request",
    ],
  },
  {
    id: "applications",
    label: "Applications reference data",
    description:
      "Optional application inventory to connect controls and issues to systems in scope.",
    helpText: "Expected examples: applications, app inventory, system catalog.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "applications",
    keywords: [
      "application",
      "applications",
      "app",
      "app inventory",
      "system",
      "systems",
      "system inventory",
      "inventory",
      "catalog",
    ],
  },
  {
    id: "users",
    label: "Users directory data",
    description:
      "Optional user roster to seed audit participants, owners, and request contacts before other datasets are transformed.",
    helpText:
      "Expected examples: users, user directory, personnel, audit team roster, employee contacts.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "users",
    keywords: [
      "user",
      "users",
      "user directory",
      "directory",
      "personnel",
      "employee",
      "employees",
      "roster",
      "contact",
      "contacts",
      "team",
      "owner",
      "owners",
    ],
  },
  {
    id: "thirdParties",
    label: "Third-party reference data",
    description:
      "Optional vendor or service-provider inventory for third-party and outsourced control context.",
    helpText: "Expected examples: third parties, vendors, service providers, supplier inventory.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "third_parties",
    keywords: [
      "thirdparty",
      "third party",
      "third_party",
      "vendor",
      "vendors",
      "supplier",
      "suppliers",
      "provider",
      "providers",
      "service provider",
      "service providers",
    ],
  },
  {
    id: "risks",
    label: "Risk register data",
    description:
      "Optional risk register export to relate control coverage to the underlying risk landscape.",
    helpText: "Expected examples: risks, risk register, inherent risk, residual risk.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "risks",
    keywords: ["risk", "risks", "risk register", "riskregister", "inherent", "residual"],
  },
  {
    id: "riskControlLinks",
    label: "Risk-to-control mapping",
    description:
      "Maps risk records to the controls they are mitigated by so the platform can load explicit risk-control relationships.",
    helpText:
      "Expected examples: risk-to-control, risk_control_mapping, risk control links, risk control matrix.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "risk_control_links",
    keywords: [
      "riskcontrol",
      "risk control",
      "risk_control",
      "risk to control",
      "risktocontrol",
      "risk control mapping",
      "control mapping",
      "risk control links",
      "risk control matrix",
      "controlmatrix",
      "mitigates",
      "mitigation mapping",
    ],
  },
  {
    id: "rcsaRecords",
    label: "RCSA data",
    description:
      "Optional RCSA outputs that can support planning, scoping, and coverage decisions.",
    helpText: "Expected examples: rcsa, self assessment, risk control self assessment.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "rcsa_records",
    keywords: [
      "rcsa",
      "self assessment",
      "selfassessment",
      "risk control self assessment",
      "riskcontrolselfassessment",
      "control self assessment",
    ],
  },
  {
    id: "issues",
    label: "Issue tracker data",
    description:
      "Optional issue or remediation data to provide current problem and action-plan context.",
    helpText: "Expected examples: issues, findings tracker, remediation, open actions.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "issues",
    keywords: [
      "issue",
      "issues",
      "finding",
      "findings",
      "remediation",
      "action",
      "actions",
      "tracker",
      "issue tracker",
      "remediation tracker",
    ],
  },
  {
    id: "monitoringResults",
    label: "Monitoring results data",
    description:
      "Optional monitoring or exception data to support trend analysis and ongoing control performance.",
    helpText:
      "Expected examples: monitoring, exceptions, continuous monitoring, run results.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "monitoring_results",
    keywords: [
      "monitoring",
      "monitoring results",
      "exception",
      "exceptions",
      "results",
      "continuous",
      "continuous monitoring",
      "run",
      "run results",
    ],
  },
  {
    id: "priorAuditFindings",
    label: "Prior audit findings",
    description:
      "Optional historical findings to support repeat-issue analysis and planning decisions.",
    helpText:
      "Expected examples: prior findings, historical audit issues, open audit actions.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "prior_audit_findings",
    keywords: [
      "prior audit",
      "prior audits",
      "prioraudit",
      "prior finding",
      "prior findings",
      "priorfinding",
      "audit finding",
      "audit findings",
      "auditfinding",
      "historical finding",
      "historical findings",
      "historicalfinding",
      "legacy findings",
      "repeat issue",
      "repeat issues",
    ],
  },
];

const emptyUploadedFiles: UploadedFiles = {
  controls: null,
  rcm: null,
  questions: null,
  requests: null,
  documents: null,
  applications: null,
  users: null,
  thirdParties: null,
  risks: null,
  riskControlLinks: null,
  rcsaRecords: null,
  issues: null,
  monitoringResults: null,
  priorAuditFindings: null,
};

const emptyAuditForm: AuditForm = {
  auditName: "",
  auditPeriodStart: "",
  auditPeriodEnd: "",
  scopePeriodStart: "",
  scopePeriodEnd: "",
  totalBudgetHours: "",
  importSourceAuditId: "",
};

const STAGE_FILTERS: { value: StageFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "planning", label: "Planning" },
  { value: "fieldwork", label: "Fieldwork" },
  { value: "reporting", label: "Reporting" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRequiredUploadRequirementIds(files: UploadedFiles): UploadRequirement["id"][] {
  const requiredIds: UploadRequirement["id"][] = ["controls"];
  if (files.risks) requiredIds.push("riskControlLinks");
  return requiredIds;
}

function mapApiItemToRow(audit: AuditApiItem, persona?: string | null): AuditWorkspaceRow {
  const scopeStart = audit.scope_period_start ?? audit.period_start;
  const scopeEnd = audit.scope_period_end ?? audit.period_end;
  const companyName = audit.company_name ?? DEFAULT_COMPANY_NAME;
  const scopePeriodLabel = `${formatDate(scopeStart)} – ${formatDate(scopeEnd)}`;

  const params = new URLSearchParams({
    mode: "live",
    auditId: audit.id,
    auditLabel: audit.name,
    companyName,
    scopePeriodLabel,
  });

  if (persona === "manager" || persona === "staff") {
    params.set("persona", persona);
  }

  return {
    id: audit.id,
    name: audit.name,
    companyName,
    scopePeriod: scopePeriodLabel,
    auditTimeframe: `${formatDate(audit.period_start)} – ${formatDate(audit.period_end)}`,
    activePhase: audit.active_phase ?? "",
    status: audit.status ?? "",
    budget: audit.total_budget_hours != null ? `${audit.total_budget_hours}h` : "Not set",
    createdAt: audit.created_at ?? "",
    dashboardUrl: `/dashboard?${params.toString()}`,
    totalBudgetHours: audit.total_budget_hours ?? null,
    planningBudgetHours: audit.planning_budget_hours ?? null,
    fieldworkBudgetHours: audit.fieldwork_budget_hours ?? null,
    reportingBudgetHours: audit.reporting_budget_hours ?? null,
  };
}

function formatDate(value: string | null | undefined) {
  if (!value) return "";
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatBudgetInput(value: number) {
  return Number.isInteger(value) ? String(value) : value.toString();
}

function formatBudgetPreview(value: number | null) {
  return value === null ? "Not set" : `${formatBudgetInput(value)}h`;
}

function normalizeValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function tokenizeValue(value: string) {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/g)
    .map((t) => t.trim())
    .filter(Boolean);
}

function matchesKeywordSignal(
  normalizedSearchableText: string,
  searchableTokens: string[],
  keyword: string,
) {
  const normalizedKeyword = normalizeValue(keyword);
  if (normalizedKeyword.length === 0) return false;
  if (normalizedSearchableText.includes(normalizedKeyword)) return true;
  const keywordTokens = tokenizeValue(keyword);
  return keywordTokens.length > 1 && keywordTokens.every((t) => searchableTokens.includes(t));
}

function getRelativePath(file: File) {
  return "webkitRelativePath" in file &&
    typeof file.webkitRelativePath === "string" &&
    file.webkitRelativePath.length > 0
    ? file.webkitRelativePath
    : file.name;
}

function getKeywordWeight(keyword: string) {
  const k = normalizeValue(keyword);
  const highWeightKeys = new Set([
    "controls",
    "controlinventory",
    "controlpopulation",
    "riskcontrol",
    "riskcontrolmapping",
    "riskcontrollinks",
    "questions",
    "requests",
    "documents",
    "applications",
    "risks",
    "issues",
    "prioraudit",
    "priorfindings",
    "priorauditfindings",
    "auditfindings",
  ]);
  return highWeightKeys.has(k) ? 3 : 1;
}

function inferUploadTarget(file: File) {
  const searchableText = `${file.name} ${getRelativePath(file)}`.trim();
  const normalizedSearchableText = normalizeValue(searchableText);
  const searchableTokens = tokenizeValue(searchableText);
  let bestMatch: UploadRequirement["id"] | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const requirement of uploadRequirements) {
    const matchedKeywords = requirement.keywords.filter((keyword) =>
      matchesKeywordSignal(normalizedSearchableText, searchableTokens, keyword),
    );
    const score = matchedKeywords.reduce((total, keyword) => total + getKeywordWeight(keyword), 0);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = requirement.id;
      bestReasons = matchedKeywords;
    }
  }

  return { target: bestScore > 0 ? bestMatch : null, score: bestScore, reasons: bestReasons };
}

function createFolderMappedFiles(files: File[]): FolderMappedFile[] {
  const nextAssignments = new Set<UploadRequirement["id"]>();

  return files.map((file, index) => {
    const suggestion = inferUploadTarget(file);
    const relativePath = getRelativePath(file);
    const assignedTarget =
      suggestion.target && !nextAssignments.has(suggestion.target) ? suggestion.target : null;
    if (assignedTarget) nextAssignments.add(assignedTarget);

    return {
      id: `${normalizeValue(relativePath || file.name)}-${index}`,
      file,
      suggestedTarget: suggestion.target,
      assignedTarget,
      suggestionScore: suggestion.score,
      suggestionReason: suggestion.reasons,
      relativePath,
    };
  });
}

function buildUploadedFilesFromMappedFiles(mappedFiles: FolderMappedFile[]): UploadedFiles {
  const nextFiles: UploadedFiles = { ...emptyUploadedFiles };
  for (const requirement of uploadRequirements) {
    const matchedFile = mappedFiles.find((item) => item.assignedTarget === requirement.id);
    nextFiles[requirement.id] = matchedFile?.file ?? null;
  }
  return nextFiles;
}

function getRequirementLabel(requirementId: UploadRequirement["id"]) {
  return uploadRequirements.find((item) => item.id === requirementId)?.label ?? requirementId;
}

// ── Persona data ──────────────────────────────────────────────────────────────

const PERSONAS = {
  manager: {
    name: "Elena Martin",
    role: "Manager",
    initials: "EM",
    accent: "amber" as const,
  },
  staff: {
    name: "Priya Shah",
    role: "Audit Staff",
    initials: "PS",
    accent: "teal" as const,
  },
} as const;

function PersonaProfileInner() {
  const params = useSearchParams();
  const roleParam = params.get("role");
  const persona = roleParam === "manager" ? PERSONAS.manager : roleParam === "staff" ? PERSONAS.staff : null;

  if (!persona) return null;

  const isAmber = persona.accent === "amber";

  return (
    <Link
      href="/demo-login"
      className="group flex items-center gap-2.5 rounded-full border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] py-1.5 pl-1.5 pr-3.5 text-white transition-colors hover:bg-[rgba(255,255,255,0.14)]"
      title="Switch persona"
    >
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
          isAmber
            ? "bg-[var(--brand-amber-core)] text-[var(--brand-indigo-dark)]"
            : "bg-[var(--brand-teal-core)] text-white"
        }`}
      >
        {persona.initials}
      </span>
      <div className="hidden sm:block">
        <p className="text-xs font-semibold leading-none text-white">{persona.name}</p>
        <p className="mt-0.5 text-[10px] leading-none text-white/60">{persona.role}</p>
      </div>
      <ChevronDown size={13} className="shrink-0 text-white/50 transition-transform duration-150 group-hover:rotate-180" />
    </Link>
  );
}

function PersonaProfile() {
  return (
    <Suspense fallback={null}>
      <PersonaProfileInner />
    </Suspense>
  );
}

function ManagerAddButtonInner({ onAdd }: { onAdd: () => void }) {
  const role = useSearchParams().get("role");
  if (role === "staff") return null;
  return (
    <button
      type="button"
      onClick={onAdd}
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(245,168,0,0.28)] bg-[var(--brand-amber-core)] px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-indigo-dark)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[var(--brand-amber-bright)]"
    >
      <Plus size={15} />
      Add new audit workspace
    </button>
  );
}

function ManagerAddButton({ onAdd }: { onAdd: () => void }) {
  return (
    <Suspense fallback={null}>
      <ManagerAddButtonInner onAdd={onAdd} />
    </Suspense>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AuditWorkspacePage() {
  return (
    <Suspense fallback={<AuditWorkspacePageSkeleton />}>
      <AuditWorkspacePageInner />
    </Suspense>
  );
}

function AuditWorkspacePageSkeleton() {
  return (
    <div className="min-h-screen bg-[var(--background)]">
      <header className="border-b border-[rgba(255,255,255,0.08)] bg-[var(--brand-indigo-dark)]">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="h-6 w-28 rounded bg-white/10" />
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
        <SkeletonTable />
      </main>
    </div>
  );
}

function AuditWorkspacePageInner() {
  const searchParams = useSearchParams();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<AuditWorkspaceRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<StageFilter>("all");
  const [successMessage, setSuccessMessage] = useState("");

  // Modal state
  const [auditForm, setAuditForm] = useState<AuditForm>(emptyAuditForm);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>(emptyUploadedFiles);
  const [uploadMode, setUploadMode] = useState<UploadMode>("guided");
  const [folderMappedFiles, setFolderMappedFiles] = useState<FolderMappedFile[]>([]);
  const [isSavingAudit, setIsSavingAudit] = useState(false);
  const [saveError, setSaveError] = useState("");

  const requiredRequirementIds = useMemo(
    () => getRequiredUploadRequirementIds(uploadedFiles),
    [uploadedFiles],
  );
  const missingRequiredRequirementIds = requiredRequirementIds.filter(
    (id) => uploadedFiles[id] === null,
  );
  const requiredFilesSelected = missingRequiredRequirementIds.length === 0;

  const hasValidAuditPeriod =
    auditForm.auditPeriodStart.length > 0 &&
    auditForm.auditPeriodEnd.length > 0 &&
    auditForm.auditPeriodStart <= auditForm.auditPeriodEnd;
  const hasValidScopePeriod =
    auditForm.scopePeriodStart.length > 0 &&
    auditForm.scopePeriodEnd.length > 0 &&
    auditForm.scopePeriodStart <= auditForm.scopePeriodEnd;
  const hasValidTotalBudget =
    auditForm.totalBudgetHours.trim().length === 0 ||
    (Number.isFinite(Number(auditForm.totalBudgetHours)) &&
      Number(auditForm.totalBudgetHours) >= 0);
  const canCreateAudit =
    auditForm.auditName.trim().length > 0 &&
    hasValidAuditPeriod &&
    hasValidScopePeriod &&
    hasValidTotalBudget &&
    requiredFilesSelected;

  const filteredRows = useMemo(() => {
    return auditRows.filter((row) => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        q === "" ||
        row.name.toLowerCase().includes(q) ||
        row.companyName.toLowerCase().includes(q);
      const matchesStage =
        stageFilter === "all" || row.activePhase.toLowerCase() === stageFilter;
      return matchesSearch && matchesStage;
    });
  }, [auditRows, searchQuery, stageFilter]);

  const counts = useMemo(
    () => ({
      active: auditRows.length + LOCKED_AUDIT_ROWS.length,
      planning:
        auditRows.filter((r) => r.activePhase.toLowerCase() === "planning").length +
        LOCKED_AUDIT_ROWS.filter((r) => r.activePhase.toLowerCase() === "planning").length,
      fieldwork:
        auditRows.filter((r) => r.activePhase.toLowerCase() === "fieldwork").length +
        LOCKED_AUDIT_ROWS.filter((r) => r.activePhase.toLowerCase() === "fieldwork").length,
      reporting:
        auditRows.filter((r) => r.activePhase.toLowerCase() === "reporting").length +
        LOCKED_AUDIT_ROWS.filter((r) => r.activePhase.toLowerCase() === "reporting").length,
    }),
    [auditRows],
  );

  useEffect(() => {
    void loadAudits();
  }, []);

  async function loadAudits() {
    setIsLoading(true);
    setLoadError("");
    try {
      const response = await fetch("/api/audits", { cache: "no-store" });
      const payload = (await response.json()) as AuditApiItem[] | { error?: string };

      if (!response.ok || !Array.isArray(payload)) {
        throw new Error(
          !Array.isArray(payload) && "error" in payload
            ? (payload.error ?? "Failed to load audits.")
            : "Failed to load audits.",
        );
      }
      setAuditRows(payload.map((audit) => mapApiItemToRow(audit, searchParams.get("role"))));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load audits.");
    } finally {
      setIsLoading(false);
    }
  }

  function openModal() {
    setAuditForm(emptyAuditForm);
    setUploadedFiles(emptyUploadedFiles);
    setFolderMappedFiles([]);
    setUploadMode("guided");
    setSaveError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    if (isSavingAudit) return;
    setIsModalOpen(false);
  }

  function handleUploadModeChange(nextMode: UploadMode) {
    setUploadMode(nextMode);
    setSaveError("");
  }

  function handleFileChange(
    fileType: UploadRequirement["id"],
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0] ?? null;
    setUploadedFiles((current) => ({ ...current, [fileType]: file }));

    if (file) {
      setFolderMappedFiles((current) =>
        current.map((item) =>
          item.assignedTarget === fileType ? { ...item, assignedTarget: null } : item,
        ),
      );
    }
  }

  function handleFolderFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => {
      const n = file.name.toLowerCase();
      return n.endsWith(".csv") || n.endsWith(".xlsx");
    });
    const mappedFiles = createFolderMappedFiles(selectedFiles);
    setFolderMappedFiles(mappedFiles);
    setUploadedFiles(buildUploadedFilesFromMappedFiles(mappedFiles));
  }

  function handleMappedFileTargetChange(
    fileId: string,
    nextTarget: UploadRequirement["id"] | "",
  ) {
    const normalizedTarget = nextTarget || null;
    const targetAlreadyUsed = normalizedTarget
      ? folderMappedFiles.some(
          (item) => item.id !== fileId && item.assignedTarget === normalizedTarget,
        )
      : false;
    if (targetAlreadyUsed) return;

    const nextMappedFiles = folderMappedFiles.map((item) =>
      item.id === fileId ? { ...item, assignedTarget: normalizedTarget } : item,
    );
    setFolderMappedFiles(nextMappedFiles);
    setUploadedFiles(buildUploadedFilesFromMappedFiles(nextMappedFiles));
  }

  function handleImportSourceAuditChange(nextAuditId: string) {
    const selectedAudit = auditRows.find((row) => row.id === nextAuditId) ?? null;
    setAuditForm((current) => ({
      ...current,
      importSourceAuditId: nextAuditId,
      totalBudgetHours:
        selectedAudit?.totalBudgetHours != null
          ? formatBudgetInput(selectedAudit.totalBudgetHours)
          : "",
    }));
  }

  async function handleCreateAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canCreateAudit || isSavingAudit) return;

    setIsSavingAudit(true);
    setSaveError("");

    try {
      const formData = new FormData();
      formData.append("auditName", auditForm.auditName.trim());
      formData.append("auditPeriodStart", auditForm.auditPeriodStart);
      formData.append("auditPeriodEnd", auditForm.auditPeriodEnd);
      formData.append("scopePeriodStart", auditForm.scopePeriodStart);
      formData.append("scopePeriodEnd", auditForm.scopePeriodEnd);
      formData.append("totalBudgetHours", auditForm.totalBudgetHours.trim());
      formData.append("importSourceAuditId", auditForm.importSourceAuditId);
      formData.append("sourceSystem", "archer");

      for (const requirement of uploadRequirements) {
        const file = uploadedFiles[requirement.id];
        if (file) {
          formData.append(requirement.id, file);
          formData.append(`sourceEntity_${requirement.id}`, requirement.sourceEntity);
        }
      }

      const response = await fetch("/api/imports/csv", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as SavedImportSummary | { error?: string };

      if (!response.ok) {
        throw new Error("error" in payload ? (payload.error ?? "The CSV upload failed.") : "The CSV upload failed.");
      }

      const uploadSummary = payload as SavedImportSummary;
      const transformResponse = await fetch(
        `/api/imports/${uploadSummary.batchId}/transform`,
        { method: "POST" },
      );
      const transformPayload = (await transformResponse.json()) as
        | { auditId?: string; summary?: SavedImportSummary["transformSummary"]; error?: string }
        | undefined;

      if (!transformResponse.ok) {
        throw new Error(transformPayload?.error ?? "The transformation step failed.");
      }

      const auditId = transformPayload?.auditId;
      if (!auditId) {
        throw new Error("The import completed without returning an audit id.");
      }

      setIsModalOpen(false);
      setSuccessMessage("Audit workspace created.");
      setTimeout(() => setSuccessMessage(""), 5000);
      void loadAudits();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The CSV upload failed.");
    } finally {
      setIsSavingAudit(false);
    }
  }

  return (
    <>
      <div className="min-h-screen bg-[var(--background)]">
        {/* Header */}
        <header className="border-b border-[rgba(255,255,255,0.08)] bg-[var(--brand-indigo-dark)]">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-4">
              <Image
                src="/crowe_logo_2c_w.png"
                alt="Crowe"
                width={128}
                height={36}
                className="h-6 w-auto"
                priority
              />
              <div className="hidden h-5 w-px bg-white/16 sm:block" aria-hidden="true" />
              <p className="hidden text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)] sm:block">
                Audit workspaces
              </p>
            </div>
            <PersonaProfile />
          </div>
        </header>

        <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-10">
          {/* Page heading */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[var(--brand-indigo-dark)]">
                Audit workspaces
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Open an active audit or create a new workspace.
              </p>
            </div>
            <ManagerAddButton onAdd={openModal} />
          </div>

          {/* Summary strip */}
          {!isLoading && (auditRows.length > 0 || LOCKED_AUDIT_ROWS.length > 0) && (
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-b border-[var(--border-subtle)] pb-5">
              <SummaryItem label="Active" count={counts.active} accent="indigo" />
              <div className="h-4 w-px bg-[var(--border-subtle)]" aria-hidden="true" />
              <SummaryItem label="Planning" count={counts.planning} accent="amber" />
              <SummaryItem label="Fieldwork" count={counts.fieldwork} accent="teal" />
              <SummaryItem label="Reporting" count={counts.reporting} accent="indigo" />
            </div>
          )}

          {/* Success toast */}
          {successMessage && (
            <div className="mt-5 flex items-center gap-3 rounded-2xl border border-[rgba(5,171,140,0.24)] bg-[rgba(5,171,140,0.08)] px-4 py-3 text-sm font-medium text-[var(--brand-teal-core)]">
              <CheckCircle2 size={16} />
              {successMessage}
            </div>
          )}

          {/* Error banner */}
          {loadError && (
            <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-[rgba(229,55,107,0.24)] bg-[rgba(229,55,107,0.06)] px-4 py-3 text-sm text-[var(--brand-coral)]">
              <span>{loadError}</span>
              <button
                type="button"
                onClick={() => void loadAudits()}
                className="shrink-0 rounded-full border border-[rgba(229,55,107,0.24)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] hover:bg-[rgba(229,55,107,0.08)]"
              >
                Retry
              </button>
            </div>
          )}

          {/* Toolbar */}
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-xs">
              <Search
                size={14}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
              />
              <input
                type="search"
                placeholder="Search by name or company…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-full rounded-full border border-[var(--border-subtle)] bg-white pl-9 pr-4 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
              />
            </div>

            <div className="flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-white p-1">
              {STAGE_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setStageFilter(f.value)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] transition-colors ${
                    stageFilter === f.value
                      ? "bg-[var(--brand-indigo-dark)] text-white"
                      : "text-[var(--muted)] hover:text-[var(--brand-indigo-dark)]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table area */}
          <div className="mt-4">
            {isLoading ? (
              <SkeletonTable />
            ) : filteredRows.length === 0 && LOCKED_AUDIT_ROWS.length === 0 ? (
              <EmptyState onAdd={openModal} hasFilter={searchQuery !== "" || stageFilter !== "all"} />
            ) : (
              <AuditTable rows={filteredRows} lockedRows={LOCKED_AUDIT_ROWS} />
            )}
          </div>
        </main>
      </div>

      {/* Create audit modal */}
      <NewAuditModal
        open={isModalOpen}
        form={auditForm}
        files={uploadedFiles}
        auditRows={auditRows}
        folderMappedFiles={folderMappedFiles}
        uploadMode={uploadMode}
        onUploadModeChange={handleUploadModeChange}
        onClose={closeModal}
        onSubmit={handleCreateAudit}
        onFormChange={setAuditForm}
        onImportSourceAuditChange={handleImportSourceAuditChange}
        onFileChange={handleFileChange}
        onFolderFilesChange={handleFolderFilesChange}
        onMappedFileTargetChange={handleMappedFileTargetChange}
        canCreateAudit={canCreateAudit}
        isSavingAudit={isSavingAudit}
        saveError={saveError}
        missingRequiredRequirementIds={missingRequiredRequirementIds}
        requiredRequirementIds={requiredRequirementIds}
      />
    </>
  );
}

// ── Table ─────────────────────────────────────────────────────────────────────

function AuditTable({ rows, lockedRows }: { rows: AuditWorkspaceRow[]; lockedRows: LockedAuditRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border-subtle)] bg-[var(--surface-soft)]">
              {[
                "Audit name",
                "Company",
                "Scope period",
                "Audit timeframe",
                "Stage",
                "Status",
                "Budget",
                "",
              ].map((col) => (
                <th
                  key={col}
                  scope="col"
                  className="whitespace-nowrap px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--muted)] first:pl-5 last:pr-5"
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {rows.map((row) => (
              <AuditTableRow key={row.id} row={row} />
            ))}
            {lockedRows.map((row) => (
              <LockedAuditTableRow key={row.id} row={row} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTableRow({ row }: { row: AuditWorkspaceRow }) {
  return (
    <tr
      className="group cursor-pointer transition-colors hover:bg-[var(--surface-soft)]"
      onClick={() => {
        window.location.href = row.dashboardUrl;
      }}
    >
      <td className="pl-5 pr-4 py-3.5">
        <p className="font-semibold text-[var(--brand-indigo-dark)]">{row.name}</p>
      </td>
      <td className="px-4 py-3.5 text-[var(--muted)]">{row.companyName}</td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.scopePeriod}</td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.auditTimeframe}</td>
      <td className="px-4 py-3.5">
        <StageBadge phase={row.activePhase} />
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.budget}</td>
      <td className="py-3.5 pl-4 pr-5">
        <a
          href={row.dashboardUrl}
          onClick={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-indigo-dark)] opacity-0 transition-all duration-150 group-hover:opacity-100 hover:border-[rgba(0,46,98,0.24)] hover:bg-[var(--surface-soft)]"
        >
          Open
          <ArrowUpRight size={12} />
        </a>
      </td>
    </tr>
  );
}

function LockedAuditTableRow({ row }: { row: LockedAuditRow }) {
  return (
    <tr className="group opacity-60">
      <td className="pl-5 pr-4 py-3.5">
        <p className="font-semibold text-[var(--brand-indigo-dark)]">{row.name}</p>
      </td>
      <td className="px-4 py-3.5 text-[var(--muted)]">{row.companyName}</td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.scopePeriod}</td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.auditTimeframe}</td>
      <td className="px-4 py-3.5">
        <StageBadge phase={row.activePhase} />
      </td>
      <td className="px-4 py-3.5">
        <StatusBadge status={row.status} />
      </td>
      <td className="px-4 py-3.5 whitespace-nowrap text-[var(--muted)]">{row.budget}</td>
      <td className="py-3.5 pl-4 pr-5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-soft)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          <Lock size={11} />
          Locked
        </span>
      </td>
    </tr>
  );
}

// ── Small components ──────────────────────────────────────────────────────────

function SummaryItem({
  label,
  count,
  accent,
}: {
  label: string;
  count: number;
  accent: "indigo" | "amber" | "teal";
}) {
  const dotColor =
    accent === "amber"
      ? "bg-[var(--brand-amber-core)]"
      : accent === "teal"
        ? "bg-[var(--brand-teal-core)]"
        : "bg-[var(--brand-indigo-core)]";

  return (
    <div className="flex items-center gap-2">
      <span className={`h-2 w-2 rounded-full ${dotColor}`} aria-hidden="true" />
      <span className="text-sm text-[var(--muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--brand-indigo-dark)]">{count}</span>
    </div>
  );
}

function StageBadge({ phase }: { phase: string }) {
  const normalized = phase.toLowerCase();
  const styles =
    normalized === "planning"
      ? "bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-dark)] border-[rgba(245,168,0,0.2)]"
      : normalized === "fieldwork"
        ? "bg-[rgba(0,46,98,0.08)] text-[var(--brand-indigo-core)] border-[rgba(0,46,98,0.12)]"
        : normalized === "reporting"
          ? "bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)] border-[rgba(5,171,140,0.18)]"
          : "bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border-subtle)]";

  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles}`}
    >
      {phase || "—"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const styles =
    normalized === "active"
      ? "bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)] border-[rgba(5,171,140,0.18)]"
      : normalized === "complete" || normalized === "completed"
        ? "bg-[rgba(0,46,98,0.08)] text-[var(--brand-indigo-core)] border-[rgba(0,46,98,0.12)]"
        : "bg-[var(--surface-soft)] text-[var(--muted)] border-[var(--border-subtle)]";

  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).toLowerCase() : "—";

  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles}`}
    >
      {label}
    </span>
  );
}

function SkeletonTable() {
  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-white">
      <div className="border-b border-[var(--border-subtle)] bg-[var(--surface-soft)] px-5 py-3" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-[var(--border-subtle)] px-5 py-4 last:border-0"
        >
          <div className="h-4 w-48 animate-pulse rounded-full bg-[var(--border-subtle)]" />
          <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--border-subtle)]" />
          <div className="h-4 w-36 animate-pulse rounded-full bg-[var(--border-subtle)]" />
          <div className="ml-auto h-4 w-16 animate-pulse rounded-full bg-[var(--border-subtle)]" />
        </div>
      ))}
    </div>
  );
}

function EmptyState({
  onAdd,
  hasFilter,
}: {
  onAdd: () => void;
  hasFilter: boolean;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-subtle)] bg-white px-6 py-16 text-center">
      <FolderOpen size={32} className="text-[var(--muted)] opacity-40" />
      <p className="mt-4 font-semibold text-[var(--brand-indigo-dark)]">
        {hasFilter ? "No audits match your filter" : "No audit workspaces yet"}
      </p>
      <p className="mt-1.5 max-w-xs text-sm text-[var(--muted)]">
        {hasFilter
          ? "Try adjusting your search or stage filter."
          : "Create your first audit workspace to get started."}
      </p>
      {!hasFilter && (
        <div className="mt-5">
          <ManagerAddButton onAdd={onAdd} />
        </div>
      )}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function NewAuditModal({
  open,
  form,
  files,
  auditRows,
  folderMappedFiles,
  uploadMode,
  onUploadModeChange,
  onClose,
  onSubmit,
  onFormChange,
  onImportSourceAuditChange,
  onFileChange,
  onFolderFilesChange,
  onMappedFileTargetChange,
  canCreateAudit,
  isSavingAudit,
  saveError,
  missingRequiredRequirementIds,
  requiredRequirementIds,
}: {
  open: boolean;
  form: AuditForm;
  files: UploadedFiles;
  auditRows: AuditWorkspaceRow[];
  folderMappedFiles: FolderMappedFile[];
  uploadMode: UploadMode;
  onUploadModeChange: (nextMode: UploadMode) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: Dispatch<SetStateAction<AuditForm>>;
  onImportSourceAuditChange: (nextAuditId: string) => void;
  onFileChange: (fileType: UploadRequirement["id"], event: ChangeEvent<HTMLInputElement>) => void;
  onFolderFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMappedFileTargetChange: (fileId: string, nextTarget: UploadRequirement["id"] | "") => void;
  canCreateAudit: boolean;
  isSavingAudit: boolean;
  saveError: string;
  missingRequiredRequirementIds: UploadRequirement["id"][];
  requiredRequirementIds: UploadRequirement["id"][];
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const folderInputProps: InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory?: string;
    directory?: string;
  } = { webkitdirectory: "", directory: "" };

  const selectedImportSourceAudit = auditRows.find((r) => r.id === form.importSourceAuditId) ?? null;
  const unmatchedFiles = folderMappedFiles.filter((item) => item.assignedTarget === null);
  const mappedFiles = folderMappedFiles.filter((item) => item.assignedTarget !== null);
  const requiredRequirements = uploadRequirements.filter((r) =>
    requiredRequirementIds.includes(r.id),
  );

  useEffect(() => {
    if (open) {
      setTimeout(() => firstInputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(1,30,65,0.44)] backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="New audit workspace"
    >
      <div className="flex min-h-full items-start justify-center p-4 sm:items-center sm:py-8">
        <div className="flex max-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-[24px] border border-black/6 bg-[#fbfaf7] shadow-[0_24px_80px_rgba(1,30,65,0.24)]">
          {/* Sticky header */}
          <div className="flex shrink-0 items-center justify-between gap-4 border-b border-black/6 bg-[#fbfaf7] px-6 py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">
                Create workspace
              </p>
              <h2 className="mt-0.5 text-lg font-semibold text-[var(--brand-indigo-dark)]">
                New audit workspace
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isSavingAudit}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-black/6 bg-white text-[var(--muted)] transition-colors hover:text-[var(--brand-indigo-dark)] disabled:opacity-40"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Scrollable body */}
          <form
            id="new-audit-form"
            className="flex min-h-0 flex-1 flex-col overflow-y-auto"
            onSubmit={onSubmit}
          >
            <div className="grid gap-6 p-6">
              {/* ── Section 1: Audit details ── */}
              <section>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                  Audit details
                </p>
                <div className="grid gap-3">
                  <Field label="Audit name">
                    <input
                      ref={firstInputRef}
                      required
                      value={form.auditName}
                      onChange={(e) =>
                        onFormChange((c) => ({ ...c, auditName: e.target.value }))
                      }
                      placeholder="Example: Q3 SOX ITGC Control Testing"
                      className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                    />
                  </Field>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Audit period start">
                      <input
                        required
                        type="date"
                        value={form.auditPeriodStart}
                        onChange={(e) =>
                          onFormChange((c) => ({ ...c, auditPeriodStart: e.target.value }))
                        }
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      />
                    </Field>
                    <Field label="Audit period end">
                      <input
                        required
                        type="date"
                        value={form.auditPeriodEnd}
                        onChange={(e) =>
                          onFormChange((c) => ({ ...c, auditPeriodEnd: e.target.value }))
                        }
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Scope period start">
                      <input
                        required
                        type="date"
                        value={form.scopePeriodStart}
                        onChange={(e) =>
                          onFormChange((c) => ({ ...c, scopePeriodStart: e.target.value }))
                        }
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      />
                    </Field>
                    <Field label="Scope period end">
                      <input
                        required
                        type="date"
                        value={form.scopePeriodEnd}
                        onChange={(e) =>
                          onFormChange((c) => ({ ...c, scopePeriodEnd: e.target.value }))
                        }
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      />
                    </Field>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[0.55fr_1.45fr]">
                    <Field label="Total audit hours">
                      <input
                        type="number"
                        min="0"
                        step="0.25"
                        value={form.totalBudgetHours}
                        onChange={(e) =>
                          onFormChange((c) => ({ ...c, totalBudgetHours: e.target.value }))
                        }
                        placeholder="240"
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      />
                    </Field>
                    <Field label="Import planning hours from">
                      <select
                        value={form.importSourceAuditId}
                        onChange={(e) => onImportSourceAuditChange(e.target.value)}
                        className="h-9 w-full rounded-xl border border-black/6 bg-white px-3.5 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-core)]"
                      >
                        <option value="">Do not import a prior audit budget</option>
                        {auditRows.map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  {selectedImportSourceAudit && (
                    <div className="rounded-[14px] border border-[var(--border-subtle)] bg-white px-4 py-3 text-sm">
                      <p className="font-semibold text-[var(--brand-indigo-dark)]">
                        Importing budget defaults from {selectedImportSourceAudit.name}
                      </p>
                      <p className="mt-1 text-[var(--muted)]">
                        Total: {formatBudgetPreview(selectedImportSourceAudit.totalBudgetHours)} |
                        Planning:{" "}
                        {formatBudgetPreview(selectedImportSourceAudit.planningBudgetHours)} |
                        Fieldwork:{" "}
                        {formatBudgetPreview(selectedImportSourceAudit.fieldworkBudgetHours)} |
                        Reporting:{" "}
                        {formatBudgetPreview(selectedImportSourceAudit.reportingBudgetHours)}
                      </p>
                    </div>
                  )}

                  {form.auditPeriodStart &&
                    form.auditPeriodEnd &&
                    form.auditPeriodStart > form.auditPeriodEnd && (
                      <p className="text-sm font-medium text-[var(--brand-coral)]">
                        Audit period end must be the same as or later than the start date.
                      </p>
                    )}

                  {form.scopePeriodStart &&
                    form.scopePeriodEnd &&
                    form.scopePeriodStart > form.scopePeriodEnd && (
                      <p className="text-sm font-medium text-[var(--brand-coral)]">
                        Scope period end must be the same as or later than the start date.
                      </p>
                    )}

                  {form.totalBudgetHours.trim().length > 0 &&
                    Number(form.totalBudgetHours) < 0 && (
                      <p className="text-sm font-medium text-[var(--brand-coral)]">
                        Total audit hours must be zero or greater.
                      </p>
                    )}
                </div>
              </section>

              {/* ── Section 2: Data upload ── */}
              <section>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">
                    Data upload
                  </p>
                  <div className="inline-flex rounded-full border border-black/6 bg-white p-0.5">
                    <button
                      type="button"
                      onClick={() => onUploadModeChange("guided")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        uploadMode === "guided"
                          ? "bg-[var(--brand-indigo-dark)] text-white"
                          : "text-[var(--muted)] hover:text-[var(--brand-indigo-dark)]"
                      }`}
                    >
                      Section by section
                    </button>
                    <button
                      type="button"
                      onClick={() => onUploadModeChange("folder")}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                        uploadMode === "folder"
                          ? "bg-[var(--brand-indigo-dark)] text-white"
                          : "text-[var(--muted)] hover:text-[var(--brand-indigo-dark)]"
                      }`}
                    >
                      Folder import
                    </button>
                  </div>
                </div>

                {uploadMode === "guided" ? (
                  <div className="overflow-hidden rounded-[18px] border border-black/6 bg-white">
                    <div className="border-b border-black/6 px-4 py-2.5">
                      <p className="text-xs text-[var(--muted)]">
                        The controls dataset is required. All other uploads are optional.
                      </p>
                    </div>
                    <div className="divide-y divide-black/[0.04]">
                      {uploadRequirements.map((requirement) => {
                        const file = files[requirement.id];
                        const isRequired = requiredRequirementIds.includes(requirement.id);
                        return (
                          <DenseUploadRow
                            key={requirement.id}
                            requirement={requirement}
                            file={file}
                            isRequired={isRequired}
                            onFileChange={onFileChange}
                          />
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    {/* Folder picker */}
                    <div className="rounded-[18px] border border-black/6 bg-white p-4">
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--brand-indigo-core)]">
                          <Upload size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-[var(--brand-indigo-dark)]">
                            Import a folder
                          </p>
                          <p className="mt-0.5 text-xs text-[var(--muted)]">
                            Select a folder to auto-map supported CSV and XLSX files.
                          </p>
                          <input
                            type="file"
                            multiple
                            accept=".csv,.xlsx"
                            onChange={onFolderFilesChange}
                            {...folderInputProps}
                            className="mt-3 w-full rounded-xl border border-black/6 bg-[var(--surface-soft)] px-3 py-2 text-sm outline-none file:mr-3 file:rounded-full file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs file:font-semibold file:text-[var(--brand-indigo-core)]"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Mapping review */}
                    {folderMappedFiles.length > 0 && (
                      <div className="overflow-hidden rounded-[18px] border border-black/6 bg-white">
                        <div className="flex items-center justify-between border-b border-black/6 px-4 py-2.5">
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
                            Mapping review
                          </p>
                          <span className="rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
                            {folderMappedFiles.length} file
                            {folderMappedFiles.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="divide-y divide-black/[0.04]">
                          {folderMappedFiles
                            .slice()
                            .sort((a, b) => {
                              if (a.assignedTarget && !b.assignedTarget) return -1;
                              if (!a.assignedTarget && b.assignedTarget) return 1;
                              return b.suggestionScore - a.suggestionScore;
                            })
                            .map((item) => (
                              <div key={item.id} className="px-4 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-[var(--brand-indigo-dark)]">
                                      {item.file.name}
                                    </p>
                                    <div className="mt-1 flex flex-wrap items-center gap-2">
                                      <span
                                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                                          item.suggestionScore >= 4
                                            ? "bg-[rgba(5,171,140,0.1)] text-[var(--brand-teal-core)]"
                                            : item.suggestionScore >= 2
                                              ? "bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-dark)]"
                                              : "bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)]"
                                        }`}
                                      >
                                        {item.suggestionScore >= 4
                                          ? "High"
                                          : item.suggestionScore >= 2
                                            ? "Medium"
                                            : "Low"}{" "}
                                        confidence
                                      </span>
                                      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                                        Suggested:{" "}
                                        {item.suggestedTarget
                                          ? getRequirementLabel(item.suggestedTarget)
                                          : "No match"}
                                      </span>
                                    </div>
                                  </div>
                                  <select
                                    value={item.assignedTarget ?? ""}
                                    onChange={(e) =>
                                      onMappedFileTargetChange(
                                        item.id,
                                        (e.target.value as UploadRequirement["id"] | "") ?? "",
                                      )
                                    }
                                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold outline-none transition-colors ${
                                      item.assignedTarget
                                        ? "border-black/6 bg-[var(--surface-soft)] text-[var(--brand-indigo-dark)]"
                                        : "border-[rgba(229,55,107,0.24)] bg-[rgba(229,55,107,0.04)] text-[var(--brand-coral)]"
                                    }`}
                                  >
                                    <option value="">Leave unassigned</option>
                                    {uploadRequirements.map((r) => (
                                      <option
                                        key={r.id}
                                        value={r.id}
                                        disabled={folderMappedFiles.some(
                                          (mf) =>
                                            mf.id !== item.id && mf.assignedTarget === r.id,
                                        )}
                                      >
                                        {r.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            ))}
                        </div>
                        <div className="border-t border-black/6 px-4 py-2.5">
                          <p className="text-xs text-[var(--muted)]">
                            {mappedFiles.length} mapped · {unmatchedFiles.length} awaiting
                            assignment
                          </p>
                        </div>
                      </div>
                    )}

                    {unmatchedFiles.length > 0 && (
                      <p className="text-xs text-[var(--muted)]">
                        Unassigned files will not be uploaded until mapped.
                      </p>
                    )}

                    {missingRequiredRequirementIds.length > 0 && (
                      <p className="rounded-[14px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.06)] px-4 py-3 text-sm font-medium text-[var(--brand-coral)]">
                        Required sections not yet mapped:{" "}
                        {requiredRequirements
                          .filter((r) => missingRequiredRequirementIds.includes(r.id))
                          .map((r) => r.label)
                          .join(", ")}
                        .
                      </p>
                    )}
                  </div>
                )}
              </section>

              {/* Save error */}
              {saveError && (
                <p className="rounded-[14px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.06)] px-4 py-3 text-sm font-medium text-[var(--brand-coral)]">
                  {saveError}
                </p>
              )}
            </div>
          </form>

          {/* Sticky footer */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-black/6 bg-[#fbfaf7] px-6 py-4">
            <p className="text-xs text-[var(--muted)]">
              Audit name, valid date range, and required datasets must be complete before creating.
            </p>
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSavingAudit}
                className="rounded-full border border-black/6 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-dark)] transition-colors hover:bg-[var(--surface-soft)] disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                form="new-audit-form"
                type="submit"
                disabled={!canCreateAudit || isSavingAudit}
                className="rounded-full bg-[var(--brand-amber-core)] px-5 py-2 text-sm font-semibold text-[var(--brand-indigo-dark)] transition-all duration-200 hover:bg-[var(--brand-amber-bright)] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {isSavingAudit ? "Creating…" : "Create workspace"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dense upload row ───────────────────────────────────────────────────────────

function DenseUploadRow({
  requirement,
  file,
  isRequired,
  onFileChange,
}: {
  requirement: UploadRequirement;
  file: File | null;
  isRequired: boolean;
  onFileChange: (
    fileType: UploadRequirement["id"],
    event: ChangeEvent<HTMLInputElement>,
  ) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-[var(--surface-soft)]">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[var(--brand-indigo-dark)]">
            {requirement.label}
          </span>
          {isRequired ? (
            <span className="rounded-full bg-[rgba(245,168,0,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-amber-dark)]">
              Required
            </span>
          ) : (
            <span className="rounded-full bg-[rgba(0,46,98,0.06)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--brand-indigo-core)]">
              Optional
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          {file ? (
            <span className="font-medium text-[var(--brand-teal-core)]">{file.name}</span>
          ) : (
            `Accepted: ${requirement.accept}`
          )}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2.5">
        {file && <CheckCircle2 size={15} className="text-[var(--brand-teal-core)]" />}
        <span className="rounded-full border border-black/6 bg-[var(--surface-soft)] px-3 py-1 text-xs font-semibold text-[var(--brand-indigo-core)] transition-colors hover:bg-white">
          {file ? "Replace" : "Choose file"}
        </span>
        <input
          type="file"
          accept={requirement.accept}
          required={isRequired}
          onChange={(e) => onFileChange(requirement.id, e)}
          className="absolute h-0 w-0 opacity-0"
        />
      </div>
    </label>
  );
}

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[10px] font-semibold uppercase leading-none tracking-[0.2em] text-[var(--muted)]">
        {label}
      </span>
      {children}
    </label>
  );
}
