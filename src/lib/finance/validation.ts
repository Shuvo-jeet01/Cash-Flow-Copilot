import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/finance/money";

export const uuidSchema = z.string().uuid();
export const directionSchema = z.enum(["income", "expense"]);
export const accountTypeSchema = z.enum([
  "checking",
  "savings",
  "cash",
  "payment_platform",
  "other",
]);

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(100),
  accountType: accountTypeSchema,
  currencyCode: z.literal("USD"),
  openingBalance: z.string().trim().optional(),
  openingEffectiveOn: z.string().trim().optional(),
});

export const categorySchema = z.object({
  name: z.string().trim().min(2).max(100),
  direction: directionSchema,
});

export const transactionSchema = z.object({
  accountId: uuidSchema,
  categoryId: uuidSchema,
  direction: directionSchema,
  amount: z.string().trim().min(1),
  transactionDate: z.iso.date(),
  description: z.string().trim().min(2).max(200),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  idempotencyKey: uuidSchema,
});

export const reasonSchema = z.string().trim().min(5).max(500);

export function parseTransactionInput(input: unknown) {
  const parsed = transactionSchema.parse(input);
  const amountMinor = parseMoneyToMinor(parsed.amount);
  if (amountMinor <= 0) throw new Error("Amount must be greater than zero.");
  return { ...parsed, amountMinor };
}

export function isFutureIsoDate(date: string, today = new Date()) {
  const utcToday = [
    today.getUTCFullYear(),
    String(today.getUTCMonth() + 1).padStart(2, "0"),
    String(today.getUTCDate()).padStart(2, "0"),
  ].join("-");
  return date > utcToday;
}
