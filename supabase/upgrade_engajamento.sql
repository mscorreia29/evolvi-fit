-- Evolvi Fit - engajamento: configurações do personal, desafios, check-ins semanais e progresso de metas
-- Execute no SQL Editor do Supabase (idempotente).

-- configurações por personal
create table if not exists public.coach_settings (
  coach_id uuid primary key references public.profiles(id) on delete cascade,
  feedback_interval_days integer not null default 14 check (feedback_interval_days between 1 and 90),
  payment_reminder_days_before integer not null default 3 check (payment_reminder_days_before between 0 and 30),
  updated_at timestamptz not null default now()
);

alter table public.coach_settings enable row level security;

drop policy if exists coach_settings_select on public.coach_settings;
create policy coach_settings_select on public.coach_settings
for select to authenticated
using (
  coach_id = auth.uid()
  or coach_id in (select cs.coach_id from public.coach_students cs where cs.student_id = auth.uid())
);

drop policy if exists coach_settings_insert on public.coach_settings;
create policy coach_settings_insert on public.coach_settings
for insert to authenticated
with check (coach_id = auth.uid());

drop policy if exists coach_settings_update on public.coach_settings;
create policy coach_settings_update on public.coach_settings
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

grant select, insert, update on public.coach_settings to authenticated;

-- progresso em metas
alter table public.student_goals
  add column if not exists progress integer not null default 0;

-- desafios diários (conclusões)
create table if not exists public.daily_challenge_logs (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  challenge_date date not null,
  challenge_key text not null,
  completed boolean not null default true,
  created_at timestamptz not null default now(),
  unique (student_id, challenge_date, challenge_key)
);

create index if not exists daily_challenge_logs_student_idx on public.daily_challenge_logs(student_id, challenge_date desc);

alter table public.daily_challenge_logs enable row level security;

drop policy if exists daily_challenge_logs_select on public.daily_challenge_logs;
create policy daily_challenge_logs_select on public.daily_challenge_logs
for select to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists daily_challenge_logs_insert on public.daily_challenge_logs;
create policy daily_challenge_logs_insert on public.daily_challenge_logs
for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists daily_challenge_logs_update on public.daily_challenge_logs;
create policy daily_challenge_logs_update on public.daily_challenge_logs
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

grant select, insert, update on public.daily_challenge_logs to authenticated;

-- check-in semanal
create table if not exists public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  performance integer check (performance between 1 and 5),
  motivation integer check (motivation between 1 and 5),
  difficulty integer check (difficulty between 1 and 5),
  had_difficulties boolean,
  notes text,
  created_at timestamptz not null default now(),
  unique (student_id, week_start)
);

create index if not exists weekly_checkins_student_idx on public.weekly_checkins(student_id, week_start desc);

alter table public.weekly_checkins enable row level security;

drop policy if exists weekly_checkins_select on public.weekly_checkins;
create policy weekly_checkins_select on public.weekly_checkins
for select to authenticated
using (student_id = auth.uid() or public.is_coach_of(student_id));

drop policy if exists weekly_checkins_insert on public.weekly_checkins;
create policy weekly_checkins_insert on public.weekly_checkins
for insert to authenticated
with check (student_id = auth.uid());

drop policy if exists weekly_checkins_update on public.weekly_checkins;
create policy weekly_checkins_update on public.weekly_checkins
for update to authenticated
using (student_id = auth.uid())
with check (student_id = auth.uid());

grant select, insert, update on public.weekly_checkins to authenticated;
