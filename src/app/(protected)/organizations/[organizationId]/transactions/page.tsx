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
import { formatMoney } from "@/lib/finance/money";
import { requireFinancialReader } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";
import type {
  FinancialTransactionStatus,
  TransactionDirection,
} from "@/types/database";

type Search = {
  from?: string;
  to?: string;
  account?: string;
  category?: string;
  direction?: string;
  status?: string;
  q?: string;
  cursor?: string;
  message?: string;
};
const cursorSchema = z.object({
  date: z.iso.date(),
  createdAt: z.iso.datetime({ offset: true }),
  id: z.uuid(),
});
type Cursor = z.infer<typeof cursorSchema>;
function decodeCursor(value?: string): Cursor | null {
  try {
    if (!value) return null;
    const parsed = cursorSchema.safeParse(
      JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
function encodeCursor(value: Cursor) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<Search>;
}) {
  const { organizationId } = await params;
  const filters = await searchParams;
  const context = await requireFinancialReader(organizationId);
  const { supabase } = await requireUser();
  const [{ data: accounts }, { data: categories }] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("id,name,status")
      .eq("organization_id", context.id)
      .order("name"),
    supabase
      .from("transaction_categories")
      .select("id,name,direction,status")
      .eq("organization_id", context.id)
      .order("name"),
  ]);
  let query = supabase
    .from("financial_transactions")
    .select("*")
    .eq("organization_id", context.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(51);
  const from = z.iso.date().safeParse(filters.from);
  const to = z.iso.date().safeParse(filters.to);
  const account = z.uuid().safeParse(filters.account);
  const category = z.uuid().safeParse(filters.category);
  if (from.success) query = query.gte("transaction_date", from.data);
  if (to.success) query = query.lte("transaction_date", to.data);
  if (account.success) query = query.eq("account_id", account.data);
  if (category.success) query = query.eq("category_id", category.data);
  if (filters.direction === "income" || filters.direction === "expense")
    query = query.eq("direction", filters.direction as TransactionDirection);
  if (filters.status === "posted" || filters.status === "voided")
    query = query.eq("status", filters.status as FinancialTransactionStatus);
  if (filters.q) {
    const safe = filters.q
      .replaceAll(/[,%()]/g, " ")
      .trim()
      .slice(0, 80);
    if (safe)
      query = query.or(`description.ilike.%${safe}%,reference.ilike.%${safe}%`);
  }
  const cursor = decodeCursor(filters.cursor);
  if (cursor)
    query = query.or(
      `transaction_date.lt.${cursor.date},and(transaction_date.eq.${cursor.date},created_at.lt.${cursor.createdAt}),and(transaction_date.eq.${cursor.date},created_at.eq.${cursor.createdAt},id.lt.${cursor.id})`,
    );
  const { data, error } = await query;
  const rows = (data ?? []).slice(0, 50);
  const hasNext = (data ?? []).length > 50;
  const accountNames = new Map(
    (accounts ?? []).map((item) => [item.id, item.name]),
  );
  const categoryNames = new Map(
    (categories ?? []).map((item) => [item.id, item.name]),
  );
  const next = new URLSearchParams(
    Object.entries(filters).filter(
      ([key, value]) => key !== "cursor" && key !== "message" && Boolean(value),
    ) as [string, string][],
  );
  const last = rows.at(-1);
  if (hasNext && last)
    next.set(
      "cursor",
      encodeCursor({
        date: last.transaction_date,
        createdAt: last.created_at,
        id: last.id,
      }),
    );
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <FinancialPageHeader
        eyebrow="Financial history"
        title="Transactions"
        description="Posted and voided organization transactions, shown without calculated balances or spending recommendations."
        actions={
          context.role === "treasurer" ? (
            <Button asChild>
              <Link href={`/organizations/${context.id}/transactions/new`}>
                <Plus className="size-4" />
                New transaction
              </Link>
            </Button>
          ) : undefined
        }
      />
      <Message message={filters.message} />
      {error && (
        <Message message="Transactions could not be loaded. Try again." />
      )}
      <Card>
        <CardContent className="pt-6">
          <form className="grid gap-3 md:grid-cols-4 lg:grid-cols-7">
            <label className={labelClass}>
              From
              <input
                className={inputClass}
                type="date"
                name="from"
                defaultValue={filters.from}
              />
            </label>
            <label className={labelClass}>
              To
              <input
                className={inputClass}
                type="date"
                name="to"
                defaultValue={filters.to}
              />
            </label>
            <label className={labelClass}>
              Account
              <select
                className={inputClass}
                name="account"
                defaultValue={filters.account ?? ""}
              >
                <option value="">All</option>
                {accounts?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Category
              <select
                className={inputClass}
                name="category"
                defaultValue={filters.category ?? ""}
              >
                <option value="">All</option>
                {categories?.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              Type
              <select
                className={inputClass}
                name="direction"
                defaultValue={filters.direction ?? ""}
              >
                <option value="">All</option>
                <option value="income">Income</option>
                <option value="expense">Expense</option>
              </select>
            </label>
            <label className={labelClass}>
              Status
              <select
                className={inputClass}
                name="status"
                defaultValue={filters.status ?? ""}
              >
                <option value="">All</option>
                <option value="posted">Posted</option>
                <option value="voided">Voided</option>
              </select>
            </label>
            <label className={labelClass}>
              Search
              <input
                className={inputClass}
                name="q"
                defaultValue={filters.q}
                maxLength={80}
              />
            </label>
            <div className="md:col-span-4 lg:col-span-7">
              <Button type="submit">Apply filters</Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-slate-600">
              No transactions match these filters.
            </div>
          ) : (
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Description</th>
                  <th className="px-5 py-3">Account</th>
                  <th className="px-5 py-3">Category</th>
                  <th className="px-5 py-3">Amount</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-5 py-4">{row.transaction_date}</td>
                    <td className="px-5 py-4">
                      <p className="font-medium text-slate-900">
                        {row.description}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.reference || row.source.replaceAll("_", " ")}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {accountNames.get(row.account_id) ?? "Archived account"}
                    </td>
                    <td className="px-5 py-4">
                      {categoryNames.get(row.category_id) ??
                        "Archived category"}
                    </td>
                    <td
                      className={`px-5 py-4 font-semibold ${row.direction === "income" ? "text-emerald-700" : "text-slate-900"}`}
                    >
                      {row.direction === "expense" ? "−" : "+"}
                      {formatMoney(row.amount_minor)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-5 py-4">
                      <Link
                        className="inline-flex items-center gap-1 font-medium text-emerald-700"
                        href={`/organizations/${context.id}/transactions/${row.id}`}
                      >
                        View <ArrowRight className="size-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
      {hasNext && (
        <div className="flex justify-end">
          <Button asChild variant="outline">
            <Link href={`?${next.toString()}`}>
              Next page <ArrowRight className="size-4" />
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}
