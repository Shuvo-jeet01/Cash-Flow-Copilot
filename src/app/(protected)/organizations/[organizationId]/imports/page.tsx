import Link from "next/link";
import { FileUp } from "lucide-react";
import {
  FinancialPageHeader,
  StatusBadge,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireFinancialTreasurer } from "@/lib/finance/access";
import { formatMoney } from "@/lib/finance/money";
import { requireUser } from "@/lib/auth/current-user";

export default async function ImportsPage({
  params,
}: {
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const context = await requireFinancialTreasurer(organizationId);
  const { supabase } = await requireUser();
  const { data: batches } = await supabase
    .from("transaction_import_batches")
    .select("*")
    .eq("organization_id", context.id)
    .order("created_at", { ascending: false });
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="CSV imports"
        title="Transaction imports"
        description="Files are validated and previewed before an all-or-nothing database write. Raw CSV files are not retained."
        actions={
          <Button asChild>
            <Link href={`/organizations/${context.id}/imports/new`}>
              <FileUp className="size-4" />
              New import
            </Link>
          </Button>
        }
      />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          {!batches?.length ? (
            <div className="py-12 text-center text-sm text-slate-600">
              No import batches yet.
            </div>
          ) : (
            <table className="w-full min-w-[760px] text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-5 py-3">File</th>
                  <th className="px-5 py-3">Created</th>
                  <th className="px-5 py-3">Rows</th>
                  <th className="px-5 py-3">Income</th>
                  <th className="px-5 py-3">Expense</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {batches.map((batch) => (
                  <tr key={batch.id}>
                    <td className="px-5 py-4">
                      <Link
                        className="font-medium text-emerald-700"
                        href={`/organizations/${context.id}/imports/${batch.id}`}
                      >
                        {batch.file_name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        Fingerprint {batch.file_sha256.slice(0, 12)}…
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {new Date(batch.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-4">{batch.row_count}</td>
                    <td className="px-5 py-4">
                      {formatMoney(batch.income_total_minor)}
                    </td>
                    <td className="px-5 py-4">
                      {formatMoney(batch.expense_total_minor)}
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={batch.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
