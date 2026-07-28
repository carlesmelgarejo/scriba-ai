import { NextRequest, NextResponse } from "next/server";
import { getMeeting, updateMeeting } from "@/lib/store";
import { cleanTranscript } from "@/lib/clean";

export const runtime = "nodejs";
export const maxDuration = 300;

/** Pas opcional: neteja/corregeix la transcripció crua amb l'LLM. */
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
    if (!meeting.utterances.length) {
      return NextResponse.json(
        { error: "Cal transcriure abans de netejar" },
        { status: 400 }
      );
    }

    const { utterances, usage } = await cleanTranscript(meeting.utterances);
    const updated = await updateMeeting(id, {
      cleanedUtterances: utterances,
      cleanLlm: usage,
    });
    return NextResponse.json({ meeting: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut netejar la transcripció: ${message}` },
      { status: 500 }
    );
  }
}
