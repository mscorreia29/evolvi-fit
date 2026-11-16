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
