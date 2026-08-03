# MVP Acceptance Criteria

The MVP is pilot-ready only when every P0 criterion passes in a production-like environment.

## A. Setup and access

- A treasurer can create an organization with timezone, base currency, fiscal period, categories, and a non-negative reserve.
- An invited user receives exactly one role; access is denied until membership is accepted.
- Changing or revoking a role takes effect on the next protected request and creates an audit event.
- Cross-organization access tests fail for read, write, export, file, and guessed-ID routes.

## B. Imports

- A supported CSV can be mapped and previewed without writing financial rows.
- The preview reports valid, invalid, and possible-duplicate rows plus debit, credit, and net totals.
- Invalid required fields, ambiguous dates, unsupported currency, and malformed amounts block those rows with actionable messages.
- Confirming an import writes exactly the previewed valid rows in one atomic operation.
- Re-uploading an identical file or confirming twice cannot silently create duplicates.
- Import batch, file hash, source, uploader, mapping, timestamps, and outcome are auditable.

## C. Financial records and reimbursements

- Authorized users can manage commitments through draft, approved, paid, and cancelled states; invalid transitions are rejected.
- A reimbursement requires positive amount, requester, purpose, date, category, and receipt or documented exception.
- A requester sees only their own requests; chairs cannot see member balances or hardship information.
- An approved/unpaid reimbursement reduces safe to spend exactly once; paid, rejected, cancelled, and draft requests do not.

## D. Calculations

- Given fixed seed data, the safe-to-spend result exactly matches the documented formula.
- The breakdown exposes reconciled cash, restricted cash, commitments, reimbursements, reserve, eligible inflows, horizon, freshness, and calculation-policy version.
- Received income already present in cash is never added again.
- Promised, likely, uncertain, and overdue income never enters the default result.
- Confirmed income enters only if policy allows it and its expected date falls within the horizon.
- Negative balances, same-day items, inclusive horizon boundaries, cancelled records, edits, and rounding are covered by automated tests.
- Best/expected/worst scenarios do not mutate ledger records; conversion requires explicit authorization and confirmation.

## E. Forecast and explainability

- 30/60/90-day views show opening balance, dated inflows/outflows, projected closing balance, reserve line, and first breach.
- Every warning links to contributing records and describes the assumption, amount, and date.
- Every dashboard displays “data through” and last-calculated times; stale data receives a prominent warning.
- The system never labels an event “approved” or provides a financial guarantee; it presents outcomes and reserve impact.

## F. Audit, export, resilience, and usability

- Create/update/delete-equivalent actions, approvals, role changes, imports, exports, and decisions record actor, time, organization, action, object, and before/after or structured change.
- Product users cannot edit or delete audit events.
- Authorized export includes documented data tables and excludes secrets; export creation is audited.
- Monetary values round consistently to the organization currency and are never calculated with binary floating point.
- Backup restore, failed-import rollback, file malware/type checks, rate limiting, session revocation, and error monitoring are demonstrated.
- Core workflows are keyboard usable, labels and error messages are accessible, and no critical WCAG 2.2 AA issue remains.
- A new pilot treasurer can complete setup, first import, first commitment, and first scenario using the README/onboarding guidance without developer intervention.

## Release evidence

For sign-off, attach: automated test results, permission test matrix, sample import report, calculation fixtures, accessibility check, backup-restore record, security review, and product-owner approval.
