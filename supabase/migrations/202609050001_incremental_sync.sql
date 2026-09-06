begin;

create or replace function public.goy_entity_key(collection text, item jsonb)
returns text language sql immutable security invoker set search_path = '' as $$
  select case collection
    when 'creatineDates' then item #>> '{}'
    when 'sessions' then (item ->> 'date') || '::' || (item ->> 'mealId')
    else item ->> 'id'
  end;
$$;

create or replace function public.patch_goy_app_state(
  p_section_key text,
  p_expected_user_id uuid,
  p_patch jsonb,
  p_changes jsonb
)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  owner uuid := auth.uid();
  stored jsonb;
  section jsonb;
  next_section jsonb;
  entry record;
  allowed text[];
  collection_names text[];
  merged jsonb;
begin
  if owner is null or p_expected_user_id is distinct from owner then
    raise exception 'Account changed. Please reload.' using errcode = '42501';
  end if;
  if p_section_key is null then
    allowed := array['routines', 'routineRotation', 'workouts', 'activeWorkout', 'cardioEnabled'];
    collection_names := array['routines', 'workouts'];
  elsif p_section_key = 'keepSlopping' then
    allowed := array['planVersion', 'target', 'creatineDates', 'meals', 'sessions'];
    collection_names := array['creatineDates', 'meals', 'sessions'];
  else
    raise exception 'Invalid app section';
  end if;
  if jsonb_typeof(p_patch) is distinct from 'object' or jsonb_typeof(p_changes) is distinct from 'object' then
    raise exception 'Changes must be objects';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where not (k = any(allowed)))
    or exists (select 1 from jsonb_object_keys(p_changes) k where not (k = any(collection_names))) then
    raise exception 'Invalid state key';
  end if;
  if exists (select 1 from jsonb_object_keys(p_patch) k where k = any(collection_names)) then
    raise exception 'Use collection changes for lists';
  end if;

  insert into public.goy_app_state (user_id, state) values (owner, '{}'::jsonb)
    on conflict (user_id) do nothing;
  select state into stored from public.goy_app_state where user_id = owner for update;
  section := case when p_section_key is null then stored else coalesce(stored -> p_section_key, '{}'::jsonb) end;
  next_section := section || p_patch;

  for entry in select key, value from jsonb_each(p_changes) loop
    if jsonb_typeof(entry.value -> 'upsert') is distinct from 'array'
      or jsonb_typeof(entry.value -> 'remove') is distinct from 'array' then
      raise exception 'Invalid collection changes';
    end if;
    if exists (select 1 from jsonb_array_elements(entry.value -> 'upsert') item
        where coalesce(public.goy_entity_key(entry.key, item), '') = '') then
      raise exception 'Missing record key';
    end if;
    if exists (select 1 from jsonb_array_elements(entry.value -> 'upsert') item
        group by public.goy_entity_key(entry.key, item) having count(*) > 1) then
      raise exception 'Duplicate record keys';
    end if;
    with replacements as (
      select public.goy_entity_key(entry.key, item) as id, item, ord
      from jsonb_array_elements(entry.value -> 'upsert') with ordinality as changes(item, ord)
    ), existing as (
      select public.goy_entity_key(entry.key, item) as id, item, ord
      from jsonb_array_elements(coalesce(section -> entry.key, '[]'::jsonb)) with ordinality as saved(item, ord)
    ), combined as (
      select coalesce(r.item, e.item) as item, 0 as bucket, e.ord
      from existing e left join replacements r on e.id = r.id
      where not exists (select 1 from jsonb_array_elements_text(entry.value -> 'remove') d where d = e.id)
      union all
      select r.item, 1, r.ord from replacements r
      where not exists (select 1 from existing e where e.id = r.id)
    )
    select coalesce(jsonb_agg(item order by bucket, ord), '[]'::jsonb) into merged from combined;
    next_section := jsonb_set(next_section, array[entry.key], merged, true);
  end loop;

  if p_section_key is not null then
    next_section := jsonb_set(stored, array[p_section_key], next_section, true);
  end if;
  if stored is distinct from next_section then
    update public.goy_app_state set state = next_section, updated_at = now() where user_id = owner;
  end if;
end;
$$;

create or replace function public.get_goy_app_state_sections(p_keys text[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(keys.key, app.state -> keys.key), '{}'::jsonb)
  from public.goy_app_state app
  cross join unnest(coalesce(p_keys, '{}'::text[])) keys(key)
  where app.user_id = (select auth.uid()) and app.state ? keys.key;
$$;

revoke all on function public.goy_entity_key(text, jsonb) from public, anon;
revoke all on function public.patch_goy_app_state(text, uuid, jsonb, jsonb) from public, anon;
revoke all on function public.get_goy_app_state_sections(text[]) from public, anon;
revoke all on function public.merge_goy_app_state(jsonb, text[]) from public, anon;
revoke all on function public.merge_goy_app_state_section(text, jsonb, text[]) from public, anon;
revoke all on public.goy_app_state from anon;
grant execute on function public.goy_entity_key(text, jsonb) to authenticated;
grant execute on function public.patch_goy_app_state(text, uuid, jsonb, jsonb) to authenticated;

alter policy "Users can read their own state" on public.goy_app_state using ((select auth.uid()) = user_id);
alter policy "Users can insert their own state" on public.goy_app_state with check ((select auth.uid()) = user_id);
alter policy "Users can update their own state" on public.goy_app_state
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

commit;
