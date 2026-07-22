import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { createSessionToken, COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const { password } = (await req.json()) as { password?: string };
    const hashB64 = process.env.AUTH_PASSWORD_HASH_B64;

    if (!hashB64) {
      return NextResponse.json(
        { error: "Login no configurat (falta AUTH_PASSWORD_HASH_B64)" },
        { status: 500 }
      );
    }

    const hash = Buffer.from(hashB64.trim(), "base64").toString("utf8");

    const ok = !!password && (await bcrypt.compare(password, hash));
    if (!ok) {
      return NextResponse.json(
        { error: "Contrasenya incorrecta" },
        { status: 401 }
      );
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set(COOKIE_NAME, await createSessionToken(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch {
    return NextResponse.json({ error: "Error inesperat" }, { status: 500 });
  }
}
