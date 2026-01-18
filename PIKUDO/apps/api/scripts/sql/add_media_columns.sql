-- Añadir campos de media (foto / vídeo)
alter table public.player_challenges
add column if not exists media_url text,
add column if not exists media_type text check (media_type in ('image','video')),
add column if not exists media_mime text,
add column if not exists media_uploaded_at timestamptz;

-- Asegurar que un reto completado tenga media asociada
alter table public.player_challenges
drop constraint if exists completed_requires_media;

alter table public.player_challenges
add constraint completed_requires_media
check (
  completed = false
  or (media_url is not null and media_type is not null)
);

