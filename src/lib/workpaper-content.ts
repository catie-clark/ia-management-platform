import type { AuditDocument, WorkpaperContent } from "@/types/audit";

const emptyWorkpaperContent: WorkpaperContent = {
  summary: "",
  objective: "",
  scope: "",
  procedures: "",
  results: "",
  conclusion: "",
  nextSteps: "",
};

export function getEmptyWorkpaperContent(): WorkpaperContent {
  return { ...emptyWorkpaperContent };
}

export function readWorkpaperContent(payload: Record<string, unknown>, previewSections?: AuditDocument["previewSections"]): WorkpaperContent | undefined {
  const candidate = payload.workpaper_content;

  if (candidate && typeof candidate === "object") {
    const raw = candidate as Record<string, unknown>;

    return {
      summary: readText(raw.summary),
      objective: readText(raw.objective),
      scope: readText(raw.scope),
      procedures: readText(raw.procedures),
      results: readText(raw.results),
      conclusion: readText(raw.conclusion),
      nextSteps: readText(raw.next_steps),
    };
  }

  if (!previewSections || previewSections.length === 0) {
    return undefined;
  }

  const sectionMap = new Map(previewSections.map((section) => [normalizeHeading(section.heading), section.body.join("\n\n")]));

  return {
    summary: "",
    objective: sectionMap.get("objective") ?? "",
    scope: sectionMap.get("scope") ?? sectionMap.get("scope and population") ?? "",
    procedures: sectionMap.get("procedures performed") ?? sectionMap.get("procedures") ?? "",
    results: sectionMap.get("preliminary results") ?? sectionMap.get("results") ?? "",
    conclusion: sectionMap.get("conclusion") ?? "",
    nextSteps: sectionMap.get("next steps") ?? "",
  };
}

export function buildWorkpaperPreview(content: WorkpaperContent) {
  const previewSections = [
    buildSection("Objective", content.objective),
    buildSection("Scope and Population", content.scope),
    buildSection("Procedures Performed", content.procedures),
    buildSection("Results", content.results),
    buildSection("Conclusion", content.conclusion),
    buildSection("Next Steps", content.nextSteps),
  ].filter((section): section is { heading: string; body: string[] } => section !== null);

  return {
    previewSummary: content.summary.trim() || firstParagraph(content.objective) || firstParagraph(content.results) || "Workpaper draft prepared in the platform.",
    previewSections,
  };
}

function buildSection(heading: string, value: string) {
  const paragraphs = value
    .split(/\r?\n\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return null;
  }

  return {
    heading,
    body: paragraphs,
  };
}

function firstParagraph(value: string) {
  return value
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .find(Boolean) ?? "";
}

function readText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeHeading(value: string) {
  return value.trim().toLowerCase();
}
