create table if not exists public.goy_app_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.goy_app_state enable row level security;

drop policy if exists "Users can read their own state" on public.goy_app_state;
create policy "Users can read their own state"
  on public.goy_app_state
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert their own state" on public.goy_app_state;
create policy "Users can insert their own state"
  on public.goy_app_state
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own state" on public.goy_app_state;
create policy "Users can update their own state"
  on public.goy_app_state
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.get_goy_app_state_sections(p_keys text[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_object_agg(entry.key, entry.value), '{}'::jsonb)
  from public.goy_app_state as app_state
  cross join lateral jsonb_each(app_state.state) as entry
  where app_state.user_id = auth.uid()
    and entry.key = any(coalesce(p_keys, '{}'::text[]));
$$;

create or replace function public.merge_goy_app_state(
  p_patch jsonb,
  p_remove_keys text[] default '{}'::text[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  remove_keys text[] := coalesce(p_remove_keys, '{}'::text[]);
  normalized_patch jsonb := coalesce(p_patch, '{}'::jsonb) - remove_keys;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if jsonb_typeof(normalized_patch) <> 'object' then
    raise exception 'State patch must be a JSON object';
  end if;

  insert into public.goy_app_state as current_state (user_id, state, updated_at)
  values (current_user_id, normalized_patch, now())
  on conflict (user_id) do update
  set state = (current_state.state || excluded.state) - remove_keys,
      updated_at = now();
end;
$$;

create or replace function public.merge_goy_app_state_section(
  p_section_key text,
  p_patch jsonb,
  p_remove_keys text[] default '{}'::text[]
)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  remove_keys text[] := coalesce(p_remove_keys, '{}'::text[]);
  normalized_patch jsonb := coalesce(p_patch, '{}'::jsonb) - remove_keys;
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;

  if coalesce(p_section_key, '') = '' then
    raise exception 'Section key is required';
  end if;

  if jsonb_typeof(normalized_patch) <> 'object' then
    raise exception 'Section patch must be a JSON object';
  end if;

  insert into public.goy_app_state as current_state (user_id, state, updated_at)
  values (current_user_id, jsonb_build_object(p_section_key, normalized_patch), now())
  on conflict (user_id) do update
  set state = jsonb_set(
        current_state.state,
        array[p_section_key],
        (
          case
            when jsonb_typeof(current_state.state -> p_section_key) = 'object'
              then current_state.state -> p_section_key
            else '{}'::jsonb
          end || (excluded.state -> p_section_key)
        ) - remove_keys,
        true
      ),
      updated_at = now();
end;
$$;

revoke all on function public.get_goy_app_state_sections(text[]) from public;
revoke all on function public.merge_goy_app_state(jsonb, text[]) from public;
revoke all on function public.merge_goy_app_state_section(text, jsonb, text[]) from public;
grant execute on function public.get_goy_app_state_sections(text[]) to authenticated;
grant execute on function public.merge_goy_app_state(jsonb, text[]) to authenticated;
grant execute on function public.merge_goy_app_state_section(text, jsonb, text[]) to authenticated;
