begin;
create extension if not exists pgtap with schema extensions;
select plan(20);

select ok(has_table_privilege('authenticated', 'public.profiles', 'SELECT'), 'authenticated can select profiles subject to RLS');
select ok(has_column_privilege('authenticated', 'public.profiles', 'display_name', 'UPDATE'), 'display_name is updateable');
select isnt(has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE'), true, 'profile id is not updateable');
select isnt(has_column_privilege('authenticated', 'public.profiles', 'created_at', 'UPDATE'), true, 'profile created_at is not updateable');
select isnt(has_column_privilege('authenticated', 'public.profiles', 'updated_at', 'UPDATE'), true, 'profile updated_at is not directly updateable');
select isnt(has_table_privilege('authenticated', 'public.profiles', 'INSERT'), true, 'profiles cannot be directly inserted');
select isnt(has_table_privilege('authenticated', 'public.profiles', 'DELETE'), true, 'profiles cannot be directly deleted');

select ok(has_column_privilege('authenticated', 'public.organizations', 'name', 'UPDATE'), 'treasurer may update name subject to RLS');
select isnt(has_column_privilege('authenticated', 'public.organizations', 'id', 'UPDATE'), true, 'organization id is not updateable');
select isnt(has_column_privilege('authenticated', 'public.organizations', 'created_by', 'UPDATE'), true, 'created_by is not updateable');
select isnt(has_table_privilege('authenticated', 'public.organizations', 'INSERT'), true, 'organizations cannot be directly inserted');
select isnt(has_table_privilege('authenticated', 'public.organizations', 'DELETE'), true, 'organizations cannot be directly deleted');

select ok(has_table_privilege('authenticated', 'public.organization_memberships', 'SELECT'), 'users can select their own membership subject to RLS');
select isnt(has_table_privilege('authenticated', 'public.organization_memberships', 'INSERT'), true, 'memberships cannot be directly inserted');
select isnt(has_table_privilege('authenticated', 'public.organization_memberships', 'UPDATE'), true, 'memberships cannot be directly updated');
select isnt(has_table_privilege('authenticated', 'public.organization_memberships', 'DELETE'), true, 'memberships cannot be directly deleted');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'INSERT'), true, 'audit events cannot be inserted');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), true, 'audit events cannot be updated');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'DELETE'), true, 'audit events cannot be deleted');
select ok(has_table_privilege('authenticated', 'public.audit_events', 'SELECT'), 'treasurer may select audit events subject to RLS');

select * from finish();
rollback;
