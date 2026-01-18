import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.toUpperCase();
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: room, error: roomError } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle<{ id: string }>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

  const { data: ownerMember, error: ownerError } = await supabase
    .from("room_members")
    .select("player_id")
    .eq("room_id", room.id)
    .eq("role", "owner")
    .maybeSingle<{ player_id: string }>();

  if (ownerError) return NextResponse.json({ ok: false, error: ownerError.message }, { status: 500 });
  if (!ownerMember) return NextResponse.json({ ok: false, error: "OWNER_NOT_FOUND" }, { status: 404 });

  const { data: owner, error: playerError } = await supabase.from("players").select("id,nickname").eq("id", ownerMember.player_id).maybeSingle<{
    id: string;
    nickname: string;
  }>();
  if (playerError) return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  if (!owner) return NextResponse.json({ ok: false, error: "OWNER_NOT_FOUND" }, { status: 404 });

  return NextResponse.json({ ok: true, owner });
}

