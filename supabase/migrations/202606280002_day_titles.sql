alter table public.trips
  add column if not exists day_titles jsonb not null default '{}'::jsonb;

drop function if exists public.replace_trip_state(uuid, bigint, jsonb, jsonb);
drop function if exists public.replace_trip_state(uuid, bigint, jsonb, jsonb, jsonb);

create function public.replace_trip_state(
  p_trip_id uuid,
  p_expected_revision bigint,
  p_day_titles jsonb,
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
  set revision = revision + 1,
      day_titles = p_day_titles,
      updated_at = now()
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

grant execute on function public.replace_trip_state(uuid, bigint, jsonb, jsonb, jsonb) to authenticated;
