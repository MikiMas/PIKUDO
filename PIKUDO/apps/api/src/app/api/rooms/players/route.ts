import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number; created_at?: string };

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.toUpperCase();
  if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

  const supabase = supabaseAdmin();
  const { data: room, error: roomError } = await supabase.from("rooms").select("id").eq("code", code).maybeSingle<{ id: string }>();
  if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
  if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("id,nickname,points,created_at")
    .eq("room_id", room.id)
    .order("created_at", { ascending: true })
    .returns<PlayerRow[]>();

  if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 });

  return NextResponse.json({ ok: true, players: players ?? [] });
}

