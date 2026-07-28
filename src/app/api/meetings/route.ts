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

    // Transcodificació obligatòria: l'àudio sempre es desa en Opus. Si falla
    // (p. ex. ffmpeg no disponible o format no vàlid), no desem res i retornem
    // error, així el client pot reintentar sense perdre l'àudio.
    const opus = await transcodeToOpus(bytes);
    console.log(
      `[meetings] rebut=${bytes.length} bytes · opus=${opus?.length ?? 0} bytes`
    );
    if (!opus) {
      return NextResponse.json(
        {
          error:
            "No s'ha pogut transcodificar l'àudio a Opus. Comprova que ffmpeg estigui instal·lat al servidor i que el fitxer sigui un àudio vàlid.",
        },
        { status: 422 }
      );
    }

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
