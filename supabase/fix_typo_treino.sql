-- Corrige nomes salvos como "onibus" (erro de corretor) para "ombro".
-- Pode rodar mais de uma vez. Execute no SQL Editor do Supabase.

update public.workouts
set name = regexp_replace(name, 'ônibus|onibus', 'ombro', 'gi')
where name ~* 'ônibus|onibus';

update public.workout_exercises
set name = regexp_replace(name, 'ônibus|onibus', 'ombro', 'gi')
where name ~* 'ônibus|onibus';
