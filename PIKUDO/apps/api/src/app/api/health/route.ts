import { NextResponse } from "next/server";
import { getBlockStartUTC, secondsToNextBlock } from "@/lib/timeBlock";

export const runtime = "nodejs";

export async function GET() {
  const now = new Date();
  const blockStart = getBlockStartUTC(now);
  const seconds = secondsToNextBlock(now);

  return NextResponse.json({
    ok: true,
    now_utc: now.toISOString(),
    block_start_utc: blockStart.toISOString(),
    seconds_to_next_block: seconds
  });
}

