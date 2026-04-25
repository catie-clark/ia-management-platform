"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";

import { useActiveUser } from "@/components/layout/active-user-context";
import { formatDateTime } from "@/lib/utils";
import type { TimeSourceSummary } from "@/types/audit";

export function ExternalHoursSyncPanel({
  lastSyncedAt,
  sourceSummaries,
  syncCount,
}: {
  lastSyncedAt: string;
  sourceSummaries: TimeSourceSummary[];
  syncCount: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { activeUser } = useActiveUser();
  const [isPending, startTransition] = useTransition();
  const canSync = ["MANAGER", "DIRECTOR", "CAE"].includes(activeUser.role);
  const sourceSummaryLabel =
    sourceSummaries.length > 0
      ? sourceSummaries.map((summary) => `${summary.source} ${summary.totalHours.toFixed(0)}h`).join(" · ")
      : "No external time synced yet";

  return (
    <section className="rounded-[24px] border border-black/5 bg-[var(--surface-tint)] p-5 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Workday sync</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">Actual hours are coming from the Workday connection</h2>
          <p className="mt-3 text-sm leading-6 text-[var(--muted)]">
            Budgeted hours remain set inside the audit platform. Actual hours below are pulled through the Workday connection so the experience reflects a single external sync source.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {canSync ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() => {
                startTransition(() => {
                  const next = new URLSearchParams(searchParams.toString());
                  next.set("sync", String(syncCount + 1));
                  router.push(`${pathname}?${next.toString()}`);
                });
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[var(--brand-indigo-core)] px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
              {isPending ? "Syncing..." : "Sync actual hours"}
            </button>
          ) : (
            <span className="rounded-full border border-black/10 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Manager sync only
            </span>
          )}
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <SyncMetric label="Connected source" value={String(sourceSummaries.length)} detail={sourceSummaryLabel} />
        <SyncMetric label="Last synced" value={formatDateTime(lastSyncedAt)} detail={`Triggered by ${activeUser.name} through the Workday connector`} />
        <SyncMetric label="Sync sequence" value={`#${syncCount}`} detail="Each refresh adds new external time entries" />
      </div>
    </section>
  );
}

function SyncMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-[20px] border border-black/5 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">{value}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{detail}</p>
    </article>
  );
}
