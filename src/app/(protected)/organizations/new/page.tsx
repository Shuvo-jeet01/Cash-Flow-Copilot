import { createOrganization } from "@/app/(protected)/organizations/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function NewOrganizationPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="text-2xl">Create an organization</CardTitle>
          <CardDescription>
            You will become this organization’s treasurer. The role is assigned
            by the database and cannot be selected here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={createOrganization} className="space-y-4">
            {message && (
              <p
                role="alert"
                className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
              >
                {message}
              </p>
            )}
            <label className="block text-sm font-medium">
              Organization name
              <input
                name="organizationName"
                required
                minLength={2}
                maxLength={120}
                className="mt-1 h-10 w-full rounded-md border bg-white px-3"
              />
            </label>
            <Button type="submit">Create organization</Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
