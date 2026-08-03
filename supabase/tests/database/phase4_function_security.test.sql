begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

select has_function('public', 'create_organization', array['text'], 'organization creation function exists');
select has_function('public', 'ensure_profile', array['text'], 'profile function exists');
select function_privs_are('public', 'create_organization', array['text'], 'authenticated', array['EXECUTE'], 'only authenticated can execute create_organization');
select function_privs_are('public', 'ensure_profile', array['text'], 'authenticated', array['EXECUTE'], 'only authenticated can execute ensure_profile');
select isnt(has_function_privilege('anon', 'public.create_organization(text)', 'EXECUTE'), true, 'anon cannot create organizations');
select isnt(has_function_privilege('anon', 'public.ensure_profile(text)', 'EXECUTE'), true, 'anon cannot ensure profiles');
select isnt(has_function_privilege('public', 'public.create_organization(text)', 'EXECUTE'), true, 'PUBLIC cannot create organizations');
select isnt(has_function_privilege('public', 'public.ensure_profile(text)', 'EXECUTE'), true, 'PUBLIC cannot ensure profiles');
select is((select exists (select 1 from unnest(proconfig) as setting where setting in ('search_path=', 'search_path=""')) from pg_proc where oid = 'public.create_organization(text)'::regprocedure), true, 'create_organization has empty search_path');
select is((select exists (select 1 from unnest(proconfig) as setting where setting in ('search_path=', 'search_path=""')) from pg_proc where oid = 'public.ensure_profile(text)'::regprocedure), true, 'ensure_profile has empty search_path');
select is((select prosecdef from pg_proc where oid = 'public.create_organization(text)'::regprocedure), true, 'create_organization is security definer');
select is((select prosecdef from pg_proc where oid = 'public.ensure_profile(text)'::regprocedure), true, 'ensure_profile is security definer');
select is(to_regprocedure('public.create_organization(text,uuid,text)'), null, 'no organization function accepts user or role');
set local role anon;
select throws_ok('select public.create_organization(''Anonymous org'')', '42501', null, 'anonymous execution is rejected');
reset role;
select throws_ok($$select public.create_organization('Injected', '00000000-0000-4000-8000-000000000001'::uuid, 'treasurer')$$, '42883', null, 'caller cannot pass user id or privileged role');
select is((select count(*)::integer from pg_proc as p join pg_namespace as n on n.oid = p.pronamespace where p.prosecdef and n.nspname in ('public', 'private') and p.proname in ('create_organization', 'ensure_profile', 'is_active_member', 'has_organization_role', 'audit_organization_change', 'audit_membership_change') and not exists (select 1 from unnest(p.proconfig) as setting where setting in ('search_path=', 'search_path=""'))), 0, 'every Phase 4 security definer has an empty search_path');

select * from finish();
rollback;
