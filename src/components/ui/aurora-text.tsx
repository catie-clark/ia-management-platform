import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type AuroraTextProps = {
  children: ReactNode;
  className?: string;
};

export function AuroraText({ children, className }: AuroraTextProps) {
  return (
    <span
      className={cn(
        "landing-aurora-text inline-block bg-[linear-gradient(120deg,var(--brand-indigo-dark)_18%,var(--brand-indigo-core)_34%,var(--brand-amber-core)_50%,var(--brand-indigo-bright)_66%,var(--brand-indigo-dark)_82%)] bg-[length:220%_100%] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
