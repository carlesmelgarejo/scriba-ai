import { NextRequest, NextResponse } from "next/server";
import {
  getMeeting,
  deleteMeeting,
  updateMeeting,
  readMeetingAudio,
} from "@/lib/store";
import { extractPeaks } from "@/lib/audio";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  let meeting = await getMeeting(id);
  if (!meeting) {
    return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
  }

  // Backfill: si té àudio però no forma d'ona (reunions anteriors), la calcula i la desa.
  if (meeting.hasAudio && (!meeting.peaks || meeting.peaks.length === 0)) {
    try {
      const audio = await readMeetingAudio(id);
      if (audio) {
        const peaks = await extractPeaks(audio);
        if (peaks) meeting = (await updateMeeting(id, { peaks })) ?? meeting;
      }
    } catch {
      // si falla, es continua sense forma d'ona
    }
  }

  return NextResponse.json({ meeting });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteMeeting(id);
  if (!ok) {
    return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
