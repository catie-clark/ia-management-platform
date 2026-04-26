import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { Role } from "@/types/audit";

type NotificationTone = "success" | "warning";

type UserRecord = {
  full_name: string;
  id: string;
  role: string;
};

type NotificationInsert = {
  audit_id?: string | null;
  detail: string;
  entity_id?: string | null;
  entity_type: string;
  event_type: string;
  link_href?: string | null;
  recipient_name: string;
  recipient_role?: string | null;
  recipient_user_id?: string | null;
  source_payload: Record<string, unknown>;
  title: string;
};

export async function createNotificationForUserId(args: {
  auditId?: string | null;
  detail: string;
  entityId?: string | null;
  entityType: string;
  eventType: string;
  linkHref?: string | null;
  tone?: NotificationTone;
  title: string;
  userId: string;
}) {
  const supabase = createSupabaseAdminClient();
  const recipient = await getUserById(supabase, args.userId);

  if (!recipient) {
    return;
  }

  await insertNotifications(supabase, [
    {
      audit_id: args.auditId ?? null,
      detail: args.detail,
      entity_id: args.entityId ?? null,
      entity_type: args.entityType,
      event_type: args.eventType,
      link_href: args.linkHref ?? null,
      recipient_name: recipient.full_name,
      recipient_role: normalizeRole(recipient.role),
      recipient_user_id: recipient.id,
      source_payload: {
        tone: args.tone ?? "warning",
      },
      title: args.title,
    },
  ]);
}

export async function createNotificationForStakeholderName(args: {
  auditId?: string | null;
  detail: string;
  entityId?: string | null;
  entityType: string;
  eventType: string;
  linkHref?: string | null;
  stakeholderName: string;
  tone?: NotificationTone;
  title: string;
}) {
  const supabase = createSupabaseAdminClient();
  const recipient = await getUserByName(supabase, args.stakeholderName);

  if (!recipient) {
    return;
  }

  await insertNotifications(supabase, [
    {
      audit_id: args.auditId ?? null,
      detail: args.detail,
      entity_id: args.entityId ?? null,
      entity_type: args.entityType,
      event_type: args.eventType,
      link_href: args.linkHref ?? null,
      recipient_name: recipient.full_name,
      recipient_role: normalizeRole(recipient.role),
      recipient_user_id: recipient.id,
      source_payload: {
        tone: args.tone ?? "warning",
      },
      title: args.title,
    },
  ]);
}

export async function createNotificationsForRole(args: {
  auditId?: string | null;
  detail: string;
  entityId?: string | null;
  entityType: string;
  eventType: string;
  linkHref?: string | null;
  role: Role;
  tone?: NotificationTone;
  title: string;
}) {
  const supabase = createSupabaseAdminClient();
  const recipients = await getUsersByRole(supabase, args.role);

  if (recipients.length === 0) {
    return;
  }

  await insertNotifications(
    supabase,
    recipients.map((recipient) => ({
      audit_id: args.auditId ?? null,
      detail: args.detail,
      entity_id: args.entityId ?? null,
      entity_type: args.entityType,
      event_type: args.eventType,
      link_href: args.linkHref ?? null,
      recipient_name: recipient.full_name,
      recipient_role: normalizeRole(recipient.role),
      recipient_user_id: recipient.id,
      source_payload: {
        tone: args.tone ?? "warning",
      },
      title: args.title,
    })),
  );
}

export async function listNotificationsForRecipient(recipientName: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("audit_notifications")
    .select("id, title, detail, link_href, status, created_at, source_payload")
    .ilike("recipient_name", recipientName.trim())
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    throw new Error(error.message);
  }

  const { count, error: countError } = await supabase
    .from("audit_notifications")
    .select("id", { count: "exact", head: true })
    .ilike("recipient_name", recipientName.trim())
    .eq("status", "unread");

  if (countError) {
    throw new Error(countError.message);
  }

  return {
    items: (data ?? []).map((item) => ({
      createdAt: item.created_at as string,
      detail: item.detail as string,
      id: item.id as string,
      linkHref: typeof item.link_href === "string" ? item.link_href : null,
      status: item.status as string,
      title: item.title as string,
      tone: readTone(item.source_payload),
    })),
    unreadCount: count ?? 0,
  };
}

export async function markNotificationRead(notificationId: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("audit_notifications")
    .update({
      read_at: new Date().toISOString(),
      status: "read",
    })
    .eq("id", notificationId);

  if (error) {
    throw new Error(error.message);
  }
}

function readTone(payload: unknown): NotificationTone {
  if (!payload || typeof payload !== "object") {
    return "warning";
  }

  const value = (payload as Record<string, unknown>).tone;
  return value === "success" ? "success" : "warning";
}

async function getUserById(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  userId: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .eq("id", userId)
    .maybeSingle<UserRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getUserByName(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  fullName: string,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .ilike("full_name", fullName.trim())
    .order("full_name", { ascending: true })
    .limit(1)
    .maybeSingle<UserRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

async function getUsersByRole(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  role: Role,
) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, role")
    .ilike("role", role)
    .order("full_name", { ascending: true })
    .returns<UserRecord[]>();

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function insertNotifications(
  supabase: ReturnType<typeof createSupabaseAdminClient>,
  notifications: NotificationInsert[],
) {
  if (notifications.length === 0) {
    return;
  }

  const { error } = await supabase.from("audit_notifications").insert(notifications);

  if (error) {
    throw new Error(error.message);
  }
}

function normalizeRole(role: string) {
  const normalized = role.trim().toUpperCase();
  return normalized.length > 0 ? normalized : null;
}
