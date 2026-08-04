import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { correctFinancialTransaction } from "../../../financial-actions";
import {
  FinancialPageHeader,
  Message,
} from "@/components/finance/financial-ui";
import { TransactionForm } from "@/components/finance/transaction-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";
import { UUID_PATTERN } from "@/lib/organizations/require-organization-access";

function decimalFromMinor(value: number) {
  return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, "0")}`;
}

export default async function CorrectTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; transactionId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId, transactionId } = await params;
  const { message } = await searchParams;
  if (!UUID_PATTERN.test(transactionId)) notFound();
  const context = await requireFinancialTreasurer(organizationId);
  const { supabase } = await requireUser();
  const [{ data: transaction }, { data: accounts }, { data: categories }] =
    await Promise.all([
      supabase
        .from("financial_transactions")
        .select("*")
        .eq("organization_id", context.id)
        .eq("id", transactionId)
        .eq("status", "posted")
        .maybeSingle(),
      supabase
        .from("financial_accounts")
        .select("id,name")
        .eq("organization_id", context.id)
        .eq("status", "active")
        .order("name"),
      supabase
        .from("transaction_categories")
        .select("id,name,direction")
        .eq("organization_id", context.id)
        .eq("status", "active")
        .order("name"),
    ]);
  if (!transaction) notFound();
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <FinancialPageHeader
        eyebrow="Auditable correction"
        title="Void and replace transaction"
        description="The original transaction will remain in history as voided. The corrected values create a linked posted replacement in the same atomic operation."
        actions={
          <Button asChild variant="outline">
            <Link
              href={`/organizations/${context.id}/transactions/${transaction.id}`}
            >
              Cancel
            </Link>
          </Button>
        }
      />
      <Message message={message} />
      <Card>
        <CardContent className="pt-6">
          <TransactionForm
            action={correctFinancialTransaction.bind(
              null,
              context.id,
              transaction.id,
            )}
            accounts={accounts ?? []}
            categories={categories ?? []}
            idempotencyKey={randomUUID()}
            defaults={{
              accountId: transaction.account_id,
              categoryId: transaction.category_id,
              direction: transaction.direction,
              amount: decimalFromMinor(transaction.amount_minor),
              transactionDate: transaction.transaction_date,
              description: transaction.description,
              reference: transaction.reference ?? "",
              note: transaction.note ?? "",
            }}
            submitLabel="Void original and create replacement"
            reasonRequired
          />
        </CardContent>
      </Card>
    </div>
  );
}
