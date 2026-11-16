-- Evolvi Fit - schema inicial para Supabase (PostgreSQL)
-- Execute este arquivo no SQL Editor do seu projeto Supabase.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'aluno' check (role in ('personal', 'aluno')),
  full_name text,
  email text,
  phone text,
  created_at timestamptz not null default now()
);

create table if not exists public.coach_students (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (coach_id, student_id),
  constraint coach_students_not_self check (coach_id <> student_id)
);

create table if not exists public.exercises (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  muscle_group text,
  equipment text,
  video_url text,
  instructions text,
  created_at timestamptz not null default now()
);

create table if not exists public.workouts (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('draft', 'active', 'archived')),
  created_at timestamptz not null default now()
);

create table if not exists public.workout_days (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  label text not null default 'A',
  order_index int not null default 0
);

create table if not exists public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_day_id uuid not null references public.workout_days(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  name text not null,
  sets int,
  reps text,
  rest_seconds int,
  notes text,
  order_index int not null default 0
);

create table if not exists public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  performed_at timestamptz not null default now(),
  duration_seconds int,
  notes text,
  completed boolean not null default true
);

create table if not exists public.anamnesis (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.physical_assessments (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  weight_kg numeric,
  height_cm numeric,
  body_fat_pct numeric,
  measurements jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists coach_students_student_idx on public.coach_students(student_id);
create index if not exists workouts_coach_idx on public.workouts(coach_id);
create index if not exists workouts_student_idx on public.workouts(student_id);
create index if not exists workout_days_workout_idx on public.workout_days(workout_id);
create index if not exists workout_exercises_day_idx on public.workout_exercises(workout_day_id);
create index if not exists workout_sessions_student_idx on public.workout_sessions(student_id);
create index if not exists anamnesis_student_idx on public.anamnesis(student_id);
create index if not exists assessments_student_idx on public.physical_assessments(student_id);

create or replace function public.is_coach_of(p_student uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_students
    where coach_id = auth.uid() and student_id = p_student
  );
$$;

create or replace function public.is_student_of(p_coach uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.coach_students
    where student_id = auth.uid() and coach_id = p_coach
  );
$$;

create or replace function public.owns_workout(p_workout uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workouts
    where id = p_workout and coach_id = auth.uid()
  );
$$;

create or replace function public.student_in_workout(p_workout uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.workouts
    where id = p_workout and student_id = auth.uid()
  );
$$;

create or replace function public.owns_workout_day(p_day uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_days d
    join public.workouts w on w.id = d.workout_id
    where d.id = p_day and w.coach_id = auth.uid()
  );
$$;

create or replace function public.student_in_workout_day(p_day uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.workout_days d
    join public.workouts w on w.id = d.workout_id
    where d.id = p_day and w.student_id = auth.uid()
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  if v_role not in ('personal', 'aluno') then
    v_role := 'aluno';
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.coach_students enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_days enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.workout_sessions enable row level security;
alter table public.anamnesis enable row level security;
alter table public.physical_assessments enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (id = auth.uid() or public.is_coach_of(id) or public.is_student_of(id));

drop policy if exists profiles_insert on public.profiles;
create policy profiles_insert on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists coach_students_select on public.coach_students;
create policy coach_students_select on public.coach_students
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists coach_students_insert on public.coach_students;
create policy coach_students_insert on public.coach_students
for insert to authenticated
with check (coach_id = auth.uid());

drop policy if exists coach_students_delete on public.coach_students;
create policy coach_students_delete on public.coach_students
for delete to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises
for select to authenticated
using (owner_id is null or owner_id = auth.uid());

drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises
for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises
for update to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises
for delete to authenticated
using (owner_id = auth.uid());

drop policy if exists workouts_select on public.workouts;
create policy workouts_select on public.workouts
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists workouts_insert on public.workouts;
create policy workouts_insert on public.workouts
for insert to authenticated
with check (coach_id = auth.uid());

drop policy if exists workouts_update on public.workouts;
create policy workouts_update on public.workouts
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists workouts_delete on public.workouts;
create policy workouts_delete on public.workouts
for delete to authenticated
using (coach_id = auth.uid());

drop policy if exists workout_days_select on public.workout_days;
create policy workout_days_select on public.workout_days
for select to authenticated
using (public.owns_workout(workout_id) or public.student_in_workout(workout_id));

drop policy if exists workout_days_insert on public.workout_days;
create policy workout_days_insert on public.workout_days
for insert to authenticated
with check (public.owns_workout(workout_id));

drop policy if exists workout_days_update on public.workout_days;
create policy workout_days_update on public.workout_days
for update to authenticated
using (public.owns_workout(workout_id))
with check (public.owns_workout(workout_id));

drop policy if exists workout_days_delete on public.workout_days;
create policy workout_days_delete on public.workout_days
for delete to authenticated
using (public.owns_workout(workout_id));

drop policy if exists workout_exercises_select on public.workout_exercises;
create policy workout_exercises_select on public.workout_exercises
for select to authenticated
using (
  public.owns_workout_day(workout_day_id) or public.student_in_workout_day(workout_day_id)
);

drop policy if exists workout_exercises_insert on public.workout_exercises;
create policy workout_exercises_insert on public.workout_exercises
for insert to authenticated
with check (public.owns_workout_day(workout_day_id));

drop policy if exists workout_exercises_update on public.workout_exercises;
create policy workout_exercises_update on public.workout_exercises
for update to authenticated
using (public.owns_workout_day(workout_day_id))
with check (public.owns_workout_day(workout_day_id));

drop policy if exists workout_exercises_delete on public.workout_exercises;
create policy workout_exercises_delete on public.workout_exercises
for delete to authenticated
using (public.owns_workout_day(workout_day_id));

drop policy if exists workout_sessions_select on public.workout_sessions;
create policy workout_sessions_select on public.workout_sessions
for select to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists workout_sessions_insert on public.workout_sessions;
create policy workout_sessions_insert on public.workout_sessions
for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists workout_sessions_delete on public.workout_sessions;
create policy workout_sessions_delete on public.workout_sessions
for delete to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists anamnesis_select on public.anamnesis;
create policy anamnesis_select on public.anamnesis
for select to authenticated
using (public.is_coach_of(student_id) or student_id = auth.uid());

drop policy if exists anamnesis_insert on public.anamnesis;
create policy anamnesis_insert on public.anamnesis
for insert to authenticated
with check (public.is_coach_of(student_id) or student_id = auth.uid());

drop policy if exists anamnesis_update on public.anamnesis;
create policy anamnesis_update on public.anamnesis
for update to authenticated
using (public.is_coach_of(student_id))
with check (public.is_coach_of(student_id));

drop policy if exists anamnesis_delete on public.anamnesis;
create policy anamnesis_delete on public.anamnesis
for delete to authenticated
using (public.is_coach_of(student_id));

drop policy if exists assessments_select on public.physical_assessments;
create policy assessments_select on public.physical_assessments
for select to authenticated
using (public.is_coach_of(student_id) or student_id = auth.uid());

drop policy if exists assessments_insert on public.physical_assessments;
create policy assessments_insert on public.physical_assessments
for insert to authenticated
with check (public.is_coach_of(student_id) or student_id = auth.uid());

drop policy if exists assessments_update on public.physical_assessments;
create policy assessments_update on public.physical_assessments
for update to authenticated
using (public.is_coach_of(student_id))
with check (public.is_coach_of(student_id));

drop policy if exists assessments_delete on public.physical_assessments;
create policy assessments_delete on public.physical_assessments
for delete to authenticated
using (public.is_coach_of(student_id));

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.coach_students to authenticated;
grant select, insert, update, delete on public.exercises to authenticated;
grant select, insert, update, delete on public.workouts to authenticated;
grant select, insert, update, delete on public.workout_days to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.workout_sessions to authenticated;
grant select, insert, update, delete on public.anamnesis to authenticated;
grant select, insert, update, delete on public.physical_assessments to authenticated;

do $$
begin
  if not exists (select 1 from public.exercises where owner_id is null) then
    insert into public.exercises (owner_id, name, muscle_group, equipment, instructions) values
      (null, 'Agachamento livre', 'Pernas', 'Peso corporal', 'Mantenha o tronco ereto e desça ate a coxa ficar paralela ao chao.'),
      (null, 'Flexao de braco', 'Peito', 'Peso corporal', 'Corpo alinhado, desca o peito ate proximo do chao e suba.'),
      (null, 'Remada curvada', 'Costas', 'Halteres', 'Tronco inclinado, puxe os halteres em direcao ao abdomen.'),
      (null, 'Desenvolvimento militar', 'Ombros', 'Halteres', 'Empurre os halteres acima da cabeca sem arquear a lombar.'),
      (null, 'Rosca direta', 'Biceps', 'Halteres', 'Cotovelos fixos ao lado do corpo, flexione os bracos.'),
      (null, 'Triceps testa', 'Triceps', 'Halteres', 'Deitado, flexione apenas os cotovelos levando o peso a testa.'),
      (null, 'Prancha abdominal', 'Core', 'Peso corporal', 'Apoie antebracos e pontas dos pes, mantendo o corpo alinhado.'),
      (null, 'Afundo', 'Pernas', 'Peso corporal', 'De um passo a frente e desca o joelho de tras proximo ao chao.');
  end if;
end;
$$;
