# Cash-Flow Copilot

Cash-Flow Copilot is explainable cash-flow decision-support software for student organizations. Phase 5B adds versioned budgets, obligations, minimum-reserve history, deterministic balances, budget-versus-actual reporting, and a 30/60/90-day financial dashboard on top of the approved Phase 5A ledger.

The product is designed to help officers understand current cash, approved plans, known commitments, and reserve position while keeping every assumption visible. It does not move money or generate an affordability recommendation.

## Local setup

For hosting, authentication redirects, synthetic data, and production review,
see [the public demo deployment guide](./docs/public-demo-deployment.md).

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
- `src/components` — the preserved application shell and UI primitives
- `src/lib` — Supabase clients, server authorization, and pure finance calculations
- `tests/e2e` — Playwright browser tests
- `supabase/migrations` — ordered Phase 4, Phase 5A, and Phase 5B database migrations
- `supabase/tests/database` — pgTAP grants, workflow, audit, and isolation tests
- `phase-2-planning` — governing product and safety plans

## Applying database migrations

The publishable key cannot apply migrations. Review and apply these files in ascending order only after explicit approval:

1. `202608030001_phase4_identity_tenancy.sql`
2. `202608030002_phase4_identity_audit.sql`
3. `202608030003_phase4_security_functions_rls.sql`
4. `202608040001_phase5a_financial_schema.sql`
5. `202608040002_phase5a_financial_security.sql`
6. `202608040003_phase5a_transaction_imports.sql`
7. `202608040004_phase5a_import_status_enum_fix.sql`

Migration 7 is a corrective, idempotent replacement of the two import functions that assign batch statuses. It adds explicit `import_batch_status` enum casts and must be applied after migration 6, including on projects where migrations 4–6 were already applied.

After the approved Phase 5A baseline, Phase 5B adds these four migrations in this exact order:

8. `202608050001_phase5b_budget_obligation_schema.sql`
9. `202608050002_phase5b_security_and_reserve.sql`
10. `202608050003_phase5b_budget_workflows.sql`
11. `202608050004_phase5b_obligation_workflows.sql`

Do not apply migrations 8–11 remotely until the Phase 5B local verification report has been reviewed and explicit approval has been given. Apply one whole file at a time in the Supabase SQL Editor while using the project owner database role. Each file is an atomic transaction and must finish successfully before proceeding. Never paste environment values into the SQL Editor.

In the Supabase dashboard, set the Site URL to `http://localhost:3000`, allow `http://localhost:3000/auth/callback`, and choose whether email confirmation is required. Never paste credentials into SQL, source files, tests, or support messages.

## Security model

- Every organization route contains an untrusted organization UUID that is revalidated on the server.
- Every organization query remains protected by PostgreSQL RLS.
- Direct organization, membership, audit, ledger, budget, obligation, and reserve-history writes are denied.
- Profiles are private to their owners.
- The browser uses only the publishable key.
- Treasurer-only writes use hardened database functions with `auth.uid()`-derived identity, optimistic versions, idempotency keys, immutable history, and audit events.
- President and executive roles can read Phase 5B financial records; executives cannot read financial audit events. Members cannot read financial records.

## Phase 5B calculation contract

- Current account balance = effective opening balance + posted income − posted expense through the organization-local as-of date.
- Organization cash = the sum of every account balance, including archived accounts that still hold history.
- Budget actuals include posted transactions inside the effective revision's inclusive dates. Voided transactions are excluded; activity in unallocated categories is reported as unbudgeted.
- Projected cash = current organization cash − committed obligations due on or before the selected forecast date.
- Cash after reserve = projected cash − minimum cash reserve.
- Expected obligations are displayed separately and never deducted. Paid obligations are not deducted because their linked posted transaction is already in current cash.

Calculations use integer cents and fail closed if records are missing, inconsistent, or outside the supported safe range. They do not generate an affordability recommendation.

Read [the permanent contributor instructions](./phase-2-planning/AGENTS.md) before implementation.

## Deferred intentionally

Dues, sponsorships, reimbursements, receipt storage, transfers, bank connections, money movement, event scenarios, AI recommendations, and OpenAI remain outside Phase 5B.

The detailed Phase 5A workflow, CSV contract, duplicate controls, and recovery approach are documented in [`docs/phase-5a-financial-ledger-design.md`](./docs/phase-5a-financial-ledger-design.md).

The Phase 5B data model, formulas, permissions, lifecycle rules, and recovery approach are documented in [`docs/phase-5b-budgets-dashboard-design.md`](./docs/phase-5b-budgets-dashboard-design.md).
