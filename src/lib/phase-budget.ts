import { budgetByPhase as prototypeBudgetByPhase } from "@/lib/data/mock-data";
import type { AuditPhase, BudgetByPhase } from "@/types/audit";

type AuditPhaseBudgetFields = {
  fieldwork_budget_hours?: number | null;
  planning_budget_hours?: number | null;
  reporting_budget_hours?: number | null;
};

const phaseOrder: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];

export function getPrototypePhaseBudgets() {
  return prototypeBudgetByPhase.map((phaseBudget) => ({
    ...phaseBudget,
    isSet: phaseBudget.isSet ?? true,
  }));
}

export function buildLivePhaseBudgetPlan(audit: AuditPhaseBudgetFields): BudgetByPhase[] {
  return phaseOrder.map((phase) => {
    const configuredValue =
      phase === "Planning"
        ? audit.planning_budget_hours
        : phase === "Fieldwork"
          ? audit.fieldwork_budget_hours
          : audit.reporting_budget_hours;

    return {
      phase,
      plannedHours: configuredValue === null || configuredValue === undefined ? 0 : Number(configuredValue),
      actualHours: 0,
      isSet: configuredValue !== null && configuredValue !== undefined,
    };
  });
}

export function sumPhasePlannedHours(phaseBudgets: BudgetByPhase[]) {
  return phaseBudgets.reduce((sum, phaseBudget) => sum + phaseBudget.plannedHours, 0);
}

export function sumPhaseActualHours(phaseBudgets: BudgetByPhase[]) {
  return phaseBudgets.reduce((sum, phaseBudget) => sum + phaseBudget.actualHours, 0);
}

export function getCurrentPhaseBudget(phaseBudgets: BudgetByPhase[], currentPhase: AuditPhase) {
  return phaseBudgets.find((phaseBudget) => phaseBudget.phase === currentPhase) ?? phaseBudgets[0];
}
