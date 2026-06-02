import { NextResponse } from "next/server";
import { z } from "zod";

import { buildTollgateDeck } from "@/lib/pptx-deck";

export const runtime = "nodejs";

const sectionSchema = z.object({
  heading: z.string().default(""),
  body: z.array(z.string()).default([]),
});

const deckSchema = z.object({
  auditLabel: z.string().trim().default("Audit"),
  label: z.string().trim().default("Tollgate"),
  markdown: z.string().default(""),
  previewSummary: z.string().default(""),
  previewSections: z.array(sectionSchema).default([]),
});

export async function POST(request: Request) {
  try {
    const body = deckSchema.parse(await request.json());
    const { buffer, fileName } = await buildTollgateDeck(body);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid deck payload." }, { status: 400 });
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to generate the PowerPoint deck." },
      { status: 400 },
    );
  }
}
