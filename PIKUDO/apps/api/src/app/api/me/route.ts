import { NextResponse } from "next/server";
import { requirePlayerFromDevice } from "@/lib/sessionPlayer";

export const runtime = "nodejs";

export async function GET(req: Request) {
  try {
    const { deviceId, player } = await requirePlayerFromDevice(req);
    return NextResponse.json({ player, deviceId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "UNAUTHORIZED";
    const status = msg === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}
