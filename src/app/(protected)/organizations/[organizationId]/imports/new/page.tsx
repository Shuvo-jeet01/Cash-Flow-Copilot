import Link from "next/link";
import { createTransactionImportPreview } from "../../financial-actions";
import {
  FinancialPageHeader,
  Message,
  inputClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireFinancialTreasurer } from "@/lib/finance/access";

export default async function NewImportPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId } = await params;
  const { message } = await searchParams;
  const context = await requireFinancialTreasurer(organizationId);
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <FinancialPageHeader
        eyebrow="CSV preview"
        title="Upload transaction CSV"
        description="Use the exact template. Invalid rows block confirmation, and accounts or categories are never created silently."
        actions={
          <Button asChild variant="outline">
            <Link href={`/organizations/${context.id}/imports`}>
              Back to imports
            </Link>
          </Button>
        }
      />
      <Message message={message} />
      <Card>
        <CardHeader>
          <CardTitle>Phase 5A template</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-slate-600">
            Required headers: transaction_date, direction, amount, currency,
            description, account_name, category_name. Optional: reference, note,
            external_id.
          </p>
          <Button asChild variant="outline">
            <a href="/templates/transactions-v1.csv" download>
              Download example CSV
            </a>
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <form
            action={createTransactionImportPreview.bind(null, context.id)}
            className="space-y-4"
          >
            <label className={labelClass}>
              CSV file
              <input
                className={inputClass}
                type="file"
                name="file"
                accept=".csv,text/csv"
                required
              />
            </label>
            <p className="text-xs text-slate-500">
              UTF-8 CSV only, maximum 1 MB and 5,000 rows. The file is parsed in
              memory and not retained.
            </p>
            <Button type="submit">Validate and preview</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
