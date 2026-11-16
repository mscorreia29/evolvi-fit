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
