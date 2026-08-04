begin;
create extension if not exists pgtap with schema extensions;
select plan(42);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('51000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'treasurer@example.test', '', now(), now(), now(), '{}', '{}'),
  ('52000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'president@example.test', '', now(), now(), now(), '{}', '{}'),
  ('53000000-0000-4000-8000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'executive@example.test', '', now(), now(), now(), '{}', '{}'),
  ('54000000-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member@example.test', '', now(), now(), now(), '{}', '{}'),
  ('55000000-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'other@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.organizations (id, name, created_by) values
  ('61000000-0000-4000-8000-000000000001', 'Phase 5A Organization', '51000000-0000-4000-8000-000000000001'),
  ('62000000-0000-4000-8000-000000000002', 'Other Organization', '55000000-0000-4000-8000-000000000005');

insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('61000000-0000-4000-8000-000000000001', '51000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('61000000-0000-4000-8000-000000000001', '52000000-0000-4000-8000-000000000002', 'president', 'active'),
  ('61000000-0000-4000-8000-000000000001', '53000000-0000-4000-8000-000000000003', 'executive', 'active'),
  ('61000000-0000-4000-8000-000000000001', '54000000-0000-4000-8000-000000000004', 'member', 'active'),
  ('62000000-0000-4000-8000-000000000002', '55000000-0000-4000-8000-000000000005', 'treasurer', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select lives_ok($$select public.configure_financial_context('61000000-0000-4000-8000-000000000001', 'America/Chicago')$$, 'treasurer configures explicit timezone and USD');
select lives_ok($$select public.create_financial_account('61000000-0000-4000-8000-000000000001', 'Synthetic Checking', 'checking', 'USD', 10000, current_date)$$, 'treasurer creates account with opening balance');
select lives_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'Synthetic Events', 'expense')$$, 'treasurer creates expense category');

select is((select count(*)::integer from public.organization_financial_settings), 1, 'treasurer sees organization financial settings');
select is((select count(*)::integer from public.financial_accounts), 1, 'treasurer sees own organization account');
select is((select count(*)::integer from public.account_opening_balance_entries), 1, 'opening balance is an immutable entry');
select is((select count(*)::integer from public.transaction_categories), 1, 'treasurer sees own organization category');
select lives_ok($$select public.replace_account_opening_balance('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.account_opening_balance_entries limit 1), 11000, current_date, 'Corrected synthetic opening amount')$$, 'opening balance corrections append a replacement entry');
select is((select count(*)::integer from public.account_opening_balance_entries), 2, 'opening balance correction preserves the original entry');

select lives_ok($$
  select public.create_manual_transaction(
    '61000000-0000-4000-8000-000000000001',
    (select id from public.financial_accounts limit 1),
    (select id from public.transaction_categories limit 1),
    'expense', 2500, current_date, 'Synthetic purchase', null, null,
    '71000000-0000-4000-8000-000000000001'
  )
$$, 'treasurer creates posted integer-cent transaction');

select lives_ok($$
  select public.create_manual_transaction(
    '61000000-0000-4000-8000-000000000001',
    (select id from public.financial_accounts limit 1),
    (select id from public.transaction_categories limit 1),
    'expense', 2500, current_date, 'Synthetic purchase', null, null,
    '71000000-0000-4000-8000-000000000001'
  )
$$, 'same manual retry is idempotent');
select is((select count(*)::integer from public.financial_transactions), 1, 'idempotent retry creates one transaction');
select is((select created_by from public.financial_transactions limit 1), '51000000-0000-4000-8000-000000000001'::uuid, 'creator is derived from auth uid');
select throws_ok($$select public.create_manual_transaction('62000000-0000-4000-8000-000000000002', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories limit 1), 'expense', 100, current_date, 'Cross tenant', null, null, '71000000-0000-4000-8000-000000000002')$$, '42501', null, 'treasurer cannot use another organization context');
select throws_ok($$select public.create_manual_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories limit 1), 'expense', 0, current_date, 'Zero amount', null, null, '71000000-0000-4000-8000-000000000003')$$, '22003', null, 'zero amount is rejected');
select throws_ok($$select public.create_manual_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories limit 1), 'expense', 100, current_date + 1, 'Future transaction', null, null, '71000000-0000-4000-8000-000000000004')$$, '22023', null, 'future posted date is rejected');

select lives_ok($$select public.correct_financial_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_transactions where replaces_transaction_id is null limit 1), (select id from public.financial_accounts limit 1), (select id from public.transaction_categories limit 1), 'expense', 2400, current_date, 'Corrected synthetic purchase', null, null, 'Corrected amount', '71000000-0000-4000-8000-000000000005')$$, 'correction atomically creates replacement');
select is((select count(*)::integer from public.financial_transactions where status = 'voided'), 1, 'correction voids original');
select is((select count(*)::integer from public.financial_transactions where replaces_transaction_id is not null and status = 'posted'), 1, 'correction preserves linked posted replacement');
select throws_ok($$select public.void_financial_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_transactions where status = 'voided' limit 1), 'Repeated void attempt')$$, '40001', null, 'repeated void is rejected');
select ok((select count(*) from public.audit_events where target_type = 'financial_transaction') >= 3, 'financial mutations create audit history');
select lives_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'Synthetic Income', 'income')$$, 'treasurer creates an income category');
select throws_ok($$select public.create_manual_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories where name = 'Synthetic Income'), 'expense', 100, current_date, 'Mismatched category attempt', null, null, '71000000-0000-4000-8000-000000000008')$$, '22023', null, 'income categories cannot be used for expense transactions');
select lives_ok($$select public.set_transaction_category_status('61000000-0000-4000-8000-000000000001', (select id from public.transaction_categories where name = 'Synthetic Events'), 'archived')$$, 'treasurer archives a referenced category without deleting history');
select throws_ok($$select public.create_manual_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories where name = 'Synthetic Events'), 'expense', 100, current_date, 'Archived category attempt', null, null, '71000000-0000-4000-8000-000000000007')$$, '22023', null, 'archived categories cannot be used for new transactions');
select lives_ok($$select public.set_financial_account_status('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), 'archived')$$, 'treasurer archives a referenced account without deleting history');
select throws_ok($$select public.create_manual_transaction('61000000-0000-4000-8000-000000000001', (select id from public.financial_accounts limit 1), (select id from public.transaction_categories limit 1), 'expense', 100, current_date, 'Archived account attempt', null, null, '71000000-0000-4000-8000-000000000006')$$, '22023', null, 'archived accounts cannot be used for new transactions');

select set_config('request.jwt.claim.sub', '52000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.organization_financial_settings), 1, 'president can read organization financial settings');
select is((select count(*)::integer from public.financial_accounts), 1, 'president can read organization accounts');
select is((select count(*)::integer from public.financial_transactions), 2, 'president can read posted and voided transaction history');
select ok((select count(*) from public.audit_events where target_type = 'financial_transaction') >= 3, 'president can read relevant financial audit history');
select throws_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'President blocked', 'expense')$$, '42501', null, 'president cannot mutate financial records');

select set_config('request.jwt.claim.sub', '53000000-0000-4000-8000-000000000003', true);
select is((select count(*)::integer from public.organization_financial_settings), 1, 'executive can read organization financial settings');
select is((select count(*)::integer from public.financial_accounts), 1, 'executive can read organization accounts');
select is((select count(*)::integer from public.financial_transactions), 2, 'executive can read organization transactions');
select is((select count(*)::integer from public.audit_events where target_type = 'financial_transaction'), 0, 'executive cannot read financial audit history');
select throws_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'Executive blocked', 'expense')$$, '42501', null, 'executive cannot mutate financial records');

select set_config('request.jwt.claim.sub', '54000000-0000-4000-8000-000000000004', true);
select is((select count(*)::integer from public.organization_financial_settings), 0, 'member cannot read organization financial settings');
select is((select count(*)::integer from public.financial_transactions), 0, 'member cannot read financial transactions');
select throws_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'Blocked', 'expense')$$, '42501', null, 'member cannot create financial categories');

reset role;
update public.organization_memberships set status = 'revoked'
where organization_id = '61000000-0000-4000-8000-000000000001'
  and user_id = '51000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select is((select count(*)::integer from public.financial_accounts), 0, 'revoked treasurer immediately loses read access');
select throws_ok($$select public.create_transaction_category('61000000-0000-4000-8000-000000000001', 'Revoked', 'expense')$$, '42501', null, 'revoked treasurer immediately loses write workflow access');

select * from finish();
rollback;
