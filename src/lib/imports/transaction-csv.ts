import { createHash } from "node:crypto";
import { parse } from "csv-parse/sync";
import { parseMoneyToMinor } from "@/lib/finance/money";
import type { Json, TransactionDirection } from "@/types/database";

export const TRANSACTION_CSV_HEADERS = [
  "transaction_date",
  "direction",
  "amount",
  "currency",
  "description",
  "account_name",
  "category_name",
  "reference",
  "note",
  "external_id",
] as const;

export const MAX_CSV_BYTES = 1_000_000;
export const MAX_CSV_ROWS = 5_000;

type CsvRecord = Record<(typeof TRANSACTION_CSV_HEADERS)[number], string>;
type Match = { id: string; name: string; direction?: TransactionDirection };

function normalizeLookup(value: string) {
  return value.trim().toLocaleLowerCase("en-US");
}

export function fileSha256(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function parseTransactionCsv(
  bytes: Uint8Array,
  accounts: Match[],
  categories: Match[],
): Json[] {
  if (bytes.byteLength === 0) throw new Error("Choose a non-empty CSV file.");
  if (bytes.byteLength > MAX_CSV_BYTES)
    throw new Error("CSV files must be 1 MB or smaller.");
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  if (text.includes("\0"))
    throw new Error("Binary content is not allowed in CSV files.");
  const records = parse(text, {
    bom: true,
    columns(header: string[]) {
      const exact =
        header.length === TRANSACTION_CSV_HEADERS.length &&
        header.every(
          (value, index) => value === TRANSACTION_CSV_HEADERS[index],
        );
      if (!exact)
        throw new Error(
          `Use the exact Phase 5A template headers: ${TRANSACTION_CSV_HEADERS.join(",")}`,
        );
      return header;
    },
    skip_empty_lines: true,
    relax_column_count: false,
    max_record_size: 10_000,
  }) as CsvRecord[];
  if (records.length === 0)
    throw new Error("The CSV contains no transaction rows.");
  if (records.length > MAX_CSV_ROWS)
    throw new Error(`CSV files may contain at most ${MAX_CSV_ROWS} rows.`);

  const accountMap = new Map(
    accounts.map((item) => [normalizeLookup(item.name), item.id]),
  );
  const categoryMap = new Map(
    categories.map((item) => [
      `${item.direction ?? ""}:${normalizeLookup(item.name)}`,
      item.id,
    ]),
  );

  return records.map((record, index) => {
    const direction = record.direction.trim().toLowerCase();
    let amountMinor = "";
    try {
      amountMinor = String(parseMoneyToMinor(record.amount));
    } catch {
      // The database preview records the row-level blocking error.
    }
    return {
      row_number: String(index + 1),
      transaction_date: record.transaction_date.trim(),
      direction,
      amount_minor: amountMinor,
      currency: record.currency.trim().toUpperCase(),
      description: record.description.trim(),
      account_id: accountMap.get(normalizeLookup(record.account_name)) ?? "",
      category_id:
        categoryMap.get(
          `${direction}:${normalizeLookup(record.category_name)}`,
        ) ?? "",
      reference: record.reference.trim(),
      note: record.note.trim(),
      external_id: record.external_id.trim(),
    } satisfies Json;
  });
}
