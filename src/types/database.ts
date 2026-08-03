export type OrganizationRole =
  "treasurer" | "president" | "executive" | "member";
export type MembershipStatus = "active" | "revoked";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: { id: string; display_name: string };
        Update: { display_name?: string };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: { name?: string };
        Relationships: [];
      };
      organization_memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: OrganizationRole;
          status: MembershipStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      audit_events: {
        Row: {
          id: string;
          organization_id: string;
          actor_user_id: string | null;
          action: string;
          target_type: string;
          target_id: string;
          metadata: Record<string, unknown>;
          occurred_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      ensure_profile: {
        Args: { profile_display_name: string };
        Returns: Database["public"]["Tables"]["profiles"]["Row"];
      };
      create_organization: {
        Args: { organization_name: string };
        Returns: string;
      };
    };
    Enums: {
      organization_role: OrganizationRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
