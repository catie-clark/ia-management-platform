export type NarrativePreviewSection = {
  body: string[];
  heading: string;
};

export type NarrativePreview = {
  previewSections: NarrativePreviewSection[];
  previewSummary: string;
};

export function sanitizeDraftMarkdown(markdown: string) {
  return markdown
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((rawLine) => {
      let line = rawLine.replace(/^#{1,6}\s+/, "");
      line = line.replace(/\*\*(.*?)\*\*/g, "$1");
      line = line.replace(/__(.*?)__/g, "$1");
      line = line.replace(/\s{2,}$/g, "");
      return line;
    })
    .join("\n");
}

export function buildNarrativePreview(markdown: string): NarrativePreview {
  const lines = sanitizeDraftMarkdown(markdown).split("\n");
  const previewSections: NarrativePreviewSection[] = [];
  let currentSection: NarrativePreviewSection | null = null;
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (!currentSection || paragraphBuffer.length === 0) {
      paragraphBuffer = [];
      return;
    }

    currentSection.body.push(paragraphBuffer.join(" ").trim());
    paragraphBuffer = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (isSectionHeading(line)) {
      flushParagraph();

      if (currentSection) {
        previewSections.push(currentSection);
      }

      currentSection = {
        heading: line.trim(),
        body: [],
      };
      continue;
    }

    if (isDocumentTitle(line, currentSection)) {
      continue;
    }

    if (!currentSection) {
      currentSection = {
        heading: "Overview",
        body: [],
      };
    }

    if (line.length === 0) {
      flushParagraph();
      continue;
    }

    if (line.startsWith("- ")) {
      flushParagraph();
      currentSection.body.push(line);
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();

  if (currentSection) {
    previewSections.push(currentSection);
  }

  const previewSummary =
    previewSections.flatMap((section) => section.body).find((entry) => !entry.startsWith("- ")) ??
    "Planning narrative draft generated from the current audit data.";

  return {
    previewSections,
    previewSummary,
  };
}

function isSectionHeading(line: string) {
  return /^\d+\.\s+/.test(line);
}

function isDocumentTitle(line: string, currentSection: NarrativePreviewSection | null) {
  return currentSection === null && /^Internal Audit /i.test(line);
}
