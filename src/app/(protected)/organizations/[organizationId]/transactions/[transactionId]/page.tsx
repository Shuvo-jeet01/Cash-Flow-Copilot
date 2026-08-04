import Link from "next/link";
import { notFound } from "next/navigation";
import { voidFinancialTransaction } from "../../financial-actions";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  textareaClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/money";
import { requireFinancialReader } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";
import { UUID_PATTERN } from "@/lib/organizations/require-organization-access";

export default async function TransactionDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; transactionId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId, transactionId } = await params;
  const { message } = await searchParams;
  if (!UUID_PATTERN.test(transactionId)) notFound();
  const context = await requireFinancialReader(organizationId);
  const { supabase } = await requireUser();
  const { data: transaction } = await supabase
    .from("financial_transactions")
    .select("*")
    .eq("organization_id", context.id)
    .eq("id", transactionId)
    .maybeSingle();
  if (!transaction) notFound();
  const [
    { data: account },
    { data: category },
    { data: replacement },
    { data: audit },
  ] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("name,status")
      .eq("organization_id", context.id)
      .eq("id", transaction.account_id)
      .maybeSingle(),
    supabase
      .from("transaction_categories")
      .select("name,status")
      .eq("organization_id", context.id)
      .eq("id", transaction.category_id)
      .maybeSingle(),
    supabase
      .from("financial_transactions")
      .select("id")
      .eq("organization_id", context.id)
      .eq("replaces_transaction_id", transaction.id)
      .maybeSingle(),
    supabase
      .from("audit_events")
      .select("id,action,metadata,occurred_at,actor_user_id,request_id")
      .eq("organization_id", context.id)
      .eq("target_type", "financial_transaction")
      .eq("target_id", transaction.id)
      .order("occurred_at", { ascending: false }),
  ]);
  const writable =
    context.role === "treasurer" && transaction.status === "posted";
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <FinancialPageHeader
        eyebrow="Transaction record"
        title={transaction.description}
        description="This is a historical financial record. Posted fields are not directly editable."
        actions={
          <Button asChild variant="outline">
            <Link href={`/organizations/${context.id}/transactions`}>
              Back to transactions
            </Link>
          </Button>
        }
      />
      <Message message={message} />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Transaction details</CardTitle>
              <StatusBadge status={transaction.status} />
            </div>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-5 sm:grid-cols-2">
              <div>
                <dt className="text-xs uppercase text-slate-500">Amount</dt>
                <dd className="mt-1 text-xl font-bold">
                  {transaction.direction === "expense" ? "−" : "+"}
                  {formatMoney(transaction.amount_minor)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Date</dt>
                <dd className="mt-1">{transaction.transaction_date}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Account</dt>
                <dd className="mt-1">
                  {account?.name ?? "Archived account"}{" "}
                  {account?.status === "archived" ? "(archived)" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Category</dt>
                <dd className="mt-1">
                  {category?.name ?? "Archived category"}{" "}
                  {category?.status === "archived" ? "(archived)" : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Source</dt>
                <dd className="mt-1 capitalize">
                  {transaction.source.replaceAll("_", " ")}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-slate-500">Reference</dt>
                <dd className="mt-1">{transaction.reference || "None"}</dd>
              </div>
              {transaction.note && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-slate-500">Note</dt>
                  <dd className="mt-1 whitespace-pre-wrap">
                    {transaction.note}
                  </dd>
                </div>
              )}
              {transaction.void_reason && (
                <div className="sm:col-span-2">
                  <dt className="text-xs uppercase text-slate-500">
                    Void reason
                  </dt>
                  <dd className="mt-1 text-rose-800">
                    {transaction.void_reason}
                  </dd>
                </div>
              )}
            </dl>
            {transaction.replaces_transaction_id && (
              <p className="mt-6 text-sm">
                <Link
                  className="font-medium text-emerald-700"
                  href={`/organizations/${context.id}/transactions/${transaction.replaces_transaction_id}`}
                >
                  View original transaction
                </Link>
              </p>
            )}
            {replacement && (
              <p className="mt-2 text-sm">
                <Link
                  className="font-medium text-emerald-700"
                  href={`/organizations/${context.id}/transactions/${replacement.id}`}
                >
                  View replacement transaction
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {writable ? (
              <>
                <Button asChild className="w-full">
                  <Link
                    href={`/organizations/${context.id}/transactions/${transaction.id}/correct`}
                  >
                    Correct with replacement
                  </Link>
                </Button>
                <details className="rounded-lg border p-3">
                  <summary className="cursor-pointer text-sm font-medium text-rose-800">
                    Void transaction
                  </summary>
                  <form
                    action={voidFinancialTransaction.bind(
                      null,
                      context.id,
                      transaction.id,
                    )}
                    className="mt-3 space-y-3"
                  >
                    <label className={labelClass}>
                      Void reason
                      <textarea
                        className={textareaClass}
                        name="reason"
                        required
                        minLength={5}
                        maxLength={500}
                      />
                    </label>
                    <ConfirmSubmit
                      triggerLabel="Review void"
                      title="Void this posted transaction?"
                      description="The original record will remain in history and cannot be posted again. The reason above will be recorded in the audit trail."
                      confirmLabel="Void transaction"
                      destructive
                    />
                  </form>
                </details>
              </>
            ) : (
              <p className="text-sm text-slate-600">
                {context.role === "treasurer"
                  ? "This transaction is immutable because it is already voided."
                  : "Your role has read-only financial access."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Audit history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {context.role === "executive" ? (
            <p className="text-sm text-slate-600">
              Detailed audit history is restricted to treasurers and presidents.
            </p>
          ) : (audit ?? []).length === 0 ? (
            <p className="text-sm text-slate-600">No visible audit events.</p>
          ) : (
            audit?.map((event) => (
              <div
                className="border-l-2 border-emerald-200 pl-4"
                key={event.id}
              >
                <p className="font-medium">
                  {event.action.replaceAll("_", " ")}
                </p>
                <p className="text-xs text-slate-500">
                  {new Date(event.occurred_at).toLocaleString()} · request{" "}
                  {event.request_id.slice(0, 8)}
                </p>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
