import { CandidatePortal } from "@/components/candidate-portal";

export default async function CandidateJobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <CandidatePortal view="jobs" selectedJobId={jobId} />;
}
