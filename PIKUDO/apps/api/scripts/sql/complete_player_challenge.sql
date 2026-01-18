-- Run this in Supabase SQL editor to create the RPC used by /api/complete.
-- It completes a player_challenge for the current block and increments player points atomically.

create or replace function public.complete_player_challenge(
  p_player_id uuid,
  p_player_challenge_id uuid,
  p_block_start timestamptz
)
returns table (
  points int,
  completed_now boolean
)
language plpgsql
as $$
declare
  did_complete boolean := false;
  new_points int;
begin
  lock table public.player_challenges in share row exclusive mode;
  lock table public.players in share row exclusive mode;

  update public.player_challenges pc
  set completed = true,
      completed_at = now()
  where pc.id = p_player_challenge_id
    and pc.player_id = p_player_id
    and pc.block_start = p_block_start
    and pc.completed = false;
    and pc.media_url is not null;

  did_complete := found;

  if did_complete then
    update public.players p
    set points = p.points + 1
    where p.id = p_player_id
    returning p.points into new_points;
  else
    select p.points into new_points
    from public.players p
    where p.id = p_player_id;
  end if;

  return query select new_points, did_complete;
end;
$$;
