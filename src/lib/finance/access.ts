import { notFound } from "next/navigation";
import { requireOrganizationAccess } from "@/lib/organizations/require-organization-access";
import type { OrganizationRole } from "@/types/database";

const FINANCIAL_READERS: OrganizationRole[] = [
  "treasurer",
  "president",
  "executive",
];

export async function requireFinancialReader(untrustedOrganizationId: string) {
  const context = await requireOrganizationAccess(untrustedOrganizationId);
  if (!FINANCIAL_READERS.includes(context.role)) notFound();
  return context;
}

export async function requireFinancialTreasurer(
  untrustedOrganizationId: string,
) {
  const context = await requireOrganizationAccess(untrustedOrganizationId);
  if (context.role !== "treasurer") throw new Error("Not authorized.");
  return context;
}
