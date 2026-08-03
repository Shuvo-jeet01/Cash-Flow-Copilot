"use client";

import { usePathname, useRouter } from "next/navigation";
import type { OrganizationChoice } from "@/lib/organizations/organization-context";

export function OrganizationSwitcher({
  currentOrganizationId,
  organizations,
}: {
  currentOrganizationId: string;
  organizations: OrganizationChoice[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  function switchOrganization(nextOrganizationId: string) {
    const nextPath = pathname.replace(
      `/organizations/${currentOrganizationId}`,
      `/organizations/${nextOrganizationId}`,
    );
    router.push(
      nextPath === pathname
        ? `/organizations/${nextOrganizationId}/dashboard`
        : nextPath,
    );
  }
  return (
    <label className="sr-only">
      Organization
      <select
        aria-label="Organization"
        value={currentOrganizationId}
        onChange={(event) => switchOrganization(event.target.value)}
        className="sr-only"
      >
        {organizations.map((organization) => (
          <option key={organization.id} value={organization.id}>
            {organization.name}
          </option>
        ))}
      </select>
    </label>
  );
}
