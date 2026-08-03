# Ordered Implementation Backlog

This backlog is ordered to retire the riskiest assumptions early. Do not start the next milestone until its exit check passes.

## Milestone 0 — Decisions and validation

1. Approve PRD, formula, revenue-confidence policy, roles, and non-goals.
2. Interview 8–12 more treasurers; collect anonymized sample CSV schemas and event decisions.
3. Define pilot data-retention, incident, backup, and acceptable-use policies.
4. Select stack and write short decision records for authentication, database, storage, hosting, and monitoring.
5. Create calculation examples with expected results, including negative cash and double-counting traps.

**Exit:** product owner and financial reviewer sign off; at least three pilot prospects confirm the core workflow.

## Milestone 1 — Safe foundation

6. Create repository quality gates, environments, dependency scanning, and secret handling.
7. Implement schema migrations for organizations, users, memberships, policies, and audit events.
8. Add authentication, MFA enforcement, invitations, session revocation, and server-side authorization.
9. Build tenant-isolation and role-matrix tests before any financial screen.
10. Configure encrypted storage, backups, restore test, redacted logging, and error monitoring.

**Exit:** security checklist passes and cross-tenant tests demonstrate denial.

## Milestone 2 — Financial inputs

11. Implement accounts, categories, transactions, commitments, inflows, and state-transition rules.
12. Build CSV templates, quarantine/scan, mapping, validation, preview, deduplication, and atomic commit.
13. Build transaction review/reconciliation and freshness indicators.
14. Build commitment and expected-inflow management with evidence and audit history.

**Exit:** a pilot CSV can be imported twice without duplication and totals match a manual fixture.

## Milestone 3 — Core decision value

15. Implement the pure, versioned safe-to-spend engine with exhaustive unit tests.
16. Build dashboard breakdown with drill-down, freshness, and excluded-income explanation.
17. Implement dated 30/60/90 forecasts and reserve-breach warnings.
18. Add calculation snapshots for recorded leadership decisions.

**Exit:** all approved fixtures match exactly and a treasurer can explain every displayed dollar.

## Milestone 4 — Reimbursements and scenarios

19. Add private receipt upload and member self-service reimbursement submission.
20. Add review statuses, payment linkage, member-only tracking, and liability integration.
21. Build best/expected/worst event scenario editor and comparison.
22. Add explicit scenario-to-commitment conversion and decision rationale.

**Exit:** permissions and calculation acceptance criteria pass end to end.

## Milestone 5 — Pilot readiness

23. Build scoped exports, onboarding, empty/error/stale states, and support runbook.
24. Complete accessibility, performance, threat-model, and dependency reviews.
25. Run production-like backup restore, failed-import recovery, and incident tabletop.
26. Instrument privacy-conscious pilot events and metric reports.
27. Conduct usability sessions, fix critical issues, and obtain release sign-off.

**Exit:** every P0 acceptance criterion has evidence and named owners agree to pilot.

## Post-pilot backlog

28. Saved mappings and recurring import reminders.
29. Purchase-request workflow and configurable dual approvals.
30. Read-only bank and dues connectors, one provider at a time.
31. Sponsorship fulfillment, advanced dues workflows, and notifications.
32. Explainable AI summaries only after deterministic source citations and evaluation are proven.

## Backlog rules

Each item needs an owner, user story, acceptance tests, security/privacy notes, telemetry, documentation, and rollback plan. Never trade calculation correctness, tenant isolation, auditability, or user consent for delivery speed.
