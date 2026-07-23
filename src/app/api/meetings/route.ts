import { NextResponse } from "next/server";
import { listMeetings } from "@/lib/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const meetings = await listMeetings();
    return NextResponse.json({ meetings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut llegir l'històric: ${message}` },
      { status: 500 }
    );
  }
}
