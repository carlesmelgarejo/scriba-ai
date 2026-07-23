import { NextRequest, NextResponse } from "next/server";
import { getMeeting, updateMeeting, readMeetingAudio } from "@/lib/store";
import {
  startTranscriptionFromBytes,
  getTranscriptionStatus,
} from "@/lib/assemblyai";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Pas 2 (inici): encua la transcripció de l'àudio de la reunió. */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
    }
    if (meeting.utterances.length) {
      return NextResponse.json({ meeting }); // ja transcrita
    }

    const audio = await readMeetingAudio(id);
    if (!audio) {
      return NextResponse.json(
        { error: "Aquesta reunió no té àudio per transcriure" },
        { status: 400 }
      );
    }

    const transcriptId = await startTranscriptionFromBytes(
      audio,
      meeting.speakers
    );
    const updated = await updateMeeting(id, { transcriptId });
    return NextResponse.json({ meeting: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut iniciar la transcripció: ${message}` },
      { status: 500 }
    );
  }
}

/** Pas 2 (comprovació/represa): consulta l'estat i, si està llest, el desa. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const meeting = await getMeeting(id);
    if (!meeting) {
      return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
    }
    if (meeting.utterances.length) {
      return NextResponse.json({ status: "completed", meeting });
    }
    if (!meeting.transcriptId) {
      return NextResponse.json({ status: "idle", meeting });
    }

    const result = await getTranscriptionStatus(meeting.transcriptId);
    if (result.status === "completed") {
      const updated = await updateMeeting(id, { utterances: result.utterances });
      return NextResponse.json({ status: "completed", meeting: updated });
    }
    if (result.status === "error") {
      // Reinicia perquè es pugui tornar a provar.
      const updated = await updateMeeting(id, { transcriptId: undefined });
      return NextResponse.json({
        status: "error",
        error: result.error ?? "La transcripció ha fallat",
        meeting: updated,
      });
    }
    return NextResponse.json({ status: result.status, meeting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut consultar la transcripció: ${message}` },
      { status: 500 }
    );
  }
}
