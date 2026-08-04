import { randomUUID } from "node:crypto";
import Link from "next/link";
import { createManualTransaction } from "../../financial-actions";
import {
  FinancialPageHeader,
  Message,
} from "@/components/finance/financial-ui";
import { TransactionForm } from "@/components/finance/transaction-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId } = await params;
  const { message } = await searchParams;
  const context = await requireFinancialTreasurer(organizationId);
  const { supabase } = await requireUser();
  const [{ data: accounts }, { data: categories }] = await Promise.all([
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
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <FinancialPageHeader
        eyebrow="Manual entry"
        title="Post a transaction"
        description="Posted transactions cannot be rewritten or deleted. Corrections use an auditable void-and-replacement workflow."
        actions={
          <Button asChild variant="outline">
            <Link href={`/organizations/${context.id}/transactions`}>
              Back to transactions
            </Link>
          </Button>
        }
      />
      <Message message={message} />
      {(!accounts?.length || !categories?.length) && (
        <Message message="Create at least one active account and matching category before posting a transaction." />
      )}
      <Card>
        <CardContent className="pt-6">
          <TransactionForm
            action={createManualTransaction.bind(null, context.id)}
            accounts={accounts ?? []}
            categories={categories ?? []}
            idempotencyKey={randomUUID()}
          />
        </CardContent>
      </Card>
    </div>
  );
}
