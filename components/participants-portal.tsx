"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { DeaimerSiteShell, type PlatformSideMenuItem } from "@/components/deaimer-site-shell";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import { countryOptions, phoneCountryCodes } from "@/lib/candidates/portal-data";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import {
  PortalProfile,
  PortalProfileDraft,
  createProfileDraft,
  deletePortalProfile,
  getPortalProfile,
  savePortalProfile,
} from "@/lib/firebase/user-profiles";
import {
  VIDEO_SCHEDULE_SLOTS,
  VideoProjectParticipant,
  getVideoSlot,
  saveMyVideoAvailability,
  subscribeToMyVideoAssignments,
  type VideoProject,
} from "@/lib/firebase/video-collection";

type ParticipantView = "home" | "projects" | "profile" | "settings";
type EmailMode = "signup" | "signin";

const emptyEmailForm = { email: "", password: "", confirmPassword: "" };
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

const fieldClass =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100";

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

function ParticipantProfileForm({
  draft,
  profile,
  activeUser,
  isSaving,
  showSummary,
  onChange,
  onSubmit,
  onEdit,
}: {
  draft: PortalProfileDraft;
  profile?: PortalProfile | null;
  activeUser?: User | null;
  isSaving: boolean;
  showSummary?: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onEdit?: () => void;
}) {
  const [country = "", city = ""] = draft.location.split(" | ");
  const [phoneCode = "+1", phoneNumber = ""] = draft.phone.split(" ");
  const profilePreviewName = draft.fullName || profile?.fullName || activeUser?.displayName || "Participant";

  if (showSummary && profile) {
    const [profileCountry = "", profileCity = ""] = profile.location.split(" | ");

    return (
      <div className="space-y-5">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                {profile.photoUrl ? (
                  <Image
                    src={profile.photoUrl}
                    alt={profile.fullName || profilePreviewName}
                    fill
                    sizes="96px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                    {(profile.fullName || profilePreviewName).slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>

              <div className="min-w-0">
                <h3 className="text-2xl font-semibold text-ink">
                  {profile.fullName || "Participant"}
                </h3>
                <p className="mt-2 text-sm text-muted">
                  {profile.email || activeUser?.email || "No email added"}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
            >
              Edit profile
            </button>
          </div>
        </div>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 shadow-panel">
          <p className="text-sm font-semibold text-ink">Identity</p>
          <dl className="mt-3">
            {[
              ["Full name", profile.fullName || "Not added"],
              ["Email", profile.email || activeUser?.email || "Not added"],
              ["Country", profileCountry || "Not added"],
              ["City", profileCity || "Not added"],
              ["Phone", profile.phone || "Not added"],
              ["Headline", profile.jobTitle || "Not added"],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[140px_1fr] gap-4 border-t border-slate-100 py-3 first:border-t-0">
                <dt className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{label}</dt>
                <dd className="min-w-0 break-words text-sm font-medium text-ink">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Profile</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Participant profile</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Add the basic details needed for scheduling and project placement.
        </p>
      </section>

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
            {draft.photoUrl ? (
              <Image
                src={draft.photoUrl}
                alt={profilePreviewName}
                fill
                sizes="96px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                {profilePreviewName.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-ink">Profile picture</p>
            <p className="mt-2 text-sm leading-7 text-muted">
              Add a clear headshot or keep your Google photo URL.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Full name</span>
            <input name="fullName" value={draft.fullName} onChange={onChange} required className={fieldClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Email</span>
            <input name="email" type="email" value={draft.email} onChange={onChange} required className={fieldClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Country</span>
            <select
              value={country}
              onChange={(event) =>
                onChange({
                  target: { name: "location", value: `${event.target.value} | ${city}` },
                } as ChangeEvent<HTMLSelectElement>)
              }
              required
              className={fieldClass}
            >
              <option value="">Select country</option>
              {countryOptions.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">City</span>
            <input
              value={city}
              onChange={(event) =>
                onChange({
                  target: { name: "location", value: `${country} | ${event.target.value}` },
                } as ChangeEvent<HTMLInputElement>)
              }
              required
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">WhatsApp code</span>
            <select
              value={phoneCode}
              onChange={(event) =>
                onChange({
                  target: { name: "phone", value: `${event.target.value} ${phoneNumber}` },
                } as ChangeEvent<HTMLSelectElement>)
              }
              className={fieldClass}
            >
              {phoneCountryCodes.map((item) => (
                <option key={item.code} value={item.code}>{item.label}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">WhatsApp number</span>
            <input
              value={phoneNumber}
              onChange={(event) =>
                onChange({
                  target: { name: "phone", value: `${phoneCode} ${event.target.value}` },
                } as ChangeEvent<HTMLInputElement>)
              }
              required
              className={fieldClass}
            />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Headline</span>
            <input name="jobTitle" value={draft.jobTitle} onChange={onChange} placeholder="Participant / speaker" className={fieldClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Photo URL</span>
            <input name="photoUrl" value={draft.photoUrl} onChange={onChange} placeholder="https://..." className={fieldClass} />
          </label>
          <label className="md:col-span-2">
            <span className="mb-2 block text-sm font-medium text-ink">Bio / notes</span>
            <textarea name="bio" value={draft.bio} onChange={onChange} rows={5} className={fieldClass} />
          </label>
        </div>
        <button disabled={isSaving} className="mt-5 w-full rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Saving profile..." : "Save profile"}
        </button>
      </section>
    </form>
  );
}

function ParticipantScheduleWorkspace({
  user,
  profile,
  assignments,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }>;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState(assignments[0]?.project.id ?? "");
  const [selectedSlotIds, setSelectedSlotIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selectedAssignment = assignments.find((item) => item.project.id === selectedProjectId) ?? assignments[0] ?? null;

  useEffect(() => {
    if (!selectedAssignment) return;
    setSelectedProjectId(selectedAssignment.project.id);
    setSelectedSlotIds(selectedAssignment.participant.selectedSlotIds);
    setNotes(selectedAssignment.participant.schedulingNotes);
  }, [selectedAssignment?.project.id]);

  function toggleSlot(slotId: string) {
    setSelectedSlotIds((current) =>
      current.includes(slotId) ? current.filter((id) => id !== slotId) : [...current, slotId],
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedAssignment) return;

    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      await saveMyVideoAvailability({
        projectId: selectedAssignment.project.id,
        participantId: selectedAssignment.participant.id,
        uid: user.uid,
        fullName: profile.fullName,
        email: profile.email || user.email || "",
        selectedSlotIds,
        schedulingNotes: notes,
      });
      setMessage("Availability saved for this video collection project.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save availability.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!selectedAssignment) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <h1 className="text-3xl font-semibold text-ink">Scheduling</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          No video collection project has been assigned to you yet.
        </p>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Scheduling</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Book your video slot</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Select every slot you can attend. Once a partner speaker is assigned,
          the client/admin will finalize the meeting URL.
        </p>
      </section>

      {message ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}
      {error ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

      <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">Assigned projects</h2>
          <div className="mt-4 space-y-2">
            {assignments.map((assignment) => (
              <button
                key={assignment.project.id}
                type="button"
                onClick={() => setSelectedProjectId(assignment.project.id)}
                className={[
                  "w-full rounded-[1rem] border px-4 py-3 text-left text-sm",
                  selectedProjectId === assignment.project.id
                    ? "border-primary bg-primary/5 text-ink"
                    : "border-slate-200 bg-panelStrong text-muted",
                ].join(" ")}
              >
                <span className="block font-semibold">{assignment.project.title}</span>
                <span className="mt-1 block text-xs">{assignment.participant.selectedSlotIds.length} slots submitted</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-ink">{selectedAssignment.project.title}</h2>
          <p className="mt-3 text-sm leading-7 text-muted">{selectedAssignment.project.jobDescription || "Project details will be shared by the team."}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {VIDEO_SCHEDULE_SLOTS.map((slot) => {
              const selected = selectedSlotIds.includes(slot.id);
              return (
                <button
                  key={slot.id}
                  type="button"
                  onClick={() => toggleSlot(slot.id)}
                  className={[
                    "min-h-[104px] rounded-[1rem] border px-4 py-4 text-left text-sm transition",
                    selected
                      ? "border-primary bg-primary/5 text-ink"
                      : "border-slate-200 bg-panelStrong text-muted hover:bg-white",
                  ].join(" ")}
                >
                  <span className="block font-semibold text-ink">{slot.label}</span>
                  <span className="mt-2 block text-xs">{selected ? "Selected" : "Available"}</span>
                </button>
              );
            })}
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={4}
            placeholder="Notes for the scheduler"
            className="mt-5 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button disabled={isSaving || selectedSlotIds.length === 0} className="mt-4 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">
            {isSaving ? "Saving..." : "Confirm availability"}
          </button>
        </div>
      </section>
    </form>
  );
}

function ParticipantProjectsView({
  user,
  profile,
  assignments,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }>;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  const selectedAssignment = assignments.find((a) => a.project.id === selectedProjectId) ?? null;

  if (selectedAssignment) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => setSelectedProjectId(null)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to projects
        </button>
        <ParticipantScheduleWorkspace user={user} profile={profile} assignments={[selectedAssignment]} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Participant workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Projects</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Video collection projects assigned to you appear here. Click a project to submit your availability.
        </p>
      </section>

      {assignments.length === 0 ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm leading-7 text-muted">
          No projects have been assigned to you yet. Check back soon.
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ project, participant }) => (
            <button
              key={project.id}
              type="button"
              onClick={() => setSelectedProjectId(project.id)}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-primary/40 hover:shadow-panel"
            >
              <p className="font-semibold text-ink">{project.title}</p>
              <p className="mt-2 text-xs text-muted">
                {participant.selectedSlotIds.length > 0
                  ? `${participant.selectedSlotIds.length} slots submitted`
                  : "Availability not submitted yet"}
              </p>
              <span className="mt-3 inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                Open →
              </span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

export function ParticipantsPortal() {
  const searchParams = useSearchParams();
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();
  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<PortalProfile | null>(null);
  const [draft, setDraft] = useState<PortalProfileDraft>(emptyDraft);
  const [activeView, setActiveView] = useState<ParticipantView>("home");
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [emailMode, setEmailMode] = useState<EmailMode>("signin");
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [assignments, setAssignments] = useState<Array<{ project: VideoProject; participant: VideoProjectParticipant }>>([]);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    const savedTheme = window.localStorage.getItem("deaimer-participant-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (searchParams.get("projects") === "1") {
      setActiveView("projects");
      return;
    }

    if (searchParams.get("profile") === "1") {
      setActiveView("profile");
      return;
    }

    if (searchParams.get("settings") === "1") {
      setActiveView("settings");
      return;
    }

    setActiveView("home");
  }, [searchParams]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady) {
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function init() {
      await ensureFirebaseAuthPersistence();
      await resolveFirebaseRedirectSignIn();
      const { auth } = getFirebaseClientServices();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (cancelled) return;
        setActiveUser(user);
        setAuthReady(true);
      });
    }

    void init().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Could not initialize sign in.");
      setAuthReady(true);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseReady, hasMounted]);

  useEffect(() => {
    if (!activeUser || !firebaseReady) {
      setProfile(null);
      return;
    }

    let cancelled = false;
    void getPortalProfile(activeUser.uid, "participants")
      .then((existing) => {
        if (cancelled) return;
        setProfile(existing);
        setDraft(existing ?? createProfileDraft(activeUser, "participants"));
        setIsEditingProfile(!existing);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not load profile."));

    return () => {
      cancelled = true;
    };
  }, [activeUser, firebaseReady]);

  useEffect(() => {
    if (!activeUser || !profile) {
      setAssignments([]);
      return () => undefined;
    }

    return subscribeToMyVideoAssignments(
      activeUser.uid,
      activeUser.email,
      setAssignments,
      (nextError) => setError(nextError.message),
    );
  }, [activeUser, profile]);

  const menuItems: PlatformSideMenuItem[] = [
    { label: "Workspace", isSectionHeader: true },
    { label: "Projects", href: "/participants?projects=1", active: activeView === "projects" },
    { label: "Other", isSectionHeader: true },
    { label: "Profile", href: "/participants?profile=1", active: activeView === "profile" },
    { label: "Settings", href: "/participants?settings=1", active: activeView === "settings" },
  ];

  function changeTheme(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    window.localStorage.setItem("deaimer-participant-theme", nextTheme);
  }

  function onDraftChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function onEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseReady) return;
    setIsAuthBusy(true);
    setError(null);

    try {
      const { auth } = getFirebaseClientServices();
      const email = emailForm.email.trim().toLowerCase();
      if (emailMode === "signup") {
        if (emailForm.password !== emailForm.confirmPassword) throw new Error("Passwords do not match.");
        await createUserWithEmailAndPassword(auth, email, emailForm.password);
      } else {
        await signInWithEmailAndPassword(auth, email, emailForm.password);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Email sign in failed.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function onGoogle() {
    if (!firebaseReady) return;
    setIsAuthBusy(true);
    setError(null);
    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Google sign in failed.");
    } finally {
      setIsAuthBusy(false);
    }
  }

  async function onProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeUser) return;

    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const saved = await savePortalProfile(activeUser, "participants", draft);
      setProfile(saved);
      if (saved) setDraft(saved);
      setIsEditingProfile(false);
      setActiveView("home");
      setMessage("Profile saved.");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not save profile.");
    } finally {
      setIsSaving(false);
    }
  }

  async function onSignOut() {
    if (!firebaseReady) return;
    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setActiveUser(null);
    setProfile(null);
    setAssignments([]);
  }

  async function onDeleteProfile() {
    if (!activeUser || !profile) {
      return;
    }

    const confirmed = window.confirm(
      "Delete your participant profile and scheduling account data? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProfile(true);
    setError(null);
    setMessage(null);

    try {
      await deletePortalProfile(activeUser.uid, "participants");
      const { auth } = getFirebaseClientServices();
      setProfile(null);
      setDraft(createProfileDraft(activeUser, "participants"));
      setAssignments([]);
      setIsEditingProfile(false);
      await signOut(auth);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not delete your participant profile.");
    } finally {
      setIsDeletingProfile(false);
    }
  }

  if (!hasMounted || !authReady) {
    return <div className="flex min-h-screen items-center justify-center bg-panelStrong"><div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>;
  }

  if (!activeUser) {
    return (
      <PlatformAuthPage
        title={emailMode === "signup" ? "Create your participant account" : "Sign in as participant"}
        email={emailForm.email}
        password={emailForm.password}
        confirmPassword={emailMode === "signup" ? emailForm.confirmPassword : undefined}
        submitLabel={emailMode === "signup" ? "Create account" : "Sign in"}
        isSubmitting={isAuthBusy}
        notice={!firebaseReady ? firebaseConfigError : "Use Google or email/password to continue."}
        errorMessage={error}
        successMessage={message}
        oauthAction={<button type="button" onClick={() => void onGoogle()} className="inline-flex w-full items-center justify-center gap-3 rounded-[10px] border border-[#e5ecf3] bg-white px-4 py-[13px] text-sm font-semibold text-[#0a1628]"><GoogleMark />Continue with Google</button>}
        secondaryAction={<button type="button" onClick={() => setEmailMode(emailMode === "signup" ? "signin" : "signup")} className="text-[13px] font-medium text-[#2b85f0]">{emailMode === "signup" ? "Already have an account?" : "Create an account"}</button>}
        onEmailChange={(value) => setEmailForm((current) => ({ ...current, email: value }))}
        onPasswordChange={(value) => setEmailForm((current) => ({ ...current, password: value }))}
        onConfirmPasswordChange={(value) => setEmailForm((current) => ({ ...current, confirmPassword: value }))}
        onSubmit={onEmailAuth}
      />
    );
  }

  if (!profile) {
    return (
      <main className="min-h-screen bg-background px-4 py-8 text-ink sm:px-8">
        <div className="mx-auto max-w-6xl">
          {error ? <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
          <ParticipantProfileForm
            draft={draft}
            activeUser={activeUser}
            isSaving={isSaving}
            onChange={onDraftChange}
            onSubmit={onProfileSubmit}
          />
        </div>
      </main>
    );
  }

  const content = (
    <DeaimerSiteShell
      platformSideMenuItems={menuItems.map((item) => ({
        ...item,
        active: item.active,
      }))}
      userProfile={{ name: profile.fullName || activeUser.email || "Participant", href: "/participants", imageUrl: profile.photoUrl || activeUser.photoURL }}
      onSignOut={() => void onSignOut()}
      themeToggle={{ theme, onToggle: () => changeTheme(theme === "dark" ? "light" : "dark") }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-10 sm:px-6 lg:px-8">
        {error ? <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
        {message ? <div className="mb-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

        {activeView === "home" ? (
          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Participant home</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">Welcome, {profile.fullName}</h1>
              <p className="mt-4 text-sm leading-7 text-muted">
                Your assigned video collection projects and scheduling tasks will appear here.
              </p>
            </section>
            <section className="grid gap-4 md:grid-cols-3">
              {[
                ["Assigned projects", assignments.length],
                ["Availability submitted", assignments.filter((item) => item.participant.selectedSlotIds.length > 0).length],
                ["Open scheduling tasks", assignments.filter((item) => item.participant.selectedSlotIds.length === 0).length],
              ].map(([label, value]) => (
                <article key={label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
                  <p className="mt-3 text-3xl font-semibold text-ink">{String(value).padStart(2, "0")}</p>
                </article>
              ))}
            </section>
          </div>
        ) : null}

        {activeView === "projects" ? <ParticipantProjectsView user={activeUser} profile={profile} assignments={assignments} /> : null}
        {activeView === "profile" ? (
          <ParticipantProfileForm
            draft={draft}
            profile={profile}
            activeUser={activeUser}
            isSaving={isSaving}
            showSummary={!isEditingProfile}
            onEdit={() => {
              if (profile) setDraft(profile);
              setIsEditingProfile(true);
              setError(null);
              setMessage(null);
            }}
            onChange={onDraftChange}
            onSubmit={onProfileSubmit}
          />
        ) : null}
        {activeView === "settings" ? (
          <div className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Settings</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">Account settings</h1>
              <p className="mt-4 text-sm leading-7 text-muted">
                Manage your participant account preferences and data.
              </p>
            </section>

            <div className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-panel">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                  {theme === "dark" ? "D" : "L"}
                </span>
                <div>
                  <p className="text-sm font-semibold text-ink">Appearance</p>
                  <p className="text-xs text-muted">{theme === "dark" ? "Dark mode" : "Light mode"}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => changeTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
              >
                {theme === "dark" ? "Switch to Light" : "Switch to Dark"}
              </button>
            </div>

            <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6">
              <p className="text-sm font-semibold text-rose-800">Delete account</p>
              <p className="mt-2 text-sm leading-6 text-rose-700">
                Permanently remove your participant profile and account data. This cannot be undone.
              </p>
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => void onDeleteProfile()}
                  disabled={isDeletingProfile}
                  className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingProfile ? "Deleting..." : "Delete account"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </DeaimerSiteShell>
  );

  return theme === "dark" ? <div className="cand-dark">{content}</div> : content;
}
