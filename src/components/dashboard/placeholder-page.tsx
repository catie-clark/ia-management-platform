import { Clock3, Construction, Sparkles } from "lucide-react";

import { PageHeader } from "@/components/dashboard/page-header";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  phaseStatus,
  nextDeliverables,
}: {
  eyebrow: string;
  title: string;
  description: string;
  phaseStatus?: {
    label: string;
    active: boolean;
  };
  nextDeliverables: string[];
}) {
  return (
    <div>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        phaseStatus={phaseStatus}
      />

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <article className="rounded-[28px] border border-black/5 bg-white p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-core)]">
              <Construction size={22} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted)]">Phase status</p>
              <h2 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">Sequenced for the next implementation phase</h2>
            </div>
          </div>
          <p className="mt-5 max-w-3xl text-sm leading-7 text-[var(--muted)]">
            This page has been reserved in the shell so stakeholders can see the final information architecture now. The next execution pass will replace this placeholder with the workflow-specific tables, detail views, and actions defined in the PRD.
          </p>
        </article>

        <article className="rounded-[28px] border border-black/5 bg-[var(--surface-tint)] p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[rgba(1,30,65,0.08)] text-[var(--brand-indigo-core)]">
              <Clock3 size={20} />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--muted)]">Next deliverables</p>
              <h3 className="mt-2 text-lg font-semibold text-[var(--foreground)]">Ready for build-out</h3>
            </div>
          </div>
          <ul className="mt-5 grid gap-3 text-sm text-[var(--muted)]">
            {nextDeliverables.map((item) => (
              <li key={item} className="flex items-start gap-3 rounded-2xl bg-white/70 px-4 py-3">
                <Sparkles size={16} className="mt-0.5 text-[var(--brand-amber-core)]" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </article>
      </section>
    </div>
  );
}
