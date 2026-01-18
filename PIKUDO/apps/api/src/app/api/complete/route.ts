import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateUuid } from "@/lib/validators";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { getBlockStartFromAnchor } from "@/lib/timeBlock";

export const runtime = "nodejs";

type CompleteResultRow = { points: number; completed_now: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { playerChallengeId?: unknown } | null;
  const playerChallengeId = body?.playerChallengeId;
  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  let playerId = "";
  let roomId = "";
  try {
    const { player } = await requirePlayerFromSession(req);
    playerId = player.id;
    roomId = player.room_id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("rounds")
    .eq("id", roomId)
    .maybeSingle<{ rounds: number }>();
  if (roomError || !room) return NextResponse.json({ ok: false, error: roomError?.message ?? "ROOM_NOT_FOUND" }, { status: 500 });

  const { data: settings } = await supabase
    .from("room_settings")
    .select("game_started_at,game_status")
    .eq("room_id", roomId)
    .maybeSingle<{ game_started_at: string | null; game_status: string }>();

  const startedAtIso = settings?.game_started_at ?? null;
  if (!startedAtIso) return NextResponse.json({ ok: false, error: "GAME_NOT_STARTED" }, { status: 403 });
  // Pause is disabled in app flow; do not block completions.

  const startedAt = new Date(startedAtIso);
  const rounds = Math.min(9, Math.max(1, Math.floor(room.rounds ?? 1)));
  const endsAt = new Date(startedAt.getTime() + rounds * 30 * 60 * 1000);
  const now = new Date();
  if (now.getTime() >= endsAt.getTime()) return NextResponse.json({ ok: false, error: "ENDED" }, { status: 403 });

  const blockStart = getBlockStartFromAnchor(now, startedAt);

  const { data, error } = (await supabase.rpc("complete_player_challenge", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_player_challenge_id: playerChallengeId.trim(),
    p_block_start: blockStart.toISOString()
  })) as { data: CompleteResultRow[] | null; error: { message: string } | null };

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const row = data?.[0];
  if (!row) {
    return NextResponse.json({ ok: false, error: "COMPLETE_FAILED" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, points: row.points, completedNow: row.completed_now });
}
