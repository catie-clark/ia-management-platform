"use client";

import { useEffect, useRef, useState } from "react";
import { CircleHelp, X } from "lucide-react";
import { cn } from "@/lib/utils";

// ── WorkspaceHelpButton ────────────────────────────────────────────────────────

export function WorkspaceHelpButton({ label, tip }: { label: string; tip: string }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  return (
    <div ref={containerRef} className="relative inline-flex shrink-0">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[var(--muted)] transition-colors hover:text-[var(--foreground)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-indigo-core)]"
      >
        <CircleHelp size={13} />
      </button>
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 rounded-[12px] border border-black/8 bg-white px-3 py-2.5 text-[12px] leading-5 text-[var(--foreground)] shadow-[0_8px_24px_rgba(1,30,65,0.1)]"
        >
          {tip}
        </div>
      )}
    </div>
  );
}

// ── WorkspacePageHeader ────────────────────────────────────────────────────────

export function WorkspacePageHeader({
  title,
  statusBadge,
  purposeLine,
  actions,
  helpTip,
  helpLabel,
}: {
  title: string;
  statusBadge?: React.ReactNode;
  purposeLine?: string;
  actions?: React.ReactNode;
  helpTip?: string;
  helpLabel?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[17px] font-semibold text-[var(--foreground)]">{title}</h1>
          {statusBadge}
          {helpTip && helpLabel && <WorkspaceHelpButton label={helpLabel} tip={helpTip} />}
        </div>
        {purposeLine && (
          <p className="text-[12px] text-[var(--muted)]">{purposeLine}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">{actions}</div>
      )}
    </div>
  );
}

// ── WorkspaceSummaryStrip ─────────────────────────────────────────────────────

export type SummaryStripItem = {
  label: string;
  value: string | number;
  status?: "normal" | "warning" | "risk";
  helpTip?: string;
  detail?: string;
};

export function WorkspaceSummaryStrip({ items }: { items: SummaryStripItem[] }) {
  return (
    <div className="flex flex-wrap divide-x divide-black/6 overflow-hidden rounded-[12px] border border-black/6">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-0.5 bg-[var(--surface)] px-4 py-2.5">
          <div className="flex items-center gap-1">
            <span className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              {item.label}
            </span>
            {item.helpTip && (
              <WorkspaceHelpButton label={`About ${item.label}`} tip={item.helpTip} />
            )}
          </div>
          <span
            className={cn(
              "text-[15px] font-semibold leading-none tabular-nums",
              item.status === "risk"
                ? "text-[var(--brand-coral)]"
                : item.status === "warning"
                  ? "text-[var(--brand-amber-dark)]"
                  : "text-[var(--foreground)]",
            )}
          >
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── WorkspaceKpiGrid ──────────────────────────────────────────────────────────

export function WorkspaceKpiGrid({ items, cols = 5 }: { items: SummaryStripItem[]; cols?: 3 | 4 | 5 }) {
  const colClass =
    cols === 3
      ? "sm:grid-cols-2 lg:grid-cols-3"
      : cols === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";

  return (
    <div className={cn("grid gap-px border border-black/6 bg-black/6", colClass)}>
      {items.map((item, i) => (
        <div key={i} className="bg-[var(--surface)] px-4 py-4">
          <div className="flex items-center gap-1.5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{item.label}</p>
            {item.helpTip && <WorkspaceHelpButton label={`About ${item.label}`} tip={item.helpTip} />}
          </div>
          <p
            className={cn(
              "mt-2 text-lg font-semibold tabular-nums",
              item.status === "risk"
                ? "text-[var(--brand-coral)]"
                : item.status === "warning"
                  ? "text-[var(--brand-amber-dark)]"
                  : "text-[var(--foreground)]",
            )}
          >
            {item.value}
          </p>
          {item.detail && <p className="mt-1 text-[12px] text-[var(--muted)]">{item.detail}</p>}
        </div>
      ))}
    </div>
  );
}

// ── WorkspaceToolbar ──────────────────────────────────────────────────────────

export function WorkspaceToolbar({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-black/5 pb-3">
      {children}
    </div>
  );
}

// ── WorkspaceDataTable ────────────────────────────────────────────────────────

export type WorkspaceColumn<T> = {
  key: string;
  label: string;
  width?: string;
  align?: "left" | "center" | "right";
  render?: (row: T) => React.ReactNode;
};

export function WorkspaceDataTable<T extends { id: string }>({
  columns,
  rows,
  onRowClick,
  emptyMessage = "No items found.",
  isLoading,
  error,
  maxBodyHeight,
}: {
  columns: WorkspaceColumn<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
  error?: string;
  maxBodyHeight?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-[14px] border border-black/6", maxBodyHeight && "flex flex-col")}>
      <div className={cn("overflow-x-auto", maxBodyHeight && `overflow-y-auto ${maxBodyHeight}`)}>
        <table className="min-w-full border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-[var(--surface-strong)] text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    "sticky top-0 z-10 px-3 py-2.5 shadow-[inset_0_-1px_0_rgba(1,30,65,0.07)]",
                    col.align === "center" && "text-center",
                    col.align === "right" && "text-right",
                  )}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5 bg-white">
            {isLoading ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[var(--muted)]">
                  Loading…
                </td>
              </tr>
            ) : error ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[var(--brand-coral)]">
                  {error}
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-8 text-center text-[var(--muted)]">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  className={cn(
                    "transition-colors hover:bg-[var(--surface-soft)]",
                    onRowClick && "cursor-pointer",
                  )}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        "px-3 py-2.5 text-[var(--foreground)]",
                        col.align === "center" && "text-center",
                        col.align === "right" && "text-right",
                      )}
                    >
                      {col.render
                        ? col.render(row)
                        : (row as Record<string, unknown>)[col.key] as React.ReactNode}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── WorkspaceDetailPanel ──────────────────────────────────────────────────────

export function WorkspaceDetailPanel({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col rounded-[18px] border border-black/6 bg-white shadow-[0_8px_24px_rgba(1,30,65,0.07)]">
      <div className="flex items-center justify-between border-b border-black/5 px-4 py-3">
        <h3 className="text-[13px] font-semibold text-[var(--foreground)]">{title}</h3>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--surface-soft)] hover:text-[var(--foreground)]"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
