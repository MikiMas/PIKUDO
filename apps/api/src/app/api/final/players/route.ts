import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type RoomRow = { id: string; status: string; starts_at: string; rounds: number | null };
type RoomSettingsRow = { game_started_at: string | null };
type PlayerRow = { id: string; nickname: string; points: number; created_at?: string | null };
type RoomMemberRow = {
  player_id: string;
  nickname_at_join: string | null;
  points_at_leave: number | null;
  joined_at: string;
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

  const { data: members, error: membersError } = await supabase
    .from("room_members")
    .select("player_id,nickname_at_join,points_at_leave,joined_at")
    .eq("room_id", roomId)
    .limit(500)
    .returns<RoomMemberRow[]>();

  if (membersError) return NextResponse.json({ ok: false, error: membersError.message }, { status: 500 });

  const ids = (members ?? []).map((m) => m.player_id);
  if (ids.length === 0) return NextResponse.json({ ok: true, players: [] });

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id,nickname,points,created_at")
    .in("id", ids)
    .returns<PlayerRow[]>();

  if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 });

  const playerById = new Map((players ?? []).map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  if (ids.length > 0) {
    const { data: rows, error: rowsError } = await supabase
      .from("player_challenges")
      .select("id,player_id,media_url")
      .in("player_id", ids)
      .eq("completed", true)
      .not("media_url", "is", null)
      .limit(4000);
    if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });
    for (const row of rows ?? []) {
      const pid = String((row as any).player_id ?? "");
      if (!pid) continue;
      counts.set(pid, (counts.get(pid) ?? 0) + 1);
    }
  }

  const payload = (members ?? []).map((m) => {
    const p = playerById.get(m.player_id);
    const nickname = m.nickname_at_join ?? p?.nickname ?? "Jugador";
    const points = m.points_at_leave ?? p?.points ?? 0;
    const joinedAt = m.joined_at ?? p?.created_at ?? "";
    return {
      id: m.player_id,
      nickname,
      points,
      completedCount: counts.get(m.player_id) ?? 0,
      joinedAt
    };
  });

  payload.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return String(a.joinedAt).localeCompare(String(b.joinedAt));
  });

  return NextResponse.json({
    ok: true,
    players: payload.map(({ joinedAt, ...rest }) => rest)
  });
}
