import { describe, expect, it } from "vitest";
import {
  obligationTransitionSchema,
  parseBudgetInput,
  parseObligationInput,
  parseReserveInput,
} from "@/lib/finance/phase5b-validation";

const categoryId = "10000000-0000-4000-8000-000000000001";
const idempotencyKey = "20000000-0000-4000-8000-000000000002";

describe("Phase 5B budget validation", () => {
  const header = {
    name: "Fall operating budget",
    startOn: "2026-08-01",
    endOn: "2026-12-31",
    currencyCode: "USD",
    reason: "Initial reviewed draft.",
    idempotencyKey,
  };

  it("produces integer-cent allocation payloads", () => {
    expect(
      parseBudgetInput(header, [{ categoryId, amount: "125.50" }]).allocations,
    ).toEqual([{ category_id: categoryId, amount_minor: "12550" }]);
  });

  it("rejects reversed dates, negative allocations, and duplicate categories", () => {
    expect(() =>
      parseBudgetInput({ ...header, startOn: "2027-01-01" }, []),
    ).toThrow();
    expect(() =>
      parseBudgetInput(header, [{ categoryId, amount: "-1.00" }]),
    ).toThrow();
    expect(() =>
      parseBudgetInput(header, [
        { categoryId, amount: "1.00" },
        { categoryId, amount: "2.00" },
      ]),
    ).toThrow(/only once/);
  });
});

describe("Phase 5B obligation and reserve validation", () => {
  it("accepts exact USD obligation cents and optional account absence", () => {
    const parsed = parseObligationInput({
      description: "Venue deposit",
      amount: "500.00",
      currencyCode: "USD",
      dueOn: "2026-09-01",
      categoryId,
      intendedAccountId: "",
      reference: "",
      note: "",
      initialStatus: "committed",
      idempotencyKey,
    });
    expect(parsed.amountMinor).toBe(50_000);
    expect(parsed.intendedAccountId).toBeNull();
  });

  it("rejects zero obligations and negative reserves", () => {
    expect(() =>
      parseObligationInput({
        description: "Invalid",
        amount: "0",
        currencyCode: "USD",
        dueOn: "2026-09-01",
        categoryId,
        initialStatus: "expected",
        idempotencyKey,
      }),
    ).toThrow(/positive/);
    expect(() =>
      parseReserveInput({
        amount: "-1.00",
        expectedVersion: 1,
        reason: "Invalid negative reserve.",
        idempotencyKey,
      }),
    ).toThrow();
  });

  it("rejects client-selected terminal or unknown transition statuses", () => {
    expect(() =>
      obligationTransitionSchema.parse({
        expectedVersion: 1,
        toStatus: "expected",
        transactionId: "",
        reason: "Attempted rollback.",
        idempotencyKey,
      }),
    ).toThrow();
  });
});
