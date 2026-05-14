import { NextResponse } from "next/server";
import { z } from "zod";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const auditRoleSchema = z.enum(["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"]);

const createUserSchema = z.object({
  email: z.string().trim().email(),
  fullName: z.string().trim().min(1),
  role: auditRoleSchema,
  team: z.string().trim().optional().or(z.literal("")),
});

const addExistingMemberSchema = z.object({
  userId: z.string().uuid(),
  auditRole: auditRoleSchema.nullable().optional(),
});

const addNewMemberSchema = z.object({
  auditRole: auditRoleSchema.nullable().optional(),
  createUser: createUserSchema,
});

const addMemberSchema = z.union([addExistingMemberSchema, addNewMemberSchema]);

const updateMemberSchema = z.object({
  auditRole: auditRoleSchema.nullable(),
  isActive: z.boolean().optional(),
});

type UserRow = {
  company_name: string | null;
  email: string;
  full_name: string;
  id: string;
  role: string;
  team: string | null;
};

type AuditUserMembershipRow = {
  audit_role: string | null;
  id: string;
  is_active: boolean;
  user_id: string;
  users: UserRow | UserRow[] | null;
};

type AuditRecordRow = {
  company_name: string | null;
  id: string;
  name: string | null;
};

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const audit = await assertAuditExists(supabase, auditId);

    const [members, users] = await Promise.all([loadAuditMembers(supabase, auditId), loadAllUsers(supabase, audit.company_name)]);
    const assignedUserIds = new Set(members.map((member) => member.userId));

    return NextResponse.json({
      auditCompanyName: audit.company_name,
      members,
      availableUsers: users.filter((user) => !assignedUserIds.has(user.id)),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load the audit team." },
      { status: 400 },
    );
  }
}

export async function POST(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    const audit = await assertAuditExists(supabase, auditId);

    const parsed = addMemberSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid team member payload." }, { status: 400 });
    }

    const userId =
      "createUser" in parsed.data
        ? await createOrLoadUserForAuditCompany(supabase, parsed.data.createUser, audit.company_name)
        : parsed.data.userId;

    await assertUserMatchesAuditCompany(supabase, userId, audit.company_name);

    const { error } = await supabase.from("audit_users").upsert(
      {
        audit_id: auditId,
        user_id: userId,
        audit_role: parsed.data.auditRole ?? null,
        is_active: true,
      },
      { onConflict: "audit_id,user_id" },
    );

    if (error) {
      throw new Error(error.message);
    }

    const members = await loadAuditMembers(supabase, auditId);
    return NextResponse.json({ members }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to add the audit team member." },
      { status: 400 },
    );
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const url = new URL(request.url);
    const membershipId = url.searchParams.get("membershipId");

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required." }, { status: 400 });
    }

    const parsed = updateMemberSchema.safeParse(await request.json());

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid team update payload." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    await assertAuditExists(supabase, auditId);

    const { error } = await supabase
      .from("audit_users")
      .update({
        audit_role: parsed.data.auditRole,
        ...(parsed.data.isActive === undefined ? {} : { is_active: parsed.data.isActive }),
      })
      .eq("id", membershipId)
      .eq("audit_id", auditId);

    if (error) {
      throw new Error(error.message);
    }

    const members = await loadAuditMembers(supabase, auditId);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update the audit team member." },
      { status: 400 },
    );
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const url = new URL(request.url);
    const membershipId = url.searchParams.get("membershipId");

    if (!membershipId) {
      return NextResponse.json({ error: "membershipId is required." }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();
    await assertAuditExists(supabase, auditId);

    const { error } = await supabase.from("audit_users").delete().eq("id", membershipId).eq("audit_id", auditId);

    if (error) {
      throw new Error(error.message);
    }

    const members = await loadAuditMembers(supabase, auditId);
    return NextResponse.json({ members });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to remove the audit team member." },
      { status: 400 },
    );
  }
}

async function assertAuditExists(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  let data: AuditRecordRow | null = null;
  let error: { message: string } | null = null;

  try {
    const response = await supabase.from("audits").select("id, name, company_name").eq("id", auditId).maybeSingle<AuditRecordRow>();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
      throw caughtError;
    }

    const fallbackResponse = await supabase.from("audits").select("id, name").eq("id", auditId).maybeSingle<{ id: string; name: string | null }>();
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

async function loadAuditMembers(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  let data: AuditUserMembershipRow[] | null = null;
  let error: { message: string } | null = null;

  try {
    const response = await supabase
      .from("audit_users")
      .select("id, user_id, audit_role, is_active, users!inner(id, full_name, email, role, team, company_name)")
      .eq("audit_id", auditId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .returns<AuditUserMembershipRow[]>();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
      throw caughtError;
    }

    const fallbackResponse = await supabase
      .from("audit_users")
      .select("id, user_id, audit_role, is_active, users!inner(id, full_name, email, role, team)")
      .eq("audit_id", auditId)
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .returns<Array<Omit<AuditUserMembershipRow, "users"> & { users: Omit<UserRow, "company_name"> | Array<Omit<UserRow, "company_name">> | null }>>();
    data = (fallbackResponse.data ?? []).map((membership) => ({
      ...membership,
      users: Array.isArray(membership.users)
        ? membership.users.map((user) => ({ ...user, company_name: null }))
        : membership.users
          ? { ...membership.users, company_name: null }
          : null,
    }));
    error = fallbackResponse.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((membership) => {
      const userRecord = Array.isArray(membership.users) ? membership.users[0] ?? null : membership.users;

      if (!userRecord) {
        return null;
      }

      return {
        email: userRecord.email,
        id: membership.id,
        name: userRecord.full_name,
        role: normalizeRole(membership.audit_role ?? userRecord.role),
        sourceRole: normalizeRole(userRecord.role),
        companyName: userRecord.company_name ?? undefined,
        team: userRecord.team ?? undefined,
        userId: membership.user_id,
      };
    })
    .filter((member): member is NonNullable<typeof member> => Boolean(member));
}

async function loadAllUsers(supabase: ReturnType<typeof createSupabaseAdminClient>, companyName: string | null) {
  let data: UserRow[] | null = null;
  let error: { message: string } | null = null;

  try {
    let query = supabase.from("users").select("id, full_name, email, role, team, company_name").order("full_name", { ascending: true });

    if (companyName) {
      query = query.eq("company_name", companyName);
    }

    const response = await query.returns<UserRow[]>();
    data = response.data;
    error = response.error;
  } catch (caughtError) {
    if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
      throw caughtError;
    }

    const response = await supabase
      .from("users")
      .select("id, full_name, email, role, team")
      .order("full_name", { ascending: true })
      .returns<Array<Omit<UserRow, "company_name">>>();
    data = (response.data ?? []).map((user) => ({ ...user, company_name: null }));
    error = response.error;
  }

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? [])
    .map((user) => {
      const normalizedRole = normalizeRole(user.role);

      if (!normalizedRole) {
        return null;
      }

      return {
        email: user.email,
        id: user.id,
        name: user.full_name,
        role: normalizedRole,
        companyName: user.company_name ?? undefined,
        team: user.team ?? undefined,
      };
    })
    .filter((user): user is NonNullable<typeof user> => Boolean(user));
}

async function assertUserMatchesAuditCompany(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
  auditCompanyName: string | null,
) {
  if (!auditCompanyName) {
    return;
  }

  const { data, error } = await supabase
    .from("users")
    .select("id, company_name")
    .eq("id", userId)
    .maybeSingle<{ company_name: string | null; id: string }>();

  if (error && !error.message.includes("company_name")) {
    throw new Error(error.message);
  }

  if (error?.message.includes("company_name")) {
    return;
  }

  if (!data) {
    throw new Error("Selected user not found.");
  }

  if ((data.company_name ?? "").trim() !== auditCompanyName.trim()) {
    throw new Error("Selected user belongs to a different company and cannot be assigned to this audit.");
  }
}

async function createOrLoadUserForAuditCompany(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  user: z.infer<typeof createUserSchema>,
  auditCompanyName: string | null,
) {
  const normalizedEmail = user.email.trim().toLowerCase();
  const existingUser = await supabase
    .from("users")
    .select("id, company_name")
    .eq("email", normalizedEmail)
    .maybeSingle<{ company_name: string | null; id: string }>();

  if (existingUser.error && !existingUser.error.message.includes("company_name")) {
    throw new Error(existingUser.error.message);
  }

  if (existingUser.data) {
    if (auditCompanyName && (existingUser.data.company_name ?? "").trim() !== auditCompanyName.trim()) {
      throw new Error("A user with this email already exists for a different company.");
    }

    return existingUser.data.id;
  }

  try {
    const { data, error } = await supabase
      .from("users")
      .insert({
        company_name: auditCompanyName,
        email: normalizedEmail,
        full_name: user.fullName.trim(),
        role: user.role,
        team: user.team?.trim() || null,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (error) {
      throw new Error(error.message);
    }

    if (!data) {
      throw new Error("Unable to create the user.");
    }

    return data.id;
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("company_name")) {
      throw error;
    }

    const { data, error: fallbackError } = await supabase
      .from("users")
      .insert({
        email: normalizedEmail,
        full_name: user.fullName.trim(),
        role: user.role,
        team: user.team?.trim() || null,
      })
      .select("id")
      .maybeSingle<{ id: string }>();

    if (fallbackError) {
      throw new Error(fallbackError.message);
    }

    if (!data) {
      throw new Error("Unable to create the user.");
    }

    return data.id;
  }
}

function normalizeRole(value: string | null) {
  if (!value) {
    return "STAFF";
  }

  const normalized = value.trim().toUpperCase();

  if (
    normalized === "AIC" ||
    normalized === "STAFF" ||
    normalized === "MANAGER" ||
    normalized === "DIRECTOR" ||
    normalized === "CAE"
  ) {
    return normalized;
  }

  return "STAFF";
}
