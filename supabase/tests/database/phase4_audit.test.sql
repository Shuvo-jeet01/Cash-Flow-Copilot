begin;

create extension if not exists pgtap with schema extensions;

select plan(4);

select isnt(
  has_table_privilege('authenticated', 'public.audit_events', 'INSERT'),
  true,
  'users cannot insert audit events'
);

select isnt(
  has_table_privilege('authenticated', 'public.audit_events', 'UPDATE'),
  true,
  'users cannot update audit events'
);

select isnt(
  has_table_privilege('authenticated', 'public.audit_events', 'DELETE'),
  true,
  'users cannot delete audit events'
);

select ok(
  pg_catalog.strpos(
    obj_description('public.audit_events'::regclass),
    'Never store credentials or tokens'
  ) > 0,
  'audit table documentation explicitly prohibits credential and token storage'
);

select * from finish();

rollback;