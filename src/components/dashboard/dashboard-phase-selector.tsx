"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";

import type { AuditPhase } from "@/types/audit";
import { cn } from "@/lib/utils";

const phaseOptions: AuditPhase[] = ["Planning", "Fieldwork", "Reporting"];

export function DashboardPhaseSelector({
  phase,
  className,
  labelClassName,
  optionClassName,
  selectClassName,
}: {
  phase: AuditPhase;
  className?: string;
  labelClassName?: string;
  optionClassName?: string;
  selectClassName?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  return (
    <label
      className={cn(
        "inline-flex min-w-[220px] items-center justify-between gap-3 rounded-[18px] border border-black/10 bg-white px-4 py-3 text-sm font-semibold text-[var(--brand-indigo-core)] shadow-[0_12px_30px_rgba(1,30,65,0.08)]",
        className,
      )}
    >
      <span className={cn("text-[10px] uppercase tracking-[0.22em] text-[var(--muted)]", labelClassName)}>Demo phase</span>
      <span className="relative min-w-[132px]">
        <select
          value={phase}
          disabled={isPending}
          onChange={(event) => {
            const params = new URLSearchParams(searchParams.toString());
            params.set("phase", event.target.value);

            startTransition(() => {
              router.replace(`${pathname}?${params.toString()}`);
            });
          }}
          className={cn(
            "h-10 w-full appearance-none rounded-full border border-black/5 bg-[var(--surface-tint)] pl-4 pr-10 text-sm font-semibold text-[var(--foreground)] outline-none transition-colors focus:border-[rgba(245,168,0,0.4)] disabled:cursor-not-allowed disabled:opacity-60",
            selectClassName,
          )}
        >
          {phaseOptions.map((option) => (
            <option
              key={option}
              value={option}
              className={cn("bg-white text-slate-900", optionClassName)}
            >
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-current opacity-70"
        />
      </span>
    </label>
  );
}
