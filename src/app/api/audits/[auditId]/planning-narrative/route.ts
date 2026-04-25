import { NextResponse } from "next/server";
import { z } from "zod";

import { buildNarrativePreview } from "@/lib/planning-narrative/format";
import { getPlanningNarrativeViewModel } from "@/lib/planning-narrative/view-model";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const updatePlanningNarrativeDraftSchema = z.object({
  markdown: z.string().min(1),
});

type PlanningNarrativeDocumentRow = {
  id: string;
  status: string;
  template_name: string | null;
  title: string;
  updated_at: string;
  source_payload: Record<string, unknown>;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("audit_documents")
      .select("id, title, status, template_name, updated_at, source_payload")
      .eq("audit_id", auditId)
      .eq("document_type", "PLANNING_NARRATIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<PlanningNarrativeDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      return NextResponse.json({
        draft: null,
      });
    }

    return NextResponse.json({
      draft: {
        documentId: data.id,
        generatedAt: data.updated_at,
        markdown: readString(data.source_payload, "generated_markdown") ?? "",
        missingRequiredTokens: readStringArray(data.source_payload, "missing_required_tokens"),
        previewSections: readPreviewSections(data.source_payload),
        previewSummary: readString(data.source_payload, "preview_summary") ?? "",
        status: data.status,
        templateName: data.template_name,
        title: data.title,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load the planning narrative.",
      },
      { status: 400 },
    );
  }
}

export async function POST(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const viewModel = await getPlanningNarrativeViewModel(auditId);
    const preview = buildNarrativePreview(viewModel.renderedTemplate);
    const supabase = createSupabaseAdminClient();
    const sourceRecordKey = `planning-narrative-${auditId}`;
    const payload = {
      generated_markdown: viewModel.renderedTemplate,
      missing_required_tokens: viewModel.missingRequiredTokens,
      preview_sections: preview.previewSections,
      preview_summary: preview.previewSummary,
      rendered_template: viewModel.renderedTemplate,
      token_values: viewModel.tokenValues,
      generated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("audit_documents")
      .upsert(
        {
          audit_id: auditId,
          document_type: "PLANNING_NARRATIVE",
          source_record_key: sourceRecordKey,
          source_system: "platform",
          status: "in_progress",
          template_name: "System Planning Narrative Template",
          title: "Planning Narrative Draft",
          source_payload: payload,
        },
        {
          onConflict: "source_record_key",
        },
      )
      .select("id, title, status, template_name, updated_at, source_payload")
      .maybeSingle<PlanningNarrativeDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      draft: {
        documentId: data?.id ?? null,
        generatedAt: data?.updated_at ?? payload.generated_at,
        markdown: viewModel.renderedTemplate,
        missingRequiredTokens: viewModel.missingRequiredTokens,
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        status: data?.status ?? "IN_PROGRESS",
        templateName: data?.template_name ?? "System Planning Narrative Template",
        title: data?.title ?? "Planning Narrative Draft",
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to generate the planning narrative.",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = updatePlanningNarrativeDraftSchema.parse(await request.json());
    const preview = buildNarrativePreview(body.markdown);
    const supabase = createSupabaseAdminClient();
    const { data: existingDraft, error: lookupError } = await supabase
      .from("audit_documents")
      .select("id, source_payload")
      .eq("audit_id", auditId)
      .eq("document_type", "PLANNING_NARRATIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string; source_payload: Record<string, unknown> }>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingDraft) {
      return NextResponse.json({ error: "No planning narrative draft exists for this audit yet." }, { status: 404 });
    }

    const nextPayload = {
      ...existingDraft.source_payload,
      generated_markdown: body.markdown,
      preview_sections: preview.previewSections,
      preview_summary: preview.previewSummary,
      edited_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("audit_documents")
      .update({
        source_payload: nextPayload,
        status: "in_progress",
      })
      .eq("id", existingDraft.id)
      .select("id, title, status, template_name, updated_at, source_payload")
      .maybeSingle<PlanningNarrativeDocumentRow>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      draft: {
        documentId: data?.id ?? existingDraft.id,
        generatedAt: data?.updated_at ?? new Date().toISOString(),
        markdown: body.markdown,
        missingRequiredTokens: readStringArray(nextPayload, "missing_required_tokens"),
        previewSections: preview.previewSections,
        previewSummary: preview.previewSummary,
        status: data?.status ?? "IN_PROGRESS",
        templateName: data?.template_name ?? "System Planning Narrative Template",
        title: data?.title ?? "Planning Narrative Draft",
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid planning narrative payload." }, { status: 400 });
    }

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the planning narrative.",
      },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data: existingDraft, error: lookupError } = await supabase
      .from("audit_documents")
      .select("id")
      .eq("audit_id", auditId)
      .eq("document_type", "PLANNING_NARRATIVE")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle<{ id: string }>();

    if (lookupError) {
      throw new Error(lookupError.message);
    }

    if (!existingDraft) {
      return NextResponse.json({
        draft: null,
      });
    }

    const { error } = await supabase.from("audit_documents").delete().eq("id", existingDraft.id);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      draft: null,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to reset the planning narrative.",
      },
      { status: 400 },
    );
  }
}

function readString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  return typeof value === "string" ? value : null;
}

function readStringArray(payload: Record<string, unknown>, key: string) {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((entry) => String(entry));
}

function readPreviewSections(payload: Record<string, unknown>) {
  const value = payload.preview_sections;

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((section) => {
      if (!section || typeof section !== "object") {
        return null;
      }

      const candidate = section as { heading?: unknown; body?: unknown };

      if (typeof candidate.heading !== "string" || !Array.isArray(candidate.body)) {
        return null;
      }

      return {
        heading: candidate.heading,
        body: candidate.body.map((entry) => String(entry)),
      };
    })
    .filter((section): section is { heading: string; body: string[] } => section !== null);
}
