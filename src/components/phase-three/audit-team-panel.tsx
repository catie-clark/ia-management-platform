"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { Plus, X } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { useNotification } from "@/components/ui/notification-provider";

type TeamRole = "AIC" | "STAFF" | "MANAGER" | "DIRECTOR" | "CAE";
type AddMode = "existing" | "new";

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

type NewUserFormState = {
  auditRole: TeamRole;
  email: string;
  fullName: string;
  role: TeamRole;
  team: string;
};

const roleOptions: TeamRole[] = ["AIC", "STAFF", "MANAGER", "DIRECTOR", "CAE"];
const emptyNewUserForm: NewUserFormState = {
  auditRole: "STAFF",
  email: "",
  fullName: "",
  role: "STAFF",
  team: "",
};

export function AuditTeamPanel({ auditId }: { auditId: string | null }) {
  const { activeUser } = useActiveUser();
  const { showNotification } = useNotification();
  const [isPending, startTransition] = useTransition();
  const [members, setMembers] = useState<AuditTeamMember[]>([]);
  const [availableUsers, setAvailableUsers] = useState<AvailableUser[]>([]);
  const [auditCompanyName, setAuditCompanyName] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState<TeamRole>("STAFF");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("existing");
  const [newUserForm, setNewUserForm] = useState<NewUserFormState>(emptyNewUserForm);
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

  function resetAddState(nextAvailableUsers: AvailableUser[] = availableUsers) {
    setAddMode(nextAvailableUsers.length > 0 ? "existing" : "new");
    setSelectedUserId(nextAvailableUsers[0]?.id ?? "");
    setSelectedRole(nextAvailableUsers[0]?.role ?? "STAFF");
    setNewUserForm(emptyNewUserForm);
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
        setAddMode(nextAvailableUsers.length > 0 ? "existing" : "new");
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
    <section className="relative border border-black/6 bg-white p-5">
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
        <div className="flex items-center gap-3">
          <div className="rounded-full border border-black/5 bg-[var(--surface-tint)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--brand-indigo-core)]">
            {members.length} member{members.length === 1 ? "" : "s"}
          </div>
          <button
            type="button"
            disabled={!canManage}
            onClick={() => {
              resetAddState();
              setIsAddModalOpen(true);
            }}
            className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus size={16} />
            Add team member
          </button>
        </div>
      </div>

      {members.length === 0 ? (
        <div className="mt-4 border border-dashed border-black/10 p-5">
          <p className="text-sm leading-6 text-[var(--muted)]">
            No audit-specific team members are assigned yet. Use the add flow to pick an existing user or create a new one for this audit.
          </p>
        </div>
      ) : (
        <table className="mt-4 w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Name</th>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Team</th>
              <th className="border-b border-black/5 px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">Audit role</th>
              <th className="border-b border-black/5 px-3 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-black/5 transition-colors hover:bg-[var(--surface-soft)]">
                <td className="px-3 py-2.5">
                  <p className="font-semibold text-[var(--foreground)]">{member.name}</p>
                  <p className="text-xs text-[var(--muted)]">{member.email}</p>
                </td>
                <td className="px-3 py-2.5 text-[var(--muted)]">
                  <p>{member.team ?? "—"}</p>
                  <p className="text-xs uppercase tracking-[0.12em]">{member.sourceRole}</p>
                </td>
                <td className="px-3 py-2.5">
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
                    className="h-8 border border-black/10 bg-[var(--surface-soft)] px-2 text-sm outline-none"
                  >
                    {roleOptions.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-3 py-2.5 text-right">
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
                    className="inline-flex h-7 w-7 items-center justify-center border border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)] disabled:cursor-not-allowed disabled:opacity-60"
                    aria-label={`Remove ${member.name} from the audit team`}
                  >
                    <X size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {!canManage ? (
        <p className="mt-3 text-xs uppercase tracking-[0.14em] text-[var(--muted)]">Manager, director, CAE, or AIC access required</p>
      ) : null}

      <ContainedAdminModal
        open={isAddModalOpen}
        title="Add audit team member"
        subtitle="Assign an existing user or create a new user and add them directly to this audit."
        onClose={() => {
          setIsAddModalOpen(false);
          resetAddState();
        }}
      >
        <div className="flex gap-2 rounded-full border border-black/5 bg-white p-1">
          <ToggleButton active={addMode === "existing"} disabled={availableUsers.length === 0} onClick={() => setAddMode("existing")}>
            Existing user
          </ToggleButton>
          <ToggleButton active={addMode === "new"} onClick={() => setAddMode("new")}>
            New user
          </ToggleButton>
        </div>

        {addMode === "existing" ? (
          availableUsers.length === 0 ? (
            <div className="mt-4 rounded-[18px] border border-dashed border-black/10 bg-white p-4 text-sm leading-6 text-[var(--muted)]">
              No additional users from this audit&apos;s company are available to assign. Create a new user instead, or remove someone from this audit team first.
            </div>
          ) : (
            <form
              className="mt-4 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
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
                    const userPool = [
                      ...availableUsers,
                      ...members.map((member) => ({
                        companyName: member.companyName,
                        email: member.email,
                        id: member.userId,
                        name: member.name,
                        role: member.sourceRole,
                        team: member.team,
                      })),
                    ];
                    setMembers(nextMembers);
                    syncAvailableUsers(nextMembers, userPool);
                    setIsAddModalOpen(false);
                    resetAddState();
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
                });
              }}
            >
              <FormField label="User">
                <select
                  value={selectedUserId}
                  disabled={!canManage || isPending}
                  onChange={(event) => setSelectedUserId(event.target.value)}
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {availableUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Audit role">
                <select
                  value={selectedRole}
                  disabled={!canManage || isPending}
                  onChange={(event) => setSelectedRole(event.target.value as TeamRole)}
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>

              {selectedUser ? (
                <div className="rounded-[18px] border border-black/5 bg-white px-4 py-3 text-sm text-[var(--muted)]">
                  <p className="font-semibold text-[var(--foreground)]">{selectedUser.name}</p>
                  <p className="mt-1">{selectedUser.email}</p>
                  <p className="mt-1">Current global role: {selectedUser.role}</p>
                  {selectedUser.team ? <p className="mt-1">Team: {selectedUser.team}</p> : null}
                  {selectedUser.companyName ? <p className="mt-1">Company: {selectedUser.companyName}</p> : null}
                </div>
              ) : null}

              <ModalActions
                isPending={isPending}
                submitLabel="Add to audit team"
                onCancel={() => {
                  setIsAddModalOpen(false);
                  resetAddState();
                }}
              />
            </form>
          )
        ) : (
          <form
            className="mt-4 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              startTransition(async () => {
                try {
                  const response = await fetch(`/api/audits/${auditId}/team`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      auditRole: newUserForm.auditRole,
                      createUser: {
                        email: newUserForm.email,
                        fullName: newUserForm.fullName,
                        role: newUserForm.role,
                        team: newUserForm.team,
                      },
                    }),
                  });
                  const payload = (await response.json()) as {
                    error?: string;
                    members?: AuditTeamMember[];
                  };

                  if (!response.ok) {
                    throw new Error(payload.error ?? "Unable to add the audit team member.");
                  }

                  setMembers(payload.members ?? []);
                  setIsAddModalOpen(false);
                  setNewUserForm(emptyNewUserForm);
                  showNotification({
                    title: "User created and assigned",
                    message: "The new user was added to the system and assigned to this audit.",
                    tone: "success",
                  });
                  window.dispatchEvent(new CustomEvent("audit-team-updated", { detail: { auditId } }));
                } catch (error) {
                  showNotification({
                    title: "Unable to create user",
                    message: error instanceof Error ? error.message : "Unable to add the audit team member.",
                    tone: "error",
                  });
                }
              });
            }}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Full name">
                <input
                  value={newUserForm.fullName}
                  onChange={(event) => setNewUserForm((current) => ({ ...current, fullName: event.target.value }))}
                  placeholder="Example: Avery Collins"
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                />
              </FormField>

              <FormField label="Email">
                <input
                  type="email"
                  value={newUserForm.email}
                  onChange={(event) => setNewUserForm((current) => ({ ...current, email: event.target.value }))}
                  placeholder="Example: a.collins@bank.com"
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                />
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="System role">
                <select
                  value={newUserForm.role}
                  onChange={(event) => {
                    const nextRole = event.target.value as TeamRole;
                    setNewUserForm((current) => ({
                      ...current,
                      auditRole: current.auditRole === current.role ? nextRole : current.auditRole,
                      role: nextRole,
                    }));
                  }}
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Audit role">
                <select
                  value={newUserForm.auditRole}
                  onChange={(event) => setNewUserForm((current) => ({ ...current, auditRole: event.target.value as TeamRole }))}
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                >
                  {roleOptions.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Team">
                <input
                  value={newUserForm.team}
                  onChange={(event) => setNewUserForm((current) => ({ ...current, team: event.target.value }))}
                  placeholder="Example: Internal Audit"
                  className="h-11 rounded-2xl border border-black/5 bg-white px-3.5 text-sm outline-none"
                />
              </FormField>

              <FormField label="Company">
                <input
                  value={auditCompanyName || "No company boundary"}
                  readOnly
                  className="h-11 rounded-2xl border border-black/5 bg-[var(--surface-tint)] px-3.5 text-sm text-[var(--muted)] outline-none"
                />
              </FormField>
            </div>

            <ModalActions
              isPending={isPending}
              submitLabel="Create and assign"
              submitDisabled={!canManage || isPending || newUserForm.fullName.trim().length === 0 || newUserForm.email.trim().length === 0}
              onCancel={() => {
                setIsAddModalOpen(false);
                resetAddState();
              }}
            />
          </form>
        )}
      </ContainedAdminModal>
    </section>
  );
}

function ContainedAdminModal({
  children,
  onClose,
  open,
  subtitle,
  title,
}: {
  children: React.ReactNode;
  onClose: () => void;
  open: boolean;
  subtitle: string;
  title: string;
}) {
  if (!open) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        aria-label="Close add team member panel"
        onClick={onClose}
        className="absolute inset-0 z-20 rounded-[24px] bg-[rgba(1,30,65,0.18)] backdrop-blur-[1px]"
      />
      <aside className="absolute inset-y-0 right-0 z-30 flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-r-[24px] border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[-24px_0_60px_rgba(1,30,65,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Manage directory</p>
            <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">{subtitle}</p>
          </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)]"
            >
              <X size={18} />
            </button>
          </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto pr-1">{children}</div>
      </aside>
    </>
  );
}

function ToggleButton({
  active,
  children,
  disabled = false,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        active ? "bg-[var(--brand-indigo-core)] text-white" : "text-[var(--brand-indigo-core)]"
      }`}
    >
      {children}
    </button>
  );
}

function ModalActions({
  isPending,
  onCancel,
  submitDisabled = false,
  submitLabel,
}: {
  isPending: boolean;
  onCancel: () => void;
  submitDisabled?: boolean;
  submitLabel: string;
}) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-full border border-black/5 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)]"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitDisabled}
        className="rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving..." : submitLabel}
      </button>
    </div>
  );
}

function FormField({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
