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
