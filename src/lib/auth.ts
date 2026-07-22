// Sessió signada amb HMAC-SHA256 (Web Crypto), vàlida a Node i al middleware (Edge).

export const COOKIE_NAME = "acta_session";
const SESSION_DAYS = 7;

const encoder = new TextEncoder();

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("Falta la variable d'entorn AUTH_SECRET");
  return value;
}

function toB64url(bytes: Uint8Array): string {
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(str: string): Uint8Array<ArrayBuffer> {
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/** Crea un token de sessió signat amb caducitat. */
export async function createSessionToken(): Promise<string> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const payload = toB64url(encoder.encode(JSON.stringify({ exp })));
  const sig = new Uint8Array(
    await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(payload))
  );
  return `${payload}.${toB64url(sig)}`;
}

/** Verifica la signatura i la caducitat del token. */
export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return false;

    const valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(),
      fromB64url(sig),
      encoder.encode(payload)
    );
    if (!valid) return false;

    const data = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
    return typeof data.exp === "number" && data.exp > Date.now();
  } catch {
    return false;
  }
}

export const SESSION_MAX_AGE = SESSION_DAYS * 24 * 60 * 60;
