import { notFound } from "next/navigation";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { ObligationForm } from "@/components/finance/obligation-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialReader } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import { uuidSchema } from "@/lib/finance/validation";
import type { ObligationStatus } from "@/types/database";
import { transitionObligation, updateObligation } from "../../phase5b-actions";

function TransitionForm({
  action,
  version,
  status,
  transactions = [],
}: {
  action: (formData: FormData) => void | Promise<void>;
  version: number;
  status: ObligationStatus;
  transactions?: {
    id: string;
    description: string;
    transaction_date: string;
    amount_minor: number;
  }[];
}) {
  return (
    <form action={action} className="space-y-3">
      <input name="expectedVersion" type="hidden" value={version} />
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {status === "paid" && (
        <label className={labelClass}>
          Matching posted expense transaction
          <select
            required
            className={inputClass}
            name="transactionId"
            defaultValue=""
          >
            <option value="" disabled>
              Select a transaction
            </option>
            {transactions.map((transaction) => (
              <option key={transaction.id} value={transaction.id}>
                {transaction.transaction_date} · {transaction.description} ·{" "}
                {formatMoney(transaction.amount_minor)}
              </option>
            ))}
          </select>
        </label>
      )}
      <textarea
        required
        className={textareaClass}
        name="reason"
        maxLength={500}
        placeholder={`Explain why this obligation is being marked ${status}.`}
      />
      <ConfirmSubmit
        triggerLabel={`Mark ${status}`}
        title={`Mark this obligation ${status}?`}
        description={
          status === "paid"
            ? "The matching posted expense will be linked, and the obligation will no longer reduce projected cash."
            : "This status change is terminal or affects projected cash and will be preserved in immutable history."
        }
        confirmLabel={`Mark ${status}`}
        destructive={status === "voided"}
      />
    </form>
  );
}

export default async function ObligationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; obligationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const route = await params;
  const { message } = await searchParams;
  const context = await requireFinancialReader(route.organizationId);
  const obligationId = uuidSchema.safeParse(route.obligationId);
  if (!obligationId.success) notFound();
  const { supabase } = await requireUser();
  const [
    { data: obligation },
    { data: categories },
    { data: accounts },
    { data: history },
  ] = await Promise.all([
    supabase
      .from("financial_obligations")
      .select("*")
      .eq("organization_id", context.id)
      .eq("id", obligationId.data)
      .maybeSingle(),
    supabase
      .from("transaction_categories")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .eq("direction", "expense")
      .order("name"),
    supabase
      .from("financial_accounts")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .order("name"),
    supabase
      .from("obligation_status_history")
      .select("*")
      .eq("organization_id", context.id)
      .eq("obligation_id", obligationId.data)
      .order("changed_at", { ascending: false }),
  ]);
  if (!obligation) notFound();
  const { data: transactions } =
    obligation.status === "committed"
      ? await supabase
          .from("financial_transactions")
          .select("id,description,transaction_date,amount_minor")
          .eq("organization_id", context.id)
          .eq("status", "posted")
          .eq("direction", "expense")
          .eq("category_id", obligation.category_id)
          .eq("amount_minor", obligation.amount_minor)
          .order("transaction_date", { ascending: false })
      : { data: [] };
  const editable =
    context.role === "treasurer" &&
    (obligation.status === "expected" || obligation.status === "committed");
  const categoryName = categories?.find(
    (item) => item.id === obligation.category_id,
  )?.name;
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="Obligation record"
        title={obligation.description}
        description={`${categoryName ?? "Expense category"} · due ${obligation.due_on} · ${formatMoney(obligation.amount_minor)}`}
        actions={<StatusBadge status={obligation.status} />}
      />
      <Message message={message} />
      {editable && (
        <Card>
          <CardHeader>
            <CardTitle>Edit details</CardTitle>
          </CardHeader>
          <CardContent>
            <ObligationForm
              action={updateObligation.bind(null, context.id, obligation.id)}
              categories={categories ?? []}
              accounts={accounts ?? []}
              expectedVersion={obligation.version}
              requireReason
              submitLabel="Save changes"
              defaults={{
                description: obligation.description,
                amountMinor: obligation.amount_minor,
                dueOn: obligation.due_on,
                categoryId: obligation.category_id,
                accountId: obligation.intended_account_id,
                reference: obligation.reference,
                note: obligation.note,
                status: obligation.status as "expected" | "committed",
              }}
            />
          </CardContent>
        </Card>
      )}
      {context.role === "treasurer" && obligation.status === "expected" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Commit</CardTitle>
            </CardHeader>
            <CardContent>
              <TransitionForm
                action={transitionObligation.bind(
                  null,
                  context.id,
                  obligation.id,
                  "committed",
                )}
                version={obligation.version}
                status="committed"
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Void</CardTitle>
            </CardHeader>
            <CardContent>
              <TransitionForm
                action={transitionObligation.bind(
                  null,
                  context.id,
                  obligation.id,
                  "voided",
                )}
                version={obligation.version}
                status="voided"
              />
            </CardContent>
          </Card>
        </div>
      )}
      {context.role === "treasurer" && obligation.status === "committed" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Link payment</CardTitle>
            </CardHeader>
            <CardContent>
              <TransitionForm
                action={transitionObligation.bind(
                  null,
                  context.id,
                  obligation.id,
                  "paid",
                )}
                version={obligation.version}
                status="paid"
                transactions={transactions ?? []}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Void</CardTitle>
            </CardHeader>
            <CardContent>
              <TransitionForm
                action={transitionObligation.bind(
                  null,
                  context.id,
                  obligation.id,
                  "voided",
                )}
                version={obligation.version}
                status="voided"
              />
            </CardContent>
          </Card>
        </div>
      )}
      <Card>
        <CardHeader>
          <CardTitle>Immutable status history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(history ?? []).map((entry) => (
            <div className="rounded-lg border p-4 text-sm" key={entry.id}>
              <div className="flex items-center justify-between">
                <span>
                  {entry.from_status ?? "Created"} → {entry.to_status}
                </span>
                <span className="text-slate-500">
                  {new Date(entry.changed_at).toLocaleString()}
                </span>
              </div>
              <p className="mt-2 text-slate-600">{entry.reason}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
