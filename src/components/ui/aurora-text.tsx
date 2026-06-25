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
        "landing-aurora-text inline-block bg-[linear-gradient(120deg,#ffffff_18%,var(--brand-amber-bright)_34%,var(--brand-amber-core)_50%,var(--brand-amber-bright)_66%,#ffffff_82%)] bg-[length:220%_100%] bg-clip-text text-transparent",
        className,
      )}
    >
      {children}
    </span>
  );
}
