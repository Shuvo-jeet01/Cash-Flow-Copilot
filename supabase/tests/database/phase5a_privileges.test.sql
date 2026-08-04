begin;
create extension if not exists pgtap with schema extensions;
select plan(41);

select has_table('public', 'organization_financial_settings', 'financial settings table exists');
select has_table('public', 'financial_accounts', 'financial accounts table exists');
select has_table('public', 'account_opening_balance_entries', 'opening balance history table exists');
select has_table('public', 'transaction_categories', 'categories table exists');
select has_table('public', 'financial_transactions', 'transactions table exists');
select has_table('public', 'transaction_import_batches', 'import batches table exists');
select has_table('public', 'transaction_import_rows', 'import rows table exists');

select isnt(has_table_privilege('authenticated', 'public.organization_financial_settings', 'INSERT'), true, 'financial settings cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.organization_financial_settings', 'UPDATE'), true, 'financial settings cannot be updated directly');
select isnt(has_table_privilege('authenticated', 'public.organization_financial_settings', 'DELETE'), true, 'financial settings cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.financial_accounts', 'INSERT'), true, 'accounts cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.financial_accounts', 'UPDATE'), true, 'accounts cannot be updated directly');
select isnt(has_table_privilege('authenticated', 'public.financial_accounts', 'DELETE'), true, 'accounts cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.account_opening_balance_entries', 'INSERT'), true, 'opening entries cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.account_opening_balance_entries', 'UPDATE'), true, 'opening entries cannot be rewritten');
select isnt(has_table_privilege('authenticated', 'public.account_opening_balance_entries', 'DELETE'), true, 'opening entries cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.transaction_categories', 'INSERT'), true, 'categories cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_categories', 'UPDATE'), true, 'categories cannot be updated directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_categories', 'DELETE'), true, 'categories cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.financial_transactions', 'INSERT'), true, 'transactions cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.financial_transactions', 'UPDATE'), true, 'posted transactions cannot be rewritten directly');
select isnt(has_table_privilege('authenticated', 'public.financial_transactions', 'DELETE'), true, 'transactions cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_batches', 'INSERT'), true, 'import batches cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_batches', 'UPDATE'), true, 'import batches cannot be updated directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_batches', 'DELETE'), true, 'import batches cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_rows', 'INSERT'), true, 'import rows cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_rows', 'UPDATE'), true, 'import rows cannot be updated directly');
select isnt(has_table_privilege('authenticated', 'public.transaction_import_rows', 'DELETE'), true, 'import rows cannot be deleted');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'INSERT'), true, 'audit events cannot be inserted directly');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'), true, 'audit events cannot be updated');
select isnt(has_table_privilege('authenticated', 'public.audit_events', 'DELETE'), true, 'audit events cannot be deleted');

select ok(has_function_privilege('authenticated', 'public.create_manual_transaction(uuid,uuid,uuid,public.transaction_direction,bigint,date,text,text,text,uuid)', 'EXECUTE'), 'authenticated role may invoke guarded manual workflow');
select isnt(has_function_privilege('anon', 'public.create_manual_transaction(uuid,uuid,uuid,public.transaction_direction,bigint,date,text,text,text,uuid)', 'EXECUTE'), true, 'anonymous role cannot invoke manual workflow');
select ok(has_function_privilege('authenticated', 'public.commit_transaction_import(uuid,uuid)', 'EXECUTE'), 'authenticated role may invoke guarded import workflow');
select isnt(has_function_privilege('anon', 'public.commit_transaction_import(uuid,uuid)', 'EXECUTE'), true, 'anonymous role cannot invoke import workflow');
select isnt(has_function_privilege('authenticated', 'private.insert_financial_transaction(uuid,uuid,uuid,public.transaction_direction,bigint,date,text,text,text,public.transaction_source,text,uuid,integer,uuid,uuid,uuid)', 'EXECUTE'), true, 'private insertion helper is not callable by application users');
select isnt(has_function_privilege('anon', 'private.require_financial_treasurer(uuid)', 'EXECUTE'), true, 'anonymous role cannot execute private authorization helper');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.proname = any (array[
      'require_financial_treasurer', 'financial_local_date', 'transaction_fingerprint',
      'audit_financial_change', 'insert_financial_transaction',
      'configure_financial_context', 'create_financial_account', 'set_financial_account_status',
      'replace_account_opening_balance', 'create_transaction_category', 'set_transaction_category_status',
      'create_manual_transaction', 'void_financial_transaction', 'correct_financial_transaction',
      'create_transaction_import_preview', 'resolve_transaction_import_duplicate',
      'commit_transaction_import', 'cancel_transaction_import'
    ])
    and has_function_privilege('anon', procedure.oid, 'EXECUTE')
), 'anonymous users cannot execute any Phase 5A security definer');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'private'
    and procedure.proname = any (array[
      'require_financial_treasurer', 'financial_local_date', 'transaction_fingerprint',
      'audit_financial_change', 'insert_financial_transaction'
    ])
    and has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
), 'authenticated users cannot execute private Phase 5A helpers');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = any (array[
      'configure_financial_context', 'create_financial_account', 'set_financial_account_status',
      'replace_account_opening_balance', 'create_transaction_category', 'set_transaction_category_status',
      'create_manual_transaction', 'void_financial_transaction', 'correct_financial_transaction',
      'create_transaction_import_preview', 'resolve_transaction_import_duplicate',
      'commit_transaction_import', 'cancel_transaction_import'
    ])
    and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
), 'authenticated users receive only the guarded public Phase 5A workflows');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.proname = any (array[
      'require_financial_treasurer', 'financial_local_date', 'transaction_fingerprint',
      'audit_financial_change', 'insert_financial_transaction',
      'configure_financial_context', 'create_financial_account', 'set_financial_account_status',
      'replace_account_opening_balance', 'create_transaction_category', 'set_transaction_category_status',
      'create_manual_transaction', 'void_financial_transaction', 'correct_financial_transaction',
      'create_transaction_import_preview', 'resolve_transaction_import_duplicate',
      'commit_transaction_import', 'cancel_transaction_import'
    ])
    and not exists (
      select 1 from pg_catalog.unnest(procedure.proconfig) as setting
      where setting in ('search_path=', 'search_path=""')
    )
), 'all Phase 5A security definers have an empty search path');

select * from finish();
rollback;
