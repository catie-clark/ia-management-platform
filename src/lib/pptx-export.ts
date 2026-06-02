// Client-side helper: requests a server-generated tollgate .pptx and downloads it.
// Generation runs server-side (api/pptx-export) so pptxgenjs's Node build is used
// and never bundled into the browser.

export type DeckSection = {
  heading: string;
  body: string[];
};

function sanitizeFileName(value: string) {
  return value.replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "") || "deck";
}

export async function downloadDraftAsPptx({
  auditLabel,
  label,
  markdown,
  previewSections,
  previewSummary,
}: {
  auditLabel: string;
  label: string;
  markdown: string;
  previewSections: DeckSection[];
  previewSummary: string;
}) {
  const response = await fetch("/api/pptx-export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ auditLabel, label, markdown, previewSections, previewSummary }),
  });

  if (!response.ok) {
    throw new Error("Unable to generate the PowerPoint deck.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizeFileName(auditLabel)}-${sanitizeFileName(label)}.pptx`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
