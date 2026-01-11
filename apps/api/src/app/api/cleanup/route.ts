import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

const BUCKET_RETOS = "retos";
const BUCKET_CHALLENGE_MEDIA = "challenge-media";

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
  const url = new URL(req.url);
  const token = (req.headers.get("x-cleanup-token") ?? "").trim();
  const tokenQuery = (url.searchParams.get("token") ?? "").trim();
  const expected = process.env.CLEANUP_TOKEN ?? "";
  if (!expected || (token !== expected && tokenQuery !== expected)) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const supabase = supabaseAdmin();
  const cutoffIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rooms, error: roomsError } = await supabase
    .from("rooms")
    .select("id")
    .eq("status", "ended")
    .not("ends_at", "is", null)
    .lte("ends_at", cutoffIso)
    .limit(200)
    .returns<{ id: string }[]>();
  if (roomsError) return NextResponse.json({ ok: false, error: roomsError.message }, { status: 500 });

  const roomIds = (rooms ?? []).map((r) => r.id);
  if (roomIds.length === 0) return NextResponse.json({ ok: true, deletedRooms: 0 });

  const { data: players } = await supabase.from("players").select("id,room_id").in("room_id", roomIds);
  const playerIds = (players ?? []).map((p: any) => String(p.id));

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
    await supabase.from("room_members").delete().in("room_id", roomIds);
    await supabase.from("players").delete().in("id", playerIds);
  } else {
    await supabase.from("room_members").delete().in("room_id", roomIds);
  }

  await supabase.from("room_settings").delete().in("room_id", roomIds);
  await supabase.from("rooms").delete().in("id", roomIds);

  return NextResponse.json({ ok: true, deletedRooms: roomIds.length });
}
