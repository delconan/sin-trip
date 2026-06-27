create extension if not exists pgcrypto;

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  share_token_hash text not null unique,
  title text not null,
  timezone text not null default 'Asia/Singapore',
  party jsonb not null default '{}'::jsonb,
  revision bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table public.activity_cards (
  trip_id uuid not null references public.trips(id) on delete cascade,
  card_id text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  primary key (trip_id, card_id)
);

create table public.scheduled_items (
  trip_id uuid not null references public.trips(id) on delete cascade,
  item_id text not null,
  date date not null,
  position integer not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (trip_id, item_id)
);

create table public.route_cache (
  cache_key text primary key,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.activity_cards enable row level security;
alter table public.scheduled_items enable row level security;
alter table public.route_cache enable row level security;

create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip_id and user_id = (select auth.uid())
  );
$$;

create policy "members read trips" on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy "members read memberships" on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "members read cards" on public.activity_cards
  for select to authenticated using (public.is_trip_member(trip_id));
create policy "members read itinerary" on public.scheduled_items
  for select to authenticated using (public.is_trip_member(trip_id));

create or replace function public.replace_trip_state(
  p_trip_id uuid,
  p_expected_revision bigint,
  p_cards jsonb,
  p_items jsonb
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_revision bigint;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'not_authorized';
  end if;

  update public.trips
  set revision = revision + 1, updated_at = now()
  where id = p_trip_id and revision = p_expected_revision
  returning revision into next_revision;

  if next_revision is null then
    raise exception 'revision_conflict';
  end if;

  delete from public.activity_cards where trip_id = p_trip_id;
  insert into public.activity_cards (trip_id, card_id, data)
  select p_trip_id, element->>'id', element
  from jsonb_array_elements(p_cards) element;

  delete from public.scheduled_items where trip_id = p_trip_id;
  insert into public.scheduled_items (trip_id, item_id, date, position, data)
  select p_trip_id, element->>'id', (element->>'date')::date, (element->>'position')::integer, element
  from jsonb_array_elements(p_items) element;

  return next_revision;
end;
$$;

grant execute on function public.replace_trip_state(uuid, bigint, jsonb, jsonb) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trip-images', 'trip-images', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "trip members read images" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'trip-images'
    and public.is_trip_member((storage.foldername(name))[1]::uuid)
  );

create policy "trip members upload images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'trip-images'
    and public.is_trip_member((storage.foldername(name))[1]::uuid)
  );

alter publication supabase_realtime add table public.trips;

