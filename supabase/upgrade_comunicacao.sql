-- Evolvi Fit - comunicação: feedback, mensagens e mensalidades
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
