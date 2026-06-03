"use client";

import { PageHeader } from "@/components/dashboard/page-header";
import { CombinedLogView } from "@/components/phase-two/combined-log-view";
import type { QuestionLogViewModel } from "@/lib/question-log-data";

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

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <CombinedLogView
          auditId={auditId}
          controls={controls}
          currentPhase={currentPhase}
          documents={documents}
          mode={mode}
          questions={questions}
          requests={requests}
          users={users}
        />
      </div>
    </div>
  );
}
