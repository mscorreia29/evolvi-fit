-- Evolvi Fit - admin v6: acesso do administrador às cobranças
-- Execute no SQL Editor do Supabase (idempotente). Requer upgrade_admin.sql.

alter table public.payment_dues enable row level security;

drop policy if exists payment_dues_admin_select on public.payment_dues;
create policy payment_dues_admin_select on public.payment_dues
for select to authenticated
using (public.is_admin());

drop policy if exists payment_dues_admin_insert on public.payment_dues;
create policy payment_dues_admin_insert on public.payment_dues
for insert to authenticated
with check (public.is_admin());

drop policy if exists payment_dues_admin_update on public.payment_dues;
create policy payment_dues_admin_update on public.payment_dues
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists payment_dues_admin_delete on public.payment_dues;
create policy payment_dues_admin_delete on public.payment_dues
for delete to authenticated
using (public.is_admin());
