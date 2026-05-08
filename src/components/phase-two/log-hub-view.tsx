"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PageHeader } from "@/components/dashboard/page-header";
import { QuestionLogView } from "@/components/phase-two/question-log-view";
import { RequestLogView } from "@/components/phase-two/request-log-view";
import { cn } from "@/lib/utils";
import type { QuestionLogViewModel } from "@/lib/question-log-data";

type LogTab = "questions" | "requests";

export function LogHubView({
  auditId,
  auditLabel,
  auditPeriodLabel,
  controls,
  currentPhase,
  documents,
  mode,
  questions,
  requests,
  users,
}: QuestionLogViewModel) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") === "requests" ? "requests" : "questions";

  function switchTab(nextTab: LogTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", nextTab);
    params.delete("questionId");
    params.delete("requestId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-col gap-4 xl:h-[calc(100dvh-13rem)]">
      <PageHeader
        title="Question and Request Log"
        description=""
        phaseStatus={{
          label: mode === "live" ? "Live audit data" : "Prototype mode",
          active: mode === "live",
        }}
        variant="dashboard-compact"
      />

      <div className="inline-flex w-fit items-center gap-6">
        <button
          type="button"
          onClick={() => switchTab("questions")}
          className={cn(
            "border-b-2 pb-1 text-sm transition-colors",
            activeTab === "questions"
              ? "border-[var(--brand-indigo-core)] font-semibold text-[var(--brand-indigo-core)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--brand-indigo-core)]",
          )}
        >
          Question log
        </button>
        <button
          type="button"
          onClick={() => switchTab("requests")}
          className={cn(
            "border-b-2 pb-1 text-sm transition-colors",
            activeTab === "requests"
              ? "border-[var(--brand-indigo-core)] font-semibold text-[var(--brand-indigo-core)]"
              : "border-transparent text-[var(--muted)] hover:text-[var(--brand-indigo-core)]",
          )}
        >
          Request log
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {activeTab === "questions" ? (
          <QuestionLogView
            auditId={auditId}
            auditLabel={auditLabel}
            controls={controls}
            currentPhase={currentPhase}
            documents={documents}
            embedded
            mode={mode}
            questions={questions}
            requests={requests}
            users={users}
          />
        ) : (
          <RequestLogView
            auditId={auditId}
            auditLabel={auditLabel}
            controls={controls}
            currentPhase={currentPhase}
            documents={documents}
            embedded
            mode={mode}
            questions={questions}
            requests={requests}
            users={users}
          />
        )}
      </div>
    </div>
  );
}
