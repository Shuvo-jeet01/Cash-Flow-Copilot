# Permanent Instructions for Contributors and Coding Agents

These instructions apply to all future work inside the Cash-Flow Copilot repository. More specific instructions may add safeguards but must not weaken these rules.

## Product boundary

Build decision-support software for student organizations. Do not present it as an accounting system, bank, payment processor, fiduciary, or source of legal, tax, investment, or financial advice. Do not initiate money movement or autonomous approvals unless a later, explicitly approved specification adds that capability with appropriate review.

## Financial correctness

- Use integer minor units or fixed-precision decimals for money; never binary floating point.
- Require explicit currency and organization timezone. MVP calculations never mix currencies.
- Keep settled cash, restricted cash, commitments, reimbursements, received income, and expected income distinct.
- Exclude promised, likely, uncertain, and overdue income from default safe to spend.
- Include confirmed future income only under an explicit, visible, versioned policy and within its horizon.
- Prevent double-counting when expected income becomes a received transaction or a liability becomes paid.
- Preserve negative results; never clamp them to a reassuring zero.
- Core calculations must be deterministic, server-side, versioned, and covered by fixed input/output fixtures and boundary tests.
- Show formula components, source records, horizon, assumptions, data-through time, and policy version. Never generate unexplained recommendations.
- AI may summarize verified results but must not calculate authoritative totals, invent values, silently classify confidence, approve spending, or mutate financial records.

## Security and privacy

- Deny access by default. Authorize every protected request on the server using authenticated membership, organization, role, object, and category scope.
- Scope every tenant-owned query and write by `organization_id`; add tests that attempt guessed IDs and cross-tenant access.
- Apply least privilege and re-authentication to exports, role changes, deletion, and other high-risk actions.
- Do not collect financial-hardship narratives in MVP. Minimize personal data everywhere.
- Keep secrets, tokens, receipts, raw imports, personal balances, and sensitive notes out of logs, analytics, errors, URLs, fixtures, screenshots, and model prompts.
- Store files privately, validate type/size, scan for malware, and authorize every short-lived download.
- Use encryption in transit and at rest, managed secret storage, MFA for privileged roles, rate limiting, session revocation, encrypted backups, and tested restores.
- Never use production data in development. Synthetic fixtures only.
- Do not claim compliance or make legal retention promises without qualified review.

## Audit and data integrity

- Append an immutable audit event for imports, exports, financial mutations, approvals, scenario decisions, permission changes, and deletion requests.
- Record actor, organization, time, action, object, request ID, and safe structured changes; redact sensitive payloads.
- Use database transactions for multi-record financial operations and idempotency keys/hashes for retryable imports.
- Validate all state transitions. Never overwrite history to represent approval, payment, cancellation, or reversal.
- Derived totals are not editable facts. Recalculate from normalized inputs; caches require an input digest and timestamp.
- Schema changes require reviewed migrations, backup/rollback planning, and preservation of existing auditability.

## Engineering workflow

- Read the PRD, acceptance criteria, database, architecture, and security documents before implementing a feature.
- Make the smallest change that satisfies an approved story. Do not add postponed integrations or autonomous behavior without product approval.
- Before coding, identify financial, privacy, permission, migration, and rollback risks.
- Tests are required for calculation branches, rounding, dates/timezones, duplicate retries, invalid state transitions, role/category scopes, cross-tenant isolation, stale data, and failure rollback.
- Run formatting, type, unit, integration, permission, migration, dependency, and secret checks before handoff. Do not disable a safeguard merely to make a check pass.
- Keep dependencies minimal, pinned, supported, and scanned. Record consequential architecture decisions.
- Preserve user data and unrelated work. Destructive operations require exact scope, explicit confirmation, and a recovery plan.

## User experience and language

- Use plain language. Label assumptions and distinguish facts, forecasts, and scenarios visually and textually.
- Always show stale, partial, loading, empty, and failed-import states; never display an old result as current.
- Do not say “approved,” “guaranteed,” or “safe” without the relevant human decision and displayed conditions. Prefer “calculated safe-to-spend under these assumptions.”
- Meet WCAG 2.2 AA targets for core workflows and avoid color-only status cues.
- Provide export and explainability; avoid lock-in.

## Stop-and-escalate conditions

Stop the affected release or workflow and notify the responsible human if there is a suspected data exposure, cross-tenant access, material calculation discrepancy, unexplained total, lost audit event, failed restore, uncertain destructive migration, leaked secret, or request to bypass required authorization. Preserve evidence without copying sensitive data into chat or logs.

## Definition of done

A change is done only when its acceptance criteria pass; financial and permission tests cover it; audit behavior is verified; data migration and rollback are documented; telemetry contains no sensitive values; accessibility and failure states are checked; documentation is updated; and an authorized human has reviewed any changed financial policy.
