import { CandidatePortal } from "@/components/candidate-portal";

export default async function CrowdWorkApplyPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;

  return <CandidatePortal view="crowd-work" selectedCrowdPostId={postId} crowdApplyMode />;
}
