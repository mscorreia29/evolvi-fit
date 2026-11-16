-- Evolvi Fit - ficha do aluno (avaliações físicas, metas e notas do personal)
-- Execute no SQL Editor do Supabase (idempotente, pode rodar mais de uma vez).

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

create index if not exists assessments_student_idx on public.physical_assessments(student_id);

alter table public.physical_assessments enable row level security;

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

grant select, insert, update, delete on public.physical_assessments to authenticated;

create table if not exists public.student_goals (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  target_date date,
  status text not null default 'active' check (status in ('active', 'done', 'cancelled')),
  created_at timestamptz not null default now()
);

create index if not exists student_goals_student_idx on public.student_goals(student_id);

alter table public.student_goals enable row level security;

drop policy if exists student_goals_select on public.student_goals;
create policy student_goals_select on public.student_goals
for select to authenticated
using (public.is_coach_of(student_id) or student_id = auth.uid());

drop policy if exists student_goals_insert on public.student_goals;
create policy student_goals_insert on public.student_goals
for insert to authenticated
with check (coach_id = auth.uid() and public.is_coach_of(student_id));

drop policy if exists student_goals_update on public.student_goals;
create policy student_goals_update on public.student_goals
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists student_goals_delete on public.student_goals;
create policy student_goals_delete on public.student_goals
for delete to authenticated
using (coach_id = auth.uid());

grant select, insert, update, delete on public.student_goals to authenticated;

create table if not exists public.coach_notes (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists coach_notes_student_idx on public.coach_notes(student_id);

alter table public.coach_notes enable row level security;

drop policy if exists coach_notes_select on public.coach_notes;
create policy coach_notes_select on public.coach_notes
for select to authenticated
using (coach_id = auth.uid());

drop policy if exists coach_notes_insert on public.coach_notes;
create policy coach_notes_insert on public.coach_notes
for insert to authenticated
with check (coach_id = auth.uid() and public.is_coach_of(student_id));

drop policy if exists coach_notes_update on public.coach_notes;
create policy coach_notes_update on public.coach_notes
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists coach_notes_delete on public.coach_notes;
create policy coach_notes_delete on public.coach_notes
for delete to authenticated
using (coach_id = auth.uid());

grant select, insert, update, delete on public.coach_notes to authenticated;
