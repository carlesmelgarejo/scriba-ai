import { NextRequest, NextResponse } from "next/server";
import { getTranscriptionStatus } from "@/lib/assemblyai";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Falta l'id" }, { status: 400 });
    }

    const status = await getTranscriptionStatus(id);
    return NextResponse.json(status);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconegut";
    return NextResponse.json(
      { error: `No s'ha pogut consultar l'estat: ${message}` },
      { status: 500 }
    );
  }
}
