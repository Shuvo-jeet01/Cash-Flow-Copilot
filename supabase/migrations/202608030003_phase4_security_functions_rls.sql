create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create function private.is_active_member(requested_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = requested_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'::public.membership_status
  );
$$;

create function private.has_organization_role(
  requested_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_memberships as membership
    where membership.organization_id = requested_organization_id
      and membership.user_id = (select auth.uid())
      and membership.status = 'active'::public.membership_status
      and membership.role = any (allowed_roles)
  );
$$;

revoke all on function private.is_active_member(uuid) from public, anon;
revoke all on function private.has_organization_role(uuid, public.organization_role[]) from public, anon;
grant execute on function private.is_active_member(uuid) to authenticated;
grant execute on function private.has_organization_role(uuid, public.organization_role[]) to authenticated;

create function public.ensure_profile(profile_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := pg_catalog.btrim(profile_display_name);
  result public.profiles;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(normalized_name) not between 1 and 100 then
    raise exception 'Display name must be between 1 and 100 characters' using errcode = '22023';
  end if;

  insert into public.profiles (id, display_name)
  values (caller_id, normalized_name)
  on conflict (id) do nothing;

  select profile.* into result
  from public.profiles as profile
  where profile.id = caller_id;

  return result;
end;
$$;

create function public.create_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  normalized_name text := pg_catalog.btrim(organization_name);
  new_organization_id uuid;
  new_membership_id uuid;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if pg_catalog.char_length(normalized_name) not between 2 and 120 then
    raise exception 'Organization name must be between 2 and 120 characters' using errcode = '22023';
  end if;

  insert into public.organizations (name, created_by)
  values (normalized_name, caller_id)
  returning id into new_organization_id;

  insert into public.organization_memberships (
    organization_id,
    user_id,
    role,
    status
  ) values (
    new_organization_id,
    caller_id,
    'treasurer'::public.organization_role,
    'active'::public.membership_status
  ) returning id into new_membership_id;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    new_organization_id,
    caller_id,
    'organization.created',
    'organization',
    new_organization_id,
    pg_catalog.jsonb_build_object('initial_membership_id', new_membership_id)
  );

  return new_organization_id;
end;
$$;

revoke all on function public.ensure_profile(text) from public, anon;
revoke all on function public.create_organization(text) from public, anon;
grant execute on function public.ensure_profile(text) to authenticated;
grant execute on function public.create_organization(text) to authenticated;

create function private.audit_organization_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if tg_op = 'UPDATE' and old.name is distinct from new.name then
    insert into public.audit_events (
      organization_id, actor_user_id, action, target_type, target_id, metadata
    ) values (
      new.id,
      caller_id,
      'organization.name_changed',
      'organization',
      new.id,
      pg_catalog.jsonb_build_object('previous_name', old.name, 'new_name', new.name)
    );
  end if;
  return new;
end;
$$;

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  source_row public.organization_memberships;
  event_action text;
begin
  if tg_op = 'DELETE' then
    source_row := old;
  else
    source_row := new;
  end if;
  event_action := case
    when tg_op = 'INSERT' then 'membership.created'
    when tg_op = 'DELETE' then 'membership.deleted'
    when old.status is distinct from new.status then 'membership.status_changed'
    when old.role is distinct from new.role then 'membership.role_changed'
    else 'membership.updated'
  end;

  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    source_row.organization_id,
    caller_id,
    event_action,
    'organization_membership',
    source_row.id,
    pg_catalog.jsonb_build_object(
      'role', source_row.role,
      'status', source_row.status
    )
  );
  return source_row;
end;
$$;

revoke all on function private.audit_organization_change() from public, anon, authenticated;
revoke all on function private.audit_membership_change() from public, anon, authenticated;

create trigger organizations_audit_update
after update on public.organizations
for each row execute function private.audit_organization_change();

create trigger memberships_audit_change
after insert or update or delete on public.organization_memberships
for each row execute function private.audit_membership_change();

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.organization_memberships enable row level security;
alter table public.audit_events enable row level security;

create policy profiles_select_own
on public.profiles for select to authenticated
using (id = (select auth.uid()));

create policy profiles_update_own
on public.profiles for update to authenticated
using (id = (select auth.uid()))
with check (id = (select auth.uid()));

create policy organizations_select_active_member
on public.organizations for select to authenticated
using ((select private.is_active_member(id)));

create policy organizations_update_treasurer
on public.organizations for update to authenticated
using ((select private.has_organization_role(id, array['treasurer']::public.organization_role[])))
with check ((select private.has_organization_role(id, array['treasurer']::public.organization_role[])));

create policy memberships_select_own
on public.organization_memberships for select to authenticated
using (user_id = (select auth.uid()));

create policy audit_events_select_treasurer
on public.audit_events for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer']::public.organization_role[]
)));

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_memberships from anon, authenticated;
revoke all on table public.audit_events from anon, authenticated;

grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

grant select on table public.organizations to authenticated;
grant update (name) on table public.organizations to authenticated;

grant select on table public.organization_memberships to authenticated;
grant select on table public.audit_events to authenticated;
