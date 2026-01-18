import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number; created_at: string };
type CompletedRow = {
  id: string;
  completed_at: string | null;
  block_start: string;
  media_url: string | null;
  media_type: string | null;
  media_mime: string | null;
  challenges: { title: string; description: string | null } | null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const playerId = url.searchParams.get("playerId");
  if (!validateUuid(playerId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: player, error: playerError } = await supabase
    .from("players")
    .select("id,nickname,points,created_at")
    .eq("id", playerId.trim())
    .maybeSingle<PlayerRow>();

  if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  if (!player) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const { data: rows, error: rowsError } = await supabase
    .from("player_challenges")
    .select("id,completed_at,block_start,media_url,media_type,media_mime, challenges ( title, description )")
    .eq("player_id", player.id)
    .eq("completed", true)
    .order("completed_at", { ascending: false })
    .limit(200)
    .returns<CompletedRow[]>();

  if (rowsError) return NextResponse.json({ ok: false, error: rowsError.message }, { status: 500 });

  const completed = (rows ?? []).map((r) => ({
    id: r.id,
    title: r.challenges?.title ?? "(sin título)",
    description: r.challenges?.description ?? "",
    completedAt: r.completed_at,
    blockStart: r.block_start,
    media: r.media_url ? { path: r.media_url, mime: r.media_mime ?? "", url: r.media_url } : null
  }));

  return NextResponse.json({ ok: true, player, completed });
}
