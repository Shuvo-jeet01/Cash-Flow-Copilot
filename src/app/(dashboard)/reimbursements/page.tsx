import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Reimbursements"
      title="Give every request a clear status"
      description="A future private workflow for submission, receipt review, authorization, and payment tracking."
      items={["Member submissions", "Treasurer review", "Status history"]}
    />
  );
}
