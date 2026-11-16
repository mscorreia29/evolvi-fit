-- Evolvi Fit v2 - registros por exercício na sessão de treino.
-- Execute no SQL Editor do Supabase depois do schema.sql.

create table if not exists public.session_exercises (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises(id) on delete set null,
  name text not null,
  sets_done int,
  reps_done text,
  weight_kg numeric,
  completed boolean not null default false,
  order_index int not null default 0
);

create index if not exists session_exercises_session_idx on public.session_exercises(session_id);

create or replace function public.owns_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workout_sessions
    where id = p_session and student_id = auth.uid()
  );
$$;

create or replace function public.coach_of_session(p_session uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_sessions s
    where s.id = p_session and public.is_coach_of(s.student_id)
  );
$$;

alter table public.session_exercises enable row level security;

drop policy if exists session_exercises_select on public.session_exercises;
create policy session_exercises_select on public.session_exercises
for select to authenticated
using (public.owns_session(session_id) or public.coach_of_session(session_id));

drop policy if exists session_exercises_insert on public.session_exercises;
create policy session_exercises_insert on public.session_exercises
for insert to authenticated
with check (public.owns_session(session_id));

drop policy if exists session_exercises_update on public.session_exercises;
create policy session_exercises_update on public.session_exercises
for update to authenticated
using (public.owns_session(session_id))
with check (public.owns_session(session_id));

drop policy if exists session_exercises_delete on public.session_exercises;
create policy session_exercises_delete on public.session_exercises
for delete to authenticated
using (public.owns_session(session_id) or public.coach_of_session(session_id));

grant select, insert, update, delete on public.session_exercises to authenticated;
