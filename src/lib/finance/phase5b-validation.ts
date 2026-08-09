import { z } from "zod";
import { parseMoneyToMinor } from "@/lib/finance/money";
import { reasonSchema, uuidSchema } from "@/lib/finance/validation";

const isoDateSchema = z.iso.date();

export const budgetHeaderSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    startOn: isoDateSchema,
    endOn: isoDateSchema,
    currencyCode: z.literal("USD"),
    reason: reasonSchema,
    idempotencyKey: uuidSchema,
  })
  .refine((value) => value.startOn <= value.endOn, {
    message: "Budget start date must be on or before the end date.",
    path: ["endOn"],
  });

export function parseBudgetInput(
  input: unknown,
  allocationInputs: { categoryId: string; amount: string }[],
) {
  const header = budgetHeaderSchema.parse(input);
  if (allocationInputs.length > 200)
    throw new Error("Budgets may contain at most 200 category allocations.");
  const seen = new Set<string>();
  const allocations = allocationInputs.flatMap((allocation) => {
    const categoryId = uuidSchema.parse(allocation.categoryId);
    if (seen.has(categoryId))
      throw new Error("Each category may be allocated only once.");
    seen.add(categoryId);
    const normalized = allocation.amount.trim();
    if (!normalized) return [];
    const amountMinor = parseMoneyToMinor(normalized);
    if (amountMinor < 0)
      throw new Error("Budget allocations cannot be negative.");
    return [{ category_id: categoryId, amount_minor: String(amountMinor) }];
  });
  return { ...header, allocations };
}

export const obligationSchema = z.object({
  description: z.string().trim().min(2).max(200),
  amount: z.string().trim().min(1),
  currencyCode: z.literal("USD"),
  dueOn: isoDateSchema,
  categoryId: uuidSchema,
  intendedAccountId: z.union([uuidSchema, z.literal("")]).optional(),
  reference: z.string().trim().max(100).optional(),
  note: z.string().trim().max(500).optional(),
  initialStatus: z.enum(["expected", "committed"]),
  idempotencyKey: uuidSchema,
});

export function parseObligationInput(input: unknown) {
  const parsed = obligationSchema.parse(input);
  const amountMinor = parseMoneyToMinor(parsed.amount);
  if (amountMinor <= 0) throw new Error("Obligation amount must be positive.");
  return {
    ...parsed,
    amountMinor,
    intendedAccountId: parsed.intendedAccountId || null,
  };
}

export const reserveSchema = z.object({
  amount: z.string().trim().min(1),
  expectedVersion: z.coerce.number().int().positive(),
  reason: reasonSchema,
  idempotencyKey: uuidSchema,
});

export function parseReserveInput(input: unknown) {
  const parsed = reserveSchema.parse(input);
  const amountMinor = parseMoneyToMinor(parsed.amount);
  if (amountMinor < 0) throw new Error("Reserve cannot be negative.");
  return { ...parsed, amountMinor };
}

export const workflowVersionSchema = z.coerce.number().int().positive();

export const obligationTransitionSchema = z.object({
  expectedVersion: workflowVersionSchema,
  toStatus: z.enum(["committed", "paid", "voided"]),
  transactionId: z.union([uuidSchema, z.literal("")]).optional(),
  reason: reasonSchema,
  idempotencyKey: uuidSchema,
});
