# Pilot Measurement Plan

## Purpose

Test whether the product produces trustworthy cash-flow decisions with less treasurer effort. The pilot is for learning, not claiming market fit.

## Pilot shape

- Recruit 3–5 organizations representing different sizes and workflows.
- Run for 6–8 weeks, ideally spanning one monthly close and one event decision.
- Require a treasurer champion and president/advisor reviewer per organization.
- Use CSV imports and manual commitments; do not add integrations during measurement.

## Baseline (before onboarding)

For the prior month capture: hours spent reconciling/reporting; time to answer “what can we safely spend?”; number of systems checked; known missed/duplicate items; reimbursement age and status questions; confidence rating (1–5); and one historical event calculation. Record organization size and complexity so results are not compared blindly.

## Primary measures and targets

| Outcome             | Measure                                                     | Pilot target                                |
| ------------------- | ----------------------------------------------------------- | ------------------------------------------- |
| Faster decision     | Median time to produce a reviewable safe-to-spend answer    | ≤15 minutes after current inputs are loaded |
| Less monthly work   | Self-reported reconciliation/reporting time                 | ≥30% lower than baseline                    |
| Correct calculation | Results matching reviewed fixtures/source records           | 100%; zero material double-counts           |
| Explainability      | Treasurer can identify every formula component in task test | ≥90% task success                           |
| Trust               | Treasurer confidence in safe-to-spend view, 1–5             | Median ≥4 and no decline from baseline      |
| Adoption            | Active pilot organizations completing weekly update/view    | ≥80% of pilot weeks                         |

## Guardrails

- Zero cross-organization or unauthorized sensitive-data exposure.
- Zero product-initiated payments or autonomous approvals.
- Zero known material calculation errors left uncommunicated; pause affected decisions immediately.
- 100% of financial edits and exports auditable.
- Fewer than 5% of valid import rows require correction after confirmation.
- No pilot organization reports that the tool increased its routine workload after week two.

## Secondary measures

- Import completion time and error rate.
- Percentage of expected income excluded from default safe to spend.
- Number and value of previously untracked commitments/reimbursements discovered.
- Median reimbursement age and number of status inquiries.
- Scenario decisions with recorded rationale.
- Support requests per organization/week and onboarding completion rate.

## Data collection

Use privacy-minimized product events such as `import_previewed`, `import_confirmed`, `forecast_viewed`, `scenario_compared`, and `export_created`; store organization pseudonyms in analysis. Pair telemetry with weekly 15-minute interviews and start/end surveys. Do not capture amounts, descriptions, member names, receipt contents, hardship information, or raw CSV data in analytics.

## Evaluation method

Compare each organization with its own baseline. Review quantitative results alongside interview notes; a tiny pilot cannot support broad statistical claims. Investigate discrepancies rather than averaging them away. A founder and an independent finance-domain reviewer should verify calculation incidents and sample results.

## Decision rules

- **Proceed:** all guardrails pass, at least four of six primary targets pass, and most treasurers ask to continue.
- **Iterate:** no safety failure, but workflow/time/trust targets are mixed; fix the clearest bottleneck and repeat a focused pilot.
- **Stop/pause:** any unresolved material calculation or privacy incident, users cannot explain the result, or routine work increases without a credible fix.

## Weekly cadence and final report

Week 0 baseline/onboarding; weeks 1–2 import and terminology fixes; weeks 3–6 regular updates plus at least one event decision; final week export, survey, interview, permission revocation, and retention choice. The final report should list cohort, baselines, metric results, incidents, qualitative themes, limitations, and a clear proceed/iterate/stop recommendation.
