create table tandem.reviews (
  id uuid primary key default gen_random_uuid(),
  event_id text not null references tandem.events on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  overall smallint not null check (overall between 1 and 5),
  organization smallint check (organization between 1 and 5),
  accuracy smallint check (accuracy between 1 and 5),
  accessibility_accuracy smallint check (accessibility_accuracy between 1 and 5),
  would_return boolean,
  comment text not null check (char_length(comment) <= 1000),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create function public.tandem_rate_event(
  event_key text, overall smallint, organization smallint, accuracy smallint,
  accessibility_accuracy smallint, would_return boolean, comment text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  activity tandem.events%rowtype;
begin
  if actor is null then raise exception 'Please sign in first.'; end if;
  select * into activity from tandem.events where id = event_key for update;
  if not found then raise exception 'That event no longer exists.'; end if;
  if activity.host_id = actor or activity.cancelled or clock_timestamp() <= activity.ends_at then
    raise exception 'Only attendees can rate an event after it has finished.';
  end if;
  if not exists (
    select 1 from tandem.registrations
    where event_id = event_key and user_id = actor and left_at is null and checked_in_at is not null
  ) then raise exception 'Confirm your attendance before rating this event.'; end if;
  if overall is null or overall not between 1 and 5 or organization not between 1 and 5
    or accuracy not between 1 and 5 or accessibility_accuracy not between 1 and 5
  then raise exception 'Choose a rating from 1 to 5 stars.'; end if;
  if char_length(coalesce(comment, '')) > 1000 then raise exception 'Keep feedback to 1,000 characters.'; end if;

  insert into tandem.reviews (event_id, user_id, overall, organization, accuracy, accessibility_accuracy, would_return, comment)
  values (event_key, actor, overall, organization, accuracy, accessibility_accuracy, would_return, btrim(coalesce(comment, '')))
  on conflict (event_id, user_id) do nothing;
  if found then perform tandem.notify(); end if;
end;
$$;

alter function public.tandem_snapshot(text) rename to tandem_snapshot_without_reviews;
revoke execute on function public.tandem_snapshot_without_reviews(text) from anon, authenticated;

create function public.tandem_snapshot(linked_event text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with snapshot as materialized (select public.tandem_snapshot_without_reviews(linked_event) as data)
  select snapshot.data || jsonb_build_object('reviews', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', r.id, 'eventId', r.event_id, 'userId', case when r.user_id = auth.uid() then r.user_id::text else '' end,
      'overall', r.overall, 'organization', r.organization, 'accuracy', r.accuracy,
      'accessibilityAccuracy', r.accessibility_accuracy, 'wouldReturn', r.would_return,
      'comment', r.comment, 'createdAt', r.created_at, 'isDemo', false
    ))
    from jsonb_array_elements(snapshot.data->'events') as event_data
    join tandem.reviews r on r.event_id = event_data->>'id'
  ), '[]'::jsonb))
  from snapshot;
$$;

revoke execute on function public.tandem_snapshot(text),
  public.tandem_rate_event(text, smallint, smallint, smallint, smallint, boolean, text) from public, anon, authenticated;
grant execute on function public.tandem_snapshot(text) to anon, authenticated;
grant execute on function public.tandem_rate_event(text, smallint, smallint, smallint, smallint, boolean, text) to authenticated;
