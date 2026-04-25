"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type Dispatch,
  type FormEvent,
  type InputHTMLAttributes,
  type ReactNode,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { CalendarRange, CheckCircle2, Database, FolderOpen, ShieldCheck, Sparkles, Upload, X } from "lucide-react";

type UploadRequirement = {
  id:
    | "controls"
    | "questions"
    | "requests"
    | "documents"
    | "applications"
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
    | "questions"
    | "requests"
    | "documents"
    | "applications"
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
  periodStart: string;
  periodEnd: string;
};

type UploadedFiles = Record<UploadRequirement["id"], File | null>;

type ExistingAuditOption = {
  id: string;
  name: string;
  period: string;
  status: string;
  activePhase?: string;
  isPrototype?: boolean;
};

type SavedImportSummary = {
  auditId?: string;
  batchId: string;
  status: string;
  rowCount: number;
  fileCount: number;
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

type FolderMappedFile = {
  id: string;
  file: File;
  suggestedTarget: UploadRequirement["id"] | null;
  assignedTarget: UploadRequirement["id"] | null;
  suggestionScore: number;
  suggestionReason: string[];
  relativePath: string;
};

const uploadRequirements: UploadRequirement[] = [
  {
    id: "controls",
    label: "Controls dataset",
    description: "Primary control population for the audit. This is the core file the platform uses to stand up testing.",
    helpText: "Expected examples: controls export, scope list, test population, Archer control inventory.",
    accept: ".csv",
    required: true,
    category: "core",
    sourceEntity: "controls",
    keywords: ["control", "scope", "population", "archer", "testing"],
  },
  {
    id: "questions",
    label: "Question log dataset",
    description: "Optional auditor questions or inquiry tracking so the question log can load from imported data.",
    helpText: "Expected examples: questions, inquiries, auditor asks, response tracker.",
    accept: ".csv",
    required: false,
    category: "workflow",
    sourceEntity: "questions",
    keywords: ["question", "inquiry", "ask", "issue log", "qlog"],
  },
  {
    id: "requests",
    label: "Request log dataset",
    description: "Optional PBC, evidence, or request tracker data for the request management workflow.",
    helpText: "Expected examples: requests, pbc, evidence request, fulfillment tracker.",
    accept: ".csv",
    required: false,
    category: "workflow",
    sourceEntity: "requests",
    keywords: ["request", "pbc", "evidence", "fulfillment", "supporting request"],
  },
  {
    id: "documents",
    label: "Document inventory dataset",
    description: "Optional workpaper or document tracker data for the documents and evidence views.",
    helpText: "Expected examples: documents, workpapers, evidence inventory, report artifacts.",
    accept: ".csv",
    required: false,
    category: "workflow",
    sourceEntity: "documents",
    keywords: ["document", "workpaper", "evidence", "artifact", "report"],
  },
  {
    id: "applications",
    label: "Applications reference data",
    description: "Optional application inventory to connect controls and issues to systems in scope.",
    helpText: "Expected examples: applications, app inventory, system catalog.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "applications",
    keywords: ["application", "app", "system", "inventory", "catalog"],
  },
  {
    id: "thirdParties",
    label: "Third-party reference data",
    description: "Optional vendor or service-provider inventory for third-party and outsourced control context.",
    helpText: "Expected examples: third parties, vendors, service providers, supplier inventory.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "third_parties",
    keywords: ["thirdparty", "third_party", "vendor", "supplier", "provider"],
  },
  {
    id: "risks",
    label: "Risk register data",
    description: "Optional risk register export to relate control coverage to the underlying risk landscape.",
    helpText: "Expected examples: risks, risk register, inherent risk, residual risk.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "risks",
    keywords: ["risk", "riskregister", "inherent", "residual"],
  },
  {
    id: "riskControlLinks",
    label: "Risk-to-control mapping",
    description: "Maps risk records to the controls they are mitigated by so the platform can load explicit risk-control relationships.",
    helpText: "Expected examples: risk-to-control, risk_control_mapping, risk control links, risk control matrix.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "risk_control_links",
    keywords: ["riskcontrol", "risk_control", "risktocontrol", "controlmapping", "controlmatrix", "mitigates"],
  },
  {
    id: "rcsaRecords",
    label: "RCSA data",
    description: "Optional RCSA outputs that can support planning, scoping, and coverage decisions.",
    helpText: "Expected examples: rcsa, self assessment, risk control self assessment.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "rcsa_records",
    keywords: ["rcsa", "selfassessment", "riskcontrolselfassessment"],
  },
  {
    id: "issues",
    label: "Issue tracker data",
    description: "Optional issue or remediation data to provide current problem and action-plan context.",
    helpText: "Expected examples: issues, findings tracker, remediation, open actions.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "issues",
    keywords: ["issue", "finding", "remediation", "action", "tracker"],
  },
  {
    id: "monitoringResults",
    label: "Monitoring results data",
    description: "Optional monitoring or exception data to support trend analysis and ongoing control performance.",
    helpText: "Expected examples: monitoring, exceptions, continuous monitoring, run results.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "monitoring_results",
    keywords: ["monitoring", "exception", "results", "continuous", "run"],
  },
  {
    id: "priorAuditFindings",
    label: "Prior audit findings",
    description: "Optional historical findings to support repeat-issue analysis and planning decisions.",
    helpText: "Expected examples: prior findings, historical audit issues, open audit actions.",
    accept: ".csv",
    required: false,
    category: "advanced",
    sourceEntity: "prior_audit_findings",
    keywords: ["prioraudit", "priorfinding", "historicalfinding", "auditfinding"],
  },
];

const emptyUploadedFiles: UploadedFiles = {
  controls: null,
  questions: null,
  requests: null,
  documents: null,
  applications: null,
  thirdParties: null,
  risks: null,
  riskControlLinks: null,
  rcsaRecords: null,
  issues: null,
  monitoringResults: null,
  priorAuditFindings: null,
};

const requirementGroups: Array<{
  id: UploadRequirement["category"];
  title: string;
  description: string;
}> = [
  {
    id: "core",
    title: "Core Intake",
    description: "Minimum data required to stand up the audit workspace and testing population.",
  },
  {
    id: "workflow",
    title: "Workflow Data",
    description: "Operational logs that directly populate the question, request, and document workflows.",
  },
  {
    id: "advanced",
    title: "Advanced Reference Data",
    description: "Optional planning, risk, issue, and context datasets that enrich the audit but are not required to start.",
  },
];

const prototypeAuditOption: ExistingAuditOption = {
  id: "prototype-static-data",
  name: "Prototype Demo Audit",
  period: "Static sample data",
  status: "Original dashboard seed data",
  isPrototype: true,
};

function getRequiredUploadRequirementIds(files: UploadedFiles) {
  const requiredIds: UploadRequirement["id"][] = ["controls"];

  if (files.risks) {
    requiredIds.push("riskControlLinks");
  }

  return requiredIds;
}

export default function HomePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExistingAuditId, setSelectedExistingAuditId] = useState("");
  const [auditForm, setAuditForm] = useState<AuditForm>({
    auditName: "",
    periodStart: "",
    periodEnd: "",
  });
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFiles>(emptyUploadedFiles);
  const [uploadMode, setUploadMode] = useState<UploadMode>("guided");
  const [folderMappedFiles, setFolderMappedFiles] = useState<FolderMappedFile[]>([]);
  const [hasConfiguredAudit, setHasConfiguredAudit] = useState(false);
  const [isSavingAudit, setIsSavingAudit] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [savedImportSummary, setSavedImportSummary] = useState<SavedImportSummary | null>(null);
  const [existingAuditOptions, setExistingAuditOptions] = useState<ExistingAuditOption[]>([]);

  const requiredRequirementIds = useMemo(() => getRequiredUploadRequirementIds(uploadedFiles), [uploadedFiles]);
  const requiredFilesSelected = requiredRequirementIds.every((requirementId) => uploadedFiles[requirementId] !== null);
  const missingRequiredRequirementIds = requiredRequirementIds.filter((requirementId) => uploadedFiles[requirementId] === null);

  const hasValidPeriod =
    auditForm.periodStart.length > 0 &&
    auditForm.periodEnd.length > 0 &&
    auditForm.periodStart <= auditForm.periodEnd;

  const canLaunchPlatform =
    auditForm.auditName.trim().length > 0 && hasValidPeriod && requiredFilesSelected;
  const combinedAuditOptions = useMemo(
    () => [prototypeAuditOption, ...existingAuditOptions],
    [existingAuditOptions],
  );
  const selectedExistingAudit = combinedAuditOptions.find((audit) => audit.id === selectedExistingAuditId) ?? null;
  const liveDashboardQuery =
    savedImportSummary?.auditId && auditForm.auditName.trim()
      ? {
          mode: "live",
          auditId: savedImportSummary.auditId,
          auditLabel: auditForm.auditName.trim(),
        }
      : null;
  const selectedAuditDashboardQuery = selectedExistingAudit
    ? selectedExistingAudit.isPrototype
      ? ({
          mode: "prototype",
          auditLabel: selectedExistingAudit.name,
        } as const)
      : ({
          mode: "live",
          auditId: selectedExistingAudit.id,
          auditLabel: selectedExistingAudit.name,
        } as const)
    : null;
  const launchDashboardQuery = selectedAuditDashboardQuery ?? liveDashboardQuery;
  const canLaunchDashboard = launchDashboardQuery !== null;
  const configuredFileCount = useMemo(
    () => Object.values(uploadedFiles).filter((file) => file !== null).length,
    [uploadedFiles],
  );
  const uploadModeLabel = uploadMode === "folder" ? "Folder mapped" : "Manual mapping";

  useEffect(() => {
    let cancelled = false;

    async function loadAudits() {
      try {
        const response = await fetch("/api/audits", { cache: "no-store" });
        const payload = (await response.json()) as
          | Array<{ id: string; name: string; period_start: string; period_end: string; status: string; active_phase: string }>
          | { error?: string };

        if (!response.ok || !Array.isArray(payload) || cancelled) {
          return;
        }

        setExistingAuditOptions(
          payload.map((audit) => ({
            id: audit.id,
            name: audit.name,
            period: `${formatDate(audit.period_start)} to ${formatDate(audit.period_end)}`,
            status: `${audit.status} · ${audit.active_phase}`,
            activePhase: audit.active_phase,
          })),
        );
      } catch {
        if (!cancelled) {
          setExistingAuditOptions([]);
        }
      }
    }

    void loadAudits();

    return () => {
      cancelled = true;
    };
  }, [savedImportSummary]);

  function openModal() {
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleUploadModeChange(nextMode: UploadMode) {
    setUploadMode(nextMode);
    setSaveError("");
  }

  function handleFileChange(fileType: UploadRequirement["id"], event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    setUploadedFiles((current) => ({ ...current, [fileType]: file }));

    if (file) {
      setFolderMappedFiles((current) =>
        current.map((item) =>
          item.assignedTarget === fileType
            ? {
                ...item,
                assignedTarget: null,
              }
            : item,
        ),
      );
    }
  }

  function handleFolderFilesChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []).filter((file) => file.name.toLowerCase().endsWith(".csv"));
    const mappedFiles = createFolderMappedFiles(selectedFiles);
    setFolderMappedFiles(mappedFiles);
    setUploadedFiles(buildUploadedFilesFromMappedFiles(mappedFiles));
  }

  function handleMappedFileTargetChange(fileId: string, nextTarget: UploadRequirement["id"] | "") {
    const normalizedTarget = nextTarget || null;
    const targetAlreadyUsed = normalizedTarget
      ? folderMappedFiles.some((item) => item.id !== fileId && item.assignedTarget === normalizedTarget)
      : false;

    if (targetAlreadyUsed) {
      return;
    }

    const nextMappedFiles = folderMappedFiles.map((item) =>
      item.id === fileId
        ? {
            ...item,
            assignedTarget: normalizedTarget,
          }
        : item,
    );

    setFolderMappedFiles(nextMappedFiles);
    setUploadedFiles(buildUploadedFilesFromMappedFiles(nextMappedFiles));
  }

  async function handleCreateAudit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canLaunchPlatform || isSavingAudit) {
      return;
    }

    setIsSavingAudit(true);
    setSaveError("");

    try {
      const formData = new FormData();
      formData.append("auditName", auditForm.auditName.trim());
      formData.append("periodStart", auditForm.periodStart);
      formData.append("periodEnd", auditForm.periodEnd);
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
        throw new Error("error" in payload ? payload.error : "The CSV upload failed.");
      }

      const uploadSummary = payload as SavedImportSummary;
      const transformResponse = await fetch(`/api/imports/${uploadSummary.batchId}/transform`, {
        method: "POST",
      });
      const transformPayload = (await transformResponse.json()) as
        | { summary?: SavedImportSummary["transformSummary"]; error?: string }
        | undefined;

      if (!transformResponse.ok) {
        throw new Error(transformPayload?.error ?? "The transformation step failed.");
      }

      setSavedImportSummary({
        ...uploadSummary,
        status: "loaded",
        transformSummary: transformPayload?.summary,
      });
      setHasConfiguredAudit(true);
      setIsModalOpen(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "The CSV upload failed.");
    } finally {
      setIsSavingAudit(false);
    }
  }

  function resetAuditSetup() {
    setAuditForm({
      auditName: "",
      periodStart: "",
      periodEnd: "",
    });
    setUploadedFiles(emptyUploadedFiles);
    setFolderMappedFiles([]);
    setUploadMode("guided");
    setHasConfiguredAudit(false);
    setSaveError("");
    setSavedImportSummary(null);
    setIsModalOpen(true);
  }

  return (
    <>
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,168,0,0.18),_transparent_28%),linear-gradient(180deg,_#082346_0%,_#071a33_100%)] text-white lg:h-screen lg:overflow-hidden">
        <div className="mx-auto flex min-h-screen max-w-7xl items-center px-4 py-6 sm:px-6 lg:h-screen lg:px-8 lg:py-4">
          <section className="grid w-full gap-5 overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.05] p-5 shadow-panel backdrop-blur sm:p-6 lg:max-h-[calc(100vh-2rem)] lg:grid-cols-[1.02fr_0.98fr] lg:p-8">
            <div className="flex flex-col gap-4 lg:justify-start">
              <div className="max-w-2xl">
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-amber-bright)]">
                  Crowe Internal Audit
                </p>
                <h1 className="mt-3 text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[3.2rem] lg:leading-[1.02]">
                  Start a new audit engagement
                </h1>
                <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--muted-on-dark)] sm:text-base">
                  Launch the intake flow, capture the engagement period, and load the controls, questions, requests,
                  and document data that the platform uses downstream.
                </p>
              </div>

              <div className="grid gap-2.5 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.06)] p-4 lg:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                    Audit setup
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Popup-guided intake</h2>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted-on-dark)]">
                    Capture the engagement name and period first, then map incoming audit files to the right operating
                    screens before importing anything.
                  </p>
                </div>

                <div className="rounded-[24px] border border-white/10 bg-[rgba(245,168,0,0.12)] p-4 lg:p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                    Intake model
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">Entity-based data mapping</h2>
                  <p className="mt-2 text-sm leading-5 text-[var(--muted-on-dark)]">
                    The intake now mirrors the platform workflows: controls, questions, requests, and document
                    inventory.
                  </p>
                </div>
              </div>

              <div className="rounded-[24px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-4 lg:p-5">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                      Planning
                    </p>
                    <p className="mt-2 text-sm leading-5 text-[var(--muted-on-dark)]">
                      Core intake anchors the population and sets the operating baseline for the engagement.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                      Fieldwork
                    </p>
                    <p className="mt-2 text-sm leading-5 text-[var(--muted-on-dark)]">
                      Workflow data can flow straight into the operating logs instead of being rebuilt.
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                      Evidence
                    </p>
                    <p className="mt-2 text-sm leading-5 text-[var(--muted-on-dark)]">
                      Advanced reference data adds planning, risk, and historical context without blocking the audit launch.
                    </p>
                  </div>
                </div>
              </div>

              <section className="rounded-[26px] border border-white/10 bg-[rgba(255,255,255,0.04)] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.12)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-amber-bright)]">
                      Connect to database
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Direct source connection</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-on-dark)]">
                    <Database size={14} />
                    Coming soon
                  </div>
                </div>

                <div className="mt-4 inline-flex rounded-full border border-white/10 bg-[rgba(1,30,65,0.28)] p-1">
                  <div className="rounded-full bg-[rgba(245,168,0,0.16)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">
                    Coming soon
                  </div>
                </div>

                <p className="mt-4 text-sm leading-5 text-[var(--muted-on-dark)]">
                  Future versions can connect directly to governed audit sources, but the current flow is focused on
                  reviewed file-based imports with visible mapping.
                </p>
              </section>
            </div>

            <div className="grid gap-4 content-start">
              <section className="rounded-[26px] border border-white/10 bg-[rgba(255,255,255,0.06)] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.16)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-amber-bright)]">
                      New audit
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Create the engagement in a popup</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-on-dark)]">
                    <Sparkles size={14} />
                    Guided intake
                  </div>
                </div>

                <p className="mt-3 text-sm leading-5 text-[var(--muted-on-dark)]">
                  Click `New Audit` to open a modal where the user enters the audit name, chooses the audit period,
                  and then works through core intake, workflow data, and advanced reference data with either manual or
                  folder-based mapping.
                </p>

                <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    onClick={openModal}
                    className="inline-flex items-center justify-center gap-2 rounded-full border border-[rgba(245,168,0,0.24)] bg-[var(--brand-amber-core)] px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--brand-indigo-dark)] transition-transform duration-200 hover:-translate-y-0.5 hover:bg-[var(--brand-amber-bright)]"
                  >
                    <FolderOpen size={16} />
                    New Audit
                  </button>

                  <Link
                    href={launchDashboardQuery ? { pathname: "/dashboard", query: launchDashboardQuery } : "/dashboard"}
                    aria-disabled={!canLaunchDashboard}
                    className={`inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] transition-all duration-200 ${
                      canLaunchDashboard
                        ? "bg-white text-[var(--brand-indigo-dark)] hover:-translate-y-0.5"
                        : "pointer-events-none border border-white/10 bg-white/5 text-[rgba(255,255,255,0.42)]"
                    }`}
                  >
                    Launch platform
                  </Link>
                </div>

                <div className="mt-4 rounded-[22px] border border-white/10 bg-[rgba(1,30,65,0.22)] p-4">
                  {hasConfiguredAudit ? (
                    <div className="grid gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8af0dd]">
                            Audit configured
                          </p>
                          <h3 className="mt-1.5 text-lg font-semibold text-white">{auditForm.auditName}</h3>
                          <p className="mt-1.5 text-sm leading-5 text-[var(--muted-on-dark)]">
                            Audit period: {formatDate(auditForm.periodStart)} to {formatDate(auditForm.periodEnd)}
                          </p>
                        </div>
                        <CheckCircle2 className="shrink-0 text-[#8af0dd]" size={20} />
                      </div>

                      <div className="grid gap-2">
                        {uploadRequirements.map((requirement) => {
                          const file = uploadedFiles[requirement.id];

                          return (
                            <div
                              key={requirement.id}
                              className="flex items-center justify-between gap-3 rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5"
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-white">{requirement.label}</p>
                                <p className="mt-0.5 truncate text-sm text-[var(--muted-on-dark)]">
                                  {file ? file.name : requirement.required ? "Required file missing" : "Not provided"}
                                </p>
                              </div>
                              <StatusPill complete={Boolean(file)} />
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-3">
                        <p className="text-sm text-[var(--muted-on-dark)]">
                          {configuredFileCount} file{configuredFileCount === 1 ? "" : "s"} staged with {uploadModeLabel.toLowerCase()}.
                        </p>
                        <button
                          type="button"
                          onClick={resetAuditSetup}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                        >
                          Edit setup
                        </button>
                      </div>

                      {savedImportSummary ? (
                        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[var(--muted-on-dark)]">
                          Import batch `{savedImportSummary.batchId}` saved with {savedImportSummary.rowCount} parsed row
                          {savedImportSummary.rowCount === 1 ? "" : "s"} across {savedImportSummary.fileCount} file
                          {savedImportSummary.fileCount === 1 ? "" : "s"}.
                        </div>
                      ) : null}

                      {savedImportSummary?.transformSummary ? (
                        <div className="rounded-[16px] border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-[var(--muted-on-dark)]">
                          Loaded {savedImportSummary.transformSummary.controlsUpserted} controls,{" "}
                          {savedImportSummary.transformSummary.riskControlLinksUpserted} risk-to-control links,{" "}
                          {savedImportSummary.transformSummary.questionsUpserted} questions,{" "}
                          {savedImportSummary.transformSummary.requestsUpserted} requests, and{" "}
                          {savedImportSummary.transformSummary.documentsUpserted} documents into cleaned tables.
                        </div>
                      ) : null}

                      {savedImportSummary?.parseErrors.length ? (
                        <div className="rounded-[16px] border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.1)] px-3 py-2.5 text-sm text-[var(--muted-on-dark)]">
                          Some files were skipped:{" "}
                          {savedImportSummary.parseErrors.map((item) => `${item.fileName} (${item.message})`).join("; ")}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--brand-amber-bright)]">
                        <ShieldCheck size={18} />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">No audit created yet</h3>
                        <p className="mt-1.5 text-sm leading-5 text-[var(--muted-on-dark)]">
                          The popup now captures the actual operating datasets the platform expects and can map a
                          folder full of CSV files into those sections before import.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[26px] border border-white/10 bg-[rgba(255,255,255,0.05)] p-5 shadow-[0_20px_40px_rgba(0,0,0,0.14)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--brand-amber-bright)]">
                      Existing audits
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">Return to a saved audit workspace</h2>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-on-dark)]">
                    <ShieldCheck size={14} />
                    Supabase-backed
                  </div>
                </div>

                <p className="mt-3 text-sm leading-5 text-[var(--muted-on-dark)]">
                  Select an existing audit saved to Supabase to reopen the workspace with its audit name and reporting period.
                </p>

                <div className="mt-4 grid gap-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted-on-dark)]">
                      Select existing audit
                    </span>
                    <select
                      value={selectedExistingAuditId}
                      onChange={(event) => setSelectedExistingAuditId(event.target.value)}
                      className="w-full rounded-2xl border border-white/10 bg-[rgba(1,30,65,0.3)] px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-[var(--brand-amber-bright)]"
                    >
                      <option value="" className="bg-[#082346] text-white">
                        {existingAuditOptions.length > 0 ? "Choose an audit" : "No saved audits yet"}
                      </option>
                      {combinedAuditOptions.map((audit) => (
                        <option key={audit.id} value={audit.id} className="bg-[#082346] text-white">
                          {audit.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <div className="rounded-[22px] border border-white/10 bg-[rgba(1,30,65,0.22)] p-4">
                    {selectedExistingAudit ? (
                      <div className="grid gap-3">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8af0dd]">
                              Selected audit
                            </p>
                            <h3 className="mt-1.5 text-lg font-semibold text-white">{selectedExistingAudit.name}</h3>
                          </div>
                          <CheckCircle2 className="shrink-0 text-[#8af0dd]" size={20} />
                        </div>
                        <p className="text-sm leading-5 text-[var(--muted-on-dark)]">
                          Period: {selectedExistingAudit.period}
                        </p>
                        <p className="text-sm leading-5 text-[var(--muted-on-dark)]">
                          Status: {selectedExistingAudit.status}
                        </p>
                        {selectedExistingAudit.isPrototype ? (
                          <p className="text-sm leading-5 text-[var(--muted-on-dark)]">
                            This option opens the dashboard with the original static sample data used to build the prototype.
                          </p>
                        ) : null}
                        <Link
                          href={{
                            pathname: "/dashboard",
                            query: selectedExistingAudit.isPrototype
                              ? { mode: "prototype", auditLabel: selectedExistingAudit.name }
                              : { mode: "live", auditId: selectedExistingAudit.id, auditLabel: selectedExistingAudit.name },
                          }}
                          className="mt-1 inline-flex w-fit items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-indigo-dark)] transition-transform duration-200 hover:-translate-y-0.5"
                        >
                          Launch dashboard
                        </Link>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--brand-amber-bright)]">
                          <FolderOpen size={18} />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-white">No existing audit selected</h3>
                          <p className="mt-1.5 text-sm leading-5 text-[var(--muted-on-dark)]">
                            Choose a saved audit from the dropdown when one exists, or create a new audit to persist it to Supabase.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>
            </div>
          </section>
        </div>
      </main>

        <NewAuditModal
          open={isModalOpen}
        form={auditForm}
        files={uploadedFiles}
        folderMappedFiles={folderMappedFiles}
        uploadMode={uploadMode}
        onUploadModeChange={handleUploadModeChange}
        onClose={closeModal}
        onSubmit={handleCreateAudit}
        onFormChange={setAuditForm}
        onFileChange={handleFileChange}
        onFolderFilesChange={handleFolderFilesChange}
          onMappedFileTargetChange={handleMappedFileTargetChange}
          canCreateAudit={canLaunchPlatform}
          isSavingAudit={isSavingAudit}
          saveError={saveError}
          missingRequiredRequirementIds={missingRequiredRequirementIds}
        />
    </>
  );
}

function NewAuditModal({
  open,
  form,
  files,
  folderMappedFiles,
  uploadMode,
  onUploadModeChange,
  onClose,
  onSubmit,
  onFormChange,
  onFileChange,
  onFolderFilesChange,
  onMappedFileTargetChange,
  canCreateAudit,
  isSavingAudit,
  saveError,
  missingRequiredRequirementIds,
}: {
  open: boolean;
  form: AuditForm;
  files: UploadedFiles;
  folderMappedFiles: FolderMappedFile[];
  uploadMode: UploadMode;
  onUploadModeChange: (nextMode: UploadMode) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onFormChange: Dispatch<SetStateAction<AuditForm>>;
  onFileChange: (fileType: UploadRequirement["id"], event: ChangeEvent<HTMLInputElement>) => void;
  onFolderFilesChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onMappedFileTargetChange: (fileId: string, nextTarget: UploadRequirement["id"] | "") => void;
  canCreateAudit: boolean;
  isSavingAudit: boolean;
  saveError: string;
  missingRequiredRequirementIds: UploadRequirement["id"][];
}) {
  const firstInputRef = useRef<HTMLInputElement>(null);
  const folderInputProps: InputHTMLAttributes<HTMLInputElement> & {
    webkitdirectory?: string;
    directory?: string;
  } = {
    webkitdirectory: "",
    directory: "",
  };

  if (!open) {
    return null;
  }

  const unmatchedFiles = folderMappedFiles.filter((item) => item.assignedTarget === null);
  const mappedFiles = folderMappedFiles.filter((item) => item.assignedTarget !== null);
  const requiredRequirementIds = getRequiredUploadRequirementIds(files);
  const requiredRequirements = uploadRequirements.filter((requirement) => requiredRequirementIds.includes(requirement.id));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[rgba(1,30,65,0.4)] p-4 backdrop-blur-sm">
      <div className="flex min-h-full items-start justify-center py-4 sm:items-center">
        <div className="flex max-h-[calc(100vh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-[30px] border border-black/5 bg-[#fbfaf7] p-6 text-[var(--foreground)] shadow-[0_24px_80px_rgba(1,30,65,0.22)] sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">New audit</p>
              <h2 className="mt-3 text-2xl font-semibold">Create a new audit workspace</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
                Capture the audit details and map incoming CSV files into the operating datasets the platform expects.
                Controls are required. If a risk register is included, a risk-to-control mapping file is required too.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
              aria-label="Close new audit modal"
            >
              <X size={18} />
            </button>
          </div>

          <form className="mt-6 flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
            <div className="grid gap-6 overflow-y-auto pr-1">
              <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="grid gap-4">
                  <Field label="Audit name">
                    <input
                      ref={firstInputRef}
                      required
                      autoFocus
                      value={form.auditName}
                      onChange={(event) => onFormChange((current) => ({ ...current, auditName: event.target.value }))}
                      placeholder="Example: Q3 SOX ITGC Control Testing"
                      className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-bright)]"
                    />
                  </Field>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Audit period start">
                      <input
                        required
                        type="date"
                        value={form.periodStart}
                        onChange={(event) => onFormChange((current) => ({ ...current, periodStart: event.target.value }))}
                        className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-bright)]"
                      />
                    </Field>

                    <Field label="Audit period end">
                      <input
                        required
                        type="date"
                        value={form.periodEnd}
                        onChange={(event) => onFormChange((current) => ({ ...current, periodEnd: event.target.value }))}
                        className="w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none transition-colors focus:border-[var(--brand-indigo-bright)]"
                      />
                    </Field>
                  </div>

                  {form.periodStart && form.periodEnd && form.periodStart > form.periodEnd ? (
                    <p className="text-sm font-medium text-[var(--brand-coral)]">
                      Audit period end must be the same as or later than the start date.
                    </p>
                  ) : null}
                </div>

                <div className="rounded-[26px] border border-black/5 bg-[var(--surface-tint)] p-5">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-[var(--brand-indigo-core)]">
                    <CalendarRange size={18} />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">What this intake captures</h3>
                  <div className="mt-4 grid gap-3 text-sm leading-6 text-[var(--muted)]">
                    <p>The engagement details define the audit workspace and reporting period.</p>
                    <p>Core intake is the minimum required to launch the audit. Workflow and advanced data can be layered in when available.</p>
                    <p>Folder import infers likely matches, but required datasets still have to be fully mapped before upload.</p>
                  </div>
                  {files.risks ? (
                    <p className="mt-4 rounded-[18px] border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.08)] px-4 py-3 text-sm text-[var(--muted)]">
                      Risk register detected. Add the matching risk-to-control file so the audit can load explicit risk-control relationships.
                    </p>
                  ) : null}
                  {missingRequiredRequirementIds.length > 0 ? (
                    <p className="mt-4 rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                      Missing required intake:{" "}
                      {missingRequiredRequirementIds.map((requirementId) => getRequirementLabel(requirementId)).join(", ")}.
                    </p>
                  ) : null}
                </div>
              </div>

              <section className="rounded-[26px] border border-black/5 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Intake mode</p>
                    <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Choose how files are mapped</h3>
                  </div>
                  <div className="inline-flex rounded-full border border-black/5 bg-[var(--surface-tint)] p-1">
                    <button
                      type="button"
                      onClick={() => onUploadModeChange("guided")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        uploadMode === "guided"
                          ? "bg-[var(--brand-indigo-core)] text-white"
                          : "text-[var(--brand-indigo-core)]"
                      }`}
                    >
                      Section by section
                    </button>
                    <button
                      type="button"
                      onClick={() => onUploadModeChange("folder")}
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                        uploadMode === "folder"
                          ? "bg-[var(--brand-indigo-core)] text-white"
                          : "text-[var(--brand-indigo-core)]"
                      }`}
                    >
                      Folder import
                    </button>
                  </div>
                </div>

                {uploadMode === "guided" ? (
                  <div className="mt-5 grid gap-5">
                    {requirementGroups.map((group) => {
                      const groupRequirements = uploadRequirements.filter((requirement) => requirement.category === group.id);

                      return (
                        <section key={group.id} className="grid gap-4 rounded-[24px] border border-black/5 bg-[#fcfbf8] p-5">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{group.title}</p>
                            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">{group.description}</p>
                          </div>

                          {groupRequirements.map((requirement) => {
                            const file = files[requirement.id];
                            const isRequired = requiredRequirementIds.includes(requirement.id);

                            return (
                              <label key={requirement.id} className="grid gap-3 rounded-[20px] border border-black/5 bg-white p-5">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="max-w-3xl">
                                    <div className="flex items-center gap-2">
                                      <p className="text-sm font-semibold text-[var(--foreground)]">{requirement.label}</p>
                                      <RequirementBadge required={isRequired} />
                                    </div>
                                    <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{requirement.description}</p>
                                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">{requirement.helpText}</p>
                                  </div>
                                  <StatusPill complete={Boolean(file)} />
                                </div>

                                <input
                                  type="file"
                                  accept={requirement.accept}
                                  required={isRequired}
                                  onChange={(event) => onFileChange(requirement.id, event)}
                                  className="w-full rounded-2xl border border-black/5 bg-[#fbfaf7] px-4 py-3 text-sm outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[var(--surface-tint)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--brand-indigo-core)]"
                                />

                                <p className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                  {file ? `Selected: ${file.name}` : `Accepted format: ${requirement.accept}`}
                                </p>
                              </label>
                            );
                          })}
                        </section>
                      );
                    })}
                  </div>
                ) : (
                  <div className="mt-5 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
                    <div className="grid gap-4">
                      <div className="rounded-[22px] border border-black/5 bg-[#fcfbf8] p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Folder upload</p>
                            <h4 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Import a CSV folder and review the matches</h4>
                          </div>
                          <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--surface-tint)] text-[var(--brand-indigo-core)]">
                            <Upload size={18} />
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
                          Choose a folder and the modal will infer the best target section for each CSV file. You can adjust the mapping before the audit is created.
                        </p>
                        <input
                          type="file"
                          multiple
                          onChange={onFolderFilesChange}
                          {...folderInputProps}
                          className="mt-4 w-full rounded-2xl border border-black/5 bg-white px-4 py-3 text-sm outline-none file:mr-4 file:rounded-full file:border-0 file:bg-[var(--surface-tint)] file:px-4 file:py-2 file:text-sm file:font-semibold file:text-[var(--brand-indigo-core)]"
                        />
                        <p className="mt-3 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                          Only `.csv` files are considered for import.
                        </p>
                      </div>

                      <div className="grid gap-4">
                        {requirementGroups.map((group) => (
                          <section key={group.id} className="grid gap-3 rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{group.title}</p>
                              <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{group.description}</p>
                            </div>
                            {uploadRequirements
                              .filter((requirement) => requirement.category === group.id)
                              .map((requirement) => {
                                const file = files[requirement.id];

                                return (
                                  <div key={requirement.id} className="rounded-[18px] border border-black/5 bg-white p-4">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-[var(--foreground)]">{requirement.label}</p>
                                          <RequirementBadge required={requiredRequirementIds.includes(requirement.id)} />
                                        </div>
                                        <p className="mt-1.5 text-sm leading-6 text-[var(--muted)]">{requirement.description}</p>
                                      </div>
                                      <StatusPill complete={Boolean(file)} />
                                    </div>
                                    <p className="mt-3 text-sm text-[var(--muted)]">
                                      {file ? `Mapped file: ${file.name}` : "No file mapped to this section yet."}
                                    </p>
                                  </div>
                                );
                              })}
                          </section>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-black/5 bg-[#fcfbf8] p-5">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Mapping review</p>
                          <h4 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Visual file-to-section mapping</h4>
                        </div>
                        <div className="rounded-full bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
                          {folderMappedFiles.length} file{folderMappedFiles.length === 1 ? "" : "s"}
                        </div>
                      </div>

                      {folderMappedFiles.length === 0 ? (
                        <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
                          No folder selected yet. Once you choose a folder, each CSV appears here with its suggested target and an override selector.
                        </p>
                      ) : (
                      <div className="mt-4 grid gap-3">
                          {folderMappedFiles
                            .slice()
                            .sort((left, right) => {
                              if (left.assignedTarget && !right.assignedTarget) {
                                return -1;
                              }

                              if (!left.assignedTarget && right.assignedTarget) {
                                return 1;
                              }

                              return right.suggestionScore - left.suggestionScore;
                            })
                            .map((item) => (
                            <div
                              key={item.id}
                              className={`rounded-[18px] border p-4 ${
                                item.assignedTarget
                                  ? "border-black/5 bg-white"
                                  : "border-[rgba(229,55,107,0.32)] bg-[rgba(229,55,107,0.04)]"
                              }`}
                            >
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-semibold text-[var(--foreground)]">{item.file.name}</p>
                                  <p className="mt-1 truncate text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                    Path: {item.relativePath}
                                  </p>
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${
                                        item.suggestionScore >= 4
                                          ? "bg-[rgba(5,171,140,0.12)] text-[var(--brand-teal-core)]"
                                          : item.suggestionScore >= 2
                                            ? "bg-[rgba(245,168,0,0.16)] text-[var(--brand-amber-dark)]"
                                            : "bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]"
                                      }`}
                                    >
                                      {item.suggestionScore >= 4 ? "High confidence" : item.suggestionScore >= 2 ? "Medium confidence" : "Low confidence"}
                                    </span>
                                    <span className="text-xs uppercase tracking-[0.16em] text-[var(--muted)]">
                                      Suggested: {item.suggestedTarget ? getRequirementLabel(item.suggestedTarget) : "No confident match"}
                                    </span>
                                  </div>
                                  {item.suggestionReason.length > 0 ? (
                                    <p className="mt-2 text-sm text-[var(--muted)]">
                                      Match signals: {item.suggestionReason.join(", ")}
                                    </p>
                                  ) : null}
                                </div>
                                <select
                                  value={item.assignedTarget ?? ""}
                                  onChange={(event) =>
                                    onMappedFileTargetChange(
                                      item.id,
                                      (event.target.value as UploadRequirement["id"] | "") ?? "",
                                    )
                                  }
                                  className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-4 py-2 text-sm text-[var(--foreground)] outline-none"
                                >
                                  <option value="">Leave unassigned</option>
                                  {uploadRequirements.map((requirement) => (
                                    <option
                                      key={requirement.id}
                                      value={requirement.id}
                                      disabled={
                                        folderMappedFiles.some(
                                          (mappedFile) =>
                                            mappedFile.id !== item.id && mappedFile.assignedTarget === requirement.id,
                                        )
                                      }
                                    >
                                      {requirement.label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              {!item.assignedTarget ? (
                                <p className="mt-3 text-sm font-medium text-[var(--brand-coral)]">
                                  Assign this uploaded dataset to an intake section before creating the audit.
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      {unmatchedFiles.length > 0 ? (
                        <div className="mt-4 rounded-[18px] border border-[rgba(245,168,0,0.18)] bg-[rgba(245,168,0,0.08)] p-4 text-sm text-[var(--muted)]">
                          Unassigned files will not be uploaded until they are mapped to one of the intake sections above.
                        </div>
                      ) : null}
                      {missingRequiredRequirementIds.length > 0 ? (
                        <div className="mt-4 rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] p-4 text-sm text-[var(--brand-coral)]">
                          Create audit remains disabled until these required sections are mapped:{" "}
                          {requiredRequirements
                            .filter((requirement) => missingRequiredRequirementIds.includes(requirement.id))
                            .map((requirement) => requirement.label)
                            .join(", ")}
                          .
                        </div>
                      ) : null}
                      {folderMappedFiles.length > 0 ? (
                        <div className="mt-4 rounded-[18px] border border-black/5 bg-white p-4 text-sm text-[var(--muted)]">
                          {mappedFiles.length} mapped, {unmatchedFiles.length} awaiting assignment.
                        </div>
                      ) : null}
                    </div>
                  </div>
                )}
              </section>

              {saveError ? (
                <p className="rounded-[18px] border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] px-4 py-3 text-sm text-[var(--brand-coral)]">
                  {saveError}
                </p>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-black/5 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-[var(--muted)]">
                Create audit stays disabled until the audit name, valid date range, and all required datasets are provided.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSavingAudit}
                  className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canCreateAudit || isSavingAudit}
                  className="rounded-full bg-[var(--brand-indigo-core)] px-5 py-2 text-sm font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {isSavingAudit ? "Saving upload..." : "Create audit"}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}

function RequirementBadge({ required }: { required: boolean }) {
  return required ? (
    <span className="rounded-full bg-[rgba(245,168,0,0.14)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-amber-dark)]">
      Required
    </span>
  ) : (
    <span className="rounded-full bg-[rgba(0,46,98,0.08)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
      Optional
    </span>
  );
}

function StatusPill({ complete }: { complete: boolean }) {
  return complete ? (
    <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(5,171,140,0.22)] bg-[rgba(5,171,140,0.12)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-teal-core)]">
      <CheckCircle2 size={14} />
      Added
    </div>
  ) : (
    <div className="inline-flex items-center gap-2 rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
      Pending
    </div>
  );
}

function createFolderMappedFiles(files: File[]) {
  const nextAssignments = new Set<UploadRequirement["id"]>();

  return files.map((file, index) => {
    const suggestion = inferUploadTarget(file);
    const relativePath = getRelativePath(file);
    const assignedTarget =
      suggestion.target && !nextAssignments.has(suggestion.target) ? suggestion.target : null;

    if (assignedTarget) {
      nextAssignments.add(assignedTarget);
    }

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

function inferUploadTarget(file: File) {
  const searchableText = `${file.name} ${getRelativePath(file)}`.trim();
  const normalizedSearchableText = normalizeValue(searchableText);
  let bestMatch: UploadRequirement["id"] | null = null;
  let bestScore = 0;
  let bestReasons: string[] = [];

  for (const requirement of uploadRequirements) {
    const matchedKeywords = requirement.keywords.filter((keyword) =>
      normalizedSearchableText.includes(normalizeValue(keyword)),
    );
    const score = matchedKeywords.reduce((total, keyword) => total + getKeywordWeight(keyword), 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = requirement.id;
      bestReasons = matchedKeywords;
    }
  }

  return {
    target: bestScore > 0 ? bestMatch : null,
    score: bestScore,
    reasons: bestReasons,
  };
}

function getRequirementLabel(requirementId: UploadRequirement["id"]) {
  return uploadRequirements.find((item) => item.id === requirementId)?.label ?? requirementId;
}

function normalizeValue(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function getRelativePath(file: File) {
  return "webkitRelativePath" in file && typeof file.webkitRelativePath === "string" && file.webkitRelativePath.length > 0
    ? file.webkitRelativePath
    : file.name;
}

function getKeywordWeight(keyword: string) {
  const normalizedKeyword = normalizeValue(keyword);

  if (
    normalizedKeyword === "controls" ||
    normalizedKeyword === "riskcontrol" ||
    normalizedKeyword === "riskcontrollinks" ||
    normalizedKeyword === "riskcontrolmapping" ||
    normalizedKeyword === "questions" ||
    normalizedKeyword === "requests" ||
    normalizedKeyword === "documents" ||
    normalizedKeyword === "applications" ||
    normalizedKeyword === "risks" ||
    normalizedKeyword === "issues"
  ) {
    return 3;
  }

  return 1;
}

function formatDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
