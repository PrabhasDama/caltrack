-- Private application metadata and object access. Files are immutable; replacing means a new ID.
create table public.user_uploads (
 id uuid primary key, user_id uuid not null references public.profiles(id) on delete cascade,
 bucket text not null check(bucket in ('progress-photos','receipts','nutrition-labels')),
 path text not null unique, local_date date not null, note text not null default '' check(char_length(note)<=1000),
 pose text not null default 'front' check(pose in ('front','side','back','custom')),
 status text not null default 'pending' check(status in ('pending','ready')),
 created_at timestamptz not null default now(),unique(id,user_id),
 check(path=user_id::text||'/'||id::text||'.jpg' or path=user_id::text||'/'||id::text||'.png' or path=user_id::text||'/'||id::text||'.webp')
);
alter table public.user_uploads enable row level security;
revoke all on public.user_uploads from anon,authenticated;
grant select,insert,update,delete on public.user_uploads to authenticated;
create policy own_uploads on public.user_uploads for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('progress-photos','progress-photos',false,6291456,array['image/jpeg','image/png','image/webp']),
 ('receipts','receipts',false,6291456,array['image/jpeg','image/png','image/webp']),
 ('nutrition-labels','nutrition-labels',false,6291456,array['image/jpeg','image/png','image/webp'])
 on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy caltrack_private_read on storage.objects for select to authenticated using(bucket_id in ('progress-photos','receipts','nutrition-labels') and (storage.foldername(name))[1]=(select auth.uid()::text));
create policy caltrack_private_insert on storage.objects for insert to authenticated with check(bucket_id in ('progress-photos','receipts','nutrition-labels') and (storage.foldername(name))[1]=(select auth.uid()::text) and exists(select 1 from public.user_uploads u where u.path=name and u.bucket=bucket_id and u.user_id=(select auth.uid()) and u.status='pending'));
create policy caltrack_private_delete on storage.objects for delete to authenticated using(bucket_id in ('progress-photos','receipts','nutrition-labels') and (storage.foldername(name))[1]=(select auth.uid()::text));
