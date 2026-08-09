import { Button } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import {
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";
import { formatMoney } from "@/lib/finance/money";
import type { TransactionDirection } from "@/types/database";

type Category = {
  id: string;
  name: string;
  direction: TransactionDirection;
  status: string;
};

type Allocation = { category_id: string; amount_minor: number };

export function BudgetForm({
  action,
  categories,
  allocations = [],
  defaults,
  expectedVersion,
  submitLabel,
  confirmation,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Category[];
  allocations?: Allocation[];
  defaults?: { name: string; startOn: string; endOn: string };
  expectedVersion?: number;
  submitLabel: string;
  confirmation?: { title: string; description: string; confirmLabel: string };
}) {
  const amountByCategory = new Map(
    allocations.map((allocation) => [
      allocation.category_id,
      (allocation.amount_minor / 100).toFixed(2),
    ]),
  );
  return (
    <form action={action} className="space-y-6">
      <input name="currencyCode" type="hidden" value="USD" />
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {expectedVersion !== undefined && (
        <input name="expectedVersion" type="hidden" value={expectedVersion} />
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <label className={labelClass}>
          Budget name
          <input
            required
            className={inputClass}
            name="name"
            maxLength={120}
            defaultValue={defaults?.name}
          />
        </label>
        <label className={labelClass}>
          Start date
          <input
            required
            className={inputClass}
            type="date"
            name="startOn"
            defaultValue={defaults?.startOn}
          />
        </label>
        <label className={labelClass}>
          End date
          <input
            required
            className={inputClass}
            type="date"
            name="endOn"
            defaultValue={defaults?.endOn}
          />
        </label>
      </div>
      <div>
        <h2 className="font-semibold text-slate-950">Category plan</h2>
        <p className="mt-1 text-sm text-slate-600">
          Income amounts are targets. Expense amounts are spending limits. Leave
          an amount blank to omit that category.
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {categories.map((category) => (
            <label
              className="rounded-lg border border-slate-200 p-4 text-sm"
              key={category.id}
            >
              <span className="flex items-center justify-between gap-2 font-medium text-slate-900">
                {category.name}
                <span className="text-xs font-normal capitalize text-slate-500">
                  {category.direction === "income" ? "target" : "limit"}
                </span>
              </span>
              <input
                name="allocationCategoryId"
                type="hidden"
                value={category.id}
              />
              <input
                className={inputClass}
                name="allocationAmount"
                inputMode="decimal"
                placeholder="0.00"
                defaultValue={amountByCategory.get(category.id)}
                aria-label={`${category.name} ${category.direction === "income" ? "target" : "limit"}`}
              />
              {amountByCategory.has(category.id) && (
                <span className="mt-1 block text-xs text-slate-500">
                  Current:{" "}
                  {formatMoney(
                    Math.round(Number(amountByCategory.get(category.id)) * 100),
                  )}
                </span>
              )}
            </label>
          ))}
        </div>
      </div>
      <label className={labelClass}>
        Approval reason
        <textarea
          required
          className={textareaClass}
          name="reason"
          maxLength={500}
          placeholder="Explain why this budget or revision is being approved."
        />
      </label>
      {confirmation ? (
        <ConfirmSubmit
          triggerLabel={submitLabel}
          title={confirmation.title}
          description={confirmation.description}
          confirmLabel={confirmation.confirmLabel}
        />
      ) : (
        <Button type="submit">{submitLabel}</Button>
      )}
    </form>
  );
}
