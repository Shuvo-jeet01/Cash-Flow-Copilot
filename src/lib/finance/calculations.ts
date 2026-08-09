import type {
  FinancialRecordStatus,
  FinancialTransactionStatus,
  ObligationStatus,
  TransactionDirection,
} from "@/types/database";

export type AccountCalculationInput = {
  id: string;
  name: string;
  status: FinancialRecordStatus;
};

export type OpeningBalanceCalculationInput = {
  id: string;
  account_id: string;
  amount_minor: number;
  effective_on: string;
  supersedes_entry_id: string | null;
};

export type TransactionCalculationInput = {
  id: string;
  account_id: string;
  category_id: string;
  direction: TransactionDirection;
  amount_minor: number;
  transaction_date: string;
  status: FinancialTransactionStatus;
};

export type CategoryCalculationInput = {
  id: string;
  name: string;
  direction: TransactionDirection;
  status: FinancialRecordStatus;
};

export type BudgetRevisionCalculationInput = {
  id: string;
  name: string;
  start_on: string;
  end_on: string;
  revision_number: number;
};

export type BudgetAllocationCalculationInput = {
  id: string;
  category_id: string;
  direction: TransactionDirection;
  amount_minor: number;
};

export type ObligationCalculationInput = {
  id: string;
  description: string;
  amount_minor: number;
  due_on: string;
  status: ObligationStatus;
};

export function checkedAddMinor(...values: number[]) {
  let result = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value))
      throw new Error("Financial input is not a safe integer.");
    result += value;
    if (!Number.isSafeInteger(result))
      throw new Error("Financial total exceeds the supported safe range.");
  }
  return result;
}

export function checkedSubtractMinor(left: number, right: number) {
  return checkedAddMinor(left, -right);
}

export function sumMinor(values: Iterable<number>) {
  let total = 0;
  for (const value of values) total = checkedAddMinor(total, value);
  return total;
}

function assertIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new Error("Expected an ISO calendar date.");
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(parsed.valueOf()) ||
    parsed.toISOString().slice(0, 10) !== value
  )
    throw new Error("Expected a valid ISO calendar date.");
}

export function addDaysIso(value: string, days: number) {
  assertIsoDate(value);
  if (!Number.isInteger(days) || days < 0 || days > 366)
    throw new Error("Forecast horizon is outside the supported range.");
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function localIsoDate(timeZone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  const result = `${values.year}-${values.month}-${values.day}`;
  assertIsoDate(result);
  return result;
}

export function isLedgerStale(
  latestRecordDate: string | null,
  asOfDate: string,
  thresholdDays = 30,
) {
  assertIsoDate(asOfDate);
  if (latestRecordDate === null) return true;
  assertIsoDate(latestRecordDate);
  return addDaysIso(latestRecordDate, thresholdDays) < asOfDate;
}

export function calculateAccountBalances({
  accounts,
  openingEntries,
  transactions,
  asOfDate,
}: {
  accounts: AccountCalculationInput[];
  openingEntries: OpeningBalanceCalculationInput[];
  transactions: TransactionCalculationInput[];
  asOfDate: string;
}) {
  assertIsoDate(asOfDate);
  const accountMap = new Map(accounts.map((account) => [account.id, account]));
  const eligibleEntries = openingEntries.filter(
    (entry) => entry.effective_on <= asOfDate,
  );
  const supersededEligibleIds = new Set(
    eligibleEntries.flatMap((entry) =>
      entry.supersedes_entry_id ? [entry.supersedes_entry_id] : [],
    ),
  );
  const openingByAccount = new Map<string, number>();
  for (const entry of eligibleEntries) {
    if (!accountMap.has(entry.account_id))
      throw new Error("Opening balance references an unknown account.");
    if (supersededEligibleIds.has(entry.id)) continue;
    if (openingByAccount.has(entry.account_id))
      throw new Error("Account has more than one effective opening balance.");
    openingByAccount.set(entry.account_id, entry.amount_minor);
  }

  const balances = new Map(
    accounts.map((account) => [
      account.id,
      openingByAccount.get(account.id) ?? 0,
    ]),
  );
  for (const transaction of transactions) {
    if (
      transaction.status !== "posted" ||
      transaction.transaction_date > asOfDate
    )
      continue;
    const current = balances.get(transaction.account_id);
    if (current === undefined)
      throw new Error("Transaction references an unknown account.");
    const signedAmount =
      transaction.direction === "income"
        ? transaction.amount_minor
        : -transaction.amount_minor;
    balances.set(
      transaction.account_id,
      checkedAddMinor(current, signedAmount),
    );
  }

  const accountBalances = accounts.map((account) => ({
    ...account,
    openingBalanceMinor: openingByAccount.get(account.id) ?? 0,
    balanceMinor: balances.get(account.id) ?? 0,
  }));
  return {
    accountBalances,
    organizationCashMinor: sumMinor(
      accountBalances.map((account) => account.balanceMinor),
    ),
  };
}

export function calculateBudgetPerformance({
  revision,
  allocations,
  categories,
  transactions,
}: {
  revision: BudgetRevisionCalculationInput;
  allocations: BudgetAllocationCalculationInput[];
  categories: CategoryCalculationInput[];
  transactions: TransactionCalculationInput[];
}) {
  assertIsoDate(revision.start_on);
  assertIsoDate(revision.end_on);
  if (revision.start_on > revision.end_on)
    throw new Error("Budget dates are invalid.");
  const categoryMap = new Map(
    categories.map((category) => [category.id, category]),
  );
  const allocationMap = new Map<string, BudgetAllocationCalculationInput>();
  let plannedIncomeMinor = 0;
  let plannedExpenseMinor = 0;
  for (const allocation of allocations) {
    if (allocationMap.has(allocation.category_id))
      throw new Error("Budget category is allocated more than once.");
    const category = categoryMap.get(allocation.category_id);
    if (!category || category.direction !== allocation.direction)
      throw new Error("Budget allocation category direction is inconsistent.");
    allocationMap.set(allocation.category_id, allocation);
    if (allocation.direction === "income")
      plannedIncomeMinor = checkedAddMinor(
        plannedIncomeMinor,
        allocation.amount_minor,
      );
    else
      plannedExpenseMinor = checkedAddMinor(
        plannedExpenseMinor,
        allocation.amount_minor,
      );
  }

  const actualByCategory = new Map<string, number>();
  let actualIncomeMinor = 0;
  let actualExpenseMinor = 0;
  for (const transaction of transactions) {
    if (
      transaction.status !== "posted" ||
      transaction.transaction_date < revision.start_on ||
      transaction.transaction_date > revision.end_on
    )
      continue;
    const category = categoryMap.get(transaction.category_id);
    if (!category || category.direction !== transaction.direction)
      throw new Error("Transaction category direction is inconsistent.");
    actualByCategory.set(
      transaction.category_id,
      checkedAddMinor(
        actualByCategory.get(transaction.category_id) ?? 0,
        transaction.amount_minor,
      ),
    );
    if (transaction.direction === "income")
      actualIncomeMinor = checkedAddMinor(
        actualIncomeMinor,
        transaction.amount_minor,
      );
    else
      actualExpenseMinor = checkedAddMinor(
        actualExpenseMinor,
        transaction.amount_minor,
      );
  }

  const allocatedLines = allocations.map((allocation) => {
    const category = categoryMap.get(allocation.category_id)!;
    const actualMinor = actualByCategory.get(allocation.category_id) ?? 0;
    return {
      categoryId: category.id,
      categoryName: category.name,
      categoryStatus: category.status,
      direction: allocation.direction,
      plannedMinor: allocation.amount_minor,
      actualMinor,
      varianceMinor:
        allocation.direction === "income"
          ? checkedSubtractMinor(actualMinor, allocation.amount_minor)
          : checkedSubtractMinor(allocation.amount_minor, actualMinor),
    };
  });

  const unbudgetedLines = [...actualByCategory.entries()]
    .filter(([categoryId]) => !allocationMap.has(categoryId))
    .map(([categoryId, actualMinor]) => {
      const category = categoryMap.get(categoryId)!;
      return {
        categoryId,
        categoryName: category.name,
        categoryStatus: category.status,
        direction: category.direction,
        actualMinor,
      };
    });
  const unbudgetedIncomeMinor = sumMinor(
    unbudgetedLines
      .filter((line) => line.direction === "income")
      .map((line) => line.actualMinor),
  );
  const unbudgetedExpenseMinor = sumMinor(
    unbudgetedLines
      .filter((line) => line.direction === "expense")
      .map((line) => line.actualMinor),
  );

  return {
    allocatedLines,
    unbudgetedLines,
    plannedIncomeMinor,
    plannedExpenseMinor,
    actualIncomeMinor,
    actualExpenseMinor,
    unbudgetedIncomeMinor,
    unbudgetedExpenseMinor,
    plannedNetMinor: checkedSubtractMinor(
      plannedIncomeMinor,
      plannedExpenseMinor,
    ),
    actualNetMinor: checkedSubtractMinor(actualIncomeMinor, actualExpenseMinor),
    incomeVarianceMinor: checkedSubtractMinor(
      actualIncomeMinor,
      plannedIncomeMinor,
    ),
    expenseRemainingMinor: checkedSubtractMinor(
      plannedExpenseMinor,
      actualExpenseMinor,
    ),
  };
}

export function calculateProjectedCash({
  currentCashMinor,
  minimumReserveMinor,
  obligations,
  asOfDate,
  forecastDate,
}: {
  currentCashMinor: number;
  minimumReserveMinor: number;
  obligations: ObligationCalculationInput[];
  asOfDate: string;
  forecastDate: string;
}) {
  assertIsoDate(asOfDate);
  assertIsoDate(forecastDate);
  if (forecastDate < asOfDate)
    throw new Error("Forecast date cannot precede the as-of date.");
  if (!Number.isSafeInteger(minimumReserveMinor) || minimumReserveMinor < 0)
    throw new Error("Minimum reserve must be nonnegative integer cents.");

  const committed = obligations.filter(
    (obligation) => obligation.status === "committed",
  );
  const committedWithinHorizon = committed.filter(
    (obligation) => obligation.due_on <= forecastDate,
  );
  const expected = obligations.filter(
    (obligation) => obligation.status === "expected",
  );
  const expectedWithinHorizon = expected.filter(
    (obligation) => obligation.due_on <= forecastDate,
  );
  const overdue = obligations.filter(
    (obligation) =>
      (obligation.status === "expected" || obligation.status === "committed") &&
      obligation.due_on < asOfDate,
  );
  const totalCommittedMinor = sumMinor(
    committed.map((obligation) => obligation.amount_minor),
  );
  const committedWithinHorizonMinor = sumMinor(
    committedWithinHorizon.map((obligation) => obligation.amount_minor),
  );
  const expectedMinor = sumMinor(
    expected.map((obligation) => obligation.amount_minor),
  );
  const projectedCashMinor = checkedSubtractMinor(
    currentCashMinor,
    committedWithinHorizonMinor,
  );
  const cashAfterReserveMinor = checkedSubtractMinor(
    projectedCashMinor,
    minimumReserveMinor,
  );
  return {
    committed,
    committedWithinHorizon,
    expected,
    expectedWithinHorizon,
    overdue,
    totalCommittedMinor,
    committedWithinHorizonMinor,
    expectedMinor,
    projectedCashMinor,
    cashAfterReserveMinor,
    reserveState:
      cashAfterReserveMinor >= 0
        ? ("surplus" as const)
        : ("shortfall" as const),
  };
}
