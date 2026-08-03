create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete restrict,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 3 and 100),
  target_type text not null check (target_type in ('organization', 'organization_membership')),
  target_id uuid not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  check (jsonb_typeof(metadata) = 'object')
);

create index audit_events_organization_occurred_idx
  on public.audit_events (organization_id, occurred_at desc);

comment on table public.audit_events is
  'Append-only organization identity and tenancy audit history. Never store credentials or tokens.';
