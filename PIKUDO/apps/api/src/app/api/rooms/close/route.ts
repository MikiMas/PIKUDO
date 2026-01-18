import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

const BUCKET_RETOS = "retos";
const BUCKET_CHALLENGE_MEDIA = "challenge-media";

type Body = { code?: unknown };

function pathFromPublicStorageUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    const markerPublic = `/storage/v1/object/public/${bucket}/`;
    const markerSign = `/storage/v1/object/sign/${bucket}/`;
    const idxPublic = u.pathname.indexOf(markerPublic);
    if (idxPublic !== -1) return decodeURIComponent(u.pathname.slice(idxPublic + markerPublic.length));
    const idxSign = u.pathname.indexOf(markerSign);
    if (idxSign !== -1) {
      const rest = u.pathname.slice(idxSign + markerSign.length);
      const withoutLeading = rest.startsWith("/") ? rest.slice(1) : rest;
      const nextSlash = withoutLeading.indexOf("/");
      return decodeURIComponent(nextSlash === -1 ? withoutLeading : withoutLeading.slice(nextSlash + 1));
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let requesterId = "";

  try {
    const authed = await requirePlayerFromSession(req);
    requesterId = authed.player.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const body = (await req.json().catch(() => null)) as Body | null;
  const code = typeof body?.code === "string" ? body.code.toUpperCase() : "";
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: room, error: roomError } = await supabase.from("rooms").select("id,code").eq("code", code).maybeSingle<{ id: string; code: string }>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

  const { data: member } = await supabase
    .from("room_members")
    .select("role")
    .eq("room_id", room.id)
    .eq("player_id", requesterId)
    .maybeSingle<{ role: string }>();
  if ((member?.role ?? "") !== "owner") return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });

  const { data: players } = await supabase.from("players").select("id").eq("room_id", room.id).returns<{ id: string }[]>();
  const playerIds = (players ?? []).map((p) => p.id);

  const { data: pcs } =
    playerIds.length === 0
      ? { data: [] as { player_id: string; media_path: string | null; media_url: string | null }[] }
      : await supabase
          .from("player_challenges")
          .select("player_id,media_path,media_url")
          .in("player_id", playerIds)
          .returns<{ player_id: string; media_path: string | null; media_url: string | null }[]>();

  const retosPaths: string[] = [];
  const challengeMediaPaths: string[] = [];

  for (const pc of pcs ?? []) {
    if (pc.media_path) challengeMediaPaths.push(pc.media_path);
    if (pc.media_url) {
      const p = pathFromPublicStorageUrl(pc.media_url, BUCKET_RETOS);
      if (p) retosPaths.push(p);
    }
  }

  if (retosPaths.length) await supabase.storage.from(BUCKET_RETOS).remove(retosPaths);
  if (challengeMediaPaths.length) await supabase.storage.from(BUCKET_CHALLENGE_MEDIA).remove(challengeMediaPaths);

  if (playerIds.length) {
    await supabase.from("player_challenges").delete().in("player_id", playerIds);
    await supabase.from("room_members").delete().eq("room_id", room.id);
    await supabase.from("players").update({ room_id: null }).in("id", playerIds);
  } else {
    await supabase.from("room_members").delete().eq("room_id", room.id);
  }

  await supabase.from("room_settings").delete().eq("room_id", room.id);
  await supabase.from("rooms").delete().eq("id", room.id);

  return NextResponse.json({ ok: true });
}
