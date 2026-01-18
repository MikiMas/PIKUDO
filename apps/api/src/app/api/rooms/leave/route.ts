import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

export async function POST(req: Request) {
  let playerId = "";
  let roomId: string | null = null;
  let pointsAtLeave = 0;
  let nicknameAtJoin = "";

  try {
    const authed = await requirePlayerFromSession(req);
    playerId = authed.player.id;
    roomId = authed.player.room_id ?? null;
    pointsAtLeave = authed.player.points ?? 0;
    nicknameAtJoin = authed.player.nickname ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const supabase = supabaseAdmin();

  const nowIso = new Date().toISOString();
  if (roomId) {
    await supabase
      .from("room_members")
      .update({ left_at: nowIso, points_at_leave: pointsAtLeave, nickname_at_join: nicknameAtJoin })
      .eq("room_id", roomId)
      .eq("player_id", playerId);
  }

  // Keep session + player identity; only detach from the room.
  await supabase.from("players").update({ room_id: null }).eq("id", playerId);

  return NextResponse.json({ ok: true });
}
