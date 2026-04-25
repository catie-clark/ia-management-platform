"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { KPIProps } from "@/types/audit";

const statusTone: Record<KPIProps["status"], string> = {
  normal: "border-[rgba(5,171,140,0.22)] bg-[rgba(5,171,140,0.09)] text-[var(--foreground)]",
  warning: "border-[rgba(245,168,0,0.25)] bg-[rgba(255,210,49,0.14)] text-[var(--foreground)]",
  risk: "border-[rgba(229,55,107,0.22)] bg-[rgba(229,55,107,0.08)] text-[var(--foreground)]",
};

export function KpiCard({ title, value, subtitle, delta, status, href }: KPIProps & { href?: string }) {
  const content = (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "rounded-[26px] border p-5 shadow-[0_20px_40px_rgba(1,30,65,0.08)] transition-transform duration-200",
        href ? "cursor-pointer" : "",
        statusTone[status],
        status === "risk" && "animate-pulse-glow",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[var(--muted)]">{title}</p>
          <p className="mt-4 text-4xl font-semibold tracking-tight">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-2xl",
            status === "risk"
              ? "bg-[rgba(229,55,107,0.12)] text-[var(--brand-coral)]"
              : status === "warning"
                ? "bg-[rgba(245,168,0,0.14)] text-[var(--brand-amber-core)]"
                : "bg-[rgba(5,171,140,0.14)] text-[var(--brand-teal-core)]",
          )}
        >
          {status === "risk" ? <AlertTriangle size={20} /> : <ArrowUpRight size={20} />}
        </div>
      </div>
      {subtitle ? <p className="mt-4 text-sm text-[var(--muted)]">{subtitle}</p> : null}
      {delta ? <p className="mt-2 text-xs font-medium uppercase tracking-[0.22em] text-[var(--muted)]">{delta}</p> : null}
    </motion.article>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }

  return content;
}
