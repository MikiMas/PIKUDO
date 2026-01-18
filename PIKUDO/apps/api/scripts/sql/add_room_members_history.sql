-- Add history fields to keep players in final results after leaving a room.
alter table public.room_members
add column if not exists left_at timestamptz,
add column if not exists points_at_leave integer,
add column if not exists nickname_at_join text;
