-- Stack on Supabase: the database, the PDF bucket and their security rules.
-- Run this once: Dashboard → SQL Editor → New query → paste → Run.
-- It is safe to run again after an update.

-- ---- Synced items ----
-- One row per note, saved article, PDF, playlist, focus session, feed or profile.
-- `key` is the item's id (a very long id is shortened by the app; the real id
-- stays in `id`). `seq` is a number the server gives on every write; a device
-- downloads the rows with a higher number than the last one it has seen.
create table if not exists public.items (
  user_id    uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  collection text        not null,
  key        text        not null,
  id         text        not null,
  data       jsonb,
  deleted    boolean     not null default false,
  seq        bigint      not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, key)
);
create sequence if not exists public.items_seq;
create index if not exists items_user_seq on public.items (user_id, seq);

create or replace function public.items_stamp() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- One writer per account at a time: a device must never see a higher number
  -- before a lower one is saved, or it would skip the lower one for good.
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));
  new.seq := nextval('public.items_seq');
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists items_stamp on public.items;
create trigger items_stamp before insert or update on public.items
  for each row execute function public.items_stamp();

-- Each person reads and writes only their own rows.
alter table public.items enable row level security;
drop policy if exists "own items" on public.items;
create policy "own items" on public.items for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
revoke all on public.items from anon;
grant select, insert, update, delete on public.items to authenticated;

-- ---- Stack AI: requests per person per day ----
-- Nobody reads or writes this table directly (no policies); only ai_take() does.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  day     date not null,
  n       int  not null default 0,
  primary key (user_id, day)
);
alter table public.ai_usage enable row level security;
revoke all on public.ai_usage from anon, authenticated;

-- Counts one request for the signed-in person. False when today's limit is used up.
create or replace function public.ai_take(lim int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  me    uuid := auth.uid();
  today date := (now() at time zone 'utc')::date;
  used  int;
begin
  if me is null or lim < 1 then
    return false;
  end if;
  delete from public.ai_usage where user_id = me and day < today;
  insert into public.ai_usage as u (user_id, day, n)
  values (me, today, 1)
  on conflict (user_id, day) do update set n = u.n + 1 where u.n < lim
  returning u.n into used;
  return used is not null;
end $$;
revoke execute on function public.ai_take(int) from public, anon;
grant execute on function public.ai_take(int) to authenticated;

-- ---- Delete my account ----
-- Removes the login; the person's items and AI counts go with it (on delete
-- cascade). The app removes their PDF files first, through the Storage API.
create or replace function public.delete_account() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = me;
end $$;
revoke execute on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ---- PDF files ----
-- A private bucket: pdfs/<user id>/<pdf id>.pdf, PDFs only, at most 50 MB each.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pdfs', 'pdfs', false, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own pdfs: read" on storage.objects;
create policy "own pdfs: read" on storage.objects for select to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: add" on storage.objects;
create policy "own pdfs: add" on storage.objects for insert to authenticated
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: replace" on storage.objects;
create policy "own pdfs: replace" on storage.objects for update to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "own pdfs: remove" on storage.objects;
create policy "own pdfs: remove" on storage.objects for delete to authenticated
  using (bucket_id = 'pdfs' and (storage.foldername(name))[1] = (select auth.uid())::text);
