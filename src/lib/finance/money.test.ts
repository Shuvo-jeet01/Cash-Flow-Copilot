import { describe, expect, it } from "vitest";
import { formatMoney, parseMoneyToMinor } from "@/lib/finance/money";

describe("integer-cent money handling", () => {
  it("parses decimal strings without floating-point arithmetic", () => {
    expect(parseMoneyToMinor("12.34")).toBe(1234);
    expect(parseMoneyToMinor("0.01")).toBe(1);
    expect(parseMoneyToMinor("12.3")).toBe(1230);
  });

  it("rejects zero, negatives, extra decimals, commas, and excessive values", () => {
    expect(() => parseMoneyToMinor("-1.00")).toThrow();
    expect(() => parseMoneyToMinor("1.001")).toThrow();
    expect(() => parseMoneyToMinor("1,000.00")).toThrow();
    expect(() => parseMoneyToMinor("10000000000.00")).toThrow();
  });

  it("allows negative opening balances only when explicitly requested", () => {
    expect(parseMoneyToMinor("-25.00", true)).toBe(-2500);
    expect(formatMoney(-2500)).toBe("-$25.00");
  });
});
