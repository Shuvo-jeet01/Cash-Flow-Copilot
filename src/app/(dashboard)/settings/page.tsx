import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Settings"
      title="Organization policies and access"
      description="Future controls for fiscal periods, currency, minimum reserve, roles, and secure exports."
      items={[
        "Organization profile",
        "Financial policy",
        "Roles and permissions",
      ]}
    />
  );
}
