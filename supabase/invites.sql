-- Evolvi Fit v3 - convites de alunos com onboarding (anamnese).
-- Execute no SQL Editor do Supabase depois do schema.sql/upgrade_v2.sql.

alter table public.profiles add column if not exists birth_date date;

create table if not exists public.student_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(9), 'hex'),
  coach_id uuid not null references public.profiles(id) on delete cascade,
  email text not null,
  birth_date date,
  student_id uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '14 days'),
  created_at timestamptz not null default now()
);

create index if not exists student_invites_coach_idx on public.student_invites(coach_id);
create index if not exists student_invites_email_idx on public.student_invites(lower(email));

alter table public.student_invites enable row level security;

drop policy if exists student_invites_coach_select on public.student_invites;
create policy student_invites_coach_select on public.student_invites
for select to authenticated
using (coach_id = auth.uid());

drop policy if exists student_invites_coach_insert on public.student_invites;
create policy student_invites_coach_insert on public.student_invites
for insert to authenticated
with check (coach_id = auth.uid());

drop policy if exists student_invites_coach_delete on public.student_invites;
create policy student_invites_coach_delete on public.student_invites
for delete to authenticated
using (coach_id = auth.uid());

grant select, insert, delete on public.student_invites to authenticated;

-- Atualiza o trigger de criação de perfil para guardar a data de nascimento
-- enviada no cadastro (quando existir).
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_birth date;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  if v_role not in ('personal', 'aluno') then
    v_role := 'aluno';
  end if;

  begin
    v_birth := nullif(new.raw_user_meta_data->>'birth_date', '')::date;
  exception when others then
    v_birth := null;
  end;

  insert into public.profiles (id, role, full_name, email, birth_date)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email, v_birth)
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, profiles.full_name),
    birth_date = coalesce(excluded.birth_date, profiles.birth_date);

  return new;
end;
$$;

-- Consulta pública (por token) dos dados básicos do convite.
create or replace function public.get_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.student_invites%rowtype;
  v_coach_name text;
begin
  select * into v_invite from public.student_invites where token = p_token;

  if v_invite.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  if v_invite.accepted_at is not null then
    return jsonb_build_object('status', 'accepted');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('status', 'expired');
  end if;

  select full_name into v_coach_name from public.profiles where id = v_invite.coach_id;

  return jsonb_build_object(
    'status', 'valid',
    'email', v_invite.email,
    'birth_date', v_invite.birth_date,
    'coach_name', v_coach_name
  );
end;
$$;

grant execute on function public.get_invite(text) to anon, authenticated;

-- Aceite do convite: cria/atualiza o perfil do aluno, vincula ao personal e
-- grava a anamnese. Pode ser chamado mesmo antes da confirmação de email.
create or replace function public.accept_student_invite(
  p_token text,
  p_student_id uuid,
  p_full_name text,
  p_birth_date date,
  p_anamnesis jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invite public.student_invites%rowtype;
  v_email text;
begin
  select * into v_invite from public.student_invites where token = p_token;

  if v_invite.id is null then
    return jsonb_build_object('error', 'convite_nao_encontrado');
  end if;

  if v_invite.accepted_at is not null then
    return jsonb_build_object('error', 'convite_ja_utilizado');
  end if;

  if v_invite.expires_at < now() then
    return jsonb_build_object('error', 'convite_expirado');
  end if;

  select lower(email) into v_email from auth.users where id = p_student_id;

  if v_email is null or v_email <> lower(v_invite.email) then
    return jsonb_build_object('error', 'email_nao_confere');
  end if;

  insert into public.profiles (id, role, full_name, email, birth_date)
  values (p_student_id, 'aluno', nullif(btrim(p_full_name), ''), v_invite.email, p_birth_date)
  on conflict (id) do update set
    role = 'aluno',
    full_name = coalesce(nullif(btrim(p_full_name), ''), profiles.full_name),
    birth_date = coalesce(p_birth_date, profiles.birth_date);

  insert into public.coach_students (coach_id, student_id)
  values (v_invite.coach_id, p_student_id)
  on conflict (coach_id, student_id) do nothing;

  insert into public.anamnesis (coach_id, student_id, data)
  values (v_invite.coach_id, p_student_id, coalesce(p_anamnesis, '{}'::jsonb));

  update public.student_invites
  set accepted_at = now(), student_id = p_student_id
  where id = v_invite.id;

  return jsonb_build_object('ok', true, 'coach_id', v_invite.coach_id);
end;
$$;

grant execute on function public.accept_student_invite(text, uuid, text, date, jsonb)
  to anon, authenticated;
