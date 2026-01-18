import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { seedChallenges } from "@/lib/seedChallenges";

async function main() {
  const supabase = supabaseAdmin();
  const result = await seedChallenges(supabase);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify({ ok: true, ...result }));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exitCode = 1;
});

