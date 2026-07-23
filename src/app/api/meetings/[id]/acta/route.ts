import { NextRequest, NextResponse } from "next/server";
import { getMeeting, updateMeeting } from "@/lib/store";
import { generateActa } from "@/lib/acta";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Pas 3: genera l'acta a partir de la transcripció ja desada. */
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
        { error: "Cal transcriure abans de generar l'acta" },
        { status: 400 }
      );
    }

    const { acta, usage } = await generateActa(meeting.utterances);
    const updated = await updateMeeting(id, {
      acta,
      title: acta.titol,
      llm: usage,
    });
    return NextResponse.json({ meeting: updated });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut generar l'acta: ${message}` },
      { status: 500 }
    );
  }
}
