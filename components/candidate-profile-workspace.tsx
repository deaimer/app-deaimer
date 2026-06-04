"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
  useEffect,
  useState,
} from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { onAuthStateChanged, type User } from "firebase/auth";

import {
  getFirebaseClientServices,
  isFirebaseConfigured,
} from "@/lib/firebase/client";
import {
  candidateAvailabilityOptions,
  candidateCommonLanguages,
  candidateEmploymentStatusOptions,
  candidateJobTypeOptions,
  candidateLanguageProficiencyOptions,
  candidateWorkTypeOptions,
  createCandidateProfileDraft,
  deleteCandidateProfileResume,
  saveCandidateProfile,
  subscribeToCandidateProfile,
  uploadCandidateProfileResume,
  type CandidateLanguageEntry,
  type CandidateProfile,
  type CandidateProfileDraft,
} from "@/lib/firebase/candidate-portal";
import { countryOptions, phoneCountryCodes } from "@/lib/candidates/portal-data";
import {
  DeaimerSiteShell,
  type PlatformSideMenuItem,
} from "@/components/deaimer-site-shell";

// ─── constants ───────────────────────────────────────────────────────────────

type CandidateProfileSectionKey =
  | "identity"
  | "professional"
  | "skills"
  | "links"
  | "preferences"
  | "documents";

const profileSections: Array<{
  key: CandidateProfileSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: "identity",
    label: "Identity",
    description: "Your name, photo, contact details, location, and date of birth.",
  },
  {
    key: "professional",
    label: "Professional",
    description: "Headline, bio, experience level, and current availability.",
  },
  {
    key: "skills",
    label: "Skills",
    description: "Technical and domain skills plus languages you speak.",
  },
  {
    key: "links",
    label: "Links",
    description: "LinkedIn, GitHub, portfolio, or personal website.",
  },
  {
    key: "preferences",
    label: "Preferences",
    description: "Preferred work type, job type, and relocation openness.",
  },
  {
    key: "documents",
    label: "Documents",
    description: "Upload your resume or CV for job applications.",
  },
];

const candidateMenuItems: PlatformSideMenuItem[] = [
  { label: "Work", isSectionHeader: true },
  {
    label: "Jobs",
    href: "/candidates/jobs",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    label: "Applications",
    href: "/candidates/applications",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Saved roles",
    href: "/candidates/saved-roles",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    ),
  },
  { label: "Personal", isSectionHeader: true },
  {
    label: "Profile",
    href: "/candidates/profile",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/candidates/settings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

const fieldClassName =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary";

const emptyDraft: CandidateProfileDraft = {
  candidateDisplayId: "",
  fullName: "",
  email: "",
  country: "",
  city: "",
  phoneCountryCode: "+1",
  phoneNumber: "",
  dateOfBirth: "",
  photoUrl: "",
  headline: "",
  bio: "",
  yearsOfExperience: "",
  employmentStatus: "",
  availability: "",
  skills: [],
  languages: [],
  linkedinUrl: "",
  githubUrl: "",
  websiteUrl: "",
  preferredWorkType: "",
  preferredJobType: "",
  openToRelocation: false,
  openToCrowdWork: true,
  profileResume: null,
};

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

// ─── small shared components ─────────────────────────────────────────────────

function LoadingSpinner({ className = "h-5 w-5 border-current border-r-transparent" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex animate-spin rounded-full border-2 ${className}`}
    />
  );
}

function ProfileInfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 last:border-b-0">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 break-words text-muted">{value || "Not added"}</dd>
    </div>
  );
}

function ProfileInfoSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={defaultOpen} className="group rounded-xl border border-slate-200 bg-white px-5 py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
        {title}
        <span className="text-base text-muted transition group-open:rotate-180">▾</span>
      </summary>
      <dl className="mt-3">{children}</dl>
    </details>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-semibold text-ink">{title}</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  );
}

function SkillTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-panelStrong px-3 py-1.5 text-sm font-medium text-ink">
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted transition hover:text-rose-600"
        aria-label={`Remove ${label}`}
      >
        ×
      </button>
    </span>
  );
}

// ─── photo resize helper ──────────────────────────────────────────────────────

async function resizeProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("Could not read image."));
        return;
      }
      const img = new window.Image();
      img.onload = () => {
        const maxSize = 320;
        const scale = Math.min(maxSize / img.width, maxSize / img.height, 1);
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) { reject(new Error("Could not prepare image.")); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = () => reject(new Error("Could not load image."));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error("Could not read image."));
    reader.readAsDataURL(file);
  });
}

// ─── section normaliser ───────────────────────────────────────────────────────

function normalizeSection(value: string | null): CandidateProfileSectionKey {
  return profileSections.find((s) => s.key === value)?.key ?? "identity";
}

// ─── main component ───────────────────────────────────────────────────────────

function CandidateProfileWorkspaceContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isEditMode = pathname.startsWith("/candidates/profile/edit");
  const currentSection = normalizeSection(searchParams.get("section"));

  const [activeUser, setActiveUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<CandidateProfile | null | undefined>(undefined);
  const [draft, setDraft] = useState<CandidateProfileDraft>(emptyDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [skillInput, setSkillInput] = useState("");
  const [candidateTheme, setCandidateTheme] = useState<"light" | "dark">("light");

  // Theme — load from localStorage
  useEffect(() => {
    const stored = window.localStorage.getItem("deaimer-candidate-theme");
    if (stored === "dark" || stored === "light") setCandidateTheme(stored);
  }, []);

  function handleThemeChange(theme: "light" | "dark") {
    setCandidateTheme(theme);
    window.localStorage.setItem("deaimer-candidate-theme", theme);
  }

  // Auth
  useEffect(() => {
    if (!isFirebaseConfigured()) { setActiveUser(null); return () => undefined; }
    const { auth } = getFirebaseClientServices();
    return onAuthStateChanged(auth, (user) => setActiveUser(user));
  }, []);

  // Redirect if not logged in
  useEffect(() => {
    if (activeUser === null) router.replace("/candidates");
  }, [activeUser, router]);

  // Profile subscription
  useEffect(() => {
    if (!activeUser) return () => undefined;
    return subscribeToCandidateProfile(
      activeUser.uid,
      (loaded) => {
        setProfile(loaded);
        if (loaded) {
          setDraft(loaded);
        } else {
          setDraft(createCandidateProfileDraft(activeUser));
          router.replace("/candidates/profile/edit?section=identity");
        }
      },
    );
  }, [activeUser, router]);

  // ── navigation helpers ─────────────────────────────────────────────────────

  function goToSection(section: CandidateProfileSectionKey) {
    router.replace(`/candidates/profile/edit?section=${section}`);
  }

  function goToView() {
    router.replace("/candidates/profile");
  }

  function goToEdit(section: CandidateProfileSectionKey = currentSection) {
    router.replace(`/candidates/profile/edit?section=${section}`);
    setErrorMessage(null);
    setSuccessMessage(null);
  }

  // ── draft helpers ─────────────────────────────────────────────────────────

  function handleFieldChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) {
    const { name, value, type } = event.target;
    setDraft((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? (event.target as HTMLInputElement).checked : value,
    }));
  }

  function addSkill(raw: string) {
    const skill = raw.trim();
    if (!skill || draft.skills.includes(skill)) return;
    setDraft((prev) => ({ ...prev, skills: [...prev.skills, skill] }));
  }

  function removeSkill(index: number) {
    setDraft((prev) => ({ ...prev, skills: prev.skills.filter((_, i) => i !== index) }));
  }

  function handleSkillKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addSkill(skillInput);
      setSkillInput("");
    }
  }

  function addLanguage() {
    setDraft((prev) => ({
      ...prev,
      languages: [...prev.languages, { language: "", proficiency: "Fluent" }],
    }));
  }

  function updateLanguage(index: number, field: keyof CandidateLanguageEntry, value: string) {
    setDraft((prev) => ({
      ...prev,
      languages: prev.languages.map((entry, i) =>
        i === index ? { ...entry, [field]: value } : entry,
      ),
    }));
  }

  function removeLanguage(index: number) {
    setDraft((prev) => ({ ...prev, languages: prev.languages.filter((_, i) => i !== index) }));
  }

  // ── photo upload ──────────────────────────────────────────────────────────

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setIsUploadingPhoto(true);
    setErrorMessage(null);
    try {
      const photoUrl = await resizeProfileImage(file);
      setDraft((prev) => ({ ...prev, photoUrl }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not upload photo.");
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  // ── resume upload ─────────────────────────────────────────────────────────

  async function handleResumeChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !activeUser) return;

    setIsUploadingResume(true);
    setErrorMessage(null);

    try {
      const previousResume = draft.profileResume;
      const uploaded = await uploadCandidateProfileResume(activeUser, file);
      const nextDraft = { ...draft, profileResume: uploaded };
      setDraft(nextDraft);

      // auto-save resume metadata immediately
      await saveCandidateProfile(activeUser, nextDraft);
      if (previousResume?.filePath) await deleteCandidateProfileResume(previousResume);
      setSuccessMessage("Resume uploaded.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not upload resume.");
    } finally {
      setIsUploadingResume(false);
    }
  }

  async function handleResumeRemove() {
    if (!activeUser || !draft.profileResume) return;
    setIsUploadingResume(true);
    setErrorMessage(null);
    try {
      const previous = draft.profileResume;
      const nextDraft = { ...draft, profileResume: null };
      setDraft(nextDraft);
      await saveCandidateProfile(activeUser, nextDraft);
      await deleteCandidateProfileResume(previous);
      setSuccessMessage("Resume removed.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not remove resume.");
    } finally {
      setIsUploadingResume(false);
    }
  }

  // ── save ──────────────────────────────────────────────────────────────────

  async function handleSave(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (!activeUser) return;
    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await saveCandidateProfile(activeUser, draft);
      setSuccessMessage("Profile saved.");
      goToView();
    } catch {
      setErrorMessage("Could not save your profile. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  // ── theme shell helper ────────────────────────────────────────────────────

  const themeClass = candidateTheme === "dark" ? "cand-dark" : "";

  function shell(content: ReactNode): ReactNode {
    const themeToggle = {
      theme: candidateTheme,
      onToggle: () => handleThemeChange(candidateTheme === "dark" ? "light" : "dark"),
    };
    const siteShell = (
      <DeaimerSiteShell
        platformSideMenuItems={candidateMenuItems}
        userProfile={shellUserProfile}
        themeToggle={themeToggle}
      >
        {content}
      </DeaimerSiteShell>
    );
    return themeClass ? <div className={themeClass}>{siteShell}</div> : siteShell;
  }

  // ── derived values ────────────────────────────────────────────────────────

  const previewName = draft.fullName || profile?.fullName || activeUser?.displayName || "Candidate";
  const shellUserProfile = activeUser
    ? {
        name: profile?.fullName || activeUser.displayName || activeUser.email?.split("@")[0] || "Candidate",
        href: "/candidates/profile",
        imageUrl: profile?.photoUrl || activeUser.photoURL,
      }
    : undefined;

  // ── loading state ─────────────────────────────────────────────────────────

  if (activeUser === undefined || profile === undefined) {
    return shell(
      <main className="min-h-screen bg-background">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-muted">
              <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
              <span>Loading your profile...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ── tab bar (edit mode) ────────────────────────────────────────────────────

  const tabBar = (
    <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-panelStrong p-1">
      {profileSections.map((section) => {
        const isActive = currentSection === section.key;
        return (
          <button
            key={section.key}
            type="button"
            onClick={() => goToSection(section.key)}
            className={[
              "rounded-xl px-4 py-2.5 text-sm font-semibold transition",
              isActive ? "bg-white text-ink shadow-sm" : "text-muted hover:bg-white/80 hover:text-ink",
            ].join(" ")}
          >
            {section.label}
          </button>
        );
      })}
    </div>
  );

  const saveActions = (
    <>
      <button
        type="button"
        onClick={goToView}
        className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
      >
        View profile
      </button>
      <button
        type="button"
        onClick={() => void handleSave()}
        disabled={isSaving || isUploadingPhoto}
        className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSaving ? <LoadingSpinner /> : null}
        {isSaving ? "Saving..." : "Save profile"}
      </button>
    </>
  );

  const feedback = (
    <>
      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}
      {successMessage ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {successMessage}
        </div>
      ) : null}
    </>
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW MODE
  // ═══════════════════════════════════════════════════════════════════════════

  if (!isEditMode && profile) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6 lg:px-10">

            {/* Identity strip */}
            <section className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                    {profile.photoUrl ? (
                      <Image src={profile.photoUrl} alt={profile.fullName || "Candidate"} fill sizes="64px" className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-primary">
                        {(profile.fullName || "C").slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-2xl font-semibold text-ink">
                      {profile.fullName || "Candidate"}
                    </h1>
                    {profile.headline ? (
                      <p className="mt-0.5 text-sm text-primarySoft font-medium">{profile.headline}</p>
                    ) : null}
                    <p className="mt-1 text-sm text-muted">
                      {profile.email || activeUser?.email || "No email"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => goToEdit("identity")}
                  className="inline-flex shrink-0 items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                >
                  Edit profile
                </button>
              </div>
            </section>

            {feedback}

            {/* Accordion sections */}
            <div className="space-y-3">
              <ProfileInfoSection title="Identity" defaultOpen>
                <ProfileInfoLine label="Full name" value={profile.fullName} />
                <ProfileInfoLine label="Email" value={profile.email || activeUser?.email || ""} />
                <ProfileInfoLine label="Country" value={profile.country} />
                <ProfileInfoLine label="City" value={profile.city} />
                <ProfileInfoLine
                  label="Phone"
                  value={profile.phoneNumber ? `${profile.phoneCountryCode} ${profile.phoneNumber}` : ""}
                />
                <ProfileInfoLine label="Date of birth" value={profile.dateOfBirth} />
              </ProfileInfoSection>

              <ProfileInfoSection title="Professional">
                <ProfileInfoLine label="Headline" value={profile.headline} />
                <ProfileInfoLine label="Bio" value={profile.bio} />
                <ProfileInfoLine label="Experience" value={profile.yearsOfExperience ? `${profile.yearsOfExperience} years` : ""} />
                <ProfileInfoLine label="Status" value={profile.employmentStatus} />
                <ProfileInfoLine label="Availability" value={profile.availability} />
              </ProfileInfoSection>

              <ProfileInfoSection title="Skills & Languages">
                <ProfileInfoLine
                  label="Skills"
                  value={profile.skills.length > 0 ? profile.skills.join(", ") : ""}
                />
                <ProfileInfoLine
                  label="Languages"
                  value={
                    profile.languages.length > 0
                      ? profile.languages.map((l) => `${l.language} (${l.proficiency})`).join(", ")
                      : ""
                  }
                />
              </ProfileInfoSection>

              <ProfileInfoSection title="Links">
                <ProfileInfoLine label="LinkedIn" value={profile.linkedinUrl} />
                <ProfileInfoLine label="GitHub / Portfolio" value={profile.githubUrl} />
                <ProfileInfoLine label="Website" value={profile.websiteUrl} />
              </ProfileInfoSection>

              <ProfileInfoSection title="Preferences">
                <ProfileInfoLine label="Work type" value={profile.preferredWorkType} />
                <ProfileInfoLine label="Job type" value={profile.preferredJobType} />
                <ProfileInfoLine label="Open to relocation" value={profile.openToRelocation ? "Yes" : "No"} />
                <div className="grid gap-1 border-b border-slate-100 py-3 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4 last:border-b-0">
                  <dt className="font-semibold text-ink">Crowd Work</dt>
                  <dd className="min-w-0">
                    {profile.openToCrowdWork ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">Opted in</span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-muted">Not opted in</span>
                    )}
                  </dd>
                </div>
              </ProfileInfoSection>

              <ProfileInfoSection title="Documents">
                {profile.profileResume?.fileUrl ? (
                  <div className="py-2">
                    <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">{profile.profileResume.fileName}</p>
                        <p className="mt-0.5 text-xs text-emerald-700">{formatFileSize(profile.profileResume.sizeBytes)}</p>
                      </div>
                      <a
                        href={profile.profileResume.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                      >
                        View
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="py-2">
                    <p className="text-sm text-muted">No resume uploaded.</p>
                    <button
                      type="button"
                      onClick={() => goToEdit("documents")}
                      className="mt-2 text-sm font-semibold text-primary transition hover:text-primaryStrong"
                    >
                      Upload resume →
                    </button>
                  </div>
                )}
              </ProfileInfoSection>
            </div>
          </div>
        </main>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // EDIT MODE
  // ═══════════════════════════════════════════════════════════════════════════

  return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-10 sm:px-6 lg:px-10">

          <div className="flex flex-wrap justify-end gap-3">{saveActions}</div>

          {tabBar}
          {feedback}

          {/* ── Identity ──────────────────────────────────────────────────── */}
          {currentSection === "identity" ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              {/* Photo */}
              <section className="rounded-[1.25rem] border border-slate-200 bg-panelStrong p-5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {draft.photoUrl ? (
                      <Image src={draft.photoUrl} alt={previewName} fill sizes="96px" className="object-cover" unoptimized />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                        {previewName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink">Profile picture</p>
                    <p className="mt-1 text-sm leading-7 text-muted">Add a clear headshot or keep your Google photo.</p>
                    <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
                      <input type="file" accept="image/*" onChange={(e) => void handlePhotoChange(e)} className="sr-only" />
                      {isUploadingPhoto ? "Uploading..." : "Upload photo"}
                    </label>
                  </div>
                </div>
              </section>

              {/* Fields */}
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Full name</span>
                    <input name="fullName" value={draft.fullName} onChange={handleFieldChange} placeholder="Your full name" required className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Email</span>
                    <input name="email" type="email" value={draft.email} onChange={handleFieldChange} placeholder="your@email.com" required className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Country</span>
                    <select name="country" value={draft.country} onChange={handleFieldChange} required className={fieldClassName}>
                      <option value="">Select country</option>
                      {countryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">City</span>
                    <input name="city" value={draft.city} onChange={handleFieldChange} placeholder="Your city" required className={fieldClassName} />
                  </label>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-ink">Phone number</span>
                    <div className="flex gap-2">
                      <select name="phoneCountryCode" value={draft.phoneCountryCode} onChange={handleFieldChange} className="w-28 shrink-0 rounded-[1rem] border border-slate-300 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-primary">
                        {phoneCountryCodes.map((e) => <option key={e.code} value={e.code}>{e.code}</option>)}
                      </select>
                      <input name="phoneNumber" type="tel" value={draft.phoneNumber} onChange={handleFieldChange} placeholder="Phone number" className={`${fieldClassName} flex-1`} />
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Date of birth</span>
                    <input name="dateOfBirth" type="date" value={draft.dateOfBirth} onChange={handleFieldChange} required className={fieldClassName} />
                  </label>
                </div>
              </section>
            </form>
          ) : null}

          {/* ── Professional ──────────────────────────────────────────────── */}
          {currentSection === "professional" ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Headline</span>
                    <input name="headline" value={draft.headline} onChange={handleFieldChange} placeholder="e.g. Senior Data Annotator, Arabic Transcriptionist" className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Bio</span>
                    <textarea
                      name="bio"
                      value={draft.bio}
                      onChange={handleFieldChange}
                      placeholder="A short summary about your background and what you do."
                      rows={4}
                      className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary resize-none"
                    />
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Years of experience</span>
                      <input name="yearsOfExperience" type="number" min="0" max="50" value={draft.yearsOfExperience} onChange={handleFieldChange} placeholder="e.g. 3" className={fieldClassName} />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Current status</span>
                      <select name="employmentStatus" value={draft.employmentStatus} onChange={handleFieldChange} className={fieldClassName}>
                        <option value="">Select status</option>
                        {candidateEmploymentStatusOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-ink">Availability</span>
                      <select name="availability" value={draft.availability} onChange={handleFieldChange} className={fieldClassName}>
                        <option value="">Select availability</option>
                        {candidateAvailabilityOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </div>
                </div>
              </section>
            </form>
          ) : null}

          {/* ── Skills & Languages ─────────────────────────────────────────── */}
          {currentSection === "skills" ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              {/* Skills */}
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-ink">Skills</p>
                <p className="mt-1 text-sm text-muted">Type a skill and press Enter or comma to add it.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {draft.skills.map((skill, i) => (
                    <SkillTag key={`${skill}-${i}`} label={skill} onRemove={() => removeSkill(i)} />
                  ))}
                </div>
                <div className="mt-3 flex gap-2">
                  <input
                    value={skillInput}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={handleSkillKeyDown}
                    onBlur={() => { if (skillInput.trim()) { addSkill(skillInput); setSkillInput(""); } }}
                    placeholder="e.g. Data annotation, Python, Arabic NLP..."
                    className={fieldClassName}
                  />
                  <button
                    type="button"
                    onClick={() => { addSkill(skillInput); setSkillInput(""); }}
                    className="shrink-0 rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                  >
                    Add
                  </button>
                </div>
              </section>

              {/* Languages */}
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">Languages</p>
                    <p className="mt-1 text-sm text-muted">Add languages you speak and your proficiency level.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addLanguage}
                    className="shrink-0 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                  >
                    + Add language
                  </button>
                </div>
                {draft.languages.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    {draft.languages.map((entry, i) => (
                      <div key={i} className="flex gap-3 items-center">
                        <select
                          value={entry.language}
                          onChange={(e) => updateLanguage(i, "language", e.target.value)}
                          className={`${fieldClassName} flex-1`}
                        >
                          <option value="">Select language</option>
                          {candidateCommonLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
                          {entry.language && !candidateCommonLanguages.includes(entry.language as typeof candidateCommonLanguages[number]) ? (
                            <option value={entry.language}>{entry.language}</option>
                          ) : null}
                        </select>
                        <select
                          value={entry.proficiency}
                          onChange={(e) => updateLanguage(i, "proficiency", e.target.value)}
                          className="w-36 shrink-0 rounded-[1rem] border border-slate-300 bg-white px-3 py-3 text-sm text-ink outline-none transition focus:border-primary"
                        >
                          {candidateLanguageProficiencyOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                        <button
                          type="button"
                          onClick={() => removeLanguage(i)}
                          className="shrink-0 text-lg text-muted transition hover:text-rose-600"
                          aria-label="Remove language"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-muted">No languages added yet.</p>
                )}
              </section>
            </form>
          ) : null}

          {/* ── Links ─────────────────────────────────────────────────────── */}
          {currentSection === "links" ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">LinkedIn</span>
                    <input name="linkedinUrl" type="url" value={draft.linkedinUrl} onChange={handleFieldChange} placeholder="https://linkedin.com/in/yourprofile" className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">GitHub / Portfolio</span>
                    <input name="githubUrl" type="url" value={draft.githubUrl} onChange={handleFieldChange} placeholder="https://github.com/yourusername" className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Personal website</span>
                    <input name="websiteUrl" type="url" value={draft.websiteUrl} onChange={handleFieldChange} placeholder="https://yourwebsite.com" className={fieldClassName} />
                  </label>
                </div>
              </section>
            </form>
          ) : null}

          {/* ── Preferences ───────────────────────────────────────────────── */}
          {currentSection === "preferences" ? (
            <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Preferred work type</span>
                    <select name="preferredWorkType" value={draft.preferredWorkType} onChange={handleFieldChange} className={fieldClassName}>
                      <option value="">Select work type</option>
                      {candidateWorkTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Preferred job type</span>
                    <select name="preferredJobType" value={draft.preferredJobType} onChange={handleFieldChange} className={fieldClassName}>
                      <option value="">Select job type</option>
                      {candidateJobTypeOptions.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3 rounded-[1rem] border border-slate-300 bg-white px-4 py-3 sm:col-span-2">
                    <input
                      name="openToRelocation"
                      type="checkbox"
                      checked={draft.openToRelocation}
                      onChange={handleFieldChange}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <span className="text-sm font-medium text-ink">Open to relocation</span>
                  </label>
                </div>
              </section>

              <label className="flex cursor-pointer items-start gap-4 rounded-[1.25rem] border-2 border-primary/30 bg-primary/5 px-5 py-4 transition hover:border-primary/50 hover:bg-primary/10 sm:col-span-2">
                <div className="relative mt-0.5 shrink-0">
                  <input
                    name="openToCrowdWork"
                    type="checkbox"
                    checked={draft.openToCrowdWork}
                    onChange={handleFieldChange}
                    className="h-5 w-5 rounded accent-primary"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">Consider me for Crowd Work</span>
                    <span className="inline-flex rounded-full bg-primary px-2.5 py-0.5 text-[11px] font-semibold text-white">New</span>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-muted">
                    Opt in to short, paid tasks — audio recording, data annotation, image or video labelling — matched to your language and profile. No separate application needed.
                  </p>
                </div>
              </label>
            </form>
          ) : null}

          {/* ── Documents ─────────────────────────────────────────────────── */}
          {currentSection === "documents" ? (
            <div className="space-y-4">
              <section className="rounded-[1.25rem] border border-slate-200 bg-white p-6">
                <p className="text-sm font-semibold text-ink">Resume / CV</p>
                <p className="mt-1 text-sm leading-7 text-muted">
                  Upload your resume or CV. PDF, DOC, or DOCX up to 5 MB. This file will be attached when you apply for jobs.
                </p>

                {draft.profileResume?.fileUrl ? (
                  <div className="mt-4 flex items-center justify-between gap-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">{draft.profileResume.fileName}</p>
                      <p className="mt-0.5 text-xs text-emerald-700">{formatFileSize(draft.profileResume.sizeBytes)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <a
                        href={draft.profileResume.fileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center rounded-full border border-emerald-300 bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
                      >
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleResumeRemove()}
                        disabled={isUploadingResume}
                        className="inline-flex items-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isUploadingResume ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <label className="mt-4 flex cursor-pointer items-center justify-center gap-3 rounded-[1.15rem] border-2 border-dashed border-slate-300 bg-panelStrong px-6 py-8 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary">
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => void handleResumeChange(e)} className="sr-only" />
                    {isUploadingResume ? (
                      <><LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" /> Uploading...</>
                    ) : (
                      "Click to upload resume (PDF, DOC, DOCX)"
                    )}
                  </label>
                )}

                {draft.profileResume ? (
                  <label className="mt-3 inline-flex cursor-pointer items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                    <input type="file" accept=".pdf,.doc,.docx" onChange={(e) => void handleResumeChange(e)} className="sr-only" />
                    {isUploadingResume ? "Uploading..." : "Replace file"}
                  </label>
                ) : null}
              </section>
            </div>
          ) : null}

        </div>
      </main>
  );
}

export function CandidateProfileWorkspace() {
  return <CandidateProfileWorkspaceContent />;
}
