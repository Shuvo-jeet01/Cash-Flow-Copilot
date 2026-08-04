import { describe, expect, it } from "vitest";
import { fileSha256, parseTransactionCsv } from "@/lib/imports/transaction-csv";

const encoder = new TextEncoder();
const accounts = [
  { id: "10000000-0000-4000-8000-000000000001", name: "Checking" },
];
const categories = [
  {
    id: "20000000-0000-4000-8000-000000000002",
    name: "Events",
    direction: "expense" as const,
  },
];

describe("transaction CSV parsing", () => {
  it("parses quoted data and resolves active account/category names", () => {
    const csv =
      "transaction_date,direction,amount,currency,description,account_name,category_name,reference,note,external_id\n" +
      '2026-08-01,expense,12.34,USD,"Synthetic, supplies",Checking,Events,REF-1,,EXT-1\n';
    const rows = parseTransactionCsv(encoder.encode(csv), accounts, categories);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      amount_minor: "1234",
      direction: "expense",
    });
  });

  it("rejects an altered template and empty files", () => {
    expect(() =>
      parseTransactionCsv(
        encoder.encode("date,amount\n2026-08-01,1"),
        accounts,
        categories,
      ),
    ).toThrow(/exact Phase 5A template/);
    expect(() =>
      parseTransactionCsv(new Uint8Array(), accounts, categories),
    ).toThrow(/non-empty/);
  });

  it("produces deterministic file fingerprints", () => {
    expect(fileSha256(encoder.encode("synthetic"))).toBe(
      fileSha256(encoder.encode("synthetic")),
    );
    expect(fileSha256(encoder.encode("synthetic"))).toHaveLength(64);
  });
});
