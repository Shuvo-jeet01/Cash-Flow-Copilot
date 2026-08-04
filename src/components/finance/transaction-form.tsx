import {
  inputClass,
  labelClass,
  textareaClass,
} from "@/components/finance/financial-ui";
import { ConfirmSubmit } from "@/components/finance/confirm-submit";
import type { TransactionDirection } from "@/types/database";

type Choice = { id: string; name: string; direction?: TransactionDirection };
type Defaults = {
  accountId?: string;
  categoryId?: string;
  direction?: TransactionDirection;
  amount?: string;
  transactionDate?: string;
  description?: string;
  reference?: string;
  note?: string;
};

export function TransactionForm({
  action,
  accounts,
  categories,
  idempotencyKey,
  defaults,
  submitLabel = "Post transaction",
  reasonRequired = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  accounts: Choice[];
  categories: Choice[];
  idempotencyKey: string;
  defaults?: Defaults;
  submitLabel?: string;
  reasonRequired?: boolean;
}) {
  return (
    <form action={action} className="grid gap-4 md:grid-cols-2">
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <label className={labelClass}>
        Type
        <select
          className={inputClass}
          name="direction"
          defaultValue={defaults?.direction ?? "expense"}
        >
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
      </label>
      <label className={labelClass}>
        Amount in USD
        <input
          className={inputClass}
          name="amount"
          required
          inputMode="decimal"
          placeholder="25.00"
          defaultValue={defaults?.amount}
        />
      </label>
      <label className={labelClass}>
        Transaction date
        <input
          className={inputClass}
          name="transactionDate"
          required
          type="date"
          defaultValue={defaults?.transactionDate}
        />
      </label>
      <label className={labelClass}>
        Account
        <select
          className={inputClass}
          name="accountId"
          required
          defaultValue={defaults?.accountId ?? ""}
        >
          <option value="" disabled>
            Choose an active account
          </option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label className={labelClass}>
        Category
        <select
          className={inputClass}
          name="categoryId"
          required
          defaultValue={defaults?.categoryId ?? ""}
        >
          <option value="" disabled>
            Choose a matching category
          </option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name} ({category.direction})
            </option>
          ))}
        </select>
      </label>
      <label className={`${labelClass} md:col-span-2`}>
        Description
        <input
          className={inputClass}
          name="description"
          required
          minLength={2}
          maxLength={200}
          defaultValue={defaults?.description}
        />
      </label>
      <label className={labelClass}>
        Optional reference
        <input
          className={inputClass}
          name="reference"
          maxLength={100}
          defaultValue={defaults?.reference}
        />
      </label>
      <label className={labelClass}>
        Optional note
        <textarea
          className={textareaClass}
          name="note"
          maxLength={500}
          defaultValue={defaults?.note}
        />
      </label>
      {reasonRequired && (
        <label className={`${labelClass} md:col-span-2`}>
          Correction reason
          <textarea
            className={textareaClass}
            name="reason"
            required
            minLength={5}
            maxLength={500}
          />
        </label>
      )}
      <div className="md:col-span-2">
        <ConfirmSubmit
          triggerLabel={submitLabel}
          title={
            reasonRequired
              ? "Void the original and post this replacement?"
              : "Post this transaction?"
          }
          description={
            reasonRequired
              ? "The original will remain as a voided record, and these values will create a linked posted replacement."
              : "This creates an immutable posted financial record. Any later change must use a void or correction workflow."
          }
          confirmLabel={
            reasonRequired ? "Confirm correction" : "Post transaction"
          }
          disabled={accounts.length === 0 || categories.length === 0}
          destructive={reasonRequired}
        />
      </div>
    </form>
  );
}
