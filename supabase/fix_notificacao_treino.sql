-- Evolvi Fit - notificação de novo treino abre o treino correto
-- Execute no SQL Editor do Supabase. Pode rodar mais de uma vez.

create or replace function public.push_notification_workout_published()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_publish boolean := false;
begin
  if new.status = 'active' then
    if tg_op = 'INSERT' then
      v_publish := true;
    else
      v_publish := old.status is distinct from 'active';
    end if;
  end if;

  if v_publish then
    perform public.push_notification(
      new.student_id,
      'treino',
      'Novo treino disponível',
      new.name,
      '/aluno/treino/' || new.id::text
    );
  end if;

  return new;
end;
$$;

do $$
begin
  if to_regclass('public.workouts') is not null then
    drop trigger if exists workouts_notify_published on public.workouts;
    create trigger workouts_notify_published
    after insert or update on public.workouts
    for each row execute function public.push_notification_workout_published();
  end if;
end;
$$;
