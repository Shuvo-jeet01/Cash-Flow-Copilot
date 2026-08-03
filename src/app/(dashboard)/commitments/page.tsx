import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Commitments"
      title="Track obligations before they hit the bank"
      description="Record future expenses with ownership, due dates, evidence, and review status. No records are stored in this scaffold."
      items={["Upcoming obligations", "Review status", "Supporting evidence"]}
    />
  );
}
