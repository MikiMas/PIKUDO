import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

type RoomRow = { id: string; status: string; starts_at: string; rounds: number | null };
type RoomSettingsRow = { game_started_at: string | null };

type PlayerRow = { id: string; nickname: string; points: number; room_id: string };
type RoomMemberRow = { player_id: string; nickname_at_join: string | null; points_at_leave: number | null };

type CompletedRow = {
  id: string;
  completed_at: string | null;
  block_start: string;
  media_url: string | null;
  media_type: string | null;
  media_mime: string | null;
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
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");
  if (!validateUuid(playerId)) return NextResponse.json({ ok: false, error: "INVALID_PLAYER_ID" }, { status: 400 });

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

  const { data: member, error: memberError } = await supabase
    .from("room_members")
    .select("player_id,nickname_at_join,points_at_leave")
    .eq("room_id", roomId)
    .eq("player_id", playerId!.trim())
    .maybeSingle<RoomMemberRow>();

  if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });
  if (!member) return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id,nickname,points,room_id")
    .eq("id", playerId!.trim())
    .maybeSingle<PlayerRow>();

  if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  if (!player) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  if (member.player_id !== player.id) return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

  const { data: rows, error: rowsError } = await supabase
    .from("player_challenges")
    .select("id,completed_at,block_start,media_url,media_type,media_mime, challenges ( title, description )")
    .eq("player_id", player.id)
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(200)
    .returns<CompletedRow[]>();

  if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });

  const completed = (rows ?? [])
    .filter((r) => Boolean(r.media_url))
    .map((r) => ({
      id: r.id,
      title: r.challenges?.title ?? "(sin t\u00edtulo)",
      description: r.challenges?.description ?? "",
      completedAt: r.completed_at,
      blockStart: r.block_start,
      media: r.media_url ? { url: r.media_url, mime: r.media_mime ?? "", type: r.media_type ?? "" } : null
    }));

  const nickname = member.nickname_at_join ?? player.nickname;
  const points = member.points_at_leave ?? player.points ?? 0;

  return NextResponse.json({ ok: true, player: { id: player.id, nickname, points }, completed });
}
