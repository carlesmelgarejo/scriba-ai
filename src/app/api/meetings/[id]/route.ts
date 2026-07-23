import { NextRequest, NextResponse } from "next/server";
import { getMeeting, deleteMeeting } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const meeting = await getMeeting(id);
  if (!meeting) {
    return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
  }
  return NextResponse.json({ meeting });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ok = await deleteMeeting(id);
  if (!ok) {
    return NextResponse.json({ error: "Reunió no trobada" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
