"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { usePathname, useSearchParams } from "next/navigation";

import {
  DeaimerSiteShell,
  type PlatformSideMenuItem,
} from "@/components/deaimer-site-shell";
import { GoogleRoleOnboarding } from "@/components/google-role-onboarding";
import { subscribeToAdminApproval, type AdminApprovalRecord } from "@/lib/firebase/admin-access";
import { subscribeToAdminWorkspaceProfile, type AdminWorkspaceProfile } from "@/lib/firebase/admin-workspace";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
} from "@/lib/firebase/client";
import { servicePages } from "@/lib/service-pages";

const globalWorkforceSections = [
  { label: "Job posts", section: "job-posts" },
  { label: "Candidates", section: "candidates" },
  { label: "Commissions", section: "commissions" },
] as const;

const dataCollectionSections = [
  { label: "Projects", section: "projects" },
  { label: "Speakers", section: "speakers" },
  { label: "Sessions", section: "sessions" },
  { label: "Transcription", section: "transcription" },
  { label: "QA Review", section: "qa-review" },
  { label: "Delivery", section: "delivery" },
] as const;

const evalTranscriptionSections = [
  { label: "Transcription Workers", section: "transcription-workers" },
  { label: "QA Workers", section: "qa-workers" },
] as const;

function AdminPlatformShellContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [adminApproval, setAdminApproval] = useState<AdminApprovalRecord | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminWorkspaceProfile | null>(null);
  const [adminTheme, setAdminTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const saved = localStorage.getItem("deaimer-admin-theme");
    if (saved === "dark" || saved === "light") setAdminTheme(saved);
  }, []);

  useEffect(() => {
    let isCancelled = false;
    let unsubscribeAuth: (() => void) | undefined;

    if (!isFirebaseConfigured()) {
      setIsAuthLoading(false);
      return () => undefined;
    }

    async function initializeAuth() {
      setIsAuthLoading(true);

      try {
        await ensureFirebaseAuthPersistence();
        await resolveFirebaseRedirectSignIn();
      } catch {
        // The onboarding form owns the user-facing auth error state.
      }

      if (isCancelled) {
        return;
      }

      const { auth } = getFirebaseClientServices();

      unsubscribeAuth = onAuthStateChanged(auth, (user) => {
        if (isCancelled) {
          return;
        }

        setActiveUser(user);
        setIsAuthLoading(false);
      });
    }

    void initializeAuth();

    return () => {
      isCancelled = true;
      unsubscribeAuth?.();
    };
  }, []);

  useEffect(() => {
    if (!activeUser?.email) {
      setAdminApproval(null);
      return () => undefined;
    }

    return subscribeToAdminApproval(activeUser.email, (record) => {
      setAdminApproval(record);
    });
  }, [activeUser?.email]);

  useEffect(() => {
    if (!activeUser?.uid) {
      setAdminProfile(null);
      return () => undefined;
    }

    return subscribeToAdminWorkspaceProfile(activeUser.uid, (profile) => {
      setAdminProfile(profile);
    });
  }, [activeUser?.uid]);

  const isProfilePath = pathname.startsWith("/admin/profile");
  const requestedService = isProfilePath ? "profile" : searchParams.get("service");
  const requestedSection = searchParams.get("section") ?? "job-posts";
  const isProfile = requestedService === "profile";
  const isRequests = requestedService === "requests";

  const allowedAdminServices = useMemo(
    () =>
      servicePages.filter((service) =>
        adminApproval?.servicePermissions.includes(service.slug),
      ),
    [adminApproval],
  );

  const workMenuItems: PlatformSideMenuItem[] = allowedAdminServices.flatMap((service): PlatformSideMenuItem[] => {
    if (service.slug === "global-managed-workforce") {
      return [
        { label: "Global Workforce", isSectionHeader: true } satisfies PlatformSideMenuItem,
        ...globalWorkforceSections.map((item) => ({
          label: item.label,
          href: `/admin?service=${service.slug}&section=${item.section}`,
          active: requestedService === service.slug && requestedSection === item.section,
        })),
      ];
    }

    if (service.slug === "data-collection-sourcing") {
      return [
        { label: "Data Collection", isSectionHeader: true } satisfies PlatformSideMenuItem,
        ...dataCollectionSections.map((item) => ({
          label: item.label,
          href: `/admin?service=${service.slug}&section=${item.section}`,
          active: requestedService === service.slug && requestedSection === item.section,
        })),
      ];
    }

    if (service.slug === "evaluation-transcription") {
      return [
        { label: "Evaluation & Transcription", isSectionHeader: true } satisfies PlatformSideMenuItem,
        ...evalTranscriptionSections.map((item) => ({
          label: item.label,
          href: `/admin?service=${service.slug}&section=${item.section}`,
          active: requestedService === service.slug && requestedSection === item.section,
        })),
      ];
    }

    return [
      {
        label: service.title,
        href: `/admin?service=${service.slug}`,
        active: requestedService === service.slug,
      } satisfies PlatformSideMenuItem,
    ];
  });

  const adminPlatformMenuItems: PlatformSideMenuItem[] = [
    ...workMenuItems,
    {
      label: "Personal",
      isSectionHeader: true,
    },
    {
      label: "Profile",
      href: "/admin/profile",
      active: isProfile,
    },
    {
      label: "Requests",
      isSectionHeader: true,
    },
    {
      label: "Leave",
      href: "/admin?service=requests&section=leave",
      active: isRequests && requestedSection === "leave",
    },
    {
      label: "Compensation",
      href: "/admin?service=requests&section=compensation",
      active: isRequests && requestedSection === "compensation",
    },
    {
      label: "History",
      href: "/admin?service=requests&section=history",
      active: isRequests && requestedSection === "history",
    },
  ];

  const resolvedUserProfile = activeUser
    ? {
        name:
          adminProfile?.identity.fullName ||
          activeUser.displayName ||
          activeUser.email?.split("@")[0] ||
          "Profile",
        href: "/admin/profile",
        imageUrl:
          adminProfile?.identity.profilePhotoUrl ||
          activeUser.photoURL ||
          null,
      }
    : undefined;

  function handleAdminThemeChange(theme: "light" | "dark") {
    setAdminTheme(theme);
    localStorage.setItem("deaimer-admin-theme", theme);
  }

  const adminThemeClass = adminTheme === "dark" ? "cand-dark" : "";

  function shell(content: ReactNode): ReactNode {
    const siteShell = (
      <DeaimerSiteShell
        platformSideMenuItems={activeUser && adminApproval ? adminPlatformMenuItems : undefined}
        userProfile={resolvedUserProfile}
        themeToggle={{
          theme: adminTheme,
          onToggle: () => handleAdminThemeChange(adminTheme === "dark" ? "light" : "dark"),
        }}
      >
        {content}
      </DeaimerSiteShell>
    );
    return adminThemeClass ? <div className={adminThemeClass}>{siteShell}</div> : siteShell;
  }

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panelStrong">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!activeUser) {
    return (
      <Suspense fallback={null}>
        <GoogleRoleOnboarding role="admin" />
      </Suspense>
    );
  }

  return shell(
    <Suspense fallback={null}>
      <GoogleRoleOnboarding role="admin" />
    </Suspense>,
  );
}

export function AdminPlatformShell() {
  return <AdminPlatformShellContent />;
}
