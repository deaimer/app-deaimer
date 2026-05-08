import { Suspense } from "react";
import { DeaimerSiteShell } from "@/components/deaimer-site-shell";
import { GoogleRoleOnboarding } from "@/components/google-role-onboarding";

export default function ParticipantsPage() {
  return (
    <DeaimerSiteShell>
      <Suspense fallback={null}>
        <GoogleRoleOnboarding role="participants" />
      </Suspense>
    </DeaimerSiteShell>
  );
}
