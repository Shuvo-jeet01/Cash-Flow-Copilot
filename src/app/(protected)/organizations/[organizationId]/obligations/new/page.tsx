import {
  FinancialPageHeader,
  Message,
} from "@/components/finance/financial-ui";
import { ObligationForm } from "@/components/finance/obligation-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { createObligation } from "../../phase5b-actions";

export default async function NewObligationPage({
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
  const [{ data: categories }, { data: accounts }] = await Promise.all([
    supabase
      .from("transaction_categories")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .eq("direction", "expense")
      .eq("status", "active")
      .order("name"),
    supabase
      .from("financial_accounts")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .eq("status", "active")
      .order("name"),
  ]);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <FinancialPageHeader
        eyebrow="Obligation workflow"
        title="Record an obligation"
        description="Expected items are tracked separately. Mark an item committed only when the organization has made a real commitment."
      />
      <Message message={message} />
      <Card>
        <CardContent className="pt-6">
          <ObligationForm
            action={createObligation.bind(null, context.id)}
            categories={categories ?? []}
            accounts={accounts ?? []}
            submitLabel="Record obligation"
          />
        </CardContent>
      </Card>
    </div>
  );
}
