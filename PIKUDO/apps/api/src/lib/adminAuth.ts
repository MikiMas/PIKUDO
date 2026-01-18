import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type AdminSettingsRow = {
  id: boolean;
  admin_password_hash: string | null;
};

export async function requireAdminPassword(password: string) {
  if (!password) throw new Error("Missing admin password");

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from("admin_settings")
    .select("id,admin_password_hash")
    .eq("id", true)
    .maybeSingle<AdminSettingsRow>();

  if (error) throw new Error(`admin_settings read failed: ${error.message}`);
  if (!data?.admin_password_hash) throw new Error("Admin password hash not configured");

  const ok = await bcrypt.compare(password, data.admin_password_hash);
  if (!ok) throw new Error("Invalid admin password");
}

