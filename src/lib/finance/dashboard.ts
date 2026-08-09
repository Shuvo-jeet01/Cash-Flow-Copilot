import {
  addDaysIso,
  calculateAccountBalances,
  calculateBudgetPerformance,
  calculateProjectedCash,
  isLedgerStale,
  localIsoDate,
} from "@/lib/finance/calculations";
import { requireFinancialReader } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";

export const SUPPORTED_FORECAST_HORIZONS = [30, 60, 90] as const;
export type ForecastHorizon = (typeof SUPPORTED_FORECAST_HORIZONS)[number];

export function parseForecastHorizon(value?: string): ForecastHorizon {
  const parsed = Number(value ?? 30);
  return SUPPORTED_FORECAST_HORIZONS.includes(parsed as ForecastHorizon)
    ? (parsed as ForecastHorizon)
    : 30;
}

export async function loadFinancialDashboard(
  untrustedOrganizationId: string,
  horizon: ForecastHorizon,
) {
  const context = await requireFinancialReader(untrustedOrganizationId);
  const { supabase } = await requireUser();
  const { data: settings, error: settingsError } = await supabase
    .from("organization_financial_settings")
    .select(
      "organization_id,timezone,base_currency,minimum_reserve_minor,reserve_version,updated_at",
    )
    .eq("organization_id", context.id)
    .maybeSingle();
  if (settingsError) throw new Error("Financial settings could not be loaded.");
  if (!settings)
    return {
      context,
      needsFinancialSetup: true as const,
      horizon,
    };

  const asOfDate = localIsoDate(settings.timezone);
  const forecastDate = addDaysIso(asOfDate, horizon);
  const [
    accountsResult,
    openingsResult,
    transactionsResult,
    categoriesResult,
    revisionResult,
    obligationsResult,
  ] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .order("name"),
    supabase
      .from("account_opening_balance_entries")
      .select("id,account_id,amount_minor,effective_on,supersedes_entry_id")
      .eq("organization_id", context.id)
      .lte("effective_on", asOfDate),
    supabase
      .from("financial_transactions")
      .select(
        "id,account_id,category_id,direction,amount_minor,transaction_date,status",
      )
      .eq("organization_id", context.id)
      .lte("transaction_date", asOfDate),
    supabase
      .from("transaction_categories")
      .select("id,name,direction,status")
      .eq("organization_id", context.id)
      .order("name"),
    supabase
      .from("budget_revisions")
      .select("id,budget_id,name,start_on,end_on,revision_number,status")
      .eq("organization_id", context.id)
      .eq("status", "effective")
      .lte("start_on", asOfDate)
      .gte("end_on", asOfDate)
      .maybeSingle(),
    supabase
      .from("financial_obligations")
      .select("id,description,amount_minor,due_on,status")
      .eq("organization_id", context.id)
      .order("due_on"),
  ]);
  const firstError = [
    accountsResult.error,
    openingsResult.error,
    transactionsResult.error,
    categoriesResult.error,
    revisionResult.error,
    obligationsResult.error,
  ].find(Boolean);
  if (firstError)
    throw new Error("Authoritative financial records could not be loaded.");

  const accounts = accountsResult.data ?? [];
  const openingEntries = openingsResult.data ?? [];
  const transactions = transactionsResult.data ?? [];
  const categories = categoriesResult.data ?? [];
  const obligations = obligationsResult.data ?? [];
  const balances = calculateAccountBalances({
    accounts,
    openingEntries,
    transactions,
    asOfDate,
  });
  const projection = calculateProjectedCash({
    currentCashMinor: balances.organizationCashMinor,
    minimumReserveMinor: settings.minimum_reserve_minor,
    obligations,
    asOfDate,
    forecastDate,
  });

  let budgetPerformance: ReturnType<typeof calculateBudgetPerformance> | null =
    null;
  if (revisionResult.data) {
    const { data: allocations, error } = await supabase
      .from("budget_allocations")
      .select("id,category_id,direction,amount_minor")
      .eq("organization_id", context.id)
      .eq("revision_id", revisionResult.data.id);
    if (error) throw new Error("Budget allocations could not be loaded.");
    budgetPerformance = calculateBudgetPerformance({
      revision: revisionResult.data,
      allocations: allocations ?? [],
      categories,
      transactions,
    });
  }

  const latestRecordDate =
    [
      ...transactions
        .filter((transaction) => transaction.status === "posted")
        .map((transaction) => transaction.transaction_date),
      ...openingEntries.map((entry) => entry.effective_on),
    ]
      .sort()
      .at(-1) ?? null;

  return {
    context,
    needsFinancialSetup: false as const,
    settings,
    horizon,
    asOfDate,
    forecastDate,
    calculatedAt: new Date().toISOString(),
    latestRecordDate,
    stale: isLedgerStale(latestRecordDate, asOfDate),
    balances,
    activeRevision: revisionResult.data,
    budgetPerformance,
    projection,
  };
}
