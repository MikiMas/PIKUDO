import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readSessionTokenFromRequest, validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

const BUCKET = "retos";

type SessionRow = { player_id: string };
type PlayerChallengeRow = { id: string; player_id: string; block_start: string };

function extFromMime(mime: string): string {
  if (mime.startsWith("image/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".jpg";
  if (mime.startsWith("video/")) return mime.split("/")[1] ? `.${mime.split("/")[1]}` : ".mp4";
  return "";
}

export async function POST(req: Request) {
  const sessionToken = readSessionTokenFromRequest(req);
  if (!sessionToken) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

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

  const { data: session, error: sessionError } = await supabase
    .from("player_sessions")
    .select("player_id")
    .eq("session_token", sessionToken)
    .maybeSingle<SessionRow>();

  if (sessionError) return NextResponse.json({ ok: false, error: sessionError.message }, { status: 500 });
  if (!session) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const { data: pc, error: pcError } = await supabase
    .from("player_challenges")
    .select("id,player_id,block_start")
    .eq("id", playerChallengeId.trim())
    .maybeSingle<PlayerChallengeRow>();

  if (pcError) return NextResponse.json({ ok: false, error: pcError.message }, { status: 500 });
  if (!pc || pc.player_id !== session.player_id) {
    return NextResponse.json({ ok: false, error: "NOT_ALLOWED" }, { status: 403 });
  }

  const blockStartIso = new Date(pc.block_start).toISOString();
  const path = `${session.player_id}/${blockStartIso}/${pc.id}${extFromMime(mime)}`;

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

