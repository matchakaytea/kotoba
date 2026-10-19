-- Kotoba sync: paste this whole file into Supabase → SQL Editor → Run.
-- Every row belongs to the signed-in user, and row level security makes sure
-- each user can only ever see and change their own rows.

create table if not exists public.kotoba_attempts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  uid text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, uid)
);

create table if not exists public.kotoba_tests (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  test_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, test_id)
);

create table if not exists public.kotoba_settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.kotoba_touch() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists kotoba_attempts_touch on public.kotoba_attempts;
create trigger kotoba_attempts_touch before update on public.kotoba_attempts
  for each row execute function public.kotoba_touch();
drop trigger if exists kotoba_tests_touch on public.kotoba_tests;
create trigger kotoba_tests_touch before update on public.kotoba_tests
  for each row execute function public.kotoba_touch();
drop trigger if exists kotoba_settings_touch on public.kotoba_settings;
create trigger kotoba_settings_touch before update on public.kotoba_settings
  for each row execute function public.kotoba_touch();

alter table public.kotoba_attempts enable row level security;
alter table public.kotoba_tests enable row level security;
alter table public.kotoba_settings enable row level security;

drop policy if exists "own attempts" on public.kotoba_attempts;
create policy "own attempts" on public.kotoba_attempts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own tests" on public.kotoba_tests;
create policy "own tests" on public.kotoba_tests for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "own settings" on public.kotoba_settings;
create policy "own settings" on public.kotoba_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Let signed-in users reach the tables through the API (the policies above
-- still limit them to their own rows). Needed when new tables are not
-- exposed automatically.
grant select, insert, update, delete on public.kotoba_attempts to authenticated;
grant select, insert, update, delete on public.kotoba_tests to authenticated;
grant select, insert, update, delete on public.kotoba_settings to authenticated;

-- Skin pictures (wallpapers) are files in a private storage bucket. Each user
-- gets a folder named after their user id and can only touch that folder.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kotoba-pictures', 'kotoba-pictures', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "own kotoba pictures" on storage.objects;
create policy "own kotoba pictures" on storage.objects for all to authenticated
  using (bucket_id = 'kotoba-pictures' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'kotoba-pictures' and (storage.foldername(name))[1] = auth.uid()::text);
