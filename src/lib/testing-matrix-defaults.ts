import type { ControlTestingMatrixAttribute } from "@/types/audit";

export const defaultTestingMatrixAttributeDefinitions = [
  {
    attributeKey: "control_complete",
    label: "Was the control performed completely?",
    guidance: "Confirm the control was performed fully for the sampled item or period.",
  },
  {
    attributeKey: "control_timely",
    label: "Was the control completed timely?",
    guidance: "Validate timing relative to the required cadence or deadline.",
  },
  {
    attributeKey: "control_accurate",
    label: "Was the control completed accurately?",
    guidance: "Confirm the control execution and retained evidence support an accurate outcome.",
  },
] as const;

export function buildDefaultTestingMatrixAttributes(matrixId: string): ControlTestingMatrixAttribute[] {
  return defaultTestingMatrixAttributeDefinitions.map((attribute, index) => ({
    id: "",
    matrixId,
    attributeKey: attribute.attributeKey,
    label: attribute.label,
    guidance: attribute.guidance,
    displayOrder: index + 1,
  }));
}
