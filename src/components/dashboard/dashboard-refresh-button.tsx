"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export function DashboardRefreshButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(() => {
          router.refresh();
        });
      }}
      className="inline-flex items-center gap-2 rounded-full border border-black/10 bg-white px-4 py-2 text-sm font-semibold text-[var(--brand-indigo-core)] shadow-[0_12px_30px_rgba(1,30,65,0.08)] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <RefreshCw size={16} className={isPending ? "animate-spin" : ""} />
      {isPending ? "Refreshing..." : "Refresh data"}
    </button>
  );
}
