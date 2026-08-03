import type { OrganizationRole } from "@/types/database";

export type OrganizationChoice = {
  id: string;
  name: string;
  role: OrganizationRole;
};
export type OrganizationContext = OrganizationChoice & {
  membershipId: string;
  userId: string;
};
