import { CandidatePortal } from "@/components/candidate-portal";

export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const resolvedSearchParams = await searchParams;

  return (
    <CandidatePortal
      view="entry"
      allowProfileEdit={resolvedSearchParams.edit === "1"}
    />
  );
}
