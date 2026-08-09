begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budget-treasurer@example.test', '', now(), now(), now(), '{}', '{}'),
  ('82000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budget-president@example.test', '', now(), now(), now(), '{}', '{}'),
  ('83000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budget-executive@example.test', '', now(), now(), now(), '{}', '{}'),
  ('84000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'budget-member@example.test', '', now(), now(), now(), '{}', '{}'),
  ('85000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-treasurer@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.organizations (id, name, created_by) values
  ('86000000-0000-4000-8000-000000000001', 'Budget Test Organization', '81000000-0000-4000-8000-000000000001'),
  ('87000000-0000-4000-8000-000000000002', 'Other Budget Organization', '85000000-0000-4000-8000-000000000005');
insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('86000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('86000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 'president', 'active'),
  ('86000000-0000-4000-8000-000000000001', '83000000-0000-4000-8000-000000000003', 'executive', 'active'),
  ('86000000-0000-4000-8000-000000000001', '84000000-0000-4000-8000-000000000004', 'member', 'active'),
  ('87000000-0000-4000-8000-000000000002', '85000000-0000-4000-8000-000000000005', 'treasurer', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok($$select public.configure_financial_context('86000000-0000-4000-8000-000000000001', 'America/Chicago')$$, 'treasurer configures financial context');
select lives_ok($$select public.create_transaction_category('86000000-0000-4000-8000-000000000001', 'Budget Income', 'income')$$, 'treasurer creates an income category');

select lives_ok($$
  select public.create_organization_budget(
    '86000000-0000-4000-8000-000000000001', '2026 Annual Plan', '2026-01-01', '2026-12-31', 'USD',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'category_id', (select id from public.transaction_categories where name = 'Budget Income'),
      'amount_minor', '100000'
    )), 'Initial approved planning draft', '88000000-0000-4000-8000-000000000001'
  )
$$, 'treasurer creates a draft budget');
select lives_ok($$
  select public.create_organization_budget(
    '86000000-0000-4000-8000-000000000001', '2026 Annual Plan', '2026-01-01', '2026-12-31', 'USD',
    '[]'::jsonb, 'Retry is idempotent', '88000000-0000-4000-8000-000000000001'
  )
$$, 'same creation request is idempotent');
select is((select count(*)::integer from public.organization_budgets), 1, 'idempotent retry creates one budget');
select is((select count(*)::integer from public.budget_allocations), 1, 'draft stores one allocation');
select is((select created_by from public.organization_budgets limit 1), '81000000-0000-4000-8000-000000000001'::uuid, 'budget creator is derived from auth uid');
select lives_ok($$
  select public.activate_budget(
    '86000000-0000-4000-8000-000000000001',
    (select id from public.organization_budgets limit 1), 1,
    'Officers approved the annual plan', '88000000-0000-4000-8000-000000000002'
  )
$$, 'treasurer activates a draft');
select is((select status::text from public.organization_budgets limit 1), 'active', 'budget is active');
select is((select status::text from public.budget_revisions limit 1), 'effective', 'first revision is effective');
select lives_ok($$
  select public.revise_active_budget(
    '86000000-0000-4000-8000-000000000001',
    (select id from public.organization_budgets limit 1), 2,
    '2026 Annual Plan Revised', '2026-01-01', '2026-12-31', 'USD',
    pg_catalog.jsonb_build_array(pg_catalog.jsonb_build_object(
      'category_id', (select id from public.transaction_categories where name = 'Budget Income'),
      'amount_minor', '120000'
    )), 'Approved income target revision', '88000000-0000-4000-8000-000000000003'
  )
$$, 'treasurer creates an immutable approved revision');
select is((select count(*)::integer from public.budget_revisions), 2, 'both revisions are retained');
select is((select count(*)::integer from public.budget_revisions where status = 'superseded'), 1, 'old revision is superseded');
select is((select count(*)::integer from public.budget_revisions where status = 'effective'), 1, 'exactly one revision remains effective');

select lives_ok($$
  select public.create_organization_budget(
    '86000000-0000-4000-8000-000000000001', 'Overlapping Plan', '2026-06-01', '2027-05-31', 'USD',
    '[]'::jsonb, 'Create overlap test draft', '88000000-0000-4000-8000-000000000004'
  )
$$, 'overlapping period may remain a draft');
select throws_ok($$
  select public.activate_budget(
    '86000000-0000-4000-8000-000000000001',
    (select id from public.organization_budgets where status = 'draft'), 1,
    'Attempt overlapping activation', '88000000-0000-4000-8000-000000000005'
  )
$$, '23P01', null, 'effective budget periods cannot overlap');

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.organization_budgets), 2, 'president reads organization budgets');
select throws_ok($$select public.close_budget('86000000-0000-4000-8000-000000000001', (select id from public.organization_budgets where status = 'active'), 3, 'President cannot close', '88000000-0000-4000-8000-000000000006')$$, '42501', null, 'president cannot mutate budgets');

select set_config('request.jwt.claim.sub', '83000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.organization_budgets), 2, 'executive reads organization budgets');
select is((select count(*)::integer from public.audit_events where target_type in ('organization_budget', 'budget_revision')), 0, 'executive cannot read budget audit events');

select set_config('request.jwt.claim.sub', '84000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.organization_budgets), 0, 'member cannot read budgets');
select throws_ok($$select public.create_organization_budget('86000000-0000-4000-8000-000000000001', 'Blocked', '2027-01-01', '2027-12-31', 'USD', '[]', 'Member is blocked', '88000000-0000-4000-8000-000000000007')$$, '42501', null, 'member cannot create budgets');

select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.create_organization_budget('87000000-0000-4000-8000-000000000002', 'Cross tenant', '2027-01-01', '2027-12-31', 'USD', '[]', 'Cross tenant blocked', '88000000-0000-4000-8000-000000000008')$$, '42501', null, 'URL or request body organization cannot cross tenants');

reset role;
update public.organization_memberships set status = 'revoked'
where organization_id = '86000000-0000-4000-8000-000000000001'
  and user_id = '81000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::integer from public.organization_budgets), 0, 'revoked treasurer immediately loses budget reads');
select throws_ok($$select public.create_organization_budget('86000000-0000-4000-8000-000000000001', 'Revoked', '2027-01-01', '2027-12-31', 'USD', '[]', 'Revoked actor blocked', '88000000-0000-4000-8000-000000000009')$$, '42501', null, 'revoked treasurer immediately loses workflows');

select * from finish();
rollback;
