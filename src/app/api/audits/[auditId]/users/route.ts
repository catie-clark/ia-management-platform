import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditUserRow = {
  company_name: string | null;
  email: string;
  full_name: string;
  id: string;
  role: string;
  team: string | null;
};

type AuditMembershipRow = {
  audit_role: string | null;
  users: AuditUserRow | AuditUserRow[] | null;
};

type AuditRecordRow = {
  company_name: string | null;
  id: string;
  name: string | null;
};

type ControlUserLinkRow = {
  assigned_owner_user_id: string | null;
  control_owner_user_id: string | null;
};

const preferredRoleEmails = {
  AIC: "jordan.lee@mfcorp.com",
  DIRECTOR: "marcus.kim@mfcorp.com",
  MANAGER: "elena.martin@mfcorp.com",
  STAFF: "priya.shah@mfcorp.com",
} as const;

export async function GET(_request: Request, context: { params: Promise<{ auditId: string }> }) {
  try {
    const { auditId } = await context.params;
    const supabase = createSupabaseAdminClient();
    let audit: AuditRecordRow | null = null;
    let auditError: { message: string } | null = null;

    try {
      const response = await supabase.from("audits").select("id, name, company_name").eq("id", auditId).maybeSingle<AuditRecordRow>();
      audit = response.data;
      auditError = response.error;
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("company_name")) {
        throw error;
      }

      const fallbackResponse = await supabase.from("audits").select("id, name").eq("id", auditId).maybeSingle<{ id: string; name: string | null }>();
      audit = fallbackResponse.data ? { ...fallbackResponse.data, company_name: null } : null;
      auditError = fallbackResponse.error;
    }

    if (auditError) {
      throw new Error(auditError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const membershipUsers = await loadAuditMembershipUsers(supabase, auditId);

    if (membershipUsers.length > 0) {
      return NextResponse.json({
        auditName: audit.name,
        users: membershipUsers,
      });
    }

    const fallbackUsers = await loadFallbackUsers(supabase, auditId, audit.company_name);

    return NextResponse.json({
      auditName: audit.name,
      users: fallbackUsers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load audit users." },
      { status: 400 },
    );
  }
}

async function loadAuditMembershipUsers(supabase: ReturnType<typeof createSupabaseAdminClient>, auditId: string) {
  try {
    let data: AuditMembershipRow[] | null = null;
    let error: { message: string } | null = null;

    try {
      const response = await supabase
        .from("audit_users")
        .select("audit_role, users!inner(id, full_name, email, role, team, company_name)")
        .eq("audit_id", auditId)
        .eq("is_active", true)
        .returns<AuditMembershipRow[]>();
      data = response.data;
      error = response.error;
    } catch (caughtError) {
      if (!(caughtError instanceof Error) || !caughtError.message.includes("company_name")) {
        throw caughtError;
      }

      const fallbackResponse = await supabase
        .from("audit_users")
        .select("audit_role, users!inner(id, full_name, email, role, team)")
        .eq("audit_id", auditId)
        .eq("is_active", true)
        .returns<Array<Omit<AuditMembershipRow, "users"> & { users: Omit<AuditUserRow, "company_name"> | Array<Omit<AuditUserRow, "company_name">> | null }>>();
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
        const normalizedRole = normalizeRole(membership.audit_role ?? userRecord?.role ?? null);

        if (!userRecord || !normalizedRole) {
          return null;
        }

        return {
          email: userRecord.email,
          id: userRecord.id,
          name: userRecord.full_name,
          role: normalizedRole,
          companyName: userRecord.company_name ?? undefined,
          team: userRecord.team ?? undefined,
        };
      })
      .filter((user): user is NonNullable<typeof user> => Boolean(user));
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.includes("audit_users") || error.message.includes("is_active") || error.message.includes("audit_role"))
    ) {
      return [];
    }

    throw error;
  }
}

async function loadFallbackUsers(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  auditId: string,
  companyName: string | null,
) {
  const [{ data: controlLinks, error: controlError }, usersResult] = await Promise.all([
    supabase
      .from("controls")
      .select("assigned_owner_user_id, control_owner_user_id")
      .eq("audit_id", auditId)
      .returns<ControlUserLinkRow[]>(),
    loadUsersForFallback(supabase),
  ]);

  if (controlError) {
    throw new Error(controlError.message);
  }

  if (usersResult.error) {
    throw new Error(usersResult.error.message);
  }

  const normalizedUsers = (usersResult.data ?? [])
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
    .filter((user): user is NonNullable<typeof user> => Boolean(user))
    .filter((user) => !companyName || user.companyName === companyName);
  const linkedStaffIds = new Set(
    (controlLinks ?? []).flatMap((control) => [control.assigned_owner_user_id, control.control_owner_user_id]).filter(Boolean),
  );
  const staffUsers = normalizedUsers.filter((user) => user.role === "STAFF" && linkedStaffIds.has(user.id));

  return (["STAFF", "MANAGER", "DIRECTOR", "AIC"] as const)
    .map((role) => {
      const preferredEmail = preferredRoleEmails[role];
      return (
        (role === "STAFF"
          ? staffUsers.find((user) => user.email.toLowerCase() === preferredEmail) ?? staffUsers[0]
          : normalizedUsers.find((user) => user.role === role && user.email.toLowerCase() === preferredEmail) ??
            normalizedUsers.find((user) => user.role === role))
      );
    })
    .filter((user): user is (typeof normalizedUsers)[number] => Boolean(user));
}

async function loadUsersForFallback(supabase: ReturnType<typeof createSupabaseAdminClient>) {
  try {
    const response = await supabase
      .from("users")
      .select("id, full_name, email, role, team, company_name")
      .in("role", ["AIC", "STAFF", "MANAGER", "DIRECTOR"])
      .order("full_name", { ascending: true })
      .returns<AuditUserRow[]>();

    return {
      data: response.data ?? [],
      error: response.error,
    };
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes("company_name")) {
      throw error;
    }

    const fallbackResponse = await supabase
      .from("users")
      .select("id, full_name, email, role, team")
      .in("role", ["AIC", "STAFF", "MANAGER", "DIRECTOR"])
      .order("full_name", { ascending: true })
      .returns<Array<Omit<AuditUserRow, "company_name">>>();

    return {
      data: (fallbackResponse.data ?? []).map((user) => ({ ...user, company_name: null })),
      error: fallbackResponse.error,
    };
  }
}

function normalizeRole(value: string | null) {
  if (!value) {
    return null;
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

  return null;
}
