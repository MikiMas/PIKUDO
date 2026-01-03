import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { getBlockStartFromAnchor, secondsToNextBlockFromAnchor } from "@/lib/timeBlock";

export const runtime = "nodejs";

type AssignedChallengeRow = {
  player_challenge_id: string;
  title: string;
  description: string;
  completed: boolean;
};

export async function GET(req: Request) {
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

  const now = new Date();
  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,starts_at,ends_at,status,rounds")
    .eq("id", roomId)
    .maybeSingle<{ id: string; starts_at: string; ends_at: string; status: string }>();
  if (roomError || !room) return NextResponse.json({ ok: false, error: roomError?.message ?? "ROOM_NOT_FOUND" }, { status: 500 });

  const { data: settings } = await supabase
    .from("room_settings")
    .select("game_status,game_started_at")
    .eq("room_id", roomId)
    .maybeSingle<{ game_status: string; game_started_at: string | null }>();

  const startedAtIso = (settings as any)?.game_started_at as string | null;
  if (!startedAtIso) {
    return NextResponse.json({ paused: true, state: "scheduled", blockStart: new Date().toISOString(), nextBlockInSec: 0 });
  }

  const startedAt = new Date(startedAtIso);
  const rounds = Math.min(9, Math.max(1, Math.floor((room as any).rounds ?? 1)));
  const endsAt = new Date(startedAt.getTime() + rounds * 30 * 60 * 1000);
  if (now.getTime() >= endsAt.getTime()) {
    return NextResponse.json({ paused: true, state: "ended", blockStart: endsAt.toISOString(), nextBlockInSec: 0 });
  }

  const blockStart = getBlockStartFromAnchor(now, startedAt);
  const nextBlockInSec = secondsToNextBlockFromAnchor(now, startedAt);

  if ((settings?.game_status ?? "running").toLowerCase() === "paused") {
    return NextResponse.json({ paused: true, state: "paused", nextBlockInSec, blockStart: blockStart.toISOString() });
  }

  const { data: assigned, error: assignError } = (await supabase.rpc("assign_challenges_for_block", {
    p_room_id: roomId,
    p_player_id: playerId,
    p_block_start: blockStart.toISOString()
  })) as { data: AssignedChallengeRow[] | null; error: { message: string } | null };

  if (assignError) {
    const msg = assignError.message || "RPC_FAILED";
    if (msg.toLowerCase().includes("assign_challenges_for_block")) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_RPC_ASSIGN_CHALLENGES",
          hint: "Ejecuta scripts/sql/assign_challenges_for_block.sql en Supabase (SQL Editor)."
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const ids = (assigned ?? []).map((c) => c.player_challenge_id);
  const { data: mediaRows } =
    ids.length === 0
      ? { data: [] as { id: string; media_url: string | null; media_type: string | null; media_mime: string | null }[] }
      : await supabase.from("player_challenges").select("id,media_url,media_type,media_mime").in("id", ids);
  const mediaById = new Map(
    (mediaRows ?? []).map((r: any) => [
      String(r.id),
      { url: r.media_url ?? null, type: r.media_type ?? null, mime: r.media_mime ?? null }
    ])
  );

  return NextResponse.json({
    paused: false,
    blockStart: blockStart.toISOString(),
    nextBlockInSec,
    challenges: (assigned ?? []).map((c) => ({
      id: c.player_challenge_id,
      title: c.title,
      description: c.description,
      completed: c.completed,
      hasMedia: Boolean(mediaById.get(c.player_challenge_id)?.url),
      media: mediaById.get(c.player_challenge_id) ?? null
    }))
  });
}
