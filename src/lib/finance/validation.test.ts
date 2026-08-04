import { describe, expect, it } from "vitest";
import {
  isFutureIsoDate,
  parseTransactionInput,
} from "@/lib/finance/validation";

const valid = {
  accountId: "10000000-0000-4000-8000-000000000001",
  categoryId: "20000000-0000-4000-8000-000000000002",
  direction: "expense",
  amount: "10.25",
  transactionDate: "2026-08-01",
  description: "Synthetic test purchase",
  reference: "TEST-1",
  note: "Synthetic fixture only",
  idempotencyKey: "30000000-0000-4000-8000-000000000003",
};

describe("financial input validation", () => {
  it("returns integer cents for valid input", () => {
    expect(parseTransactionInput(valid).amountMinor).toBe(1025);
  });

  it("rejects malformed identifiers and zero amounts", () => {
    expect(() =>
      parseTransactionInput({ ...valid, accountId: "other-org" }),
    ).toThrow();
    expect(() => parseTransactionInput({ ...valid, amount: "0" })).toThrow();
  });

  it("compares ISO dates deterministically", () => {
    const today = new Date("2026-08-04T12:00:00Z");
    expect(isFutureIsoDate("2026-08-05", today)).toBe(true);
    expect(isFutureIsoDate("2026-08-04", today)).toBe(false);
  });
});
