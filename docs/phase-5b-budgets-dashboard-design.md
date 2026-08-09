# Phase 5B — Budgets, Obligations, and Financial Dashboard

Phase 5B derives decision-support totals from the immutable Phase 5A ledger. It
does not change, delete, reconcile, or move money. All amounts use signed-safe
integer cents and USD.

## Baseline and boundaries

- Phase 5B starts from merged `main` commit
  `a3ee16d87334bb393ad96090a2a258022fbb8f42`.
- Phase 4 authentication, membership revalidation, RLS, and identity audit
  controls remain unchanged.
- Phase 5A accounts, opening-balance entries, categories, transactions, voids,
  corrections, imports, privileges, and audit controls remain unchanged.
- No expected revenue, dues, sponsorships, reimbursements, transfers, bank
  balances, AI output, or predictions enter Phase 5B calculations.

## Budget model

`organization_budgets` is the permanent budget identity and lifecycle record.
`budget_revisions` stores the name, inclusive dates, USD currency, revision
number, approval state, reason, and actors. `budget_allocations` stores
category targets or limits for one revision.

- Draft revision allocations may be replaced only through the guarded draft
  workflow. Every edit creates an audit event.
- Activation changes revision 1 from draft to effective and records the
  approving treasurer, time, and reason.
- Revising an active budget atomically supersedes the old effective revision
  and creates a new effective revision. Published allocations are never edited.
- A PostgreSQL exclusion constraint prevents overlapping effective budget date
  ranges within one organization.
- Closing a budget makes its effective or draft revision closed and immutable.
- Income allocations are revenue targets. Expense allocations are spending
  limits. Totals are always summed from allocation rows.

## Obligation model

`financial_obligations` stores an organization expense obligation.
`obligation_status_history` is append-only and records every transition.

Allowed transitions are:

- expected → committed or voided
- committed → paid or voided
- paid and voided are terminal

Expected and committed details may be corrected through a guarded, versioned
workflow with a reason. Paid and voided obligations are immutable. Marking paid
requires one posted, non-voided, same-organization USD expense transaction with
the exact obligation amount. A unique constraint prevents one transaction from
satisfying multiple obligations. Partial and split payments are deferred.
Obligations never create or mutate transactions.

## Reserve model

The current nonnegative USD minimum reserve is stored on
`organization_financial_settings`. Each change appends a
`minimum_reserve_history` record containing the previous value, new value,
actor, time, reason, and idempotency key. The browser has no direct update
privilege.

## Authoritative formulas

The application uses one server-only checked-arithmetic module. It receives
organization-scoped records read under RLS and throws rather than returning an
unsafe total when an input or sum is outside JavaScript's safe integer range.

### Account balance

`effective opening-balance entry as of date + posted income through date − posted expenses through date`

For a correction chain, the effective entry is the unsuperseded entry among
entries whose effective date is on or before the selected as-of date. Archived
accounts remain included. Voided transactions and transactions after the
as-of date are excluded; posted replacements are included.

### Current organization cash

`sum of every account balance`

This is ledger-derived cash, not a bank-confirmed or reconciled bank balance.

### Budget actuals

Actuals include posted transactions dated within the effective revision's
inclusive start and end dates. Opening-balance entries are excluded.

- Expense remaining = expense limit − actual expense
- Income variance = actual income − income target
- Planned net = planned income − planned expense
- Actual net = actual income − actual expense

Transactions in categories without an allocation remain in organization totals
and are reported separately as unbudgeted income or expense. Archived
categories remain visible because historical category rows are retained.

### Projected cash

`projected cash = current organization cash − unpaid committed obligations due on or before the forecast date`

`cash after reserve = projected cash − minimum reserve`

The default horizon is 30 days; the supported dashboard horizons are 30, 60,
and 90 days. Expected obligations are visible but excluded. Paid obligations
are excluded because their linked expense is already in current cash. Voided
obligations and commitments after the selected horizon are excluded from the
horizon deduction. All unpaid committed obligations are also shown separately.

Overdue is derived when an expected or committed obligation has a due date
before the organization's current local date. It is never stored as a status.

## Permissions

- Treasurer: read dashboard/budgets/obligations/history and execute guarded
  budget, obligation, and reserve workflows.
- President: read dashboard, balances, budgets, obligations, and the existing
  president-visible financial audit subset.
- Executive: read dashboard, balances, budgets, and obligations; detailed
  financial audit history remains hidden under the Phase 5A policy.
- Member: no organization-wide Phase 5B financial access.

All reads remain protected by organization-scoped RLS. Authenticated clients
have no direct insert, update, or delete privileges on Phase 5B tables.
Guarded functions derive the actor from `auth.uid()`, require an active
treasurer membership, use an empty `search_path`, fully qualify database
objects, and are denied to `PUBLIC` and `anon`.

## Migration and recovery

Phase 5B migrations are additive. Existing financial settings receive a
minimum reserve of zero, which changes no historical ledger record. New tables
start empty. The exclusion constraint may take a short metadata lock while the
migration runs, but it scans only the new empty revision table.

Before pilot data exists, rollback may remove Phase 5B objects in reverse
dependency order. After Phase 5B records exist, use forward recovery or restore
a verified backup. Never drop Phase 4 identity/audit data or Phase 5A ledger
records to roll back Phase 5B application behavior.
