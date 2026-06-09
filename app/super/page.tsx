import { type PlatformSideMenuItem } from "@/components/deaimer-site-shell";
import { SuperAdminPortal } from "@/components/super-admin-portal";
import { type DCAdminSection } from "@/components/data-collection-admin-panel";

export default async function SuperAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; target?: string; mode?: string; email?: string; section?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const activeView =
    resolvedSearchParams.view === "access" ||
    resolvedSearchParams.view === "team" ||
    resolvedSearchParams.view === "workforce" ||
    resolvedSearchParams.view === "company" ||
    resolvedSearchParams.view === "careers" ||
    resolvedSearchParams.view === "data-collection" ||
    resolvedSearchParams.view === "evaluation-transcription"
      ? resolvedSearchParams.view
      : "overview";
  const activeTarget =
    resolvedSearchParams.target === "admins" ||
    resolvedSearchParams.target === "super"
      ? resolvedSearchParams.target
      : "clients";
  const activeMode =
    resolvedSearchParams.mode === "new" || resolvedSearchParams.mode === "edit"
      ? resolvedSearchParams.mode
      : "list";
  const activeEditingEmail = resolvedSearchParams.email ?? null;
  const activeWorkforceSection =
    resolvedSearchParams.section === "job-posts" ||
    resolvedSearchParams.section === "crowd-projects" ||
    resolvedSearchParams.section === "crowd" ||
    resolvedSearchParams.section === "candidates" ||
    resolvedSearchParams.section === "signups" ||
    resolvedSearchParams.section === "commissions" ||
    resolvedSearchParams.section === "data"
      ? resolvedSearchParams.section
      : "partners";

  const activeDCSection: DCAdminSection =
    resolvedSearchParams.section === "projects" ||
    resolvedSearchParams.section === "speakers" ||
    resolvedSearchParams.section === "sessions" ||
    resolvedSearchParams.section === "video"
      ? resolvedSearchParams.section
      : "projects";

  const activeEvalSection =
    resolvedSearchParams.section === "assignments" ||
    resolvedSearchParams.section === "qa-review" ||
    resolvedSearchParams.section === "transcription" ||
    resolvedSearchParams.section === "delivery"
      ? resolvedSearchParams.section
      : "assignments";

  const superPlatformMenuItems: PlatformSideMenuItem[] = [
    {
      label: "Control",
      isSectionHeader: true,
    },
    {
      label: "Access",
      href: `/super?view=access&target=${activeTarget}`,
      active: activeView === "access",
    },
    {
      label: "Team",
      href: "/super?view=team",
      active: activeView === "team",
    },
    {
      label: "Company",
      isSectionHeader: true,
    },
    {
      label: "Company",
      href: "/super?view=company",
      active: activeView === "company",
    },
    {
      label: "Careers",
      href: "/super?view=careers",
      active: activeView === "careers",
    },
    {
      label: "Global Workforce",
      isSectionHeader: true,
    },
    {
      label: "Partner companies",
      href: "/super?view=workforce&section=partners",
      active: activeView === "workforce" && activeWorkforceSection === "partners",
    },
    {
      label: "Job posts",
      href: "/super?view=workforce&section=job-posts",
      active: activeView === "workforce" && activeWorkforceSection === "job-posts",
    },
    {
      label: "Crowd projects",
      href: "/super?view=workforce&section=crowd-projects",
      active: activeView === "workforce" && activeWorkforceSection === "crowd-projects",
    },
    {
      label: "Crowd",
      href: "/super?view=workforce&section=crowd",
      active: activeView === "workforce" && activeWorkforceSection === "crowd",
    },
    {
      label: "Candidates",
      href: "/super?view=workforce&section=candidates",
      active: activeView === "workforce" && activeWorkforceSection === "candidates",
    },
    {
      label: "Signups",
      href: "/super?view=workforce&section=signups",
      active: activeView === "workforce" && activeWorkforceSection === "signups",
    },
    {
      label: "Commissions",
      href: "/super?view=workforce&section=commissions",
      active: activeView === "workforce" && activeWorkforceSection === "commissions",
    },
    {
      label: "Data",
      href: "/super?view=workforce&section=data",
      active: activeView === "workforce" && activeWorkforceSection === "data",
    },
    {
      label: "Data Collection",
      isSectionHeader: true,
    },
    {
      label: "Projects",
      href: "/super?view=data-collection&section=projects",
      active: activeView === "data-collection" && activeDCSection === "projects",
    },
    {
      label: "Speakers",
      href: "/super?view=data-collection&section=speakers",
      active: activeView === "data-collection" && activeDCSection === "speakers",
    },
    {
      label: "Sessions",
      href: "/super?view=data-collection&section=sessions",
      active: activeView === "data-collection" && activeDCSection === "sessions",
    },
    {
      label: "Video projects",
      href: "/super?view=data-collection&section=video",
      active: activeView === "data-collection" && activeDCSection === "video",
    },
    {
      label: "Evaluation & Transcription",
      isSectionHeader: true,
    },
    {
      label: "Assignments",
      href: "/super?view=evaluation-transcription&section=assignments",
      active: activeView === "evaluation-transcription" && activeEvalSection === "assignments",
    },
    {
      label: "QA Review",
      href: "/super?view=evaluation-transcription&section=qa-review",
      active: activeView === "evaluation-transcription" && activeEvalSection === "qa-review",
    },
    {
      label: "Transcription",
      href: "/super?view=evaluation-transcription&section=transcription",
      active: activeView === "evaluation-transcription" && activeEvalSection === "transcription",
    },
    {
      label: "Delivery",
      href: "/super?view=evaluation-transcription&section=delivery",
      active: activeView === "evaluation-transcription" && activeEvalSection === "delivery",
    },
  ];

  return (
    <SuperAdminPortal
      initialView={activeView as "overview" | "access" | "team" | "workforce" | "company" | "careers" | "data-collection" | "evaluation-transcription"}
      initialAccessTarget={activeTarget}
      initialAccessMode={activeMode}
      initialEditingEmail={activeEditingEmail}
      initialWorkforceSection={activeWorkforceSection}
      initialDCSection={activeDCSection}
      initialEvalSection={activeEvalSection}
      platformSideMenuItems={superPlatformMenuItems}
    />
  );
}
