import { Suspense } from "react";
import { OpsShell } from "@/components/ops-shell";

export default async function OpsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string; project?: string }>;
}) {
  const params = await searchParams;

  type OpsSection = "dashboard" | "transcription" | "qa" | "workers" | "exports";
  const VALID: OpsSection[] = ["dashboard", "transcription", "qa", "workers", "exports"];
  const section: OpsSection = VALID.includes(params.section as OpsSection)
    ? (params.section as OpsSection)
    : "dashboard";

  return (
    <Suspense fallback={null}>
      <OpsShell initialSection={section} initialProjectId={params.project ?? null} />
    </Suspense>
  );
}
