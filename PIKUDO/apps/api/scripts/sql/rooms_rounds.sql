-- Cambia el modelo de horario a rondas (hasta 9). Cada ronda dura 30 minutos.
-- La partida empieza cuando el host pulsa "Empezar" (room_settings.game_started_at).

alter table public.rooms
  add column if not exists rounds int;

-- (Opcional) si la tabla ya tenía starts_at/ends_at NOT NULL, no lo tocamos aquí.
-- La lógica de juego usa room_settings.game_started_at como inicio real.

-- Compat: `ADD CONSTRAINT IF NOT EXISTS` no existe en Postgres.
-- Si ya existe la constraint, ignora el error.
do $$
begin
  begin
    alter table public.rooms
      add constraint rooms_rounds_check check (rounds between 1 and 9);
  exception
    when duplicate_object then
      null;
  end;
end
$$;

create or replace function public.create_room(
  p_rounds int
)
returns table (
  room_id uuid,
  code text
)
language plpgsql
as $$
declare
  rid uuid;
  c text;
begin
  if p_rounds is null or p_rounds < 1 or p_rounds > 9 then
    raise exception 'rounds must be between 1 and 9';
  end if;

  loop
    c := public.generate_room_code(6);
    exit when not exists (select 1 from public.rooms r where r.code = c);
  end loop;

  insert into public.rooms (code, rounds, status, starts_at, ends_at)
  values (c, p_rounds, 'scheduled', now(), now() + (p_rounds * interval '30 minutes'))
  returning id into rid;

  -- Evita ambigüedad con el nombre de la columna de salida `room_id` (RETURNS TABLE).
  -- Si ya existe settings para la sala, actualiza el estado.
  begin
    insert into public.room_settings (room_id, game_status, game_started_at)
    values (rid, 'running', null);
  exception
    when unique_violation then
      update public.room_settings
        set game_status = 'running'
      where public.room_settings.room_id = rid;
  end;

  return query select rid, c;
end;
$$;
