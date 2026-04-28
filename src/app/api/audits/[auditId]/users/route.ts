import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AuditUserRow = {
  email: string;
  full_name: string;
  id: string;
  role: string;
  team: string | null;
};

type AuditRecordRow = {
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
    const { data: audit, error: auditError } = await supabase
      .from("audits")
      .select("id, name")
      .eq("id", auditId)
      .maybeSingle<AuditRecordRow>();

    if (auditError) {
      throw new Error(auditError.message);
    }

    if (!audit) {
      return NextResponse.json({ error: "Audit not found." }, { status: 404 });
    }

    const [{ data: controlLinks, error: controlError }, { data: users, error: usersError }] = await Promise.all([
      supabase
        .from("controls")
        .select("assigned_owner_user_id, control_owner_user_id")
        .eq("audit_id", auditId)
        .returns<ControlUserLinkRow[]>(),
      supabase
        .from("users")
        .select("id, full_name, email, role, team")
        .in("role", ["AIC", "STAFF", "MANAGER", "DIRECTOR"])
        .order("full_name", { ascending: true })
        .returns<AuditUserRow[]>(),
    ]);

    if (controlError) {
      throw new Error(controlError.message);
    }

    if (usersError) {
      throw new Error(usersError.message);
    }

    const normalizedUsers = (users ?? []).map((user) => ({
      email: user.email,
      id: user.id,
      name: user.full_name,
      role: user.role.toUpperCase() as "AIC" | "STAFF" | "MANAGER" | "DIRECTOR",
      team: user.team ?? undefined,
    }));
    const linkedStaffIds = new Set(
      (controlLinks ?? []).flatMap((control) => [control.assigned_owner_user_id, control.control_owner_user_id]).filter(Boolean),
    );
    const staffUsers = normalizedUsers.filter((user) => user.role === "STAFF" && linkedStaffIds.has(user.id));
    const switcherUsers = (["STAFF", "MANAGER", "DIRECTOR", "AIC"] as const)
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

    return NextResponse.json({
      auditName: audit.name,
      users: switcherUsers,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load audit users." },
      { status: 400 },
    );
  }
}
