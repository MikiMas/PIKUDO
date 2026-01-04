import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest, validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

type Body = { code?: unknown };
type SessionRow = { player_id: string };
type PlayerRow = { id: string; room_id: string };
type RoomRow = { id: string; code: string };

export async function POST(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as Body | null;
  const code = body?.code;
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();
  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id,room_id")
    .eq("id", session.player_id)
    .maybeSingle<PlayerRow>();
  if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  if (!player) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

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

