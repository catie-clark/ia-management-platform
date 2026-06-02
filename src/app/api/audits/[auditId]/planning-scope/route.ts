import { NextResponse } from "next/server";
import { z } from "zod";

import { generateAuditText, isAiConfigured } from "@/lib/ai/anthropic";

const PLANNING_SCOPE_SYSTEM = [
  "You are a senior internal audit manager performing risk-based scoping for an upcoming audit.",
  "You are given the audit's planning inputs: RCSA results, open issues, third parties, applications, continuous monitoring results, and prior findings, along with candidate controls.",
  "Review the inputs methodically and produce a scoping recommendation. Reason about residual risk, recency, and coverage before concluding.",
  "Your output MUST be grounded only in the provided inputs — never invent controls, risks, or evidence. Reference the specific inputs that drive each recommendation.",
  "Structure your response in Markdown with these sections:",
  "## Recommended Scope (in-scope areas and the controls to test, each with a one-line rationale)",
  "## Watchlist (areas to monitor but not test this cycle, with rationale)",
  "## Out of Scope (areas that can be excluded, with rationale)",
  "## Key Risks & Themes (the residual-risk themes driving the scope)",
  "## Rationale & Source Basis (which planning inputs support the above)",
  "Be specific and concise. Do not include a preamble such as 'Here is'.",
].join(" ");

const scopeSchema = z.object({
  prompt: z.string().trim().min(1, "A planning prompt is required."),
});

export async function POST(request: Request) {
  try {
    const body = scopeSchema.parse(await request.json());

    if (!isAiConfigured()) {
      return NextResponse.json({
        source: "unavailable",
        message:
          "AI scope review is not configured on the server. Set ANTHROPIC_API_KEY to run it live, or copy the prompt above into an external tool.",
      });
    }

    const recommendation = await generateAuditText({
      system: PLANNING_SCOPE_SYSTEM,
      prompt: body.prompt,
      maxTokens: 12000,
    });

    return NextResponse.json({ source: "ai", recommendation });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to run the AI scope review." },
      { status: 400 },
    );
  }
}
