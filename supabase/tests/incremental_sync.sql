-- Run in the same transaction as the migration; every test change is rolled back.
insert into auth.users (id, email) values
  ('00000000-0000-4000-a000-000000000001', 'suite-audit-one@example.invalid'),
  ('00000000-0000-4000-a000-000000000002', 'suite-audit-two@example.invalid');
insert into public.goy_app_state(user_id, state) values
  ('00000000-0000-4000-a000-000000000001', '{"workouts":[{"id":"original","weight":80}],"keepSlopping":{"meals":[{"id":"meal-original"}]}}'),
  ('00000000-0000-4000-a000-000000000002', '{"private":"other-account"}');

set local role authenticated;
set local request.jwt.claims = '{"sub":"00000000-0000-4000-a000-000000000001","role":"authenticated"}';

do $$
declare result jsonb;
begin
  if (select count(*) from public.goy_app_state) <> 1 then raise exception 'RLS leaked another account'; end if;
  perform public.patch_goy_app_state(null, '00000000-0000-4000-a000-000000000001', '{"cardioEnabled":false}',
    '{"workouts":{"upsert":[{"id":"new-workout","weight":90}],"remove":[]}}');
  perform public.patch_goy_app_state(null, '00000000-0000-4000-a000-000000000001', '{}',
    '{"workouts":{"upsert":[{"id":"original","weight":85}],"remove":[]}}');
  select state into result from public.goy_app_state;
  if jsonb_array_length(result->'workouts') <> 2 then raise exception 'Unrelated history was lost'; end if;
  if result->'workouts'->0->>'weight' <> '85' then raise exception 'Record update failed'; end if;
  if result->'keepSlopping'->'meals'->0->>'id' <> 'meal-original' then raise exception 'Other app data changed'; end if;

  perform public.patch_goy_app_state('keepSlopping', '00000000-0000-4000-a000-000000000001', '{}',
    '{"sessions":{"upsert":[{"id":"device-one","date":"2026-09-05","mealId":"meal-original","completed":false}],"remove":[]}}');
  perform public.patch_goy_app_state('keepSlopping', '00000000-0000-4000-a000-000000000001', '{}',
    '{"sessions":{"upsert":[{"id":"device-two","date":"2026-09-05","mealId":"meal-original","completed":true}],"remove":[]},"creatineDates":{"upsert":["2026-09-05"],"remove":[]}}');
  select state into result from public.goy_app_state;
  if jsonb_array_length(result->'keepSlopping'->'sessions') <> 1 then raise exception 'Meal counted twice'; end if;
  if result->'keepSlopping'->'sessions'->0->>'completed' <> 'true' then raise exception 'Meal update failed'; end if;
  if jsonb_array_length(result->'workouts') <> 2 then raise exception 'Meal patch changed workouts'; end if;

  perform public.patch_goy_app_state(null, '00000000-0000-4000-a000-000000000001', '{}',
    '{"workouts":{"upsert":[],"remove":["original"]}}');
  select state into result from public.goy_app_state;
  if result->'workouts' <> '[{"id":"new-workout","weight":90}]'::jsonb then raise exception 'Scoped deletion failed'; end if;
  if public.get_goy_app_state_sections(array['cardioEnabled']) <> '{"cardioEnabled":false}'::jsonb then raise exception 'Section query failed'; end if;

  begin
    perform public.patch_goy_app_state(null, '00000000-0000-4000-a000-000000000002', '{}', '{}');
    raise exception 'Expected account mismatch rejection';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.goy_app_state(user_id, state) values ('00000000-0000-4000-a000-000000000002','{}');
    raise exception 'Expected cross-account insert rejection';
  exception when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set local role anon;
do $$
begin
  begin
    perform public.get_goy_app_state_sections(array['workouts']);
    raise exception 'Anonymous RPC access should be denied';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;
rollback;
