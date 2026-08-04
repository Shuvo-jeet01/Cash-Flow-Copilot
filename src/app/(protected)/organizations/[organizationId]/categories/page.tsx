import { RotateCcw } from "lucide-react";
import {
  createTransactionCategory,
  setTransactionCategoryStatus,
} from "../financial-actions";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  inputClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFinancialReader } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";

export default async function CategoriesPage({
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
  const { data: categories } = await supabase
    .from("transaction_categories")
    .select("*")
    .eq("organization_id", context.id)
    .order("direction")
    .order("name");
  const writable = context.role === "treasurer";
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="Ledger setup"
        title="Transaction categories"
        description="Income and expense categories are organization-specific. Archived categories remain attached to history."
      />
      <Message message={message} />
      {writable && (
        <Card>
          <CardHeader>
            <CardTitle>Create a category</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={createTransactionCategory.bind(null, context.id)}
              className="grid gap-4 md:grid-cols-[1fr_220px_auto]"
            >
              <label className={labelClass}>
                Category name
                <input
                  className={inputClass}
                  name="name"
                  required
                  maxLength={100}
                />
              </label>
              <label className={labelClass}>
                Type
                <select className={inputClass} name="direction">
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </label>
              <div className="flex items-end">
                <Button type="submit">Create category</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        {(categories ?? []).length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No categories yet.
            </CardContent>
          </Card>
        )}
        {(categories ?? []).map((category) => {
          const nextStatus =
            category.status === "active" ? "archived" : "active";
          return (
            <Card key={category.id}>
              <CardContent className="flex items-center justify-between gap-4 py-6">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{category.name}</h2>
                    <StatusBadge status={category.status} />
                  </div>
                  <p className="mt-1 text-sm capitalize text-slate-600">
                    {category.direction}
                  </p>
                </div>
                {writable && (
                  <form
                    action={setTransactionCategoryStatus.bind(
                      null,
                      context.id,
                      category.id,
                      nextStatus,
                    )}
                  >
                    {nextStatus === "archived" ? (
                      <ConfirmSubmit
                        triggerLabel="Archive"
                        title="Archive this category?"
                        description="It will remain on historical transactions but cannot be selected for new entries."
                        confirmLabel="Archive category"
                        destructive
                      />
                    ) : (
                      <Button variant="outline" type="submit">
                        <RotateCcw className="size-4" />
                        Restore
                      </Button>
                    )}
                  </form>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
