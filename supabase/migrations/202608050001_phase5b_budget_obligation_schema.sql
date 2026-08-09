begin;

create extension if not exists btree_gist with schema extensions;

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
      'transaction_import_batch',
      'organization_budget',
      'budget_revision',
      'financial_obligation',
      'minimum_reserve'
    )
  );

create unique index audit_events_organization_request_idx
  on public.audit_events (organization_id, request_id);

create type public.organization_budget_status as enum (
  'draft',
  'active',
  'closed'
);

create type public.budget_revision_status as enum (
  'draft',
  'effective',
  'superseded',
  'closed'
);

create type public.obligation_status as enum (
  'expected',
  'committed',
  'paid',
  'voided'
);

alter table public.organization_financial_settings
  add column minimum_reserve_minor bigint not null default 0
    check (minimum_reserve_minor between 0 and 999999999999),
  add column reserve_version integer not null default 1
    check (reserve_version > 0);

alter table public.transaction_categories
  add constraint transaction_categories_organization_id_direction_key
  unique (organization_id, id, direction);

create table public.organization_budgets (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  status public.organization_budget_status not null default 'draft',
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_by uuid references auth.users (id) on delete restrict,
  closed_at timestamptz,
  close_reason text check (
    close_reason is null
    or char_length(btrim(close_reason)) between 5 and 500
  ),
  idempotency_key uuid not null,
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  check (
    (status in ('draft', 'active') and closed_by is null and closed_at is null and close_reason is null)
    or
    (status = 'closed' and closed_by is not null and closed_at is not null and close_reason is not null)
  )
);

create index organization_budgets_status_idx
  on public.organization_budgets (organization_id, status, updated_at desc, id);

create table public.budget_revisions (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  budget_id uuid not null,
  revision_number integer not null check (revision_number > 0),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  start_on date not null,
  end_on date not null,
  currency_code character(3) not null default 'USD' check (currency_code = 'USD'),
  status public.budget_revision_status not null default 'draft',
  change_reason text not null check (char_length(btrim(change_reason)) between 5 and 500),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users (id) on delete restrict,
  approved_at timestamptz,
  superseded_at timestamptz,
  idempotency_key uuid not null,
  unique (organization_id, id),
  unique (organization_id, budget_id, revision_number),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, budget_id)
    references public.organization_budgets (organization_id, id) on delete restrict,
  check (start_on <= end_on),
  check (
    (status = 'draft' and approved_by is null and approved_at is null and superseded_at is null)
    or
    (status = 'effective' and approved_by is not null and approved_at is not null and superseded_at is null)
    or
    (status = 'superseded' and approved_by is not null and approved_at is not null and superseded_at is not null)
    or
    (
      status = 'closed'
      and superseded_at is null
      and (
        (approved_by is null and approved_at is null)
        or (approved_by is not null and approved_at is not null)
      )
    )
  )
);

create unique index budget_revisions_current_idx
  on public.budget_revisions (organization_id, budget_id)
  where status in ('draft', 'effective');

alter table public.budget_revisions
  add constraint budget_revisions_no_overlapping_effective_periods
  exclude using gist (
    organization_id with =,
    daterange(start_on, end_on, '[]') with &&
  )
  where (status = 'effective');

create index budget_revisions_period_idx
  on public.budget_revisions (organization_id, status, start_on, end_on);

create table public.budget_allocations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  revision_id uuid not null,
  category_id uuid not null,
  direction public.transaction_direction not null,
  amount_minor bigint not null check (amount_minor between 0 and 999999999999),
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (organization_id, id),
  unique (revision_id, category_id),
  foreign key (organization_id, revision_id)
    references public.budget_revisions (organization_id, id) on delete restrict,
  foreign key (organization_id, category_id, direction)
    references public.transaction_categories (organization_id, id, direction) on delete restrict
);

create index budget_allocations_revision_idx
  on public.budget_allocations (organization_id, revision_id, direction, category_id);

create table public.financial_obligations (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  description text not null check (char_length(btrim(description)) between 2 and 200),
  amount_minor bigint not null check (amount_minor between 1 and 999999999999),
  currency_code character(3) not null default 'USD' check (currency_code = 'USD'),
  due_on date not null,
  category_id uuid not null,
  category_direction public.transaction_direction not null default 'expense'
    check (category_direction = 'expense'),
  intended_account_id uuid,
  reference text check (
    reference is null or char_length(btrim(reference)) between 1 and 100
  ),
  note text check (
    note is null or char_length(btrim(note)) between 1 and 500
  ),
  status public.obligation_status not null,
  linked_transaction_id uuid,
  created_by uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  idempotency_key uuid not null,
  version integer not null default 1 check (version > 0),
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, category_id, category_direction)
    references public.transaction_categories (organization_id, id, direction) on delete restrict,
  foreign key (organization_id, intended_account_id)
    references public.financial_accounts (organization_id, id) on delete restrict,
  foreign key (organization_id, linked_transaction_id)
    references public.financial_transactions (organization_id, id) on delete restrict,
  check (
    (status = 'paid' and linked_transaction_id is not null)
    or
    (status <> 'paid' and linked_transaction_id is null)
  )
);

create unique index financial_obligations_transaction_once_idx
  on public.financial_obligations (organization_id, linked_transaction_id)
  where linked_transaction_id is not null;

create index financial_obligations_due_status_idx
  on public.financial_obligations (organization_id, status, due_on, id);

create index financial_obligations_category_idx
  on public.financial_obligations (organization_id, category_id, due_on, id);

create table public.obligation_status_history (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null,
  obligation_id uuid not null,
  from_status public.obligation_status,
  to_status public.obligation_status not null,
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  linked_transaction_id uuid,
  changed_by uuid not null references auth.users (id) on delete restrict,
  changed_at timestamptz not null default now(),
  idempotency_key uuid not null,
  unique (organization_id, id),
  unique (organization_id, idempotency_key),
  foreign key (organization_id, obligation_id)
    references public.financial_obligations (organization_id, id) on delete restrict,
  foreign key (organization_id, linked_transaction_id)
    references public.financial_transactions (organization_id, id) on delete restrict,
  check (
    (to_status = 'paid' and linked_transaction_id is not null)
    or
    (to_status <> 'paid' and linked_transaction_id is null)
  )
);

create index obligation_status_history_obligation_idx
  on public.obligation_status_history (
    organization_id,
    obligation_id,
    changed_at desc,
    id desc
  );

create table public.minimum_reserve_history (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  previous_amount_minor bigint not null
    check (previous_amount_minor between 0 and 999999999999),
  new_amount_minor bigint not null
    check (new_amount_minor between 0 and 999999999999),
  currency_code character(3) not null default 'USD' check (currency_code = 'USD'),
  reason text not null check (char_length(btrim(reason)) between 5 and 500),
  changed_by uuid not null references auth.users (id) on delete restrict,
  changed_at timestamptz not null default now(),
  idempotency_key uuid not null,
  unique (organization_id, id),
  unique (organization_id, idempotency_key)
);

create index minimum_reserve_history_organization_idx
  on public.minimum_reserve_history (organization_id, changed_at desc, id desc);

create trigger organization_budgets_set_updated_at
before update on public.organization_budgets
for each row execute function public.set_updated_at();

create trigger financial_obligations_set_updated_at
before update on public.financial_obligations
for each row execute function public.set_updated_at();

commit;
