import { PagePlaceholder } from "@/components/page-placeholder";
export default function Page() {
  return (
    <PagePlaceholder
      eyebrow="Imports"
      title="Bring existing data in carefully"
      description="The planned CSV-first workflow will validate, preview, and detect duplicates before anything is committed."
      items={["Column mapping", "Validation preview", "Duplicate review"]}
    />
  );
}
