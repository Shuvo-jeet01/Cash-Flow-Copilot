# Security and Permissions Model

## Principles

Financial and member data is private by default. Grant the minimum access needed, enforce it on the server, keep an audit trail, and never rely on hidden buttons for security. The MVP should avoid collecting hardship narratives or unnecessary personal balances.

## Role matrix

| Capability                         |                         Treasurer |                        President |             Advisor |                        Chair |                 Member |
| ---------------------------------- | --------------------------------: | -------------------------------: | ------------------: | ---------------------------: | ---------------------: |
| View organization dashboard        |                              Full |                             Full |           Full/read |               Own categories |                     No |
| Import/reconcile transactions      |                               Yes |                               No |                  No |                           No |                     No |
| Create/edit financial records      |                               Yes |     Limited policy/decision only |                  No | Draft own requests/scenarios | Own reimbursement only |
| Approve commitments/reimbursements | Yes, subject to separation policy | Threshold approval if configured |                  No |                           No |                     No |
| View audit history                 |                              Full |                             Full |           Full/read |             Own-scope events |     Own request events |
| Manage roles                       |                  Treasurer admin* |                 President admin* |                  No |                           No |                     No |
| Export all data                    |                               Yes |                              Yes | Advisor-safe export |                 Own category |           Own requests |

`*` At least two organization administrators should exist. A user cannot elevate their own role. High-risk role changes should require re-authentication and notification.

## Data classification

- **Restricted:** authentication secrets, connector tokens, hardship details (post-MVP), private receipt contents.
- **Confidential:** individual balances, reimbursements, transaction details, audit actor information.
- **Internal:** budgets, commitments, forecasts, scenarios.
- **Member-visible:** deliberately published aggregate summaries only.

Logs, analytics, emails, and notifications must not contain restricted data or unnecessary confidential data.

## Required controls

- Managed passwordless/OAuth authentication; MFA required for treasurer, president, and advisors before pilot financial data.
- Short-lived secure sessions, CSRF protection, secure cookies, re-authentication for exports and role/deletion actions.
- Tenant and object authorization on every request; deny by default. Add automated cross-tenant and insecure-direct-object-reference tests.
- TLS in transit; managed encryption at rest; field-level encryption for future hardship data and connector tokens.
- Private file storage with random keys, strict MIME/size validation, malware scanning, and short-lived signed downloads after authorization.
- Rate limits and abuse controls for login, invite, upload, export, and reimbursement submission.
- Secrets in a managed secret store, never source control. Rotate on exposure and periodically.
- Dependencies pinned and scanned; critical vulnerabilities block release unless risk is documented and approved.
- Backups encrypted, access restricted, restores tested, recovery objectives documented.

## Audit design

Audit authentication events, imports, exports, financial changes, approvals, scenario decisions, permission changes, and deletion requests. Capture actor, organization, action, object, time, request ID, and structured before/after changes. Mask receipt text, personal notes, tokens, and full raw imports. Application users cannot modify audit events; operational access is separately logged.

## Financial safety rules

- Never represent the dashboard as an account balance unless it is the reconciled balance.
- Never include promised/likely/uncertain income in default safe to spend.
- Never double-count a received inflow or paid liability.
- Never silently change reserve, horizon, confidence, or policy.
- Never let AI or a client-side calculation become the source of truth.
- Display data freshness, assumptions, calculation version, and “decision support—not financial advice.”
- Require explicit confirmation before conversions, approvals, exports, and destructive actions.

## Privacy, incident, and lifecycle

Before pilot, document consent/notice, institutional requirements, retention, deletion, subprocessors, incident contacts, and breach-response steps with qualified counsel or the institution. Provide access revocation on officer transition. On suspected exposure: contain access, preserve audit evidence, rotate credentials, assess scope, notify authorized contacts, remediate, and document lessons. Do not promise regulatory compliance without an appropriate review.
