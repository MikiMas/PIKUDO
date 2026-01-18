-- Run this in Supabase SQL editor to create the RPC used by /api/challenges.
-- It assigns up to 3 active challenges per player per 30-min block, avoiding repeats ever.

create or replace function public.assign_challenges_for_block(
  p_player_id uuid,
  p_block_start timestamptz
)
returns table (
  player_challenge_id uuid,
  title text,
  description text,
  completed boolean
)
language plpgsql
as $$
declare
  need_count int;
begin
  -- transactional: the entire function runs in a single transaction
  lock table public.player_challenges in share row exclusive mode;

  select greatest(0, 3 - count(*))::int
    into need_count
  from public.player_challenges pc
  where pc.player_id = p_player_id
    and pc.block_start = p_block_start;

  if need_count > 0 then
    insert into public.player_challenges (player_id, challenge_id, block_start, assigned_at, completed)
    select
      p_player_id,
      c.id,
      p_block_start,
      now(),
      false
    from public.challenges c
    where c.is_active = true
      and not exists (
        select 1
        from public.player_challenges pc2
        where pc2.player_id = p_player_id
          and pc2.challenge_id = c.id
      )
      and not exists (
        select 1
        from public.player_challenges pc3
        where pc3.player_id = p_player_id
          and pc3.challenge_id = c.id
          and pc3.block_start = p_block_start
      )
    order by random()
    limit need_count
    on conflict (player_id, challenge_id) do nothing;
  end if;

  return query
  select
    pc.id as player_challenge_id,
    c.title,
    c.description,
    pc.completed
  from public.player_challenges pc
  join public.challenges c on c.id = pc.challenge_id
  where pc.player_id = p_player_id
    and pc.block_start = p_block_start
  order by pc.assigned_at asc
  limit 3;
end;
$$;

