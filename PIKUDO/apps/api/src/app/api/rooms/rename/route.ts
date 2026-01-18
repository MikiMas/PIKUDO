import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { requirePlayerFromSession } from "@/lib/sessionPlayer";
import { validateRoomCode } from "@/lib/validators";

export const runtime = "nodejs";

type Body = { code?: unknown; name?: unknown };

function normalizeRoomName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input.trim().replace(/\s+/g, " ");
  if (!name) return null;
  if (name.length > 40) return null;
  return name;
}

function isMissingRoomNameColumn(message: string | undefined | null): boolean {
  const m = (message ?? "").toLowerCase();
  return (
    m.includes("could not find the 'name' column") ||
    m.includes('column rooms.name does not exist') ||
    m.includes('column "name" does not exist')
  );
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Body | null;
    const code = typeof body?.code === "string" ? body.code.toUpperCase().trim() : "";
    if (!validateRoomCode(code)) return NextResponse.json({ ok: false, error: "INVALID_ROOM_CODE" }, { status: 400 });

    const name = normalizeRoomName(body?.name);
    if (!name) return NextResponse.json({ ok: false, error: "INVALID_ROOM_NAME" }, { status: 400 });

    const supabase = supabaseAdmin();
    const { player } = await requirePlayerFromSession(req);

    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("id,code")
      .eq("id", player.room_id)
      .maybeSingle<{ id: string; code: string }>();
    if (roomError) return NextResponse.json({ ok: false, error: roomError.message }, { status: 500 });
    if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    if ((room.code ?? "").toUpperCase() !== code) return NextResponse.json({ ok: false, error: "ROOM_MISMATCH" }, { status: 403 });

    const { data: member, error: memberError } = await supabase
      .from("room_members")
      .select("role")
      .eq("room_id", room.id)
      .eq("player_id", player.id)
      .maybeSingle<{ role: string }>();
    if (memberError) return NextResponse.json({ ok: false, error: memberError.message }, { status: 500 });
    if (member?.role !== "owner") return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });

    const { error: updateError } = await supabase.from("rooms").update({ name }).eq("id", room.id);
    if (updateError) {
      if (isMissingRoomNameColumn(updateError.message)) {
        return NextResponse.json(
          {
            ok: false,
            error: "MISSING_DB_MIGRATION_ROOM_NAME",
            hint: "Te falta la migración: ejecuta `apps/web/scripts/sql/add_rooms_name.sql` en Supabase (SQL Editor) y reintenta."
          },
          { status: 500 }
        );
      }
      return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, room: { code, name } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
