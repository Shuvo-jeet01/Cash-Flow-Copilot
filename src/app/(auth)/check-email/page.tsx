import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CheckEmailPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl">Check your email</CardTitle>
        <CardDescription>
          Use the confirmation link from Supabase to finish creating your
          account. The link returns securely to this application.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
