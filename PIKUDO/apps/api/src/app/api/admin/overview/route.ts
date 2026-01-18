import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBlockStartUTC, secondsToNextBlock } from "@/lib/timeBlock";

export const runtime = "nodejs";

type PlayerRow = { id: string; nickname: string; points: number; created_at?: string };
type PlayerChallengeRow = { id: string; player_id: string; challenge_id: string; completed: boolean };
type ChallengeRow = { id: string; title: string; description: string };
type AdminSettingsRow = { game_status: string | null };

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();
    const now = new Date();
    const blockStart = getBlockStartUTC(now);
    const nextBlockInSec = secondsToNextBlock(now);
    const blockStartIso = blockStart.toISOString();

    const [{ data: settings, error: settingsError }, { data: players, error: playersError }, { data: pcs, error: pcsError }] =
      await Promise.all([
        supabase.from("admin_settings").select("game_status").eq("id", true).maybeSingle<AdminSettingsRow>(),
        supabase.from("players").select("id,nickname,points,created_at").order("points", { ascending: false }).order("created_at", { ascending: true }).returns<PlayerRow[]>(),
        supabase
          .from("player_challenges")
          .select("id,player_id,challenge_id,completed")
          .eq("block_start", blockStartIso)
          .returns<PlayerChallengeRow[]>()
      ]);

    if (settingsError) return NextResponse.json({ ok: false, error: settingsError.message }, { status: 500 });
    if (playersError) return NextResponse.json({ ok: false, error: playersError.message }, { status: 500 });
    if (pcsError) return NextResponse.json({ ok: false, error: pcsError.message }, { status: 500 });

    const challengeIds = Array.from(new Set((pcs ?? []).map((r) => r.challenge_id)));
    const { data: challenges, error: challengesError } =
      challengeIds.length === 0
        ? { data: [] as ChallengeRow[], error: null as any }
        : await supabase.from("challenges").select("id,title,description").in("id", challengeIds).returns<ChallengeRow[]>();

    if (challengesError) return NextResponse.json({ ok: false, error: challengesError.message }, { status: 500 });

    const challengesById = new Map((challenges ?? []).map((c) => [c.id, c]));
    const pcsByPlayer = new Map<string, { id: string; title: string; description: string; completed: boolean }[]>();

    for (const pc of pcs ?? []) {
      const ch = challengesById.get(pc.challenge_id);
      if (!ch) continue;
      const list = pcsByPlayer.get(pc.player_id) ?? [];
      list.push({ id: pc.id, title: ch.title, description: ch.description, completed: pc.completed });
      pcsByPlayer.set(pc.player_id, list);
    }

    const overviewPlayers = (players ?? []).map((p) => ({
      id: p.id,
      nickname: p.nickname,
      points: p.points,
      challenges: pcsByPlayer.get(p.id) ?? []
    }));

    return NextResponse.json({
      ok: true,
      blockStart: blockStartIso,
      nextBlockInSec,
      gameStatus: settings?.game_status ?? "running",
      players: overviewPlayers
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
