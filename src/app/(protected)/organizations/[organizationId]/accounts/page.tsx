import { RotateCcw } from "lucide-react";
import {
  createFinancialAccount,
  replaceOpeningBalance,
  setFinancialAccountStatus,
} from "../financial-actions";
import {
  FinancialPageHeader,
  Message,
  StatusBadge,
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/money";
import { requireFinancialReader } from "@/lib/finance/access";
import { requireUser } from "@/lib/auth/current-user";

export default async function AccountsPage({
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
  const [{ data: settings }, { data: accounts }, { data: entries }] =
    await Promise.all([
      supabase
        .from("organization_financial_settings")
        .select("timezone,base_currency")
        .eq("organization_id", context.id)
        .maybeSingle(),
      supabase
        .from("financial_accounts")
        .select("*")
        .eq("organization_id", context.id)
        .order("name"),
      supabase
        .from("account_opening_balance_entries")
        .select("*")
        .eq("organization_id", context.id)
        .order("created_at", { ascending: false }),
    ]);
  const successors = new Set(
    (entries ?? []).map((entry) => entry.supersedes_entry_id).filter(Boolean),
  );
  const currentEntries = new Map(
    (entries ?? [])
      .filter((entry) => !successors.has(entry.id))
      .map((entry) => [entry.account_id, entry]),
  );
  const writable = context.role === "treasurer";
  const configured = Boolean(settings?.timezone && settings.base_currency);

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <FinancialPageHeader
        eyebrow="Ledger setup"
        title="Financial accounts"
        description="Use descriptive account labels only. Never enter bank, routing, card, or login information."
      />
      <Message message={message} />
      {!configured && (
        <Message message="A treasurer must configure the organization timezone before accounts can be created." />
      )}
      {writable && configured && (
        <Card>
          <CardHeader>
            <CardTitle>Create an account</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={createFinancialAccount.bind(null, context.id)}
              className="grid gap-4 md:grid-cols-3"
            >
              <label className={labelClass}>
                Account name
                <input
                  className={inputClass}
                  name="name"
                  required
                  maxLength={100}
                  placeholder="Checking"
                />
              </label>
              <label className={labelClass}>
                Account type
                <select
                  className={inputClass}
                  name="accountType"
                  defaultValue="checking"
                >
                  <option value="checking">Checking</option>
                  <option value="savings">Savings</option>
                  <option value="cash">Cash</option>
                  <option value="payment_platform">Payment platform</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className={labelClass}>
                Currency
                <input
                  className={inputClass}
                  name="currencyCode"
                  value="USD"
                  readOnly
                />
              </label>
              <label className={labelClass}>
                Optional opening balance
                <input
                  className={inputClass}
                  name="openingBalance"
                  inputMode="decimal"
                  placeholder="1000.00"
                />
              </label>
              <label className={labelClass}>
                Opening balance effective date
                <input
                  className={inputClass}
                  type="date"
                  name="openingEffectiveOn"
                />
              </label>
              <div className="flex items-end">
                <Button type="submit">Create account</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
      <div className="space-y-4">
        {(accounts ?? []).length === 0 && (
          <Card>
            <CardContent className="py-10 text-center text-sm text-slate-600">
              No financial accounts yet.
            </CardContent>
          </Card>
        )}
        {(accounts ?? []).map((account) => {
          const opening = currentEntries.get(account.id);
          const nextStatus =
            account.status === "active" ? "archived" : "active";
          return (
            <Card key={account.id}>
              <CardContent className="grid gap-5 py-6 lg:grid-cols-[1fr_auto]">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold text-slate-950">
                      {account.name}
                    </h2>
                    <StatusBadge status={account.status} />
                  </div>
                  <p className="mt-1 text-sm capitalize text-slate-600">
                    {account.account_type.replaceAll("_", " ")} ·{" "}
                    {account.currency_code}
                  </p>
                  <p className="mt-3 text-sm text-slate-700">
                    Opening balance:{" "}
                    <strong>
                      {opening
                        ? formatMoney(opening.amount_minor)
                        : "Not recorded"}
                    </strong>
                    {opening ? ` effective ${opening.effective_on}` : ""}
                  </p>
                  {opening?.reason && (
                    <p className="mt-1 text-xs text-slate-500">
                      Latest correction reason: {opening.reason}
                    </p>
                  )}
                  {writable && opening && (
                    <details className="mt-4 rounded-lg border p-4">
                      <summary className="cursor-pointer text-sm font-medium">
                        Correct opening balance
                      </summary>
                      <form
                        action={replaceOpeningBalance.bind(
                          null,
                          context.id,
                          account.id,
                          opening.id,
                        )}
                        className="mt-4 grid gap-3 md:grid-cols-3"
                      >
                        <label className={labelClass}>
                          Correct amount
                          <input
                            className={inputClass}
                            name="amount"
                            required
                            inputMode="decimal"
                          />
                        </label>
                        <label className={labelClass}>
                          Effective date
                          <input
                            className={inputClass}
                            name="effectiveOn"
                            required
                            type="date"
                          />
                        </label>
                        <label className={labelClass}>
                          Reason
                          <textarea
                            className={textareaClass}
                            name="reason"
                            required
                            minLength={5}
                            maxLength={500}
                          />
                        </label>
                        <Button type="submit">Record correction</Button>
                      </form>
                    </details>
                  )}
                </div>
                {writable && (
                  <form
                    action={setFinancialAccountStatus.bind(
                      null,
                      context.id,
                      account.id,
                      nextStatus,
                    )}
                  >
                    {nextStatus === "archived" ? (
                      <ConfirmSubmit
                        triggerLabel="Archive"
                        title="Archive this financial account?"
                        description="It will stay visible in financial history but cannot be selected for new transactions."
                        confirmLabel="Archive account"
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
