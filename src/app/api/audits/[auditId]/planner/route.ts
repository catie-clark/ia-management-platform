import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const nullableHoursSchema = z.number().min(0).nullable();
const requiredDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable();

const updateAuditPlannerSchema = z
  .object({
    fieldworkBudgetHours: nullableHoursSchema,
    fieldworkStartDate: nullableDateSchema,
    periodEnd: requiredDateSchema,
    periodStart: requiredDateSchema,
    planningBudgetHours: nullableHoursSchema,
    planningStartDate: nullableDateSchema,
    reportingBudgetHours: nullableHoursSchema,
    reportingStartDate: nullableDateSchema,
    totalBudgetHours: nullableHoursSchema,
  })
  .superRefine((value, context) => {
    validateDateRange(value.periodStart, value.periodEnd, "periodEnd", "Audit end date must be on or after the start date.", context);
    validateOptionalDateRange(
      value.planningStartDate ?? value.periodStart,
      value.fieldworkStartDate,
      "fieldworkStartDate",
      "Fieldwork should not start before planning.",
      context,
    );
    validateOptionalDateRange(
      value.fieldworkStartDate ?? value.planningStartDate ?? value.periodStart,
      value.reportingStartDate,
      "reportingStartDate",
      "Reporting should not start before fieldwork.",
      context,
    );

    if (value.planningStartDate && value.planningStartDate < value.periodStart) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Planning start date must be on or after the audit start date.",
        path: ["planningStartDate"],
      });
    }

    if (value.reportingStartDate && value.reportingStartDate > value.periodEnd) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reporting start date must be on or before the audit end date.",
        path: ["reportingStartDate"],
      });
    }
  });

type AuditPlannerRecord = {
  id: string;
  fieldwork_budget_hours: number | null;
  fieldwork_end_date: string | null;
  fieldwork_start_date: string | null;
  period_end: string | null;
  period_start: string | null;
  planning_budget_hours: number | null;
  planning_end_date: string | null;
  planning_start_date: string | null;
  reporting_budget_hours: number | null;
  reporting_end_date: string | null;
  reporting_start_date: string | null;
  total_budget_hours: number | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updateAuditPlannerSchema.parse(await request.json());
    const planningStartDate = body.planningStartDate ?? body.periodStart;
    const fieldworkStartDate = body.fieldworkStartDate;
    const reportingStartDate = body.reportingStartDate;
    const planningEndDate = fieldworkStartDate;
    const fieldworkEndDate = reportingStartDate;
    const reportingEndDate = body.periodEnd;
    const supabase = createSupabaseAdminClient();
    const { data: audit, error: lookupError } = await selectPlannerAudit(supabase, auditId);

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const { data: updatedAudit, error: updateError } = await updatePlannerAudit(supabase, auditId, {
      totalBudgetHours: body.totalBudgetHours,
      planningBudgetHours: body.planningBudgetHours,
      fieldworkBudgetHours: body.fieldworkBudgetHours,
      reportingBudgetHours: body.reportingBudgetHours,
      periodStart: body.periodStart,
      periodEnd: body.periodEnd,
      planningStartDate,
      planningEndDate,
      fieldworkStartDate,
      fieldworkEndDate,
      reportingStartDate,
      reportingEndDate,
    });

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      auditId,
      totalBudgetHours: toNullableNumber(updatedAudit?.total_budget_hours ?? body.totalBudgetHours),
      planningBudgetHours: toNullableNumber(updatedAudit?.planning_budget_hours ?? body.planningBudgetHours),
      fieldworkBudgetHours: toNullableNumber(updatedAudit?.fieldwork_budget_hours ?? body.fieldworkBudgetHours),
      reportingBudgetHours: toNullableNumber(updatedAudit?.reporting_budget_hours ?? body.reportingBudgetHours),
      periodStart: updatedAudit?.period_start ?? body.periodStart,
      periodEnd: updatedAudit?.period_end ?? body.periodEnd,
      planningStartDate: updatedAudit?.planning_start_date ?? planningStartDate,
      planningEndDate: updatedAudit?.planning_end_date ?? planningEndDate,
      fieldworkStartDate: updatedAudit?.fieldwork_start_date ?? fieldworkStartDate,
      fieldworkEndDate: updatedAudit?.fieldwork_end_date ?? fieldworkEndDate,
      reportingStartDate: updatedAudit?.reporting_start_date ?? reportingStartDate,
      reportingEndDate: updatedAudit?.reporting_end_date ?? reportingEndDate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid planner payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the audit planner.",
      },
      { status: 400 },
    );
  }
}

async function selectPlannerAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
) {
  try {
    return await supabase
      .from("audits")
      .select(
        "id, total_budget_hours, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date",
      )
      .eq("id", auditId)
      .maybeSingle<AuditPlannerRecord>();
  } catch (error) {
    if (!isMissingTotalBudgetHoursColumnError(error)) {
      throw error;
    }

    const fallbackResult = await supabase
      .from("audits")
      .select(
        "id, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date",
      )
      .eq("id", auditId)
      .maybeSingle<Omit<AuditPlannerRecord, "total_budget_hours">>();

    return {
      ...fallbackResult,
      data: fallbackResult.data
        ? {
            ...fallbackResult.data,
            total_budget_hours: null,
          }
        : null,
    };
  }
}

async function updatePlannerAudit(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
  values: {
    totalBudgetHours: number | null;
    planningBudgetHours: number | null;
    fieldworkBudgetHours: number | null;
    reportingBudgetHours: number | null;
    periodStart: string;
    periodEnd: string;
    planningStartDate: string;
    planningEndDate: string | null;
    fieldworkStartDate: string | null;
    fieldworkEndDate: string | null;
    reportingStartDate: string | null;
    reportingEndDate: string;
  },
) {
  const baseUpdate = {
    planning_budget_hours: values.planningBudgetHours,
    fieldwork_budget_hours: values.fieldworkBudgetHours,
    reporting_budget_hours: values.reportingBudgetHours,
    period_start: values.periodStart,
    period_end: values.periodEnd,
    planning_start_date: values.planningStartDate,
    planning_end_date: values.planningEndDate,
    fieldwork_start_date: values.fieldworkStartDate,
    fieldwork_end_date: values.fieldworkEndDate,
    reporting_start_date: values.reportingStartDate,
    reporting_end_date: values.reportingEndDate,
  };

  try {
    return await supabase
      .from("audits")
      .update({
        ...baseUpdate,
        total_budget_hours: values.totalBudgetHours,
      })
      .eq("id", auditId)
      .select(
        "id, total_budget_hours, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date",
      )
      .maybeSingle<AuditPlannerRecord>();
  } catch (error) {
    if (!isMissingTotalBudgetHoursColumnError(error)) {
      throw error;
    }

    const fallbackResult = await supabase
      .from("audits")
      .update(baseUpdate)
      .eq("id", auditId)
      .select(
        "id, planning_budget_hours, fieldwork_budget_hours, reporting_budget_hours, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date",
      )
      .maybeSingle<Omit<AuditPlannerRecord, "total_budget_hours">>();

    return {
      ...fallbackResult,
      data: fallbackResult.data
        ? {
            ...fallbackResult.data,
            total_budget_hours: null,
          }
        : null,
    };
  }
}

function isMissingTotalBudgetHoursColumnError(error: unknown) {
  return error instanceof Error && error.message.includes("total_budget_hours");
}

function validateDateRange(
  start: string,
  end: string,
  path: keyof z.infer<typeof updateAuditPlannerSchema>,
  message: string,
  context: z.RefinementCtx,
) {
  if (new Date(start).getTime() > new Date(end).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: [path],
    });
  }
}

function validateOptionalDateRange(
  start: string | null,
  end: string | null,
  path: keyof z.infer<typeof updateAuditPlannerSchema>,
  message: string,
  context: z.RefinementCtx,
) {
  if (!start || !end) {
    return;
  }

  validateDateRange(start, end, path, message, context);
}

function toNullableNumber(value: number | null) {
  if (value === null || value === undefined) {
    return null;
  }

  return Number(value);
}
