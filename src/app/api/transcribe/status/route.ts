import { NextResponse } from "next/server";

// Ruta obsoleta: substituïda per /api/meetings/[id]/transcribe.
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ error: "Ruta obsoleta" }, { status: 410 });
}
