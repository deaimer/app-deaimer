import { Suspense } from "react";
import { CandidateProfileWorkspace } from "@/components/candidate-profile-workspace";

export default function CandidateProfileEditPage() {
  return (
    <Suspense fallback={null}>
      <CandidateProfileWorkspace />
    </Suspense>
  );
}
