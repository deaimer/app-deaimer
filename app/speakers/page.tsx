import { Suspense } from "react";
import { SpeakersShell } from "@/components/speakers-shell";

export default function SpeakersPage() {
  return (
    <Suspense fallback={null}>
      <SpeakersShell />
    </Suspense>
  );
}
