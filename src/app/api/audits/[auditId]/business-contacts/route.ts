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

const createExistingUserContactSchema = z.object({
  existingUserId: z.string().uuid(),
  functionalArea: z.string().trim().min(1),
  notes: z.string().trim().optional().or(z.literal("")),
});

const createContactRequestSchema = z.union([createBusinessContactSchema, createExistingUserContactSchema]);

type BusinessContactRow = {
  id: string;
  contact_email: string | null;
  contact_name: string;
  contact_title: string | null;
  functional_area: string;
  notes: string | null;
};

type AuditRecordRow = {
  company_name: string | null;
  id: string;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    await assertAuditExists(supabase, auditId);
    const contacts = await loadBusinessContacts(supabase, auditId);

    return NextResponse.json({
      contacts,
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
    const body = createContactRequestSchema.parse(await request.json());
    const supabase = createSupabaseAdminClient();
    const audit = await assertAuditExists(supabase, auditId);

    const contactPayload =
      "existingUserId" in body
        ? await mapExistingUserToContactPayload(supabase, body.existingUserId, body.functionalArea, body.notes || null, audit.company_name)
        : {
            contact_email: body.contactEmail || null,
            contact_name: body.contactName,
            contact_title: body.contactTitle || null,
            functional_area: body.functionalArea,
            notes: body.notes || null,
          };

    const { data, error } = await supabase
      .from("business_contacts")
      .insert({
        audit_id: auditId,
        ...contactPayload,
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

async function assertAuditExists(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  let data: AuditRecordRow | null = null;
  let error: { message: string } | null = null;

  try {
    const response = await supabase.from("audits").select("id, company_name").eq("id", auditId).maybeSingle<AuditRecordRow>();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
      throw caughtError;
    }

    const fallbackResponse = await supabase.from("audits").select("id").eq("id", auditId).maybeSingle<{ id: string }>();
    data = fallbackResponse.data ? { ...fallbackResponse.data, company_name: null } : null;
    error = fallbackResponse.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Audit not found.");
  }

  return data;
}

async function loadBusinessContacts(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
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

  return (data ?? []).map(mapBusinessContact);
}

async function mapExistingUserToContactPayload(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  functionalArea: string,
  notes: string | null,
  auditCompanyName: string | null,
) {
  let data: UserRow | null = null;
  let error: { message: string } | null = null;

  try {
    const response = await supabase
      .from("users")
      .select("id, full_name, email, role, team, company_name")
      .eq("id", userId)
      .maybeSingle<UserRow>();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
      throw caughtError;
    }

    const response = await supabase
      .from("users")
      .select("id, full_name, email, role, team")
      .eq("id", userId)
      .maybeSingle<Omit<UserRow, "company_name">>();
    data = response.data ? { ...response.data, company_name: null } : null;
    error = response.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    throw new Error("Selected user not found.");
  }

  if (auditCompanyName && (data.company_name ?? "").trim() !== auditCompanyName.trim()) {
    throw new Error("Selected user belongs to a different company and cannot be added as a contact for this audit.");
  }

  return {
    contact_email: data.email,
    contact_name: data.full_name,
    contact_title: data.team || data.role || null,
    functional_area: functionalArea,
    notes,
  };
}

type UserRow = {
  company_name: string | null;
  email: string;
  full_name: string;
  id: string;
  role: string;
  team: string | null;
};
