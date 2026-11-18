alter table public.meal_plans
  add column if not exists ai_generated boolean not null default false;

alter table public.profiles
  add column if not exists ai_meal_last_generated_at timestamptz,
  add column if not exists ai_meal_generation_count integer not null default 0,
  add column if not exists ai_meal_regeneration_unlocked boolean not null default false,
  add column if not exists ai_meal_favorite_foods text,
  add column if not exists ai_meal_routine text,
  add column if not exists ai_meal_preferences jsonb not null default '{}'::jsonb;

drop policy if exists meal_plans_insert_self_autonomous on public.meal_plans;
drop policy if exists meal_plans_insert_self_ai on public.meal_plans;
create policy meal_plans_insert_self_ai on public.meal_plans
for insert to authenticated
with check (
  student_id = auth.uid()
  and (
    (
      coach_id = auth.uid()
      and exists (
        select 1
        from public.profiles
        where id = auth.uid() and is_autonomous = true
      )
    )
    or exists (
      select 1
      from public.coach_students
      where student_id = auth.uid() and coach_id = meal_plans.coach_id
    )
  )
);

drop policy if exists meal_plans_update_self_autonomous on public.meal_plans;
drop policy if exists meal_plans_update_self_ai on public.meal_plans;
create policy meal_plans_update_self_ai on public.meal_plans
for update to authenticated
using (
  student_id = auth.uid()
  and (
    coach_id = auth.uid()
    or exists (
      select 1
      from public.coach_students
      where student_id = auth.uid() and coach_id = meal_plans.coach_id
    )
  )
)
with check (
  student_id = auth.uid()
  and (
    (
      coach_id = auth.uid()
      and exists (
        select 1
        from public.profiles
        where id = auth.uid() and is_autonomous = true
      )
    )
    or exists (
      select 1
      from public.coach_students
      where student_id = auth.uid() and coach_id = meal_plans.coach_id
    )
  )
);

drop policy if exists student_feedback_insert_self_autonomous on public.student_feedback;
create policy student_feedback_insert_self_autonomous on public.student_feedback
for insert to authenticated
with check (
  coach_id = auth.uid()
  and student_id = auth.uid()
  and exists (
    select 1
    from public.profiles
    where id = auth.uid() and is_autonomous = true
  )
);

create or replace function public.admin_unlock_ai_meal_regeneration(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  update public.profiles
  set ai_meal_regeneration_unlocked = true
  where id = p_user_id and role = 'aluno';
end;
$$;

grant execute on function public.admin_unlock_ai_meal_regeneration(uuid) to authenticated;
