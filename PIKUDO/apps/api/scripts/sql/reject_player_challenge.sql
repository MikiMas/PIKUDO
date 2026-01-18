-- Run this in Supabase SQL editor to create the RPC used by /api/admin/reject.
-- It reverts a completed player_challenge and decrements player points atomically.

create or replace function public.reject_player_challenge(
  p_player_challenge_id uuid
)
returns table (
  player_id uuid,
  points int,
  rejected_now boolean
)
language plpgsql
as $$
declare
  pid uuid;
  did_reject boolean := false;
  new_points int;
begin
  lock table public.player_challenges in share row exclusive mode;
  lock table public.players in share row exclusive mode;

  select pc.player_id into pid
  from public.player_challenges pc
  where pc.id = p_player_challenge_id;

  if pid is null then
    return query select null::uuid, 0::int, false;
    return;
  end if;

  update public.player_challenges pc
  set completed = false,
      completed_at = null
  where pc.id = p_player_challenge_id
    and pc.completed = true;

  did_reject := found;

  if did_reject then
    update public.players p
    set points = greatest(0, p.points - 1)
    where p.id = pid
    returning p.points into new_points;
  else
    select p.points into new_points from public.players p where p.id = pid;
  end if;

  return query select pid, new_points, did_reject;
end;
$$;

