import { notFound } from "next/navigation";
import { CandidatePortal } from "@/components/candidate-portal";

const candidateSectionConfig = {
  home: { view: "home" as const },
  applications: { view: "applications" as const },
  "saved-roles": { view: "saved-roles" as const },
  "crowd-work": { view: "crowd-work" as const },
  settings: { view: "settings" as const },
};

export function generateStaticParams() {
  return Object.keys(candidateSectionConfig).map((section) => ({ section }));
}

export default async function CandidateSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  const config = candidateSectionConfig[section as keyof typeof candidateSectionConfig];

  if (!config) {
    notFound();
  }

  return <CandidatePortal view={config.view} />;
}
