"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  BellRing,
  BriefcaseBusiness,
  CircleUserRound,
  ClipboardList,
  Clock3,
  FileStack,
  FolderKanban,
  LayoutDashboard,
  NotebookTabs,
  Settings2,
  ShieldCheck,
} from "lucide-react";

import { ActiveUserContext, getUserById } from "@/components/layout/active-user-context";
import { DashboardPhaseSelector } from "@/components/dashboard/dashboard-phase-selector";
import { users } from "@/lib/data/mock-data";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { href: "/control-testing", label: "Control Testing", icon: ShieldCheck },
  { href: "/hours-budget", label: "Hours & Budget", icon: Clock3 },
  { href: "/question-log", label: "Question and Request Log", icon: ClipboardList },
  { href: "/planning", label: "Planning", icon: BriefcaseBusiness },
  { href: "/fieldwork", label: "Fieldwork", icon: NotebookTabs },
  { href: "/reporting", label: "Reporting", icon: FileStack },
  { href: "/documents", label: "Documents", icon: FolderKanban },
  { href: "/admin", label: "Admin", icon: Settings2 },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLandingPage = pathname === "/";
  const [activeUserId, setActiveUserId] = useState("U2");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const activeUser = getUserById(activeUserId);
  const auditMode = searchParams.get("mode") === "live" ? "live" : "prototype";
  const currentAudit = getCurrentAuditLabel(searchParams);
  const currentScopePeriod = getCurrentScopePeriodLabel(searchParams);
  const [resolvedScopePeriod, setResolvedScopePeriod] = useState(currentScopePeriod);
  const currentAuditQuery = buildAuditQuery(searchParams);
  const liveAuditId = searchParams.get("mode") === "live" ? searchParams.get("auditId") : null;
  const switchableUsers = users.filter((user) => ["U1", "U2", "U3", "U4", "U5"].includes(user.id));
  const notifications = auditMode === "live" ? notificationItems : getNotificationsForUser(activeUser.role);

  useEffect(() => {
    setResolvedScopePeriod(currentScopePeriod);
  }, [currentScopePeriod]);

  useEffect(() => {
    let cancelled = false;

    async function loadAuditSummary() {
      if (!liveAuditId) {
        return;
      }

      try {
        const response = await fetch(`/api/audits/${liveAuditId}/summary`, { cache: "no-store" });
        const payload = (await response.json()) as { scopePeriodLabel?: string };

        if (!response.ok || cancelled || !payload.scopePeriodLabel) {
          return;
        }

        setResolvedScopePeriod(payload.scopePeriodLabel);
      } catch {
        if (!cancelled) {
          setResolvedScopePeriod((current) => current);
        }
      }
    }

    void loadAuditSummary();

    return () => {
      cancelled = true;
    };
  }, [liveAuditId]);

  useEffect(() => {
    let cancelled = false;

    async function loadNotifications() {
      if (auditMode !== "live") {
        setNotificationItems([]);
        setUnreadNotificationCount(0);
        return;
      }

      try {
        const response = await fetch(`/api/notifications?recipientName=${encodeURIComponent(activeUser.name)}`, {
          cache: "no-store",
        });
        const payload = (await response.json()) as {
          items?: Array<{
            createdAt: string;
            detail: string;
            id: string;
            linkHref: string | null;
            status: "read" | "unread";
            title: string;
            tone: "success" | "warning";
          }>;
          unreadCount?: number;
        };

        if (!response.ok || cancelled) {
          return;
        }

        setNotificationItems(
          (payload.items ?? []).map((item) => ({
            detail: item.detail,
            id: item.id,
            linkHref: item.linkHref,
            status: item.status,
            time: formatNotificationTime(item.createdAt),
            title: item.title,
            tone: item.tone,
          })),
        );
        setUnreadNotificationCount(payload.unreadCount ?? 0);
      } catch {
        if (!cancelled) {
          setNotificationItems([]);
          setUnreadNotificationCount(0);
        }
      }
    }

    void loadNotifications();

    return () => {
      cancelled = true;
    };
  }, [activeUser.name, auditMode]);

  if (isLandingPage) {
    return children;
  }

  return (
    <ActiveUserContext.Provider value={{ activeUser, setActiveUserId }}>
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(245,168,0,0.18),_transparent_32%),linear-gradient(180deg,_#082346_0%,_#071a33_24%,_#f4f2ee_24%,_#f6f4ef_100%)] text-[var(--foreground)]">
        <div className="min-h-screen w-full px-4 py-4 lg:px-6">
          <header className="relative z-40 rounded-[30px] border border-white/10 bg-[rgba(1,30,65,0.9)] px-5 py-5 shadow-panel backdrop-blur sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-amber-bright)]">
                    Crowe
                  </p>
                  <h1 className="mt-2 text-2xl font-semibold text-white lg:text-3xl">Internal Audit Platform</h1>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted-on-dark)]">
                    Prototype command center for Midwest Financial Corp audit planning, execution, and reporting.
                  </p>
                  <div className="mt-4 inline-flex flex-wrap items-center gap-3 rounded-[20px] border border-white/10 bg-white/[0.04] px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                      Current audit
                    </span>
                    <span className="text-sm font-semibold text-white">{currentAudit}</span>
                    {resolvedScopePeriod ? (
                      <>
                        <span className="text-[rgba(255,255,255,0.3)]" aria-hidden="true">
                          |
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                          Scope period
                        </span>
                        <span className="text-sm font-semibold text-white">{resolvedScopePeriod}</span>
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="relative z-20 flex flex-col items-start gap-3 self-start lg:items-end lg:self-start">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      title="Notifications"
                      onClick={() => {
                        setShowNotifications((current) => !current);
                        setShowProfileMenu(false);
                      }}
                      className={cn(
                        "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-[var(--muted-on-dark)] transition-colors hover:bg-white/10 hover:text-white",
                        showNotifications && "bg-white/10 text-white",
                      )}
                    >
                      <BellRing size={17} />
                      {(auditMode === "live" ? unreadNotificationCount > 0 : notifications.length > 0) ? (
                        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[var(--brand-amber-bright)]" aria-hidden="true" />
                      ) : null}
                    </button>
                    <button
                      type="button"
                      title="Profile"
                      onClick={() => {
                        setShowProfileMenu((current) => !current);
                        setShowNotifications(false);
                      }}
                      className="inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-left text-[var(--muted-on-dark)] transition-colors hover:bg-white/10 hover:text-white"
                    >
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(245,168,0,0.24)] bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-bright)]">
                        <CircleUserRound size={18} />
                      </span>
                      <span className="hidden sm:block">
                        <span className="block text-sm font-semibold text-white">{activeUser.name}</span>
                        <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-on-dark)]">{activeUser.role}</span>
                      </span>
                    </button>
                  </div>

                  {showNotifications ? (
                    <div className="z-50 w-full max-w-[360px] rounded-[24px] border border-white/10 bg-[rgba(7,26,51,0.96)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.28)] lg:fixed lg:right-6 lg:top-20">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">
                            Notifications
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted-on-dark)]">
                            Workflow updates for {activeUser.name}.
                          </p>
                        </div>
                        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white">
                          {auditMode === "live" ? unreadNotificationCount : notifications.length} new
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {notifications.length > 0 ? (
                          notifications.map((item) => (
                            <div key={item.id} className="rounded-[18px] border border-white/10 bg-white/[0.04] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (item.linkHref) {
                                      void handleNotificationAction(item.id, item.linkHref);
                                    }
                                  }}
                                  disabled={!item.linkHref}
                                  className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-default"
                                >
                                  <span
                                    className={cn(
                                      "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-xl",
                                      item.tone === "success"
                                        ? "bg-[rgba(5,171,140,0.14)] text-[var(--brand-teal-core)]"
                                        : "bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-bright)]",
                                    )}
                                  >
                                    <CheckCircle2 size={16} />
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-semibold text-white">{item.title}</p>
                                      {item.status === "unread" ? (
                                        <span className="rounded-full border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-amber-bright)]">
                                          Unread
                                        </span>
                                      ) : null}
                                    </div>
                                    <p className="mt-1 text-sm leading-6 text-[var(--muted-on-dark)]">{item.detail}</p>
                                  </div>
                                </button>
                                <div className="flex shrink-0 items-start gap-2">
                                  <span className="whitespace-nowrap text-xs uppercase tracking-[0.14em] text-[rgba(255,255,255,0.44)]">
                                    {item.time}
                                  </span>
                                  {auditMode === "live" ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        void handleNotificationAction(item.id);
                                      }}
                                      className="rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-on-dark)] transition-colors hover:bg-white/10 hover:text-white"
                                    >
                                      Dismiss
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-white/10 bg-white/[0.04] p-4 text-sm text-[var(--muted-on-dark)]">
                            No notifications are waiting for {activeUser.name}.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {showProfileMenu ? (
                    <div className="z-50 w-full min-w-[300px] max-w-[340px] rounded-[24px] border border-white/10 bg-[rgba(7,26,51,0.96)] p-4 shadow-[0_24px_60px_rgba(0,0,0,0.28)] lg:absolute lg:right-0 lg:top-14">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">Switch active user</p>
                      <p className="mt-1 text-sm text-[var(--muted-on-dark)]">
                        Preview the workflow from audit preparation and final reporting reviewer perspectives.
                      </p>
                      <div className="mt-4 grid gap-2">
                        {switchableUsers.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setActiveUserId(user.id);
                              setShowProfileMenu(false);
                            }}
                            className={cn(
                              "flex items-center justify-between rounded-[18px] border px-3 py-3 text-left transition-colors",
                              activeUser.id === user.id
                                ? "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)]"
                                : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]",
                            )}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-white">{user.name}</span>
                              <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-on-dark)]">{user.role}</span>
                            </span>
                            {activeUser.id === user.id ? (
                              <span className="rounded-full border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-amber-bright)]">
                                Active
                              </span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium uppercase tracking-[0.18em]",
                        auditMode === "live"
                          ? "border-[rgba(5,171,140,0.24)] bg-[rgba(5,171,140,0.12)] text-[var(--brand-teal-core)]"
                          : "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-bright)]",
                      )}
                    >
                      {auditMode === "live" ? "Supabase live data" : "Static prototype"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[var(--muted-on-dark)]">
                      Midwest Financial Corp
                    </span>
                  </div>
                  <div className="w-full lg:flex lg:justify-end">
                    <DashboardPhaseSelector
                      phase={getCurrentPhase(searchParams)}
                      className="w-full border-white/10 bg-white/[0.04] text-white shadow-none sm:w-auto"
                      labelClassName="text-[var(--muted-on-dark)]"
                      selectClassName="border-white/10 bg-[rgba(255,255,255,0.08)] text-white hover:bg-[rgba(255,255,255,0.12)] focus:bg-[rgba(255,255,255,0.12)]"
                    />
                  </div>
                </div>
              </div>

              <nav className="-mx-1 overflow-x-auto pb-1">
                <div className="flex min-w-max gap-2 px-1">
                  {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href;

  return (
                      <Link
                        key={item.href}
                        href={
                          currentAuditQuery
                            ? {
                                pathname: item.href,
                                query: currentAuditQuery,
                              }
                            : item.href
                        }
                        className={cn(
                          "group flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all duration-200",
                          isActive
                            ? "bg-[rgba(245,168,0,0.14)] text-white shadow-glow"
                            : "border border-white/10 bg-white/[0.04] text-[var(--muted-on-dark)] hover:bg-white/10 hover:text-white",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                            isActive
                              ? "border-[rgba(245,168,0,0.38)] bg-[rgba(245,168,0,0.18)]"
                              : "border-white/10 bg-white/5 group-hover:border-white/20",
                          )}
                        >
                          <Icon size={17} />
                        </span>
                        <span className="whitespace-nowrap font-medium">{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </nav>
            </div>
          </header>

          <main className="mt-4 rounded-[32px] border border-black/5 bg-[rgba(247,245,240,0.96)] p-4 shadow-panel backdrop-blur sm:p-6 lg:p-8">
            {children}
          </main>
        </div>
      </div>
    </ActiveUserContext.Provider>
  );

  async function handleNotificationAction(notificationId: string, href?: string | null) {
    const currentNotification = notificationItems.find((item) => item.id === notificationId);

    if (auditMode === "live") {
      try {
        await fetch(`/api/notifications/${notificationId}`, {
          method: "PATCH",
        });
      } catch {
        // Best-effort read state update; do not block navigation.
      }

      setNotificationItems((current) => current.filter((item) => item.id !== notificationId));
      setUnreadNotificationCount((current) => Math.max(0, current - (currentNotification?.status === "unread" ? 1 : 0)));
    }

    if (href) {
      setShowNotifications(false);
      router.push(href);
    }
  }
}

function buildAuditQuery(searchParams: ReturnType<typeof useSearchParams>) {
  const mode = searchParams.get("mode");
  const auditId = searchParams.get("auditId");
  const auditLabel = searchParams.get("auditLabel");
  const scopePeriodLabel = searchParams.get("scopePeriodLabel");
  const phase = searchParams.get("phase");
  const sync = searchParams.get("sync");

  if (mode === "live" && auditId) {
    const baseQuery = auditLabel
      ? scopePeriodLabel
        ? { mode, auditId, auditLabel, scopePeriodLabel }
        : { mode, auditId, auditLabel }
      : scopePeriodLabel
        ? { mode, auditId, scopePeriodLabel }
        : { mode, auditId };
    const queryWithPhase = phase ? { ...baseQuery, phase } : baseQuery;
    return sync ? { ...queryWithPhase, sync } : queryWithPhase;
  }

  if (mode === "prototype") {
    const baseQuery = scopePeriodLabel
      ? { mode: "prototype", auditLabel: "Prototype Demo Audit", scopePeriodLabel }
      : { mode: "prototype", auditLabel: "Prototype Demo Audit" };
    const queryWithPhase = phase ? { ...baseQuery, phase } : baseQuery;
    return sync ? { ...queryWithPhase, sync } : queryWithPhase;
  }

  return null;
}

function getCurrentAuditLabel(searchParams: ReturnType<typeof useSearchParams>) {
  if (searchParams.get("mode") === "prototype") {
    return "Prototype Demo Audit";
  }

  return searchParams.get("auditLabel")?.trim() || "Live audit workspace";
}

function getCurrentScopePeriodLabel(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("scopePeriodLabel")?.trim() || null;
}

function getCurrentPhase(searchParams: ReturnType<typeof useSearchParams>) {
  const phase = searchParams.get("phase");

  if (phase === "Fieldwork" || phase === "Reporting") {
    return phase;
  }

  return "Planning";
}

function getNotificationsForUser(role: "AIC" | "STAFF" | "MANAGER" | "DIRECTOR" | "CAE") {
  if (role === "MANAGER") {
    return [
      {
        id: "N-01",
        title: "You have a new workpaper requiring review",
        detail: "D-07 Sanctions Alert Triage Workpaper is waiting on your manager decision.",
        time: "6 min ago",
        status: "unread",
        linkHref: "/fieldwork?mode=prototype&auditLabel=Prototype%20Demo%20Audit",
        tone: "warning",
      },
      {
        id: "N-02",
        title: "One manager review item is still open",
        detail: "D-07 remains due today and is still waiting for your approve or send-back decision.",
        time: "24 min ago",
        status: "unread",
        linkHref: "/fieldwork?mode=prototype&auditLabel=Prototype%20Demo%20Audit",
        tone: "warning",
      },
    ] as const;
  }

  return [
    {
      id: "N-01",
      title: "Your workpaper moved to manager review",
      detail: "D-07 Sanctions Alert Triage Workpaper cleared AIC review and is now waiting on manager sign-off.",
      time: "8 min ago",
      status: "unread",
      linkHref: "/fieldwork?mode=prototype&auditLabel=Prototype%20Demo%20Audit",
      tone: "success",
    },
    {
      id: "N-02",
      title: "Your draft workpaper is ready to send",
      detail: "D-01 Access Review Workpaper is still in staff preparation and can be submitted to AIC review.",
      time: "31 min ago",
      status: "unread",
      linkHref: "/fieldwork?mode=prototype&auditLabel=Prototype%20Demo%20Audit",
      tone: "warning",
    },
  ] as const;
}

function formatNotificationTime(value: string) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 60000));

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

type NotificationItem = {
  detail: string;
  id: string;
  linkHref?: string | null;
  status: "read" | "unread";
  time: string;
  title: string;
  tone: "success" | "warning";
};
