import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";
import { validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

const BUCKET = "retos";

type PlayerChallengeRow = {
  id: string;
  player_id: string;
  block_start: string;
  media_url: string | null;
  media_mime: string | null;
};

function getStoragePath(url: string): string | null {
  try {
    const u = new URL(url);
    const marker = `/${BUCKET}/`;
    const idx = u.pathname.indexOf(marker);
    if (idx === -1) return null;
    return u.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  let playerId = "";
  try {
    const authed = await requirePlayerFromDevice(req);
    playerId = authed.player.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const body = await req.json().catch(() => null);
  const playerChallengeId = body?.playerChallengeId;
  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data: pc, error: pcError } = await supabase
    .from("player_challenges")
    .select("id,player_id,block_start,media_url,media_mime")
    .eq("id", String(playerChallengeId))
    .maybeSingle<PlayerChallengeRow>();

  if (pcError) return NextResponse.json({ ok: false, error: pcError.message }, { status: 500 });
  if (!pc || pc.player_id !== playerId) {
    return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });
  }

  const { data: rejected, error: rejectError } = (await supabase.rpc("reject_player_challenge", {
    p_player_challenge_id: pc.id
  })) as { data: { player_id: string; points: number; rejected_now: boolean }[] | null; error: { message: string } | null };

  if (rejectError) {
    return NextResponse.json({ ok: false, error: rejectError.message }, { status: 500 });
  }

  const pathFromUrl = pc.media_url ? getStoragePath(pc.media_url) : null;
  if (pathFromUrl) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove([pathFromUrl]);
    if (removeError) {
      return NextResponse.json({ ok: false, error: removeError.message }, { status: 500 });
    }
  }

  const { error: updateError } = await supabase
    .from("player_challenges")
    .update({
      media_url: null,
      media_type: null,
      media_mime: null,
      media_uploaded_at: null
    })
    .eq("id", pc.id);

  if (updateError) return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });

  const row = (rejected ?? [])[0] ?? null;
  return NextResponse.json({ ok: true, points: row?.points ?? null, rejectedNow: row?.rejected_now ?? false });
}
