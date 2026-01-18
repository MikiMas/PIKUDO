import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

export async function GET() {
  supabaseAdmin();
  return NextResponse.json({ ok: true });
}

