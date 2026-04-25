import { cn } from "@/lib/utils";
import type { PhaseSpotlight as PhaseSpotlightData } from "@/types/audit";

const statusStyles = {
  normal: "border-[rgba(5,171,140,0.16)] bg-[rgba(5,171,140,0.08)] text-[var(--brand-teal-core)]",
  warning: "border-[rgba(245,168,0,0.22)] bg-[rgba(245,168,0,0.12)] text-[var(--brand-amber-dark)]",
  risk: "border-[rgba(229,55,107,0.16)] bg-[rgba(229,55,107,0.08)] text-[var(--brand-coral)]",
};

export function PhaseSpotlight({ spotlight }: { spotlight: PhaseSpotlightData }) {
  return (
    <section className="rounded-[28px] border border-black/5 bg-[linear-gradient(180deg,#fcfbf8_0%,#f4efe6_100%)] p-6 shadow-[0_18px_50px_rgba(1,30,65,0.08)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--brand-indigo-core)]">{spotlight.eyebrow}</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{spotlight.title}</h2>
        </div>
        <p className="max-w-2xl text-sm leading-6 text-[var(--muted)] lg:text-right">{spotlight.description}</p>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {spotlight.cards.map((card) => (
          <article key={card.title} className="rounded-[24px] border border-black/5 bg-white px-5 py-4">
            <div
              className={cn(
                "inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
                statusStyles[card.status],
              )}
            >
              {card.title}
            </div>
            <p className="mt-4 text-4xl font-semibold tracking-tight text-[var(--foreground)]">{card.value}</p>
            <p className="mt-3 text-sm leading-6 text-[var(--muted)]">{card.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
