"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import {
  ClientApprovalRecord,
  getClientApproval,
} from "@/lib/firebase/client-access";
import {
  PortalProfile,
  PortalProfileDraft,
  createProfileDraft,
  getPortalProfile,
  savePortalProfile,
} from "@/lib/firebase/user-profiles";

type EmailMode = "signup" | "signin";
type ClientView = "overview" | "data" | "projects" | "requests" | "profile" | "settings";

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

const clientNavItems: Array<{
  id: ClientView;
  label: string;
  shortLabel: string;
}> = [
  { id: "overview", label: "Overview", shortLabel: "OV" },
  { id: "data", label: "Data", shortLabel: "DT" },
  { id: "projects", label: "Projects", shortLabel: "PR" },
  { id: "requests", label: "Requests", shortLabel: "RQ" },
  { id: "profile", label: "Profile", shortLabel: "PF" },
  { id: "settings", label: "Settings", shortLabel: "ST" },
];

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path fill="#EA4335" d="M12.23 10.29v3.95h5.49c-.22 1.27-1.72 3.73-5.49 3.73-3.31 0-6.01-2.74-6.01-6.12s2.7-6.12 6.01-6.12c1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 6.72 2 2.25 6.48 2.25 12s4.47 10 9.98 10c5.76 0 9.58-4.05 9.58-9.75 0-.66-.07-1.17-.16-1.68h-9.42Z" />
      <path fill="#FBBC05" d="M3.4 7.35 6.65 9.7c.88-2.6 3.33-4.47 6.58-4.47 1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 8.39 2 5.07 4.18 3.4 7.35Z" />
      <path fill="#34A853" d="M12.23 22c2.58 0 4.75-.85 6.34-2.31l-2.93-2.4c-.79.55-1.82.93-3.41.93-3.69 0-6.82-2.49-7.94-5.84L1.03 14.9C2.68 19.13 7.03 22 12.23 22Z" />
      <path fill="#4285F4" d="M21.81 12.25c0-.66-.07-1.17-.16-1.68h-9.42v3.95h5.49c-.26 1.39-1.09 2.57-2.08 3.3l2.93 2.4c1.71-1.58 3.24-4.67 3.24-7.97Z" />
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

function ClientWorkspacePanel({
  view,
  profile,
  approval,
  onOpenProfile,
}: {
  view: Exclude<ClientView, "profile">;
  profile: PortalProfile;
  approval: ClientApprovalRecord | null;
  onOpenProfile: () => void;
}) {
  if (view === "overview") {
    const overviewCards = [
      {
        label: "Company",
        value: profile.organization || approval?.company || "Not set",
        detail: "Primary client organization for this workspace.",
      },
      {
        label: "Projects",
        value: "03",
        detail: "Placeholder count for active client projects.",
      },
      {
        label: "Data batches",
        value: "12",
        detail: "Placeholder count for uploaded or requested datasets.",
      },
      {
        label: "Open requests",
        value: "04",
        detail: "Placeholder count for current support and delivery requests.",
      },
    ];

    return (
      <div className="space-y-6">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
            Client workspace
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-[-0.03em] text-ink sm:text-4xl">
            Welcome to your client dashboard
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
            This area can be used for project oversight, dataset requests,
            delivery tracking, and communication with the Deaimer team.
          </p>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <article
              key={card.label}
              className="rounded-[1.25rem] border border-slate-200 bg-white p-5"
            >
              <p className="text-xs uppercase tracking-[0.22em] text-muted">
                {card.label}
              </p>
              <p className="mt-3 text-2xl font-semibold text-ink">{card.value}</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                {card.detail}
              </p>
            </article>
          ))}
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">
              Account
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">
              Client profile
            </h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Name
                </p>
                <p className="mt-2 text-ink">{profile.fullName || "Not set"}</p>
              </div>
              <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Email
                </p>
                <p className="mt-2 break-all text-ink">{profile.email || "Not set"}</p>
              </div>
              <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Organization
                </p>
                <p className="mt-2 text-ink">{profile.organization || "Not set"}</p>
              </div>
              <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                <p className="text-xs uppercase tracking-[0.16em] text-muted">
                  Job title
                </p>
                <p className="mt-2 text-ink">{profile.jobTitle || "Not set"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
            <p className="text-xs uppercase tracking-[0.22em] text-muted">
              Quick actions
            </p>
            <div className="mt-5 space-y-3">
              {[
                "Create a new project request",
                "Upload a data brief",
                "Review delivery status",
                "Open company profile",
              ].map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={action === "Open company profile" ? onOpenProfile : undefined}
                  className="flex w-full items-center justify-between rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-left text-sm text-ink transition hover:bg-slate-100"
                >
                  <span>{action}</span>
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  const viewContent: Record<
    Exclude<ClientView, "overview" | "profile">,
    { title: string; intro: string; items: string[] }
  > = {
    data: {
      title: "Data",
      intro:
        "This section can hold datasets, upload batches, file reviews, and delivery history for your account.",
      items: [
        "Dataset upload area",
        "Approved file library",
        "Delivery history",
      ],
    },
    projects: {
      title: "Projects",
      intro:
        "This section can track active projects, milestones, timelines, and assigned delivery teams.",
      items: [
        "Active project list",
        "Milestones and deadlines",
        "Project notes and scope changes",
      ],
    },
    requests: {
      title: "Requests",
      intro:
        "This section can be used for new annotation requests, revisions, support tickets, and follow-ups.",
      items: [
        "New request form",
        "Revision queue",
        "Support conversation history",
      ],
    },
    settings: {
      title: "Settings",
      intro:
        "This section can manage account details, contacts, billing references, and access preferences.",
      items: [
        "Client profile settings",
        "Contact and billing details",
        "Access and notification preferences",
      ],
    },
  };

  const current = viewContent[view];

  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
      <p className="text-xs uppercase tracking-[0.22em] text-muted">
        Workspace
      </p>
      <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
        {current.title}
      </h1>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
        {current.intro}
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {current.items.map((item) => (
          <div
            key={item}
            className="rounded-[1rem] border border-slate-200 bg-panelStrong p-5"
          >
            <p className="text-lg font-semibold text-ink">{item}</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              Placeholder block ready for the next workflow module.
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClientProfilePanel({
  draft,
  profile,
  isSaving,
  errorMessage,
  successMessage,
  onChange,
  onSubmit,
}: {
  draft: PortalProfileDraft;
  profile: PortalProfile;
  isSaving: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const previewImage = draft.photoUrl || profile.googlePhotoUrl || "";

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-muted">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink sm:text-4xl">
          Company profile
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted sm:text-base">
          Update your client record here. Add your company details, main contact
          information, and a profile image for this workspace.
        </p>
      </section>

      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      <form onSubmit={onSubmit} className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <p className="text-xs uppercase tracking-[0.22em] text-muted">Image</p>
          <div className="mt-5 flex flex-col items-center rounded-[1.5rem] border border-slate-200 bg-panelStrong px-5 py-6 text-center">
            <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white">
              {previewImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewImage}
                  alt={draft.fullName || "Client profile"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-2xl font-semibold text-muted">
                  {(draft.organization || draft.fullName || "C").slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <p className="mt-4 text-sm font-semibold text-ink">
              {draft.organization || "Client workspace"}
            </p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Add a photo URL for your company or profile image. Your Google image
              is used automatically until you replace it here.
            </p>
          </div>

          <label className="mt-5 block">
            <span className="mb-2 block text-sm text-muted">Photo URL</span>
            <input
              name="photoUrl"
              type="url"
              value={draft.photoUrl}
              onChange={onChange}
              placeholder="https://..."
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
            />
          </label>
        </section>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm text-muted">Company name</span>
              <input
                name="organization"
                value={draft.organization}
                onChange={onChange}
                placeholder="Company name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Primary contact person</span>
              <input
                name="contactPerson"
                value={draft.contactPerson}
                onChange={onChange}
                placeholder="Primary contact"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Full name</span>
              <input
                name="fullName"
                value={draft.fullName}
                onChange={onChange}
                required
                placeholder="Your full name"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Job title</span>
              <input
                name="jobTitle"
                value={draft.jobTitle}
                onChange={onChange}
                placeholder="Role or title"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Contact email</span>
              <input
                name="email"
                type="email"
                value={draft.email}
                onChange={onChange}
                required
                placeholder="name@company.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Phone</span>
              <input
                name="phone"
                value={draft.phone}
                onChange={onChange}
                placeholder="Phone number"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Company website</span>
              <input
                name="companyWebsite"
                type="url"
                value={draft.companyWebsite}
                onChange={onChange}
                placeholder="https://company.com"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm text-muted">Location</span>
              <input
                name="location"
                value={draft.location}
                onChange={onChange}
                placeholder="City, country"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>
          </div>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-muted">Company address</span>
            <input
              name="companyAddress"
              value={draft.companyAddress}
              onChange={onChange}
              placeholder="Office address"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
            />
          </label>

          <label className="mt-4 block">
            <span className="mb-2 block text-sm text-muted">Company notes</span>
            <textarea
              name="bio"
              rows={6}
              value={draft.bio}
              onChange={onChange}
              placeholder="Add company background, project needs, preferred contacts, or onboarding notes"
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
            />
          </label>

          <div className="mt-5 flex justify-end">
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving profile..." : "Save profile"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

export function ClientAuthPortal() {
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();
  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [approval, setApproval] = useState<ClientApprovalRecord | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [isClientApproved, setIsClientApproved] = useState(true);
  const [draft, setDraft] = useState<PortalProfileDraft>(emptyDraft);
  const [emailMode, setEmailMode] = useState<EmailMode>("signup");
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeView, setActiveView] = useState<ClientView>("overview");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) return;
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
              : "Google sign in did not complete.",
          );
        }
      }

      if (cancelled) {
        return;
      }

      const { auth } = getFirebaseClientServices();

      unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (cancelled) {
          return;
        }

        if (!user) {
          setActiveUser(null);
          setApproval(null);
          setIsClientApproved(true);
          setAuthReady(true);
          setIsAuthResolving(false);
          setIsSigningIn(false);
          return;
        }

        try {
          const nextApproval = await getClientApproval(user.email);

          if (cancelled) {
            return;
          }

          if (!nextApproval) {
            setActiveUser(user);
            setApproval(null);
            setIsClientApproved(false);
            setAuthReady(true);
            setIsAuthResolving(false);
            setIsSigningIn(false);
            setErrorMessage(
              "This email is not approved for the client portal yet. Please ask Deaimer to add it from `/super` first.",
            );
            return;
          }

          setActiveUser(user);
          setApproval(nextApproval);
          setIsClientApproved(true);
          setAuthReady(true);
          setIsAuthResolving(false);
          setIsSigningIn(false);
          setErrorMessage(null);
        } catch (error) {
          if (cancelled) {
            return;
          }

          setActiveUser(user);
          setAuthReady(true);
          setIsAuthResolving(false);
          setIsSigningIn(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not verify client access.",
          );
        }
      });
    }

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseReady, hasMounted]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady || !activeUser) {
      setProfile(null);
      setDraft(activeUser ? createProfileDraft(activeUser, "clients") : emptyDraft);
      setIsEditing(false);
      return;
    }
    let cancelled = false;
    const currentUser = activeUser;
    async function loadProfile() {
      setIsProfileLoading(true);
      try {
        const existing = await getPortalProfile(currentUser.uid, "clients");
        if (cancelled) return;
        setProfile(existing);
        setDraft(existing ?? { ...createProfileDraft(currentUser, "clients"), organization: approval?.company ?? "" });
        setIsEditing(!existing);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(error instanceof Error ? error.message : "We could not load your profile.");
        }
      } finally {
        if (!cancelled) setIsProfileLoading(false);
      }
    }
    void loadProfile();
    return () => {
      cancelled = true;
    };
  }, [activeUser, approval, firebaseReady, hasMounted]);

  function onDraftChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  function onEmailFormChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setEmailForm((current) => ({ ...current, [name]: value }));
  }

  async function onGoogle() {
    if (!firebaseReady) return;
    setIsSigningIn(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Google sign in did not complete.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function onEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseReady) return;
    const email = emailForm.email.trim().toLowerCase();
    if (!email) {
      setErrorMessage("Enter an approved client email.");
      return;
    }
    if (!emailForm.password) {
      setErrorMessage("Enter a password.");
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
      const nextApproval = await getClientApproval(email);
      if (!nextApproval) {
        setIsClientApproved(false);
        setErrorMessage("This email is not approved for the client portal yet. Ask Deaimer to add it from `/super` first.");
        return;
      }

      await ensureFirebaseAuthPersistence();
      const { auth } = getFirebaseClientServices();
      const credential = emailMode === "signup"
        ? await createUserWithEmailAndPassword(auth, email, emailForm.password)
        : await signInWithEmailAndPassword(auth, email, emailForm.password);
      setActiveUser(credential.user);
      setApproval(nextApproval);
      setIsClientApproved(true);
      setEmailForm(emptyEmailForm);
      setSuccessMessage(emailMode === "signup" ? "Client account created. You can now complete your profile." : "Signed in successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Email authentication failed.");
    } finally {
      setIsEmailBusy(false);
    }
  }

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const saved = await savePortalProfile(activeUser, "clients", draft);
      setProfile(saved);
      setDraft(saved ?? draft);
      setIsEditing(false);
      setSuccessMessage("Client profile saved successfully.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "We could not save your profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onSignOut() {
    if (!firebaseReady) return;
    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setActiveUser(null);
    setApproval(null);
    setIsClientApproved(true);
    setProfile(null);
    setDraft(emptyDraft);
    setIsEditing(false);
    setActiveView("overview");
    setSuccessMessage(null);
  }

  if (hasMounted && activeUser && !isClientApproved) {
    return (
      <main className="relative min-h-screen overflow-hidden bg-background text-ink">
        <div className="pointer-events-none absolute inset-0 bg-grid" />
        <div className="pointer-events-none absolute inset-0 bg-noise" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-4 py-8 sm:px-6 lg:px-10">
          <div className="grid gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <section className="section-shell p-6 sm:p-8 lg:p-10">
              <p className="section-kicker">Client access</p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                This account is signed in, but not approved
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted sm:text-lg">
                You are still signed in as <span className="font-semibold text-ink">{activeUser.email}</span>.
                Ask Deaimer to add this email from `/super`, then come back here.
              </p>
            </section>

            <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
              {errorMessage ? (
                <div className="rounded-[1rem] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-900">
                  {errorMessage}
                </div>
              ) : null}

              <div className={errorMessage ? "mt-5" : ""}>
                <p className="text-sm leading-7 text-muted">
                  Your session is still active. If you want to try another account,
                  sign out first.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void onSignOut()}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  if (hasMounted && activeUser && profile && !isEditing) {
    return (
      <main className="min-h-screen bg-background text-ink">
        <div className="relative flex min-h-screen">
          <aside
            className={[
              "border-r border-slate-200 bg-white transition-all duration-300",
              sidebarCollapsed ? "w-[88px]" : "w-[252px]",
            ].join(" ")}
          >
            <div className="flex h-full flex-col px-3 py-4">
              <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-3 py-3">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-muted">
                    Deaimer
                  </p>
                  {!sidebarCollapsed ? (
                    <p className="truncate text-lg font-semibold text-ink">Client</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => setSidebarCollapsed((current) => !current)}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-muted transition hover:bg-panelStrong hover:text-ink"
                  aria-label="Toggle sidebar"
                >
                  {sidebarCollapsed ? "→" : "←"}
                </button>
              </div>

              <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white px-3 py-3">
                <p className="text-[11px] uppercase tracking-[0.22em] text-muted">
                  Client account
                </p>
                <p className="mt-2 text-sm font-semibold text-ink">
                  {profile.fullName || activeUser.displayName || "Client"}
                </p>
                {!sidebarCollapsed ? (
                  <p className="mt-1 break-all text-xs leading-6 text-muted">
                    {profile.organization || approval?.company || activeUser.email}
                  </p>
                ) : null}
              </div>

              <nav className="mt-4 flex-1 space-y-2">
                {clientNavItems.map((item) => {
                  const isActive = item.id === activeView;

                  return (
                    <button
                      key={item.id}
                    type="button"
                    onClick={() => setActiveView(item.id)}
                    className={[
                      "flex w-full items-center gap-3 rounded-[1rem] border px-3 py-3 text-left transition",
                      isActive
                        ? "border-slate-300 bg-panelStrong text-ink"
                        : "border-slate-200 bg-white text-muted hover:bg-panelStrong hover:text-ink",
                    ].join(" ")}
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-panelStrong text-xs font-semibold uppercase tracking-[0.12em] text-ink">
                      {item.shortLabel}
                    </span>
                    {!sidebarCollapsed ? (
                      <span className="block text-sm font-semibold">{item.label}</span>
                    ) : null}
                    </button>
                  );
                })}
              </nav>

              <button
                type="button"
                onClick={() => void onSignOut()}
                className="mt-4 inline-flex items-center justify-center rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-muted transition hover:bg-panelStrong hover:text-ink"
              >
                {sidebarCollapsed ? "⎋" : "Sign out"}
              </button>
            </div>
          </aside>

          <div className="flex-1">
            <header className="border-b border-slate-200 bg-background px-4 py-4 sm:px-6 lg:px-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                    Client Portal
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">
                    {clientNavItems.find((item) => item.id === activeView)?.label}
                  </h2>
                </div>

                <div className="flex flex-wrap gap-3">
                  <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-ink">
                    {approval?.email || activeUser.email}
                  </span>
                </div>
              </div>
            </header>

            <div className="px-4 py-6 sm:px-6 lg:px-8">
              {activeView === "profile" ? (
                <ClientProfilePanel
                  draft={draft}
                  profile={profile}
                  isSaving={isSaving}
                  errorMessage={errorMessage}
                  successMessage={successMessage}
                  onChange={onDraftChange}
                  onSubmit={onProfileSubmit}
                />
              ) : (
                <ClientWorkspacePanel
                  view={activeView}
                  profile={profile}
                  approval={approval}
                  onOpenProfile={() => setActiveView("profile")}
                />
              )}
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-ink">
      <div className="pointer-events-none absolute inset-0 bg-grid" />
      <div className="pointer-events-none absolute inset-0 bg-noise" />
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-8 sm:px-6 lg:px-10">
        <div className="flex items-center justify-between gap-4">
          <a href="/" className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary-soft"><span aria-hidden="true">←</span>Back to Deaimer</a>
          <span className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-primary">Clients</span>
        </div>
        <div className="grid flex-1 gap-8 pb-10 pt-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <section className="section-shell p-6 sm:p-8 lg:p-10">
            <p className="section-kicker">Client access</p>
            <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">Client sign-up for approved organizations</h1>
            <p className="mt-6 max-w-2xl text-base leading-8 text-muted sm:text-lg">Clients must be approved first from the super admin panel. Once an email is approved, that client can create an account here using Google or email/password.</p>
          </section>
          <section className="glass-panel rounded-[1.75rem] p-6 sm:p-8">
            {!hasMounted ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-5 text-sm text-muted">Preparing client sign-up...</div> : null}
            {hasMounted && !firebaseReady ? <div className="rounded-[1rem] border border-amber-300/20 bg-amber-400/10 p-5 text-sm leading-7 text-amber-900"><p className="font-semibold text-ink">Firebase setup needed</p><p className="mt-2">{firebaseConfigError}</p></div> : null}
            {errorMessage ? <div className="rounded-[1rem] border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-900">{errorMessage}</div> : null}
            {successMessage ? <div className="mt-3 rounded-[1rem] border border-emerald-300/20 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-900">{successMessage}</div> : null}
            {hasMounted && !activeUser ? (
              <div className={errorMessage || successMessage ? "mt-5 space-y-5" : "space-y-5"}>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                  <p className="text-sm uppercase tracking-[0.2em] text-muted">Google sign-up</p>
                  {isAuthResolving ? (
                    <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <div className="flex items-center gap-3 text-sm leading-7 text-muted">
                        <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                        <span>Restoring your Google session...</span>
                      </div>
                    </div>
                  ) : null}
                  <button type="button" onClick={() => void onGoogle()} disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady} className="mt-5 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">{isSigningIn || isAuthResolving ? <LoadingSpinner /> : <GoogleMark />}{isSigningIn ? "Opening Google..." : isAuthResolving ? "Finishing sign in..." : "Continue with Google"}</button>
                </div>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                  <div className="flex items-center gap-2 rounded-full bg-panelStrong p-1">
                    <button type="button" onClick={() => setEmailMode("signup")} className={["flex-1 rounded-full px-4 py-2 text-sm font-semibold transition", emailMode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted"].join(" ")}>Email sign-up</button>
                    <button type="button" onClick={() => setEmailMode("signin")} className={["flex-1 rounded-full px-4 py-2 text-sm font-semibold transition", emailMode === "signin" ? "bg-white text-ink shadow-sm" : "text-muted"].join(" ")}>Email sign-in</button>
                  </div>
                  <form onSubmit={onEmailAuth} className="mt-5 space-y-4">
                    <input name="email" type="email" value={emailForm.email} onChange={onEmailFormChange} required placeholder="Approved client email" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" />
                    <input name="password" type="password" value={emailForm.password} onChange={onEmailFormChange} required placeholder="Password" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" />
                    {emailMode === "signup" ? <input name="confirmPassword" type="password" value={emailForm.confirmPassword} onChange={onEmailFormChange} required placeholder="Confirm password" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /> : null}
                    <button type="submit" disabled={isEmailBusy} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-panelStrong px-5 py-3.5 text-sm font-semibold text-ink transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60">{isEmailBusy ? "Checking access..." : emailMode === "signup" ? "Create account with email" : "Sign in with email"}</button>
                  </form>
                </div>
              </div>
            ) : null}
            {hasMounted && activeUser ? (
              <div className={errorMessage || successMessage ? "mt-5 space-y-5" : "space-y-5"}>
                <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
                  <p className="text-sm uppercase tracking-[0.18em] text-muted">Signed in</p>
                  <p className="mt-2 text-lg font-semibold text-ink">{activeUser.displayName || approval?.contactName || "Client account"}</p>
                  <p className="mt-1 text-sm text-muted">{activeUser.email}</p>
                  {approval ? <p className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-ink">{approval.company || "Approved organization"}</p> : null}
                  <div className="mt-5 flex flex-wrap gap-3">
                    {profile && !isEditing ? <button type="button" onClick={() => setIsEditing(true)} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">Edit profile</button> : null}
                    <button type="button" onClick={() => void onSignOut()} className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-muted transition hover:bg-panelStrong hover:text-ink">Sign out</button>
                  </div>
                </div>
                {isProfileLoading ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-5 text-sm text-muted">Loading your client profile...</div> : null}
                {!isProfileLoading && profile && !isEditing ? <div className="rounded-[1.25rem] border border-slate-200 bg-white p-6"><p className="text-sm uppercase tracking-[0.18em] text-muted">Profile ready</p><h2 className="mt-3 text-2xl font-semibold text-ink">Your client profile is active</h2><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-slate-200 bg-panelStrong p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Name</p><p className="mt-2 text-ink">{profile.fullName || "Not set"}</p></div><div className="rounded-xl border border-slate-200 bg-panelStrong p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Email</p><p className="mt-2 text-ink">{profile.email || "Not set"}</p></div><div className="rounded-xl border border-slate-200 bg-panelStrong p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Organization</p><p className="mt-2 text-ink">{profile.organization || "Not set"}</p></div><div className="rounded-xl border border-slate-200 bg-panelStrong p-4"><p className="text-xs uppercase tracking-[0.16em] text-muted">Access status</p><p className="mt-2 text-ink">Approved client</p></div></div></div> : null}
                {!isProfileLoading && (!profile || isEditing) ? <form onSubmit={onProfileSubmit} className="space-y-4"><input name="fullName" value={draft.fullName} onChange={onDraftChange} required placeholder="Full name" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="email" type="email" value={draft.email} onChange={onDraftChange} required placeholder="Profile email" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="phone" value={draft.phone} onChange={onDraftChange} placeholder="Phone" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="organization" value={draft.organization} onChange={onDraftChange} placeholder="Organization" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="jobTitle" value={draft.jobTitle} onChange={onDraftChange} placeholder="Job title" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="location" value={draft.location} onChange={onDraftChange} placeholder="Location" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><input name="photoUrl" type="url" value={draft.photoUrl} onChange={onDraftChange} placeholder="Photo URL" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><textarea name="bio" value={draft.bio} onChange={onDraftChange} rows={5} placeholder="Notes about your company or project" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary" /><button type="submit" disabled={isSaving} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">{isSaving ? "Saving profile..." : "Save profile"}</button></form> : null}
              </div>
            ) : null}
          </section>
        </div>
      </div>
    </main>
  );
}
