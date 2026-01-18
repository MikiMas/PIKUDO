import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { signAdminToken } from "@/lib/adminSession";

export const runtime = "nodejs";

type AdminSettingsRow = { id: boolean; admin_password_hash: string | null };

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as { password?: unknown } | null;
    const password = typeof body?.password === "string" ? body.password : "";
    if (!password) return NextResponse.json({ ok: false, error: "MISSING_PASSWORD" }, { status: 400 });

    const supabase = supabaseAdmin();
    const { data, error } = await supabase
      .from("admin_settings")
      .select("id,admin_password_hash")
      .eq("id", true)
      .maybeSingle<AdminSettingsRow>();

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    if (!data?.admin_password_hash) {
      return NextResponse.json({ ok: false, error: "ADMIN_NOT_CONFIGURED" }, { status: 500 });
    }

    const ok = await bcrypt.compare(password, data.admin_password_hash);
    if (!ok) return NextResponse.json({ ok: false, error: "INVALID_PASSWORD" }, { status: 401 });

    const token = signAdminToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set({
      name: "adm",
      value: token,
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
      secure: process.env.NODE_ENV === "production"
    });
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

