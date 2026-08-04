# Phase 5A — Financial Accounts and Transactions

Phase 5A adds an organization-isolated ledger input workflow. It records financial facts but does not calculate balances, budgets, forecasts, obligations, scenarios, or spending recommendations.

## Approved behavior

- USD only, stored explicitly as `USD`.
- Organization timezone must be configured before financial entry.
- Treasurers are the only writers.
- Presidents can read accounts, transactions, and financial audit history.
- Executives can read accounts and transactions but not detailed audit history.
- Members cannot access organization-wide financial records.
- Posted transactions are never edited or deleted.
- Voids preserve the original, actor, time, and reason.
- Corrections atomically void the original and create a linked replacement.
- Opening balances use append-only replacement entries rather than editable balance fields.
- Archived accounts and categories remain readable in history and are rejected for new records.
- Transfers remain deferred.

## Core records

- `organization_financial_settings` isolates the organization timezone and USD configuration from member-visible organization metadata.
- `financial_accounts` stores descriptive account labels and lifecycle state, never banking credentials.
- `account_opening_balance_entries` is append-only; a correction points to the entry it supersedes.
- `transaction_categories` separates income and expense classifications.
- `financial_transactions` stores immutable posted facts and linked void/replacement history.
- `transaction_import_batches` and `transaction_import_rows` preserve preview, validation, resolution, and commit history.
- `audit_events` records the authenticated actor and metadata for every protected financial workflow.

## CSV template

The template is available at `/templates/transactions-v1.csv` and uses these exact columns:

```text
transaction_date,direction,amount,currency,description,account_name,category_name,reference,note,external_id
```

Dates use `YYYY-MM-DD`. Direction is `income` or `expense`. Currency is `USD`. Amount is a positive decimal string with no currency symbol or grouping commas and no more than two decimal places.

The server accepts UTF-8 CSV files up to 1 MB and 5,000 rows. Raw files are parsed in memory and discarded. Normalized preview rows are stored under RLS. Invalid rows block the entire import. Possible duplicates require a treasurer to skip the row or accept it as distinct with a reason.

## Duplicate protection

- Manual form retries use a database-unique submission UUID.
- Completed file hashes cannot be committed twice.
- Import row IDs become transaction idempotency keys.
- Import row numbers are derived from database array order rather than trusted client fields.
- External IDs are unique within organization and account when supplied.
- Candidate fingerprints use organization, account, category, direction, integer cents, currency, date, normalized description, and normalized reference.
- Advisory transaction locks serialize competing fingerprint confirmations.
- Heuristic matches are warnings because legitimate transactions may be identical.

## Security boundary

All browser IDs are untrusted. Every page and action uses the Phase 4 authenticated organization context. PostgreSQL RLS independently scopes reads. Authenticated users receive no direct insert, update, or delete privileges on financial or audit tables. Mutations use hardened `SECURITY DEFINER` workflows that derive the actor from `auth.uid()`, verify an active treasurer membership, use an empty `search_path`, and write financial records and audit events atomically.

## Migration and recovery

The Phase 5A migrations are additive and run after the three Phase 4 migrations. Before pilot data exists, rollback can remove the Phase 5A objects in reverse dependency order. After financial data exists, use reviewed forward migrations or restore a verified database backup; do not drop ledger or audit tables to roll back application behavior.
