import { NextRequest, NextResponse } from "next/server";
import { startTranscription } from "@/lib/assemblyai";

export const runtime = "nodejs";
export const maxDuration = 120;

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

    const id = await startTranscription(audio);
    return NextResponse.json({ id });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut iniciar la transcripció: ${message}` },
      { status: 500 }
    );
  }
}
