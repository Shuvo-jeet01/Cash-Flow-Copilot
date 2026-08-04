import { Badge } from "@/components/ui/badge";

export const inputClass =
  "mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
export const textareaClass =
  "mt-1 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-100";
export const labelClass = "text-sm font-medium text-slate-800";

export function FinancialPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
          {title}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function Message({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
    >
      {message}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  return (
    <Badge
      className={
        status === "active" ||
        status === "posted" ||
        status === "ready" ||
        status === "committed"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-slate-200 bg-slate-100 text-slate-700"
      }
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function FinancialLoading() {
  return (
    <div
      aria-live="polite"
      className="mx-auto max-w-6xl animate-pulse space-y-6"
    >
      <div className="h-8 w-64 rounded bg-slate-200" />
      <div className="h-32 rounded-xl bg-slate-100" />
      <span className="sr-only">Loading financial records</span>
    </div>
  );
}
