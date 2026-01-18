import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateUuid } from "@/lib/validators";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

const BUCKET = "retos";

type PlayerChallengeRow = { id: string; player_id: string; block_start: string };

function extFromMime(mime: string): string {
  if (mime.startsWith("image/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".jpg";
  if (mime.startsWith("video/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".mp4";
  return "";
}

function buildStoragePath(roomId: string, playerId: string, blockStartIso: string, pcId: string, mime: string): string {
  return `${roomId}/${playerId}/${blockStartIso}/${pcId}${extFromMime(mime)}`;
}

export async function POST(req: Request) {
  let playerId = "";
  let roomId = "";
  try {
    const authed = await requirePlayerFromDevice(req);
    playerId = authed.player.id;
    roomId = authed.player.room_id ?? "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  const body = (await req.json().catch(() => null)) as { playerChallengeId?: unknown; mime?: unknown } | null;
  const playerChallengeId = body?.playerChallengeId;
  const mime = typeof body?.mime === "string" ? body.mime : "";

  if (!validateUuid(playerChallengeId)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }
  if (!mime || (!mime.startsWith("image/") && !mime.startsWith("video/"))) {
    return NextResponse.json({ ok: false, error: "INVALID_MIME" }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: pc, error: pcError } = await supabase
    .from("player_challenges")
    .select("id,player_id,block_start")
    .eq("id", playerChallengeId.trim())
    .maybeSingle<PlayerChallengeRow>();

  if (pcError) return NextResponse.json({ ok: false, error: pcError.message }, { status: 500 });
  if (!pc || pc.player_id !== playerId) {
    return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });
  }
  if (!roomId) return NextResponse.json({ ok: false, error: "NO_ROOM" }, { status: 400 });

  const blockStartIso = new Date(pc.block_start).toISOString();
  const path = buildStoragePath(roomId, playerId, blockStartIso, pc.id, mime);

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path, { upsert: true });
  if (error) {
    return NextResponse.json(
      { ok: false, error: error.message, hint: `Crea el bucket '${BUCKET}' en Supabase Storage.` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    upload: {
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl
    }
  });
}
