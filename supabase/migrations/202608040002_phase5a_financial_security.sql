begin;

create or replace function private.require_financial_treasurer(requested_organization_id uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not private.has_organization_role(
    requested_organization_id,
    array['treasurer']::public.organization_role[]
  ) then
    raise exception 'Active treasurer membership required' using errcode = '42501';
  end if;
  return caller_id;
end;
$$;

create or replace function private.financial_local_date(requested_organization_id uuid)
returns date
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  organization_timezone text;
begin
  select settings.timezone into organization_timezone
  from public.organization_financial_settings as settings
  where settings.organization_id = requested_organization_id
    and settings.base_currency = 'USD';
  if organization_timezone is null then
    raise exception 'Financial settings must be configured first' using errcode = '22023';
  end if;
  return (pg_catalog.now() at time zone organization_timezone)::date;
end;
$$;

create function private.transaction_fingerprint(
  requested_organization_id uuid,
  requested_account_id uuid,
  requested_category_id uuid,
  requested_direction public.transaction_direction,
  requested_amount_minor bigint,
  requested_currency text,
  requested_transaction_date date,
  requested_description text,
  requested_reference text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select pg_catalog.encode(
    extensions.digest(
      pg_catalog.concat_ws(
        '|',
        requested_organization_id::text,
        requested_account_id::text,
        requested_category_id::text,
        requested_direction::text,
        requested_amount_minor::text,
        requested_currency,
        requested_transaction_date::text,
        pg_catalog.lower(pg_catalog.btrim(requested_description)),
        pg_catalog.lower(pg_catalog.btrim(coalesce(requested_reference, '')))
      ),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function private.require_financial_treasurer(uuid) from public, anon, authenticated;
revoke all on function private.financial_local_date(uuid) from public, anon, authenticated;
revoke all on function private.transaction_fingerprint(uuid, uuid, uuid, public.transaction_direction, bigint, text, date, text, text) from public, anon, authenticated;

create function private.audit_financial_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := auth.uid();
  event_action text;
  event_target_type text;
  event_target_id uuid;
  event_organization_id uuid;
  event_metadata jsonb := '{}'::jsonb;
begin
  if tg_table_name = 'financial_accounts' then
    event_target_type := 'financial_account';
    event_target_id := new.id;
    event_organization_id := new.organization_id;
    event_action := case
      when tg_op = 'INSERT' then 'financial_account.created'
      when old.status = 'active' and new.status = 'archived' then 'financial_account.archived'
      when old.status = 'archived' and new.status = 'active' then 'financial_account.restored'
      else 'financial_account.updated'
    end;
    event_metadata := pg_catalog.jsonb_build_object('name', new.name, 'account_type', new.account_type, 'status', new.status);
  elsif tg_table_name = 'account_opening_balance_entries' then
    event_target_type := 'account_opening_balance';
    event_target_id := new.id;
    event_organization_id := new.organization_id;
    event_action := case when new.supersedes_entry_id is null then 'opening_balance.created' else 'opening_balance.replaced' end;
    event_metadata := pg_catalog.jsonb_build_object(
      'account_id', new.account_id,
      'amount_minor', new.amount_minor,
      'effective_on', new.effective_on,
      'supersedes_entry_id', new.supersedes_entry_id,
      'reason', new.reason
    );
  elsif tg_table_name = 'transaction_categories' then
    event_target_type := 'transaction_category';
    event_target_id := new.id;
    event_organization_id := new.organization_id;
    event_action := case
      when tg_op = 'INSERT' then 'transaction_category.created'
      when old.status = 'active' and new.status = 'archived' then 'transaction_category.archived'
      when old.status = 'archived' and new.status = 'active' then 'transaction_category.restored'
      else 'transaction_category.updated'
    end;
    event_metadata := pg_catalog.jsonb_build_object('name', new.name, 'direction', new.direction, 'status', new.status);
  elsif tg_table_name = 'financial_transactions' then
    event_target_type := 'financial_transaction';
    event_target_id := new.id;
    event_organization_id := new.organization_id;
    event_action := case
      when tg_op = 'INSERT' and new.source = 'csv_import' then 'financial_transaction.imported'
      when tg_op = 'INSERT' and new.replaces_transaction_id is not null then 'financial_transaction.replacement_created'
      when tg_op = 'INSERT' then 'financial_transaction.created'
      when old.status = 'posted' and new.status = 'voided' and exists (
        select 1 from public.financial_transactions as replacement
        where replacement.replaces_transaction_id = new.id
      ) then 'financial_transaction.corrected'
      when old.status = 'posted' and new.status = 'voided' then 'financial_transaction.voided'
      else 'financial_transaction.updated'
    end;
    event_metadata := pg_catalog.jsonb_build_object(
      'account_id', new.account_id,
      'category_id', new.category_id,
      'direction', new.direction,
      'amount_minor', new.amount_minor,
      'currency_code', new.currency_code,
      'transaction_date', new.transaction_date,
      'status', new.status,
      'source', new.source,
      'replaces_transaction_id', new.replaces_transaction_id,
      'void_reason', new.void_reason
    );
  elsif tg_table_name = 'transaction_import_batches' then
    event_target_type := 'transaction_import_batch';
    event_target_id := new.id;
    event_organization_id := new.organization_id;
    event_action := case
      when tg_op = 'INSERT' then 'transaction_import.previewed'
      when old.status is distinct from new.status and new.status = 'committed' then 'transaction_import.committed'
      when old.status is distinct from new.status and new.status = 'cancelled' then 'transaction_import.cancelled'
      else 'transaction_import.updated'
    end;
    event_metadata := pg_catalog.jsonb_build_object(
      'file_sha256', new.file_sha256,
      'status', new.status,
      'row_count', new.row_count,
      'valid_count', new.valid_count,
      'invalid_count', new.invalid_count,
      'duplicate_count', new.duplicate_count
    );
  elsif tg_table_name = 'transaction_import_rows' then
    if tg_op <> 'UPDATE' or old.status = new.status then return new; end if;
    event_target_type := 'transaction_import_batch';
    event_target_id := new.batch_id;
    event_organization_id := new.organization_id;
    event_action := 'transaction_import.duplicate_resolved';
    event_metadata := pg_catalog.jsonb_build_object(
      'row_number', new.row_number,
      'resolution', new.status,
      'reason', new.resolution_reason
    );
  else
    raise exception 'Unsupported financial audit table';
  end if;

  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    event_organization_id, caller_id, event_action, event_target_type, event_target_id, event_metadata
  );
  return new;
end;
$$;

revoke all on function private.audit_financial_change() from public, anon, authenticated;

create trigger financial_accounts_audit
after insert or update on public.financial_accounts
for each row execute function private.audit_financial_change();

create trigger account_opening_balances_audit
after insert on public.account_opening_balance_entries
for each row execute function private.audit_financial_change();

create trigger transaction_categories_audit
after insert or update on public.transaction_categories
for each row execute function private.audit_financial_change();

create trigger financial_transactions_audit
after insert or update on public.financial_transactions
for each row execute function private.audit_financial_change();

create trigger transaction_import_batches_audit
after insert or update on public.transaction_import_batches
for each row execute function private.audit_financial_change();

create trigger transaction_import_rows_audit
after update on public.transaction_import_rows
for each row execute function private.audit_financial_change();

alter table public.organization_financial_settings enable row level security;
alter table public.financial_accounts enable row level security;
alter table public.account_opening_balance_entries enable row level security;
alter table public.transaction_categories enable row level security;
alter table public.financial_transactions enable row level security;
alter table public.transaction_import_batches enable row level security;
alter table public.transaction_import_rows enable row level security;

create policy organization_financial_settings_select_officers
on public.organization_financial_settings for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy financial_accounts_select_officers
on public.financial_accounts for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy opening_balances_select_officers
on public.account_opening_balance_entries for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy transaction_categories_select_officers
on public.transaction_categories for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy financial_transactions_select_officers
on public.financial_transactions for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer', 'president', 'executive']::public.organization_role[]
)));

create policy transaction_import_batches_select_treasurer
on public.transaction_import_batches for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer']::public.organization_role[]
)));

create policy transaction_import_rows_select_treasurer
on public.transaction_import_rows for select to authenticated
using ((select private.has_organization_role(
  organization_id,
  array['treasurer']::public.organization_role[]
)));

create policy audit_events_select_financial_president
on public.audit_events for select to authenticated
using (
  target_type in (
    'financial_settings',
    'financial_account',
    'account_opening_balance',
    'transaction_category',
    'financial_transaction',
    'transaction_import_batch'
  )
  and (select private.has_organization_role(
    organization_id,
    array['president']::public.organization_role[]
  ))
);

revoke all on table public.organization_financial_settings from anon, authenticated;
revoke all on table public.financial_accounts from anon, authenticated;
revoke all on table public.account_opening_balance_entries from anon, authenticated;
revoke all on table public.transaction_categories from anon, authenticated;
revoke all on table public.financial_transactions from anon, authenticated;
revoke all on table public.transaction_import_batches from anon, authenticated;
revoke all on table public.transaction_import_rows from anon, authenticated;

grant select on table public.organization_financial_settings to authenticated;
grant select on table public.financial_accounts to authenticated;
grant select on table public.account_opening_balance_entries to authenticated;
grant select on table public.transaction_categories to authenticated;
grant select on table public.financial_transactions to authenticated;
grant select on table public.transaction_import_batches to authenticated;
grant select on table public.transaction_import_rows to authenticated;

create function public.configure_financial_context(
  requested_organization_id uuid,
  requested_timezone text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_timezone text := pg_catalog.btrim(requested_timezone);
begin
  if not exists (
    select 1 from pg_catalog.pg_timezone_names as timezone_name
    where timezone_name.name = normalized_timezone
  ) then
    raise exception 'Invalid IANA timezone' using errcode = '22023';
  end if;
  insert into public.organization_financial_settings (
    organization_id, timezone, base_currency, configured_by
  ) values (
    requested_organization_id, normalized_timezone, 'USD', caller_id
  )
  on conflict (organization_id) do update
  set timezone = excluded.timezone,
      base_currency = 'USD',
      configured_by = caller_id,
      configured_at = pg_catalog.now();
  insert into public.audit_events (
    organization_id, actor_user_id, action, target_type, target_id, metadata
  ) values (
    requested_organization_id,
    caller_id,
    'financial_settings.configured',
    'financial_settings',
    requested_organization_id,
    pg_catalog.jsonb_build_object('timezone', normalized_timezone, 'base_currency', 'USD')
  );
end;
$$;

create function public.create_financial_account(
  requested_organization_id uuid,
  requested_name text,
  requested_account_type public.financial_account_type,
  requested_currency_code text,
  requested_opening_amount_minor bigint default null,
  requested_opening_effective_on date default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  new_account_id uuid;
  normalized_name text := pg_catalog.btrim(requested_name);
begin
  perform private.financial_local_date(requested_organization_id);
  if requested_currency_code is distinct from 'USD' then raise exception 'Only USD is supported' using errcode = '22023'; end if;
  if coalesce(pg_catalog.char_length(normalized_name), 0) not between 2 and 100 then raise exception 'Invalid account name' using errcode = '22023'; end if;
  if (requested_opening_amount_minor is null) <> (requested_opening_effective_on is null) then
    raise exception 'Opening amount and effective date must be supplied together' using errcode = '22023';
  end if;
  if requested_opening_amount_minor is not null and requested_opening_amount_minor not between -999999999999 and 999999999999 then
    raise exception 'Opening amount is outside the supported range' using errcode = '22003';
  end if;
  if requested_opening_effective_on is not null and requested_opening_effective_on > private.financial_local_date(requested_organization_id) then
    raise exception 'Opening balance cannot be future dated' using errcode = '22023';
  end if;
  insert into public.financial_accounts (organization_id, name, account_type, currency_code, created_by)
  values (requested_organization_id, normalized_name, requested_account_type, 'USD', caller_id)
  returning id into new_account_id;
  if requested_opening_amount_minor is not null then
    insert into public.account_opening_balance_entries (
      organization_id, account_id, amount_minor, effective_on, created_by
    ) values (
      requested_organization_id, new_account_id, requested_opening_amount_minor,
      requested_opening_effective_on, caller_id
    );
  end if;
  return new_account_id;
end;
$$;

create function public.set_financial_account_status(
  requested_organization_id uuid,
  requested_account_id uuid,
  requested_status public.financial_record_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
begin
  update public.financial_accounts
  set status = requested_status,
      archived_by = case when requested_status = 'archived' then caller_id else null end,
      archived_at = case when requested_status = 'archived' then pg_catalog.now() else null end,
      version = version + 1
  where organization_id = requested_organization_id and id = requested_account_id;
  if not found then raise exception 'Financial account not found' using errcode = 'P0002'; end if;
end;
$$;

create function public.replace_account_opening_balance(
  requested_organization_id uuid,
  requested_account_id uuid,
  requested_current_entry_id uuid,
  requested_amount_minor bigint,
  requested_effective_on date,
  requested_reason text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  new_entry_id uuid;
  normalized_reason text := pg_catalog.btrim(requested_reason);
begin
  if requested_amount_minor is null or requested_amount_minor not between -999999999999 and 999999999999 then raise exception 'Opening amount is outside the supported range' using errcode = '22003'; end if;
  if requested_effective_on is null or requested_effective_on > private.financial_local_date(requested_organization_id) then raise exception 'Opening balance must have a non-future effective date' using errcode = '22023'; end if;
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then raise exception 'A meaningful reason is required' using errcode = '22023'; end if;
  perform 1 from public.account_opening_balance_entries as entry
  where entry.organization_id = requested_organization_id
    and entry.account_id = requested_account_id
    and entry.id = requested_current_entry_id
    and not exists (
      select 1 from public.account_opening_balance_entries as successor
      where successor.supersedes_entry_id = entry.id
    )
  for update;
  if not found then raise exception 'Current opening balance was changed or not found' using errcode = '40001'; end if;
  insert into public.account_opening_balance_entries (
    organization_id, account_id, amount_minor, effective_on,
    supersedes_entry_id, reason, created_by
  ) values (
    requested_organization_id, requested_account_id, requested_amount_minor,
    requested_effective_on, requested_current_entry_id, normalized_reason, caller_id
  ) returning id into new_entry_id;
  return new_entry_id;
end;
$$;

create function public.create_transaction_category(
  requested_organization_id uuid,
  requested_name text,
  requested_direction public.transaction_direction
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  new_category_id uuid;
  normalized_name text := pg_catalog.btrim(requested_name);
begin
  perform private.financial_local_date(requested_organization_id);
  if coalesce(pg_catalog.char_length(normalized_name), 0) not between 2 and 100 then raise exception 'Invalid category name' using errcode = '22023'; end if;
  insert into public.transaction_categories (organization_id, name, direction, created_by)
  values (requested_organization_id, normalized_name, requested_direction, caller_id)
  returning id into new_category_id;
  return new_category_id;
end;
$$;

create function public.set_transaction_category_status(
  requested_organization_id uuid,
  requested_category_id uuid,
  requested_status public.financial_record_status
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
begin
  update public.transaction_categories
  set status = requested_status,
      archived_by = case when requested_status = 'archived' then caller_id else null end,
      archived_at = case when requested_status = 'archived' then pg_catalog.now() else null end,
      version = version + 1
  where organization_id = requested_organization_id and id = requested_category_id;
  if not found then raise exception 'Transaction category not found' using errcode = 'P0002'; end if;
end;
$$;

create function private.insert_financial_transaction(
  requested_organization_id uuid,
  requested_account_id uuid,
  requested_category_id uuid,
  requested_direction public.transaction_direction,
  requested_amount_minor bigint,
  requested_transaction_date date,
  requested_description text,
  requested_reference text,
  requested_note text,
  requested_source public.transaction_source,
  requested_external_id text,
  requested_import_batch_id uuid,
  requested_import_row_number integer,
  requested_idempotency_key uuid,
  requested_replaces_transaction_id uuid,
  requested_created_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_transaction_id uuid;
  normalized_description text := pg_catalog.btrim(requested_description);
  normalized_reference text := nullif(pg_catalog.btrim(requested_reference), '');
  normalized_note text := nullif(pg_catalog.btrim(requested_note), '');
  normalized_external_id text := nullif(pg_catalog.btrim(requested_external_id), '');
  transaction_fingerprint text;
begin
  if requested_amount_minor is null or requested_amount_minor not between 1 and 999999999999 then raise exception 'Amount must be positive integer cents within the supported range' using errcode = '22003'; end if;
  if requested_transaction_date is null or requested_transaction_date > private.financial_local_date(requested_organization_id) then raise exception 'Posted transactions require a non-future date' using errcode = '22023'; end if;
  if coalesce(pg_catalog.char_length(normalized_description), 0) not between 2 and 200 then raise exception 'Invalid description' using errcode = '22023'; end if;
  if normalized_reference is not null and pg_catalog.char_length(normalized_reference) > 100 then raise exception 'Reference is too long' using errcode = '22023'; end if;
  if normalized_note is not null and pg_catalog.char_length(normalized_note) > 500 then raise exception 'Note is too long' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.financial_accounts as account
    where account.organization_id = requested_organization_id
      and account.id = requested_account_id
      and account.status = 'active'
      and account.currency_code = 'USD'
  ) then raise exception 'Active financial account not found' using errcode = '22023'; end if;
  if not exists (
    select 1 from public.transaction_categories as category
    where category.organization_id = requested_organization_id
      and category.id = requested_category_id
      and category.status = 'active'
      and category.direction = requested_direction
  ) then raise exception 'Active matching category not found' using errcode = '22023'; end if;
  transaction_fingerprint := private.transaction_fingerprint(
    requested_organization_id, requested_account_id, requested_category_id,
    requested_direction, requested_amount_minor, 'USD', requested_transaction_date,
    normalized_description, normalized_reference
  );
  insert into public.financial_transactions (
    organization_id, account_id, category_id, direction, amount_minor,
    currency_code, transaction_date, description, reference, note, source,
    external_id, import_batch_id, import_row_number, idempotency_key,
    duplicate_fingerprint, replaces_transaction_id, created_by
  ) values (
    requested_organization_id, requested_account_id, requested_category_id,
    requested_direction, requested_amount_minor, 'USD', requested_transaction_date,
    normalized_description, normalized_reference, normalized_note, requested_source,
    normalized_external_id, requested_import_batch_id, requested_import_row_number,
    requested_idempotency_key, transaction_fingerprint,
    requested_replaces_transaction_id, requested_created_by
  ) returning id into new_transaction_id;
  return new_transaction_id;
end;
$$;

revoke all on function private.insert_financial_transaction(uuid, uuid, uuid, public.transaction_direction, bigint, date, text, text, text, public.transaction_source, text, uuid, integer, uuid, uuid, uuid) from public, anon, authenticated;

create function public.create_manual_transaction(
  requested_organization_id uuid,
  requested_account_id uuid,
  requested_category_id uuid,
  requested_direction public.transaction_direction,
  requested_amount_minor bigint,
  requested_transaction_date date,
  requested_description text,
  requested_reference text,
  requested_note text,
  requested_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  existing_transaction_id uuid;
begin
  select transaction.id into existing_transaction_id
  from public.financial_transactions as transaction
  where transaction.organization_id = requested_organization_id
    and transaction.idempotency_key = requested_idempotency_key;
  if existing_transaction_id is not null then return existing_transaction_id; end if;
  return private.insert_financial_transaction(
    requested_organization_id, requested_account_id, requested_category_id,
    requested_direction, requested_amount_minor, requested_transaction_date,
    requested_description, requested_reference, requested_note, 'manual',
    null, null, null, requested_idempotency_key, null, caller_id
  );
end;
$$;

create function public.void_financial_transaction(
  requested_organization_id uuid,
  requested_transaction_id uuid,
  requested_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := private.require_financial_treasurer(requested_organization_id);
  normalized_reason text := pg_catalog.btrim(requested_reason);
begin
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then raise exception 'A meaningful void reason is required' using errcode = '22023'; end if;
  perform 1 from public.financial_transactions
  where organization_id = requested_organization_id and id = requested_transaction_id
  for update;
  if not found then raise exception 'Transaction not found' using errcode = 'P0002'; end if;
  update public.financial_transactions
  set status = 'voided', voided_by = caller_id, voided_at = pg_catalog.now(),
      void_reason = normalized_reason, version = version + 1
  where organization_id = requested_organization_id
    and id = requested_transaction_id
    and status = 'posted';
  if not found then raise exception 'Transaction is already voided' using errcode = '40001'; end if;
end;
$$;

create function public.correct_financial_transaction(
  requested_organization_id uuid,
  requested_original_transaction_id uuid,
  requested_account_id uuid,
  requested_category_id uuid,
  requested_direction public.transaction_direction,
  requested_amount_minor bigint,
  requested_transaction_date date,
  requested_description text,
  requested_reference text,
  requested_note text,
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
  normalized_reason text := pg_catalog.btrim(requested_reason);
  replacement_id uuid;
begin
  if coalesce(pg_catalog.char_length(normalized_reason), 0) not between 5 and 500 then raise exception 'A meaningful correction reason is required' using errcode = '22023'; end if;
  perform 1 from public.financial_transactions
  where organization_id = requested_organization_id
    and id = requested_original_transaction_id
    and status = 'posted'
  for update;
  if not found then raise exception 'Posted transaction not found or already changed' using errcode = '40001'; end if;
  replacement_id := private.insert_financial_transaction(
    requested_organization_id, requested_account_id, requested_category_id,
    requested_direction, requested_amount_minor, requested_transaction_date,
    requested_description, requested_reference, requested_note, 'manual',
    null, null, null, requested_idempotency_key,
    requested_original_transaction_id, caller_id
  );
  update public.financial_transactions
  set status = 'voided', voided_by = caller_id, voided_at = pg_catalog.now(),
      void_reason = 'Corrected: ' || normalized_reason, version = version + 1
  where organization_id = requested_organization_id and id = requested_original_transaction_id;
  return replacement_id;
end;
$$;

revoke all on function public.configure_financial_context(uuid, text) from public, anon;
revoke all on function public.create_financial_account(uuid, text, public.financial_account_type, text, bigint, date) from public, anon;
revoke all on function public.set_financial_account_status(uuid, uuid, public.financial_record_status) from public, anon;
revoke all on function public.replace_account_opening_balance(uuid, uuid, uuid, bigint, date, text) from public, anon;
revoke all on function public.create_transaction_category(uuid, text, public.transaction_direction) from public, anon;
revoke all on function public.set_transaction_category_status(uuid, uuid, public.financial_record_status) from public, anon;
revoke all on function public.create_manual_transaction(uuid, uuid, uuid, public.transaction_direction, bigint, date, text, text, text, uuid) from public, anon;
revoke all on function public.void_financial_transaction(uuid, uuid, text) from public, anon;
revoke all on function public.correct_financial_transaction(uuid, uuid, uuid, uuid, public.transaction_direction, bigint, date, text, text, text, text, uuid) from public, anon;

grant execute on function public.configure_financial_context(uuid, text) to authenticated;
grant execute on function public.create_financial_account(uuid, text, public.financial_account_type, text, bigint, date) to authenticated;
grant execute on function public.set_financial_account_status(uuid, uuid, public.financial_record_status) to authenticated;
grant execute on function public.replace_account_opening_balance(uuid, uuid, uuid, bigint, date, text) to authenticated;
grant execute on function public.create_transaction_category(uuid, text, public.transaction_direction) to authenticated;
grant execute on function public.set_transaction_category_status(uuid, uuid, public.financial_record_status) to authenticated;
grant execute on function public.create_manual_transaction(uuid, uuid, uuid, public.transaction_direction, bigint, date, text, text, text, uuid) to authenticated;
grant execute on function public.void_financial_transaction(uuid, uuid, text) to authenticated;
grant execute on function public.correct_financial_transaction(uuid, uuid, uuid, uuid, public.transaction_direction, bigint, date, text, text, text, text, uuid) to authenticated;

commit;
