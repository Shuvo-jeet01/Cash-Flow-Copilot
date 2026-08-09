begin;

create function private.replace_draft_budget_allocations(
  requested_organization_id uuid,
  requested_revision_id uuid,
  requested_allocations jsonb
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  allocation_item jsonb;
  category_id_value uuid;
  amount_minor_value bigint;
  category_direction_value public.transaction_direction;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if requested_allocations is null
    or pg_catalog.jsonb_typeof(requested_allocations) <> 'array'
    or pg_catalog.jsonb_array_length(requested_allocations) > 200
  then
    raise exception 'Budget allocations must be an array of at most 200 rows'
      using errcode = '22023';
  end if;
  if not exists (
    select 1
    from public.budget_revisions as revision
    where revision.organization_id = requested_organization_id
      and revision.id = requested_revision_id
      and revision.status = 'draft'
  ) then
    raise exception 'Only a draft revision may replace allocations'
      using errcode = '40001';
  end if;

  delete from public.budget_allocations
  where organization_id = requested_organization_id
    and revision_id = requested_revision_id;

  for allocation_item in
    select item.value
    from pg_catalog.jsonb_array_elements(requested_allocations) as item(value)
  loop
    if coalesce(allocation_item->>'category_id', '') !~
      '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$'
    then
      raise exception 'Budget allocation category is invalid' using errcode = '22023';
    end if;
    if coalesce(allocation_item->>'amount_minor', '') !~ '^(0|[1-9][0-9]{0,11})$' then
      raise exception 'Budget allocation amount must use integer cents'
        using errcode = '22023';
    end if;
    category_id_value := (allocation_item->>'category_id')::uuid;
    amount_minor_value := (allocation_item->>'amount_minor')::bigint;
    if amount_minor_value > 999999999999 then
      raise exception 'Budget allocation amount is outside the supported range'
        using errcode = '22003';
    end if;

    select category.direction into category_direction_value
    from public.transaction_categories as category
    where category.organization_id = requested_organization_id
      and category.id = category_id_value
      and category.status = 'active';
    if not found then
      raise exception 'Budget category is inactive or belongs to another organization'
        using errcode = '22023';
    end if;

    insert into public.budget_allocations (
      organization_id,
      revision_id,
      category_id,
      direction,
      amount_minor,
      created_by
    ) values (
      requested_organization_id,
      requested_revision_id,
      category_id_value,
      category_direction_value,
      amount_minor_value,
      caller_id
    );
  end loop;
end;
$$;

revoke all on function private.replace_draft_budget_allocations(
  uuid,
  uuid,
  jsonb
) from public, anon, authenticated;

create function public.create_organization_budget(
  requested_organization_id uuid,
  requested_name text,
  requested_start_on date,
  requested_end_on date,
  requested_currency_code text,
  requested_allocations jsonb,
  requested_reason text,
  requested_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_name text := pg_catalog.btrim(requested_name);
  normalized_reason text := pg_catalog.btrim(requested_reason);
  existing_budget_id uuid;
  new_budget_id uuid;
  new_revision_id uuid;
begin
  perform private.financial_local_date(requested_organization_id);
  if requested_idempotency_key is null then
    raise exception 'An idempotency key is required' using errcode = '22023';
  end if;
  select budget.id into existing_budget_id
  from public.organization_budgets as budget
  where budget.organization_id = requested_organization_id
    and budget.idempotency_key = requested_idempotency_key;
  if existing_budget_id is not null then return existing_budget_id; end if;
  if coalesce(pg_catalog.char_length(normalized_name), 0) not between 2 and 120 then
    raise exception 'Invalid budget name' using errcode = '22023';
  end if;
  if requested_start_on is null
    or requested_end_on is null
    or requested_start_on > requested_end_on
  then
    raise exception 'Budget dates are invalid' using errcode = '22023';
  end if;
  if requested_currency_code is distinct from 'USD' then
    raise exception 'Only USD is supported' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful draft reason is required' using errcode = '22023';
  end if;

  insert into public.organization_budgets (
    organization_id,
    status,
    created_by,
    idempotency_key
  ) values (
    requested_organization_id,
    'draft',
    caller_id,
    requested_idempotency_key
  )
  returning id into new_budget_id;

  insert into public.budget_revisions (
    organization_id,
    budget_id,
    revision_number,
    name,
    start_on,
    end_on,
    currency_code,
    status,
    change_reason,
    created_by,
    idempotency_key
  ) values (
    requested_organization_id,
    new_budget_id,
    1,
    normalized_name,
    requested_start_on,
    requested_end_on,
    'USD',
    'draft',
    normalized_reason,
    caller_id,
    requested_idempotency_key
  )
  returning id into new_revision_id;

  perform private.replace_draft_budget_allocations(
    requested_organization_id,
    new_revision_id,
    requested_allocations
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
    'organization_budget.created',
    'organization_budget',
    new_budget_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'revision_id', new_revision_id,
      'revision_number', 1,
      'status', 'draft'
    )
  );
  return new_budget_id;
end;
$$;

create function public.update_draft_budget(
  requested_organization_id uuid,
  requested_budget_id uuid,
  requested_expected_version integer,
  requested_name text,
  requested_start_on date,
  requested_end_on date,
  requested_currency_code text,
  requested_allocations jsonb,
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
  normalized_name text := pg_catalog.btrim(requested_name);
  normalized_reason text := pg_catalog.btrim(requested_reason);
  draft_revision_id uuid;
begin
  if exists (
    select 1 from public.audit_events as event
    where event.organization_id = requested_organization_id
      and event.request_id = requested_idempotency_key
      and event.action = 'organization_budget.draft_updated'
      and event.target_id = requested_budget_id
  ) then
    return;
  end if;
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_name), 0) not between 2 and 120
    or requested_start_on is null
    or requested_end_on is null
    or requested_start_on > requested_end_on
    or requested_currency_code is distinct from 'USD'
  then
    raise exception 'Draft budget fields are invalid' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful draft revision reason is required' using errcode = '22023';
  end if;

  perform 1
  from public.organization_budgets as budget
  where budget.organization_id = requested_organization_id
    and budget.id = requested_budget_id
    and budget.status = 'draft'
    and budget.version = requested_expected_version
  for update;
  if not found then
    raise exception 'Draft budget changed or is no longer editable' using errcode = '40001';
  end if;

  select revision.id into draft_revision_id
  from public.budget_revisions as revision
  where revision.organization_id = requested_organization_id
    and revision.budget_id = requested_budget_id
    and revision.status = 'draft'
  for update;
  if not found then
    raise exception 'Draft revision was not found' using errcode = '40001';
  end if;

  update public.budget_revisions
  set name = normalized_name,
      start_on = requested_start_on,
      end_on = requested_end_on,
      currency_code = 'USD',
      change_reason = normalized_reason
  where organization_id = requested_organization_id
    and id = draft_revision_id
    and status = 'draft';

  perform private.replace_draft_budget_allocations(
    requested_organization_id,
    draft_revision_id,
    requested_allocations
  );

  update public.organization_budgets
  set version = version + 1
  where organization_id = requested_organization_id
    and id = requested_budget_id
    and version = requested_expected_version;
  if not found then
    raise exception 'Draft budget changed; refresh and try again' using errcode = '40001';
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
    'organization_budget.draft_updated',
    'organization_budget',
    requested_budget_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'revision_id', draft_revision_id,
      'reason', normalized_reason
    )
  );
end;
$$;

create function public.activate_budget(
  requested_organization_id uuid,
  requested_budget_id uuid,
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
  draft_revision_id uuid;
begin
  if exists (
    select 1 from public.audit_events as event
    where event.organization_id = requested_organization_id
      and event.request_id = requested_idempotency_key
      and event.action = 'organization_budget.activated'
      and event.target_id = requested_budget_id
  ) then
    return;
  end if;
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful activation reason is required' using errcode = '22023';
  end if;

  perform 1
  from public.organization_budgets as budget
  where budget.organization_id = requested_organization_id
    and budget.id = requested_budget_id
    and budget.status = 'draft'
    and budget.version = requested_expected_version
  for update;
  if not found then
    raise exception 'Draft budget changed or cannot be activated' using errcode = '40001';
  end if;

  select revision.id into draft_revision_id
  from public.budget_revisions as revision
  where revision.organization_id = requested_organization_id
    and revision.budget_id = requested_budget_id
    and revision.status = 'draft'
  for update;
  if not found then
    raise exception 'Draft revision was not found' using errcode = '40001';
  end if;
  if exists (
    select 1
    from public.budget_allocations as allocation
    join public.transaction_categories as category
      on category.organization_id = allocation.organization_id
      and category.id = allocation.category_id
    where allocation.organization_id = requested_organization_id
      and allocation.revision_id = draft_revision_id
      and category.status <> 'active'
  ) then
    raise exception 'Archived categories must be removed before activation'
      using errcode = '22023';
  end if;

  update public.budget_revisions
  set status = 'effective',
      change_reason = normalized_reason,
      approved_by = caller_id,
      approved_at = pg_catalog.now()
  where organization_id = requested_organization_id
    and id = draft_revision_id
    and status = 'draft';

  update public.organization_budgets
  set status = 'active',
      version = version + 1
  where organization_id = requested_organization_id
    and id = requested_budget_id
    and status = 'draft'
    and version = requested_expected_version;
  if not found then
    raise exception 'Budget changed during activation' using errcode = '40001';
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
    'organization_budget.activated',
    'organization_budget',
    requested_budget_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'budget_id', requested_budget_id,
      'revision_number', 1,
      'reason', normalized_reason
    )
  );
end;
$$;

create function public.revise_active_budget(
  requested_organization_id uuid,
  requested_budget_id uuid,
  requested_expected_version integer,
  requested_name text,
  requested_start_on date,
  requested_end_on date,
  requested_currency_code text,
  requested_allocations jsonb,
  requested_reason text,
  requested_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_name text := pg_catalog.btrim(requested_name);
  normalized_reason text := pg_catalog.btrim(requested_reason);
  current_revision_id uuid;
  current_revision_number integer;
  existing_revision_id uuid;
  new_revision_id uuid;
begin
  select revision.id into existing_revision_id
  from public.budget_revisions as revision
  where revision.organization_id = requested_organization_id
    and revision.idempotency_key = requested_idempotency_key;
  if existing_revision_id is not null then return existing_revision_id; end if;
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_name), 0) not between 2 and 120
    or requested_start_on is null
    or requested_end_on is null
    or requested_start_on > requested_end_on
    or requested_currency_code is distinct from 'USD'
  then
    raise exception 'Budget revision fields are invalid' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful revision reason is required' using errcode = '22023';
  end if;

  perform 1
  from public.organization_budgets as budget
  where budget.organization_id = requested_organization_id
    and budget.id = requested_budget_id
    and budget.status = 'active'
    and budget.version = requested_expected_version
  for update;
  if not found then
    raise exception 'Active budget changed or cannot be revised' using errcode = '40001';
  end if;

  select revision.id, revision.revision_number
  into current_revision_id, current_revision_number
  from public.budget_revisions as revision
  where revision.organization_id = requested_organization_id
    and revision.budget_id = requested_budget_id
    and revision.status = 'effective'
  for update;
  if not found then
    raise exception 'Effective budget revision was not found' using errcode = '40001';
  end if;

  update public.budget_revisions
  set status = 'superseded',
      superseded_at = pg_catalog.now()
  where organization_id = requested_organization_id
    and id = current_revision_id
    and status = 'effective';

  insert into public.budget_revisions (
    organization_id,
    budget_id,
    revision_number,
    name,
    start_on,
    end_on,
    currency_code,
    status,
    change_reason,
    created_by,
    idempotency_key
  ) values (
    requested_organization_id,
    requested_budget_id,
    current_revision_number + 1,
    normalized_name,
    requested_start_on,
    requested_end_on,
    'USD',
    'draft',
    normalized_reason,
    caller_id,
    requested_idempotency_key
  )
  returning id into new_revision_id;

  perform private.replace_draft_budget_allocations(
    requested_organization_id,
    new_revision_id,
    requested_allocations
  );

  update public.budget_revisions
  set status = 'effective',
      approved_by = caller_id,
      approved_at = pg_catalog.now()
  where organization_id = requested_organization_id
    and id = new_revision_id
    and status = 'draft';

  update public.organization_budgets
  set version = version + 1
  where organization_id = requested_organization_id
    and id = requested_budget_id
    and status = 'active'
    and version = requested_expected_version;
  if not found then
    raise exception 'Budget changed during revision' using errcode = '40001';
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
    'organization_budget.revised',
    'budget_revision',
    new_revision_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'budget_id', requested_budget_id,
      'previous_revision_id', current_revision_id,
      'revision_number', current_revision_number + 1,
      'reason', normalized_reason
    )
  );
  return new_revision_id;
end;
$$;

create function public.close_budget(
  requested_organization_id uuid,
  requested_budget_id uuid,
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
  current_revision_id uuid;
begin
  if exists (
    select 1 from public.audit_events as event
    where event.organization_id = requested_organization_id
      and event.request_id = requested_idempotency_key
      and event.action = 'organization_budget.closed'
      and event.target_id = requested_budget_id
  ) then
    return;
  end if;
  if requested_idempotency_key is null
    or requested_expected_version is null
    or requested_expected_version < 1
  then
    raise exception 'Valid workflow identifiers are required' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then
    raise exception 'A meaningful closure reason is required' using errcode = '22023';
  end if;

  perform 1
  from public.organization_budgets as budget
  where budget.organization_id = requested_organization_id
    and budget.id = requested_budget_id
    and budget.status in ('draft', 'active')
    and budget.version = requested_expected_version
  for update;
  if not found then
    raise exception 'Budget changed or is already closed' using errcode = '40001';
  end if;

  select revision.id into current_revision_id
  from public.budget_revisions as revision
  where revision.organization_id = requested_organization_id
    and revision.budget_id = requested_budget_id
    and revision.status in ('draft', 'effective')
  for update;
  if not found then
    raise exception 'Current budget revision was not found' using errcode = '40001';
  end if;

  update public.budget_revisions
  set status = 'closed'
  where organization_id = requested_organization_id
    and id = current_revision_id
    and status in ('draft', 'effective');

  update public.organization_budgets
  set status = 'closed',
      closed_by = caller_id,
      closed_at = pg_catalog.now(),
      close_reason = normalized_reason,
      version = version + 1
  where organization_id = requested_organization_id
    and id = requested_budget_id
    and status in ('draft', 'active')
    and version = requested_expected_version;
  if not found then
    raise exception 'Budget changed during closure' using errcode = '40001';
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
    'organization_budget.closed',
    'organization_budget',
    requested_budget_id,
    requested_idempotency_key,
    pg_catalog.jsonb_build_object(
      'revision_id', current_revision_id,
      'reason', normalized_reason
    )
  );
end;
$$;

revoke all on function public.create_organization_budget(
  uuid, text, date, date, text, jsonb, text, uuid
) from public, anon;
revoke all on function public.update_draft_budget(
  uuid, uuid, integer, text, date, date, text, jsonb, text, uuid
) from public, anon;
revoke all on function public.activate_budget(
  uuid, uuid, integer, text, uuid
) from public, anon;
revoke all on function public.revise_active_budget(
  uuid, uuid, integer, text, date, date, text, jsonb, text, uuid
) from public, anon;
revoke all on function public.close_budget(
  uuid, uuid, integer, text, uuid
) from public, anon;

grant execute on function public.create_organization_budget(
  uuid, text, date, date, text, jsonb, text, uuid
) to authenticated;
grant execute on function public.update_draft_budget(
  uuid, uuid, integer, text, date, date, text, jsonb, text, uuid
) to authenticated;
grant execute on function public.activate_budget(
  uuid, uuid, integer, text, uuid
) to authenticated;
grant execute on function public.revise_active_budget(
  uuid, uuid, integer, text, date, date, text, jsonb, text, uuid
) to authenticated;
grant execute on function public.close_budget(
  uuid, uuid, integer, text, uuid
) to authenticated;

commit;
