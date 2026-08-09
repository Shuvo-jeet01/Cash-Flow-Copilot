begin;

alter table public.organization_budgets enable row level security;
alter table public.budget_revisions enable row level security;
alter table public.budget_allocations enable row level security;
alter table public.financial_obligations enable row level security;
alter table public.obligation_status_history enable row level security;
alter table public.minimum_reserve_history enable row level security;

create policy organization_budgets_select_officers
on public.organization_budgets for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy budget_revisions_select_officers
on public.budget_revisions for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy budget_allocations_select_officers
on public.budget_allocations for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy financial_obligations_select_officers
on public.financial_obligations for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy obligation_status_history_select_officers
on public.obligation_status_history for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy minimum_reserve_history_select_officers
on public.minimum_reserve_history for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

drop policy if exists audit_events_select_financial_president
on public.audit_events;

create policy audit_events_select_financial_president
on public.audit_events for select to authenticated
using (
  target_type in (
    'financial_settings',
    'financial_account',
    'account_opening_balance',
    'transaction_category',
    'financial_transaction',
    'transaction_import_batch',
    'organization_budget',
    'budget_revision',
    'financial_obligation',
    'minimum_reserve'
  )
  and (select private.has_organization_role(
    organization_id,
    array['president']::public.organization_role[]
  ))
);

revoke all on table public.organization_budgets from anon, authenticated;
revoke all on table public.budget_revisions from anon, authenticated;
revoke all on table public.budget_allocations from anon, authenticated;
revoke all on table public.financial_obligations from anon, authenticated;
revoke all on table public.obligation_status_history from anon, authenticated;
revoke all on table public.minimum_reserve_history from anon, authenticated;

grant select on table public.organization_budgets to authenticated;
grant select on table public.budget_revisions to authenticated;
grant select on table public.budget_allocations to authenticated;
grant select on table public.financial_obligations to authenticated;
grant select on table public.obligation_status_history to authenticated;
grant select on table public.minimum_reserve_history to authenticated;

create function public.set_minimum_cash_reserve(
  requested_organization_id uuid,
  requested_amount_minor bigint,
  requested_expected_version integer,
  requested_reason text,
  requested_idempotency_key uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_reason text := pg_catalog.btrim(requested_reason);
  current_amount_minor bigint;
  current_version integer;
  existing_history public.minimum_reserve_history;
  new_history_id uuid;
begin
  if requested_amount_minor is null
    or requested_amount_minor not between 0 and 999999999999
  then
    raise exception 'Reserve is outside the supported range' using errcode = '22003';
  end if;
  if requested_expected_version is null or requested_expected_version < 1 then
    raise exception 'A valid settings version is required' using errcode = '22023';
  end if;
  if requested_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful reserve-change reason is required' using errcode = '22023';
  end if;

  select history.* into existing_history
  from public.minimum_reserve_history as history
  where history.organization_id = requested_organization_id
    and history.idempotency_key = requested_idempotency_key;
  if found then
    if existing_history.new_amount_minor = requested_amount_minor
      and existing_history.reason = normalized_reason
    then
      return;
    end if;
    raise exception 'Idempotency key was already used for another reserve change'
      using errcode = '23505';
  end if;

  select settings.minimum_reserve_minor, settings.reserve_version
  into current_amount_minor, current_version
  from public.organization_financial_settings as settings
  where settings.organization_id = requested_organization_id
    and settings.base_currency = 'USD'
  for update;
  if not found then
    raise exception 'Financial settings must be configured first' using errcode = '22023';
  end if;
  if current_version <> requested_expected_version then
    raise exception 'Reserve settings changed; refresh and try again' using errcode = '40001';
  end if;
  if current_amount_minor = requested_amount_minor then
    raise exception 'Reserve amount is unchanged' using errcode = '22023';
  end if;

  update public.organization_financial_settings
  set minimum_reserve_minor = requested_amount_minor,
      reserve_version = reserve_version + 1
  where organization_id = requested_organization_id
    and reserve_version = requested_expected_version;
  if not found then
    raise exception 'Reserve settings changed; refresh and try again' using errcode = '40001';
  end if;

  insert into public.minimum_reserve_history (
    organization_id,
    previous_amount_minor,
    new_amount_minor,
    currency_code,
    reason,
    changed_by,
    idempotency_key
  ) values (
    requested_organization_id,
    current_amount_minor,
    requested_amount_minor,
    'USD',
    normalized_reason,
    caller_id,
    requested_idempotency_key
  )
  returning id into new_history_id;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    metadata
  ) values (
    requested_organization_id,
    caller_id,
    'minimum_reserve.changed',
    'minimum_reserve',
    requested_organization_id,
    pg_catalog.jsonb_build_object(
      'history_id', new_history_id,
      'previous_amount_minor', current_amount_minor,
      'new_amount_minor', requested_amount_minor,
      'currency_code', 'USD'
    )
  );
end;
$$;

revoke all on function public.set_minimum_cash_reserve(
  uuid,
  bigint,
  integer,
  text,
  uuid
) from public, anon;

grant execute on function public.set_minimum_cash_reserve(
  uuid,
  bigint,
  integer,
  text,
  uuid
) to authenticated;

commit;
