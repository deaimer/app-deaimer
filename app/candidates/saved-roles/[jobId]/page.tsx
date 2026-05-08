import { CandidatePortal } from "@/components/candidate-portal";

export default async function CandidateSavedRoleDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <CandidatePortal view="saved-roles" selectedSavedJobId={jobId} />;
}
