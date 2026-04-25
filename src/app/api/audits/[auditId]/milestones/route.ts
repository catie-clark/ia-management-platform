import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const nullableDateSchema = z.string().min(1).nullable();

const updateMilestonesSchema = z
  .object({
    fieldworkEndDate: nullableDateSchema,
    fieldworkStartDate: nullableDateSchema,
    periodEnd: z.string().min(1),
    periodStart: z.string().min(1),
    planningEndDate: nullableDateSchema,
    planningStartDate: nullableDateSchema,
    reportingEndDate: nullableDateSchema,
    reportingStartDate: nullableDateSchema,
  })
  .superRefine((value, context) => {
    validateDateRange(value.periodStart, value.periodEnd, "periodEnd", "Audit end date must be on or after the start date.", context);
    validateOptionalDateRange(
      value.planningStartDate,
      value.planningEndDate,
      "planningEndDate",
      "Planning end date must be on or after the planning start date.",
      context,
    );
    validateOptionalDateRange(
      value.fieldworkStartDate,
      value.fieldworkEndDate,
      "fieldworkEndDate",
      "Fieldwork end date must be on or after the fieldwork start date.",
      context,
    );
    validateOptionalDateRange(
      value.reportingStartDate,
      value.reportingEndDate,
      "reportingEndDate",
      "Reporting end date must be on or after the reporting start date.",
      context,
    );
    validateOptionalDateRange(
      value.planningEndDate,
      value.fieldworkStartDate,
      "fieldworkStartDate",
      "Fieldwork should not start before planning ends.",
      context,
    );
    validateOptionalDateRange(
      value.fieldworkEndDate,
      value.reportingStartDate,
      "reportingStartDate",
      "Reporting should not start before fieldwork ends.",
      context,
    );
  });

type AuditMilestoneRecord = {
  id: string;
  fieldwork_end_date: string | null;
  fieldwork_start_date: string | null;
  period_end: string | null;
  period_start: string | null;
  planning_end_date: string | null;
  planning_start_date: string | null;
  reporting_end_date: string | null;
  reporting_start_date: string | null;
};

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updateMilestonesSchema.parse(await request.json());
    const normalizedPlanningStartDate = body.planningStartDate ?? body.periodStart;
    const normalizedFieldworkStartDate = body.fieldworkStartDate ?? body.planningEndDate;
    const normalizedReportingStartDate = body.reportingStartDate ?? body.fieldworkEndDate;
    const normalizedReportingEndDate = body.reportingEndDate ?? body.periodEnd;
    const supabase = createSupabaseAdminClient();
    const { data: audit, error: lookupError } = await supabase
      .from("audits")
      .select("id, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date")
      .eq("id", auditId)
      .maybeSingle<AuditMilestoneRecord>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const { data: updatedAudit, error: updateError } = await supabase
      .from("audits")
      .update({
        fieldwork_end_date: body.fieldworkEndDate,
        fieldwork_start_date: normalizedFieldworkStartDate,
        period_start: body.periodStart,
        period_end: body.periodEnd,
        planning_end_date: body.planningEndDate,
        planning_start_date: normalizedPlanningStartDate,
        reporting_end_date: normalizedReportingEndDate,
        reporting_start_date: normalizedReportingStartDate,
      })
      .eq("id", auditId)
      .select("id, period_start, period_end, planning_start_date, planning_end_date, fieldwork_start_date, fieldwork_end_date, reporting_start_date, reporting_end_date")
      .maybeSingle<AuditMilestoneRecord>();

    if (updateError) {
      throw new Error(updateError.message);
    }

    return NextResponse.json({
      auditId,
      fieldworkEndDate: updatedAudit?.fieldwork_end_date ?? body.fieldworkEndDate,
      fieldworkStartDate: updatedAudit?.fieldwork_start_date ?? normalizedFieldworkStartDate,
      periodEnd: updatedAudit?.period_end ?? body.periodEnd,
      periodStart: updatedAudit?.period_start ?? body.periodStart,
      planningEndDate: updatedAudit?.planning_end_date ?? body.planningEndDate,
      planningStartDate: updatedAudit?.planning_start_date ?? normalizedPlanningStartDate,
      reportingEndDate: updatedAudit?.reporting_end_date ?? normalizedReportingEndDate,
      reportingStartDate: updatedAudit?.reporting_start_date ?? normalizedReportingStartDate,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid lifecycle milestone payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the audit lifecycle milestones.",
      },
      { status: 400 },
    );
  }
}

function validateDateRange(
  start: string,
  end: string,
  path: keyof z.infer<typeof updateMilestonesSchema>,
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
  path: keyof z.infer<typeof updateMilestonesSchema>,
  message: string,
  context: z.RefinementCtx,
) {
  if (!start || !end) {
    return;
  }

  validateDateRange(start, end, path, message, context);
}
