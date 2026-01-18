import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type LeaderRow = { nickname: string; points: number };

const lastHitByIp = new Map<string, number>();
const WINDOW_MS = 1000;

function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") ?? "unknown";
}

function rateLimit(req: Request): NextResponse | null {
  if (process.env.NODE_ENV !== "production") return null;
  const ip = getClientIp(req);
  const now = Date.now();
  const last = lastHitByIp.get(ip) ?? 0;
  if (now - last < WINDOW_MS) {
    return NextResponse.json({ ok: false, error: "RATE_LIMITED" }, { status: 429 });
  }
  lastHitByIp.set(ip, now);

  if (lastHitByIp.size > 10_000) {
    for (const [key, ts] of lastHitByIp) {
      if (now - ts > 60_000) lastHitByIp.delete(key);
    }
  }

  return null;
}

export async function GET(req: Request) {
  const limited = rateLimit(req);
  if (limited) return limited;

  const supabase = supabaseAdmin();
  let roomId = "";
  try {
    const { player } = await requirePlayerFromSession(req);
    roomId = player.room_id;
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("players")
    .select("nickname,points")
    .eq("room_id", roomId)
    .order("points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(50)
    .returns<LeaderRow[]>();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, leaders: data ?? [] });
}
