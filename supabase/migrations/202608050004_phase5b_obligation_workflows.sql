begin;

create function public.create_financial_obligation(
  requested_organization_id uuid,
  requested_description text,
  requested_amount_minor bigint,
  requested_currency_code text,
  requested_due_on date,
  requested_category_id uuid,
  requested_intended_account_id uuid,
  requested_reference text,
  requested_note text,
  requested_initial_status public.obligation_status,
  requested_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_description text := pg_catalog.btrim(requested_description);
  normalized_reference text := nullif(pg_catalog.btrim(requested_reference), '');
  normalized_note text := nullif(pg_catalog.btrim(requested_note), '');
  existing_obligation_id uuid;
  new_obligation_id uuid;
begin
  perform private.financial_local_date(requested_organization_id);
  if requested_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  select obligation.id into existing_obligation_id
  from public.financial_obligations as obligation
  where obligation.organization_id = requested_organization_id
    and obligation.idempotency_key = requested_idempotency_key;
  if existing_obligation_id is not null then return existing_obligation_id; end if;

  if coalesce(pg_catalog.char_length(normalized_description), 0) not between 2 and 200 then
    raise exception 'Invalid obligation description' using errcode = '22023';
  end if;
  if requested_amount_minor is null
    or requested_amount_minor not between 1 and 999999999999
  then
    raise exception 'Obligation amount is outside the supported range' using errcode = '22003';
  end if;
  if requested_currency_code is distinct from 'USD' then
    raise exception 'Only USD is supported' using errcode = '22023';
  end if;
  if requested_due_on is null then
    raise exception 'Obligation due date is required' using errcode = '22023';
  end if;
  if requested_initial_status not in ('expected', 'committed') then
    raise exception 'New obligations must be expected or committed' using errcode = '22023';
  end if;
  if normalized_reference is not null
    and pg_catalog.char_length(normalized_reference) > 100
  then
    raise exception 'Reference is too long' using errcode = '22023';
  end if;
  if normalized_note is not null and pg_catalog.char_length(normalized_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.transaction_categories as category
    where category.organization_id = requested_organization_id
      and category.id = requested_category_id
      and category.direction = 'expense'
      and category.status = 'active'
  ) then
    raise exception 'Active expense category not found' using errcode = '22023';
  end if;
  if requested_intended_account_id is not null and not exists (
    select 1
    from public.financial_accounts as account
    where account.organization_id = requested_organization_id
      and account.id = requested_intended_account_id
      and account.currency_code = 'USD'
      and account.status = 'active'
  ) then
    raise exception 'Active intended account not found' using errcode = '22023';
  end if;

  insert into public.financial_obligations (
    organization_id,
    description,
    amount_minor,
    currency_code,
    due_on,
    category_id,
    category_direction,
    intended_account_id,
    reference,
    note,
    status,
    created_by,
    idempotency_key
  ) values (
    requested_organization_id,
    normalized_description,
    requested_amount_minor,
    'USD',
    requested_due_on,
    requested_category_id,
    'expense',
    requested_intended_account_id,
    normalized_reference,
    normalized_note,
    requested_initial_status,
    caller_id,
    requested_idempotency_key
  )
  returning id into new_obligation_id;

  insert into public.obligation_status_history (
    organization_id,
    obligation_id,
    from_status,
    to_status,
    reason,
    linked_transaction_id,
    changed_by,
    idempotency_key
  ) values (
    requested_organization_id,
    new_obligation_id,
    null,
    requested_initial_status,
    case
      when requested_initial_status = 'expected' then 'Created as expected.'
      else 'Created as committed.'
    end,
    null,
    caller_id,
    requested_idempotency_key
  );

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    request_id,
    metadata
  ) values (
    requested_organization_id,
    caller_id,
    'financial_obligation.created',
    'financial_obligation',
    new_obligation_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'status', requested_initial_status,
      'amount_minor', requested_amount_minor,
      'currency_code', 'USD',
      'due_on', requested_due_on,
      'category_id', requested_category_id,
      'intended_account_id', requested_intended_account_id
    )
  );
  return new_obligation_id;
end;
$$;

create function public.update_financial_obligation(
  requested_organization_id uuid,
  requested_obligation_id uuid,
  requested_expected_version integer,
  requested_description text,
  requested_amount_minor bigint,
  requested_currency_code text,
  requested_due_on date,
  requested_category_id uuid,
  requested_intended_account_id uuid,
  requested_reference text,
  requested_note text,
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
  normalized_description text := pg_catalog.btrim(requested_description);
  normalized_reference text := nullif(pg_catalog.btrim(requested_reference), '');
  normalized_note text := nullif(pg_catalog.btrim(requested_note), '');
  normalized_reason text := pg_catalog.btrim(requested_reason);
begin
  if exists (
    select 1 from public.audit_events as event
    where event.organization_id = requested_organization_id
      and event.request_id = requested_idempotency_key
      and event.action = 'financial_obligation.updated'
      and event.target_id = requested_obligation_id
  ) then
    return;
  end if;
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_description), 0) not between 2 and 200
    or requested_amount_minor is null
    or requested_amount_minor not between 1 and 999999999999
    or requested_currency_code is distinct from 'USD'
    or requested_due_on is null
  then
    raise exception 'Obligation fields are invalid' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful update reason is required' using errcode = '22023';
  end if;
  if normalized_reference is not null
    and pg_catalog.char_length(normalized_reference) > 100
  then
    raise exception 'Reference is too long' using errcode = '22023';
  end if;
  if normalized_note is not null and pg_catalog.char_length(normalized_note) > 500 then
    raise exception 'Note is too long' using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.transaction_categories as category
    where category.organization_id = requested_organization_id
      and category.id = requested_category_id
      and category.direction = 'expense'
      and category.status = 'active'
  ) then
    raise exception 'Active expense category not found' using errcode = '22023';
  end if;
  if requested_intended_account_id is not null and not exists (
    select 1
    from public.financial_accounts as account
    where account.organization_id = requested_organization_id
      and account.id = requested_intended_account_id
      and account.currency_code = 'USD'
      and account.status = 'active'
  ) then
    raise exception 'Active intended account not found' using errcode = '22023';
  end if;

  perform 1
  from public.financial_obligations as obligation
  where obligation.organization_id = requested_organization_id
    and obligation.id = requested_obligation_id
    and obligation.status in ('expected', 'committed')
    and obligation.version = requested_expected_version
  for update;
  if not found then
    raise exception 'Obligation changed or is no longer editable' using errcode = '40001';
  end if;

  update public.financial_obligations
  set description = normalized_description,
      amount_minor = requested_amount_minor,
      currency_code = 'USD',
      due_on = requested_due_on,
      category_id = requested_category_id,
      category_direction = 'expense',
      intended_account_id = requested_intended_account_id,
      reference = normalized_reference,
      note = normalized_note,
      version = version + 1
  where organization_id = requested_organization_id
    and id = requested_obligation_id
    and status in ('expected', 'committed')
    and version = requested_expected_version;
  if not found then
    raise exception 'Obligation changed; refresh and try again' using errcode = '40001';
  end if;

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    request_id,
    metadata
  ) values (
    requested_organization_id,
    caller_id,
    'financial_obligation.updated',
    'financial_obligation',
    requested_obligation_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'amount_minor', requested_amount_minor,
      'currency_code', 'USD',
      'due_on', requested_due_on,
      'category_id', requested_category_id,
      'intended_account_id', requested_intended_account_id,
      'reason', normalized_reason
    )
  );
end;
$$;

create function public.transition_financial_obligation(
  requested_organization_id uuid,
  requested_obligation_id uuid,
  requested_expected_version integer,
  requested_to_status public.obligation_status,
  requested_transaction_id uuid,
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
  obligation_row public.financial_obligations;
  existing_history public.obligation_status_history;
begin
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful transition reason is required' using errcode = '22023';
  end if;

  select history.* into existing_history
  from public.obligation_status_history as history
  where history.organization_id = requested_organization_id
    and history.idempotency_key = requested_idempotency_key;
  if found then
    if existing_history.obligation_id = requested_obligation_id
      and existing_history.to_status = requested_to_status
      and existing_history.linked_transaction_id is not distinct from requested_transaction_id
      and existing_history.reason = normalized_reason
    then
      return;
    end if;
    raise exception 'Idempotency key was already used for another transition'
      using errcode = '23505';
  end if;

  select obligation.* into obligation_row
  from public.financial_obligations as obligation
  where obligation.organization_id = requested_organization_id
    and obligation.id = requested_obligation_id
  for update;
  if not found then
    raise exception 'Obligation was not found' using errcode = 'P0002';
  end if;
  if obligation_row.version <> requested_expected_version then
    raise exception 'Obligation changed; refresh and try again' using errcode = '40001';
  end if;
  if not (
    (obligation_row.status = 'expected' and requested_to_status in ('committed', 'voided'))
    or
    (obligation_row.status = 'committed' and requested_to_status in ('paid', 'voided'))
  ) then
    raise exception 'Invalid obligation status transition' using errcode = '22023';
  end if;

  if requested_to_status = 'paid' then
    if requested_transaction_id is null then
      raise exception 'A qualifying expense transaction is required' using errcode = '22023';
    end if;
    perform 1
    from public.financial_transactions as transaction
    where transaction.organization_id = requested_organization_id
      and transaction.id = requested_transaction_id
      and transaction.status = 'posted'
      and transaction.direction = 'expense'
      and transaction.currency_code = 'USD'
      and transaction.amount_minor = obligation_row.amount_minor
      and transaction.category_id = obligation_row.category_id
    for share;
    if not found then
      raise exception 'Linked transaction must be a matching posted expense'
        using errcode = '22023';
    end if;
  elsif requested_transaction_id is not null then
    raise exception 'Only a paid transition may link a transaction' using errcode = '22023';
  end if;

  update public.financial_obligations
  set status = requested_to_status,
      linked_transaction_id = case
        when requested_to_status = 'paid' then requested_transaction_id
        else null
      end,
      version = version + 1
  where organization_id = requested_organization_id
    and id = requested_obligation_id
    and version = requested_expected_version
    and status = obligation_row.status;
  if not found then
    raise exception 'Obligation changed during transition' using errcode = '40001';
  end if;

  insert into public.obligation_status_history (
    organization_id,
    obligation_id,
    from_status,
    to_status,
    reason,
    linked_transaction_id,
    changed_by,
    idempotency_key
  ) values (
    requested_organization_id,
    requested_obligation_id,
    obligation_row.status,
    requested_to_status,
    normalized_reason,
    case when requested_to_status = 'paid' then requested_transaction_id else null end,
    caller_id,
    requested_idempotency_key
  );

  insert into public.audit_events (
    organization_id,
    actor_user_id,
    action,
    target_type,
    target_id,
    request_id,
    metadata
  ) values (
    requested_organization_id,
    caller_id,
    case requested_to_status
      when 'committed' then 'financial_obligation.committed'
      when 'paid' then 'financial_obligation.paid'
      when 'voided' then 'financial_obligation.voided'
      else 'financial_obligation.status_changed'
    end,
    'financial_obligation',
    requested_obligation_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'from_status', obligation_row.status,
      'to_status', requested_to_status,
      'linked_transaction_id', requested_transaction_id,
      'reason', normalized_reason
    )
  );
end;
$$;

revoke all on function public.create_financial_obligation(
  uuid, text, bigint, text, date, uuid, uuid, text, text,
  public.obligation_status, uuid
) from public, anon;
revoke all on function public.update_financial_obligation(
  uuid, uuid, integer, text, bigint, text, date, uuid, uuid, text, text, text, uuid
) from public, anon;
revoke all on function public.transition_financial_obligation(
  uuid, uuid, integer, public.obligation_status, uuid, text, uuid
) from public, anon;

grant execute on function public.create_financial_obligation(
  uuid, text, bigint, text, date, uuid, uuid, text, text,
  public.obligation_status, uuid
) to authenticated;
grant execute on function public.update_financial_obligation(
  uuid, uuid, integer, text, bigint, text, date, uuid, uuid, text, text, text, uuid
) to authenticated;
grant execute on function public.transition_financial_obligation(
  uuid, uuid, integer, public.obligation_status, uuid, text, uuid
) to authenticated;

commit;
