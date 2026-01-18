import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readDeviceIdFromRequest, validateNickname } from "@/lib/validators";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number };
type JoinBody = { nickname?: unknown; deviceId?: unknown };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as JoinBody | null;
  const nick = validateNickname(body?.nickname);
  if (!nick.ok) {
    return NextResponse.json({ ok: false, error: nick.error }, { status: 400 });
  }

  const deviceIdHeader = readDeviceIdFromRequest(req);
  const deviceIdBody = typeof body?.deviceId === "string" ? body.deviceId.trim() : "";
  const deviceId = (deviceIdHeader || deviceIdBody).trim();
  if (!deviceId) return NextResponse.json({ ok: false, error: "MISSING_DEVICE_ID" }, { status: 400 });

  const supabase = supabaseAdmin();

  const { data: existing } = await supabase
    .from("players")
    .select("id,nickname,points")
    .eq("device_id", deviceId)
    .maybeSingle<PlayerRow>();

  if (existing?.id) {
    const { data: player, error: playerError } = await supabase
      .from("players")
      .update({ nickname: nick.nickname })
      .eq("id", existing.id)
      .select("id,nickname,points")
      .single<PlayerRow>();

    if (playerError) {
      const code = (playerError as any).code as string | undefined;
      if (code === "23505") return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
      return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, player });
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ nickname: nick.nickname, points: 0, device_id: deviceId })
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (playerError) {
    const code = (playerError as any).code as string | undefined;
    if (code === "23505") {
      return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    }
    return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, player });
}

