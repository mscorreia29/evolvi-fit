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
