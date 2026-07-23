import { NextRequest, NextResponse } from "next/server";
import { startTranscription } from "@/lib/assemblyai";
import { transcodeToOpus } from "@/lib/audio";
import { savePendingAudio } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const audio = form.get("audio");

    if (!(audio instanceof File)) {
      return NextResponse.json(
        { error: "No s'ha rebut cap fitxer d'àudio" },
        { status: 400 }
      );
    }

    const speakersRaw = form.get("speakers");
    const speakers =
      typeof speakersRaw === "string" ? parseInt(speakersRaw, 10) : NaN;

    const bytes = Buffer.from(await audio.arrayBuffer());
    const id = await startTranscription(
      audio,
      Number.isFinite(speakers) ? speakers : undefined
    );

    // Transcodifica una còpia a Opus i la desa temporalment (opcional).
    let audioToken: string | null = null;
    try {
      const opus = await transcodeToOpus(bytes);
      if (opus) {
        audioToken = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        await savePendingAudio(audioToken, opus);
      }
    } catch (e) {
      console.error("No s'ha pogut transcodificar l'àudio:", e);
    }

    return NextResponse.json({ id, audioToken });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut iniciar la transcripció: ${message}` },
      { status: 500 }
    );
  }
}
