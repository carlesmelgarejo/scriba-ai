import { NextResponse } from "next/server";

// Ruta obsoleta: substituïda per /api/meetings/[id]/acta.
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Ruta obsoleta" }, { status: 410 });
}
