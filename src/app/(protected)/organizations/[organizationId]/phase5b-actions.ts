"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import {
  obligationTransitionSchema,
  parseBudgetInput,
  parseObligationInput,
  parseReserveInput,
  workflowVersionSchema,
} from "@/lib/finance/phase5b-validation";
import { reasonSchema, uuidSchema } from "@/lib/finance/validation";
import type { ObligationStatus } from "@/types/database";

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function fail(path: string, message: string): never {
  redirect(`${path}?message=${encodeURIComponent(message)}`);
}

function organizationPath(organizationId: string, suffix: string) {
  return `/organizations/${organizationId}/${suffix}`;
}

function budgetFormInput(formData: FormData) {
  const categoryIds = formData
    .getAll("allocationCategoryId")
    .filter((value): value is string => typeof value === "string");
  const amounts = formData
    .getAll("allocationAmount")
    .filter((value): value is string => typeof value === "string");
  if (categoryIds.length !== amounts.length)
    throw new Error("Budget allocation fields are inconsistent.");
  return parseBudgetInput(
    {
      name: text(formData, "name"),
      startOn: text(formData, "startOn"),
      endOn: text(formData, "endOn"),
      currencyCode: text(formData, "currencyCode"),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    },
    categoryIds.map((categoryId, index) => ({
      categoryId,
      amount: amounts[index] ?? "",
    })),
  );
}

export async function createBudget(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "budgets/new");
  let input: ReturnType<typeof budgetFormInput>;
  try {
    input = budgetFormInput(formData);
  } catch {
    fail(path, "Check the budget dates, reason, and USD category amounts.");
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_organization_budget", {
    requested_organization_id: context.id,
    requested_name: input.name,
    requested_start_on: input.startOn,
    requested_end_on: input.endOn,
    requested_currency_code: "USD",
    requested_allocations: input.allocations,
    requested_reason: input.reason,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) fail(path, "The draft budget could not be created.");
  revalidatePath(organizationPath(context.id, "budgets"));
  redirect(organizationPath(context.id, `budgets/${data}`));
}

export async function updateDraftBudget(
  untrustedOrganizationId: string,
  untrustedBudgetId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const budgetId = uuidSchema.parse(untrustedBudgetId);
  const path = organizationPath(context.id, `budgets/${budgetId}`);
  let input: ReturnType<typeof budgetFormInput>;
  try {
    input = budgetFormInput(formData);
  } catch {
    fail(path, "Check the draft budget fields and allocation amounts.");
  }
  const expectedVersion = workflowVersionSchema.safeParse(
    text(formData, "expectedVersion"),
  );
  if (!expectedVersion.success) fail(path, "Refresh the draft and try again.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_draft_budget", {
    requested_organization_id: context.id,
    requested_budget_id: budgetId,
    requested_expected_version: expectedVersion.data,
    requested_name: input.name,
    requested_start_on: input.startOn,
    requested_end_on: input.endOn,
    requested_currency_code: "USD",
    requested_allocations: input.allocations,
    requested_reason: input.reason,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error)
    fail(
      path,
      "The draft changed or one of its categories is no longer active.",
    );
  revalidatePath(path);
  redirect(path);
}

export async function activateBudget(
  untrustedOrganizationId: string,
  untrustedBudgetId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const budgetId = uuidSchema.parse(untrustedBudgetId);
  const path = organizationPath(context.id, `budgets/${budgetId}`);
  const parsed = z
    .object({
      expectedVersion: workflowVersionSchema,
      reason: reasonSchema,
      idempotencyKey: uuidSchema,
    })
    .safeParse({
      expectedVersion: text(formData, "expectedVersion"),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
  if (!parsed.success) fail(path, "Provide a meaningful activation reason.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("activate_budget", {
    requested_organization_id: context.id,
    requested_budget_id: budgetId,
    requested_expected_version: parsed.data.expectedVersion,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error)
    fail(
      path,
      "Activation failed. Check for stale data, archived categories, or an overlapping active budget.",
    );
  revalidatePath(organizationPath(context.id, "budgets"));
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}

export async function reviseActiveBudget(
  untrustedOrganizationId: string,
  untrustedBudgetId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const budgetId = uuidSchema.parse(untrustedBudgetId);
  const path = organizationPath(context.id, `budgets/${budgetId}`);
  let input: ReturnType<typeof budgetFormInput>;
  try {
    input = budgetFormInput(formData);
  } catch {
    fail(path, "Check the approved revision fields and allocation amounts.");
  }
  const expectedVersion = workflowVersionSchema.safeParse(
    text(formData, "expectedVersion"),
  );
  if (!expectedVersion.success) fail(path, "Refresh the budget and try again.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("revise_active_budget", {
    requested_organization_id: context.id,
    requested_budget_id: budgetId,
    requested_expected_version: expectedVersion.data,
    requested_name: input.name,
    requested_start_on: input.startOn,
    requested_end_on: input.endOn,
    requested_currency_code: "USD",
    requested_allocations: input.allocations,
    requested_reason: input.reason,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error)
    fail(
      path,
      "The revision was rejected because the budget changed, overlaps another active period, or uses an inactive category.",
    );
  revalidatePath(path);
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}

export async function closeBudget(
  untrustedOrganizationId: string,
  untrustedBudgetId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const budgetId = uuidSchema.parse(untrustedBudgetId);
  const path = organizationPath(context.id, `budgets/${budgetId}`);
  const parsed = z
    .object({
      expectedVersion: workflowVersionSchema,
      reason: reasonSchema,
      idempotencyKey: uuidSchema,
    })
    .safeParse({
      expectedVersion: text(formData, "expectedVersion"),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
  if (!parsed.success) fail(path, "Provide a meaningful closure reason.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("close_budget", {
    requested_organization_id: context.id,
    requested_budget_id: budgetId,
    requested_expected_version: parsed.data.expectedVersion,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error) fail(path, "The budget changed or is already closed.");
  revalidatePath(organizationPath(context.id, "budgets"));
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}

function obligationFormInput(formData: FormData) {
  return parseObligationInput({
    description: text(formData, "description"),
    amount: text(formData, "amount"),
    currencyCode: text(formData, "currencyCode"),
    dueOn: text(formData, "dueOn"),
    categoryId: text(formData, "categoryId"),
    intendedAccountId: text(formData, "intendedAccountId"),
    reference: text(formData, "reference"),
    note: text(formData, "note"),
    initialStatus: text(formData, "initialStatus"),
    idempotencyKey: text(formData, "idempotencyKey"),
  });
}

export async function createObligation(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "obligations/new");
  let input: ReturnType<typeof obligationFormInput>;
  try {
    input = obligationFormInput(formData);
  } catch {
    fail(path, "Check the obligation amount, date, category, and status.");
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_financial_obligation", {
    requested_organization_id: context.id,
    requested_description: input.description,
    requested_amount_minor: input.amountMinor,
    requested_currency_code: "USD",
    requested_due_on: input.dueOn,
    requested_category_id: input.categoryId,
    requested_intended_account_id: input.intendedAccountId,
    requested_reference: input.reference || null,
    requested_note: input.note || null,
    requested_initial_status: input.initialStatus,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error || !data) fail(path, "The obligation could not be created.");
  revalidatePath(organizationPath(context.id, "obligations"));
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(organizationPath(context.id, `obligations/${data}`));
}

export async function updateObligation(
  untrustedOrganizationId: string,
  untrustedObligationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const obligationId = uuidSchema.parse(untrustedObligationId);
  const path = organizationPath(context.id, `obligations/${obligationId}`);
  let input: ReturnType<typeof obligationFormInput>;
  try {
    input = obligationFormInput(formData);
  } catch {
    fail(path, "Check the obligation fields.");
  }
  const expectedVersion = workflowVersionSchema.safeParse(
    text(formData, "expectedVersion"),
  );
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!expectedVersion.success || !reason.success)
    fail(path, "Provide a meaningful update reason and refresh if needed.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("update_financial_obligation", {
    requested_organization_id: context.id,
    requested_obligation_id: obligationId,
    requested_expected_version: expectedVersion.data,
    requested_description: input.description,
    requested_amount_minor: input.amountMinor,
    requested_currency_code: "USD",
    requested_due_on: input.dueOn,
    requested_category_id: input.categoryId,
    requested_intended_account_id: input.intendedAccountId,
    requested_reference: input.reference || null,
    requested_note: input.note || null,
    requested_reason: reason.data,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error) fail(path, "The obligation changed or is no longer editable.");
  revalidatePath(path);
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}

export async function transitionObligation(
  untrustedOrganizationId: string,
  untrustedObligationId: string,
  untrustedToStatus: ObligationStatus,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const obligationId = uuidSchema.parse(untrustedObligationId);
  const path = organizationPath(context.id, `obligations/${obligationId}`);
  const parsed = obligationTransitionSchema.safeParse({
    expectedVersion: text(formData, "expectedVersion"),
    toStatus: untrustedToStatus,
    transactionId: text(formData, "transactionId"),
    reason: text(formData, "reason"),
    idempotencyKey: text(formData, "idempotencyKey"),
  });
  if (!parsed.success)
    fail(path, "Provide a valid transition, reason, and payment transaction.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("transition_financial_obligation", {
    requested_organization_id: context.id,
    requested_obligation_id: obligationId,
    requested_expected_version: parsed.data.expectedVersion,
    requested_to_status: parsed.data.toStatus,
    requested_transaction_id: parsed.data.transactionId || null,
    requested_reason: parsed.data.reason,
    requested_idempotency_key: parsed.data.idempotencyKey,
  });
  if (error)
    fail(
      path,
      "The transition was rejected because the obligation changed or the expense transaction does not match.",
    );
  revalidatePath(path);
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}

export async function setMinimumReserve(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "settings");
  let input: ReturnType<typeof parseReserveInput>;
  try {
    input = parseReserveInput({
      amount: text(formData, "minimumReserve"),
      expectedVersion: text(formData, "expectedVersion"),
      reason: text(formData, "reason"),
      idempotencyKey: text(formData, "idempotencyKey"),
    });
  } catch {
    fail(
      path,
      "Use a nonnegative USD reserve and provide a meaningful reason.",
    );
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_minimum_cash_reserve", {
    requested_organization_id: context.id,
    requested_amount_minor: input.amountMinor,
    requested_expected_version: input.expectedVersion,
    requested_reason: input.reason,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error) fail(path, "The reserve changed or the new amount is unchanged.");
  revalidatePath(path);
  revalidatePath(organizationPath(context.id, "dashboard"));
  redirect(path);
}
