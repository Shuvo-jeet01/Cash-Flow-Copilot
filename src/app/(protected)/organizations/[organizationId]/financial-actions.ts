"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { parseMoneyToMinor } from "@/lib/finance/money";
import {
  accountSchema,
  categorySchema,
  parseTransactionInput,
  reasonSchema,
  uuidSchema,
} from "@/lib/finance/validation";
import {
  MAX_CSV_BYTES,
  fileSha256,
  parseTransactionCsv,
} from "@/lib/imports/transaction-csv";
import { requireUser } from "@/lib/auth/current-user";
import type { FinancialRecordStatus } from "@/types/database";

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

export async function configureFinancialContext(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const timezone = text(formData, "timezone").trim();
  if (timezone.length < 3 || timezone.length > 100)
    fail(organizationPath(context.id, "settings"), "Choose a valid timezone.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("configure_financial_context", {
    requested_organization_id: context.id,
    requested_timezone: timezone,
  });
  if (error)
    fail(
      organizationPath(context.id, "settings"),
      "Unable to save financial settings.",
    );
  revalidatePath(organizationPath(context.id, "settings"));
  redirect(organizationPath(context.id, "settings"));
}

export async function createFinancialAccount(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "accounts");
  const parsed = accountSchema.safeParse({
    name: text(formData, "name"),
    accountType: text(formData, "accountType"),
    currencyCode: text(formData, "currencyCode"),
    openingBalance: text(formData, "openingBalance"),
    openingEffectiveOn: text(formData, "openingEffectiveOn"),
  });
  if (!parsed.success) fail(path, "Check the account fields and try again.");
  const hasOpening = Boolean(parsed.data.openingBalance);
  if (hasOpening !== Boolean(parsed.data.openingEffectiveOn))
    fail(path, "Opening balance and effective date must be supplied together.");
  let openingMinor: number | null = null;
  if (hasOpening) {
    try {
      openingMinor = parseMoneyToMinor(parsed.data.openingBalance!, true);
    } catch (error) {
      fail(
        path,
        error instanceof Error ? error.message : "Invalid opening balance.",
      );
    }
  }
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_financial_account", {
    requested_organization_id: context.id,
    requested_name: parsed.data.name,
    requested_account_type: parsed.data.accountType,
    requested_currency_code: "USD",
    requested_opening_amount_minor: openingMinor,
    requested_opening_effective_on: parsed.data.openingEffectiveOn || null,
  });
  if (error)
    fail(path, "Unable to create the account. Check for a duplicate name.");
  revalidatePath(path);
  redirect(path);
}

export async function setFinancialAccountStatus(
  untrustedOrganizationId: string,
  untrustedAccountId: string,
  requestedStatus: FinancialRecordStatus,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const accountId = uuidSchema.parse(untrustedAccountId);
  const status = z.enum(["active", "archived"]).parse(requestedStatus);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_financial_account_status", {
    requested_organization_id: context.id,
    requested_account_id: accountId,
    requested_status: status,
  });
  if (error) throw new Error("Unable to change the account status.");
  revalidatePath(organizationPath(context.id, "accounts"));
}

export async function replaceOpeningBalance(
  untrustedOrganizationId: string,
  untrustedAccountId: string,
  untrustedCurrentEntryId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "accounts");
  let amountMinor: number;
  try {
    amountMinor = parseMoneyToMinor(text(formData, "amount"), true);
  } catch (error) {
    fail(path, error instanceof Error ? error.message : "Invalid amount.");
  }
  const effectiveOn = z.iso.date().safeParse(text(formData, "effectiveOn"));
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!effectiveOn.success || !reason.success)
    fail(path, "Provide a date and a meaningful correction reason.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("replace_account_opening_balance", {
    requested_organization_id: context.id,
    requested_account_id: uuidSchema.parse(untrustedAccountId),
    requested_current_entry_id: uuidSchema.parse(untrustedCurrentEntryId),
    requested_amount_minor: amountMinor,
    requested_effective_on: effectiveOn.data,
    requested_reason: reason.data,
  });
  if (error) fail(path, "The opening balance changed. Refresh and try again.");
  revalidatePath(path);
  redirect(path);
}

export async function createTransactionCategory(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "categories");
  const parsed = categorySchema.safeParse({
    name: text(formData, "name"),
    direction: text(formData, "direction"),
  });
  if (!parsed.success) fail(path, "Check the category fields and try again.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("create_transaction_category", {
    requested_organization_id: context.id,
    requested_name: parsed.data.name,
    requested_direction: parsed.data.direction,
  });
  if (error)
    fail(path, "Unable to create the category. Check for a duplicate name.");
  revalidatePath(path);
  redirect(path);
}

export async function setTransactionCategoryStatus(
  untrustedOrganizationId: string,
  untrustedCategoryId: string,
  requestedStatus: FinancialRecordStatus,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("set_transaction_category_status", {
    requested_organization_id: context.id,
    requested_category_id: uuidSchema.parse(untrustedCategoryId),
    requested_status: z.enum(["active", "archived"]).parse(requestedStatus),
  });
  if (error) throw new Error("Unable to change the category status.");
  revalidatePath(organizationPath(context.id, "categories"));
}

function transactionFormData(formData: FormData) {
  return parseTransactionInput({
    accountId: text(formData, "accountId"),
    categoryId: text(formData, "categoryId"),
    direction: text(formData, "direction"),
    amount: text(formData, "amount"),
    transactionDate: text(formData, "transactionDate"),
    description: text(formData, "description"),
    reference: text(formData, "reference"),
    note: text(formData, "note"),
    idempotencyKey: text(formData, "idempotencyKey"),
  });
}

export async function createManualTransaction(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "transactions/new");
  let input: ReturnType<typeof transactionFormData>;
  try {
    input = transactionFormData(formData);
  } catch {
    fail(path, "Check every transaction field and use a positive USD amount.");
  }
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_manual_transaction", {
    requested_organization_id: context.id,
    requested_account_id: input.accountId,
    requested_category_id: input.categoryId,
    requested_direction: input.direction,
    requested_amount_minor: input.amountMinor,
    requested_transaction_date: input.transactionDate,
    requested_description: input.description,
    requested_reference: input.reference || null,
    requested_note: input.note || null,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error || !data)
    fail(
      path,
      "Unable to post the transaction. Check the date, account, and category.",
    );
  revalidatePath(organizationPath(context.id, "transactions"));
  redirect(organizationPath(context.id, `transactions/${data}`));
}

export async function voidFinancialTransaction(
  untrustedOrganizationId: string,
  untrustedTransactionId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const transactionId = uuidSchema.parse(untrustedTransactionId);
  const path = organizationPath(context.id, `transactions/${transactionId}`);
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!reason.success) fail(path, "Provide a meaningful void reason.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("void_financial_transaction", {
    requested_organization_id: context.id,
    requested_transaction_id: transactionId,
    requested_reason: reason.data,
  });
  if (error)
    fail(path, "The transaction was already changed or cannot be voided.");
  revalidatePath(path);
  redirect(path);
}

export async function correctFinancialTransaction(
  untrustedOrganizationId: string,
  untrustedTransactionId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const originalId = uuidSchema.parse(untrustedTransactionId);
  const path = organizationPath(
    context.id,
    `transactions/${originalId}/correct`,
  );
  let input: ReturnType<typeof transactionFormData>;
  try {
    input = transactionFormData(formData);
  } catch {
    fail(path, "Check every replacement transaction field.");
  }
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!reason.success) fail(path, "Provide a meaningful correction reason.");
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("correct_financial_transaction", {
    requested_organization_id: context.id,
    requested_original_transaction_id: originalId,
    requested_account_id: input.accountId,
    requested_category_id: input.categoryId,
    requested_direction: input.direction,
    requested_amount_minor: input.amountMinor,
    requested_transaction_date: input.transactionDate,
    requested_description: input.description,
    requested_reference: input.reference || null,
    requested_note: input.note || null,
    requested_reason: reason.data,
    requested_idempotency_key: input.idempotencyKey,
  });
  if (error || !data)
    fail(path, "The transaction changed or the replacement is invalid.");
  revalidatePath(organizationPath(context.id, "transactions"));
  redirect(organizationPath(context.id, `transactions/${data}`));
}

export async function createTransactionImportPreview(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const path = organizationPath(context.id, "imports/new");
  const upload = formData.get("file");
  if (!(upload instanceof File) || !upload.name.toLowerCase().endsWith(".csv"))
    fail(path, "Choose a .csv file using the Phase 5A template.");
  if (upload.size === 0 || upload.size > MAX_CSV_BYTES)
    fail(path, "CSV files must be non-empty and 1 MB or smaller.");
  const allowedTypes = new Set([
    "text/csv",
    "application/csv",
    "application/vnd.ms-excel",
    "text/plain",
  ]);
  if (upload.type && !allowedTypes.has(upload.type.toLowerCase()))
    fail(path, "The selected file does not appear to be a CSV file.");
  const { supabase } = await requireUser();
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("id,name")
      .eq("organization_id", context.id)
      .eq("status", "active"),
    supabase
      .from("transaction_categories")
      .select("id,name,direction")
      .eq("organization_id", context.id)
      .eq("status", "active"),
  ]);
  const bytes = new Uint8Array(await upload.arrayBuffer());
  let rows;
  try {
    rows = parseTransactionCsv(bytes, accounts ?? [], categories ?? []);
  } catch (error) {
    fail(
      path,
      error instanceof Error ? error.message : "Unable to parse the CSV file.",
    );
  }
  const { data, error } = await supabase.rpc(
    "create_transaction_import_preview",
    {
      requested_organization_id: context.id,
      requested_file_name: upload.name,
      requested_file_sha256: fileSha256(bytes),
      requested_rows: rows,
    },
  );
  if (error || !data)
    fail(
      path,
      "Unable to create the import preview. The file may already be imported.",
    );
  redirect(organizationPath(context.id, `imports/${data}`));
}

export async function resolveImportDuplicate(
  untrustedOrganizationId: string,
  untrustedBatchId: string,
  untrustedRowId: string,
  formData: FormData,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const batchId = uuidSchema.parse(untrustedBatchId);
  const path = organizationPath(context.id, `imports/${batchId}`);
  const resolution = z
    .enum(["accept_distinct", "skip_duplicate"])
    .safeParse(text(formData, "resolution"));
  const reason = reasonSchema.safeParse(text(formData, "reason"));
  if (!resolution.success || !reason.success)
    fail(path, "Choose a resolution and provide a meaningful reason.");
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("resolve_transaction_import_duplicate", {
    requested_organization_id: context.id,
    requested_batch_id: batchId,
    requested_row_id: uuidSchema.parse(untrustedRowId),
    requested_resolution: resolution.data,
    requested_reason: reason.data,
  });
  if (error)
    fail(path, "The duplicate row was already changed. Refresh and try again.");
  revalidatePath(path);
  redirect(path);
}

export async function commitTransactionImport(
  untrustedOrganizationId: string,
  untrustedBatchId: string,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const batchId = uuidSchema.parse(untrustedBatchId);
  const path = organizationPath(context.id, `imports/${batchId}`);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("commit_transaction_import", {
    requested_organization_id: context.id,
    requested_batch_id: batchId,
  });
  if (error)
    fail(
      path,
      "Import was not committed. Refresh the preview and resolve every blocking row.",
    );
  revalidatePath(organizationPath(context.id, "transactions"));
  revalidatePath(organizationPath(context.id, "imports"));
  redirect(organizationPath(context.id, "transactions"));
}

export async function cancelTransactionImport(
  untrustedOrganizationId: string,
  untrustedBatchId: string,
) {
  const context = await requireFinancialTreasurer(untrustedOrganizationId);
  const batchId = uuidSchema.parse(untrustedBatchId);
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc("cancel_transaction_import", {
    requested_organization_id: context.id,
    requested_batch_id: batchId,
  });
  if (error) throw new Error("Unable to cancel the import.");
  revalidatePath(organizationPath(context.id, "imports"));
  redirect(organizationPath(context.id, "imports"));
}
