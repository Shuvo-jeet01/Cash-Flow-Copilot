import { requireUser } from "@/lib/auth/current-user";
import type { OrganizationChoice } from "@/lib/organizations/organization-context";

export async function getUserOrganizations(): Promise<OrganizationChoice[]> {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("organization_memberships")
    .select("role, organizations!inner(id, name)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw new Error("Unable to load organizations.");
  return (data ?? []).map((row) => {
    const organization = row.organizations as unknown as {
      id: string;
      name: string;
    };
    return { id: organization.id, name: organization.name, role: row.role };
  });
}
