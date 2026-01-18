import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { validateUuid } from "@/lib/validators";

export const runtime = "nodejs";

type RejectRow = { player_id: string | null; points: number; rejected_now: boolean };

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { playerChallengeId?: unknown } | null;
  const id = body?.playerChallengeId;
  if (!validateUuid(id)) {
    return NextResponse.json({ ok: false, error: "INVALID_PLAYER_CHALLENGE_ID" }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = (await supabase.rpc("reject_player_challenge", {
    p_player_challenge_id: id.trim()
  })) as { data: RejectRow[] | null; error: { message: string } | null };

  if (error) {
    const msg = error.message || "RPC_FAILED";
    if (msg.toLowerCase().includes("reject_player_challenge")) {
      return NextResponse.json(
        {
          ok: false,
          error: "MISSING_RPC_REJECT",
          hint: "Ejecuta scripts/sql/reject_player_challenge.sql en Supabase (SQL Editor)."
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }

  const row = data?.[0];
  if (!row) return NextResponse.json({ ok: false, error: "REJECT_FAILED" }, { status: 500 });

  return NextResponse.json({ ok: true, points: row.points, rejectedNow: row.rejected_now, playerId: row.player_id });
}

