import { ArrowUpRight, Clock3, FileWarning, WalletCards } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const cards = [
  {
    label: "Reconciled cash",
    value: "Not connected",
    note: "Import a bank CSV to begin",
    icon: WalletCards,
  },
  {
    label: "Calculated safe-to-spend",
    value: "Not calculated",
    note: "Financial engine is intentionally deferred",
    icon: Clock3,
  },
  {
    label: "Open commitments",
    value: "No data",
    note: "Commitment tracking comes next",
    icon: FileWarning,
  },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <Badge className="border-emerald-200 bg-emerald-50 text-emerald-800">
            Scaffold preview
          </Badge>
          <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            Financial overview
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            A calm, explainable workspace for understanding cash position and
            upcoming obligations.
          </p>
        </div>
        <Button disabled>Import financial data</Button>
      </header>
      <div
        role="note"
        className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <strong>Demo interface only.</strong> No bank data is connected and no
        financial calculations are implemented at this checkpoint.
      </div>
      <section
        aria-label="Financial summary"
        className="grid gap-4 md:grid-cols-3"
      >
        {cards.map(({ label, value, note, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div>
                <CardDescription>{label}</CardDescription>
                <CardTitle className="mt-2 text-xl">{value}</CardTitle>
              </div>
              <div className="rounded-lg bg-slate-100 p-2.5">
                <Icon className="size-5 text-slate-600" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500">{note}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>90-day cash outlook</CardTitle>
            <CardDescription>
              This area will show dated inflows, outflows, and the reserve line.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex h-64 items-center justify-center rounded-lg border border-dashed bg-slate-50 text-sm text-slate-500">
              Forecast visualization placeholder
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>
              Future onboarding steps for the treasurer.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              "Set organization policy",
              "Import and review transactions",
              "Record upcoming commitments",
            ].map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <span className="flex size-7 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold">
                  {index + 1}
                </span>
                <span className="text-sm text-slate-700">{step}</span>
                <ArrowUpRight className="ml-auto size-4 text-slate-400" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
