import { NextResponse } from "next/server";

import { listNotificationsForRecipient } from "@/lib/audit-notifications";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const recipientName = searchParams.get("recipientName")?.trim();

    if (!recipientName) {
      return NextResponse.json({ error: "recipientName is required." }, { status: 400 });
    }

    const payload = await listNotificationsForRecipient(recipientName);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to load notifications.",
      },
      { status: 400 },
    );
  }
}
