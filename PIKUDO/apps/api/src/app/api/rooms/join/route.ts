import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNickname, validateRoomCode } from "@/lib/validators";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type JoinBody = { code?: unknown; nickname?: unknown };
type RoomRow = { id: string; code: string; starts_at: string; ends_at: string };
type PlayerRow = { id: string; nickname: string; points: number };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as JoinBody | null;
  const code = body?.code;
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: room, error: roomError } = await supabase.from("rooms").select("id,code,starts_at,ends_at").eq("code", code).maybeSingle<RoomRow>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

  let devicePlayerId = "";
  let deviceNickname = "";
  let deviceRoomId: string | null = null;

  try {
    const { player } = await requirePlayerFromDevice(req);
    devicePlayerId = player.id;
    deviceNickname = player.nickname;
    deviceRoomId = player.room_id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  if (deviceRoomId) {
    return NextResponse.json({ ok: false, error: "ALREADY_IN_ROOM" }, { status: 409 });
  }

  const nick = validateNickname(body?.nickname);
  const nextNickname = nick.ok ? nick.nickname : deviceNickname;

  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({ room_id: room.id, points: 0, nickname: nextNickname })
    .eq("id", devicePlayerId)
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (updateError) {
    const pgCode = (updateError as any).code as string | undefined;
    if (pgCode === "23505") return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await supabase.from("room_members").upsert({
    room_id: room.id,
    player_id: updated.id,
    role: "member",
    left_at: null,
    points_at_leave: null,
    nickname_at_join: updated.nickname
  });
  return NextResponse.json({ ok: true, room: { id: room.id, code: room.code }, player: updated });
}
