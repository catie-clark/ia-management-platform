"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { BusinessContactsPanel } from "@/components/admin/business-contacts-panel";
import { cn } from "@/lib/utils";
import { AuditTeamPanel } from "@/components/phase-three/audit-team-panel";
import { StatusBadge } from "@/components/ui/status-badge";
import { WorkspacePageHeader } from "@/components/workspace/workspace-ui";
import type { AuditPhase } from "@/types/audit";

type AdminSubtab = "users" | "settings";

export function AdminView({
  auditId,
  auditLabel: _auditLabel,
  auditStatus,
  currentPhase,
}: {
  auditId: string;
  auditLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeSubtab = getAdminSubtab(searchParams.get("adminTab"));

  function switchSubtab(nextTab: AdminSubtab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("adminTab", nextTab);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-col gap-4">
      <WorkspacePageHeader
        title="Admin"
        statusBadge={<StatusBadge status={auditStatus} tone="neutral" />}
        purposeLine="Team membership, business contacts, and audit workspace settings."
      />

      <div className="inline-flex w-fit items-center gap-6">
        {adminSubtabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchSubtab(tab.id)}
            className={cn(
              "border-b-2 pb-1 text-sm transition-colors",
              activeSubtab === tab.id
                ? "border-[var(--brand-indigo-core)] font-semibold text-[var(--brand-indigo-core)]"
                : "border-transparent text-[var(--muted)] hover:text-[var(--brand-indigo-core)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubtab === "users" ? (
        <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
          <AuditTeamPanel auditId={auditId} />
          <BusinessContactsPanel auditId={auditId} />
        </div>
      ) : null}

      {activeSubtab === "settings" ? <AdminSettingsPanel auditId={auditId} /> : null}
    </div>
  );
}

const adminSubtabs: Array<{ id: AdminSubtab; label: string }> = [
  { id: "users", label: "Users" },
  { id: "settings", label: "Settings" },
];

function getAdminSubtab(value: string | null): AdminSubtab {
  return value === "settings" ? "settings" : "users";
}
