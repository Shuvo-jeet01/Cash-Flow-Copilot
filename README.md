# Cash-Flow Copilot

Cash-Flow Copilot is explainable cash-flow decision-support software for student organizations. Phase 5A adds organization-isolated financial accounts, categories, immutable transaction history, and preview-first CSV imports. It intentionally does not calculate balances or spending recommendations yet.

The product is designed to help answer: based on our current balance, expected dues, committed sponsorships, and planned expenses, can our organization afford this event under the stated assumptions?

## Local setup

Requirements: a current Node.js LTS release and pnpm 11.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

On Windows PowerShell, use `Copy-Item .env.example .env.local`. Add the two public Supabase values to `.env.local`, then open [http://localhost:3000](http://localhost:3000). Never add a secret or service-role key.

## Quality checks

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:db
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The database test requires the Supabase CLI, Docker, and a running local Supabase stack.

## Structure

- `src/app` — Next.js authentication, onboarding, and organization-scoped routes
- `src/components` — the preserved Phase 3 shell and UI primitives
- `src/lib` — Supabase clients and server authorization helpers
- `tests/e2e` — Playwright browser tests
- `supabase/migrations` — ordered Phase 4 and Phase 5A database migrations
- `supabase/tests/database` — pgTAP grants, function, audit, and isolation tests
- `phase-2-planning` — governing product and safety plans

## Applying Phase 4 migrations

The publishable key cannot apply migrations. Review and apply these files in ascending order only after explicit approval:

1. `202608030001_phase4_identity_tenancy.sql`
2. `202608030002_phase4_identity_audit.sql`
3. `202608030003_phase4_security_functions_rls.sql`

After Phase 4, Phase 5A adds:

4. `202608040001_phase5a_financial_schema.sql`
5. `202608040002_phase5a_financial_security.sql`
6. `202608040003_phase5a_transaction_imports.sql`
7. `202608040004_phase5a_import_status_enum_fix.sql`

Review and apply each migration separately. Do not apply Phase 5A migrations to a remote project until the Phase 5A branch and SQL tests have been reviewed and a backup or recovery point is available.

Migration 7 is a corrective, idempotent replacement of the two import functions
that assign batch statuses. It adds explicit `import_batch_status` enum casts and
must be applied after migration 6, including on projects where migrations 4–6
were already applied.

In the Supabase dashboard, set the Site URL to `http://localhost:3000`, allow `http://localhost:3000/auth/callback`, and choose whether email confirmation is required. Never paste credentials into SQL, source files, tests, or support messages.

## Security model

- Every organization route contains an untrusted organization UUID that is revalidated on the server.
- Every organization query remains protected by PostgreSQL RLS.
- Direct organization creation, membership mutation, audit mutation, and system-column updates are denied.
- Profiles are private to their owners.
- The browser uses only the publishable key.

Read [the permanent contributor instructions](./phase-2-planning/AGENTS.md) before implementation.

## Deferred intentionally

Budgets, dues, sponsorships, reimbursements, receipt storage, transfers, bank connections, money movement, financial calculations, forecasts, scenarios, and OpenAI remain outside Phase 5A.

The detailed Phase 5A workflow, CSV contract, duplicate controls, and recovery approach are documented in `docs/phase-5a-financial-ledger-design.md`.
