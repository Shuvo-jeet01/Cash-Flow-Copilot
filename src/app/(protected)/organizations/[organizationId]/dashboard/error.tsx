"use client";

import { Button } from "@/components/ui/button";

export default function DashboardError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-3xl rounded-xl border border-rose-200 bg-rose-50 p-8 text-center">
      <h1 className="text-xl font-semibold text-rose-950">
        The financial dashboard could not be calculated safely.
      </h1>
      <p className="mt-2 text-sm text-rose-800">
        No estimate is shown when authoritative records are unavailable or
        internally inconsistent.
      </p>
      <Button className="mt-5" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
