"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
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
const PERSONA_STORAGE_KEY = "workspace-persona";
type ThemeMode = "light" | "dark";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isLandingPage = pathname === "/" || pathname === "/demo-login" || pathname === "/audit-intake";
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
  const personaParam = searchParams.get("persona");
  const personaSeededRef = useRef(false);
  const activeUser = availableUsers.find((user) => user.id === activeUserId) ?? getUserById(activeUserId);
  const auditMode = "live" as const;
  const currentAudit = getCurrentAuditLabel(searchParams);
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

  // Seed activeUserId from demo persona on first workspace entry; persist through refreshes.
  useEffect(() => {
    if (isLandingPage || personaSeededRef.current) return;
    personaSeededRef.current = true;

    const resolvedPersona = personaParam ?? window.localStorage.getItem(PERSONA_STORAGE_KEY);
    if (!resolvedPersona) return;

    window.localStorage.setItem(PERSONA_STORAGE_KEY, resolvedPersona);

    if (resolvedPersona === "manager") {
      setActiveUserId("U3");
    } else if (resolvedPersona === "staff") {
      setActiveUserId("U2");
    }
  }, [isLandingPage, personaParam]);

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
      <div className="min-h-screen bg-[var(--background)] text-[var(--foreground)]">
        {/* Full-width dark banner — matches audit-intake style */}
        <header className="border-b border-[rgba(255,255,255,0.08)] bg-[var(--brand-indigo-dark)]">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Link href="/" className="inline-flex shrink-0">
                <Image
                  src="/crowe_logo_2c_w.png"
                  alt="Crowe"
                  width={128}
                  height={36}
                  className="h-6 w-auto"
                  priority
                />
              </Link>
              <button
                type="button"
                onClick={() => setIsNavCollapsed((current) => !current)}
                className="hidden h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] text-white/70 transition-colors hover:bg-[rgba(255,255,255,0.14)] hover:text-white lg:inline-flex"
                aria-label={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
                title={isNavCollapsed ? "Expand navigation" : "Collapse navigation"}
              >
                {isNavCollapsed ? ">" : "<"}
              </button>
              <div className="hidden h-5 w-px bg-white/20 sm:block" aria-hidden="true" />
              <div className="hidden items-center gap-2 sm:inline-flex">
                <span className="text-[13px] font-semibold text-white">{currentAudit}</span>
                {resolvedScopePeriod ? (
                  <>
                    <span className="text-white/30" aria-hidden="true">·</span>
                    <span className="text-[13px] text-white/60">{resolvedScopePeriod}</span>
                  </>
                ) : null}
              </div>
            </div>

            <div className="relative z-20 flex items-center gap-2">
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
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] text-white/70 transition-colors hover:bg-[rgba(255,255,255,0.14)] hover:text-white"
              >
                <ThemeIcon size={16} />
              </button>
              <button
                type="button"
                title="Notifications"
                onClick={() => {
                  setShowNotifications((current) => !current);
                  setShowProfileMenu(false);
                }}
                className={cn(
                  "relative inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] text-white/70 transition-colors hover:bg-[rgba(255,255,255,0.14)] hover:text-white",
                  showNotifications && "bg-[rgba(255,255,255,0.14)] text-white",
                )}
              >
                <BellRing size={16} />
                {(auditMode === "live" ? unreadNotificationCount > 0 : notifications.length > 0) ? (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--brand-amber-bright)]" aria-hidden="true" />
                ) : null}
              </button>
              <button
                type="button"
                title="Profile"
                onClick={() => {
                  setShowProfileMenu((current) => !current);
                  setShowNotifications(false);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.08)] px-2.5 py-1.5 text-left transition-colors hover:bg-[rgba(255,255,255,0.14)]"
              >
                <span className="inline-flex h-6 w-6 items-center justify-center rounded border border-[rgba(245,168,0,0.32)] bg-[rgba(245,168,0,0.18)] text-[var(--brand-amber-bright)]">
                  <CircleUserRound size={13} />
                </span>
                <span className="hidden sm:block">
                  <span className="block text-[13px] font-semibold text-white">{activeUser.name}</span>
                  <span className="block text-[10px] uppercase tracking-[0.14em] text-white/60">{getUserProfileLabel(activeUser)}</span>
                </span>
              </button>

              {showNotifications ? (
                <div className="absolute right-0 top-11 z-50 w-[360px] rounded-2xl border border-black/10 bg-[var(--surface)] p-4 shadow-lg">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-indigo-core)]">
                        Notifications
                      </p>
                      <p className="mt-1 text-sm text-[var(--muted)]">
                        Workflow updates for {activeUser.name}.
                      </p>
                    </div>
                    <span className="rounded-full border border-black/10 bg-[var(--surface-soft)] px-2.5 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
                      {auditMode === "live" ? unreadNotificationCount : notifications.length} new
                    </span>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {notifications.length > 0 ? (
                      notifications.map((item) => (
                        <div key={item.id} className="rounded-xl border border-black/8 bg-[var(--surface-soft)] p-3">
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
                                  "mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                                  item.tone === "success"
                                    ? "bg-[rgba(5,171,140,0.14)] text-[var(--brand-teal-core)]"
                                    : "bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-bright)]",
                                )}
                              >
                                <CheckCircle2 size={16} />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
                                  {item.status === "unread" ? (
                                    <span className="rounded-full border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--brand-amber-bright)]">
                                      Unread
                                    </span>
                                  ) : null}
                                </div>
                                <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{item.detail}</p>
                              </div>
                            </button>
                            <div className="flex shrink-0 items-start gap-2">
                              <span className="whitespace-nowrap text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                                {item.time}
                              </span>
                              {auditMode === "live" ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleNotificationAction(item.id);
                                  }}
                                  className="rounded-full border border-black/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
                                >
                                  Dismiss
                                </button>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-xl border border-black/8 bg-[var(--surface-soft)] p-4 text-sm text-[var(--muted)]">
                        No notifications are waiting for {activeUser.name}.
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {showProfileMenu ? (
                <div className="absolute right-0 top-11 z-50 min-w-[280px] rounded-2xl border border-black/10 bg-[var(--surface)] p-4 shadow-lg">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--brand-indigo-core)]">Switch active user</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
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
                          const nextPersona = user.id === "U3" ? "manager" : user.id === "U2" ? "staff" : null;
                          if (nextPersona) {
                            window.localStorage.setItem(PERSONA_STORAGE_KEY, nextPersona);
                          } else {
                            window.localStorage.removeItem(PERSONA_STORAGE_KEY);
                          }
                          personaSeededRef.current = true;
                        }}
                        className={cn(
                          "flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                          activeUser.id === user.id
                            ? "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.08)]"
                            : "border-black/8 bg-[var(--surface-soft)] hover:bg-[var(--surface)]",
                        )}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-[var(--foreground)]">{user.name}</span>
                          <span className="block text-xs uppercase tracking-[0.14em] text-[var(--muted)]">{getUserProfileLabel(user)}</span>
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
            </div>
          </div>
        </header>

        {/* Page body: sidebar + content */}
        <div className="flex flex-col lg:flex-row lg:items-start">
          <aside
            className={cn(
              "lg:sticky lg:top-0 lg:shrink-0 lg:self-start",
              isNavCollapsed ? "lg:w-[72px]" : "lg:w-[200px]",
            )}
          >
            <nav className="p-3 sm:p-4 lg:min-h-screen lg:border-r lg:border-black/5">
              <div className="mb-3 px-2 lg:mb-4">
                <p className={cn("text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]", isNavCollapsed && "lg:hidden")}>
                  Navigation
                </p>
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
                            ? { pathname: item.href, query: currentAuditQuery }
                            : item.href
                        }
                        className={cn(
                          "group flex items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200",
                          isNavCollapsed && "lg:justify-center lg:px-2",
                          isActive
                            ? "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.10)] text-[var(--foreground)]"
                            : "border-transparent text-[var(--muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]",
                        )}
                      >
                        <span
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-colors",
                            isActive
                              ? "border-[rgba(245,168,0,0.34)] bg-[rgba(245,168,0,0.16)] text-[var(--brand-amber-dark)]"
                              : "border-black/8 bg-[var(--surface)] text-[var(--foreground)] group-hover:border-black/12",
                          )}
                        >
                          <Icon size={16} />
                        </span>
                        <span className={cn("min-w-0 flex-1 text-[13px] font-medium leading-5", isNavCollapsed && "lg:hidden")}>
                          {item.label}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            </nav>
          </aside>

          <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
            {children}
          </main>
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
  const persona = searchParams.get("persona");

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
    const queryWithSync = sync ? { ...queryWithPhase, sync } : queryWithPhase;
    return persona ? { ...queryWithSync, persona } : queryWithSync;
  }

  return null;
}

function getCurrentAuditLabel(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("auditLabel")?.trim() || "Live audit workspace";
}

function getCurrentScopePeriodLabel(searchParams: ReturnType<typeof useSearchParams>) {
  return searchParams.get("scopePeriodLabel")?.trim() || null;
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
