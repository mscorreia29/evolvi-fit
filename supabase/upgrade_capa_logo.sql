-- Evolvi Fit - capa/logo do personal
-- Execute no SQL Editor do Supabase (idempotente, pode rodar mais de uma vez).

alter table public.profiles
  add column if not exists cover_url text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'branding',
  'branding',
  true,
  5 * 1024 * 1024,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']::text[]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists branding_select on storage.objects;
create policy branding_select on storage.objects
for select to authenticated
using (bucket_id = 'branding');

drop policy if exists branding_insert on storage.objects;
create policy branding_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
  and exists (
    select 1
    from public.profiles
    where id = auth.uid() and role = 'personal'
  )
);

drop policy if exists branding_update on storage.objects;
create policy branding_update on storage.objects
for update to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists branding_delete on storage.objects;
create policy branding_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'branding'
  and (storage.foldername(name))[1] = auth.uid()::text
);
