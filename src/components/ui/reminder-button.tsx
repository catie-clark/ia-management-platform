"use client";

import { BellRing } from "lucide-react";

import { cn } from "@/lib/utils";

export function ReminderButton({
  visible,
  tooltip,
  label = "Send Reminder",
}: {
  visible: boolean;
  tooltip: string;
  label?: string;
}) {
  if (!visible) {
    return null;
  }

  return (
    <button
      type="button"
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-[rgba(245,168,0,0.3)] bg-[rgba(245,168,0,0.12)] px-3 py-1.5 text-xs font-semibold text-[var(--brand-amber-dark)] shadow-[0_0_0_0_rgba(245,168,0,0.35)] transition-transform duration-200 hover:-translate-y-0.5",
        "animate-[pulse_2.2s_ease-in-out_infinite]",
      )}
    >
      <BellRing size={14} />
      {label}
    </button>
  );
}
