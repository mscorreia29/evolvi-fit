-- Evolvi Fit - vídeo em exercícios personalizados (workout_exercises)
-- Execute no SQL Editor do Supabase (idempotente).

alter table public.workout_exercises
  add column if not exists video_url text;
alter table public.workout_exercises
  add column if not exists instructions text;

grant select, insert, update, delete on public.workout_exercises to authenticated;
