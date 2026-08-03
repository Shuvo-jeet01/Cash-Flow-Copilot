import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import type { OrganizationContext } from "@/lib/organizations/organization-context";

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function requireOrganizationAccess(
  untrustedOrganizationId: string,
): Promise<OrganizationContext> {
  if (!UUID_PATTERN.test(untrustedOrganizationId)) redirect("/organizations");
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select(
      "id, organization_id, user_id, role, status, organizations!inner(id, name)",
    )
    .eq("organization_id", untrustedOrganizationId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) redirect("/organizations?reason=access-revoked");
  const organization = data.organizations as unknown as {
    id: string;
    name: string;
  };
  return {
    id: organization.id,
    name: organization.name,
    role: data.role,
    membershipId: data.id,
    userId: data.user_id,
  };
}
