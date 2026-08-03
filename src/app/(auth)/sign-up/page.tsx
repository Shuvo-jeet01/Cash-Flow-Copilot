import Link from "next/link";
import { signUp } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Create your account</CardTitle>
        <CardDescription>
          You will choose or create an organization after signing in.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={signUp} className="space-y-4">
          {message && (
            <p
              role="alert"
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
            >
              {message}
            </p>
          )}
          <label className="block text-sm font-medium">
            Display name
            <input
              name="displayName"
              autoComplete="name"
              required
              maxLength={100}
              className="mt-1 h-10 w-full rounded-md border bg-white px-3"
            />
          </label>
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
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-1 h-10 w-full rounded-md border bg-white px-3"
            />
          </label>
          <Button className="w-full" type="submit">
            Create account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already registered?{" "}
          <Link className="font-medium text-emerald-700" href="/sign-in">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
