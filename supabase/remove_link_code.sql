-- Remove o vínculo por código do Evolvi Fit.
-- Execute uma vez no SQL Editor se o projeto já usava o schema antigo.
-- O vínculo agora é criado pelo personal na tela "Novo aluno".

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
begin
  v_role := coalesce(new.raw_user_meta_data->>'role', 'aluno');
  if v_role not in ('personal', 'aluno') then
    v_role := 'aluno';
  end if;

  insert into public.profiles (id, role, full_name, email)
  values (new.id, v_role, new.raw_user_meta_data->>'full_name', new.email)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop function if exists public.link_coach(text);
alter table public.profiles drop column if exists coach_code;
