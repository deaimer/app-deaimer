import { Suspense } from "react";
import { ClientAuthPortal } from "@/components/client-auth-portal";

export default function ClientsPage() {
  return (
    <Suspense fallback={null}>
      <ClientAuthPortal />
    </Suspense>
  );
}
