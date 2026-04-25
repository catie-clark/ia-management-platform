import Link from "next/link";

import { cn, formatShortDate } from "@/lib/utils";
import type { TimelineItem } from "@/types/audit";

const statusStyles = {
  upcoming: "border-black/10 bg-white text-[var(--muted)]",
  active: "border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.14)] text-[var(--foreground)]",
  complete: "border-[rgba(5,171,140,0.22)] bg-[rgba(5,171,140,0.12)] text-[var(--foreground)]",
  at_risk: "border-[rgba(229,55,107,0.22)] bg-[rgba(229,55,107,0.08)] text-[var(--foreground)]",
};

export function MilestoneTimeline({
  items,
  message,
  setupComplete = true,
  setupHref,
}: {
  items: TimelineItem[];
  message?: string;
  setupComplete?: boolean;
  setupHref?: string;
}) {
  const content = (
    <section
      className={cn(
        "rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)] transition-transform duration-200",
        setupHref ? "cursor-pointer hover:scale-[1.01]" : "",
      )}
    >
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Lifecycle milestones</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">
            {setupComplete ? "Phase gates and report readiness" : "Set up lifecycle milestones"}
          </h2>
        </div>
        <div className="max-w-sm text-right text-sm text-[var(--muted)]">
          <p>
            {setupComplete
              ? "Planning, fieldwork, reporting, and filing dates stay visible so review time is protected."
              : "Set audit lifecycle dates on Hours and budget so the executive dashboard can track the phase timeline."}
          </p>
          {message ? <p className="mt-2 font-medium text-[var(--brand-amber-dark)]">{message}</p> : null}
        </div>
      </div>

      {setupComplete ? (
        <div className="mt-8 grid gap-4 xl:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className={cn(
                "relative rounded-[24px] border p-5 shadow-[0_14px_30px_rgba(1,30,65,0.06)]",
                statusStyles[item.status],
              )}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.22em]">{item.status.replace("_", " ")}</span>
              <h3 className="mt-4 text-lg font-semibold text-[var(--foreground)]">{item.label}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{formatShortDate(item.date)}</p>
              <div className="mt-6 h-2 rounded-full bg-black/5">
                <div
                  className={cn(
                    "h-2 rounded-full",
                    item.status === "complete" && "w-full bg-[var(--brand-teal-core)]",
                    item.status === "active" && "w-3/4 bg-[var(--brand-amber-core)]",
                    item.status === "upcoming" && "w-1/4 bg-[var(--brand-indigo-core)]",
                    item.status === "at_risk" && "w-2/3 bg-[var(--brand-coral)]",
                  )}
                />
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-[24px] border border-dashed border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.08)] px-5 py-8">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-dark)]">Setup needed</p>
          <p className="mt-3 text-lg font-semibold text-[var(--foreground)]">Open Hours and budget to save the audit start and end dates.</p>
          <p className="mt-2 text-sm text-[var(--muted)]">Once those dates are saved, this card will derive the planning, fieldwork, reporting, and final audit milestones automatically.</p>
        </div>
      )}
    </section>
  );

  if (setupHref) {
    return (
      <Link href={setupHref} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
