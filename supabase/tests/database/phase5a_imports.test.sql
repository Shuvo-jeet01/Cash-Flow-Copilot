begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
values
  ('81000000-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'importer@example.test', '', now(), now(), now(), '{}', '{}'),
  ('82000000-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'import-member@example.test', '', now(), now(), now(), '{}', '{}');

insert into public.organizations (id, name, created_by)
values ('91000000-0000-4000-8000-000000000001', 'Import Test Organization', '81000000-0000-4000-8000-000000000001');

insert into public.organization_memberships (organization_id, user_id, role, status)
values
  ('91000000-0000-4000-8000-000000000001', '81000000-0000-4000-8000-000000000001', 'treasurer', 'active'),
  ('91000000-0000-4000-8000-000000000001', '82000000-0000-4000-8000-000000000002', 'member', 'active');

create temporary table phase5a_import_ids (name text primary key, id uuid not null);
grant select, insert on table pg_temp.phase5a_import_ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claim.sub', '81000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);

select public.configure_financial_context('91000000-0000-4000-8000-000000000001', 'America/Chicago');
select pass('treasurer configures import organization');
select public.create_financial_account('91000000-0000-4000-8000-000000000001', 'Import Checking', 'checking', 'USD', null, null);
select pass('treasurer creates import account');
select public.create_transaction_category('91000000-0000-4000-8000-000000000001', 'Import Expense', 'expense');
select pass('treasurer creates import category');

insert into pg_temp.phase5a_import_ids (name, id)
select 'invalid', public.create_transaction_import_preview(
  '91000000-0000-4000-8000-000000000001', 'invalid.csv', repeat('a', 64),
  jsonb_build_array(jsonb_build_object(
    'row_number', '1',
    'transaction_date', current_date::text,
    'direction', 'expense',
    'amount_minor', '0',
    'currency', 'USD',
    'description', 'Invalid zero amount',
    'account_id', (select id::text from public.financial_accounts where name = 'Import Checking'),
    'category_id', (select id::text from public.transaction_categories where name = 'Import Expense'),
    'reference', '', 'note', '', 'external_id', ''
  ))
);
select pass('invalid CSV preview records every row error without writing transactions');
select is((select invalid_count from public.transaction_import_batches where id = (select id from pg_temp.phase5a_import_ids where name = 'invalid')), 1, 'invalid preview records its blocking row');
select throws_ok($$select public.commit_transaction_import('91000000-0000-4000-8000-000000000001', (select id from pg_temp.phase5a_import_ids where name = 'invalid'))$$, '40001', null, 'a batch with blocking errors cannot commit');
select is((select count(*)::integer from public.financial_transactions), 0, 'failed import writes no partial transactions');

insert into pg_temp.phase5a_import_ids (name, id)
select 'valid', public.create_transaction_import_preview(
  '91000000-0000-4000-8000-000000000001', 'valid.csv', repeat('b', 64),
  jsonb_build_array(jsonb_build_object(
    'row_number', '1',
    'transaction_date', current_date::text,
    'direction', 'expense',
    'amount_minor', '1250',
    'currency', 'USD',
    'description', 'Synthetic CSV transaction',
    'account_id', (select id::text from public.financial_accounts where name = 'Import Checking'),
    'category_id', (select id::text from public.transaction_categories where name = 'Import Expense'),
    'reference', 'TEST-CSV-1', 'note', '', 'external_id', 'synthetic-1'
  ))
);
select pass('valid CSV creates a reviewable preview');
select is((select status::text from public.transaction_import_batches where id = (select id from pg_temp.phase5a_import_ids where name = 'valid')), 'ready', 'error-free preview becomes ready');
select is(public.commit_transaction_import('91000000-0000-4000-8000-000000000001', (select id from pg_temp.phase5a_import_ids where name = 'valid')), 1, 'ready CSV commits atomically');
select is(public.commit_transaction_import('91000000-0000-4000-8000-000000000001', (select id from pg_temp.phase5a_import_ids where name = 'valid')), 1, 'retrying the same committed batch is idempotent');
select is((select count(*)::integer from public.financial_transactions), 1, 'idempotent commit retry creates one imported transaction');

insert into pg_temp.phase5a_import_ids (name, id)
select 'duplicate', public.create_transaction_import_preview(
  '91000000-0000-4000-8000-000000000001', 'intentional-duplicate.csv', repeat('c', 64),
  jsonb_build_array(jsonb_build_object(
    'row_number', '1',
    'transaction_date', current_date::text,
    'direction', 'expense',
    'amount_minor', '1250',
    'currency', 'USD',
    'description', 'Synthetic CSV transaction',
    'account_id', (select id::text from public.financial_accounts where name = 'Import Checking'),
    'category_id', (select id::text from public.transaction_categories where name = 'Import Expense'),
    'reference', 'TEST-CSV-1', 'note', '', 'external_id', 'synthetic-2'
  ))
);
select pass('historical match is previewed as a warning rather than silently blocked');
select is((select status::text from public.transaction_import_batches where id = (select id from pg_temp.phase5a_import_ids where name = 'duplicate')), 'review', 'possible duplicate requires explicit review');
select public.resolve_transaction_import_duplicate(
  '91000000-0000-4000-8000-000000000001',
  (select id from pg_temp.phase5a_import_ids where name = 'duplicate'),
  (select id from public.transaction_import_rows where batch_id = (select id from pg_temp.phase5a_import_ids where name = 'duplicate')),
  'accept_distinct',
  'Confirmed as a separate legitimate transaction.'
);
select pass('treasurer explicitly accepts an intentional duplicate with a reason');
select public.resolve_transaction_import_duplicate(
  '91000000-0000-4000-8000-000000000001',
  (select id from pg_temp.phase5a_import_ids where name = 'duplicate'),
  (select id from public.transaction_import_rows where batch_id = (select id from pg_temp.phase5a_import_ids where name = 'duplicate')),
  'accept_distinct',
  'Confirmed as a separate legitimate transaction.'
);
select pass('retrying the same duplicate resolution is idempotent');
select is(public.commit_transaction_import('91000000-0000-4000-8000-000000000001', (select id from pg_temp.phase5a_import_ids where name = 'duplicate')), 1, 'accepted duplicate commits once');
select is((select count(*)::integer from public.financial_transactions), 2, 'intentional duplicate remains a distinct auditable transaction');
select ok((select count(*) from public.audit_events where action = 'transaction_import.duplicate_resolved') = 1, 'duplicate override creates one audit event');

select throws_ok($sql$
  select public.create_transaction_import_preview(
    '91000000-0000-4000-8000-000000000001', 'valid-retry.csv', repeat('b', 64),
    jsonb_build_array(jsonb_build_object('row_number', '1'))
  )
$sql$, '23505', null, 'a committed file fingerprint cannot be re-imported');
select throws_ok($sql$
  select public.create_transaction_import_preview(
    '92000000-0000-4000-8000-000000000002', 'cross-org.csv', repeat('d', 64),
    jsonb_build_array(jsonb_build_object('row_number', '1'))
  )
$sql$, '42501', null, 'an organization ID outside the caller membership is rejected');

select set_config('request.jwt.claim.sub', '82000000-0000-4000-8000-000000000002', true);
select is((select count(*)::integer from public.transaction_import_batches), 0, 'members cannot read import history');
select throws_ok($sql$
  select public.create_transaction_import_preview(
    '91000000-0000-4000-8000-000000000001', 'member.csv', repeat('e', 64),
    jsonb_build_array(jsonb_build_object('row_number', '1'))
  )
$sql$, '42501', null, 'members cannot invoke the import workflow');

select * from finish();
rollback;
