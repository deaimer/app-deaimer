import { Suspense } from "react";
import { CandidateProfileWorkspace } from "@/components/candidate-profile-workspace";

export default function CandidateProfilePage() {
  return (
    <Suspense fallback={null}>
      <CandidateProfileWorkspace />
    </Suspense>
  );
}
