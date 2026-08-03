import Link from "next/link";
import { Landmark } from "lucide-react";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="mb-8 flex items-center justify-center gap-3 text-slate-950"
        >
          <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500">
            <Landmark className="size-5" />
          </span>
          <span className="font-semibold">Cash-Flow Copilot</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
