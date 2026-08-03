import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Event scenarios"
      title="Compare assumptions before deciding"
      description="Future best, expected, and worst cases will support human decisions without automatically approving spending."
      items={["Cost assumptions", "Revenue confidence", "Reserve impact"]}
    />
  );
}
