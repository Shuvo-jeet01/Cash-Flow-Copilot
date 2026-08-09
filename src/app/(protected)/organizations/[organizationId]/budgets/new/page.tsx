import { BudgetForm } from "@/components/finance/budget-form";
import {
  FinancialPageHeader,
  Message,
} from "@/components/finance/financial-ui";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { createBudget } from "../../phase5b-actions";

export default async function NewBudgetPage({
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
  const { data: categories } = await supabase
    .from("transaction_categories")
    .select("id,name,direction,status")
    .eq("organization_id", context.id)
    .eq("status", "active")
    .order("direction")
    .order("name");
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <FinancialPageHeader
        eyebrow="Budget workflow"
        title="Create a draft budget"
        description="This is editable until activation. Activation requires a separate confirmation and creates an immutable approved revision."
      />
      <Message message={message} />
      <Card>
        <CardContent className="pt-6">
          <BudgetForm
            action={createBudget.bind(null, context.id)}
            categories={categories ?? []}
            submitLabel="Create draft"
          />
        </CardContent>
      </Card>
    </div>
  );
}
