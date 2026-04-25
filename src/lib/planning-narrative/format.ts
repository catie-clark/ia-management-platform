export type NarrativePreviewSection = {
  body: string[];
  heading: string;
};

export type NarrativePreview = {
  previewSections: NarrativePreviewSection[];
  previewSummary: string;
};

export function buildNarrativePreview(markdown: string): NarrativePreview {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
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

    if (line.startsWith("## ")) {
      flushParagraph();

      if (currentSection) {
        previewSections.push(currentSection);
      }

      currentSection = {
        heading: line.replace(/^##\s+/, "").trim(),
        body: [],
      };
      continue;
    }

    if (line.startsWith("# ")) {
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
