import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Landmark,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { FinancialPageHeader } from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  loadFinancialDashboard,
  parseForecastHorizon,
  SUPPORTED_FORECAST_HORIZONS,
} from "@/lib/finance/dashboard";
import { formatMoney } from "@/lib/finance/money";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";

function Metric({
  label,
  value,
  note,
  tone = "plain",
}: {
  label: string;
  value: string;
  note: string;
  tone?: "plain" | "good" | "risk";
}) {
  return (
    <Card
      className={
        tone === "risk"
          ? "border-rose-200 bg-rose-50"
          : tone === "good"
            ? "border-emerald-200 bg-emerald-50"
            : undefined
      }
    >
      <CardContent className="pt-6">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          {label}
        </p>
        <p className="mt-2 text-2xl font-bold text-slate-950">{value}</p>
        <p className="mt-2 text-xs leading-5 text-slate-600">{note}</p>
      </CardContent>
    </Card>
  );
}

export default async function OrganizationDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ horizon?: string }>;
}) {
  const { organizationId } = await params;
  const search = await searchParams;
  const organization = await requireOrganizationAccess(organizationId);
  if (organization.role === "member")
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <FinancialPageHeader
          eyebrow="Organization workspace"
          title={organization.name}
          description="Your active membership is verified on every protected request."
        />
        <Card>
          <CardContent className="py-10 text-sm text-slate-600">
            Financial dashboards are available only to treasurer, president, and
            executive roles.
          </CardContent>
        </Card>
      </div>
    );
  const horizon = parseForecastHorizon(search.horizon);
  const dashboard = await loadFinancialDashboard(organization.id, horizon);
  if (dashboard.needsFinancialSetup)
    return (
      <div className="mx-auto max-w-5xl space-y-8">
        <FinancialPageHeader
          eyebrow="Financial dashboard"
          title="Complete financial setup"
          description="Configure the organization timezone before calculations can use a clear local as-of date."
        />
        {organization.role === "treasurer" && (
          <Button asChild>
            <Link href={`/organizations/${organization.id}/settings`}>
              Open settings
            </Link>
          </Button>
        )}
      </div>
    );
  const performance = dashboard.budgetPerformance;
  const projection = dashboard.projection;
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <FinancialPageHeader
        eyebrow="Financial dashboard"
        title={organization.name}
        description={`Authoritative organization cash as of ${dashboard.asOfDate}, with a clearly separated ${horizon}-day committed-obligation projection.`}
        actions={
          <div className="flex gap-1 rounded-lg border bg-white p-1">
            {SUPPORTED_FORECAST_HORIZONS.map((days) => (
              <Button
                key={days}
                variant={days === horizon ? "default" : "ghost"}
                size="sm"
                asChild
              >
                <Link href={`?horizon=${days}`}>{days} days</Link>
              </Button>
            ))}
          </div>
        }
      />
      {dashboard.stale && (
        <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-semibold">Ledger may be stale</p>
            <p>
              Latest recorded financial date:{" "}
              {dashboard.latestRecordDate ?? "none"}. Confirm imports and
              entries before making a decision.
            </p>
          </div>
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="Current organization cash"
          value={formatMoney(dashboard.balances.organizationCashMinor)}
          note="All accounts, including archived accounts, using effective openings and posted transactions only."
        />
        <Metric
          label={`Committed through ${dashboard.forecastDate}`}
          value={formatMoney(projection.committedWithinHorizonMinor)}
          note="Expected items are not deducted. Paid obligations are excluded to prevent double counting."
        />
        <Metric
          label="Projected cash"
          value={formatMoney(projection.projectedCashMinor)}
          note={`Current cash minus committed obligations due within ${horizon} days.`}
        />
        <Metric
          label="Cash after minimum reserve"
          value={formatMoney(projection.cashAfterReserveMinor)}
          note={`Minimum reserve: ${formatMoney(dashboard.settings.minimum_reserve_minor)}.`}
          tone={projection.reserveState === "surplus" ? "good" : "risk"}
        />
      </div>
      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle>Budget versus actual</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/organizations/${organization.id}/budgets`}>
                Budgets <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {performance && dashboard.activeRevision ? (
              <>
                <p className="mb-4 text-sm text-slate-600">
                  {dashboard.activeRevision.name} ·{" "}
                  {dashboard.activeRevision.start_on} through{" "}
                  {dashboard.activeRevision.end_on}
                </p>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Metric
                    label="Income target"
                    value={formatMoney(performance.plannedIncomeMinor)}
                    note={`Actual ${formatMoney(performance.actualIncomeMinor)}`}
                  />
                  <Metric
                    label="Expense limit"
                    value={formatMoney(performance.plannedExpenseMinor)}
                    note={`Actual ${formatMoney(performance.actualExpenseMinor)}`}
                  />
                  <Metric
                    label="Income variance"
                    value={formatMoney(performance.incomeVarianceMinor)}
                    note="Actual minus target"
                    tone={
                      performance.incomeVarianceMinor >= 0 ? "good" : "risk"
                    }
                  />
                  <Metric
                    label="Expense remaining"
                    value={formatMoney(performance.expenseRemainingMinor)}
                    note="Limit minus actual"
                    tone={
                      performance.expenseRemainingMinor >= 0 ? "good" : "risk"
                    }
                  />
                </div>
                {(performance.unbudgetedIncomeMinor !== 0 ||
                  performance.unbudgetedExpenseMinor !== 0) && (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                    Unbudgeted activity:{" "}
                    {formatMoney(performance.unbudgetedIncomeMinor)} income and{" "}
                    {formatMoney(performance.unbudgetedExpenseMinor)} expense.
                    It remains included in actual totals.
                  </p>
                )}
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-600">
                No effective budget covers today. Current cash and obligations
                remain available without inventing a plan.
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Attention required</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <CalendarClock className="size-5 text-amber-700" />
              <div>
                <p className="font-medium">
                  {projection.overdue.length} overdue obligation
                  {projection.overdue.length === 1 ? "" : "s"}
                </p>
                <p className="text-sm text-slate-600">
                  Expected and committed items past their due date.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <ShieldCheck className="size-5 text-emerald-700" />
              <div>
                <p className="font-medium">Reserve {projection.reserveState}</p>
                <p className="text-sm text-slate-600">
                  No recommendation is generated; this is a deterministic
                  comparison.
                </p>
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3 text-sm">
              <p className="font-medium">
                {formatMoney(projection.totalCommittedMinor)} total unpaid
                committed
              </p>
              <p className="mt-1 text-slate-600">
                {formatMoney(projection.expectedMinor)} expected is shown
                separately and is not deducted.
              </p>
            </div>
            <Button className="w-full" variant="outline" asChild>
              <Link href={`/organizations/${organization.id}/obligations`}>
                Review obligations
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Upcoming and overdue obligations</CardTitle>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/organizations/${organization.id}/obligations`}>
              View all <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {[...projection.committed, ...projection.expected]
            .sort((left, right) => left.due_on.localeCompare(right.due_on))
            .slice(0, 6)
            .map((obligation) => (
              <Link
                className="flex flex-col gap-2 rounded-lg border p-4 transition hover:bg-slate-50 sm:flex-row sm:items-center"
                href={`/organizations/${organization.id}/obligations/${obligation.id}`}
                key={obligation.id}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {obligation.description}
                  </p>
                  <p className="text-xs capitalize text-slate-500">
                    {obligation.status} · due {obligation.due_on}
                    {obligation.due_on < dashboard.asOfDate ? " · overdue" : ""}
                  </p>
                </div>
                <span className="font-semibold">
                  {formatMoney(obligation.amount_minor)}
                </span>
              </Link>
            ))}
          {projection.committed.length + projection.expected.length === 0 && (
            <p className="py-6 text-center text-sm text-slate-600">
              No unpaid committed or expected obligations.
            </p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Account balances</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {dashboard.balances.accountBalances.map((account) => (
            <div
              className="flex items-center gap-3 rounded-lg border p-4"
              key={account.id}
            >
              {account.status === "active" ? (
                <Landmark className="size-5 text-emerald-700" />
              ) : (
                <WalletCards className="size-5 text-slate-500" />
              )}
              <div className="min-w-0">
                <p className="truncate font-medium">{account.name}</p>
                <p className="text-xs capitalize text-slate-500">
                  {account.status}
                </p>
              </div>
              <span className="ml-auto font-semibold">
                {formatMoney(account.balanceMinor)}
              </span>
            </div>
          ))}
        </CardContent>
      </Card>
      <p className="text-xs text-slate-500">
        Calculated {new Date(dashboard.calculatedAt).toLocaleString()} using{" "}
        {dashboard.settings.timezone}. Data through{" "}
        {dashboard.latestRecordDate ?? "no recorded date"}. USD only.
      </p>
    </div>
  );
}
