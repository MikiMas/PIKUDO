import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateRoomCode } from "@/lib/validators";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type Body = { code?: unknown };
type PlayerRow = { id: string; room_id: string };
type RoomRow = { id: string; code: string };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Body | null;
  const code = body?.code;
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  let playerId = "";
  let playerRoomId: string | null = null;

  try {
    const authed = await requirePlayerFromDevice(req);
    playerId = authed.player.id;
    playerRoomId = authed.player.room_id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const supabase = supabaseAdmin();

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id,room_id")
    .eq("id", playerId)
    .maybeSingle<PlayerRow>();
  if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  if (!player || !playerRoomId) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,code")
    .eq("code", code)
    .maybeSingle<RoomRow>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
  if (room.id !== player.room_id) return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

  const { data: member } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("player_id", player.id)
    .maybeSingle<{ role: string }>();
  if ((member?.role ?? "") !== "owner") return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabase.from("rooms").update({ status: "ended", ends_at: nowIso }).eq("id", room.id);
  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  return NextResponse.json({ ok: true, endedAt: nowIso });
}

