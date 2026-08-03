import { ArrowRight, CircleDashed } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function PagePlaceholder({
  eyebrow,
  title,
  description,
  items,
}: {
  eyebrow: string;
  title: string;
  description: string;
  items: string[];
}) {
  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header className="space-y-3">
        <Badge className="border-amber-200 bg-amber-50 text-amber-800">
          Placeholder · No live financial data
        </Badge>
        <div>
          <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">
            {title}
          </h1>
        </div>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          {description}
        </p>
      </header>
      <div className="grid gap-4 md:grid-cols-3">
        {items.map((item) => (
          <Card key={item}>
            <CardHeader>
              <div className="mb-4 flex size-10 items-center justify-center rounded-lg bg-slate-100">
                <CircleDashed className="size-5 text-slate-500" />
              </div>
              <CardTitle className="text-base">{item}</CardTitle>
              <CardDescription>
                Planned for a later implementation checkpoint.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                Not connected <ArrowRight className="size-3" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
