"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";

export async function createOrganization(formData: FormData) {
  const name =
    typeof formData.get("organizationName") === "string"
      ? String(formData.get("organizationName")).trim()
      : "";
  if (name.length < 2 || name.length > 120)
    redirect(
      "/organizations/new?message=Enter%20a%20valid%20organization%20name.",
    );
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc("create_organization", {
    organization_name: name,
  });
  if (error || !data)
    redirect(
      "/organizations/new?message=Unable%20to%20create%20the%20organization.",
    );
  redirect(`/organizations/${data}/dashboard`);
}

export async function updateOrganizationName(
  untrustedOrganizationId: string,
  formData: FormData,
) {
  const context = await requireOrganizationAccess(untrustedOrganizationId);
  if (context.role !== "treasurer") throw new Error("Not authorized.");
  const name =
    typeof formData.get("name") === "string"
      ? String(formData.get("name")).trim()
      : "";
  if (name.length < 2 || name.length > 120)
    throw new Error("Invalid organization name.");
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("organizations")
    .update({ name })
    .eq("id", context.id);
  if (error) throw new Error("Unable to update the organization.");
}
