import { configureFinancialContext } from "../financial-actions";
import { setMinimumReserve } from "../phase5b-actions";
import {
  FinancialPageHeader,
  Message,
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";
import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/current-user";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";
import { formatMoney } from "@/lib/finance/money";

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
  const [
    { data: organization },
    { data: financialSettings },
    { data: reserveHistory },
  ] = await Promise.all([
    supabase.from("organizations").select("name").eq("id", context.id).single(),
    canSeeFinancial
      ? supabase
          .from("organization_financial_settings")
          .select(
            "timezone,base_currency,configured_at,minimum_reserve_minor,reserve_version",
          )
          .eq("organization_id", context.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    canSeeFinancial
      ? supabase
          .from("minimum_reserve_history")
          .select("id,previous_amount_minor,new_amount_minor,reason,changed_at")
          .eq("organization_id", context.id)
          .order("changed_at", { ascending: false })
          .limit(20)
      : Promise.resolve({ data: [] }),
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
      {canSeeFinancial && financialSettings && (
        <Card>
          <CardHeader>
            <CardTitle>Minimum cash reserve</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-slate-600">
              Current reserve:{" "}
              <strong className="text-slate-950">
                {formatMoney(financialSettings.minimum_reserve_minor)}
              </strong>
              . The dashboard compares projected cash with this amount; it does
              not make a spending recommendation.
            </p>
            {context.role === "treasurer" && (
              <form
                action={setMinimumReserve.bind(null, context.id)}
                className="grid gap-4 md:grid-cols-2"
              >
                <input
                  name="expectedVersion"
                  type="hidden"
                  value={financialSettings.reserve_version}
                />
                <input
                  name="idempotencyKey"
                  type="hidden"
                  value={crypto.randomUUID()}
                />
                <label className={labelClass}>
                  New reserve (USD)
                  <input
                    required
                    className={inputClass}
                    name="minimumReserve"
                    inputMode="decimal"
                    defaultValue={(
                      financialSettings.minimum_reserve_minor / 100
                    ).toFixed(2)}
                  />
                </label>
                <label className={labelClass}>
                  Reason
                  <textarea
                    required
                    className={textareaClass}
                    name="reason"
                    maxLength={500}
                  />
                </label>
                <ConfirmSubmit
                  triggerLabel="Update reserve"
                  title="Update the minimum reserve?"
                  description="This changes the dashboard comparison for the organization and creates immutable reserve and audit history."
                  confirmLabel="Update reserve"
                />
              </form>
            )}
            <div>
              <h3 className="font-medium">Immutable reserve history</h3>
              <div className="mt-3 space-y-2">
                {(reserveHistory ?? []).map((entry) => (
                  <div className="rounded-lg border p-3 text-sm" key={entry.id}>
                    <div className="flex flex-wrap justify-between gap-2">
                      <span>
                        {formatMoney(entry.previous_amount_minor)} →{" "}
                        {formatMoney(entry.new_amount_minor)}
                      </span>
                      <span className="text-slate-500">
                        {new Date(entry.changed_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="mt-1 text-slate-600">{entry.reason}</p>
                  </div>
                ))}
                {(reserveHistory ?? []).length === 0 && (
                  <p className="text-sm text-slate-500">
                    No reserve changes recorded yet.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
