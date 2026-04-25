import type { AuditPhase } from "@/types/audit";

export function normalizeAuditPhase(value?: string | null): AuditPhase {
  switch (value?.trim().toLowerCase()) {
    case "planning":
      return "Planning";
    case "reporting":
      return "Reporting";
    default:
      return value?.trim().toLowerCase() === "fieldwork" ? "Fieldwork" : "Planning";
  }
}

export function getNextAuditPhase(phase: AuditPhase): AuditPhase | null {
  if (phase === "Planning") {
    return "Fieldwork";
  }

  if (phase === "Fieldwork") {
    return "Reporting";
  }

  return null;
}
