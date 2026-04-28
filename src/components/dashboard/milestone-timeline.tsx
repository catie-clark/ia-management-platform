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
        "rounded-[20px] border border-black/5 bg-white px-5 py-4 shadow-[0_16px_36px_rgba(1,30,65,0.07)] transition-transform duration-200",
        setupHref ? "cursor-pointer hover:scale-[1.01]" : "",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Lifecycle milestones</p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {setupComplete ? "Phase gates and report readiness" : "Set up lifecycle milestones"}
          </h2>
        </div>
        <div className="max-w-sm text-right text-[13px] leading-5 text-[var(--muted)]">
          <p>
            {setupComplete
              ? "Planning, fieldwork, reporting, and filing dates stay visible so review time is protected."
              : "Set audit lifecycle dates on Hours and budget so the executive dashboard can track the phase timeline."}
          </p>
          {message ? <p className="mt-2 font-medium text-[var(--brand-amber-dark)]">{message}</p> : null}
        </div>
      </div>

      {setupComplete ? (
        <div className="mt-5 grid gap-3 xl:grid-cols-4">
          {items.map((item) => (
            <article
              key={item.id}
              className={cn(
                "relative rounded-[16px] border px-4 py-3 shadow-[0_10px_24px_rgba(1,30,65,0.05)]",
                statusStyles[item.status],
              )}
            >
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em]">{item.status.replace("_", " ")}</span>
              <h3 className="mt-3 text-base font-semibold text-[var(--foreground)]">{item.label}</h3>
              <p className="mt-1 text-[13px] text-[var(--muted)]">{formatShortDate(item.date)}</p>
              <div className="mt-4 h-1.5 rounded-full bg-black/5">
                <div
                  className={cn(
                    "h-1.5 rounded-full",
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
        <div className="mt-5 rounded-[16px] border border-dashed border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.08)] px-4 py-5">
          <p className="text-[13px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-amber-dark)]">Setup needed</p>
          <p className="mt-2 text-base font-semibold text-[var(--foreground)]">Open Hours and budget to save the audit start and end dates.</p>
          <p className="mt-2 text-[13px] leading-5 text-[var(--muted)]">Once those dates are saved, this card will derive the planning, fieldwork, reporting, and final audit milestones automatically.</p>
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
