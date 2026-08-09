begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('a1000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'link-owner@example.test', '', now(), now(), now(), '{}', '{}'),
  ('a2000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'link-other@example.test', '', now(), now(), now(), '{}', '{}');
insert into public.organizations (id, name, created_by) values
  ('a3000000-0000-4000-8000-000000000003', 'Link Test Organization', 'a1000000-0000-4000-8000-000000000001'),
  ('a4000000-0000-4000-8000-000000000004', 'Other Link Organization', 'a2000000-0000-4000-8000-000000000002');
insert into public.organization_memberships (organization_id, user_id, role, status) values
  ('a3000000-0000-4000-8000-000000000003', 'a1000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('a4000000-0000-4000-8000-000000000004', 'a2000000-0000-4000-8000-000000000002', 'treasurer', 'active');

set local role authenticated;
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.configure_financial_context('a3000000-0000-4000-8000-000000000003', 'America/Chicago')$$, 'configures first organization');
select lives_ok($$select public.create_financial_account('a3000000-0000-4000-8000-000000000003', 'Link Checking', 'checking', 'USD', 100000, current_date)$$, 'creates first account');
select lives_ok($$select public.create_transaction_category('a3000000-0000-4000-8000-000000000003', 'Link Expense', 'expense')$$, 'creates expense category');
select lives_ok($$select public.create_transaction_category('a3000000-0000-4000-8000-000000000003', 'Link Income', 'income')$$, 'creates income category');
select lives_ok($$select public.create_manual_transaction('a3000000-0000-4000-8000-000000000003', (select id from public.financial_accounts where name = 'Link Checking'), (select id from public.transaction_categories where name = 'Link Expense'), 'expense', 1000, current_date, 'Valid link expense', null, null, 'a5000000-0000-4000-8000-000000000005')$$, 'creates valid expense transaction');
select lives_ok($$select public.create_manual_transaction('a3000000-0000-4000-8000-000000000003', (select id from public.financial_accounts where name = 'Link Checking'), (select id from public.transaction_categories where name = 'Link Income'), 'income', 1000, current_date, 'Income cannot pay obligation', null, null, 'a6000000-0000-4000-8000-000000000006')$$, 'creates income transaction');
select lives_ok($$select public.create_manual_transaction('a3000000-0000-4000-8000-000000000003', (select id from public.financial_accounts where name = 'Link Checking'), (select id from public.transaction_categories where name = 'Link Expense'), 'expense', 1000, current_date, 'Voided cannot pay obligation', null, null, 'a7000000-0000-4000-8000-000000000007')$$, 'creates expense to void');
select lives_ok($$select public.void_financial_transaction('a3000000-0000-4000-8000-000000000003', (select id from public.financial_transactions where description = 'Voided cannot pay obligation'), 'Void transaction for linking test')$$, 'voids expense transaction');

select set_config('request.jwt.claim.sub', 'a2000000-0000-4000-8000-000000000002', true);
select lives_ok($$select public.configure_financial_context('a4000000-0000-4000-8000-000000000004', 'America/Chicago')$$, 'configures other organization');
select lives_ok($$select public.create_financial_account('a4000000-0000-4000-8000-000000000004', 'Other Checking', 'checking', 'USD', 100000, current_date)$$, 'creates other account');
select lives_ok($$select public.create_transaction_category('a4000000-0000-4000-8000-000000000004', 'Other Expense', 'expense')$$, 'creates other category');
select lives_ok($$select public.create_manual_transaction('a4000000-0000-4000-8000-000000000004', (select id from public.financial_accounts where name = 'Other Checking'), (select id from public.transaction_categories where name = 'Other Expense'), 'expense', 1000, current_date, 'Other organization expense', null, null, 'a8000000-0000-4000-8000-000000000008')$$, 'creates other organization transaction');

select set_config('request.jwt.claim.sub', 'a1000000-0000-4000-8000-000000000001', true);
select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Other organization link test', 1000, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'a9000000-0000-4000-8000-000000000009')$$, 'creates cross-organization link test obligation');
select throws_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Other organization link test'), 1, 'paid', 'a8000000-0000-4000-8000-000000000008', 'Other tenant transaction rejected', 'aa000000-0000-4000-8000-000000000010')$$, '22023', null, 'another organization transaction cannot be linked');

select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Income link test', 1000, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'ab000000-0000-4000-8000-000000000011')$$, 'creates income link test obligation');
select throws_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Income link test'), 1, 'paid', (select id from public.financial_transactions where description = 'Income cannot pay obligation'), 'Income transaction rejected', 'ac000000-0000-4000-8000-000000000012')$$, '22023', null, 'income transaction cannot be linked');

select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Voided link test', 1000, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'ad000000-0000-4000-8000-000000000013')$$, 'creates voided link test obligation');
select throws_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Voided link test'), 1, 'paid', (select id from public.financial_transactions where description = 'Voided cannot pay obligation'), 'Voided transaction rejected', 'ae000000-0000-4000-8000-000000000014')$$, '22023', null, 'voided transaction cannot be linked');

select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Wrong amount link test', 1100, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'af000000-0000-4000-8000-000000000015')$$, 'creates wrong amount test obligation');
select throws_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Wrong amount link test'), 1, 'paid', (select id from public.financial_transactions where description = 'Valid link expense'), 'Wrong amount rejected', 'b0000000-0000-4000-8000-000000000016')$$, '22023', null, 'wrong amount transaction cannot be linked');

select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Stale transition test', 1000, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'b1000000-0000-4000-8000-000000000017')$$, 'creates stale-version test obligation');
select throws_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Stale transition test'), 2, 'paid', (select id from public.financial_transactions where description = 'Valid link expense'), 'Stale version rejected', 'b2000000-0000-4000-8000-000000000018')$$, '40001', null, 'stale concurrent transition is rejected');

select lives_ok($$select public.create_financial_obligation('a3000000-0000-4000-8000-000000000003', 'Valid payment link test', 1000, 'USD', current_date, (select id from public.transaction_categories where name = 'Link Expense'), null, null, null, 'committed', 'b3000000-0000-4000-8000-000000000019')$$, 'creates valid link obligation');
select lives_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Valid payment link test'), 1, 'paid', (select id from public.financial_transactions where description = 'Valid link expense'), 'Exact posted expense matched', 'b4000000-0000-4000-8000-000000000020')$$, 'exact posted expense can be linked');
select isnt((select linked_transaction_id from public.financial_obligations where description = 'Valid payment link test'), null::uuid, 'valid link is retained');
select lives_ok($$select public.transition_financial_obligation('a3000000-0000-4000-8000-000000000003', (select id from public.financial_obligations where description = 'Valid payment link test'), 1, 'paid', (select id from public.financial_transactions where description = 'Valid link expense'), 'Exact posted expense matched', 'b4000000-0000-4000-8000-000000000020')$$, 'exact retry is idempotent after terminal transition');
select is((select count(*)::integer from public.financial_obligations where status = 'paid'), 1, 'only valid obligation is paid');

select * from finish();
rollback;
