

-- ============================================================
-- ARQUIVO: supabase/upgrade_ficha.sql
-- ============================================================

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



-- ============================================================
-- ARQUIVO: supabase/upgrade_comunicacao.sql
-- ============================================================

﻿-- Evolvi Fit - comunicação: feedback, mensagens e mensalidades
-- Execute no SQL Editor do Supabase (idempotente). Requer schema base (profiles, is_coach_of).

create table if not exists public.student_feedback (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  category text not null default 'geral',
  message text not null,
  status text not null default 'open' check (status in ('open', 'read', 'resolved')),
  coach_reply text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists student_feedback_coach_idx on public.student_feedback(coach_id, created_at desc);
create index if not exists student_feedback_student_idx on public.student_feedback(student_id, created_at desc);

alter table public.student_feedback enable row level security;

drop policy if exists student_feedback_select on public.student_feedback;
create policy student_feedback_select on public.student_feedback
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists student_feedback_insert on public.student_feedback;
create policy student_feedback_insert on public.student_feedback
for insert to authenticated
with check (student_id = auth.uid() and public.is_student_of(coach_id));

drop policy if exists student_feedback_update_coach on public.student_feedback;
create policy student_feedback_update_coach on public.student_feedback
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

grant select, insert, update on public.student_feedback to authenticated;

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists messages_thread_idx on public.messages(coach_id, student_id, created_at desc);
create index if not exists messages_unread_coach_idx on public.messages(coach_id, read_at) where read_at is null;

alter table public.messages enable row level security;

drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    (student_id = auth.uid() and public.is_student_of(coach_id))
    or (coach_id = auth.uid() and public.is_coach_of(student_id))
  )
);

drop policy if exists messages_update on public.messages;
create policy messages_update on public.messages
for update to authenticated
using (coach_id = auth.uid() or student_id = auth.uid())
with check (coach_id = auth.uid() or student_id = auth.uid());

grant select, insert, update on public.messages to authenticated;

create table if not exists public.payment_dues (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  description text not null default 'Mensalidade',
  amount numeric,
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'late', 'cancelled')),
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists payment_dues_coach_idx on public.payment_dues(coach_id, due_date desc);
create index if not exists payment_dues_student_idx on public.payment_dues(student_id, due_date desc);

alter table public.payment_dues enable row level security;

drop policy if exists payment_dues_select on public.payment_dues;
create policy payment_dues_select on public.payment_dues
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists payment_dues_insert on public.payment_dues;
create policy payment_dues_insert on public.payment_dues
for insert to authenticated
with check (coach_id = auth.uid() and public.is_coach_of(student_id));

drop policy if exists payment_dues_update on public.payment_dues;
create policy payment_dues_update on public.payment_dues
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid());

drop policy if exists payment_dues_delete on public.payment_dues;
create policy payment_dues_delete on public.payment_dues
for delete to authenticated
using (coach_id = auth.uid());

grant select, insert, update, delete on public.payment_dues to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_engajamento.sql
-- ============================================================

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



-- ============================================================
-- ARQUIVO: supabase/upgrade_alimentacao_notificacoes.sql
-- ============================================================

-- Evolvi Fit - alimentação e central de notificações
-- Execute no SQL Editor do Supabase (idempotente). Requer schema base e upgrade_comunicacao.sql.

-- =========================================================
-- ALIMENTAÇÃO
-- =========================================================

create table if not exists public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'Plano alimentar',
  notes text,
  meals jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (coach_id, student_id)
);

create index if not exists meal_plans_student_idx on public.meal_plans(student_id);

alter table public.meal_plans enable row level security;

drop policy if exists meal_plans_select on public.meal_plans;
create policy meal_plans_select on public.meal_plans
for select to authenticated
using (coach_id = auth.uid() or student_id = auth.uid());

drop policy if exists meal_plans_insert on public.meal_plans;
create policy meal_plans_insert on public.meal_plans
for insert to authenticated
with check (coach_id = auth.uid() and public.is_coach_of(student_id));

drop policy if exists meal_plans_update on public.meal_plans;
create policy meal_plans_update on public.meal_plans
for update to authenticated
using (coach_id = auth.uid())
with check (coach_id = auth.uid() and public.is_coach_of(student_id));

drop policy if exists meal_plans_delete on public.meal_plans;
create policy meal_plans_delete on public.meal_plans
for delete to authenticated
using (coach_id = auth.uid());

grant select, insert, update, delete on public.meal_plans to authenticated;

create or replace function public.touch_meal_plan_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists meal_plans_touch_updated_at on public.meal_plans;
create trigger meal_plans_touch_updated_at
before update on public.meal_plans
for each row execute function public.touch_meal_plan_updated_at();

-- =========================================================
-- NOTIFICAÇÕES
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null default 'geral',
  title text not null,
  body text,
  url text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications(user_id) where read_at is null;

alter table public.notifications enable row level security;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
for delete to authenticated
using (user_id = auth.uid());

grant select, update, delete on public.notifications to authenticated;

create or replace function public.push_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text default null,
  p_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_title is null then
    return;
  end if;

  insert into public.notifications (user_id, type, title, body, url)
  values (p_user_id, coalesce(p_type, 'geral'), p_title, p_body, p_url);
end;
$$;

revoke all on function public.push_notification(uuid, text, text, text, text) from public;
revoke all on function public.push_notification(uuid, text, text, text, text) from anon, authenticated;

-- Mensagens: notifica o outro lado da conversa.
create or replace function public.push_notification_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient uuid;
  v_role text;
  v_sender text;
  v_url text;
begin
  v_recipient := case when new.sender_id = new.student_id then new.coach_id else new.student_id end;

  select full_name into v_sender from public.profiles where id = new.sender_id;
  select role into v_role from public.profiles where id = v_recipient;

  v_url := case
    when v_role = 'personal' then '/personal/mensagem/' || new.student_id::text
    else '/aluno/mensagens'
  end;

  perform public.push_notification(
    v_recipient,
    'mensagem',
    'Nova mensagem',
    coalesce(v_sender, 'Seu contato') || ' enviou uma mensagem.',
    v_url
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.messages') is not null then
    drop trigger if exists messages_notify_new on public.messages;
    create trigger messages_notify_new
    after insert on public.messages
    for each row execute function public.push_notification_new_message();
  end if;
end;
$$;

-- Feedbacks: notifica o personal quando o aluno envia.
create or replace function public.push_notification_new_feedback()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_student text;
begin
  select full_name into v_student from public.profiles where id = new.student_id;

  perform public.push_notification(
    new.coach_id,
    'feedback',
    'Novo feedback recebido',
    coalesce(v_student, 'Um aluno') || ' enviou uma nova solicitação.',
    '/personal/feedbacks'
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.student_feedback') is not null then
    drop trigger if exists student_feedback_notify_new on public.student_feedback;
    create trigger student_feedback_notify_new
    after insert on public.student_feedback
    for each row execute function public.push_notification_new_feedback();
  end if;
end;
$$;

-- Feedbacks: notifica o aluno quando o personal responde.
create or replace function public.push_notification_feedback_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.coach_reply is distinct from old.coach_reply and new.coach_reply is not null then
    perform public.push_notification(
      new.student_id,
      'feedback',
      'Seu personal respondeu',
      left(new.coach_reply, 160),
      '/aluno/suporte'
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.student_feedback') is not null then
    drop trigger if exists student_feedback_notify_reply on public.student_feedback;
    create trigger student_feedback_notify_reply
    after update on public.student_feedback
    for each row execute function public.push_notification_feedback_reply();
  end if;
end;
$$;

-- Treinos: notifica o aluno quando um treino é publicado ou reativado.
create or replace function public.push_notification_workout_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publish boolean := false;
begin
  if new.status = 'active' then
    if tg_op = 'INSERT' then
      v_publish := true;
    else
      v_publish := old.status is distinct from 'active';
    end if;
  end if;

  if v_publish then
    perform public.push_notification(
      new.student_id,
      'treino',
      'Novo treino disponível',
      new.name,
      '/aluno/treino/' || new.id::text
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.workouts') is not null then
    drop trigger if exists workouts_notify_published on public.workouts;
    create trigger workouts_notify_published
    after insert or update on public.workouts
    for each row execute function public.push_notification_workout_published();
  end if;
end;
$$;

-- Sessões: notifica o personal quando um aluno conclui um treino.
create or replace function public.push_notification_workout_session()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coach uuid;
  v_student text;
  v_workout text;
begin
  select w.coach_id, w.name into v_coach, v_workout
  from public.workouts w
  where w.id = new.workout_id;

  if v_coach is null then
    return new;
  end if;

  select full_name into v_student from public.profiles where id = new.student_id;

  perform public.push_notification(
    v_coach,
    'treino',
    'Treino concluído',
    coalesce(v_student, 'Seu aluno') || ' concluiu ' || coalesce(v_workout, 'um treino') || '.',
    '/personal/aluno/' || new.student_id::text
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.workout_sessions') is not null then
    drop trigger if exists workout_sessions_notify_coach on public.workout_sessions;
    create trigger workout_sessions_notify_coach
    after insert on public.workout_sessions
    for each row execute function public.push_notification_workout_session();
  end if;
end;
$$;

-- Plano alimentar: notifica o aluno quando o personal salva.
create or replace function public.push_notification_meal_plan_saved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    new.student_id,
    'alimentacao',
    'Seu plano alimentar foi atualizado',
    new.title,
    '/aluno/alimentacao'
  );

  return new;
end;
$$;

drop trigger if exists meal_plans_notify_saved on public.meal_plans;
create trigger meal_plans_notify_saved
after insert or update on public.meal_plans
for each row execute function public.push_notification_meal_plan_saved();

-- Cobranças: notifica o aluno quando uma nova cobrança é criada.
create or replace function public.push_notification_payment_due()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.push_notification(
    new.student_id,
    'cobranca',
    'Nova cobrança',
    new.description || ' • vence em ' || to_char(new.due_date, 'DD/MM/YYYY'),
    '/aluno/suporte'
  );

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.payment_dues') is not null then
    drop trigger if exists payment_dues_notify_new on public.payment_dues;
    create trigger payment_dues_notify_new
    after insert on public.payment_dues
    for each row execute function public.push_notification_payment_due();
  end if;
end;
$$;

-- Realtime: mantém o sino atualizado sem precisar recarregar a tela.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'notifications'
     ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end;
$$;



-- ============================================================
-- ARQUIVO: supabase/upgrade_admin.sql
-- ============================================================

-- Evolvi Fit - painel admin master: aprovação de contas e período de teste
-- Execute no SQL Editor do Supabase (idempotente). Requer schema base.

-- 1) Role 'admin' + status da conta + trial
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('admin', 'personal', 'aluno'));

alter table public.profiles
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'trial', 'approved', 'rejected'));
alter table public.profiles
  add column if not exists trial_ends_at timestamptz;
alter table public.profiles
  add column if not exists approved_at timestamptz;
alter table public.profiles
  add column if not exists approved_by uuid references public.profiles(id);
alter table public.profiles
  add column if not exists notes text;

create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);

-- 2) Helper is_admin()
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- 3) handle_new_user: personal entra em teste de 7 dias; admin criado só via metadata.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text := 'approved';
  v_trial timestamptz := null;
  v_admin_created boolean := coalesce((new.raw_user_meta_data->>'admin_created')::boolean, false);
  v_is_admin boolean := coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false);
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  if v_role not in ('admin', 'personal', 'aluno') then
    v_role := 'aluno';
  end if;

  if v_is_admin then
    v_role := 'admin';
  end if;

  if v_role = 'personal' then
    if v_admin_created then
      v_status := 'approved';
      v_trial := null;
    else
      v_status := 'trial';
      v_trial := now() + interval '7 days';
    end if;
  elsif v_role = 'admin' then
    v_status := 'approved';
  else
    v_status := 'approved';
  end if;

  insert into public.profiles (id, role, full_name, email, status, trial_ends_at)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email, v_status, v_trial)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 4) RLS: admin vê e atualiza todos os profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select to authenticated
using (
  id = auth.uid()
  or public.is_coach_of(id)
  or public.is_student_of(id)
  or public.is_admin()
);

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- 5) RPC para o admin aprovar/rejeitar/estender trial
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_trial_days integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if p_status not in ('pending', 'trial', 'approved', 'rejected') then
    raise exception 'invalid status';
  end if;

  update public.profiles
  set status = p_status,
      approved_at = case when p_status = 'approved' then now() else approved_at end,
      approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
      trial_ends_at = case
        when p_status = 'trial' then now() + (coalesce(p_trial_days, 7) || ' days')::interval
        when p_status = 'approved' then null
        else trial_ends_at
      end
  where id = p_user_id;
end;
$$;

revoke all on function public.admin_set_account_status(uuid, text, integer) from public;
revoke all on function public.admin_set_account_status(uuid, text, integer) from anon;
grant execute on function public.admin_set_account_status(uuid, text, integer) to authenticated;

-- 6) View de resumo para o painel (contagens)
create or replace view public.admin_overview as
select
  (select count(*) from public.profiles where role = 'personal' and status = 'trial') as personals_trial,
  (select count(*) from public.profiles where role = 'personal' and status = 'approved') as personals_approved,
  (select count(*) from public.profiles where role = 'personal' and status = 'rejected') as personals_rejected,
  (select count(*) from public.profiles where role = 'personal' and status = 'pending') as personals_pending,
  (select count(*) from public.profiles where role = 'aluno') as alunos_total,
  (select count(*) from public.profiles) as usuarios_total;
grant select on public.admin_overview to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_admin_v2.sql
-- ============================================================

-- Evolvi Fit - admin v2: pagamentos, bloqueio/liberação e configurações globais
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

-- 1) Status 'blocked' + motivo/data de bloqueio em profiles
alter table public.profiles
  drop constraint if exists profiles_status_check;
alter table public.profiles
  add constraint profiles_status_check check (status in ('pending', 'trial', 'approved', 'rejected', 'blocked'));

alter table public.profiles
  add column if not exists blocked_at timestamptz;
alter table public.profiles
  add column if not exists blocked_by uuid references public.profiles(id);
alter table public.profiles
  add column if not exists block_reason text;

-- 2) Configurações globais do admin
create table if not exists public.admin_settings (
  id integer primary key default 1 check (id = 1),
  default_trial_days integer not null default 7 check (default_trial_days between 1 and 90),
  auto_block_expired_trials boolean not null default true,
  allow_self_signup boolean not null default true,
  max_students_per_personal integer,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id)
);

insert into public.admin_settings (id) values (1) on conflict (id) do nothing;

alter table public.admin_settings enable row level security;

drop policy if exists admin_settings_select on public.admin_settings;
create policy admin_settings_select on public.admin_settings
for select to authenticated
using (public.is_admin());

drop policy if exists admin_settings_update on public.admin_settings;
create policy admin_settings_update on public.admin_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, update on public.admin_settings to authenticated;

-- 3) Log de auditoria do admin
create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles(id),
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_log_created_idx on public.admin_audit_log(created_at desc);

alter table public.admin_audit_log enable row level security;

drop policy if exists admin_audit_log_select on public.admin_audit_log;
create policy admin_audit_log_select on public.admin_audit_log
for select to authenticated
using (public.is_admin());

drop policy if exists admin_audit_log_insert on public.admin_audit_log;
create policy admin_audit_log_insert on public.admin_audit_log
for insert to authenticated
with check (public.is_admin());

grant select, insert on public.admin_audit_log to authenticated;

-- 4) RPC: bloquear/liberar conta
create or replace function public.admin_block_account(p_user_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles
  set status = 'blocked',
      blocked_at = now(),
      blocked_by = auth.uid(),
      block_reason = p_reason
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'block_account', 'profile', p_user_id, jsonb_build_object('reason', p_reason));
end;
$$;

create or replace function public.admin_unblock_account(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles
  set status = 'approved',
      blocked_at = null,
      blocked_by = null,
      block_reason = null,
      approved_at = now(),
      approved_by = auth.uid()
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id)
  values (auth.uid(), 'unblock_account', 'profile', p_user_id);
end;
$$;

-- 5) RPC: atualizar configurações globais
create or replace function public.admin_update_settings(
  p_default_trial_days integer,
  p_auto_block_expired_trials boolean,
  p_allow_self_signup boolean,
  p_max_students_per_personal integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.admin_settings
  set default_trial_days = p_default_trial_days,
      auto_block_expired_trials = p_auto_block_expired_trials,
      allow_self_signup = p_allow_self_signup,
      max_students_per_personal = p_max_students_per_personal,
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  insert into public.admin_audit_log (admin_id, action, target_type, details)
  values (auth.uid(), 'update_settings', 'admin_settings',
    jsonb_build_object('trial_days', p_default_trial_days, 'auto_block', p_auto_block_expired_trials, 'self_signup', p_allow_self_signup));
end;
$$;

-- 6) RPC: aprovar com dias de teste configuráveis
create or replace function public.admin_set_account_status(
  p_user_id uuid,
  p_status text,
  p_trial_days integer default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trial_days integer;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_status not in ('pending', 'trial', 'approved', 'rejected', 'blocked') then
    raise exception 'invalid status';
  end if;

  select coalesce(p_trial_days, default_trial_days, 7) into v_trial_days
  from public.admin_settings where id = 1;

  update public.profiles
  set status = p_status,
      approved_at = case when p_status = 'approved' then now() else approved_at end,
      approved_by = case when p_status = 'approved' then auth.uid() else approved_by end,
      trial_ends_at = case
        when p_status = 'trial' then now() + (v_trial_days || ' days')::interval
        when p_status = 'approved' then null
        else trial_ends_at
      end,
      blocked_at = case when p_status = 'blocked' then now() else null end,
      blocked_by = case when p_status = 'blocked' then auth.uid() else null end
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'set_status', 'profile', p_user_id, jsonb_build_object('status', p_status, 'trial_days', v_trial_days));
end;
$$;

-- 7) handle_new_user: respeita allow_self_signup (se false, personal entra pending)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text := 'approved';
  v_trial timestamptz := null;
  v_admin_created boolean := coalesce((new.raw_user_meta_data->>'admin_created')::boolean, false);
  v_is_admin boolean := coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false);
  v_allow_signup boolean := true;
  v_trial_days integer := 7;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  if v_role not in ('admin', 'personal', 'aluno') then
    v_role := 'aluno';
  end if;

  if v_is_admin then v_role := 'admin'; end if;

  select allow_self_signup, default_trial_days into v_allow_signup, v_trial_days
  from public.admin_settings where id = 1;
  v_allow_signup := coalesce(v_allow_signup, true);
  v_trial_days := coalesce(v_trial_days, 7);

  if v_role = 'personal' then
    if v_admin_created then
      v_status := 'approved';
    elsif not v_allow_signup then
      v_status := 'pending';
    else
      v_status := 'trial';
      v_trial := now() + (v_trial_days || ' days')::interval;
    end if;
  elsif v_role = 'admin' then
    v_status := 'approved';
  else
    v_status := 'approved';
  end if;

  insert into public.profiles (id, role, full_name, email, status, trial_ends_at)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email, v_status, v_trial)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- 8) Permissões
revoke all on function public.admin_block_account(uuid, text) from public;
revoke all on function public.admin_block_account(uuid, text) from anon;
grant execute on function public.admin_block_account(uuid, text) to authenticated;

revoke all on function public.admin_unblock_account(uuid) from public;
revoke all on function public.admin_unblock_account(uuid) from anon;
grant execute on function public.admin_unblock_account(uuid) to authenticated;

revoke all on function public.admin_update_settings(integer, boolean, boolean, integer) from public;
revoke all on function public.admin_update_settings(integer, boolean, boolean, integer) from anon;
grant execute on function public.admin_update_settings(integer, boolean, boolean, integer) to authenticated;

-- re-create admin_set_account_status with new signature (status includes blocked)
-- (already updated above)

grant select on public.admin_settings to authenticated;
grant select, insert on public.admin_audit_log to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_admin_v3.sql
-- ============================================================

-- Evolvi Fit - admin v3: acesso por período (pagamento manual, 30 dias)
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

-- 1) Colunas de acesso pago
alter table public.profiles
  add column if not exists paid_until timestamptz;
alter table public.profiles
  add column if not exists last_payment_at timestamptz;
alter table public.profiles
  add column if not exists payment_notes text;

create index if not exists profiles_paid_until_idx on public.profiles(paid_until);

-- 2) RPC: liberar acesso por N dias (pagamento manual)
create or replace function public.admin_grant_access(
  p_user_id uuid,
  p_days integer default 30,
  p_notes text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_days integer := greatest(1, coalesce(p_days, 30));
  v_base timestamptz;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;

  -- se já tem acesso futuro, estende a partir da data atual de vencimento
  select case when paid_until is not null and paid_until > now() then paid_until else now() end
    into v_base
  from public.profiles where id = p_user_id;

  update public.profiles
  set status = 'approved',
      paid_until = v_base + (v_days || ' days')::interval,
      last_payment_at = now(),
      payment_notes = coalesce(p_notes, payment_notes),
      trial_ends_at = null,
      blocked_at = null,
      blocked_by = null,
      block_reason = null,
      approved_at = now(),
      approved_by = auth.uid()
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'grant_access', 'profile', p_user_id,
    jsonb_build_object('days', v_days, 'notes', p_notes));
end;
$$;

-- 3) RPC: revogar acesso (bloquear por falta de pagamento)
create or replace function public.admin_revoke_access(p_user_id uuid, p_reason text default 'Acesso expirado')
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles
  set status = 'blocked',
      paid_until = null,
      blocked_at = now(),
      blocked_by = auth.uid(),
      block_reason = p_reason
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'revoke_access', 'profile', p_user_id, jsonb_build_object('reason', p_reason));
end;
$$;

-- 4) RPC: atualizar observação de pagamento
create or replace function public.admin_set_payment_notes(p_user_id uuid, p_notes text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  update public.profiles set payment_notes = p_notes where id = p_user_id;
end;
$$;

-- 5) Permissões
revoke all on function public.admin_grant_access(uuid, integer, text) from public;
revoke all on function public.admin_grant_access(uuid, integer, text) from anon;
grant execute on function public.admin_grant_access(uuid, integer, text) to authenticated;

revoke all on function public.admin_revoke_access(uuid, text) from public;
revoke all on function public.admin_revoke_access(uuid, text) from anon;
grant execute on function public.admin_revoke_access(uuid, text) to authenticated;

revoke all on function public.admin_set_payment_notes(uuid, text) from public;
revoke all on function public.admin_set_payment_notes(uuid, text) from anon;
grant execute on function public.admin_set_payment_notes(uuid, text) to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_admin_v4.sql
-- ============================================================

-- Evolvi Fit - admin v4: gestão de conta do personal (reset senha/email, info de acesso)
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

-- 1) RPC: informações de acesso de um usuário (auth.users)
create or replace function public.admin_get_auth_info(p_user_id uuid)
returns table (
  email text,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  select u.email, u.email_confirmed_at, u.last_sign_in_at, u.created_at
  from auth.users u
  where u.id = p_user_id;
end;
$$;

-- 2) RPC: alterar email de um usuário (auth + profiles)
create or replace function public.admin_update_user_email(p_user_id uuid, p_new_email text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_new_email is null or length(trim(p_new_email)) = 0 then raise exception 'invalid email'; end if;

  update auth.users set email = trim(p_new_email), email_confirmed_at = now() where id = p_user_id;
  update public.profiles set email = trim(p_new_email) where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'update_email', 'profile', p_user_id, jsonb_build_object('new_email', p_new_email));
end;
$$;

-- 3) RPC: redefinir senha de um usuário (auth.users)
create or replace function public.admin_reset_user_password(p_user_id uuid, p_new_password text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if p_new_password is null or length(p_new_password) < 6 then raise exception 'password too short'; end if;

  update auth.users
  set encrypted_password = crypt(p_new_password, gen_salt('bf')),
      updated_at = now()
  where id = p_user_id;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id)
  values (auth.uid(), 'reset_password', 'profile', p_user_id);
end;
$$;

-- 4) Permissões
revoke all on function public.admin_get_auth_info(uuid) from public;
revoke all on function public.admin_get_auth_info(uuid) from anon;
grant execute on function public.admin_get_auth_info(uuid) to authenticated;

revoke all on function public.admin_update_user_email(uuid, text) from public;
revoke all on function public.admin_update_user_email(uuid, text) from anon;
grant execute on function public.admin_update_user_email(uuid, text) to authenticated;

revoke all on function public.admin_reset_user_password(uuid, text) from public;
revoke all on function public.admin_reset_user_password(uuid, text) from anon;
grant execute on function public.admin_reset_user_password(uuid, text) to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_admin_v5.sql
-- ============================================================

-- Evolvi Fit - admin v5: visão geral expandida + auditoria
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

-- 1) Atualizar view admin_overview com mais métricas
drop view if exists public.admin_overview;
create view public.admin_overview as
select
  (select count(*) from public.profiles where role = 'personal' and status = 'trial') as personals_trial,
  (select count(*) from public.profiles where role = 'personal' and status = 'approved') as personals_approved,
  (select count(*) from public.profiles where role = 'personal' and status = 'rejected') as personals_rejected,
  (select count(*) from public.profiles where role = 'personal' and status = 'pending') as personals_pending,
  (select count(*) from public.profiles where role = 'personal' and status = 'blocked') as personals_blocked,
  (select count(*) from public.profiles where role = 'aluno') as alunos_total,
  (select count(*) from public.profiles) as usuarios_total,
  (select count(*) from public.payment_dues where status in ('pending', 'late')) as pending_dues_count,
  (select coalesce(sum(amount), 0) from public.payment_dues where status in ('pending', 'late')) as pending_dues_amount,
  (select count(*) from public.profiles where status = 'blocked') as blocked_count,
  (select count(*) from public.admin_audit_log) as audit_count;

grant select on public.admin_overview to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_exercicio_video.sql
-- ============================================================

-- Evolvi Fit - vídeo em exercícios personalizados (workout_exercises)
-- Execute no SQL Editor do Supabase (idempotente).

alter table public.workout_exercises
  add column if not exists video_url text;
alter table public.workout_exercises
  add column if not exists instructions text;

grant select, insert, update, delete on public.workout_exercises to authenticated;



-- ============================================================
-- ARQUIVO: supabase/upgrade_aluno_v2.sql
-- ============================================================

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



-- ============================================================
-- ARQUIVO: supabase/fix_rls_comunicacao.sql
-- ============================================================

-- Evolvi Fit - correção de RLS para feedback e chat do aluno
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

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

drop policy if exists student_feedback_insert on public.student_feedback;
create policy student_feedback_insert on public.student_feedback
for insert to authenticated
with check (student_id = auth.uid() and public.is_student_of(coach_id));

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid()
  and (
    (student_id = auth.uid() and public.is_student_of(coach_id))
    or (coach_id = auth.uid() and public.is_coach_of(student_id))
  )
);



-- ============================================================
-- ARQUIVO: supabase/fix_notificacao_treino.sql
-- ============================================================

-- Evolvi Fit - notificação de novo treino abre o treino correto
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

create or replace function public.push_notification_workout_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publish boolean := false;
begin
  if new.status = 'active' then
    if tg_op = 'INSERT' then
      v_publish := true;
    else
      v_publish := old.status is distinct from 'active';
    end if;
  end if;

  if v_publish then
    perform public.push_notification(
      new.student_id,
      'treino',
      'Novo treino disponível',
      new.name,
      '/aluno/treino/' || new.id::text
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.workouts') is not null then
    drop trigger if exists workouts_notify_published on public.workouts;
    create trigger workouts_notify_published
    after insert or update on public.workouts
    for each row execute function public.push_notification_workout_published();
  end if;
end;
$$;



-- ============================================================
-- ARQUIVO: supabase/fix_typo_treino.sql
-- ============================================================

-- Corrige nomes salvos como "onibus" (erro de corretor) para "ombro".
-- Pode rodar mais de uma vez. Execute no SQL Editor do Supabase.

update public.workouts
set name = regexp_replace(name, 'ônibus|onibus', 'ombro', 'gi')
where name ~* 'ônibus|onibus';

update public.workout_exercises
set name = regexp_replace(name, 'ônibus|onibus', 'ombro', 'gi')
where name ~* 'ônibus|onibus';


-- ============================================================
-- ARQUIVO: supabase/upgrade_capa_logo.sql
-- ============================================================

-- Evolvi Fit - capa/logo do personal
-- Execute no SQL Editor do Supabase (idempotente, pode rodar mais de uma vez).

alter table public.profiles
  add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists branding_select on storage.objects;
create policy branding_select on storage.objects
for select to authenticated
using (bucket_id = 'branding');

drop policy if exists branding_insert on storage.objects;
create policy branding_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'personal'
  )
);

drop policy if exists branding_update on storage.objects;
create policy branding_update on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists branding_delete on storage.objects;
create policy branding_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

alter table public.payment_dues enable row level security;

drop policy if exists payment_dues_admin_select on public.payment_dues;
create policy payment_dues_admin_select on public.payment_dues
for select to authenticated
using (public.is_admin());

drop policy if exists payment_dues_admin_insert on public.payment_dues;
create policy payment_dues_admin_insert on public.payment_dues
for insert to authenticated
with check (public.is_admin());

drop policy if exists payment_dues_admin_update on public.payment_dues;
create policy payment_dues_admin_update on public.payment_dues
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists payment_dues_admin_delete on public.payment_dues;
create policy payment_dues_admin_delete on public.payment_dues
for delete to authenticated
using (public.is_admin());

