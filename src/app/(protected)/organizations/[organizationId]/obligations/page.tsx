import Link from "next/link";
import { ArrowRight, Plus } from "lucide-react";
import { z } from "zod";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  inputClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireFinancialReader } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import type { ObligationStatus } from "@/types/database";

export default async function ObligationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ status?: string; message?: string }>;
}) {
  const { organizationId } = await params;
  const filters = await searchParams;
  const context = await requireFinancialReader(organizationId);
  const { supabase } = await requireUser();
  let query = supabase
    .from("financial_obligations")
    .select("*")
    .eq("organization_id", context.id)
    .order("due_on");
  const status = z
    .enum(["expected", "committed", "paid", "voided"])
    .safeParse(filters.status);
  if (status.success)
    query = query.eq("status", status.data as ObligationStatus);
  const { data: obligations, error } = await query;
  const { data: categories } = await supabase
    .from("transaction_categories")
    .select("id,name")
    .eq("organization_id", context.id);
  const categoryNames = new Map(
    (categories ?? []).map((item) => [item.id, item.name]),
  );
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="Forward commitments"
        title="Obligations"
        description="Expected items remain scenario information. Only committed obligations inside the selected forecast horizon reduce projected cash."
        actions={
          context.role === "treasurer" ? (
            <Button asChild>
              <Link href={`/organizations/${context.id}/obligations/new`}>
                <Plus className="size-4" /> New obligation
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Message message={filters.message} />
      {error && <Message message="Obligations could not be loaded." />}
      <Card>
        <CardContent className="pt-6">
          <form className="flex max-w-xs items-end gap-3">
            <label className={labelClass}>
              Status
              <select
                className={inputClass}
                name="status"
                defaultValue={filters.status ?? ""}
              >
                <option value="">All</option>
                <option value="expected">Expected</option>
                <option value="committed">Committed</option>
                <option value="paid">Paid</option>
                <option value="voided">Voided</option>
              </select>
            </label>
            <Button variant="outline" type="submit">
              Filter
            </Button>
          </form>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {(obligations ?? []).map((obligation) => (
          <Card key={obligation.id}>
            <CardContent className="flex flex-col gap-4 py-5 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h2 className="font-semibold">{obligation.description}</h2>
                  <StatusBadge status={obligation.status} />
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {categoryNames.get(obligation.category_id) ??
                    "Expense category"}{" "}
                  · due {obligation.due_on}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-semibold">
                  {formatMoney(obligation.amount_minor)}
                </span>
                <Button variant="outline" asChild>
                  <Link
                    href={`/organizations/${context.id}/obligations/${obligation.id}`}
                  >
                    Review <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {!error && (obligations ?? []).length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No obligations match this view.
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
