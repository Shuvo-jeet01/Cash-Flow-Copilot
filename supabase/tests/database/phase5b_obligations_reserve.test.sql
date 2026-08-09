begin;
create extension if not exists pgtap with schema extensions;
select plan(33);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('91000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obligation-treasurer@example.test', '', now(), now(), now(), '{}', '{}'),
  ('92000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obligation-president@example.test', '', now(), now(), now(), '{}', '{}'),
  ('93000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obligation-executive@example.test', '', now(), now(), now(), '{}', '{}'),
  ('94000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'obligation-member@example.test', '', now(), now(), now(), '{}', '{}'),
  ('95000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other-obligation@example.test', '', now(), now(), now(), '{}', '{}');
insert into public.organizations (id, name, created_by) values
  ('96000000-0000-4000-8000-000000000001', 'Obligation Test Organization', '91000000-0000-4000-8000-000000000001'),
  ('97000000-0000-4000-8000-000000000002', 'Other Obligation Organization', '95000000-0000-4000-8000-000000000005');
insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('96000000-0000-4000-8000-000000000001', '91000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('96000000-0000-4000-8000-000000000001', '92000000-0000-4000-8000-000000000002', 'president', 'active'),
  ('96000000-0000-4000-8000-000000000001', '93000000-0000-4000-8000-000000000003', 'executive', 'active'),
  ('96000000-0000-4000-8000-000000000001', '94000000-0000-4000-8000-000000000004', 'member', 'active'),
  ('97000000-0000-4000-8000-000000000002', '95000000-0000-4000-8000-000000000005', 'treasurer', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select lives_ok($$select public.configure_financial_context('96000000-0000-4000-8000-000000000001', 'America/Chicago')$$, 'treasurer configures financial context');
select lives_ok($$select public.create_financial_account('96000000-0000-4000-8000-000000000001', 'Obligation Checking', 'checking', 'USD', 100000, current_date)$$, 'treasurer creates an account');
select lives_ok($$select public.create_transaction_category('96000000-0000-4000-8000-000000000001', 'Obligation Expense', 'expense')$$, 'treasurer creates an expense category');

select lives_ok($$
  select public.create_financial_obligation(
    '96000000-0000-4000-8000-000000000001', 'Synthetic venue deposit', 2500, 'USD', current_date + 10,
    (select id from public.transaction_categories where name = 'Obligation Expense'),
    (select id from public.financial_accounts limit 1), null, 'Synthetic test data', 'expected',
    '98000000-0000-4000-8000-000000000001'
  )
$$, 'treasurer records an expected obligation');
select lives_ok($$
  select public.create_financial_obligation(
    '96000000-0000-4000-8000-000000000001', 'Different retry text', 9999, 'USD', current_date + 20,
    (select id from public.transaction_categories where name = 'Obligation Expense'), null, null, null, 'committed',
    '98000000-0000-4000-8000-000000000001'
  )
$$, 'same creation key is idempotent');
select is((select count(*)::integer from public.financial_obligations), 1, 'idempotent retry creates one obligation');
select is((select created_by from public.financial_obligations limit 1), '91000000-0000-4000-8000-000000000001'::uuid, 'obligation creator is derived from auth uid');
select lives_ok($$
  select public.transition_financial_obligation(
    '96000000-0000-4000-8000-000000000001', (select id from public.financial_obligations limit 1),
    1, 'committed', null, 'Vendor contract was signed', '98000000-0000-4000-8000-000000000002'
  )
$$, 'expected obligation becomes committed');
select lives_ok($$
  select public.transition_financial_obligation(
    '96000000-0000-4000-8000-000000000001', (select id from public.financial_obligations limit 1),
    1, 'committed', null, 'Vendor contract was signed', '98000000-0000-4000-8000-000000000002'
  )
$$, 'same transition request is idempotent');
select is((select status::text from public.financial_obligations limit 1), 'committed', 'obligation status is committed');
select is((select count(*)::integer from public.obligation_status_history), 2, 'creation and transition history are immutable entries');
select lives_ok($$
  select public.create_manual_transaction(
    '96000000-0000-4000-8000-000000000001',
    (select id from public.financial_accounts limit 1),
    (select id from public.transaction_categories where name = 'Obligation Expense'),
    'expense', 2500, current_date, 'Synthetic venue payment', null, 'Synthetic test data',
    '98000000-0000-4000-8000-000000000003'
  )
$$, 'matching posted expense is recorded independently');
select lives_ok($$
  select public.transition_financial_obligation(
    '96000000-0000-4000-8000-000000000001', (select id from public.financial_obligations limit 1),
    2, 'paid', (select id from public.financial_transactions where status = 'posted'),
    'Matched to the posted venue payment', '98000000-0000-4000-8000-000000000004'
  )
$$, 'committed obligation links to an exact posted expense');
select is((select status::text from public.financial_obligations limit 1), 'paid', 'obligation status is paid');
select isnt((select linked_transaction_id from public.financial_obligations limit 1), null::uuid, 'paid obligation retains the transaction link');
select throws_ok($$select public.transition_financial_obligation('96000000-0000-4000-8000-000000000001', (select id from public.financial_obligations limit 1), 3, 'voided', null, 'Terminal records stay immutable', '98000000-0000-4000-8000-000000000005')$$, '22023', null, 'paid obligation cannot transition again');

select lives_ok($$
  select public.create_financial_obligation(
    '96000000-0000-4000-8000-000000000001', 'Synthetic mismatched amount', 2600, 'USD', current_date + 5,
    (select id from public.transaction_categories where name = 'Obligation Expense'), null, null, null, 'committed',
    '98000000-0000-4000-8000-000000000006'
  )
$$, 'second committed obligation is recorded');
select throws_ok($$
  select public.transition_financial_obligation(
    '96000000-0000-4000-8000-000000000001', (select id from public.financial_obligations where amount_minor = 2600),
    1, 'paid', (select id from public.financial_transactions where status = 'posted'),
    'Mismatched payment must be rejected', '98000000-0000-4000-8000-000000000007'
  )
$$, '22023', null, 'payment link requires exact amount and category');

select lives_ok($$select public.set_minimum_cash_reserve('96000000-0000-4000-8000-000000000001', 20000, 1, 'Board approved minimum reserve', '98000000-0000-4000-8000-000000000008')$$, 'treasurer sets minimum reserve');
select is((select minimum_reserve_minor from public.organization_financial_settings), 20000::bigint, 'reserve is stored in integer cents');
select is((select count(*)::integer from public.minimum_reserve_history), 1, 'reserve change appends immutable history');
select lives_ok($$select public.set_minimum_cash_reserve('96000000-0000-4000-8000-000000000001', 20000, 1, 'Board approved minimum reserve', '98000000-0000-4000-8000-000000000008')$$, 'reserve retry is idempotent');
select is((select count(*)::integer from public.minimum_reserve_history), 1, 'reserve retry does not duplicate history');

select set_config('request.jwt.claim.sub', '92000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.financial_obligations), 2, 'president reads organization obligations');
select is((select count(*)::integer from public.minimum_reserve_history), 1, 'president reads reserve history');
select throws_ok($$select public.set_minimum_cash_reserve('96000000-0000-4000-8000-000000000001', 30000, 2, 'President is read only', '98000000-0000-4000-8000-000000000009')$$, '42501', null, 'president cannot change reserve');

select set_config('request.jwt.claim.sub', '93000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.financial_obligations), 2, 'executive reads organization obligations');
select is((select count(*)::integer from public.audit_events where target_type = 'financial_obligation'), 0, 'executive cannot read obligation audit events');

select set_config('request.jwt.claim.sub', '94000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.financial_obligations), 0, 'member cannot read obligations');
select is((select count(*)::integer from public.minimum_reserve_history), 0, 'member cannot read reserve history');

select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select throws_ok($$select public.create_financial_obligation('97000000-0000-4000-8000-000000000002', 'Cross tenant', 100, 'USD', current_date, (select id from public.transaction_categories limit 1), null, null, null, 'expected', '98000000-0000-4000-8000-000000000010')$$, '42501', null, 'request body cannot select another organization');

reset role;
update public.organization_memberships set status = 'revoked'
where organization_id = '96000000-0000-4000-8000-000000000001'
  and user_id = '91000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '91000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::integer from public.financial_obligations), 0, 'revoked treasurer immediately loses obligation reads');
select throws_ok($$select public.set_minimum_cash_reserve('96000000-0000-4000-8000-000000000001', 25000, 2, 'Revoked actor blocked', '98000000-0000-4000-8000-000000000011')$$, '42501', null, 'revoked treasurer immediately loses reserve workflow');

select * from finish();
rollback;
