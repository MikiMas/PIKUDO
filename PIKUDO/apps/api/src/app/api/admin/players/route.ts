import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number; created_at: string };

export async function GET() {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("players")
    .select("id,nickname,points,created_at")
    .order("points", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(500)
    .returns<PlayerRow[]>();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, players: data ?? [] });
}

