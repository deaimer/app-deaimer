"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import { AdminPortalWorkspace } from "@/components/admin-portal-workspace";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import {
  getLockedProfileEmail,
  getRoleAccessMessage,
  isEmailAllowedForRole,
  isRoleEmailLocked,
} from "@/lib/auth/access-control";
import { portalConfigs, type PortalRole } from "@/lib/auth/portal-config";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import {
  AdminApprovalRecord,
  getAdminApproval,
  subscribeToAdminApproval,
} from "@/lib/firebase/admin-access";
import {
  PortalProfile,
  PortalProfileDraft,
  createProfileDraft,
  getPortalProfile,
  savePortalProfile,
} from "@/lib/firebase/user-profiles";

interface GoogleRoleOnboardingProps {
  role: PortalRole;
}

type EmailMode = "signup" | "signin";

const emptyDraft: PortalProfileDraft = {
  fullName: "",
  email: "",
  phone: "",
  organization: "",
  contactPerson: "",
  companyWebsite: "",
  companyAddress: "",
  jobTitle: "",
  location: "",
  bio: "",
  photoUrl: "",
};

const emptyEmailForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

const fieldClassName =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100";

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.23 10.29v3.95h5.49c-.22 1.27-1.72 3.73-5.49 3.73-3.31 0-6.01-2.74-6.01-6.12s2.7-6.12 6.01-6.12c1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 6.72 2 2.25 6.48 2.25 12s4.47 10 9.98 10c5.76 0 9.58-4.05 9.58-9.75 0-.66-.07-1.17-.16-1.68h-9.42Z"
      />
      <path
        fill="#FBBC05"
        d="M3.4 7.35 6.65 9.7c.88-2.6 3.33-4.47 6.58-4.47 1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 8.39 2 5.07 4.18 3.4 7.35Z"
      />
      <path
        fill="#34A853"
        d="M12.23 22c2.58 0 4.75-.85 6.34-2.31l-2.93-2.4c-.79.55-1.82.93-3.41.93-3.69 0-6.82-2.49-7.94-5.84L1.03 14.9C2.68 19.13 7.03 22 12.23 22Z"
      />
      <path
        fill="#4285F4"
        d="M21.81 12.25c0-.66-.07-1.17-.16-1.68h-9.42v3.95h5.49c-.26 1.39-1.09 2.57-2.08 3.3l2.93 2.4c1.71-1.58 3.24-4.67 3.24-7.97Z"
      />
    </svg>
  );
}

function LoadingSpinner({
  className = "h-5 w-5 border-current border-r-transparent",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex animate-spin rounded-full border-2 ${className}`}
    />
  );
}

async function isApprovedForPortalRole(
  role: PortalRole,
  email: string | null | undefined,
) {
  if (role === "admin") {
    const approval = await getAdminApproval(email);
    return Boolean(approval);
  }

  return isEmailAllowedForRole(role, email);
}

export function GoogleRoleOnboarding({ role }: GoogleRoleOnboardingProps) {
  const config = portalConfigs[role];
  const router = useRouter();
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();
  const roleAccessMessage = getRoleAccessMessage(role);
  const isEmailLocked = isRoleEmailLocked(role);

  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [draft, setDraft] = useState<PortalProfileDraft>(emptyDraft);
  const [adminApproval, setAdminApproval] = useState<AdminApprovalRecord | null>(null);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isAdminApprovalLoading, setIsAdminApprovalLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isRouteAuthorized, setIsRouteAuthorized] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [emailMode, setEmailMode] = useState<EmailMode>("signup");

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (!firebaseReady) {
      setAuthReady(true);
      setIsAuthResolving(false);
      return;
    }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      setAuthReady(false);
      setIsAuthResolving(true);

      try {
        await ensureFirebaseAuthPersistence();
        await resolveFirebaseRedirectSignIn();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Google sign in did not complete. Please try again.",
          );
        }
      }

      if (cancelled) {
        return;
      }

      const { auth } = getFirebaseClientServices();

      unsubscribe = onAuthStateChanged(auth, (user) => {
        void (async () => {
          let isAllowed = true;

          try {
            isAllowed = user
              ? await isApprovedForPortalRole(role, user.email)
              : true;
          } catch (error) {
            if (cancelled) {
              return;
            }

            setActiveUser(user);
            setIsRouteAuthorized(true);
            setAuthReady(true);
            setIsAuthResolving(false);
            setIsSigningIn(false);
            setErrorMessage(
              error instanceof Error
                ? error.message
                : "We could not verify this account right now.",
            );
            setSuccessMessage(null);
            return;
          }

          if (cancelled) {
            return;
          }

          if (user && !isAllowed) {
            setActiveUser(user);
            setIsRouteAuthorized(false);
            setAuthReady(true);
            setIsAuthResolving(false);
            setIsSigningIn(false);
            setErrorMessage(
              `Signed in as ${user.email ?? "this Google account"}, but it is not approved for the ${config.label.toLowerCase()} portal.`,
            );
            setSuccessMessage(null);
            return;
          }

          setActiveUser(user);
          setIsRouteAuthorized(true);
          setAuthReady(true);
          setIsAuthResolving(false);
          setIsSigningIn(false);

          if (user) {
            setErrorMessage(null);
          }

          setSuccessMessage(null);
        })();
      });
    }

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [config.label, firebaseReady, hasMounted, role]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (!firebaseReady || !activeUser || !isRouteAuthorized) {
      setProfile(null);
      setDraft(activeUser ? createProfileDraft(activeUser, role) : emptyDraft);
      setIsEditing(false);
      return;
    }

    let cancelled = false;
    const currentUser = activeUser;

    async function loadProfile() {
      setIsProfileLoading(true);
      setErrorMessage(null);

      try {
        const existingProfile = await getPortalProfile(currentUser.uid, role);

        if (cancelled) {
          return;
        }

        setProfile(existingProfile);
        setDraft(
          existingProfile ?? {
            ...createProfileDraft(currentUser, role),
            email: getLockedProfileEmail(role, currentUser.email),
          },
        );
        setIsEditing(!existingProfile);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "We could not load your profile right now.",
        );
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [activeUser, firebaseReady, hasMounted, isRouteAuthorized, role]);

  useEffect(() => {
    if (
      role !== "admin" ||
      !hasMounted ||
      !firebaseReady ||
      !activeUser ||
      !isRouteAuthorized
    ) {
      setAdminApproval(null);
      setIsAdminApprovalLoading(false);
      return;
    }

    setIsAdminApprovalLoading(true);
    const unsubscribe = subscribeToAdminApproval(
      activeUser.email,
      (record) => {
        setAdminApproval(record);
        setIsAdminApprovalLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsAdminApprovalLoading(false);
      },
    );

    return unsubscribe;
  }, [activeUser, firebaseReady, hasMounted, isRouteAuthorized, role]);

  function handleInputChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleGoogleSignIn() {
    if (!firebaseReady) {
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign in did not complete. Please try again.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseReady) {
      return;
    }

    const email = emailForm.email.trim().toLowerCase();

    if (!email || !emailForm.password) {
      setErrorMessage("Enter your email and password first.");
      return;
    }

    if (emailMode === "signup" && emailForm.password !== emailForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsEmailBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { auth } = getFirebaseClientServices();
      if (emailMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, emailForm.password);
      } else {
        await signInWithEmailAndPassword(auth, email, emailForm.password);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Email authentication did not complete. Please try again.",
      );
    } finally {
      setIsEmailBusy(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeUser) {
      setErrorMessage("Please sign in with Google before saving your profile.");
      return;
    }

    const submittedDraft = {
      ...draft,
      email: getLockedProfileEmail(role, activeUser.email) || draft.email,
    };

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedProfile = await savePortalProfile(activeUser, role, submittedDraft);
      setProfile(savedProfile);
      setDraft(savedProfile ?? submittedDraft);
      setIsEditing(false);
      setSuccessMessage(
        `${config.label} profile saved. You can come back and update it any time.`,
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save your profile right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSignOut() {
    if (!firebaseReady) {
      return;
    }

    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setProfile(null);
    setAdminApproval(null);
    setDraft(emptyDraft);
    setIsEditing(false);
    setIsRouteAuthorized(true);
    setSuccessMessage(null);
    if (role === "admin") {
      router.replace("/admin");
    }
  }

  const summaryItems = [
    {
      label: "Name",
      value: profile?.fullName || "Not set",
    },
    {
      label: isEmailLocked ? "Approved email" : "Profile email",
      value: profile?.email || activeUser?.email || "Not set",
    },
    {
      label: "Organization",
      value: profile?.organization || "Not set",
    },
    {
      label: "Location",
      value: profile?.location || "Not set",
    },
  ];

  if (hasMounted && activeUser && !isRouteAuthorized) {
    return (
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto grid min-h-screen max-w-6xl gap-10 px-4 py-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_440px] lg:items-center lg:px-10">
          <section className="max-w-xl">
            <a
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary"
            >
              <span aria-hidden="true">&lt;</span>
              Back to Deaimer
            </a>

            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.28em] text-primarySoft">
              {config.eyebrow}
            </p>

            <h1 className="mt-4 text-4xl font-semibold leading-[1.02] text-ink sm:text-5xl">
              This account is signed in, but not allowed here
            </h1>

            <p className="mt-5 text-base leading-8 text-muted sm:text-lg">
              You are still signed in as <span className="font-semibold text-ink">{activeUser.email}</span>.
              This route is restricted to accounts approved for the {config.label.toLowerCase()} portal.
            </p>

            <p className="mt-4 text-sm leading-7 text-muted">{config.helper}</p>
          </section>

          <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Access denied
            </p>

            <h2 className="mt-3 text-2xl font-semibold text-ink">
              Stay signed in or switch accounts
            </h2>

            {errorMessage ? (
              <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm leading-7 text-muted">
              Your session is still active. If you need to try another Google
              account, sign out below and continue again.
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Sign out
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (hasMounted && activeUser && role === "admin") {
    return (
      <AdminPortalWorkspace
        activeUser={activeUser}
        basePortalProfile={profile}
        adminApproval={adminApproval}
        isAdminApprovalLoading={isAdminApprovalLoading}
        errorMessage={errorMessage}
        successMessage={successMessage}
        onErrorChange={setErrorMessage}
        onSuccessChange={setSuccessMessage}
      />
    );
  }

  if (!hasMounted || !authReady || isAuthResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panelStrong">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!activeUser) {
    return (
      <PlatformAuthPage
        title={emailMode === "signup" ? "Create your account" : "Sign in to your account"}
        email={emailForm.email}
        password={emailForm.password}
        confirmPassword={emailMode === "signup" ? emailForm.confirmPassword : undefined}
        passwordAutocomplete={emailMode === "signup" ? "new-password" : "current-password"}
        submitLabel={emailMode === "signup" ? "Create account" : "Sign in"}
        isSubmitting={isEmailBusy || isSigningIn || isAuthResolving}
        notice={
          !hasMounted
            ? "Preparing portal..."
            : !firebaseReady
              ? (
                  <>
                    <span className="font-semibold">Firebase setup needed</span>
                    <span className="mt-1 block">{firebaseConfigError}</span>
                  </>
                )
              : isAuthResolving
                ? "Restoring your session..."
                : roleAccessMessage
        }
        errorMessage={errorMessage}
        successMessage={successMessage}
        oauthAction={
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady}
            className="inline-flex w-full items-center justify-center gap-3 rounded-[10px] border border-[#e5ecf3] bg-white px-4 py-[13px] text-sm font-semibold text-[#0a1628] transition hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn || isAuthResolving ? <LoadingSpinner className="h-4 w-4" /> : <GoogleMark />}
            {isSigningIn
              ? "Opening Google..."
              : isAuthResolving
                ? "Finishing sign in..."
                : "Continue with Google"}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => setEmailMode(emailMode === "signup" ? "signin" : "signup")}
            className="text-[13px] font-medium text-[#2b85f0] transition hover:text-[#1f6dd1] hover:underline"
          >
            {emailMode === "signup" ? "Already have an account?" : "Create an account"}
          </button>
        }
        onEmailChange={(value) => setEmailForm((current) => ({ ...current, email: value }))}
        onPasswordChange={(value) => setEmailForm((current) => ({ ...current, password: value }))}
        onConfirmPasswordChange={(value) =>
          setEmailForm((current) => ({ ...current, confirmPassword: value }))
        }
        onSubmit={handleEmailAuth}
      />
    );
  }

  return (
    <main className="flex min-h-[70vh] items-center justify-center bg-background px-6 py-12 sm:px-10">
      <div className="w-full max-w-[440px]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">
          {config.eyebrow}
        </p>

        <h2 className="mt-2 text-2xl font-bold text-ink">
          {activeUser ? `${config.label} profile` : config.title}
        </h2>

        {!activeUser ? (
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{config.description}</p>
        ) : null}

        <div className="mt-7 rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-panel sm:p-8">

          {!hasMounted ? (
            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
              Preparing portal...
            </div>
          ) : null}

          {hasMounted && !firebaseReady ? (
            <div className="mt-5 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-950">
              <p className="font-semibold text-ink">Firebase setup needed</p>
              <p className="mt-2">{firebaseConfigError}</p>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {hasMounted && isAuthResolving && !activeUser ? (
            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <div className="flex items-center gap-3 text-sm leading-7 text-muted">
                <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                <span>Restoring your Google session...</span>
              </div>
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
              {successMessage}
            </div>
          ) : null}

          {hasMounted && !activeUser ? (
            <div className="mt-5">
              <p className="text-sm leading-7 text-muted">
                Sign in with Google to start your {config.label.toLowerCase()} profile.
              </p>

              <button
                type="button"
                onClick={() => void handleGoogleSignIn()}
                disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSigningIn || isAuthResolving ? <LoadingSpinner /> : <GoogleMark />}
                {isSigningIn
                  ? "Opening Google..."
                  : isAuthResolving
                    ? "Finishing sign in..."
                    : "Continue with Google"}
              </button>
            </div>
          ) : null}

          {hasMounted && activeUser ? (
            <div className="mt-5 space-y-6">
              <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-panelStrong p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {draft.photoUrl ? (
                      <Image
                        src={draft.photoUrl}
                        alt={draft.fullName || activeUser.displayName || "Signed in user"}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-semibold text-primary">
                        {(draft.fullName || activeUser.displayName || "D")
                          .slice(0, 1)
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {activeUser.displayName || "Google account"}
                    </p>
                    <p className="truncate text-xs text-muted">{activeUser.email}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSignOut()}
                  className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-muted transition hover:text-ink"
                >
                  Sign out
                </button>
              </div>

              {isProfileLoading ? (
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
                  Loading your profile...
                </div>
              ) : null}

              {!isProfileLoading && profile && !isEditing ? (
                <div className="space-y-5">
                  <div>
                    <p className="text-sm leading-7 text-muted">
                      Your profile is saved. You can update it any time.
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    {summaryItems.map((item) => (
                      <div
                        key={item.label}
                        className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4"
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primarySoft">
                          {item.label}
                        </p>
                        <p className="mt-2 text-sm font-semibold text-ink">
                          {item.value}
                        </p>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsEditing(true)}
                    className="inline-flex w-full items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:border-primary/20 hover:bg-primary/5"
                  >
                    Edit profile
                  </button>
                </div>
              ) : null}

              {!isProfileLoading && (!profile || isEditing) ? (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Full name
                      </span>
                      <input
                        name="fullName"
                        value={draft.fullName}
                        onChange={handleInputChange}
                        required
                        className={fieldClassName}
                        placeholder="Your full name"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        {isEmailLocked ? "Approved email" : "Profile email"}
                      </span>
                      <input
                        name="email"
                        type="email"
                        value={draft.email}
                        onChange={handleInputChange}
                        required
                        disabled={isEmailLocked}
                        className={fieldClassName}
                        placeholder="you@company.com"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Organization
                      </span>
                      <input
                        name="organization"
                        value={draft.organization}
                        onChange={handleInputChange}
                        className={fieldClassName}
                        placeholder="Company or team name"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Job title
                      </span>
                      <input
                        name="jobTitle"
                        value={draft.jobTitle}
                        onChange={handleInputChange}
                        className={fieldClassName}
                        placeholder="Operations manager"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Phone
                      </span>
                      <input
                        name="phone"
                        value={draft.phone}
                        onChange={handleInputChange}
                        className={fieldClassName}
                        placeholder="+1 555 000 0000"
                      />
                    </label>

                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Location
                      </span>
                      <input
                        name="location"
                        value={draft.location}
                        onChange={handleInputChange}
                        className={fieldClassName}
                        placeholder="City, country"
                      />
                    </label>

                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-ink">
                        Bio
                      </span>
                      <textarea
                        name="bio"
                        value={draft.bio}
                        onChange={handleInputChange}
                        rows={5}
                        className={`${fieldClassName} min-h-[140px] resize-y`}
                        placeholder="Short introduction"
                      />
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSaving}
                    className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSaving ? "Saving profile..." : "Save profile"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
