import Link from "next/link";
import { Landmark, Plus } from "lucide-react";
import { getUserOrganizations } from "@/lib/organizations/get-user-organizations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function OrganizationsPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const organizations = await getUserOrganizations();
  const { reason } = await searchParams;
  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-12">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-700">
              Cash-Flow Copilot
            </p>
            <h1 className="mt-2 text-3xl font-bold">Choose an organization</h1>
            <p className="mt-2 text-slate-600">
              Your selection is verified again on every protected request.
            </p>
          </div>
          <Button asChild>
            <Link href="/organizations/new">
              <Plus className="size-4" />
              New organization
            </Link>
          </Button>
        </div>
        {reason && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            Your access to that organization is unavailable or has been revoked.
          </p>
        )}
        <div className="grid gap-4">
          {organizations.map((organization) => (
            <Link
              key={organization.id}
              href={`/organizations/${organization.id}/dashboard`}
            >
              <Card className="transition hover:border-emerald-300 hover:shadow-md">
                <CardHeader className="flex-row items-center gap-4">
                  <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800">
                    <Landmark className="size-5" />
                  </div>
                  <div>
                    <CardTitle>{organization.name}</CardTitle>
                    <CardDescription className="capitalize">
                      {organization.role} access
                    </CardDescription>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
          {organizations.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-slate-600">
                You do not have an active organization membership yet.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </main>
  );
}
