import { describe, expect, it } from "vitest";
import {
  addDaysIso,
  calculateAccountBalances,
  calculateBudgetPerformance,
  calculateProjectedCash,
  checkedAddMinor,
  isLedgerStale,
  localIsoDate,
} from "@/lib/finance/calculations";

const accounts = [
  { id: "checking", name: "Checking", status: "active" as const },
  { id: "archived", name: "Archived cash", status: "archived" as const },
];

const categories = [
  {
    id: "income",
    name: "Dues received",
    direction: "income" as const,
    status: "active" as const,
  },
  {
    id: "expense",
    name: "Operations",
    direction: "expense" as const,
    status: "active" as const,
  },
  {
    id: "archived-expense",
    name: "Old events",
    direction: "expense" as const,
    status: "archived" as const,
  },
  {
    id: "unbudgeted",
    name: "Unbudgeted gifts",
    direction: "income" as const,
    status: "active" as const,
  },
];

describe("deterministic account and organization balances", () => {
  it("uses the effective opening entry, posted replacement, and archived account", () => {
    const result = calculateAccountBalances({
      accounts,
      asOfDate: "2026-08-31",
      openingEntries: [
        {
          id: "opening-old",
          account_id: "checking",
          amount_minor: 10_000,
          effective_on: "2026-01-01",
          supersedes_entry_id: null,
        },
        {
          id: "opening-new",
          account_id: "checking",
          amount_minor: 11_000,
          effective_on: "2026-01-01",
          supersedes_entry_id: "opening-old",
        },
        {
          id: "archived-opening",
          account_id: "archived",
          amount_minor: -500,
          effective_on: "2026-01-01",
          supersedes_entry_id: null,
        },
      ],
      transactions: [
        {
          id: "income",
          account_id: "checking",
          category_id: "income",
          direction: "income",
          amount_minor: 3_000,
          transaction_date: "2026-08-01",
          status: "posted",
        },
        {
          id: "voided-original",
          account_id: "checking",
          category_id: "expense",
          direction: "expense",
          amount_minor: 1_000,
          transaction_date: "2026-08-02",
          status: "voided",
        },
        {
          id: "posted-replacement",
          account_id: "checking",
          category_id: "expense",
          direction: "expense",
          amount_minor: 900,
          transaction_date: "2026-08-02",
          status: "posted",
        },
        {
          id: "future",
          account_id: "checking",
          category_id: "expense",
          direction: "expense",
          amount_minor: 8_000,
          transaction_date: "2026-09-01",
          status: "posted",
        },
      ],
    });
    expect(result.accountBalances).toEqual([
      expect.objectContaining({
        id: "checking",
        openingBalanceMinor: 11_000,
        balanceMinor: 13_100,
      }),
      expect.objectContaining({
        id: "archived",
        openingBalanceMinor: -500,
        balanceMinor: -500,
      }),
    ]);
    expect(result.organizationCashMinor).toBe(12_600);
  });

  it("supports empty and zero-dollar organizations without inventing cash", () => {
    expect(
      calculateAccountBalances({
        accounts: [],
        openingEntries: [],
        transactions: [],
        asOfDate: "2026-08-04",
      }).organizationCashMinor,
    ).toBe(0);
    expect(
      calculateAccountBalances({
        accounts: accounts.slice(0, 1),
        openingEntries: [],
        transactions: [],
        asOfDate: "2026-08-04",
      }).accountBalances[0]?.balanceMinor,
    ).toBe(0);
  });

  it("accepts very large safe totals and rejects overflow", () => {
    expect(checkedAddMinor(999_999_999_999, 999_999_999_999)).toBe(
      1_999_999_999_998,
    );
    expect(() => checkedAddMinor(Number.MAX_SAFE_INTEGER, 1)).toThrow(
      /safe range/,
    );
    expect(() => checkedAddMinor(1.5)).toThrow(/safe integer/);
  });
});

describe("budget versus actual calculations", () => {
  const revision = {
    id: "revision",
    name: "Fall budget",
    start_on: "2026-08-01",
    end_on: "2026-08-31",
    revision_number: 1,
  };
  const allocations = [
    {
      id: "income-allocation",
      category_id: "income",
      direction: "income" as const,
      amount_minor: 10_000,
    },
    {
      id: "expense-allocation",
      category_id: "expense",
      direction: "expense" as const,
      amount_minor: 5_000,
    },
    {
      id: "archived-allocation",
      category_id: "archived-expense",
      direction: "expense" as const,
      amount_minor: 1_000,
    },
  ];
  const transactions = [
    {
      id: "start-income",
      account_id: "checking",
      category_id: "income",
      direction: "income" as const,
      amount_minor: 8_000,
      transaction_date: "2026-08-01",
      status: "posted" as const,
    },
    {
      id: "end-expense",
      account_id: "checking",
      category_id: "expense",
      direction: "expense" as const,
      amount_minor: 6_000,
      transaction_date: "2026-08-31",
      status: "posted" as const,
    },
    {
      id: "archived-category",
      account_id: "checking",
      category_id: "archived-expense",
      direction: "expense" as const,
      amount_minor: 500,
      transaction_date: "2026-08-15",
      status: "posted" as const,
    },
    {
      id: "unbudgeted-income",
      account_id: "checking",
      category_id: "unbudgeted",
      direction: "income" as const,
      amount_minor: 3_000,
      transaction_date: "2026-08-10",
      status: "posted" as const,
    },
    {
      id: "voided",
      account_id: "checking",
      category_id: "expense",
      direction: "expense" as const,
      amount_minor: 50_000,
      transaction_date: "2026-08-10",
      status: "voided" as const,
    },
    {
      id: "outside",
      account_id: "checking",
      category_id: "income",
      direction: "income" as const,
      amount_minor: 100_000,
      transaction_date: "2026-09-01",
      status: "posted" as const,
    },
  ];

  it("includes both date boundaries, archived categories, and unbudgeted actuals", () => {
    const result = calculateBudgetPerformance({
      revision,
      allocations,
      categories,
      transactions,
    });
    expect(result.plannedIncomeMinor).toBe(10_000);
    expect(result.plannedExpenseMinor).toBe(6_000);
    expect(result.actualIncomeMinor).toBe(11_000);
    expect(result.actualExpenseMinor).toBe(6_500);
    expect(result.incomeVarianceMinor).toBe(1_000);
    expect(result.expenseRemainingMinor).toBe(-500);
    expect(result.plannedNetMinor).toBe(4_000);
    expect(result.actualNetMinor).toBe(4_500);
    expect(result.unbudgetedIncomeMinor).toBe(3_000);
    expect(result.unbudgetedExpenseMinor).toBe(0);
    expect(result.allocatedLines).toContainEqual(
      expect.objectContaining({
        categoryId: "archived-expense",
        categoryStatus: "archived",
        actualMinor: 500,
      }),
    );
  });

  it("reports income below target without clamping the negative variance", () => {
    const result = calculateBudgetPerformance({
      revision,
      allocations: allocations.slice(0, 1),
      categories,
      transactions: transactions.slice(0, 1),
    });
    expect(result.incomeVarianceMinor).toBe(-2_000);
  });
});

describe("projected cash and reserve", () => {
  const obligations = [
    {
      id: "expected",
      description: "Expected quote",
      amount_minor: 1_000,
      due_on: "2026-08-10",
      status: "expected" as const,
    },
    {
      id: "overdue-committed",
      description: "Overdue committed bill",
      amount_minor: 2_000,
      due_on: "2026-08-01",
      status: "committed" as const,
    },
    {
      id: "inside",
      description: "Inside horizon",
      amount_minor: 3_000,
      due_on: "2026-09-03",
      status: "committed" as const,
    },
    {
      id: "outside",
      description: "Outside horizon",
      amount_minor: 4_000,
      due_on: "2026-09-04",
      status: "committed" as const,
    },
    {
      id: "paid",
      description: "Already in ledger",
      amount_minor: 9_000,
      due_on: "2026-08-05",
      status: "paid" as const,
    },
    {
      id: "voided",
      description: "Cancelled",
      amount_minor: 9_000,
      due_on: "2026-08-05",
      status: "voided" as const,
    },
  ];

  it("deducts only committed obligations inside the inclusive horizon", () => {
    const result = calculateProjectedCash({
      currentCashMinor: 10_000,
      minimumReserveMinor: 4_000,
      obligations,
      asOfDate: "2026-08-04",
      forecastDate: "2026-09-03",
    });
    expect(result.totalCommittedMinor).toBe(9_000);
    expect(result.committedWithinHorizonMinor).toBe(5_000);
    expect(result.expectedMinor).toBe(1_000);
    expect(result.projectedCashMinor).toBe(5_000);
    expect(result.cashAfterReserveMinor).toBe(1_000);
    expect(result.reserveState).toBe("surplus");
    expect(result.overdue.map((item) => item.id)).toEqual([
      "overdue-committed",
    ]);
  });

  it("preserves negative cash and reserve shortfalls", () => {
    const result = calculateProjectedCash({
      currentCashMinor: -500,
      minimumReserveMinor: 1_000,
      obligations: obligations.slice(1, 2),
      asOfDate: "2026-08-04",
      forecastDate: "2026-09-03",
    });
    expect(result.projectedCashMinor).toBe(-2_500);
    expect(result.cashAfterReserveMinor).toBe(-3_500);
    expect(result.reserveState).toBe("shortfall");
  });

  it("supports zero reserve and deterministic date helpers", () => {
    expect(
      calculateProjectedCash({
        currentCashMinor: 100,
        minimumReserveMinor: 0,
        obligations: [],
        asOfDate: "2026-08-04",
        forecastDate: "2026-08-04",
      }).cashAfterReserveMinor,
    ).toBe(100);
    expect(addDaysIso("2026-08-04", 30)).toBe("2026-09-03");
    expect(
      localIsoDate("America/Chicago", new Date("2026-08-05T02:00:00.000Z")),
    ).toBe("2026-08-04");
    expect(isLedgerStale("2026-07-04", "2026-08-04")).toBe(true);
    expect(isLedgerStale("2026-07-05", "2026-08-04")).toBe(false);
  });
});
