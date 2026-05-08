"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  CheckCircle2,
  BellRing,
  BriefcaseBusiness,
  CircleUserRound,
  ClipboardList,
  Clock3,
  FileStack,
  LayoutDashboard,
  Moon,
  NotebookTabs,
  Sun,
} from "lucide-react";

import { ActiveUserContext, getUserById } from "@/components/layout/active-user-context";
import { DashboardPhaseSelector } from "@/components/dashboard/dashboard-phase-selector";
import { DEFAULT_COMPANY_NAME } from "@/lib/company";
import { users } from "@/lib/data/mock-data";
import { cn } from "@/lib/utils";
import type { User } from "@/types/audit";

const switcherRoleOrder = ["STAFF", "MANAGER", "DIRECTOR", "AIC"] as const;
const preferredSwitcherUserIds: Partial<Record<(typeof switcherRoleOrder)[number], string>> = {
  STAFF: "U2",
  MANAGER: "U3",
  DIRECTOR: "U4",
  AIC: "U1",
};
const additionalSwitcherUserIds = ["U8"] as const;

const navItems = [
  { href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
  { href: "/hours-budget", label: "Hours & Budget", icon: Clock3 },
  { href: "/question-log", label: "Question and Request Log", icon: ClipboardList },
  { href: "/planning", label: "Planning", icon: BriefcaseBusiness },
  { href: "/fieldwork", label: "Fieldwork", icon: NotebookTabs },
  { href: "/reporting", label: "Reporting", icon: FileStack },
  { href: "/admin", label: "Admin", icon: CircleUserRound },
];

const THEME_STORAGE_KEY = "theme-preference";
type ThemeMode = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLandingPage = pathname === "/";
  const demoUsers = useMemo(() => selectSwitcherUsers(users, users), []);
  const [availableUsers, setAvailableUsers] = useState<User[]>(demoUsers);
  const [activeUserId, setActiveUserId] = useState("U2");
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [notificationItems, setNotificationItems] = useState<NotificationItem[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [themePreference, setThemePreference] = useState<ThemeMode | null>(null);
  const [resolvedTheme, setResolvedTheme] = useState<ThemeMode>("light");
  const [isNavCollapsed, setIsNavCollapsed] = useState(false);
  const activeUser = availableUsers.find((user) => user.id === activeUserId) ?? getUserById(activeUserId);
  const auditMode = "live" as const;
  const currentAudit = getCurrentAuditLabel(searchParams);
  const currentCompany = getCurrentCompanyName(searchParams);
  const currentScopePeriod = getCurrentScopePeriodLabel(searchParams);
  const [resolvedScopePeriod, setResolvedScopePeriod] = useState(currentScopePeriod);
  const currentAuditQuery = buildAuditQuery(searchParams);
  const liveAuditId = searchParams.get("auditId");
  const switchableUsers = availableUsers;
  const notifications = notificationItems;
  const themeToggleLabel = resolvedTheme === "dark" ? "Switch to light mode" : "Switch to dark mode";
  const ThemeIcon = resolvedTheme === "dark" ? Sun : Moon;

  useEffect(() => {
    const root = document.documentElement;
    const storedTheme = readStoredTheme();
    const initialTheme = readDomTheme(root) ?? storedTheme ?? getSystemTheme();

    setThemePreference(storedTheme);
    setResolvedTheme(initialTheme);
    applyTheme(initialTheme);
  }, []);

  useEffect(() => {
    if (themePreference) {
      applyTheme(themePreference);
      window.localStorage.setItem(THEME_STORAGE_KEY, themePreference);
      setResolvedTheme(themePreference);
      return;
    }

    window.localStorage.removeItem(THEME_STORAGE_KEY);
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const syncSystemTheme = () => {
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      applyTheme(systemTheme);
      setResolvedTheme(systemTheme);
    };

    syncSystemTheme();
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => {
      mediaQuery.removeEventListener("change", syncSystemTheme);
    };
  }, [themePreference]);

  useEffect(() => {
    setResolvedScopePeriod(currentScopePeriod);
  }, [currentScopePeriod]);

  useEffect(() => {
    let cancelled = false;

    async function loadSwitchableUsers() {
      if (!liveAuditId) {
        const nextUsers = demoUsers;
        if (!cancelled) {
          setAvailableUsers(nextUsers);
          setActiveUserId((current) => (nextUsers.some((user) => user.id === current) ? current : nextUsers.find((user) => user.role === "STAFF")?.id ?? nextUsers[0]?.id ?? "U2"));
        }
        return;
      }

      try {
        const response = await fetch(`/api/audits/${liveAuditId}/users`, { cache: "no-store" });
        const payload = (await response.json()) as { users?: User[] };

        if (!response.ok || cancelled || !payload.users?.length) {
          return;
        }

        const nextUsers = selectSwitcherUsers(payload.users ?? [], users);
        if (!nextUsers.length) {
          return;
        }

        setAvailableUsers(nextUsers);
        setActiveUserId((current) => (nextUsers.some((user) => user.id === current) ? current : nextUsers.find((user) => user.role === "STAFF")?.id ?? nextUsers[0]!.id));
      } catch {
        if (!cancelled) {
          const nextUsers = demoUsers;
          setAvailableUsers(nextUsers);
        }
      }
    }

    function handleAuditTeamUpdated(event: Event) {
      const detail = event instanceof CustomEvent ? (event.detail as { auditId?: string } | undefined) : undefined;

      if (!detail?.auditId || detail.auditId !== liveAuditId) {
        return;
      }

      void loadSwitchableUsers();
    }

    void loadSwitchableUsers();
    window.addEventListener("audit-team-updated", handleAuditTeamUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener("audit-team-updated", handleAuditTeamUpdated);
    };
  }, [auditMode, demoUsers, liveAuditId]);

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
  }, [activeUser.name]);

  if (isLandingPage) {
    return children;
  }

  return (
    <ActiveUserContext.Provider value={{ activeUser, setActiveUserId }}>
      <div className="min-h-screen text-[var(--foreground)]" style={{ background: "var(--app-shell-background)" }}>
        <div className="min-h-screen w-full px-4 py-2 lg:px-6">
          <header className="relative z-40 rounded-[24px] border border-[color:var(--app-header-border)] bg-[var(--app-header-bg)] px-4 py-3 shadow-panel backdrop-blur sm:px-5 lg:px-6">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-3">
                    <div>
                      <Link href="/" className="inline-flex">
                        <Image
                          src="/crowe_logo_2c_w.png"
                          alt="Crowe"
                          width={128}
                          height={36}
                          className="h-6 w-auto"
                          priority
                        />
                      </Link>
                      <div className="mt-1">
                        <h1 className="text-xl font-semibold text-[var(--app-header-text)] lg:text-2xl">AuditDESK</h1>
                        <p className="mt-1 text-xs font-medium text-[var(--muted-on-dark)]">
                          Audit | Documentation, Evidence, Stages, and Knowledge
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted-on-dark)]">A hub for internal audit management</p>
                      </div>
                    </div>

                    <div className="inline-flex flex-wrap items-center gap-2.5 self-start rounded-[16px] border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] px-3 py-2">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                        Current audit
                      </span>
                      <span className="text-[13px] font-semibold text-[var(--app-header-text)]">{currentAudit}</span>
                      {resolvedScopePeriod ? (
                        <>
                          <span className="text-[rgba(255,255,255,0.3)]" aria-hidden="true">
                            |
                          </span>
                          <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[var(--brand-amber-bright)]">
                            Scope period
                          </span>
                          <span className="text-[13px] font-semibold text-[var(--app-header-text)]">{resolvedScopePeriod}</span>
                        </>
                      ) : null}
                    </div>

                  </div>
                </div>

                <div className="relative z-20 flex flex-col items-start gap-2 self-start lg:items-end lg:self-start">
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      title={themeToggleLabel}
                      aria-label={themeToggleLabel}
                      aria-pressed={resolvedTheme === "dark"}
                      onClick={() => {
                        setThemePreference((current) => {
                          const currentTheme = current ?? resolvedTheme;
                          return currentTheme === "dark" ? "light" : "dark";
                        });
                        setShowNotifications(false);
                        setShowProfileMenu(false);
                      }}
                      className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] text-[var(--muted-on-dark)] transition-colors hover:bg-[var(--app-header-surface-hover)] hover:text-[var(--app-header-text)]"
                    >
                      <ThemeIcon size={17} />
                    </button>
                    <button
                      type="button"
                      title="Notifications"
                      onClick={() => {
                        setShowNotifications((current) => !current);
                        setShowProfileMenu(false);
                      }}
                      className={cn(
                        "relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] text-[var(--muted-on-dark)] transition-colors hover:bg-[var(--app-header-surface-hover)] hover:text-[var(--app-header-text)]",
                        showNotifications && "bg-[var(--app-header-surface-hover)] text-[var(--app-header-text)]",
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
                      className="inline-flex items-center gap-2.5 rounded-2xl border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] px-3 py-1.5 text-left text-[var(--muted-on-dark)] transition-colors hover:bg-[var(--app-header-surface-hover)] hover:text-[var(--app-header-text)]"
                    >
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-[rgba(245,168,0,0.24)] bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-bright)]">
                        <CircleUserRound size={16} />
                      </span>
                      <span className="hidden sm:block">
                        <span className="block text-[13px] font-semibold text-[var(--app-header-text)]">{activeUser.name}</span>
                        <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-on-dark)]">{getUserProfileLabel(activeUser)}</span>
                      </span>
                    </button>
                  </div>

                  {showNotifications ? (
                    <div className="z-50 w-full max-w-[360px] rounded-[24px] border border-[color:var(--app-header-border)] bg-[var(--app-header-panel-bg)] p-4 lg:fixed lg:right-6 lg:top-20" style={{ boxShadow: "var(--app-header-panel-shadow)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">
                            Notifications
                          </p>
                          <p className="mt-1 text-sm text-[var(--muted-on-dark)]">
                            Workflow updates for {activeUser.name}.
                          </p>
                        </div>
                        <span className="rounded-full border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--app-header-text)]">
                          {auditMode === "live" ? unreadNotificationCount : notifications.length} new
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3">
                        {notifications.length > 0 ? (
                          notifications.map((item) => (
                            <div key={item.id} className="rounded-[18px] border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] p-3">
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
                                      <p className="text-sm font-semibold text-[var(--app-header-text)]">{item.title}</p>
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
                                      className="rounded-full border border-[color:var(--app-header-border)] px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted-on-dark)] transition-colors hover:bg-[var(--app-header-surface-hover)] hover:text-[var(--app-header-text)]"
                                    >
                                      Dismiss
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-[18px] border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] p-4 text-sm text-[var(--muted-on-dark)]">
                            No notifications are waiting for {activeUser.name}.
                          </div>
                        )}
                      </div>
                    </div>
                  ) : null}

                  {showProfileMenu ? (
                    <div className="z-50 w-full min-w-[300px] max-w-[340px] rounded-[24px] border border-[color:var(--app-header-border)] bg-[var(--app-header-panel-bg)] p-4 lg:absolute lg:right-0 lg:top-14" style={{ boxShadow: "var(--app-header-panel-shadow)" }}>
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
                                : "border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] hover:bg-[var(--app-header-surface-hover)]",
                            )}
                          >
                            <span>
                              <span className="block text-sm font-semibold text-[var(--app-header-text)]">{user.name}</span>
                              <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted-on-dark)]">{getUserProfileLabel(user)}</span>
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

                  <div className="flex flex-wrap items-center gap-2.5">
                    <span
                      className={cn(
                        "rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em]",
                        "border-[rgba(5,171,140,0.24)] bg-[rgba(5,171,140,0.12)] text-[var(--brand-teal-core)]",
                      )}
                    >
                      Supabase live data
                    </span>
                    <span className="rounded-full border border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] px-3 py-1 text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--muted-on-dark)]">
                      {currentCompany}
                    </span>
                  </div>
                  <div className="w-full lg:flex lg:justify-end">
                    <DashboardPhaseSelector
                      phase={getCurrentPhase(searchParams)}
                      className="w-full border-[color:var(--app-header-border)] bg-[var(--app-header-surface)] text-[var(--app-header-text)] shadow-none sm:w-auto"
                      labelClassName="text-[var(--muted-on-dark)]"
                      optionClassName="bg-[var(--surface)] text-[var(--foreground)]"
                      selectClassName="border-[color:var(--app-header-border)] bg-[var(--app-header-surface-hover)] text-[var(--app-header-text)] hover:bg-[var(--app-header-surface-hover)] focus:bg-[var(--app-header-surface-hover)]"
                    />
                  </div>
                </div>
              </div>
            </div>
          </header>

          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-stretch">
            <aside
              className={cn(
                "lg:sticky lg:top-6 lg:flex-shrink-0 lg:self-start",
                isNavCollapsed ? "lg:w-[96px]" : "lg:w-[220px]",
              )}
            >
              <nav className="rounded-[28px] border border-[color:var(--main-border)] bg-[var(--main-bg)] p-3 shadow-panel backdrop-blur sm:p-4 lg:min-h-[calc(100vh-7.5rem)]">
                <div className="mb-3 flex items-center justify-between gap-2 px-2 lg:mb-4">
                  <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]", isNavCollapsed && "lg:hidden")}>
                    Navigation
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsNavCollapsed((current) => !current)}
                    className="hidden h-9 w-9 items-center justify-center rounded-xl border border-[color:var(--main-border)] bg-[var(--surface)] text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)] lg:inline-flex"
                    aria-label={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                    title={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                  >
                    {isNavCollapsed ? ">" : "<"}
                  </button>
                </div>
                <div className="-mx-1 overflow-x-auto lg:mx-0 lg:overflow-visible">
                  <div className="flex min-w-max gap-2 px-1 lg:min-w-0 lg:flex-col lg:px-0">
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
                            "group flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-all duration-200",
                            isNavCollapsed && "lg:justify-center lg:px-2",
                            isActive
                              ? "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] text-[var(--foreground)] shadow-glow"
                              : "border-[color:var(--main-border)] bg-white/70 text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                          )}
                          >
                            <span
                              className={cn(
                                "flex h-9 w-9 items-center justify-center rounded-xl border transition-colors",
                                isActive
                                ? "border-[rgba(245,168,0,0.34)] bg-[rgba(245,168,0,0.16)] text-[var(--brand-amber-dark)]"
                                : "border-[color:var(--main-border)] bg-[var(--surface)] text-[var(--foreground)] group-hover:border-[rgba(1,30,65,0.14)]",
                            )}
                            >
                              <Icon size={17} />
                            </span>
                          <span className={cn("min-w-0 flex-1 text-[13px] font-medium leading-5 break-words", isNavCollapsed && "lg:hidden")}>
                            {item.label}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              </nav>
            </aside>

            <main className="min-w-0 flex-1 rounded-[32px] border border-[color:var(--main-border)] bg-[var(--main-bg)] p-4 shadow-panel backdrop-blur sm:p-6 lg:p-8">
              {children}
            </main>
          </div>
        </div>
      </div>
    </ActiveUserContext.Provider>
  );

  async function handleNotificationAction(notificationId: string, href?: string | null) {
    const currentNotification = notificationItems.find((item) => item.id === notificationId);

    try {
      await fetch(`/api/notifications/${notificationId}`, {
        method: "PATCH",
      });
    } catch {
      // Best-effort read state update; do not block navigation.
    }

    setNotificationItems((current) => current.filter((item) => item.id !== notificationId));
    setUnreadNotificationCount((current) => Math.max(0, current - (currentNotification?.status === "unread" ? 1 : 0)));

    if (href) {
      setShowNotifications(false);
      router.push(href);
    }
  }
}

function buildAuditQuery(searchParams: ReturnType<typeof useSearchParams>) {
  const auditId = searchParams.get("auditId");
  const auditLabel = searchParams.get("auditLabel");
  const scopePeriodLabel = searchParams.get("scopePeriodLabel");
  const companyName = searchParams.get("companyName");
  const phase = searchParams.get("phase");
  const sync = searchParams.get("sync");

  if (auditId) {
    const baseQuery = auditLabel
      ? scopePeriodLabel
        ? companyName
          ? { mode: "live", auditId, auditLabel, companyName, scopePeriodLabel }
          : { mode: "live", auditId, auditLabel, scopePeriodLabel }
        : companyName
          ? { mode: "live", auditId, auditLabel, companyName }
          : { mode: "live", auditId, auditLabel }
      : scopePeriodLabel
        ? companyName
          ? { mode: "live", auditId, companyName, scopePeriodLabel }
          : { mode: "live", auditId, scopePeriodLabel }
        : companyName
          ? { mode: "live", auditId, companyName }
          : { mode: "live", auditId };
    const queryWithPhase = phase ? { ...baseQuery, phase } : baseQuery;
    return sync ? { ...queryWithPhase, sync } : queryWithPhase;
  }

  return null;
}

function getCurrentAuditLabel(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("auditLabel")?.trim() || "Live audit workspace";
}

function getCurrentCompanyName(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("companyName")?.trim() || DEFAULT_COMPANY_NAME;
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

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

function getSystemTheme(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredTheme(): ThemeMode | null {
  const value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return value === "dark" || value === "light" ? value : null;
}

function readDomTheme(root: HTMLElement): ThemeMode | null {
  const value = root.dataset.theme;
  return value === "dark" || value === "light" ? value : null;
}

function selectSwitcherUsers(userPool: User[], supplementalUsers: User[] = []) {
  const mergedUsers = [...userPool];

  for (const supplementalUser of supplementalUsers) {
    const existingIndex = mergedUsers.findIndex((user) => user.id === supplementalUser.id);

    if (existingIndex >= 0) {
      mergedUsers[existingIndex] = {
        ...mergedUsers[existingIndex],
        team: supplementalUser.team ?? mergedUsers[existingIndex]!.team,
        email: supplementalUser.email || mergedUsers[existingIndex]!.email,
        name: supplementalUser.name || mergedUsers[existingIndex]!.name,
      };
      continue;
    }

    mergedUsers.push(supplementalUser);
  }

  const roleBasedUsers = switcherRoleOrder
    .map((role) => {
      const preferredId = preferredSwitcherUserIds[role];
      return mergedUsers.find((user) => user.role === role && user.id === preferredId) ?? mergedUsers.find((user) => user.role === role);
    })
    .filter((user): user is User => Boolean(user));

  const additionalUsers = additionalSwitcherUserIds
    .map((userId) => mergedUsers.find((user) => user.id === userId))
    .filter((user): user is User => {
      if (!user) {
        return false;
      }

      return !roleBasedUsers.some((existingUser) => existingUser.id === user.id);
    });

  return [...roleBasedUsers, ...additionalUsers];
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

function getUserProfileLabel(user: User) {
  if (user.team && user.team !== "Internal Audit") {
    return user.team;
  }

  return user.role;
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
