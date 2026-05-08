import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const createBusinessContactSchema = z.object({
  contactEmail: z.string().trim().email().optional().or(z.literal("")),
  contactName: z.string().trim().min(1),
  contactTitle: z.string().trim().optional().or(z.literal("")),
  functionalArea: z.string().trim().min(1),
  notes: z.string().trim().optional().or(z.literal("")),
});

type BusinessContactRow = {
  id: string;
  contact_email: string | null;
  contact_name: string;
  contact_title: string | null;
  functional_area: string;
  notes: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("business_contacts")
      .select("id, functional_area, contact_name, contact_email, contact_title, notes")
      .eq("audit_id", auditId)
      .order("functional_area", { ascending: true })
      .order("contact_name", { ascending: true })
      .returns<BusinessContactRow[]>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      contacts: (data ?? []).map(mapBusinessContact),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load business contacts." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const body = createBusinessContactSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();

    const { data, error } = await supabase
      .from("business_contacts")
      .insert({
        audit_id: auditId,
        functional_area: body.functionalArea,
        contact_name: body.contactName,
        contact_email: body.contactEmail || null,
        contact_title: body.contactTitle || null,
        notes: body.notes || null,
        source_system: "platform",
      })
      .select("id, functional_area, contact_name, contact_email, contact_title, notes")
      .maybeSingle<BusinessContactRow>();

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({
      contact: data ? mapBusinessContact(data) : null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid business contact payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create the business contact." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const contactId = new URL(request.url).searchParams.get("contactId");

    if (!contactId) {
      return NextResponse.json({ error: "contactId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("business_contacts").delete().eq("audit_id", auditId).eq("id", contactId);

    if (error) {
      throw new Error(error.message);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to delete the business contact." },
      { status: 400 },
    );
  }
}

function mapBusinessContact(row: BusinessContactRow) {
  return {
    id: row.id,
    functionalArea: row.functional_area,
    contactName: row.contact_name,
    contactEmail: row.contact_email,
    contactTitle: row.contact_title,
    notes: row.notes,
  };
}
