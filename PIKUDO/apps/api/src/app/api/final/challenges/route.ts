import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type RoomRow = { id: string; status: string; starts_at: string; rounds: number | null };
type RoomSettingsRow = { game_started_at: string | null };

type ChallengeRow = {
  challenge_id: string;
  media_url: string | null;
  challenges: { title: string; description: string | null } | null;
};

async function isRoomEnded(supabase: ReturnType<typeof supabaseAdmin>, roomId: string): Promise<boolean> {
  const now = new Date();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,status,starts_at,rounds")
    .eq("id", roomId)
    .maybeSingle<RoomRow>();
  if (roomError || !room) return false;

  const roomStatus = String((room as any)?.status ?? "").toLowerCase();
  if (roomStatus === "ended") return true;

  const { data: settings } = await supabase
    .from("room_settings")
    .select("game_started_at")
    .eq("room_id", roomId)
    .maybeSingle<RoomSettingsRow>();

  const startedAtIso = ((settings as any)?.game_started_at as string | null) ?? null;
  const startedAtFallback = roomStatus === "running" ? ((room as any)?.starts_at as string | null) ?? null : null;
  const effectiveStartedAtIso = startedAtIso ?? startedAtFallback;
  if (!effectiveStartedAtIso) return false;

  const startedAt = new Date(effectiveStartedAtIso);
  const rounds = Math.min(10, Math.max(1, Math.floor((room as any).rounds ?? 1)));
  const endsAt = new Date(startedAt.getTime() + rounds * 30 * 60 * 1000);
  return now.getTime() >= endsAt.getTime();
}

export async function GET(req: Request) {
  const supabase = supabaseAdmin();
  let roomId = "";
  try {
    const { player } = await requirePlayerFromSession(req);
    roomId = player.room_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    return NextResponse.json({ ok: false, error: msg }, { status: msg === "UNAUTHORIZED" ? 401 : 500 });
  }

  const ended = await isRoomEnded(supabase, roomId);
  if (!ended) return NextResponse.json({ ok: false, error: "GAME_NOT_ENDED" }, { status: 400 });

  const { data: players, error: playersError } = await supabase
    .from("room_members")
    .select("player_id")
    .eq("room_id", roomId)
    .limit(500);
  if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 });
  const ids = (players ?? []).map((p: any) => String(p.player_id));
  if (ids.length === 0) return NextResponse.json({ ok: true, challenges: [] });

  const { data: rows, error: rowsError } = await supabase
    .from("player_challenges")
    .select("challenge_id,media_url, challenges ( title, description )")
    .in("player_id", ids)
    .limit(4000)
    .returns<ChallengeRow[]>();
  if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });

  const byChallenge = new Map<
    string,
    { id: string; title: string; description: string | null; mediaCount: number }
  >();
  for (const row of rows ?? []) {
    const cid = String(row.challenge_id ?? "");
    if (!cid) continue;
    const title = row.challenges?.title ?? "(sin titulo)";
    const description = row.challenges?.description ?? null;
    if (!byChallenge.has(cid)) {
      byChallenge.set(cid, { id: cid, title, description, mediaCount: 0 });
    }
    if (row.media_url) {
      const entry = byChallenge.get(cid);
      if (entry) entry.mediaCount += 1;
    }
  }

  return NextResponse.json({ ok: true, challenges: Array.from(byChallenge.values()) });
}
