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
    resolvedSearchParams.view === "data-collection"
      ? resolvedSearchParams.view
      : "overview";
  const activeTarget =
    resolvedSearchParams.target === "admins" ? "admins" : "clients";
  const activeMode =
    resolvedSearchParams.mode === "new" || resolvedSearchParams.mode === "edit"
      ? resolvedSearchParams.mode
      : "list";
  const activeEditingEmail = resolvedSearchParams.email ?? null;
  const activeWorkforceSection =
    resolvedSearchParams.section === "job-posts" ||
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
    resolvedSearchParams.section === "transcription" ||
    resolvedSearchParams.section === "qa-review" ||
    resolvedSearchParams.section === "delivery"
      ? resolvedSearchParams.section
      : "projects";

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
      label: "Transcription",
      href: "/super?view=data-collection&section=transcription",
      active: activeView === "data-collection" && activeDCSection === "transcription",
    },
    {
      label: "QA Review",
      href: "/super?view=data-collection&section=qa-review",
      active: activeView === "data-collection" && activeDCSection === "qa-review",
    },
    {
      label: "Delivery",
      href: "/super?view=data-collection&section=delivery",
      active: activeView === "data-collection" && activeDCSection === "delivery",
    },
  ];

  return (
    <SuperAdminPortal
      initialView={activeView as "overview" | "access" | "team" | "workforce" | "company" | "careers" | "data-collection"}
      initialAccessTarget={activeTarget}
      initialAccessMode={activeMode}
      initialEditingEmail={activeEditingEmail}
      initialWorkforceSection={activeWorkforceSection}
      initialDCSection={activeDCSection}
      platformSideMenuItems={superPlatformMenuItems}
    />
  );
}
