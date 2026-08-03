# Product Requirements Document

## 1. Purpose

Cash-Flow Copilot reduces the time and uncertainty involved in deciding what a student organization can safely spend. The first release combines imported financial facts with manually recorded future commitments and shows the calculation behind every result.

## 2. Problem

Financial information is fragmented across a bank, dues platform, payment apps, receipts, forms, messages, and officer spreadsheets. The bank balance is accurate but misleading because it does not show upcoming obligations. Expected dues, ticket sales, and sponsorships may arrive late or never. Treasurers reconcile manually, leaders make judgment-heavy event decisions, and sensitive member information risks being overshared.

## 3. Users

- **Primary:** treasurer, who imports, reconciles, categorizes, and maintains forecasts.
- **Decision partners:** president and advisor, who need decision-ready visibility.
- **Scoped contributors:** committee chairs, who need only their own budgets and requests.
- **Limited participants:** members, who submit and track only their own reimbursements.

## 4. Goals and success outcomes

- Produce an explainable safe-to-spend figure from current cash and future obligations.
- Show 30/60/90-day cash forecasts and reserve-breach risks.
- Support best, expected, and worst event scenarios without making the decision.
- Include approved unpaid reimbursements as liabilities.
- Make imports, corrections, assumptions, and approvals auditable.
- Reduce monthly reconciliation and reporting effort while protecting member privacy.

## 5. Non-goals for MVP

- Replacing accounting, banking, dues, or payment platforms.
- Initiating payments, reimbursements, transfers, collections, or restrictions.
- Automated bookkeeping from live bank feeds.
- Tax, legal, investment, or fiduciary advice.
- Autonomous event approval or opaque AI recommendations.
- Full dues-case management, sponsor CRM, receipt OCR, or mobile apps.

## 6. Core workflow

1. Treasurer creates an organization, fiscal period, categories, and reserve policy.
2. Treasurer imports bank transactions and optional dues/sponsorship CSVs using a preview-and-confirm flow.
3. Treasurer resolves duplicates or invalid rows and confirms the current cash position.
4. Treasurer records commitments and reimbursement requests with dates, categories, evidence, and status.
5. The system calculates safe to spend and 30/60/90-day forecasts.
6. Leadership creates an event scenario and compares best, expected, and worst outcomes.
7. President/advisor reviews the inputs and warnings; humans record the decision and rationale.
8. Authorized users export data and audit history.

## 7. Functional requirements

### FR-1 Organization setup

Store organization name, timezone, base currency, fiscal period, minimum reserve, categories, and user roles. MVP supports one currency per organization.

### FR-2 CSV import

Accept documented CSV templates for transactions, receivables, sponsorships, and budgets. Show column mapping, validation errors, row counts, totals, duplicates, and a preview before commit. Retrying the same file must not silently duplicate records.

### FR-3 Cash and reconciliation

Track accounts and settled transactions. The dashboard must display the data-through date, last import time, unreconciled items, and source of each figure.

### FR-4 Commitments

Create, edit, approve, cancel, and mark paid future obligations. Required fields: description, amount, due date, category, owner, status, and source/evidence note.

### FR-5 Reimbursements

Members can submit an amount, purpose, date, receipt, and category. Authorized officers can request information, approve, reject, and mark paid. Only approved/unpaid requests affect the default safe-to-spend figure.

### FR-6 Revenue confidence

Classify inflows as received, confirmed, promised, likely, uncertain, or overdue. The default calculation includes received cash through the account balance and may include confirmed inflows only when an organization policy explicitly enables them for the selected horizon. All other expected income is excluded but visible.

### FR-7 Explainable safe-to-spend

Default formula:

`reconciled cash − restricted cash − approved unpaid commitments − approved unpaid reimbursements − minimum reserve + policy-eligible confirmed inflows = safe to spend`

No line may be counted twice. Negative results remain negative. The UI must show every component, cutoff date, policy, and data freshness. Users can inspect contributing records.

### FR-8 Forecast and warnings

Show dated inflows/outflows for 30, 60, and 90 days, projected balance, reserve line, and first possible reserve breach. Warnings must state which records and assumptions caused them.

### FR-9 Event scenarios

Capture base cost, contingency, attendance, ticket price, contributions, and sponsorship income. Show best/expected/worst ending cash and reserve headroom. Scenarios never change official records until an authorized user explicitly converts approved items into commitments.

### FR-10 Permissions and audit

Enforce the model in the security document on the server. Append an audit event for imports, edits, status changes, role changes, exports, and scenario decisions. Audit events are not editable through the product.

### FR-11 Export and deletion

Authorized users can export organization data in common formats. Organization deletion requires strong confirmation, a delay/recovery window, and a permanent audit record without retaining sensitive payloads longer than policy allows.

## 8. Quality requirements

- Financial amounts use integer minor units or fixed-precision decimals, never binary floating point.
- Calculations are deterministic, versioned, and covered by boundary tests.
- Organization data is tenant-isolated; every protected query is scoped by organization.
- Pages communicate loading, empty, stale, partial, and error states.
- Important tasks are keyboard accessible and meet WCAG 2.2 AA targets.
- Dashboard target: p95 response under 2 seconds for pilot-sized organizations, excluding file upload processing.
- Daily encrypted backups and a tested restore process before handling pilot data.

## 9. Product decisions in plain English

- **CSV first:** it proves value faster and avoids fragile integrations before the workflow is validated.
- **Conservative default:** promised money is not spendable money. This reduces false confidence.
- **Rules before AI:** arithmetic and policy rules are easier to verify and audit. AI can later explain data but must never invent or silently alter figures.
- **One currency:** multi-currency introduces exchange-rate risk that the pilot does not need.
- **Human approval:** the product supplies evidence; accountable officers make the decision.

## 10. Open decisions for review

- Can confirmed but not received income ever increase the official safe-to-spend amount?
- What approval threshold requires president or advisor review?
- What reserve policies are common across pilot organizations?
- How long should receipts, import files, audit logs, and hardship data be retained?
- Should member reimbursement submission require an account or a secure one-time link?
