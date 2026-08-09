import { notFound } from "next/navigation";
import { BudgetForm } from "@/components/finance/budget-form";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  textareaClass,
} from "@/components/finance/financial-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialReader } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import { uuidSchema } from "@/lib/finance/validation";
import {
  activateBudget,
  closeBudget,
  reviseActiveBudget,
  updateDraftBudget,
} from "../../phase5b-actions";

export default async function BudgetDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string; budgetId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const route = await params;
  const { message } = await searchParams;
  const context = await requireFinancialReader(route.organizationId);
  const budgetId = uuidSchema.safeParse(route.budgetId);
  if (!budgetId.success) notFound();
  const { supabase } = await requireUser();
  const [{ data: budget }, { data: revisions }, { data: categories }] =
    await Promise.all([
      supabase
        .from("organization_budgets")
        .select("id,status,version,created_at,updated_at")
        .eq("organization_id", context.id)
        .eq("id", budgetId.data)
        .maybeSingle(),
      supabase
        .from("budget_revisions")
        .select("*")
        .eq("organization_id", context.id)
        .eq("budget_id", budgetId.data)
        .order("revision_number", { ascending: false }),
      supabase
        .from("transaction_categories")
        .select("id,name,direction,status")
        .eq("organization_id", context.id)
        .order("direction")
        .order("name"),
    ]);
  if (!budget) notFound();
  const current =
    (revisions ?? []).find((revision) =>
      ["draft", "effective"].includes(revision.status),
    ) ?? revisions?.[0];
  if (!current) notFound();
  const { data: allAllocations } = await supabase
    .from("budget_allocations")
    .select("revision_id,category_id,direction,amount_minor")
    .eq("organization_id", context.id)
    .order("direction");
  const allocations = (allAllocations ?? []).filter(
    (allocation) => allocation.revision_id === current.id,
  );
  const canEdit = context.role === "treasurer" && budget.status !== "closed";
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow={`Budget revision ${current.revision_number}`}
        title={current.name}
        description={`${current.start_on} through ${current.end_on}. Approved versions are preserved and never overwritten.`}
        actions={<StatusBadge status={budget.status} />}
      />
      <Message message={message} />

      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {budget.status === "draft"
                ? "Edit draft"
                : "Create approved revision"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BudgetForm
              action={
                budget.status === "draft"
                  ? updateDraftBudget.bind(null, context.id, budget.id)
                  : reviseActiveBudget.bind(null, context.id, budget.id)
              }
              categories={(categories ?? []).filter(
                (category) =>
                  category.status === "active" ||
                  allocations.some(
                    (allocation) => allocation.category_id === category.id,
                  ),
              )}
              allocations={allocations}
              defaults={{
                name: current.name,
                startOn: current.start_on,
                endOn: current.end_on,
              }}
              expectedVersion={budget.version}
              submitLabel={
                budget.status === "draft"
                  ? "Save draft"
                  : "Approve new revision"
              }
              confirmation={
                budget.status === "active"
                  ? {
                      title: "Approve a new budget revision?",
                      description:
                        "The current revision will remain in immutable history and this version will become effective.",
                      confirmLabel: "Approve revision",
                    }
                  : undefined
              }
            />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Current category plan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {allocations.map((allocation) => {
              const category = categories?.find(
                (item) => item.id === allocation.category_id,
              );
              return (
                <div
                  className="flex justify-between border-b py-2 text-sm"
                  key={allocation.category_id}
                >
                  <span>
                    {category?.name ?? "Archived category"} ·{" "}
                    {allocation.direction === "income" ? "target" : "limit"}
                  </span>
                  <span className="font-medium">
                    {formatMoney(allocation.amount_minor)}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {context.role === "treasurer" && budget.status === "draft" && (
        <Card>
          <CardHeader>
            <CardTitle>Activate this budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={activateBudget.bind(null, context.id, budget.id)}
              className="space-y-3"
            >
              <input
                name="expectedVersion"
                type="hidden"
                value={budget.version}
              />
              <input
                name="idempotencyKey"
                type="hidden"
                value={crypto.randomUUID()}
              />
              <textarea
                required
                className={textareaClass}
                name="reason"
                maxLength={500}
                placeholder="Why is this budget ready for approval?"
              />
              <ConfirmSubmit
                triggerLabel="Activate budget"
                title="Activate this budget?"
                description="The draft will become an approved, immutable revision and will drive budget reporting for its period."
                confirmLabel="Activate budget"
              />
            </form>
          </CardContent>
        </Card>
      )}

      {context.role === "treasurer" && budget.status !== "closed" && (
        <Card>
          <CardHeader>
            <CardTitle>Close budget</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={closeBudget.bind(null, context.id, budget.id)}
              className="space-y-3"
            >
              <input
                name="expectedVersion"
                type="hidden"
                value={budget.version}
              />
              <input
                name="idempotencyKey"
                type="hidden"
                value={crypto.randomUUID()}
              />
              <textarea
                required
                className={textareaClass}
                name="reason"
                maxLength={500}
                placeholder="Explain why this budget is being closed."
              />
              <ConfirmSubmit
                triggerLabel="Close budget"
                title="Close this budget?"
                description="Closed budgets cannot be edited or reactivated. Their revisions remain available in history."
                confirmLabel="Close budget"
                destructive
              />
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Immutable revision history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(revisions ?? []).map((revision) => (
            <details className="rounded-lg border p-4" key={revision.id}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4">
                <div>
                  <p className="font-medium">
                    Revision {revision.revision_number}: {revision.name}
                  </p>
                  <p className="text-sm text-slate-600">
                    {revision.start_on} through {revision.end_on}
                  </p>
                </div>
                <StatusBadge status={revision.status} />
              </summary>
              <div className="mt-4 space-y-2 border-t pt-3">
                {(allAllocations ?? [])
                  .filter(
                    (allocation) => allocation.revision_id === revision.id,
                  )
                  .map((allocation) => {
                    const category = categories?.find(
                      (item) => item.id === allocation.category_id,
                    );
                    return (
                      <div
                        className="flex justify-between gap-4 text-sm"
                        key={`${revision.id}-${allocation.category_id}`}
                      >
                        <span>
                          {category?.name ?? "Archived category"} ·{" "}
                          {allocation.direction === "income"
                            ? "target"
                            : "limit"}
                        </span>
                        <span>{formatMoney(allocation.amount_minor)}</span>
                      </div>
                    );
                  })}
                {(allAllocations ?? []).every(
                  (allocation) => allocation.revision_id !== revision.id,
                ) && (
                  <p className="text-sm text-slate-500">
                    No category allocations.
                  </p>
                )}
              </div>
            </details>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
