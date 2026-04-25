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
  controls,
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
    <div className="flex min-h-0 flex-col gap-4 xl:h-[calc(100dvh-13.5rem)]">
      <PageHeader
        eyebrow="Phase 2"
        title="Question and Request Log"
        description={
          mode === "live"
            ? `Live question and request tracking for ${auditLabel}. Imported activity and saved responses are scoped to this audit.`
            : "Manage auditor questions and evidence requests from one operating screen, with a quick switch between response tracking and fulfillment follow-up."
        }
        phaseStatus={{
          label: mode === "live" ? "Live audit data" : "Prototype mode",
          active: mode === "live",
        }}
      />

      <div className="inline-flex w-fit rounded-full border border-black/5 bg-white p-1 shadow-[0_12px_30px_rgba(1,30,65,0.08)]">
        <button
          type="button"
          onClick={() => switchTab("questions")}
          className={cn(
            "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            activeTab === "questions"
              ? "bg-[var(--brand-indigo-core)] text-white"
              : "text-[var(--brand-indigo-core)] hover:bg-[var(--surface-tint)]",
          )}
        >
          Question log
        </button>
        <button
          type="button"
          onClick={() => switchTab("requests")}
          className={cn(
            "rounded-full px-5 py-2.5 text-sm font-semibold transition-colors",
            activeTab === "requests"
              ? "bg-[var(--brand-indigo-core)] text-white"
              : "text-[var(--brand-indigo-core)] hover:bg-[var(--surface-tint)]",
          )}
        >
          Request log
        </button>
      </div>

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {activeTab === "questions" ? (
          <QuestionLogView
            auditLabel={auditLabel}
            controls={controls}
            documents={documents}
            embedded
            mode={mode}
            questions={questions}
            users={users}
          />
        ) : (
          <RequestLogView
            auditLabel={auditLabel}
            controls={controls}
            documents={documents}
            embedded
            mode={mode}
            requests={requests}
          />
        )}
      </div>
    </div>
  );
}
