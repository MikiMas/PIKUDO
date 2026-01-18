import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const { player } = await requirePlayerFromSession(req);

    const { data: room, error } = await supabase
      .from("rooms")
      .select("id,code,starts_at,ends_at,status")
      .eq("id", player.room_id)
      .maybeSingle();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });

    const { data: member } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", room.id)
      .eq("player_id", player.id)
      .maybeSingle<{ role: string }>();

    return NextResponse.json({ ok: true, room, role: member?.role ?? "member", player });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

