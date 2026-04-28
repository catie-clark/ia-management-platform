import { readFile } from "node:fs/promises";
import path from "node:path";

import { getPlanningNarrativeViewModel } from "@/lib/planning-narrative/view-model";

export type PlanningTollgateViewModel = {
  auditId: string;
  missingRequiredTokens: string[];
  renderedTemplate: string;
  template: string;
  tokenValues: Record<string, string>;
};

export async function getPlanningTollgateViewModel(auditId: string): Promise<PlanningTollgateViewModel> {
  const template = await loadPlanningTollgateTemplate();
  const narrativeViewModel = await getPlanningNarrativeViewModel(auditId);
  const renderedTemplate = renderPlanningTollgateTemplate(template, narrativeViewModel.tokenValues);
  const missingRequiredTokens = narrativeViewModel.missingRequiredTokens.filter(
    (token) => renderedTemplate.includes(`{{${token}}}`),
  );

  return {
    auditId,
    missingRequiredTokens,
    renderedTemplate,
    template,
    tokenValues: narrativeViewModel.tokenValues,
  };
}

async function loadPlanningTollgateTemplate() {
  const templatePath = path.join(process.cwd(), "src", "lib", "planning-tollgate", "template.md");
  return readFile(templatePath, "utf8");
}

function renderPlanningTollgateTemplate(template: string, tokenValues: Record<string, string>) {
  return template.replace(/\{\{([a-z0-9_]+)\}\}/gi, (_, token: string) => tokenValues[token] ?? `{{${token}}}`);
}
