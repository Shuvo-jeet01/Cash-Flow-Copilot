import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialReader } from "@/lib/finance/access";

export default async function BudgetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId } = await params;
  const { message } = await searchParams;
  const context = await requireFinancialReader(organizationId);
  const { supabase } = await requireUser();
  const { data: budgets, error } = await supabase
    .from("organization_budgets")
    .select("id,status,version,created_at,updated_at")
    .eq("organization_id", context.id)
    .order("updated_at", { ascending: false });
  const budgetIds = (budgets ?? []).map((budget) => budget.id);
  const { data: revisions } = budgetIds.length
    ? await supabase
        .from("budget_revisions")
        .select("budget_id,name,start_on,end_on,revision_number,status")
        .eq("organization_id", context.id)
        .in("budget_id", budgetIds)
        .in("status", ["draft", "effective", "closed"])
    : { data: [] };
  const revisionByBudget = new Map(
    (revisions ?? []).map((revision) => [revision.budget_id, revision]),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="Financial plan"
        title="Budgets"
        description="Versioned income targets and expense limits. Published revisions remain immutable so later reporting can explain what changed."
        actions={
          context.role === "treasurer" ? (
            <Button asChild>
              <Link href={`/organizations/${context.id}/budgets/new`}>
                <Plus className="size-4" /> New draft
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Message message={message} />
      {error && <Message message="Budgets could not be loaded." />}
      <div className="space-y-3">
        {(budgets ?? []).map((budget) => {
          const revision = revisionByBudget.get(budget.id);
          return (
            <Card key={budget.id}>
              <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-slate-950">
                      {revision?.name ?? "Budget"}
                    </h2>
                    <StatusBadge status={budget.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-600">
                    {revision
                      ? `${revision.start_on} through ${revision.end_on} · revision ${revision.revision_number}`
                      : "Revision details unavailable"}
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link
                    href={`/organizations/${context.id}/budgets/${budget.id}`}
                  >
                    Review <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          );
        })}
        {!error && (budgets ?? []).length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No budgets yet. A treasurer can create the first draft without
              changing the ledger.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
