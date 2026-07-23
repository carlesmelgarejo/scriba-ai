import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import { getMeetingAudioPath } from "@/lib/store";

export const runtime = "nodejs";

async function readChunk(
  filePath: string,
  start: number,
  end: number
): Promise<Buffer> {
  const fh = await fs.open(filePath, "r");
  try {
    const length = end - start + 1;
    const buf = Buffer.alloc(length);
    await fh.read(buf, 0, length, start);
    return buf;
  } finally {
    await fh.close();
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filePath = await getMeetingAudioPath(id);
  if (!filePath) {
    return NextResponse.json({ error: "Àudio no trobat" }, { status: 404 });
  }

  const size = (await fs.stat(filePath)).size;
  const range = req.headers.get("range");

  // Petició de rang → 206 Partial Content (permet cercar dins de l'àudio).
  if (range) {
    const match = /bytes=(\d*)-(\d*)/.exec(range);
    let start = match && match[1] ? parseInt(match[1], 10) : 0;
    let end = match && match[2] ? parseInt(match[2], 10) : size - 1;
    if (!Number.isFinite(start) || start < 0) start = 0;
    if (!Number.isFinite(end) || end >= size) end = size - 1;
    if (start > end) start = 0;

    const chunk = await readChunk(filePath, start, end);
    return new NextResponse(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "Content-Type": "audio/ogg",
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  const data = await fs.readFile(filePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": "audio/ogg",
      "Content-Length": String(size),
      "Accept-Ranges": "bytes",
      "Content-Disposition": `inline; filename="${id}.opus"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
