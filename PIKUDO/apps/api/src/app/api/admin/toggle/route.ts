import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type AdminSettingsRow = { game_status: string | null };

export async function POST(req: Request) {
  return NextResponse.json({ ok: false, error: "PAUSE_DISABLED" }, { status: 400 });
}
