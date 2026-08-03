import { AppShell } from "@/components/app-shell";
import { requireUser } from "@/lib/auth/current-user";
import { getUserOrganizations } from "@/lib/organizations/get-user-organizations";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";

export default async function OrganizationLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ organizationId: string }>;
}) {
  const { organizationId } = await params;
  const organization = await requireOrganizationAccess(organizationId);
  const organizations = await getUserOrganizations();
  const { supabase, user } = await requireUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  return (
    <AppShell
      organization={organization}
      organizations={organizations}
      profileName={profile?.display_name ?? "Member"}
    >
      {children}
    </AppShell>
  );
}
