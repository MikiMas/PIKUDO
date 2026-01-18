import crypto from "crypto";

type AdminTokenPayload = {
  v: 1;
  iat: number;
  jti: string;
};

function base64UrlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString("base64url");
}

function base64UrlDecode(input: string): string {
  return Buffer.from(input, "base64url").toString("utf8");
}

function requireAdminSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) throw new Error("Missing environment variable: ADMIN_SECRET");
  return secret;
}

export function signAdminToken(): string {
  const payload: AdminTokenPayload = { v: 1, iat: Math.floor(Date.now() / 1000), jti: crypto.randomUUID() };
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac("sha256", requireAdminSecret()).update(payloadB64).digest("base64url");
  return `${payloadB64}.${sig}`;
}

export function verifyAdminToken(token: string): boolean {
  const [payloadB64, sig] = token.split(".");
  if (!payloadB64 || !sig) return false;
  const expected = crypto.createHmac("sha256", requireAdminSecret()).update(payloadB64).digest("base64url");
  const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  if (!ok) return false;
  try {
    const payload = JSON.parse(base64UrlDecode(payloadB64)) as AdminTokenPayload;
    if (payload?.v !== 1) return false;
    if (typeof payload.iat !== "number") return false;
    return true;
  } catch {
    return false;
  }
}

export function readCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const n = part.slice(0, eq).trim();
    if (n !== name) continue;
    const value = part.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

export function requireAdminCookie(req: Request): void {
  const token = readCookie(req, "adm");
  if (!token) throw new Error("UNAUTHORIZED");
  if (!verifyAdminToken(token)) throw new Error("UNAUTHORIZED");
}

