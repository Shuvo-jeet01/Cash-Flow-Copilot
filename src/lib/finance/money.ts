const MONEY_PATTERN = /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
export const MAX_AMOUNT_MINOR = 999_999_999_999;

export function parseMoneyToMinor(value: string, allowNegative = false) {
  const normalized = value.trim();
  if (!MONEY_PATTERN.test(normalized))
    throw new Error(
      "Use a dollar amount with no commas and at most two decimals.",
    );
  const negative = normalized.startsWith("-");
  if (negative && !allowNegative) throw new Error("Amount must be positive.");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [dollars, cents = ""] = unsigned.split(".");
  const minor = Number(dollars) * 100 + Number(cents.padEnd(2, "0"));
  if (!Number.isSafeInteger(minor) || minor > MAX_AMOUNT_MINOR)
    throw new Error("Amount is outside the supported range.");
  return negative ? -minor : minor;
}

export function formatMoney(amountMinor: number) {
  if (!Number.isSafeInteger(amountMinor)) return "Unavailable";
  const negative = amountMinor < 0;
  const absolute = Math.abs(amountMinor);
  const dollars = Math.floor(absolute / 100);
  const cents = String(absolute % 100).padStart(2, "0");
  return `${negative ? "-" : ""}$${dollars.toLocaleString("en-US")}.${cents}`;
}
