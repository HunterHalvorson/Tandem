-- Browser clients read a visibility-filtered snapshot and write through authenticated RPCs.
create schema tandem;
revoke all on schema tandem from public, anon, authenticated;

create table tandem.profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 82),
  show_attendance boolean not null
);

create table tandem.groups (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users on delete cascade,
  data jsonb not null
);

create table tandem.events (
  id text primary key,
  host_id uuid not null references auth.users on delete cascade,
  group_id uuid references tandem.groups on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  capacity integer not null check (capacity between 2 and 500),
  cancelled boolean not null default false,
  data jsonb not null
);

create table tandem.registrations (
  event_id text references tandem.events on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  checked_in_at timestamptz,
  primary key (event_id, user_id)
);

create table tandem.memberships (
  group_id uuid references tandem.groups on delete cascade,
  user_id uuid references auth.users on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table tandem.messages (
  id uuid primary key default gen_random_uuid(),
  event_id text references tandem.events on delete cascade,
  group_id uuid references tandem.groups on delete cascade,
  author_id uuid references auth.users on delete cascade,
  kind text not null check (kind in ('message', 'announcement', 'system')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now(),
  check (num_nonnulls(event_id, group_id) = 1)
);

create index on tandem.messages (event_id, created_at desc);
create index on tandem.messages (group_id, created_at desc);
create index on tandem.registrations (user_id);
create index on tandem.memberships (user_id);

-- Realtime publishes a single content-free invalidation. Clients re-read with their own JWT.
create table public.tandem_revision (
  singleton boolean primary key default true check (singleton),
  revision bigint not null default 0
);
insert into public.tandem_revision default values;
alter table public.tandem_revision enable row level security;
revoke all on public.tandem_revision from anon, authenticated;
grant select on public.tandem_revision to anon, authenticated;
create policy read_revision on public.tandem_revision for select to anon, authenticated using (true);
alter publication supabase_realtime add table public.tandem_revision;

create function tandem.notify() returns void language sql set search_path = '' as $$
  update public.tandem_revision set revision = revision + 1;
$$;

create function tandem.ensure_profile(actor uuid) returns void
language sql set search_path = '' as $$
  insert into tandem.profiles (id, display_name, show_attendance)
  values (actor, coalesce(nullif(left(split_part(btrim(auth.jwt()->'user_metadata'->>'name'), ' ', 1), 40), ''), 'Member'), false)
  on conflict (id) do nothing;
$$;

create function tandem.can_chat(event_key text, actor uuid) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from tandem.events where id = event_key and host_id = actor)
    or exists (select 1 from tandem.registrations
               where event_id = event_key and user_id = actor and left_at is null);
$$;

create function public.tandem_snapshot(linked_event text default null) returns jsonb
language sql stable security definer set search_path = '' as $$
  with viewer as (select auth.uid() as id),
  events as (
    select e.*, tandem.can_chat(e.id, v.id) as can_chat
    from tandem.events e cross join viewer v
    where e.data->>'visibility' = 'public' or e.id = linked_event or tandem.can_chat(e.id, v.id)
  ),
  registrations as (
    select r.*
    from tandem.registrations r join events e on e.id = r.event_id cross join viewer v
    where r.user_id = v.id or (r.left_at is null and exists (
      select 1 from tandem.profiles p where p.id = r.user_id and p.show_attendance
    ))
  ),
  rooms as (
    select e.id as event_id, null::uuid as group_id from events e where e.can_chat
    union all
    select null::text, m.group_id from tandem.memberships m cross join viewer v where m.user_id = v.id
  ),
  messages as (
    select m.* from rooms r cross join lateral (
      select * from tandem.messages
      where event_id = r.event_id or group_id = r.group_id
      order by created_at desc, id desc limit 100
    ) m
  ),
  visible_people as (
    select host_id as id from events
    union select organizer_id from tandem.groups
    union select user_id from tandem.memberships
    union select user_id from registrations
    union select author_id from messages
  )
  select jsonb_build_object(
    'profiles', coalesce((select jsonb_agg(jsonb_build_object(
      'id', p.id, 'displayName', p.display_name, 'showAttendance', p.show_attendance
    )) from tandem.profiles p join visible_people vp on vp.id = p.id), '[]'),
    'events', coalesce((select jsonb_agg(
      case when e.can_chat then e.data
        else jsonb_set(jsonb_set(e.data, '{firstTime,howToFindUs}', '""'::jsonb), '{venue,privateDetails}', '""'::jsonb)
      end
    ) from events e), '[]'),
    'eventCounts', coalesce((select jsonb_object_agg(e.id, jsonb_build_object(
      'going', c.going, 'attended', c.attended
    )) from events e cross join lateral (
      select count(*) as going, count(checked_in_at) as attended
      from tandem.registrations r where r.event_id = e.id and r.left_at is null
    ) c), '{}'),
    'groups', coalesce((select jsonb_agg(data) from tandem.groups), '[]'),
    'memberships', coalesce((select jsonb_agg(jsonb_build_object(
      'id', m.group_id || ':' || m.user_id, 'groupId', m.group_id, 'userId', m.user_id,
      'role', case when g.organizer_id = m.user_id then 'organizer' else 'member' end, 'joinedAt', m.joined_at
    )) from tandem.memberships m join tandem.groups g on g.id = m.group_id), '[]'),
    'registrations', coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
      'id', r.event_id || ':' || r.user_id, 'eventId', r.event_id, 'userId', r.user_id,
      'status', case when r.left_at is null then 'going' else 'left' end,
      'joinedAt', r.joined_at, 'leftAt', r.left_at, 'checkedInAt', r.checked_in_at, 'isDemo', false
    ))) from registrations r), '[]'),
    'messages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'eventId', event_id, 'userId', author_id, 'kind', kind,
      'body', body, 'createdAt', created_at, 'isDemo', false
    )) from messages where event_id is not null), '[]'),
    'groupMessages', coalesce((select jsonb_agg(jsonb_build_object(
      'id', id, 'groupId', group_id, 'userId', author_id, 'body', body, 'createdAt', created_at
    )) from messages where group_id is not null), '[]')
  );
$$;

create function public.tandem_profile(name text, show_attendance boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into tandem.profiles as p values (auth.uid(), left(btrim(name), 82), show_attendance)
  on conflict (id) do update set display_name = excluded.display_name, show_attendance = excluded.show_attendance
  where (p.display_name, p.show_attendance) is distinct from (excluded.display_name, excluded.show_attendance);
  if found then perform tandem.notify(); end if;
end;
$$;

create function public.tandem_event(action text, event_key text, details jsonb default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  event_row tandem.events%rowtype;
  reg tandem.registrations%rowtype;
  group_key uuid;
  start_time timestamptz;
  end_time timestamptz;
  seats integer;
  at_time timestamptz;
begin
  if actor is null then raise exception 'Please sign in first.'; end if;
  -- Every capacity change and RSVP takes the same event lock.
  select * into event_row from tandem.events where id = event_key for update;
  at_time := clock_timestamp();
  if action = 'create' or action = 'edit' then
    if action = 'edit' and (event_row.host_id is distinct from actor
        or event_row.cancelled or at_time >= event_row.starts_at) then
      raise exception 'Only the host can edit an upcoming event.';
    end if;
    group_key := (details->>'groupId')::uuid;
    if group_key is not null and not exists (
      select 1 from tandem.groups where id = group_key and organizer_id = actor
    ) then raise exception 'Only the organizer can schedule group events.'; end if;
    start_time := (details->>'startsAt')::timestamptz;
    end_time := (details->>'endsAt')::timestamptz;
    seats := (details->>'capacity')::integer;
    if start_time <= at_time or coalesce(details->>'visibility', '') not in ('public', 'private')
      or coalesce(details->>'categoryId', '') not in (
        'running','fitness','cycling','hiking','reading','movies','music','art','tech','games',
        'food','volunteering','photography','language','culture','study','sports','meetups'
      )
      or coalesce(char_length(btrim(details->>'title')), 0) not between 4 and 80
      or coalesce(char_length(btrim(details->>'description')), 0) not between 20 and 2000
      or not isfinite(start_time) or not isfinite(end_time)
      or coalesce(details->>'setting', '') not in ('indoor', 'outdoor', 'mixed')
      or exists (
        select 1 from unnest(array['title','description','equipment','guidelines']) as field
        where jsonb_typeof(details->field) is distinct from 'string'
      )
      or exists (
        select 1 from unnest(array['beginnerFriendly','travellerFriendly']) as field
        where jsonb_typeof(details->field) is distinct from 'boolean'
      )
      or jsonb_typeof(details->'price') is distinct from 'number'
      or (details->>'price')::numeric not between 0 and 10000
      or jsonb_typeof(details->'coverVariant') is distinct from 'number'
      or coalesce(jsonb_typeof(details->'minParticipants'), '') not in ('number', 'null')
      or jsonb_typeof(details->'venue') is distinct from 'object'
      or coalesce(details->'venue'->>'quadrant', '') not in ('NW','NE','SW','SE')
      or jsonb_typeof(details->'venue'->'approximate') is distinct from 'boolean'
      or exists (
        select 1 from unnest(array['name','area','privateDetails']) as field
        where jsonb_typeof(details->'venue'->field) is distinct from 'string'
      )
      or exists (
        select 1 from unnest(array['lat','lng']) as field
        where jsonb_typeof(details->'venue'->field) is distinct from 'number'
          or (details->'venue'->>field)::numeric not between -180 and 180
      )
      or exists (
        select 1 from unnest(array['wheelchair','stepFree','accessibleWashroom','quiet','sensoryFriendly','virtual']) as field
        where coalesce(details->'accessibility'->>field, '') not in ('confirmed','unconfirmed','unavailable')
      )
      or coalesce(jsonb_typeof(details->'firstTime'), '') not in ('object', 'null')
      or (jsonb_typeof(details->'firstTime') = 'object' and (
        jsonb_typeof(details->'firstTime'->'bringAFriend') is distinct from 'boolean'
        or exists (
          select 1 from unnest(array['whatToExpect','whatToBring','experienceNeeded','howToFindUs']) as field
          where jsonb_typeof(details->'firstTime'->field) is distinct from 'string'
        )
      ))
      or seats < (select count(*) from tandem.registrations where event_id = event_key and left_at is null)
    then raise exception 'Check the event details and available capacity.'; end if;
    if action = 'create' then perform event_key::uuid; end if;
    details := details - 'cancelReason' || jsonb_build_object(
      'startsAt', start_time, 'endsAt', end_time, 'capacity', seats, 'groupId', group_key, 'seriesId', null,
      'id', event_key, 'hostId', actor, 'status', 'scheduled', 'baseAttendeeCount', 0, 'isDemo', false,
      'createdAt', coalesce(event_row.data->'createdAt', to_jsonb(at_time)), 'updatedAt', at_time
    );
    if action = 'create' then
      insert into tandem.events values (event_key, actor, group_key, start_time, end_time, seats, false, details);
      insert into tandem.messages (event_id, kind, body) values (event_key, 'system', 'The host created this event.');
    else
      update tandem.events set group_id = group_key, starts_at = start_time,
        ends_at = end_time, capacity = seats, data = details where id = event_key;
      insert into tandem.messages (event_id, kind, body) values (event_key, 'system', 'The host updated the event details.');
    end if;
  else
    if event_row.id is null then raise exception 'That event no longer exists.'; end if;
    select * into reg from tandem.registrations where event_id = event_key and user_id = actor;
    case action
      when 'join' then
        if event_row.host_id = actor or event_row.cancelled or at_time >= event_row.starts_at then
          raise exception 'You can’t join this event.';
        end if;
        if reg.user_id is not null and reg.left_at is null then return; end if;
        if event_row.capacity <= (select count(*) from tandem.registrations where event_id = event_key and left_at is null)
          then raise exception 'Sorry, this event is full.'; end if;
        insert into tandem.registrations (event_id, user_id, joined_at) values (event_key, actor, at_time)
        on conflict (event_id, user_id) do update set left_at = null, joined_at = excluded.joined_at;
        insert into tandem.messages (event_id, kind, body) values (event_key, 'system', 'An attendee joined the event.');
      when 'leave' then
        if reg.user_id is null or reg.left_at is not null then return; end if;
        if reg.checked_in_at is not null or (not event_row.cancelled and at_time > event_row.ends_at) then
          raise exception 'You can’t leave after confirming attendance or after the event has ended.';
        end if;
        update tandem.registrations set left_at = at_time where event_id = event_key and user_id = actor;
        insert into tandem.messages (event_id, kind, body) values (event_key, 'system', 'An attendee left the event.');
      when 'check_in' then
        if reg.user_id is null or reg.left_at is not null or event_row.cancelled
          or at_time < event_row.starts_at - interval '1 hour'
          or at_time > event_row.ends_at + interval '336 hours' then
          raise exception 'Registered attendees can check in from one hour before to 14 days after the event.';
        end if;
        if reg.checked_in_at is not null then return; end if;
        update tandem.registrations set checked_in_at = at_time where event_id = event_key and user_id = actor;
      when 'cancel' then
        if event_row.host_id <> actor or at_time > event_row.ends_at then raise exception 'You can’t cancel this event.'; end if;
        if event_row.cancelled then return; end if;
        update tandem.events set cancelled = true, data = data || jsonb_build_object(
          'status', 'cancelled', 'cancelReason', left(btrim(coalesce(details->>'reason', '')), 500), 'updatedAt', at_time
        ) where id = event_key;
        insert into tandem.messages (event_id, kind, body) values (event_key, 'system', 'The host cancelled this event.');
      else raise exception 'Unknown event action.';
    end case;
  end if;
  perform tandem.ensure_profile(actor);
  perform tandem.notify();
end;
$$;

create function public.tandem_create_group(name text, description text, category text, quadrant text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  group_key uuid := gen_random_uuid();
begin
  if actor is null then raise exception 'Please sign in first.'; end if;
  if coalesce(char_length(btrim(name)), 0) not between 1 and 80
    or coalesce(char_length(btrim(description)), 0) not between 1 and 1000
    or coalesce(quadrant, '') not in ('NW','NE','SW','SE')
    or coalesce(category, '') not in (
      'running','fitness','cycling','hiking','reading','movies','music','art','tech','games',
      'food','volunteering','photography','language','culture','study','sports','meetups'
    )
  then raise exception 'Check the group details.'; end if;
  insert into tandem.groups values (group_key, actor, jsonb_build_object(
    'id', group_key, 'name', btrim(name), 'description', btrim(description), 'categoryId', category,
    'organizerId', actor, 'quadrant', quadrant, 'area', quadrant || ' Calgary',
    'guidelines', jsonb_build_array('Treat other members with respect.'), 'coverVariant', 0,
    'baseMemberCount', 0, 'createdAt', now(), 'isDemo', false
  ));
  insert into tandem.memberships (group_id, user_id) values (group_key, actor);
  perform tandem.ensure_profile(actor);
  perform tandem.notify();
  return group_key;
end;
$$;

create function public.tandem_membership(group_key uuid, joining boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  organizer uuid;
begin
  if actor is null then raise exception 'Please sign in first.'; end if;
  select organizer_id into organizer from tandem.groups where id = group_key for update;
  if organizer is null then raise exception 'That group no longer exists.'; end if;
  if joining then
    insert into tandem.memberships (group_id, user_id) values (group_key, actor) on conflict do nothing;
  else
    if organizer = actor then raise exception 'Organizers can’t leave their own group.'; end if;
    delete from tandem.memberships where group_id = group_key and user_id = actor;
  end if;
  if found then
    perform tandem.ensure_profile(actor);
    perform tandem.notify();
  end if;
end;
$$;

create function public.tandem_post(message_key uuid, event_key text, group_key uuid, content text, announcement boolean default false)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  event_row tandem.events%rowtype;
begin
  if actor is null then raise exception 'Please sign in first.'; end if;
  if num_nonnulls(event_key, group_key) <> 1 then raise exception 'Select a chat.'; end if;
  content := regexp_replace(coalesce(content, ''), '^[[:space:]]+|[[:space:]]+$', '', 'g');
  if char_length(content) not between 1 and 1000 then raise exception 'Write a message of up to 1,000 characters.'; end if;
  if event_key is not null then
    select * into event_row from tandem.events where id = event_key for update;
    if not tandem.can_chat(event_key, actor) then raise exception 'Join this event to chat.'; end if;
    if event_row.cancelled or clock_timestamp() > event_row.ends_at then raise exception 'This chat is read-only.'; end if;
    if announcement and event_row.host_id <> actor then raise exception 'Only the host can post announcements.'; end if;
  else
    perform 1 from tandem.groups where id = group_key for update;
    if announcement or not exists (
      select 1 from tandem.memberships where group_id = group_key and user_id = actor
    ) then raise exception 'Join this group to post.'; end if;
  end if;
  insert into tandem.messages (id, event_id, group_id, author_id, kind, body)
  values (message_key, event_key, group_key, actor, case when announcement then 'announcement' else 'message' end, content)
  on conflict (id) do nothing;
  if found then
    perform tandem.ensure_profile(actor);
    perform tandem.notify();
  end if;
end;
$$;

create function public.tandem_delete_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  delete from auth.users where id = auth.uid();
  if found then perform tandem.notify(); end if;
end;
$$;

revoke execute on function public.tandem_snapshot(text), public.tandem_profile(text, boolean),
  public.tandem_event(text, text, jsonb), public.tandem_create_group(text, text, text, text),
  public.tandem_membership(uuid, boolean), public.tandem_post(uuid, text, uuid, text, boolean),
  public.tandem_delete_account() from public, anon, authenticated;
grant execute on function public.tandem_snapshot(text) to anon, authenticated;
grant execute on function public.tandem_profile(text, boolean), public.tandem_event(text, text, jsonb),
  public.tandem_create_group(text, text, text, text), public.tandem_membership(uuid, boolean),
  public.tandem_post(uuid, text, uuid, text, boolean), public.tandem_delete_account() to authenticated;
