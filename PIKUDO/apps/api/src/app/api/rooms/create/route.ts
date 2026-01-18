import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNickname } from "@/lib/validators";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

type CreateBody = { nickname?: unknown; roomName?: unknown; rounds?: unknown };
type CreateRoomRow = { room_id: string; code: string };
type RoomRow = { id: string; starts_at: string; ends_at: string; rounds: number };
type PlayerRow = { id: string; nickname: string; points: number };

function generateRoomCode(length = 6): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

function parseRounds(input: unknown): number | null {
  const n = typeof input === "number" ? input : typeof input === "string" ? Number(input) : NaN;
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i < 1 || i > 10) return null;
  return i;
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as CreateBody | null;
  const rounds = parseRounds(body?.rounds);
  if (!rounds) return NextResponse.json({ ok: false, error: "INVALID_ROUNDS" }, { status: 400 });
  const roomName = typeof body?.roomName === "string" ? body.roomName.trim() : "";

  const supabase = supabaseAdmin();
  let devicePlayerId = "";
  let deviceNickname = "";
  let deviceRoomId: string | null = null;

  try {
    const { player } = await requirePlayerFromDevice(req);
    devicePlayerId = player.id;
    deviceNickname = player.nickname;
    deviceRoomId = (player as any).room_id ?? null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }

  if (devicePlayerId && deviceRoomId) {
    return NextResponse.json({ ok: false, error: "ALREADY_IN_ROOM" }, { status: 409 });
  }

  let row: CreateRoomRow | null = null;

  const { data: created, error: createError } = (await supabase.rpc("create_room", {
    p_rounds: rounds
  })) as { data: CreateRoomRow[] | null; error: { message: string } | null };

  if (!createError) {
    row = created?.[0] ?? null;
  } else {
    const msg = createError.message || "RPC_FAILED";
    const isMissingCreateRoom = msg.toLowerCase().includes("could not find the function public.create_room");

    if (!isMissingCreateRoom) {
      return NextResponse.json({ ok: false, error: msg }, { status: 400 });
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const durationMs = rounds * 30 * 60 * 1000;
    const endsAtIso = new Date(now.getTime() + durationMs).toISOString();
    for (let attempt = 0; attempt < 12; attempt++) {
      const code = generateRoomCode(6);
      const { data: inserted, error: insertError } = await supabase
        .from("rooms")
        .insert({ code, rounds, status: "scheduled", starts_at: nowIso, ends_at: endsAtIso })
        .select("id,code")
        .single<{ id: string; code: string }>();

      if (inserted && !insertError) {
        row = { room_id: inserted.id, code: inserted.code };
        await supabase
          .from("room_settings")
          .upsert({ room_id: inserted.id, game_status: "running", game_started_at: null }, { onConflict: "room_id" });
        break;
      }

      const insertMsg = insertError?.message ?? "";
      const missingRoundsColumn =
        insertMsg.toLowerCase().includes("could not find the 'rounds' column") ||
        insertMsg.toLowerCase().includes("column rooms.rounds does not exist") ||
        insertMsg.toLowerCase().includes("rounds column");
      if (missingRoundsColumn) {
        return NextResponse.json(
          {
            ok: false,
            error: "MISSING_DB_MIGRATION_ROUNDS",
            hint: "Te falta la migracion: ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor) y reintenta."
          },
          { status: 500 }
        );
      }

      const pgCode = (insertError as any)?.code as string | undefined;
      if (pgCode === "23505") continue; // code collision, retry

      return NextResponse.json(
        {
          ok: false,
          error: insertError?.message ?? "CREATE_ROOM_FAILED",
          hint: "Si tienes la DB preparada, ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor)."
        },
        { status: 500 }
      );
    }
  }

  if (!row) {
    return NextResponse.json(
      {
        ok: false,
        error: "CREATE_ROOM_FAILED",
        hint: "Ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor)."
      },
      { status: 500 }
    );
  }

  const { data: room, error: roomError } = await supabase
    .from("rooms")
    .select("id,starts_at,ends_at,rounds")
    .eq("id", row.room_id)
    .maybeSingle<RoomRow>();
  if (
    roomError?.message?.toLowerCase().includes("could not find the 'rounds' column") ||
    roomError?.message?.toLowerCase().includes("column rooms.rounds does not exist")
  ) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_DB_MIGRATION_ROUNDS",
        hint: "Te falta la migracion: ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor) y reintenta."
      },
      { status: 500 }
    );
  }
  if (roomError || !room) return NextResponse.json({ ok: false, error: roomError?.message ?? "ROOM_NOT_FOUND" }, { status: 500 });

  if (roomName) {
    const { error: updateRoomNameError } = await supabase.from("rooms").update({ name: roomName }).eq("id", room.id);
    if (
      updateRoomNameError?.message?.toLowerCase().includes("could not find the 'name' column") ||
      updateRoomNameError?.message?.toLowerCase().includes("column rooms.name does not exist") ||
      updateRoomNameError?.message?.toLowerCase().includes('column "name" does not exist')
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_DB_MIGRATION_ROOM_NAME",
          hint: "Te falta la migracion: ejecuta `apps/web/scripts/sql/add_rooms_name.sql` en Supabase (SQL Editor) y reintenta."
        },
        { status: 500 }
      );
    }
  }

  const nick = validateNickname(body?.nickname);
  const nextNickname = nick.ok ? nick.nickname : deviceNickname;

  const { data: updated, error: updateError } = await supabase
    .from("players")
    .update({ room_id: room.id, points: 0, nickname: nextNickname })
    .eq("id", devicePlayerId)
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (updateError) {
    const code = (updateError as any).code as string | undefined;
    if (code === "23505") return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ ok: false, error: updateError.message }, { status: 500 });
  }

  await supabase.from("room_members").upsert({
    room_id: room.id,
    player_id: updated.id,
    role: "owner",
    left_at: null,
    points_at_leave: null,
    nickname_at_join: updated.nickname
  });
  await supabase.from("rooms").update({ created_by_player_id: updated.id }).eq("id", room.id);

  return NextResponse.json({
    ok: true,
    room: { id: room.id, code: row.code, rounds: room.rounds },
    player: updated
  });
}
