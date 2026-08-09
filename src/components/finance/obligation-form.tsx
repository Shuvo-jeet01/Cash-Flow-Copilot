import { Button } from "@/components/ui/button";
import {
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";

type Choice = { id: string; name: string; status: string };

export function ObligationForm({
  action,
  categories,
  accounts,
  defaults,
  expectedVersion,
  submitLabel,
  requireReason = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  categories: Choice[];
  accounts: Choice[];
  defaults?: {
    description: string;
    amountMinor: number;
    dueOn: string;
    categoryId: string;
    accountId: string | null;
    reference: string | null;
    note: string | null;
    status: "expected" | "committed";
  };
  expectedVersion?: number;
  submitLabel: string;
  requireReason?: boolean;
}) {
  return (
    <form action={action} className="space-y-6">
      <input name="currencyCode" type="hidden" value="USD" />
      <input name="idempotencyKey" type="hidden" value={crypto.randomUUID()} />
      {expectedVersion !== undefined && (
        <input name="expectedVersion" type="hidden" value={expectedVersion} />
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Description
          <input
            required
            className={inputClass}
            name="description"
            maxLength={200}
            defaultValue={defaults?.description}
          />
        </label>
        <label className={labelClass}>
          Amount (USD)
          <input
            required
            className={inputClass}
            name="amount"
            inputMode="decimal"
            defaultValue={
              defaults ? (defaults.amountMinor / 100).toFixed(2) : undefined
            }
          />
        </label>
        <label className={labelClass}>
          Due date
          <input
            required
            className={inputClass}
            type="date"
            name="dueOn"
            defaultValue={defaults?.dueOn}
          />
        </label>
        <label className={labelClass}>
          Expense category
          <select
            required
            className={inputClass}
            name="categoryId"
            defaultValue={defaults?.categoryId ?? ""}
          >
            <option value="" disabled>
              Select a category
            </option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
                {category.status === "archived" ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Intended account (optional)
          <select
            className={inputClass}
            name="intendedAccountId"
            defaultValue={defaults?.accountId ?? ""}
          >
            <option value="">Not specified</option>
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
                {account.status === "archived" ? " (archived)" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Initial status
          <select
            className={inputClass}
            name="initialStatus"
            defaultValue={defaults?.status ?? "expected"}
            disabled={Boolean(defaults)}
          >
            <option value="expected">Expected</option>
            <option value="committed">Committed</option>
          </select>
          {defaults && (
            <input name="initialStatus" type="hidden" value={defaults.status} />
          )}
        </label>
        <label className={labelClass}>
          Reference (optional)
          <input
            className={inputClass}
            name="reference"
            maxLength={100}
            defaultValue={defaults?.reference ?? ""}
          />
        </label>
      </div>
      <label className={labelClass}>
        Note (optional)
        <textarea
          className={textareaClass}
          name="note"
          maxLength={500}
          defaultValue={defaults?.note ?? ""}
        />
      </label>
      {requireReason && (
        <label className={labelClass}>
          Update reason
          <textarea
            required
            className={textareaClass}
            name="reason"
            maxLength={500}
          />
        </label>
      )}
      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
