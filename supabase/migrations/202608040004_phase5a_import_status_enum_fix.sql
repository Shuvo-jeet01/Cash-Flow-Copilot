begin;

create or replace function public.create_transaction_import_preview(
  requested_organization_id uuid,
  requested_file_name text,
  requested_file_sha256 text,
  requested_rows jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  new_batch_id uuid;
  source_row jsonb;
  source_position integer;
  row_number_value integer;
  account_id_value uuid;
  category_id_value uuid;
  direction_value public.transaction_direction;
  amount_minor_value bigint;
  transaction_date_value date;
  description_value text;
  reference_value text;
  note_value text;
  external_id_value text;
  currency_value text;
  errors_value jsonb;
  fingerprint_value text;
  row_hash_value text;
  duplicate_ids uuid[];
  row_status_value public.import_row_status;
  current_local_date date := private.financial_local_date(requested_organization_id);
begin
  if coalesce(pg_catalog.char_length(pg_catalog.btrim(requested_file_name)), 0) not between 1 and 255 then
    raise exception 'Invalid file name' using errcode = '22023';
  end if;
  if coalesce(requested_file_sha256, '') !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid file fingerprint' using errcode = '22023';
  end if;
  if requested_rows is null or pg_catalog.jsonb_typeof(requested_rows) <> 'array' then
    raise exception 'Import rows must be an array' using errcode = '22023';
  end if;
  if pg_catalog.jsonb_array_length(requested_rows) not between 1 and 5000 then
    raise exception 'CSV must contain between 1 and 5000 rows' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.transaction_import_batches as batch
    where batch.organization_id = requested_organization_id
      and batch.file_sha256 = requested_file_sha256
      and batch.status = 'committed'
  ) then
    raise exception 'This file was already imported' using errcode = '23505';
  end if;

  insert into public.transaction_import_batches (
    organization_id, file_name, file_sha256, created_by
  ) values (
    requested_organization_id, pg_catalog.btrim(requested_file_name), requested_file_sha256, caller_id
  ) returning id into new_batch_id;

  for source_row, source_position in
    select item.value, item.ordinality::integer
    from pg_catalog.jsonb_array_elements(requested_rows) with ordinality as item(value, ordinality)
  loop
    row_number_value := source_position;
    account_id_value := null;
    category_id_value := null;
    direction_value := null;
    amount_minor_value := null;
    transaction_date_value := null;
    description_value := pg_catalog.btrim(source_row->>'description');
    reference_value := nullif(pg_catalog.btrim(source_row->>'reference'), '');
    note_value := nullif(pg_catalog.btrim(source_row->>'note'), '');
    external_id_value := nullif(pg_catalog.btrim(source_row->>'external_id'), '');
    currency_value := pg_catalog.upper(pg_catalog.btrim(source_row->>'currency'));
    errors_value := '[]'::jsonb;
    fingerprint_value := null;
    row_hash_value := null;
    duplicate_ids := '{}'::uuid[];

    if coalesce(source_row->>'account_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      account_id_value := (source_row->>'account_id')::uuid;
    else
      errors_value := errors_value || pg_catalog.jsonb_build_array('Account is missing or unknown.');
    end if;

    if coalesce(source_row->>'category_id', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$' then
      category_id_value := (source_row->>'category_id')::uuid;
    else
      errors_value := errors_value || pg_catalog.jsonb_build_array('Category is missing or unknown.');
    end if;

    if source_row->>'direction' = 'income' then direction_value := 'income';
    elsif source_row->>'direction' = 'expense' then direction_value := 'expense';
    else errors_value := errors_value || pg_catalog.jsonb_build_array('Direction must be income or expense.');
    end if;

    if coalesce(source_row->>'amount_minor', '') ~ '^[1-9][0-9]{0,11}$' then
      amount_minor_value := (source_row->>'amount_minor')::bigint;
      if amount_minor_value > 999999999999 then
        amount_minor_value := null;
        errors_value := errors_value || pg_catalog.jsonb_build_array('Amount is outside the supported range.');
      end if;
    else
      errors_value := errors_value || pg_catalog.jsonb_build_array('Amount must be positive integer cents.');
    end if;

    if coalesce(source_row->>'transaction_date', '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
      begin
        transaction_date_value := pg_catalog.to_date(source_row->>'transaction_date', 'YYYY-MM-DD');
      exception when others then
        transaction_date_value := null;
      end;
      if transaction_date_value is null
        or pg_catalog.to_char(transaction_date_value, 'YYYY-MM-DD') <> source_row->>'transaction_date'
      then errors_value := errors_value || pg_catalog.jsonb_build_array('Transaction date is invalid.');
      elsif transaction_date_value > current_local_date then
        errors_value := errors_value || pg_catalog.jsonb_build_array('Future transaction dates are not allowed.');
      end if;
    else
      errors_value := errors_value || pg_catalog.jsonb_build_array('Transaction date must use YYYY-MM-DD.');
    end if;

    if currency_value is distinct from 'USD' then errors_value := errors_value || pg_catalog.jsonb_build_array('Currency must be USD.'); end if;
    if coalesce(pg_catalog.char_length(description_value), 0) not between 2 and 200 then errors_value := errors_value || pg_catalog.jsonb_build_array('Description must be 2 to 200 characters.'); end if;
    if reference_value is not null and pg_catalog.char_length(reference_value) > 100 then errors_value := errors_value || pg_catalog.jsonb_build_array('Reference must be 100 characters or fewer.'); end if;
    if note_value is not null and pg_catalog.char_length(note_value) > 500 then errors_value := errors_value || pg_catalog.jsonb_build_array('Note must be 500 characters or fewer.'); end if;
    if external_id_value is not null and pg_catalog.char_length(external_id_value) > 150 then errors_value := errors_value || pg_catalog.jsonb_build_array('External ID must be 150 characters or fewer.'); end if;

    if account_id_value is not null and not exists (
      select 1 from public.financial_accounts as account
      where account.organization_id = requested_organization_id
        and account.id = account_id_value and account.status = 'active'
    ) then errors_value := errors_value || pg_catalog.jsonb_build_array('Account is inactive or belongs to another organization.'); end if;

    if category_id_value is not null and direction_value is not null and not exists (
      select 1 from public.transaction_categories as category
      where category.organization_id = requested_organization_id
        and category.id = category_id_value and category.status = 'active'
        and category.direction = direction_value
    ) then errors_value := errors_value || pg_catalog.jsonb_build_array('Category is inactive, mismatched, or belongs to another organization.'); end if;

    if pg_catalog.jsonb_array_length(errors_value) = 0 then
      fingerprint_value := private.transaction_fingerprint(
        requested_organization_id, account_id_value, category_id_value,
        direction_value, amount_minor_value, 'USD', transaction_date_value,
        description_value, reference_value
      );
      row_hash_value := pg_catalog.encode(
        extensions.digest(
          pg_catalog.concat_ws('|', fingerprint_value, coalesce(external_id_value, ''), coalesce(note_value, '')),
          'sha256'
        ),
        'hex'
      );
      select coalesce(pg_catalog.array_agg(transaction.id order by transaction.id), '{}'::uuid[])
      into duplicate_ids
      from public.financial_transactions as transaction
      where transaction.organization_id = requested_organization_id
        and (
          transaction.duplicate_fingerprint = fingerprint_value
          or (external_id_value is not null and transaction.account_id = account_id_value and transaction.external_id = external_id_value)
        );
      if pg_catalog.cardinality(duplicate_ids) > 0 or exists (
        select 1 from public.transaction_import_rows as prior_row
        where prior_row.organization_id = requested_organization_id
          and prior_row.batch_id = new_batch_id
          and prior_row.duplicate_fingerprint = fingerprint_value
      ) then row_status_value := 'possible_duplicate';
      else row_status_value := 'valid';
      end if;
    else
      row_status_value := 'invalid';
    end if;

    insert into public.transaction_import_rows (
      organization_id, batch_id, row_number, account_id, category_id,
      direction, amount_minor, currency_code, transaction_date, description,
      reference, note, external_id, row_hash, duplicate_fingerprint,
      status, validation_errors, duplicate_transaction_ids
    ) values (
      requested_organization_id, new_batch_id, row_number_value, account_id_value,
      category_id_value, direction_value, amount_minor_value,
      case when pg_catalog.char_length(currency_value) = 3 then currency_value else null end,
      transaction_date_value, description_value, reference_value, note_value,
      external_id_value, row_hash_value, fingerprint_value, row_status_value,
      errors_value, duplicate_ids
    );
  end loop;

  update public.transaction_import_batches as batch
  set row_count = aggregate.row_count,
      valid_count = aggregate.valid_count,
      invalid_count = aggregate.invalid_count,
      duplicate_count = aggregate.duplicate_count,
      income_total_minor = aggregate.income_total_minor,
      expense_total_minor = aggregate.expense_total_minor,
      status = case
        when aggregate.invalid_count = 0 and aggregate.duplicate_count = 0
          then 'ready'::public.import_batch_status
        else 'review'::public.import_batch_status
      end,
      version = version + 1
  from (
    select
      pg_catalog.count(*)::integer as row_count,
      pg_catalog.count(*) filter (where import_row.status = 'valid')::integer as valid_count,
      pg_catalog.count(*) filter (where import_row.status = 'invalid')::integer as invalid_count,
      pg_catalog.count(*) filter (where import_row.status = 'possible_duplicate')::integer as duplicate_count,
      coalesce(pg_catalog.sum(import_row.amount_minor) filter (where import_row.direction = 'income' and import_row.status <> 'invalid'), 0) as income_total_minor,
      coalesce(pg_catalog.sum(import_row.amount_minor) filter (where import_row.direction = 'expense' and import_row.status <> 'invalid'), 0) as expense_total_minor
    from public.transaction_import_rows as import_row
    where import_row.organization_id = requested_organization_id and import_row.batch_id = new_batch_id
  ) as aggregate
  where batch.id = new_batch_id;
  return new_batch_id;
end;
$$;

create or replace function public.resolve_transaction_import_duplicate(
  requested_organization_id uuid,
  requested_batch_id uuid,
  requested_row_id uuid,
  requested_resolution text,
  requested_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  next_status public.import_row_status;
  normalized_reason text := pg_catalog.btrim(requested_reason);
  batch_status public.import_batch_status;
  existing_status public.import_row_status;
  existing_reason text;
begin
  if requested_resolution = 'accept_distinct' then next_status := 'accepted_distinct';
  elsif requested_resolution = 'skip_duplicate' then next_status := 'skipped_duplicate';
  else raise exception 'Invalid duplicate resolution' using errcode = '22023';
  end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then raise exception 'A meaningful duplicate resolution reason is required' using errcode = '22023'; end if;
  select status into batch_status from public.transaction_import_batches
  where organization_id = requested_organization_id and id = requested_batch_id
  for update;
  if not found then raise exception 'Import batch is not available for review' using errcode = '40001'; end if;
  select status, resolution_reason into existing_status, existing_reason
  from public.transaction_import_rows
  where organization_id = requested_organization_id and batch_id = requested_batch_id
    and id = requested_row_id
  for update;
  if not found then raise exception 'Duplicate row was not found' using errcode = 'P0002'; end if;
  if existing_status = next_status and existing_reason = normalized_reason then return; end if;
  if batch_status <> 'review' or existing_status <> 'possible_duplicate' then
    raise exception 'Duplicate row was already resolved' using errcode = '40001';
  end if;
  update public.transaction_import_rows
  set status = next_status, resolution_reason = normalized_reason
  where organization_id = requested_organization_id and batch_id = requested_batch_id
    and id = requested_row_id and status = 'possible_duplicate';
  update public.transaction_import_batches
  set status = case when not exists (
        select 1 from public.transaction_import_rows as import_row
        where import_row.organization_id = requested_organization_id
          and import_row.batch_id = requested_batch_id
          and import_row.status in ('invalid', 'possible_duplicate')
      ) then 'ready'::public.import_batch_status
        else 'review'::public.import_batch_status
      end,
      duplicate_count = (
        select pg_catalog.count(*)::integer from public.transaction_import_rows as import_row
        where import_row.organization_id = requested_organization_id
          and import_row.batch_id = requested_batch_id
          and import_row.status = 'possible_duplicate'
      ),
      valid_count = (
        select pg_catalog.count(*)::integer from public.transaction_import_rows as import_row
        where import_row.organization_id = requested_organization_id
          and import_row.batch_id = requested_batch_id
          and import_row.status in ('valid', 'accepted_distinct')
      ),
      version = version + 1
  where organization_id = requested_organization_id and id = requested_batch_id;
end;
$$;

revoke all on function public.create_transaction_import_preview(uuid, text, text, jsonb) from public, anon;
revoke all on function public.resolve_transaction_import_duplicate(uuid, uuid, uuid, text, text) from public, anon;

grant execute on function public.create_transaction_import_preview(uuid, text, text, jsonb) to authenticated;
grant execute on function public.resolve_transaction_import_duplicate(uuid, uuid, uuid, text, text) to authenticated;

commit;
