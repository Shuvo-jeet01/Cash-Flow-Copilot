# Cash-Flow Copilot — Phase 2 Planning Package

Cash-Flow Copilot helps student-organization leaders answer a deceptively hard question: **how much money is actually safe to spend?**

This folder contains planning documents only. It intentionally contains no application code.

The application scaffold now lives at the repository root. These planning documents remain the product and safety reference for implementation.

## Product direction

The MVP is a decision-support layer that works alongside bank accounts, dues platforms, Venmo, and spreadsheets. It imports data, separates settled facts from uncertain forecasts, and explains every calculation. It does not move money, replace bookkeeping, make autonomous approvals, or give accounting, legal, or investment advice.

## Review order

1. [Product requirements](./01-product-requirements.md)
2. [User stories](./02-user-stories.md)
3. [MVP acceptance criteria](./03-mvp-acceptance-criteria.md)
4. [Database design](./04-database-design.md)
5. [Application architecture](./05-application-architecture.md)
6. [Security and permissions](./06-security-and-permissions.md)
7. [Implementation backlog](./07-implementation-backlog.md)
8. [Pilot measurement plan](./08-pilot-measurement-plan.md)
9. [Permanent engineering instructions](./AGENTS.md)

## MVP in one sentence

Give a treasurer an explainable 30/60/90-day view of cash, commitments, reimbursements, reserves, and confidence-weighted incoming money so leadership can evaluate an event without reconciling several spreadsheets.

## Key terms

- **Current cash:** reconciled cash in connected or imported bank accounts.
- **Committed expense:** an approved obligation expected to be paid, even if it has not reached the bank.
- **Minimum reserve:** cash leadership has chosen not to spend.
- **Confirmed inflow:** money supported by objective evidence and expected by a stated date.
- **Uncertain inflow:** promised, likely, forecast, or overdue money; excluded from the default safe-to-spend figure.
- **Safe to spend:** current cash minus restricted cash, committed outflows, approved unpaid reimbursements, and minimum reserve, plus only eligible confirmed inflows within the selected horizon.

## Phase boundary

Before implementation, reviewers should approve: the safe-to-spend policy, revenue confidence rules, role permissions, pilot targets, data-retention policy, and selected technology stack. Direct bank/dues integrations, payment execution, automated collections, sponsor portals, and generative financial recommendations are postponed.

## Research caution

The direction comes from one detailed interview. It is suitable for a pilot hypothesis, not proof of broad market demand. Conduct 8–12 additional treasurer interviews and validate terminology and workflows during the pilot.
