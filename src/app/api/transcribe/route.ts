import { NextResponse } from "next/server";

// Ruta obsoleta: el flux ara és per passos a /api/meetings i /api/meetings/[id]/*.
export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json({ error: "Ruta obsoleta" }, { status: 410 });
}
