import { CandidatePortal } from "@/components/candidate-portal";

export default async function CandidateApplicationDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;

  return <CandidatePortal view="applications" selectedApplicationJobId={jobId} />;
}
