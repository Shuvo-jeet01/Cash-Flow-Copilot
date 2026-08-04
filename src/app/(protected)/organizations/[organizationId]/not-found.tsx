import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function OrganizationRecordNotFound() {
  return (
    <Card className="mx-auto max-w-xl">
      <CardContent className="space-y-4 py-10 text-center">
        <h1 className="text-2xl font-bold text-slate-950">
          Record unavailable
        </h1>
        <p className="text-sm leading-6 text-slate-600">
          The record does not exist in this organization, your role cannot
          access it, or your membership was revoked.
        </p>
        <Button asChild>
          <Link href="/organizations">Choose an organization</Link>
        </Button>
      </CardContent>
    </Card>
  );
}
