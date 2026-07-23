import { NextRequest, NextResponse } from "next/server";
import { listMeetings, createAudioMeeting } from "@/lib/store";
import { transcodeToOpus } from "@/lib/audio";

export const runtime = "nodejs";
export const maxDuration = 300;

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

/** Pas 1: desa l'àudio (transcodificat a Opus) com a nova reunió.
 *  El cos és l'àudio binari cru (evita el parser multipart, fràgil amb fitxers grans). */
export async function POST(req: NextRequest) {
  try {
    const bytes = Buffer.from(await req.arrayBuffer());
    if (bytes.length === 0) {
      return NextResponse.json(
        { error: "No s'ha rebut cap àudio" },
        { status: 400 }
      );
    }

    const speakersRaw = req.nextUrl.searchParams.get("speakers");
    const speakers = speakersRaw ? parseInt(speakersRaw, 10) : NaN;
    const durationRaw = req.nextUrl.searchParams.get("duration");
    const duration = durationRaw ? parseInt(durationRaw, 10) : NaN;

    const opus = (await transcodeToOpus(bytes)) ?? bytes; // si no hi ha ffmpeg, desa l'original

    const meeting = await createAudioMeeting(
      opus,
      Number.isFinite(speakers) ? speakers : undefined,
      Number.isFinite(duration) ? duration : undefined
    );
    return NextResponse.json({ meeting });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut desar l'àudio: ${message}` },
      { status: 500 }
    );
  }
}
