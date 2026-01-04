import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateNickname } from "@/lib/validators";

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
  const nick = validateNickname(body?.nickname);
  if (!nick.ok) return NextResponse.json({ ok: false, error: nick.error }, { status: 400 });

  const rounds = parseRounds(body?.rounds);
  if (!rounds) return NextResponse.json({ ok: false, error: "INVALID_ROUNDS" }, { status: 400 });
  const roomName = typeof body?.roomName === "string" ? body.roomName.trim() : "";

  const supabase = supabaseAdmin();

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
            hint: "Te falta la migración: ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor) y reintenta."
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
        hint: "Te falta la migración: ejecuta scripts/sql/rooms_rounds.sql en Supabase (SQL Editor) y reintenta."
      },
      { status: 500 }
    );
  }
  if (roomError || !room) return NextResponse.json({ ok: false, error: roomError?.message ?? "ROOM_NOT_FOUND" }, { status: 500 });

  if (roomName) {
    await supabase.from("rooms").update({ name: roomName }).eq("id", room.id);
  }

  const { data: player, error: playerError } = await supabase
    .from("players")
    .insert({ room_id: room.id, nickname: nick.nickname, points: 0 })
    .select("id,nickname,points")
    .single<PlayerRow>();

  if (playerError) {
    const code = (playerError as any).code as string | undefined;
    if (code === "23505") return NextResponse.json({ ok: false, error: "NICKNAME_TAKEN" }, { status: 409 });
    return NextResponse.json({ ok: false, error: playerError.message }, { status: 500 });
  }

  await supabase.from("room_members").insert({ room_id: room.id, player_id: player.id, role: "owner" });
  await supabase.from("rooms").update({ created_by_player_id: player.id }).eq("id", room.id);

  const sessionToken = crypto.randomUUID();
  const now = new Date().toISOString();
  await supabase.from("player_sessions").insert({
    player_id: player.id,
    session_token: sessionToken,
    created_at: now,
    last_seen_at: now
  });

  const res = NextResponse.json({
    ok: true,
    room: { id: room.id, code: row.code, rounds: room.rounds },
    sessionToken,
    player
  });
  res.cookies.set({
    name: "st",
    value: sessionToken,
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production"
  });
  return res;
}
