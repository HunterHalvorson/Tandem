-- Run with psql -v ON_ERROR_STOP=1 against a disposable database with the migration applied.
begin;
insert into auth.users (id) values
  ('10000000-0000-4000-8000-000000000001'),
  ('10000000-0000-4000-8000-000000000002'),
  ('10000000-0000-4000-8000-000000000003'),
  ('10000000-0000-4000-8000-000000000004');

create function pg_temp.assert_true(result boolean, description text) returns void language plpgsql as $$
begin
  if result is distinct from true then raise exception 'Assertion failed: %', description; end if;
end;
$$;

create function pg_temp.expect_error(command text, expected text) returns void language plpgsql as $$
begin
  execute command;
  raise exception 'Expected error: %', expected;
exception when others then
  if sqlerrm <> expected then raise; end if;
end;
$$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select public.tandem_create_group('Test running group', 'Run together in Calgary', 'running', 'NW') as group_id \gset
select public.tandem_event('create', '20000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'hostId', '10000000-0000-4000-8000-000000000002', 'groupId', :'group_id', 'title', 'Test run',
    'description', 'Meet in Calgary for a community run.', 'startsAt', now() + interval '30 minutes',
    'endsAt', now() + interval '90 minutes', 'capacity', 2, 'categoryId', 'running', 'coverVariant', 0,
    'price', 0, 'minParticipants', null, 'visibility', 'private', 'setting', 'outdoor',
    'beginnerFriendly', true, 'travellerFriendly', true, 'equipment', '', 'guidelines', '',
    'venue', '{"name":"Test venue","area":"Calgary","quadrant":"NW","lat":51,"lng":-114,"approximate":true,"privateDetails":"Meet at the back gate"}'::jsonb,
    'firstTime', '{"whatToExpect":"","whatToBring":"","experienceNeeded":"","howToFindUs":"Find the yellow door","bringAFriend":true}'::jsonb,
    'accessibility', '{"wheelchair":"unconfirmed","stepFree":"unconfirmed","accessibleWashroom":"unconfirmed","quiet":"unconfirmed","sensoryFriendly":"unconfirmed","virtual":"unconfirmed"}'::jsonb
  ));
select public.tandem_post('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', null, 'Host announcement', true);
select public.tandem_post('30000000-0000-4000-8000-000000000002', null, :'group_id', 'Members only');
select pg_temp.expect_error(format('select public.tandem_membership(%L, false)', :'group_id'), 'Organizers can’t leave their own group.');

set local role anon;
select set_config('request.jwt.claims', '{}', true);
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'events') = 0, 'unlisted event absent from catalog');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'groupMessages') = 0, 'signed-out group discussion access denied');
select pg_temp.assert_true(
  public.tandem_snapshot('20000000-0000-4000-8000-000000000001')->'events'->0->'venue'->>'privateDetails' = ''
  and public.tandem_snapshot('20000000-0000-4000-8000-000000000001')->'events'->0->'firstTime'->>'howToFindUs' = ''
  and public.tandem_snapshot('20000000-0000-4000-8000-000000000001')->'events'->0->>'hostId' = '10000000-0000-4000-8000-000000000001',
  'linked event redacts private details and takes identity from Auth');
select pg_temp.expect_error($$select public.tandem_event('join', '20000000-0000-4000-8000-000000000001')$$, 'permission denied for function tandem_event');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000002"}', true);
select pg_temp.expect_error(
  $$select public.tandem_post('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', null, 'Outsider')$$,
  'Join this event to chat.');
select pg_temp.expect_error(
  format('select public.tandem_post(gen_random_uuid(), null, %L, %L)', :'group_id', 'Outsider'),
  'Join this group to post.');
select pg_temp.expect_error($$select public.tandem_event('check_in', '20000000-0000-4000-8000-000000000001')$$,
  'Registered attendees can check in from one hour before to 14 days after the event.');
select public.tandem_membership(:'group_id', true);
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'groupMessages') = 1, 'member can read discussion');
select public.tandem_membership(:'group_id', false);
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'groupMessages') = 0, 'leaving revokes discussion access');
select public.tandem_event('join', '20000000-0000-4000-8000-000000000001');
select public.tandem_event('join', '20000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'registrations') = 1, 'repeat RSVP is idempotent');
select pg_temp.assert_true(
  public.tandem_snapshot()->'events'->0->'venue'->>'privateDetails' = 'Meet at the back gate'
  and jsonb_array_length(public.tandem_snapshot()->'messages') = 3,
  'attendee sees private details and event chat');
select pg_temp.expect_error(
  $$select public.tandem_post(gen_random_uuid(), '20000000-0000-4000-8000-000000000001', null, 'Fake announcement', true)$$,
  'Only the host can post announcements.');
select public.tandem_post('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', null, 'See you there');
select public.tandem_post('30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', null, 'See you there');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'messages') = 4, 'message retry is idempotent');
select public.tandem_event('check_in', '20000000-0000-4000-8000-000000000001');
select public.tandem_event('check_in', '20000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(public.tandem_snapshot()->'eventCounts'->'20000000-0000-4000-8000-000000000001'->>'attended' = '1', 'attendance counted once');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003"}', true);
select public.tandem_event('join', '20000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'registrations') = 1, 'other attendees are private by default');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004"}', true);
select pg_temp.expect_error($$select public.tandem_event('join', '20000000-0000-4000-8000-000000000001')$$, 'Sorry, this event is full.');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot('20000000-0000-4000-8000-000000000001')->'messages') = 0,
  'outsider cannot read event messages by supplying the event ID');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000003"}', true);
select public.tandem_event('leave', '20000000-0000-4000-8000-000000000001');
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot('20000000-0000-4000-8000-000000000001')->'messages') = 0,
  'leaving an event revokes chat access');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000004"}', true);
select public.tandem_event('join', '20000000-0000-4000-8000-000000000001');
select pg_temp.expect_error($$select public.tandem_event('cancel', '20000000-0000-4000-8000-000000000001')$$, 'You can’t cancel this event.');

select set_config('request.jwt.claims', '{"sub":"10000000-0000-4000-8000-000000000001"}', true);
select public.tandem_event('cancel', '20000000-0000-4000-8000-000000000001', '{"reason":"Weather"}');
select pg_temp.expect_error(
  $$select public.tandem_post(gen_random_uuid(), '20000000-0000-4000-8000-000000000001', null, 'Cancelled chat')$$,
  'This chat is read-only.');
select pg_temp.assert_true((select revision > 0 from public.tandem_revision), 'writes advance the Realtime revision');
select public.tandem_delete_account();
select pg_temp.assert_true(jsonb_array_length(public.tandem_snapshot()->'groups') = 0
  and jsonb_array_length(public.tandem_snapshot()->'events') = 0, 'account deletion cascades to events and groups');

rollback;
