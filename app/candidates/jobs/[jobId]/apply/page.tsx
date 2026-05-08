import { CandidatePortal } from "@/components/candidate-portal";

export default async function CandidateJobApplyPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <CandidatePortal view="jobs" selectedJobId={jobId} applyMode />;
}
