import { Suspense } from "react";
import { OpsShell } from "@/components/ops-shell";

export default function OpsPage() {
  return (
    <Suspense fallback={null}>
      <OpsShell />
    </Suspense>
  );
}
