import { NextResponse } from "next/server";

import { markNotificationRead } from "@/lib/audit-notifications";

export async function PATCH(_request: Request, context: { params: Promise<{ notificationId: string }> }) {
  try {
    const { notificationId } = await context.params;
    await markNotificationRead(notificationId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to update the notification.",
      },
      { status: 400 },
    );
  }
}
