begin;
create extension if not exists pgtap with schema extensions;
select plan(35);

select has_table('public', table_name, format('%s exists', table_name))
from (values
  ('organization_budgets'), ('budget_revisions'), ('budget_allocations'),
  ('financial_obligations'), ('obligation_status_history'), ('minimum_reserve_history')
) as phase5b_tables(table_name);

select ok(class.relrowsecurity, format('RLS enabled on %s', class.relname))
from pg_catalog.pg_class as class
join pg_catalog.pg_namespace as namespace on namespace.oid = class.relnamespace
where namespace.nspname = 'public'
  and class.relname = any (array[
    'organization_budgets', 'budget_revisions', 'budget_allocations',
    'financial_obligations', 'obligation_status_history', 'minimum_reserve_history'
  ])
order by class.relname;

select isnt(
  has_table_privilege('authenticated', format('public.%I', table_name), privilege_name),
  true,
  format('authenticated cannot directly %s %s', privilege_name, table_name)
)
from (values
  ('organization_budgets'), ('budget_revisions'), ('budget_allocations'),
  ('financial_obligations'), ('obligation_status_history'), ('minimum_reserve_history')
) as phase5b_tables(table_name)
cross join (values ('INSERT'), ('UPDATE'), ('DELETE')) as privileges(privilege_name);

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname = 'public'
    and procedure.proname = any (array[
      'set_minimum_cash_reserve', 'create_organization_budget', 'update_draft_budget',
      'activate_budget', 'revise_active_budget', 'close_budget',
      'create_financial_obligation', 'update_financial_obligation',
      'transition_financial_obligation'
    ])
    and not has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
), 'authenticated receives every guarded public Phase 5B workflow');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.proname = any (array[
      'set_minimum_cash_reserve', 'create_organization_budget', 'update_draft_budget',
      'activate_budget', 'revise_active_budget', 'close_budget',
      'create_financial_obligation', 'update_financial_obligation',
      'transition_financial_obligation', 'replace_draft_budget_allocations'
    ])
    and has_function_privilege('anon', procedure.oid, 'EXECUTE')
), 'anonymous users cannot execute Phase 5B workflows or helpers');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.proname = any (array[
      'set_minimum_cash_reserve', 'create_organization_budget', 'update_draft_budget',
      'activate_budget', 'revise_active_budget', 'close_budget',
      'create_financial_obligation', 'update_financial_obligation',
      'transition_financial_obligation', 'replace_draft_budget_allocations'
    ])
    and has_function_privilege('public', procedure.oid, 'EXECUTE')
), 'PUBLIC cannot execute Phase 5B workflows or helpers');

select ok(not has_function_privilege(
  'authenticated',
  'private.replace_draft_budget_allocations(uuid,uuid,jsonb)',
  'EXECUTE'
), 'authenticated cannot execute the private allocation helper');

select ok(not exists (
  select 1
  from pg_catalog.pg_proc as procedure
  join pg_catalog.pg_namespace as namespace on namespace.oid = procedure.pronamespace
  where namespace.nspname in ('public', 'private')
    and procedure.proname = any (array[
      'set_minimum_cash_reserve', 'create_organization_budget', 'update_draft_budget',
      'activate_budget', 'revise_active_budget', 'close_budget',
      'create_financial_obligation', 'update_financial_obligation',
      'transition_financial_obligation'
    ])
    and procedure.prosecdef
    and not exists (
      select 1 from pg_catalog.unnest(procedure.proconfig) as setting
      where setting in ('search_path=', 'search_path=""')
    )
), 'all Phase 5B security definers have an empty search path');

select * from finish();
rollback;
