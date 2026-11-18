alter table public.profiles
  add column if not exists is_autonomous boolean not null default false,
  add column if not exists ai_last_generated_at timestamptz,
  add column if not exists ai_generation_count integer not null default 0,
  add column if not exists ai_regeneration_unlocked boolean not null default false;

create index if not exists profiles_autonomous_idx on public.profiles(is_autonomous) where is_autonomous;

alter table public.workouts
  add column if not exists generated_by_ai boolean not null default false;

create table if not exists public.ai_settings (
  id integer primary key default 1 check (id = 1),
  enabled boolean not null default false,
  provider text not null default 'gemini' check (provider in ('gemini', 'openai')),
  api_key text,
  prompt_base text not null default 'Você é um personal trainer experiente. Gere blocos de treino semanais seguros, objetivo e progressivo. Responda APENAS com JSON no formato: {"name":"Plano ...","workouts":[{"name":"Treino A - ...","days":[{"label":"A","exercises":[{"name":"...","sets":3,"reps":"10-12","rest_seconds":60,"notes":"..."}]}]}]}. Crie exatamente a quantidade de blocos informada no pedido, cada um com de 3 a 8 exercícios. Nunca gere um único treino com todos os exercícios. Respeite restrições, nível, objetivo, dias disponíveis e local informados. Não inclua exercícios de alto impacto se houver lesão ou limitação.',
  generation_interval_days integer not null default 30 check (generation_interval_days between 1 and 365),
  allow_manual_regeneration boolean not null default false,
  model text,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);

insert into public.ai_settings (id) values (1) on conflict (id) do nothing;

alter table public.ai_settings enable row level security;

drop policy if exists ai_settings_select on public.ai_settings;
create policy ai_settings_select on public.ai_settings
for select to authenticated
using (public.is_admin());

drop policy if exists ai_settings_update on public.ai_settings;
create policy ai_settings_update on public.ai_settings
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select, update on public.ai_settings to authenticated;

create or replace function public.ai_signup_enabled()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select enabled from public.ai_settings where id = 1), false);
$$;

grant execute on function public.ai_signup_enabled() to anon, authenticated;

create or replace function public.admin_update_ai_settings(
  p_enabled boolean,
  p_provider text,
  p_api_key text,
  p_clear_api_key boolean,
  p_prompt_base text,
  p_generation_interval_days integer,
  p_allow_manual_regeneration boolean,
  p_model text
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

  if p_provider not in ('gemini', 'openai') then
    raise exception 'provider inválido';
  end if;

  if p_generation_interval_days < 1 or p_generation_interval_days > 365 then
    raise exception 'intervalo inválido';
  end if;

  update public.ai_settings
  set enabled = p_enabled,
      provider = p_provider,
      api_key = case
        when p_clear_api_key then null
        when p_api_key is null then api_key
        else nullif(btrim(p_api_key), '')
      end,
      prompt_base = coalesce(nullif(btrim(p_prompt_base), ''), prompt_base),
      generation_interval_days = p_generation_interval_days,
      allow_manual_regeneration = p_allow_manual_regeneration,
      model = nullif(btrim(p_model), ''),
      updated_at = now(),
      updated_by = auth.uid()
  where id = 1;

  insert into public.admin_audit_log (admin_id, action, target_type, details)
  values (
    auth.uid(),
    'update_ai_settings',
    'ai_settings',
    jsonb_build_object(
      'enabled', p_enabled,
      'provider', p_provider,
      'generation_interval_days', p_generation_interval_days,
      'allow_manual_regeneration', p_allow_manual_regeneration,
      'model', p_model
    )
  );
end;
$$;

grant execute on function public.admin_update_ai_settings(boolean, text, text, boolean, text, integer, boolean, text) to authenticated;

create or replace function public.admin_unlock_ai_regeneration(p_user_id uuid)
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
  set ai_regeneration_unlocked = true
  where id = p_user_id and is_autonomous;

  insert into public.admin_audit_log (admin_id, action, target_type, target_id, details)
  values (auth.uid(), 'unlock_ai_regeneration', 'profile', p_user_id, jsonb_build_object('unlocked', true));
end;
$$;

grant execute on function public.admin_unlock_ai_regeneration(uuid) to authenticated;

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
  v_is_autonomous boolean := coalesce((new.raw_user_meta_data->>'is_autonomous')::boolean, false);
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

  insert into public.profiles (id, role, full_name, email, status, trial_ends_at, is_autonomous)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email, v_status, v_trial, v_is_autonomous)
  on conflict (id) do nothing;

  return new;
end;
$$;
