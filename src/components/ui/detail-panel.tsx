"use client";

import { X } from "lucide-react";

import { cn } from "@/lib/utils";

export function DetailPanel({
  title,
  subtitle,
  open,
  onClose,
  children,
  panelClassName,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  panelClassName?: string;
}) {
  return (
    <>
      <div
        className={cn(
          "fixed inset-0 z-40 bg-[rgba(1,30,65,0.28)] backdrop-blur-sm transition-opacity duration-200",
          open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          "fixed inset-0 z-50 flex items-stretch justify-end overflow-hidden p-0 sm:p-4 transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <aside
          className={cn(
            "flex h-full max-h-full w-full max-w-2xl flex-col overflow-hidden border-l border-black/5 bg-[#fbfaf7] p-6 shadow-[0_24px_80px_rgba(1,30,65,0.22)] sm:h-auto sm:max-h-[calc(100dvh-2rem)] sm:rounded-[28px] sm:border sm:p-8",
            panelClassName,
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[var(--muted)]">Detail view</p>
              <h2 className="mt-3 text-2xl font-semibold text-[var(--foreground)]">{title}</h2>
              {subtitle ? <p className="mt-2 max-w-xl text-sm text-[var(--muted)]">{subtitle}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-10 w-10 items-center justify-center rounded-2xl border border-black/5 bg-white text-[var(--brand-indigo-core)] transition-colors hover:bg-[var(--surface-tint)]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mt-8 min-h-0 flex-1 overflow-x-hidden overflow-y-auto pr-1">{children}</div>
        </aside>
      </div>
    </>
  );
}
