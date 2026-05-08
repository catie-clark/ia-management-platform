"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { UserPlus2, X } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { useNotification } from "@/components/ui/notification-provider";

type TeamRole = "AIC" | "STAFF" | "MANAGER" | "DIRECTOR" | "CAE";

type AuditTeamMember = {
  companyName?: string;
  email: string;
  id: string;
  name: string;
  role: TeamRole;
  sourceRole: TeamRole;
  team?: string;
  userId: string;
};

type AvailableUser = {
  companyName?: string;
  email: string;
  id: string;
  name: string;
  role: TeamRole;
  team?: string;
};

const roleOptions: TeamRole[] = ["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"];

export function AuditTeamPanel({ auditId }: { auditId: string | null }) {
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<AuditTeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [auditCompanyName, setAuditCompanyName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("STAFF");
  const canManage = ["AIC", "MANAGER", "DIRECTOR", "CAE"].includes(activeUser.role);

  function syncAvailableUsers(nextMembers: AuditTeamMember[], userPool: AvailableUser[]) {
    const assignedUserIds = new Set(nextMembers.map((member) => member.userId));
    const nextAvailableUsers = userPool.filter((user) => !assignedUserIds.has(user.id)).sort((left, right) => left.name.localeCompare(right.name));
    const nextSelectedId = nextAvailableUsers[0]?.id ?? "";
    const nextSelectedRole = nextAvailableUsers[0]?.role ?? "STAFF";

    setAvailableUsers(nextAvailableUsers);
    setSelectedUserId(nextSelectedId);
    setSelectedRole(nextSelectedRole);
  }

  useEffect(() => {
    if (!auditId) {
      setMembers([]);
      setAvailableUsers([]);
      setAuditCompanyName("");
      setSelectedUserId("");
      return;
    }

    let cancelled = false;

    startTransition(async () => {
      try {
        const response = await fetch(`/api/audits/${auditId}/team`, { cache: "no-store" });
        const payload = (await response.json()) as {
          auditCompanyName?: string | null;
          availableUsers?: AvailableUser[];
          error?: string;
          members?: AuditTeamMember[];
        };

        if (!response.ok) {
          throw new Error(payload.error ?? "Unable to load the audit team.");
        }

        if (cancelled) {
          return;
        }

        const nextMembers = payload.members ?? [];
        const nextAvailableUsers = payload.availableUsers ?? [];

        setAuditCompanyName(payload.auditCompanyName?.trim() ?? "");
        setMembers(nextMembers);
        setAvailableUsers(nextAvailableUsers);
        setSelectedUserId((current) => (current && nextAvailableUsers.some((user) => user.id === current) ? current : nextAvailableUsers[0]?.id ?? ""));
        setSelectedRole(nextAvailableUsers[0]?.role ?? "STAFF");
      } catch (error) {
        if (!cancelled) {
          showNotification({
            title: "Audit team unavailable",
            message: error instanceof Error ? error.message : "Unable to load the audit team.",
            tone: "error",
          });
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, [auditId, showNotification]);

  const selectedUser = useMemo(
    () => availableUsers.find((user) => user.id === selectedUserId) ?? null,
    [availableUsers, selectedUserId],
  );

  useEffect(() => {
    if (selectedUser) {
      setSelectedRole(selectedUser.role);
    }
  }, [selectedUser]);

  if (!auditId) {
    return null;
  }

  return (
    <section className="rounded-[24px] border border-black/5 bg-white p-5 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Audit team</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Manage audit-specific team membership</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
            Tie users directly to this audit so the workspace, role switcher, and planning flow reflect the actual assigned team.
          </p>
          {auditCompanyName ? (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-indigo-core)]">
              Company boundary: {auditCompanyName}
            </p>
          ) : null}
        </div>
        <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
          {members.length} member{members.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
        <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">Add team member</h3>
            <UserPlus2 size={16} className="text-[var(--brand-indigo-core)]" />
          </div>

          {availableUsers.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              No additional users from this audit's company are available to assign. Import users for this company or remove someone from this audit team first.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">User</span>
                <select
                  value={selectedUserId}
                  disabled={!canManage || isPending}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Audit role</span>
                <select
                  value={selectedRole}
                  disabled={!canManage || isPending}
                  onChange={(event) => setSelectedRole(event.target.value as TeamRole)}
                  className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>

              {selectedUser ? (
                <div className="rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--muted)]">
                  <p className="font-semibold text-[var(--foreground)]">{selectedUser.name}</p>
                  <p className="mt-1">{selectedUser.email}</p>
                  <p className="mt-1">Current global role: {selectedUser.role}</p>
                  {selectedUser.companyName ? <p className="mt-1">Company: {selectedUser.companyName}</p> : null}
                </div>
              ) : null}

              <button
                type="button"
                disabled={!canManage || isPending || !selectedUserId}
                onClick={() =>
                  startTransition(async () => {
                    try {
                      const response = await fetch(`/api/audits/${auditId}/team`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          auditRole: selectedRole,
                          userId: selectedUserId,
                        }),
                      });
                      const payload = (await response.json()) as {
                        error?: string;
                        members?: AuditTeamMember[];
                      };

                      if (!response.ok) {
                        throw new Error(payload.error ?? "Unable to add the audit team member.");
                      }

                      const nextMembers = payload.members ?? [];
                      const userPool = [...availableUsers, ...members.map((member) => ({
                        companyName: member.companyName,
                        email: member.email,
                        id: member.userId,
                        name: member.name,
                        role: member.sourceRole,
                        team: member.team,
                      }))];
                      setMembers(nextMembers);
                      syncAvailableUsers(nextMembers, userPool);
                      showNotification({
                        title: "Team member added",
                        message: "The audit team membership was updated.",
                        tone: "success",
                      });
                      window.dispatchEvent(new CustomEvent("audit-team-updated", { detail: { auditId } }));
                    } catch (error) {
                      showNotification({
                        title: "Unable to add member",
                        message: error instanceof Error ? error.message : "Unable to add the audit team member.",
                        tone: "error",
                      });
                    }
                  })
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                <UserPlus2 size={16} />
                {isPending ? "Saving..." : "Add to audit team"}
              </button>
            </div>
          )}

          {!canManage ? (
            <p className="mt-4 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Manager, director, CAE, or AIC access required</p>
          ) : null}
        </section>

        <section className="rounded-[20px] border border-black/5 bg-[#fcfbf8] p-4">
          <h3 className="text-sm font-semibold text-[var(--foreground)]">Current audit team</h3>

          {members.length === 0 ? (
            <p className="mt-4 text-sm leading-6 text-[var(--muted)]">
              No audit-specific team members are assigned yet. Add users here or import a users CSV tied to this audit.
            </p>
          ) : (
            <div className="mt-4 grid gap-3">
              {members.map((member) => (
                <article key={member.id} className="rounded-[18px] border border-black/5 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[var(--foreground)]">{member.name}</p>
                      <p className="mt-1 text-sm text-[var(--muted)]">{member.email}</p>
                      {member.companyName ? <p className="mt-1 text-sm text-[var(--muted)]">Company: {member.companyName}</p> : null}
                      <p className="mt-1 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">
                        Global role {member.sourceRole}{member.team ? ` · ${member.team}` : ""}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <select
                        value={member.role}
                        disabled={!canManage || isPending}
                        onChange={(event) =>
                          startTransition(async () => {
                            try {
                              const response = await fetch(`/api/audits/${auditId}/team?membershipId=${encodeURIComponent(member.id)}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ auditRole: event.target.value }),
                              });
                              const payload = (await response.json()) as {
                                error?: string;
                                members?: AuditTeamMember[];
                              };

                              if (!response.ok) {
                                throw new Error(payload.error ?? "Unable to update the audit team role.");
                              }

                              setMembers(payload.members ?? []);
                              showNotification({
                                title: "Role updated",
                                message: `${member.name} now carries the updated audit role.`,
                                tone: "success",
                              });
                              window.dispatchEvent(new CustomEvent("audit-team-updated", { detail: { auditId } }));
                            } catch (error) {
                              showNotification({
                                title: "Unable to update role",
                                message: error instanceof Error ? error.message : "Unable to update the audit team role.",
                                tone: "error",
                              });
                            }
                          })
                        }
                        className="h-10 rounded-xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                      >
                        {roleOptions.map((role) => (
                          <option key={role} value={role}>
                            {role}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={!canManage || isPending}
                        onClick={() =>
                          startTransition(async () => {
                            try {
                              const response = await fetch(`/api/audits/${auditId}/team?membershipId=${encodeURIComponent(member.id)}`, {
                                method: "DELETE",
                              });
                              const payload = (await response.json()) as {
                                error?: string;
                                members?: AuditTeamMember[];
                              };

                              if (!response.ok) {
                                throw new Error(payload.error ?? "Unable to remove the audit team member.");
                              }

                              const nextMembers = payload.members ?? [];
                              const userPool = [
                                ...availableUsers,
                                ...nextMembers.map((nextMember) => ({
                                  companyName: nextMember.companyName,
                                  email: nextMember.email,
                                  id: nextMember.userId,
                                  name: nextMember.name,
                                  role: nextMember.sourceRole,
                                  team: nextMember.team,
                                })),
                                {
                                  companyName: member.companyName,
                                  email: member.email,
                                  id: member.userId,
                                  name: member.name,
                                  role: member.sourceRole,
                                  team: member.team,
                                },
                              ];
                              setMembers(nextMembers);
                              syncAvailableUsers(nextMembers, userPool);
                              showNotification({
                                title: "Team member removed",
                                message: `${member.name} was removed from the audit team.`,
                                tone: "success",
                              });
                              window.dispatchEvent(new CustomEvent("audit-team-updated", { detail: { auditId } }));
                            } catch (error) {
                              showNotification({
                                title: "Unable to remove member",
                                message: error instanceof Error ? error.message : "Unable to remove the audit team member.",
                                tone: "error",
                              });
                            }
                          })
                        }
                        className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
                        aria-label={`Remove ${member.name} from the audit team`}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
