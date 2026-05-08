"use client";

import { ShieldCheck } from "lucide-react";

import { BusinessContactsPanel } from "@/components/admin/business-contacts-panel";
import { PageHeader } from "@/components/dashboard/page-header";
import { AuditTeamPanel } from "@/components/phase-three/audit-team-panel";
import type { AuditPhase } from "@/types/audit";

export function AdminView({
  auditId,
  auditLabel,
  auditStatus,
  currentPhase,
}: {
  auditId: string;
  auditLabel: string;
  auditStatus: string;
  currentPhase: AuditPhase;
}) {
  return (
    <div className="flex min-h-0 flex-col gap-4">
      <PageHeader
        title="Admin"
        description=""
        phaseStatus={{ label: `Current phase: ${currentPhase}`, active: false }}
        variant="dashboard-compact"
      />

      <section className="rounded-[24px] border border-black/5 bg-[#fcfbf8] p-5 shadow-[0_10px_28px_rgba(1,30,65,0.05)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">Workspace administration</p>
            <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Manage audit setup and membership</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)]">
              Maintain the user assignments and audit-specific roles for {auditLabel} from a dedicated admin workspace.
            </p>
          </div>
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(1,30,65,0.08)] bg-white px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--brand-indigo-core)]">
            <ShieldCheck size={14} />
            {auditStatus}
          </div>
        </div>
      </section>

      <AuditTeamPanel auditId={auditId} />
      <BusinessContactsPanel auditId={auditId} />
    </div>
  );
}
