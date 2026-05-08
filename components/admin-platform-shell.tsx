"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
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

function AdminPlatformShellContent() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [adminApproval, setAdminApproval] = useState<AdminApprovalRecord | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminWorkspaceProfile | null>(null);

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

  const workMenuItems: PlatformSideMenuItem[] = allowedAdminServices.map((service) => {
    if (service.slug === "global-managed-workforce") {
      const isGlobal = requestedService === service.slug;

      return {
        label: service.title,
        href: `/admin?service=${service.slug}&section=job-posts`,
        active: isGlobal,
        children: globalWorkforceSections.map((item) => ({
          label: item.label,
          href: `/admin?service=${service.slug}&section=${item.section}`,
          active: isGlobal && requestedSection === item.section,
        })),
      };
    }

    return {
      label: service.title,
      href: `/admin?service=${service.slug}`,
      active: requestedService === service.slug,
    };
  });

  const adminPlatformMenuItems: PlatformSideMenuItem[] = [
    ...(workMenuItems.length > 0
      ? [
          {
            label: "Work",
            isSectionHeader: true,
          } satisfies PlatformSideMenuItem,
          ...workMenuItems,
        ]
      : []),
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
      href: "/admin?service=requests&section=leave",
      active: isRequests,
      children: [
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
      ],
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

  return (
    <DeaimerSiteShell
      platformSideMenuItems={activeUser && adminApproval ? adminPlatformMenuItems : undefined}
      userProfile={resolvedUserProfile}
    >
      <Suspense fallback={null}>
        <GoogleRoleOnboarding role="admin" />
      </Suspense>
    </DeaimerSiteShell>
  );
}

export function AdminPlatformShell() {
  return <AdminPlatformShellContent />;
}
