import { configureFinancialContext } from "../financial-actions";
import {
  FinancialPageHeader,
  Message,
  inputClass,
  labelClass,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
];

export default async function SettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ organizationId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { organizationId } = await params;
  const { message } = await searchParams;
  const context = await requireOrganizationAccess(organizationId);
  const { supabase } = await requireUser();
  const canSeeFinancial = context.role !== "member";
  const [{ data: organization }, { data: financialSettings }] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("name")
        .eq("id", context.id)
        .single(),
      canSeeFinancial
        ? supabase
            .from("organization_financial_settings")
            .select("timezone,base_currency,configured_at")
            .eq("organization_id", context.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <FinancialPageHeader
        eyebrow="Organization settings"
        title={organization?.name ?? context.name}
        description="Financial context is explicit and organization-scoped. Changing it never changes historical transaction records."
      />
      <Message message={message} />
      {canSeeFinancial ? (
        <Card>
          <CardHeader>
            <CardTitle>Financial context</CardTitle>
          </CardHeader>
          <CardContent>
            {context.role === "treasurer" ? (
              <form
                action={configureFinancialContext.bind(null, context.id)}
                className="grid gap-4 md:grid-cols-3"
              >
                <label className={labelClass}>
                  Organization timezone
                  <select
                    className={inputClass}
                    name="timezone"
                    defaultValue={
                      financialSettings?.timezone ?? "America/Chicago"
                    }
                  >
                    {TIMEZONES.map((timezone) => (
                      <option key={timezone} value={timezone}>
                        {timezone}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={labelClass}>
                  Base currency
                  <input className={inputClass} value="USD" readOnly />
                </label>
                <div className="flex items-end">
                  <Button type="submit">Save financial context</Button>
                </div>
              </form>
            ) : (
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-xs uppercase text-slate-500">Timezone</dt>
                  <dd className="mt-1">
                    {financialSettings?.timezone ?? "Not configured"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs uppercase text-slate-500">Currency</dt>
                  <dd className="mt-1">
                    {financialSettings?.base_currency ?? "Not configured"}
                  </dd>
                </div>
              </dl>
            )}
            <p className="mt-4 text-xs text-slate-500">
              Phase 5A supports USD only. Transaction dates are interpreted
              using this IANA timezone.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-sm text-slate-600">
            Financial settings are not available to member accounts.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
