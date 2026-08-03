# Cash-Flow Copilot

Cash-Flow Copilot is explainable cash-flow decision-support software for student organizations. Phase 4 adds Supabase authentication and organization-isolated workspaces while keeping every financial screen as a non-functional placeholder.

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
- `supabase/migrations` — ordered Phase 4 database migrations
- `supabase/tests/database` — pgTAP grants, function, audit, and isolation tests
- `phase-2-planning` — governing product and safety plans

## Applying Phase 4 migrations

The publishable key cannot apply migrations. Review and apply these files in ascending order only after explicit approval:

1. `202608030001_phase4_identity_tenancy.sql`
2. `202608030002_phase4_identity_audit.sql`
3. `202608030003_phase4_security_functions_rls.sql`

In the Supabase dashboard, set the Site URL to `http://localhost:3000`, allow `http://localhost:3000/auth/callback`, and choose whether email confirmation is required. Never paste credentials into SQL, source files, tests, or support messages.

## Security model

- Every organization route contains an untrusted organization UUID that is revalidated on the server.
- Every organization query remains protected by PostgreSQL RLS.
- Direct organization creation, membership mutation, audit mutation, and system-column updates are denied.
- Profiles are private to their owners.
- The browser uses only the publishable key.

Read [the permanent contributor instructions](./phase-2-planning/AGENTS.md) before implementation.

## Deferred intentionally

OpenAI, transactions, budgets, dues, sponsorships, reimbursements, receipt storage, CSV imports, money movement, and financial calculations remain outside Phase 4.
