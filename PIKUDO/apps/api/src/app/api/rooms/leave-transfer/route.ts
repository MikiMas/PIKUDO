import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type PlayerRow = { id: string; created_at?: string | null };

export async function POST(req: Request) {
  try {
    const authed = await requirePlayerFromSession(req);
    const playerId = authed.player.id;
    const playerNickname = authed.player.nickname;
    const playerPoints = authed.player.points ?? 0;

    const supabase = supabaseAdmin();

    const { data: member } = await supabase
      .from("room_members")
      .select("room_id,role")
      .eq("player_id", playerId)
      .maybeSingle<{ room_id: string; role: string }>();

    if (!member?.room_id) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (member.role !== "owner") return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

    const roomId = member.room_id;

    const { data: players } = await supabase
      .from("players")
      .select("id,created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .returns<PlayerRow[]>();

    const nextOwner = (players ?? []).find((p) => p.id !== playerId) ?? null;

    // If no one else is in the room, close it completely.
    if (!nextOwner) {
      await supabase.from("player_challenges").delete().eq("player_id", playerId);
      await supabase.from("room_members").delete().eq("room_id", roomId);
      await supabase.from("players").delete().eq("id", playerId);
      await supabase.from("room_settings").delete().eq("room_id", roomId);
      await supabase.from("rooms").delete().eq("id", roomId);

      return NextResponse.json({ ok: true, closed: true });
    }

    const nowIso = new Date().toISOString();

    // Transfer leadership and mark owner as left (keep media and challenges).
    await supabase
      .from("room_members")
      .update({ role: "member", left_at: nowIso, points_at_leave: playerPoints, nickname_at_join: playerNickname })
      .eq("room_id", roomId)
      .eq("player_id", playerId);
    await supabase.from("room_members").update({ role: "owner" }).eq("room_id", roomId).eq("player_id", nextOwner.id);
    await supabase.from("rooms").update({ created_by_player_id: nextOwner.id }).eq("id", roomId);

    // Detach player from room (keep device identity).
    await supabase.from("players").update({ room_id: null, nickname: playerNickname }).eq("id", playerId);

    return NextResponse.json({ ok: true, newOwnerId: nextOwner.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
