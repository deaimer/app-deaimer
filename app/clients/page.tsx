import { DeaimerSiteShell } from "@/components/deaimer-site-shell";
import { ClientAuthPortal } from "@/components/client-auth-portal";

export default function ClientsPage() {
  return (
    <DeaimerSiteShell>
      <ClientAuthPortal />
    </DeaimerSiteShell>
  );
}
