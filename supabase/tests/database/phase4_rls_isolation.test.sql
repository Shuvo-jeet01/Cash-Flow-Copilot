begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('00000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@example.test', '', now(), now(), now(), '{}', '{}'),
  ('00000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.organizations (id, name, created_by) values
  ('10000000-0000-4000-8000-000000000001', 'Organization A', '00000000-0000-4000-8000-000000000001'),
  ('20000000-0000-4000-8000-000000000002', 'Organization B', '00000000-0000-4000-8000-000000000002'),
  ('30000000-0000-4000-8000-000000000003', 'Organization C', '00000000-0000-4000-8000-000000000002');

insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000002', 'treasurer', 'active'),
  ('30000000-0000-4000-8000-000000000003', '00000000-0000-4000-8000-000000000002', 'treasurer', 'active'),
  ('20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'member', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select results_eq('select name from public.organizations order by name', array['Organization A', 'Organization B'], 'multi-org user sees only their two organizations');
select results_eq($$select name from public.organizations where id = '10000000-0000-4000-8000-000000000001'$$, array['Organization A'], 'selected organization A is visible');
select results_eq($$select name from public.organizations where id = '20000000-0000-4000-8000-000000000002'$$, array['Organization B'], 'selected organization B is visible');
select is((select count(*)::integer from public.organizations where id = '30000000-0000-4000-8000-000000000003'), 0, 'another organization URL context is rejected');
select is((select count(*)::integer from public.organization_memberships), 2, 'user sees only their own memberships');
select throws_ok($$update public.organizations set created_by = '00000000-0000-4000-8000-000000000002' where id = '10000000-0000-4000-8000-000000000001'$$, '42501', null, 'system organization columns cannot be manipulated');
select throws_ok($$insert into public.organization_memberships (organization_id, user_id, role) values ('10000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'treasurer')$$, '42501', null, 'membership context cannot be injected');

reset role;
update public.organization_memberships set status = 'revoked' where organization_id = '10000000-0000-4000-8000-000000000001' and user_id = '00000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select is((select count(*)::integer from public.organizations where id = '10000000-0000-4000-8000-000000000001'), 0, 'revocation immediately removes organization access');
select is((select count(*)::integer from public.organizations where id = '20000000-0000-4000-8000-000000000002'), 1, 'other selected active organization remains accessible');
select results_eq($$update public.organizations set name = 'Blocked' where id = '10000000-0000-4000-8000-000000000001' returning id$$, array[]::uuid[], 'revoked membership cannot update organization');
select is((select count(*)::integer from public.audit_events where organization_id = '10000000-0000-4000-8000-000000000001'), 0, 'revoked user cannot read prior organization audit');
select isnt(has_function_privilege('anon', 'private.is_active_member(uuid)', 'EXECUTE'), true, 'anon cannot execute private membership helper');
select ok(has_schema_privilege('authenticated', 'private', 'USAGE'), 'authenticated may resolve private helpers used by RLS');
select isnt(has_schema_privilege('anon', 'private', 'USAGE'), true, 'anon cannot resolve private helpers');

select * from finish();
rollback;
