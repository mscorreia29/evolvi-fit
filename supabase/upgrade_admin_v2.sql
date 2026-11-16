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
