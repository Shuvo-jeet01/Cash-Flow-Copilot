import Link from "next/link";
import { notFound } from "next/navigation";
import {
  cancelTransactionImport,
  commitTransactionImport,
  resolveImportDuplicate,
} from "../../financial-actions";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  inputClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import { requireUser } from "@/lib/auth/current-user";
import { UUID_PATTERN } from "@/lib/organizations/require-organization-access";

export default async function ImportPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; batchId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId, batchId } = await params;
  const { message } = await searchParams;
  if (!UUID_PATTERN.test(batchId)) notFound();
  const context = await requireFinancialTreasurer(organizationId);
  const { supabase } = await requireUser();
  const [
    { data: batch },
    { data: rows },
    { data: accounts },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("transaction_import_batches")
      .select("*")
      .eq("organization_id", context.id)
      .eq("id", batchId)
      .maybeSingle(),
    supabase
      .from("transaction_import_rows")
      .select("*")
      .eq("organization_id", context.id)
      .eq("batch_id", batchId)
      .order("row_number"),
    supabase
      .from("financial_accounts")
      .select("id,name")
      .eq("organization_id", context.id),
    supabase
      .from("transaction_categories")
      .select("id,name")
      .eq("organization_id", context.id),
  ]);
  if (!batch) notFound();
  const accountNames = new Map(
    (accounts ?? []).map((item) => [item.id, item.name]),
  );
  const categoryNames = new Map(
    (categories ?? []).map((item) => [item.id, item.name]),
  );
  const mutable = batch.status === "review" || batch.status === "ready";
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <FinancialPageHeader
        eyebrow="Import preview"
        title={batch.file_name}
        description="Nothing is written to transaction history until every blocking row is resolved and the batch is confirmed."
        actions={
          <Button asChild variant="outline">
            <Link href={`/organizations/${context.id}/imports`}>
              Back to imports
            </Link>
          </Button>
        }
      />
      <Message message={message} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-slate-500">Status</p>
            <div className="mt-2">
              <StatusBadge status={batch.status} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-slate-500">Rows</p>
            <p className="mt-2 text-2xl font-bold">{batch.row_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-slate-500">Blocking</p>
            <p className="mt-2 text-2xl font-bold">
              {batch.invalid_count + batch.duplicate_count}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-slate-500">Income</p>
            <p className="mt-2 text-xl font-bold">
              {formatMoney(batch.income_total_minor)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs uppercase text-slate-500">Expense</p>
            <p className="mt-2 text-xl font-bold">
              {formatMoney(batch.expense_total_minor)}
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Description</th>
                <th className="px-4 py-3">Account</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows?.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.status === "invalid"
                      ? "bg-rose-50"
                      : row.status === "possible_duplicate"
                        ? "bg-amber-50"
                        : ""
                  }
                >
                  <td className="px-4 py-4">{row.row_number}</td>
                  <td className="px-4 py-4">
                    {row.transaction_date ?? "Invalid"}
                  </td>
                  <td className="px-4 py-4">{row.description || "Missing"}</td>
                  <td className="px-4 py-4">
                    {row.account_id
                      ? (accountNames.get(row.account_id) ?? "Unknown")
                      : "Unknown"}
                  </td>
                  <td className="px-4 py-4">
                    {row.category_id
                      ? (categoryNames.get(row.category_id) ?? "Unknown")
                      : "Unknown"}
                  </td>
                  <td className="px-4 py-4">
                    {row.amount_minor
                      ? formatMoney(row.amount_minor)
                      : "Invalid"}
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge status={row.status} />
                    {Array.isArray(row.validation_errors) &&
                      row.validation_errors.length > 0 && (
                        <ul className="mt-2 list-disc pl-4 text-xs text-rose-800">
                          {row.validation_errors.map((error, index) => (
                            <li key={index}>{String(error)}</li>
                          ))}
                        </ul>
                      )}
                    {row.status === "possible_duplicate" && (
                      <form
                        action={resolveImportDuplicate.bind(
                          null,
                          context.id,
                          batch.id,
                          row.id,
                        )}
                        className="mt-3 space-y-2"
                      >
                        <label className={labelClass}>
                          Decision
                          <select className={inputClass} name="resolution">
                            <option value="skip_duplicate">
                              Skip duplicate
                            </option>
                            <option value="accept_distinct">
                              Accept as distinct
                            </option>
                          </select>
                        </label>
                        <label className={labelClass}>
                          Reason
                          <input
                            className={inputClass}
                            name="reason"
                            required
                            minLength={5}
                            maxLength={500}
                          />
                        </label>
                        <Button size="sm" type="submit">
                          Save decision
                        </Button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
      {mutable && (
        <div className="flex flex-wrap justify-end gap-3">
          <form
            action={cancelTransactionImport.bind(null, context.id, batch.id)}
          >
            <ConfirmSubmit
              triggerLabel="Cancel batch"
              title="Cancel this import batch?"
              description="The preview and its audit history will remain, but this batch cannot be committed."
              confirmLabel="Cancel batch"
              destructive
            />
          </form>
          <form
            action={commitTransactionImport.bind(null, context.id, batch.id)}
          >
            <ConfirmSubmit
              triggerLabel="Commit all accepted rows"
              title="Commit this import?"
              description="All accepted rows will be posted together. Posted transactions can later be voided or corrected, but never directly edited or deleted."
              confirmLabel="Commit transactions"
              disabled={batch.status !== "ready"}
            />
          </form>
        </div>
      )}
    </div>
  );
}
