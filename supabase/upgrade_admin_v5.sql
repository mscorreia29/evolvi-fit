-- Evolvi Fit - admin v5: visão geral expandida + auditoria
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

-- 1) Atualizar view admin_overview com mais métricas
drop view if exists public.admin_overview;
create view public.admin_overview as
select
  (select count(*) from public.profiles where role = 'personal' and status = 'trial') as personals_trial,
  (select count(*) from public.profiles where role = 'personal' and status = 'approved') as personals_approved,
  (select count(*) from public.profiles where role = 'personal' and status = 'rejected') as personals_rejected,
  (select count(*) from public.profiles where role = 'personal' and status = 'pending') as personals_pending,
  (select count(*) from public.profiles where role = 'personal' and status = 'blocked') as personals_blocked,
  (select count(*) from public.profiles where role = 'aluno') as alunos_total,
  (select count(*) from public.profiles) as usuarios_total,
  (select count(*) from public.payment_dues where status in ('pending', 'late')) as pending_dues_count,
  (select coalesce(sum(amount), 0) from public.payment_dues where status in ('pending', 'late')) as pending_dues_amount,
  (select count(*) from public.profiles where status = 'blocked') as blocked_count,
  (select count(*) from public.admin_audit_log) as audit_count;

grant select on public.admin_overview to authenticated;
