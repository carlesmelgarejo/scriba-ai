import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getMeetingAudioPath } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = await getMeetingAudioPath(id);
  if (!filePath) {
    return NextResponse.json({ error: "Àudio no trobat" }, { status: 404 });
  }

  const data = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "audio/ogg",
      "Content-Disposition": `inline; filename="${id}.opus"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
