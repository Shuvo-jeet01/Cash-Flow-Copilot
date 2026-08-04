begin;

alter table public.audit_events
  add column request_id uuid not null default extensions.gen_random_uuid();

alter table public.audit_events
  drop constraint if exists audit_events_target_type_check;

alter table public.audit_events
  add constraint audit_events_target_type_check check (
    target_type in (
      'organization',
      'organization_membership',
      'financial_settings',
      'financial_account',
      'account_opening_balance',
      'transaction_category',
      'financial_transaction',
      'transaction_import_batch'
    )
  );

create type public.financial_account_type as enum (
  'checking',
  'savings',
  'cash',
  'payment_platform',
  'other'
);

create type public.financial_record_status as enum ('active', 'archived');
create type public.transaction_direction as enum ('income', 'expense');
create type public.financial_transaction_status as enum ('posted', 'voided');
create type public.transaction_source as enum ('manual', 'csv_import');
create type public.import_batch_status as enum ('review', 'ready', 'committed', 'cancelled');
create type public.import_row_status as enum (
  'valid',
  'invalid',
  'possible_duplicate',
  'accepted_distinct',
  'skipped_duplicate'
);

create table public.organization_financial_settings (
  organization_id uuid primary key references public.organizations (id) on delete restrict,
  timezone text not null check (char_length(btrim(timezone)) between 3 and 100),
  base_currency character(3) not null default 'USD' check (base_currency = 'USD'),
  configured_by uuid not null references auth.users (id) on delete restrict,
  configured_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.financial_accounts (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  account_type public.financial_account_type not null,
  currency_code character(3) not null default 'USD' check (currency_code = 'USD'),
  status public.financial_record_status not null default 'active',
  created_by uuid not null references auth.users (id) on delete restrict,
  archived_by uuid references auth.users (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  check (
    (status = 'active' and archived_by is null and archived_at is null)
    or
    (status = 'archived' and archived_by is not null and archived_at is not null)
  )
);

create unique index financial_accounts_organization_name_idx
  on public.financial_accounts (organization_id, lower(btrim(name)));

create index financial_accounts_organization_status_idx
  on public.financial_accounts (organization_id, status, name);

create table public.account_opening_balance_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  account_id uuid not null,
  amount_minor bigint not null check (amount_minor between -999999999999 and 999999999999),
  effective_on date not null,
  supersedes_entry_id uuid,
  reason text check (reason is null or char_length(btrim(reason)) between 5 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (supersedes_entry_id),
  foreign key (organization_id, account_id)
    references public.financial_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, supersedes_entry_id)
    references public.account_opening_balance_entries (organization_id, id) on delete restrict,
  check (
    (supersedes_entry_id is null and reason is null)
    or
    (supersedes_entry_id is not null and reason is not null)
  ),
  check (id is distinct from supersedes_entry_id)
);

create unique index account_opening_balance_root_idx
  on public.account_opening_balance_entries (account_id)
  where supersedes_entry_id is null;

create index account_opening_balance_account_created_idx
  on public.account_opening_balance_entries (organization_id, account_id, created_at desc);

create table public.transaction_categories (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  name text not null check (char_length(btrim(name)) between 2 and 100),
  direction public.transaction_direction not null,
  status public.financial_record_status not null default 'active',
  created_by uuid not null references auth.users (id) on delete restrict,
  archived_by uuid references auth.users (id) on delete restrict,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  check (
    (status = 'active' and archived_by is null and archived_at is null)
    or
    (status = 'archived' and archived_by is not null and archived_at is not null)
  )
);

create unique index transaction_categories_organization_name_direction_idx
  on public.transaction_categories (organization_id, direction, lower(btrim(name)));

create index transaction_categories_organization_status_idx
  on public.transaction_categories (organization_id, status, direction, name);

create table public.transaction_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  file_name text not null check (char_length(file_name) between 1 and 255),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  template_version text not null default 'transactions-v1' check (template_version = 'transactions-v1'),
  status public.import_batch_status not null default 'review',
  row_count integer not null default 0 check (row_count between 0 and 5000),
  valid_count integer not null default 0 check (valid_count >= 0),
  invalid_count integer not null default 0 check (invalid_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0),
  income_total_minor bigint not null default 0 check (income_total_minor >= 0),
  expense_total_minor bigint not null default 0 check (expense_total_minor >= 0),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  committed_at timestamptz,
  cancelled_at timestamptz,
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  check (
    (status in ('review', 'ready') and committed_at is null and cancelled_at is null)
    or (status = 'committed' and committed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and committed_at is null and cancelled_at is not null)
  )
);

create unique index transaction_import_committed_file_idx
  on public.transaction_import_batches (organization_id, file_sha256)
  where status = 'committed';

create index transaction_import_batches_organization_status_idx
  on public.transaction_import_batches (organization_id, status, created_at desc);

create table public.financial_transactions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  account_id uuid not null,
  category_id uuid not null,
  direction public.transaction_direction not null,
  amount_minor bigint not null check (amount_minor between 1 and 999999999999),
  currency_code character(3) not null default 'USD' check (currency_code = 'USD'),
  transaction_date date not null,
  description text not null check (char_length(btrim(description)) between 2 and 200),
  reference text check (reference is null or char_length(btrim(reference)) between 1 and 100),
  note text check (note is null or char_length(btrim(note)) between 1 and 500),
  status public.financial_transaction_status not null default 'posted',
  source public.transaction_source not null,
  external_id text check (external_id is null or char_length(btrim(external_id)) between 1 and 150),
  import_batch_id uuid,
  import_row_number integer check (import_row_number is null or import_row_number > 0),
  idempotency_key uuid not null,
  duplicate_fingerprint text not null check (duplicate_fingerprint ~ '^[0-9a-f]{64}$'),
  replaces_transaction_id uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  voided_by uuid references auth.users (id) on delete restrict,
  voided_at timestamptz,
  void_reason text check (void_reason is null or char_length(btrim(void_reason)) between 5 and 500),
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  unique (replaces_transaction_id),
  foreign key (organization_id, account_id)
    references public.financial_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, category_id)
    references public.transaction_categories (organization_id, id) on delete restrict,
  foreign key (organization_id, import_batch_id)
    references public.transaction_import_batches (organization_id, id) on delete restrict,
  foreign key (organization_id, replaces_transaction_id)
    references public.financial_transactions (organization_id, id) on delete restrict,
  check (id is distinct from replaces_transaction_id),
  check (
    (source = 'manual' and import_batch_id is null and import_row_number is null and external_id is null)
    or
    (source = 'csv_import' and import_batch_id is not null and import_row_number is not null)
  ),
  check (
    (status = 'posted' and voided_by is null and voided_at is null and void_reason is null)
    or
    (status = 'voided' and voided_by is not null and voided_at is not null and void_reason is not null)
  )
);

create unique index financial_transactions_external_id_idx
  on public.financial_transactions (organization_id, account_id, external_id)
  where external_id is not null;

create index financial_transactions_stable_list_idx
  on public.financial_transactions (organization_id, transaction_date desc, created_at desc, id desc);

create index financial_transactions_account_date_idx
  on public.financial_transactions (organization_id, account_id, transaction_date desc, id desc);

create index financial_transactions_category_date_idx
  on public.financial_transactions (organization_id, category_id, transaction_date desc, id desc);

create index financial_transactions_filters_idx
  on public.financial_transactions (organization_id, direction, status, transaction_date desc, id desc);

create index financial_transactions_fingerprint_idx
  on public.financial_transactions (organization_id, duplicate_fingerprint);

create table public.transaction_import_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  batch_id uuid not null,
  row_number integer not null check (row_number between 1 and 5000),
  account_id uuid,
  category_id uuid,
  direction public.transaction_direction,
  amount_minor bigint check (amount_minor is null or amount_minor between 1 and 999999999999),
  currency_code character(3),
  transaction_date date,
  description text,
  reference text,
  note text,
  external_id text,
  row_hash text check (row_hash is null or row_hash ~ '^[0-9a-f]{64}$'),
  duplicate_fingerprint text check (duplicate_fingerprint is null or duplicate_fingerprint ~ '^[0-9a-f]{64}$'),
  status public.import_row_status not null,
  validation_errors jsonb not null default '[]'::jsonb check (jsonb_typeof(validation_errors) = 'array'),
  duplicate_transaction_ids uuid[] not null default '{}'::uuid[],
  resolution_reason text check (resolution_reason is null or char_length(btrim(resolution_reason)) between 5 and 500),
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (batch_id, row_number),
  foreign key (organization_id, batch_id)
    references public.transaction_import_batches (organization_id, id) on delete restrict,
  foreign key (organization_id, account_id)
    references public.financial_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, category_id)
    references public.transaction_categories (organization_id, id) on delete restrict,
  check (
    (status in ('accepted_distinct', 'skipped_duplicate') and resolution_reason is not null)
    or
    (status not in ('accepted_distinct', 'skipped_duplicate') and resolution_reason is null)
  )
);

create index transaction_import_rows_batch_idx
  on public.transaction_import_rows (organization_id, batch_id, row_number);

create index transaction_import_rows_fingerprint_idx
  on public.transaction_import_rows (organization_id, batch_id, duplicate_fingerprint);

create trigger organization_financial_settings_set_updated_at
before update on public.organization_financial_settings
for each row execute function public.set_updated_at();

create trigger financial_accounts_set_updated_at
before update on public.financial_accounts
for each row execute function public.set_updated_at();

create trigger transaction_categories_set_updated_at
before update on public.transaction_categories
for each row execute function public.set_updated_at();

commit;
