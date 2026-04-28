"use client";

import { useEffect, useState } from "react";
import { Lightbulb } from "lucide-react";

const FADE_IN_DELAY_MS = 120;

export function ExecutiveSummary({ narrative }: { narrative: string }) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(false);

    const timer = window.setTimeout(() => {
      setIsVisible(true);
    }, FADE_IN_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [narrative]);

  return (
    <section className="overflow-hidden rounded-[20px] border border-black/5 bg-[linear-gradient(135deg,rgba(1,30,65,0.98),rgba(0,46,98,0.94))] px-5 py-4 text-white shadow-[0_16px_36px_rgba(1,30,65,0.12)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
          <div className="inline-flex items-center gap-2 rounded-[14px] border border-[rgba(245,168,0,0.28)] bg-[rgba(245,168,0,0.12)] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-amber-bright)]">
            <Lightbulb size={14} />
            AI Insight
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[var(--muted-on-dark)]">Executive Narrative</p>
            <h2 className="mt-1 text-lg font-semibold sm:text-xl">Current Audit Posture</h2>
          </div>
        </div>

        <p
          className={`max-w-4xl text-[13px] leading-6 text-[rgba(255,255,255,0.82)] transition-all duration-500 lg:text-sm ${
            isVisible ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
          }`}
        >
          {narrative}
        </p>
      </div>
    </section>
  );
}
