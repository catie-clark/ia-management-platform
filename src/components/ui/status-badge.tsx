import { cn } from "@/lib/utils";

const toneClasses = {
  neutral: "border-[rgba(1,30,65,0.08)] bg-[rgba(1,30,65,0.06)] text-[var(--brand-indigo-core)]",
  warning: "border-[rgba(245,168,0,0.24)] bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-dark)]",
  risk: "border-[rgba(229,55,107,0.18)] bg-[rgba(229,55,107,0.1)] text-[var(--brand-coral)]",
  success: "border-[rgba(5,171,140,0.2)] bg-[rgba(5,171,140,0.12)] text-[var(--brand-teal-core)]",
} as const;

export function StatusBadge({
  status,
  tone = "neutral",
  className,
}: {
  status: string;
  tone?: keyof typeof toneClasses;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em]",
        toneClasses[tone],
        className,
      )}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}
