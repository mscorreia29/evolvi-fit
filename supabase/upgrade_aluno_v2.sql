-- Evolvi Fit - painel aluno v2: hidratação, refeições, XP e atividade diária
-- Execute no SQL Editor do Supabase (idempotente).

-- 1) Hidratação diária
create table if not exists public.water_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  amount_ml integer not null default 0,
  goal_ml integer not null default 2500,
  updated_at timestamptz not null default now(),
  unique (student_id, log_date)
);

create index if not exists water_logs_student_idx on public.water_logs(student_id, log_date desc);

alter table public.water_logs enable row level security;

drop policy if exists water_logs_select on public.water_logs;
create policy water_logs_select on public.water_logs
for select to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists water_logs_insert on public.water_logs;
create policy water_logs_insert on public.water_logs
for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists water_logs_update on public.water_logs;
create policy water_logs_update on public.water_logs
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

grant select, insert, update on public.water_logs to authenticated;

-- 2) Refeições registradas
create table if not exists public.meal_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  meal_name text not null,
  calories integer,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists meal_logs_student_idx on public.meal_logs(student_id, log_date desc);

alter table public.meal_logs enable row level security;

drop policy if exists meal_logs_select on public.meal_logs;
create policy meal_logs_select on public.meal_logs
for select to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists meal_logs_insert on public.meal_logs;
create policy meal_logs_insert on public.meal_logs
for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists meal_logs_delete on public.meal_logs;
create policy meal_logs_delete on public.meal_logs
for delete to authenticated
using (student_id = auth.uid());

grant select, insert, delete on public.meal_logs to authenticated;

-- 3) XP do aluno (gamificação)
alter table public.profiles
  add column if not exists xp integer not null default 0;

-- 4) Meta de peso (já existe student_goals; adicionar target_value e current_value)
alter table public.student_goals
  add column if not exists target_value numeric;
alter table public.student_goals
  add column if not exists current_value numeric;
alter table public.student_goals
  add column if not exists unit text;

-- 5) Configuração de metas de água/refeições por personal (opcional, default no app)
-- (sem tabela extra; usa water_logs.goal_ml e contagem de refeições)
