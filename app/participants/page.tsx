import { Suspense } from "react";
import { ParticipantsPortal } from "@/components/participants-portal";

export default function ParticipantsPage() {
  return (
    <Suspense fallback={null}>
      <ParticipantsPortal />
    </Suspense>
  );
}
