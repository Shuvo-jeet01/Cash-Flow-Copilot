import Link from "next/link";
import { signIn } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Welcome back</CardTitle>
        <CardDescription>
          Sign in to access your organization workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signIn} className="space-y-4">
          {message && (
            <p
              role="alert"
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
            >
              {message}
            </p>
          )}
          <label className="block text-sm font-medium">
            Email
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-1 h-10 w-full rounded-md border bg-white px-3"
            />
          </label>
          <label className="block text-sm font-medium">
            Password
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              className="mt-1 h-10 w-full rounded-md border bg-white px-3"
            />
          </label>
          <Button className="w-full" type="submit">
            Sign in
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          New here?{" "}
          <Link className="font-medium text-emerald-700" href="/sign-up">
            Create an account
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
