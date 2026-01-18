import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { readDeviceIdFromRequest } from "@/lib/validators";

export type AuthedPlayer = { id: string; nickname: string; points: number; room_id: string };

export async function requirePlayerFromDevice(req: Request): Promise<{ deviceId: string; player: AuthedPlayer }> {
  const deviceId = readDeviceIdFromRequest(req);
  if (!deviceId) throw new Error("UNAUTHORIZED");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("players")
    .select("id,nickname,points,room_id")
    .eq("device_id", deviceId)
    .maybeSingle<AuthedPlayer>();

  if (error) throw new Error(error.message);
  if (!data) throw new Error("UNAUTHORIZED");

  return { deviceId, player: data };
}

// Backwards-compatible alias for legacy callers.
export async function requirePlayerFromSession(req: Request): Promise<{ deviceId: string; player: AuthedPlayer }> {
  return requirePlayerFromDevice(req);
}
