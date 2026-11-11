# Public demo deployment

The approved Phase 5B checkpoint is `28e0deb`; it was merged into `main`
through PR #2 at `c4ac64f`. Preserve both commits. This deployment adds no
financial workflows or database migrations.

## Vercel

Import the private `Shuvo-jeet01/Cash-Flow-Copilot` repository into Vercel.
Keep the repository private and choose `main` as the production branch, the
repository root as the project root, and the Next.js framework preset.
Use the package manager and build command declared in `package.json`.

Configure these values in Vercel's environment settings before building:

| Name                                   | Purpose                                     |
| -------------------------------------- | ------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Existing Supabase project URL               |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Existing publishable browser key            |
| `DEMO_MODE`                            | Set to `true` for the synthetic-data banner |

Transfer the two existing public values directly from the local environment
file or Supabase settings into the deployment environment. Never paste them
into chat, logs, committed files, screenshots, or command-line arguments.
No service-role key, secret key, or database password belongs in the app.
Limit the deployment to synthetic records; use a separate Supabase project if
the existing project contains real member or financial data.

## Authentication URL configuration

After Vercel assigns the stable production HTTPS domain, set the Supabase
Authentication Site URL to that origin. Add the exact production
`/auth/callback` URL to the redirect allowlist. Preserve the existing
`http://localhost:3000/auth/callback` entry for local development.
Avoid broad wildcard production redirects. Do not disable email confirmation,
RLS, membership checks, or function privileges to make the demo accessible.

## Demo organization and access

Sign in using the owner's account and create an organization named
`Cash-Flow Copilot Demo — Synthetic Data`. Populate it through the guarded
application workflows with sample accounts, categories, transactions, budgets,
and expected/committed obligations. Prefix sample descriptions with `DEMO`.
Use dates relative to the demonstration date so the dashboard has a current
budget and obligations inside and outside its supported forecast horizons.

Keep the existing Phase 5A/5B test organization and immutable test ledger
history. Exclude it and the new demo organization from future pilot reporting.
Do not share the owner's password or a privileged demo account publicly.
Visitors can create their own accounts and organizations. The existing access
model does not automatically grant new visitors membership in the owner's
seeded demo organization; demonstrate that organization in an owner-led
walkthrough or video. A public read-only tour requires separate implementation
and permission review.

## Production acceptance checks

1. The production root, sign-in, sign-up, and protected pages show the demo
   banner, and the site uses HTTPS.
2. Anonymous organization URLs redirect to sign-in.
3. A new test account can sign up, receive its confirmation email, follow the
   production callback, sign in, create an organization, and sign out.
4. A signed-out user cannot reload a protected page successfully.
5. The owner can access the synthetic organization and its supporting records.
6. The dashboard's 30/60/90-day horizons, budget actuals, reserve, and obligation
   statuses reconcile with the supporting records.
7. A second account cannot access the owner's organization by changing a URL.
8. No environment values or credentials appear in source control or logs.

Email delivery and confirmation require an accessible test inbox; report them
as unverified until the actual message and callback have been tested. Record
the deployed commit and stable URL after deployment; an example domain is not
a completed deployment.

## Recovery

Use Vercel's deployment rollback to restore the previous application release.
This banner does not alter schema or financial history. Do not delete posted
demo transactions or audit records as cleanup. Update the Supabase Site URL
only if the stable production origin changes.
