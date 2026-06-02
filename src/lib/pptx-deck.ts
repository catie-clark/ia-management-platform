// Server-side PowerPoint (.pptx) generation for tollgate decks.
// Runs in the Node runtime (see the api/pptx-export route) where pptxgenjs's
// Node build and its node: builtins resolve correctly.
import PptxGenJS from "pptxgenjs";

export type DeckSection = {
  heading: string;
  body: string[];
};

export type DeckInput = {
  auditLabel: string;
  label: string;
  markdown: string;
  previewSections: DeckSection[];
  previewSummary: string;
};

const BRAND_INDIGO = "002E62";
const BRAND_AMBER = "F5A800";
const BODY_COLOR = "333333";
const MUTED_COLOR = "6B7280";

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "deck";
}

function sectionsFromMarkdown(markdown: string): DeckSection[] {
  const sections: DeckSection[] = [];
  let current: DeckSection | null = null;

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trimEnd();
    const headingMatch = line.match(/^#{1,6}\s+(.*)$/);

    if (headingMatch) {
      current = { heading: headingMatch[1].trim(), body: [] };
      sections.push(current);
      continue;
    }

    if (line.trim().length === 0) {
      continue;
    }

    if (!current) {
      current = { heading: "Overview", body: [] };
      sections.push(current);
    }

    current.body.push(line.trim());
  }

  return sections;
}

export async function buildTollgateDeck(input: DeckInput): Promise<{ buffer: Buffer; fileName: string }> {
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pptx.author = "Internal Audit Platform";
  pptx.company = input.auditLabel;

  const title = pptx.addSlide();
  title.background = { color: "F6F1E8" };
  title.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.25, fill: { color: BRAND_AMBER } });
  title.addText(input.label, { x: 0.7, y: 2.4, w: 12, h: 1.2, fontSize: 36, bold: true, color: BRAND_INDIGO });
  title.addText(input.auditLabel, { x: 0.7, y: 3.6, w: 12, h: 0.6, fontSize: 20, color: MUTED_COLOR });
  if (input.previewSummary) {
    title.addText(input.previewSummary, { x: 0.7, y: 4.4, w: 12, h: 2, fontSize: 14, color: BODY_COLOR, valign: "top" });
  }

  const sections = input.previewSections.length > 0 ? input.previewSections : sectionsFromMarkdown(input.markdown);

  for (const section of sections) {
    const slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    slide.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.12, fill: { color: BRAND_INDIGO } });
    slide.addText(section.heading || "Section", {
      x: 0.6,
      y: 0.4,
      w: 12.1,
      h: 0.8,
      fontSize: 24,
      bold: true,
      color: BRAND_INDIGO,
    });

    const bodyItems = (section.body.length > 0 ? section.body : ["(No content)"]).map((entry) => {
      const isBullet = entry.startsWith("- ");
      return {
        text: isBullet ? entry.slice(2) : entry,
        options: { bullet: isBullet, paraSpaceAfter: 6 },
      };
    });

    slide.addText(bodyItems, { x: 0.7, y: 1.5, w: 12, h: 5.4, fontSize: 14, color: BODY_COLOR, valign: "top" });
  }

  const data = (await pptx.write({ outputType: "nodebuffer" })) as Buffer;
  return { buffer: data, fileName: `${sanitizeFileName(input.auditLabel)}-${sanitizeFileName(input.label)}.pptx` };
}
