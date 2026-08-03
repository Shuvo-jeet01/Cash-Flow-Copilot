import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Cash flow"
      title="See what changes over time"
      description="This workspace will eventually show reconciled cash, dated obligations, confidence-labeled inflows, and reserve warnings."
      items={[
        "30 / 60 / 90-day forecast",
        "Data freshness",
        "Explainable warnings",
      ]}
    />
  );
}
