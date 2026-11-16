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
