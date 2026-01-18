export type NicknameValidationResult =
  | { ok: true; nickname: string }
  | { ok: false; error: "INVALID_NICKNAME" };

export function validateNickname(input: unknown): NicknameValidationResult {
  if (typeof input !== "string") return { ok: false, error: "INVALID_NICKNAME" };
  const nickname = input.trim().replace(/\s+/g, " ");
  if (
    !/^(?=.{3,24}$)(?=.*[\p{L}\p{N}])[\p{L}\p{N}_ -]+$/u.test(nickname)
  ) {
    return { ok: false, error: "INVALID_NICKNAME" };
  }
  return { ok: true, nickname };
}

export function readSessionTokenFromRequest(req: Request): string | null {
  const header = req.headers.get("x-session-token");
  if (header && header.trim()) return header.trim();

  const cookieHeader = req.headers.get("cookie") ?? "";
  const parts = cookieHeader.split(";").map((p) => p.trim());
  for (const part of parts) {
    if (!part) continue;
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const name = part.slice(0, eq).trim();
    if (name !== "st") continue;
    const value = part.slice(eq + 1);
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

export function readDeviceIdFromRequest(req: Request): string | null {
  const header = req.headers.get("x-device-id");
  if (header && header.trim()) return header.trim();
  return null;
}

export function validateUuid(input: unknown): input is string {
  if (typeof input !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    input.trim()
  );
}

export function validateRoomCode(input: unknown): input is string {
  if (typeof input !== "string") return false;
  const code = input.trim();
  return /^[A-Z0-9]{4,10}$/.test(code);
}
