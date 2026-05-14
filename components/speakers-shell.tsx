"use client";

import {
  FormEvent,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from "firebase/auth";
import {
  DeaimerSiteShell,
  type PlatformSideMenuItem,
} from "@/components/deaimer-site-shell";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import {
  addConvIceCandidate,
  createOrGetConversationRoom,
  joinConversationRoom,
  subscribeToDCAssignmentsBySpeaker,
  subscribeToDCProjectById,
  subscribeToDCSessionsBySpeaker,
  subscribeToDCSpeakerProfileByUid,
  subscribeToConversationRoom,
  submitAssignmentForReview,
  submitConvSession,
  submitDCSession,
  updateConversationRoomFields,
  updateConversationRoomParticipant,
  updateConversationRoomStatus,
  updateDCSpeakerProfile,
  type DCAssignment,
  type DCConversationRoom,
  type DCProject,
  type DCSession,
  type DCSpeaker,
  type DCTaskTemplate,
} from "@/lib/firebase/data-collection";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpeakerSection = "dashboard" | "projects" | "reviews" | "profile" | "guidelines";

const VALID_SECTIONS: SpeakerSection[] = ["dashboard", "projects", "reviews", "profile", "guidelines"];

// ─── Static data ──────────────────────────────────────────────────────────────

const COUNTRIES: { name: string; dial: string }[] = [
  { name: "Afghanistan", dial: "+93" },
  { name: "Albania", dial: "+355" },
  { name: "Algeria", dial: "+213" },
  { name: "Argentina", dial: "+54" },
  { name: "Armenia", dial: "+374" },
  { name: "Australia", dial: "+61" },
  { name: "Austria", dial: "+43" },
  { name: "Azerbaijan", dial: "+994" },
  { name: "Bahrain", dial: "+973" },
  { name: "Bangladesh", dial: "+880" },
  { name: "Belarus", dial: "+375" },
  { name: "Belgium", dial: "+32" },
  { name: "Bolivia", dial: "+591" },
  { name: "Bosnia and Herzegovina", dial: "+387" },
  { name: "Brazil", dial: "+55" },
  { name: "Bulgaria", dial: "+359" },
  { name: "Cambodia", dial: "+855" },
  { name: "Cameroon", dial: "+237" },
  { name: "Canada", dial: "+1" },
  { name: "Chile", dial: "+56" },
  { name: "China", dial: "+86" },
  { name: "Colombia", dial: "+57" },
  { name: "Croatia", dial: "+385" },
  { name: "Czech Republic", dial: "+420" },
  { name: "Denmark", dial: "+45" },
  { name: "Ecuador", dial: "+593" },
  { name: "Egypt", dial: "+20" },
  { name: "Ethiopia", dial: "+251" },
  { name: "Finland", dial: "+358" },
  { name: "France", dial: "+33" },
  { name: "Georgia", dial: "+995" },
  { name: "Germany", dial: "+49" },
  { name: "Ghana", dial: "+233" },
  { name: "Greece", dial: "+30" },
  { name: "Hungary", dial: "+36" },
  { name: "India", dial: "+91" },
  { name: "Indonesia", dial: "+62" },
  { name: "Iran", dial: "+98" },
  { name: "Iraq", dial: "+964" },
  { name: "Ireland", dial: "+353" },
  { name: "Israel", dial: "+972" },
  { name: "Italy", dial: "+39" },
  { name: "Japan", dial: "+81" },
  { name: "Jordan", dial: "+962" },
  { name: "Kazakhstan", dial: "+7" },
  { name: "Kenya", dial: "+254" },
  { name: "Kuwait", dial: "+965" },
  { name: "Kyrgyzstan", dial: "+996" },
  { name: "Lebanon", dial: "+961" },
  { name: "Libya", dial: "+218" },
  { name: "Malaysia", dial: "+60" },
  { name: "Mexico", dial: "+52" },
  { name: "Morocco", dial: "+212" },
  { name: "Mozambique", dial: "+258" },
  { name: "Myanmar", dial: "+95" },
  { name: "Nepal", dial: "+977" },
  { name: "Netherlands", dial: "+31" },
  { name: "New Zealand", dial: "+64" },
  { name: "Nigeria", dial: "+234" },
  { name: "Norway", dial: "+47" },
  { name: "Oman", dial: "+968" },
  { name: "Pakistan", dial: "+92" },
  { name: "Palestine", dial: "+970" },
  { name: "Peru", dial: "+51" },
  { name: "Philippines", dial: "+63" },
  { name: "Poland", dial: "+48" },
  { name: "Portugal", dial: "+351" },
  { name: "Qatar", dial: "+974" },
  { name: "Romania", dial: "+40" },
  { name: "Russia", dial: "+7" },
  { name: "Saudi Arabia", dial: "+966" },
  { name: "Senegal", dial: "+221" },
  { name: "Serbia", dial: "+381" },
  { name: "Singapore", dial: "+65" },
  { name: "Slovakia", dial: "+421" },
  { name: "Somalia", dial: "+252" },
  { name: "South Africa", dial: "+27" },
  { name: "South Korea", dial: "+82" },
  { name: "Spain", dial: "+34" },
  { name: "Sri Lanka", dial: "+94" },
  { name: "Sudan", dial: "+249" },
  { name: "Sweden", dial: "+46" },
  { name: "Switzerland", dial: "+41" },
  { name: "Syria", dial: "+963" },
  { name: "Taiwan", dial: "+886" },
  { name: "Tajikistan", dial: "+992" },
  { name: "Tanzania", dial: "+255" },
  { name: "Thailand", dial: "+66" },
  { name: "Tunisia", dial: "+216" },
  { name: "Turkey", dial: "+90" },
  { name: "Turkmenistan", dial: "+993" },
  { name: "Uganda", dial: "+256" },
  { name: "Ukraine", dial: "+380" },
  { name: "United Arab Emirates", dial: "+971" },
  { name: "United Kingdom", dial: "+44" },
  { name: "United States", dial: "+1" },
  { name: "Uzbekistan", dial: "+998" },
  { name: "Venezuela", dial: "+58" },
  { name: "Vietnam", dial: "+84" },
  { name: "Yemen", dial: "+967" },
  { name: "Zimbabwe", dial: "+263" },
];

const LANGUAGES = [
  "Afrikaans", "Albanian", "Amharic", "Arabic", "Armenian", "Azerbaijani",
  "Bangla (Bengali)", "Belarusian", "Bulgarian", "Burmese",
  "Catalan", "Chinese (Cantonese)", "Chinese (Mandarin)", "Croatian", "Czech",
  "Danish", "Dari / Afghan Persian", "Dutch",
  "English", "Estonian",
  "Filipino / Tagalog", "Finnish", "French",
  "Georgian", "German", "Greek", "Gujarati",
  "Hausa", "Hebrew", "Hindi", "Hungarian",
  "Indonesian", "Italian",
  "Japanese",
  "Kannada", "Kazakh", "Khmer", "Korean", "Kurdish",
  "Lao", "Latvian", "Lithuanian",
  "Macedonian", "Malay", "Malayalam", "Maltese", "Marathi",
  "Nepali", "Norwegian",
  "Odia", "Pashto", "Persian (Farsi)", "Polish", "Portuguese", "Punjabi",
  "Romanian", "Russian",
  "Serbian", "Sinhala", "Slovak", "Slovenian", "Somali", "Spanish", "Swahili", "Swedish",
  "Tamil", "Telugu", "Thai", "Turkish", "Turkmen",
  "Ukrainian", "Urdu", "Uzbek",
  "Vietnamese",
  "Welsh",
  "Yoruba",
  "Zulu",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function calcAge(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(dob + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function maxDOBDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
}

function formatDuration(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    const ts = (val as { toDate?: () => Date }).toDate?.();
    return (ts ?? new Date(val as string)).toLocaleDateString();
  } catch {
    return "—";
  }
}

function formatDOB(dob: string): string {
  if (!dob) return "—";
  try {
    return new Date(dob + "T00:00:00").toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dob;
  }
}

function isProfileComplete(speaker: DCSpeaker) {
  return !!(
    speaker.firstName &&
    speaker.lastName &&
    speaker.dateOfBirth &&
    speaker.gender &&
    speaker.country &&
    speaker.region &&
    speaker.languages.length > 0 &&
    speaker.phone
  );
}

// ─── Google SVG ───────────────────────────────────────────────────────────────

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

// ─── Dashboard ────────────────────────────────────────────────────────────────

function SpeakerMetric({ label, value, hint, className = "" }: { label: string; value: string; hint: string; className?: string }) {
  return (
    <article className={["rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-5", className].join(" ")}>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60 sm:text-[11px]">{label}</p>
      <p className="mt-1.5 text-2xl font-light tabular-nums tracking-tight text-ink sm:mt-2.5 sm:text-4xl">{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted sm:mt-2 sm:text-xs">{hint}</p>
    </article>
  );
}

function Dashboard({
  speaker,
  assignments,
  sessions,
  onNavigate,
}: {
  speaker: DCSpeaker;
  assignments: DCAssignment[];
  sessions: DCSession[];
  onNavigate: (s: SpeakerSection) => void;
}) {
  const firstName = speaker.firstName || speaker.name?.split(" ")[0] || "there";
  const totalHours = sessions.reduce((sum, s) => sum + s.duration / 3600, 0);
  const activeTasks = assignments.filter((a) => a.status === "active").length;
  const completedSessions = sessions.length;
  const recentSessions = sessions.slice(0, 5);

  const quickCards = [
    { label: "My Projects", body: "Record your assigned projects and track progress prompt by prompt.", section: "projects" as SpeakerSection, featured: true },
    { label: "Reviews", body: "See QA status for submitted recordings and address any rejections.", section: "reviews" as SpeakerSection, featured: false },
    { label: "Guidelines", body: "Recording tips, environment setup, and quality standards.", section: "guidelines" as SpeakerSection, featured: false },
  ];

  return (
    <div className="space-y-6">
      {/* Hero banner */}
      <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-8 py-10 sm:px-10 sm:py-12">
        <div className="relative z-10">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">Speaker portal</p>
          <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">Welcome back, {firstName}</h1>
          <p className="mt-3 max-w-lg text-sm leading-7 text-white/75">
            Record high-quality speech data, track your sessions, and manage your profile — all in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onNavigate("projects")}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
            >
              View projects
            </button>
            <button
              type="button"
              onClick={() => onNavigate("profile")}
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              My profile
            </button>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 right-16 h-32 w-32 rounded-full bg-white/5" />
      </section>

      {/* Metrics */}
      <div className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0" style={{ scrollbarWidth: "none" }}>
        <SpeakerMetric className="w-40 shrink-0 xl:w-auto" label="Total hours" value={totalHours.toFixed(2) + "h"} hint="Total recorded audio submitted across all projects." />
        <SpeakerMetric className="w-40 shrink-0 xl:w-auto" label="Sessions" value={String(completedSessions).padStart(2, "0")} hint="Recording sessions you have submitted." />
        <SpeakerMetric className="w-40 shrink-0 xl:w-auto" label="Active tasks" value={String(activeTasks).padStart(2, "0")} hint="Projects currently assigned to you." />
        <SpeakerMetric className="w-40 shrink-0 xl:w-auto" label="Profile" value={speaker.firstName ? "Ready" : "Pending"} hint="Your speaker profile completion status." />
      </div>

      {/* Quick-access cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        {quickCards.map((card) =>
          card.featured ? (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.section)}
              className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primaryStrong p-3 text-left sm:p-5"
            >
              <div className="relative z-10">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold text-white">{card.label}</p>
                  <span className="shrink-0 text-white/60 transition group-hover:text-white">→</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/75">{card.body}</p>
              </div>
              <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
              <div aria-hidden="true" className="pointer-events-none absolute -bottom-3 right-8 h-12 w-12 rounded-full bg-white/5" />
            </button>
          ) : (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.section)}
              className="group rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-primary/25 hover:bg-[#f9fbff] sm:p-5"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{card.label}</p>
                <span className="shrink-0 text-muted/40 transition group-hover:text-primary">→</span>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{card.body}</p>
            </button>
          )
        )}
      </div>

      {/* Recent activity */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent Activity</h2>
        {recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-muted">No sessions yet. Head to My Projects to start recording.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
            {recentSessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-ink">{s.projectName}</p>
                  <p className="text-xs text-muted">{formatDate(s.createdAt)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted">{formatDuration(s.duration)}</span>
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${
                    s.qaStatus === "approved"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : s.qaStatus === "rejected"
                        ? "border-rose-200 bg-rose-50 text-rose-800"
                        : "border-slate-200 bg-white text-muted"
                  }`}>
                    {s.qaStatus}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── My Projects ──────────────────────────────────────────────────────────────

function MyProjects({ assignments, onSelect }: { assignments: DCAssignment[]; onSelect: (a: DCAssignment) => void }) {
  if (assignments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">My Projects</h1>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-2xl">◎</p>
          <p className="mt-3 text-sm font-medium text-ink">No projects yet</p>
          <p className="mt-1 text-sm text-muted">You haven&apos;t been assigned to any projects. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">My Projects</h1>
      <div className="space-y-3">
        {assignments.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onSelect(a)}
            className="group flex w-full items-center justify-between rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-primary/30 hover:bg-[#f9fbff]"
          >
            <div className="min-w-0">
              {a.projectDialect && (
                <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{a.projectDialect}</p>
              )}
              <p className="mt-0.5 truncate text-sm font-semibold text-ink">{a.projectName}</p>
              {a.projectDescription && (
                <p className="mt-0.5 line-clamp-1 text-xs text-muted">{a.projectDescription}</p>
              )}
            </div>
            <div className="ml-4 flex shrink-0 items-center gap-3">
              <span className={[
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                a.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : a.status === "completed" ? "border-slate-200 bg-slate-100 text-slate-500"
                  : "border-amber-200 bg-amber-50 text-amber-800",
              ].join(" ")}>
                {a.status}
              </span>
              <span className="text-muted/40 transition group-hover:text-primary">→</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Project View ──────────────────────────────────────────────────────────────

function ProjectView({
  assignment,
  project,
  sessions,
  onBack,
  onSelectTask,
  onNavigateToReviews,
}: {
  assignment: DCAssignment;
  project: DCProject;
  sessions: DCSession[];
  onBack: () => void;
  onSelectTask: (task: DCTaskTemplate, taskIndex: number, promptIndex: number) => void;
  onNavigateToReviews: () => void;
}) {
  const tasks = project.tasks ?? [];
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [localSubmitted, setLocalSubmitted] = useState(false);
  const effectiveSubmitted = localSubmitted || assignment.submittedForReview;

  function submittedSetForTask(taskId: string): Set<number> {
    return new Set(
      sessions
        .filter((s) => s.taskId === taskId && s.promptIndex != null && Boolean(s.audioUrl))
        .map((s) => s.promptIndex!)
    );
  }

  function donePromptsForTask(taskId: string, total: number): number {
    return Math.min(submittedSetForTask(taskId).size, total);
  }

  const totalPrompts = tasks.reduce((sum, t) => sum + t.prompts.length, 0);
  const donePrompts = tasks.reduce((sum, t) => sum + donePromptsForTask(t.id, t.prompts.length), 0);
  const overallProgress = totalPrompts > 0 ? Math.round((donePrompts / totalPrompts) * 100) : 0;
  const allTasksDone = tasks.length > 0 && tasks.every((t) => donePromptsForTask(t.id, t.prompts.length) >= t.prompts.length);

  function isTaskLocked(taskIdx: number): boolean {
    for (let i = 0; i < taskIdx; i++) {
      if (donePromptsForTask(tasks[i].id, tasks[i].prompts.length) < tasks[i].prompts.length) return true;
    }
    return false;
  }

  function getStartContinue(): { taskIndex: number; promptIndex: number; label: "Start" | "Continue" } | null {
    if (allTasksDone) return null;
    for (let ti = 0; ti < tasks.length; ti++) {
      const t = tasks[ti];
      const submitted = submittedSetForTask(t.id);
      if (submitted.size < t.prompts.length) {
        const firstIncomplete = t.prompts.findIndex((_, i) => !submitted.has(i));
        return {
          taskIndex: ti,
          promptIndex: firstIncomplete >= 0 ? firstIncomplete : 0,
          label: donePrompts === 0 ? "Start" : "Continue",
        };
      }
    }
    return null;
  }

  const startContinue = getStartContinue();

  return (
    <div className="space-y-5">
      {/* Back */}
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">
        <span>←</span> My Projects
      </button>

      {/* Hero card */}
      <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-6 py-7 sm:px-8 sm:py-9">
        <div className="relative z-10">
          {assignment.projectDialect && (
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">{assignment.projectDialect}</p>
          )}
          <h1 className="mt-1 text-2xl font-semibold text-white sm:text-3xl">{assignment.projectName}</h1>
          {assignment.projectDescription && (
            <p className="mt-1.5 text-sm leading-6 text-white/70">{assignment.projectDescription}</p>
          )}
          {/* Stats */}
          <div className="mt-5 flex flex-wrap gap-x-6 gap-y-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Tasks</p>
              <p className="mt-0.5 text-xl font-semibold text-white">{tasks.length}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Prompts done</p>
              <p className="mt-0.5 text-xl font-semibold text-white">{donePrompts}<span className="text-sm font-normal text-white/60">/{totalPrompts}</span></p>
            </div>
            {assignment.deadline && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-widest text-white/50">Deadline</p>
                <p className="mt-0.5 text-xl font-semibold text-white">{assignment.deadline}</p>
              </div>
            )}
          </div>
          {/* Overall progress */}
          <div className="mt-5">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
              <div className="h-full rounded-full bg-white transition-all duration-500" style={{ width: `${overallProgress}%` }} />
            </div>
            <p className="mt-1.5 text-[11px] text-white/50">{overallProgress}% complete</p>
          </div>
          {/* CTA */}
          {effectiveSubmitted ? (() => {
            const allApproved = sessions.length > 0 && sessions.every((s) => s.qaStatus === "approved");
            if (allApproved) {
              return (
                <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-400/30 px-4 py-2">
                  <span className="text-sm text-white">✓</span>
                  <span className="text-sm font-semibold text-white">Approved</span>
                </div>
              );
            }
            return (
              <div className="mt-5 flex flex-wrap gap-3">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-2">
                  <span className="text-sm text-white">✓</span>
                  <span className="text-sm font-semibold text-white">Submitted for review</span>
                </div>
                <button
                  type="button"
                  onClick={onNavigateToReviews}
                  className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  View progress →
                </button>
              </div>
            );
          })() : startContinue ? (
            <button
              type="button"
              onClick={() => onSelectTask(tasks[startContinue.taskIndex], startContinue.taskIndex, startContinue.promptIndex)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90 active:scale-[0.97]"
            >
              {startContinue.label} →
            </button>
          ) : allTasksDone ? (
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setSubmitting(true);
                    setSubmitError(null);
                    void submitAssignmentForReview(assignment.id)
                      .then(() => setLocalSubmitted(true))
                      .catch((err) => setSubmitError(err instanceof Error ? err.message : "Submission failed. Please try again."))
                      .finally(() => setSubmitting(false));
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90 active:scale-[0.97] disabled:opacity-60"
                >
                  {submitting ? "Submitting…" : "Submit for review →"}
                </button>
              </div>
              {submitError && (
                <p className="text-sm text-rose-300">{submitError}</p>
              )}
            </div>
          ) : null}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-6 right-20 h-28 w-28 rounded-full bg-white/5" />
      </div>

      {/* Task list — hidden once submitted */}
      {!effectiveSubmitted && (
        tasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-muted">No tasks have been added to this project yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task, idx) => {
              const done = donePromptsForTask(task.id, task.prompts.length);
              const total = task.prompts.length;
              const complete = done >= total && total > 0;
              const inProgress = done > 0 && !complete;
              const progress = total > 0 ? Math.round((done / total) * 100) : 0;
              const locked = isTaskLocked(idx);

              return (
                <button
                  key={task.id}
                  type="button"
                  disabled={locked}
                  onClick={() => {
                    if (locked) return;
                    const submitted = submittedSetForTask(task.id);
                    const firstIncomplete = task.prompts.findIndex((_, i) => !submitted.has(i));
                    onSelectTask(task, idx, firstIncomplete >= 0 ? firstIncomplete : 0);
                  }}
                  className={[
                    "group w-full rounded-[1.25rem] border p-5 text-left transition",
                    locked
                      ? "cursor-not-allowed border-slate-100 bg-slate-50 opacity-55"
                      : "border-slate-200 bg-white hover:border-primary/30 hover:bg-[#f9fbff]",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-4">
                    <div className={[
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      complete ? "bg-emerald-100 text-emerald-600"
                        : inProgress ? "bg-primary/10 text-primary"
                        : "bg-slate-100 text-slate-400",
                    ].join(" ")}>
                      {complete ? "✓" : locked ? "⚿" : String(idx + 1).padStart(2, "0")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{task.title}</p>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={[
                            "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                            complete ? "bg-emerald-100 text-emerald-700"
                              : inProgress ? "bg-blue-100 text-blue-700"
                              : locked ? "bg-slate-100 text-slate-400"
                              : "bg-slate-100 text-slate-500",
                          ].join(" ")}>
                            {complete ? "Done" : inProgress ? "In progress" : locked ? "Locked" : "Not started"}
                          </span>
                          {!locked && <span className="text-muted/40 transition group-hover:text-primary">→</span>}
                        </div>
                      </div>

                      <div className="mt-3">
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={["h-full rounded-full transition-all duration-500", complete ? "bg-emerald-400" : "bg-primary"].join(" ")}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <p className="mt-1.5 text-[11px] text-muted">{done} of {total} prompt{total !== 1 ? "s" : ""} recorded</p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}

// ─── Task View (prompt-by-prompt recorder) ────────────────────────────────────

type PromptRecordState = "idle" | "recording" | "stopped" | "saving";

interface PromptBlob { blob: Blob; mimeType: string; duration: number; url: string }

function TaskView({
  speaker,
  assignment,
  project,
  taskIndex,
  task,
  initialPromptIndex,
  sessions,
  onBack,
  onNavigateTask,
}: {
  speaker: DCSpeaker;
  assignment: DCAssignment;
  project: DCProject;
  taskIndex: number;
  task: DCTaskTemplate;
  initialPromptIndex: number;
  sessions: DCSession[];
  onBack: () => void;
  onNavigateTask: (taskIndex: number, promptIndex: number) => void;
}) {
  const tasks = project.tasks ?? [];
  const prompts = task.prompts ?? [];
  const isLastTask = taskIndex >= tasks.length - 1;
  const prevTask = taskIndex > 0 ? tasks[taskIndex - 1] : null;

  const submittedSet = new Set(
    sessions
      .filter((s) => s.taskId === task.id && s.promptIndex != null && Boolean(s.audioUrl))
      .map((s) => s.promptIndex!)
  );

  const [promptIdx, setPromptIdx] = useState(initialPromptIndex);
  const [blobs, setBlobs] = useState<Map<number, PromptBlob>>(new Map());
  const [recordState, setRecordState] = useState<PromptRecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [levelBars, setLevelBars] = useState<number[]>(Array(24).fill(0));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const currentPrompt = prompts[promptIdx];
  const maxSec = currentPrompt?.maxSeconds ?? 30;
  const currentBlob = blobs.get(promptIdx) ?? null;
  const isSubmitted = submittedSet.has(promptIdx);
  const isLastPrompt = promptIdx === prompts.length - 1;
  const canGoNext = submittedSet.has(promptIdx) || blobs.has(promptIdx);
  const canGoPrev = promptIdx > 0 || taskIndex > 0;
  const newBlobCount = Array.from(blobs.keys()).filter((i) => !submittedSet.has(i)).length;
  const submittedSession = sessions.find((s) => s.taskId === task.id && s.promptIndex === promptIdx && Boolean(s.audioUrl)) ?? null;
  // Lock recording once submitted for review, except for rejected prompts
  const isRecordingAllowed = !assignment.submittedForReview || submittedSession?.qaStatus === "rejected";

  useEffect(() => {
    if (recordState === "recording" && elapsed >= maxSec) {
      stopRecording();
    }
  }, [elapsed, maxSec, recordState]);

  function stopVisualizer() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    setLevelBars(Array(24).fill(0));
  }

  function startVisualizer(stream: MediaStream) {
    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    ctx.createMediaStreamSource(stream).connect(analyser);
    function tick() {
      const data = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(data);
      setLevelBars(Array.from({ length: 24 }, (_, i) =>
        Math.round((data[Math.floor((i / 24) * data.length)] / 255) * 100),
      ));
      animFrameRef.current = requestAnimationFrame(tick);
    }
    tick();
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      startVisualizer(stream);
      let recorder: MediaRecorder;
      try {
        const preferred = MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : "audio/mp4";
        recorder = new MediaRecorder(stream, { mimeType: preferred });
      } catch { recorder = new MediaRecorder(stream); }
      const rawMime = recorder.mimeType || "";
      const mimeType: string = rawMime.startsWith("audio/mp4") ? "audio/mp4" : "audio/webm";
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setBlobs((prev) => new Map(prev).set(promptIdx, { blob, mimeType, duration: elapsed, url }));
        setRecordState("stopped");
        stopVisualizer();
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setRecordState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") setError("BLOCKED");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") setError("No microphone found.");
      else setError("Could not access microphone. Please try again.");
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    stopVisualizer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function reRecord() {
    const prev = blobs.get(promptIdx);
    if (prev?.url) URL.revokeObjectURL(prev.url);
    setBlobs((prev) => { const m = new Map(prev); m.delete(promptIdx); return m; });
    setElapsed(0);
    setRecordState("idle");
  }

  function navigateToPrompt(idx: number) {
    if (recordState === "recording") return;
    setPromptIdx(idx);
    setElapsed(0);
    setError("");
    setRecordState(blobs.has(idx) ? "stopped" : "idle");
  }

  function handleNext() {
    if (!canGoNext || recordState === "recording") return;
    if (!isLastPrompt) {
      navigateToPrompt(promptIdx + 1);
    } else {
      void submitAndContinue();
    }
  }

  function handlePrev() {
    if (recordState === "recording") return;
    if (promptIdx > 0) {
      navigateToPrompt(promptIdx - 1);
    } else if (taskIndex > 0 && prevTask) {
      onNavigateTask(taskIndex - 1, prevTask.prompts.length - 1);
    }
  }

  async function submitAndContinue() {
    if (newBlobCount === 0) {
      if (!isLastTask) onNavigateTask(taskIndex + 1, 0);
      else onBack();
      return;
    }
    setSubmitting(true);
    setError("");
    let uploaded = 0;
    try {
      for (const [idx, entry] of Array.from(blobs.entries())) {
        if (submittedSet.has(idx)) continue;
        await submitDCSession({
          projectId: assignment.projectId,
          projectName: assignment.projectName,
          speakerId: speaker.email,
          speakerName: speaker.name,
          assignmentId: assignment.id,
          taskId: task.id,
          promptIndex: idx,
          promptText: prompts[idx]?.text ?? "",
          audioBlob: entry.blob,
          mimeType: entry.mimeType,
          duration: entry.duration,
          sampleRate: 44100,
          bitDepth: 16,
          gender: speaker.gender,
          age: speaker.age,
          dialect: speaker.languages[0] || speaker.dialect,
          region: speaker.region,
        });
        uploaded++;
        setSubmitProgress(Math.round((uploaded / newBlobCount) * 100));
      }
      blobs.forEach((b) => URL.revokeObjectURL(b.url));
      setBlobs(new Map());
      setSubmitting(false);
      if (!isLastTask) onNavigateTask(taskIndex + 1, 0);
      else onBack();
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err);
      setError(`Upload failed: ${detail}`);
      setSubmitting(false);
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopVisualizer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      blobs.forEach((b) => URL.revokeObjectURL(b.url));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!currentPrompt) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">← Back</button>
        <p className="text-sm text-muted">This task has no prompts.</p>
      </div>
    );
  }

  const timerColor = elapsed >= maxSec * 0.9 ? "text-rose-500" : elapsed >= maxSec * 0.7 ? "text-amber-500" : "text-ink";

  // Next button label
  const nextLabel = isLastPrompt
    ? isLastTask
      ? (newBlobCount > 0 ? "Submit task ✓" : "Done ✓")
      : (newBlobCount > 0 ? "Submit & next task →" : "Next task →")
    : "Next →";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <button type="button" onClick={onBack} className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">
          <span>←</span> {assignment.projectName}
        </button>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted">Task {taskIndex + 1} of {tasks.length}</p>
            <h1 className="mt-0.5 text-xl font-semibold text-ink">{task.title}</h1>
          </div>
          <span className="shrink-0 rounded-full border border-slate-200 bg-panelStrong px-3 py-0.5 text-xs text-muted">
            {promptIdx + 1} / {prompts.length}
          </span>
        </div>
      </div>

      {/* Prompt stepper — visual only, no interaction */}
      <div className="flex gap-1.5">
        {prompts.map((_, i) => {
          const done = submittedSet.has(i) || blobs.has(i);
          const active = i === promptIdx;
          return (
            <div
              key={i}
              className={[
                "h-2 flex-1 rounded-full transition-all duration-300",
                active ? "bg-primary" : done ? "bg-emerald-400" : "bg-slate-200",
              ].join(" ")}
            />
          );
        })}
      </div>

      {/* Prompt text */}
      <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50 p-4">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">Prompt {promptIdx + 1}</p>
        <p className="text-sm leading-7 text-ink">{currentPrompt.text}</p>
        <p className="mt-2 text-[11px] text-muted">Max {maxSec}s</p>
      </div>

      {/* Submitted preview */}
      {isSubmitted && !blobs.has(promptIdx) && recordState === "idle" && (
        <div className="space-y-3 rounded-[1.25rem] border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-center gap-2">
            <span className="text-emerald-500">✓</span>
            <p className="text-sm font-semibold text-emerald-900">Submitted recording</p>
          </div>
          {submittedSession?.audioUrl ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <audio controls src={submittedSession.audioUrl} className="w-full rounded-xl" />
          ) : (
            <p className="text-xs text-emerald-700">Audio processing…</p>
          )}
          {isRecordingAllowed && (
            <button
              type="button"
              onClick={() => void startRecording()}
              className="w-full rounded-full border border-emerald-300 bg-white py-2.5 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-50 active:scale-[0.98]"
            >
              Record new
            </button>
          )}
          {!isRecordingAllowed && (
            <p className="text-center text-xs text-muted">Locked — submitted for review</p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        error === "BLOCKED" ? (
          <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Microphone access blocked</p>
            <ol className="mt-2 list-inside list-decimal space-y-1 text-sm text-rose-800">
              <li>Tap the lock icon in your browser&apos;s address bar</li>
              <li>Set Microphone to Allow</li>
              <li>Refresh and try again</li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        )
      )}

      {/* Recorder — hidden when reviewing a submitted prompt, or locked */}
      {(recordState !== "idle" || !isSubmitted || blobs.has(promptIdx)) && isRecordingAllowed && (
      <div className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-slate-200 bg-white px-4 py-10">
        <p className={["font-mono text-5xl font-light tracking-tight sm:text-6xl", timerColor].join(" ")}>
          {formatDuration(elapsed)}
        </p>
        <div className="flex h-10 items-end gap-[2px]" aria-hidden="true">
          {levelBars.map((h, i) => (
            <div key={i} className={["w-[3px] rounded-full transition-all duration-75", recordState === "recording" ? "bg-primary" : "bg-slate-200"].join(" ")} style={{ height: `${Math.max(4, h)}%` }} />
          ))}
        </div>
        {recordState === "idle" && (
          <button type="button" onClick={() => void startRecording()} className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_24px_rgba(43,133,240,0.4)] hover:bg-primaryStrong active:scale-95">
            <span className="text-2xl">⏺</span>
          </button>
        )}
        {recordState === "recording" && (
          <>
            <button type="button" onClick={stopRecording} className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_4px_24px_rgba(220,38,38,0.4)] hover:bg-rose-700 active:scale-95">
              <span className="text-2xl">⏹</span>
            </button>
            <p className="animate-pulse text-xs text-muted">Recording… speak naturally</p>
          </>
        )}
      </div>
      )}

      {/* Playback */}
      {recordState === "stopped" && currentBlob && (
        <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={currentBlob.url} className="w-full rounded-xl" />
          <button type="button" onClick={reRecord} className="w-full rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-muted hover:bg-slate-50">
            Re-record
          </button>
        </div>
      )}

      {/* Navigation */}
      {!submitting && (canGoPrev || canGoNext) && (
        <div className="flex gap-3">
          {canGoPrev ? (
            <button
              type="button"
              onClick={handlePrev}
              disabled={recordState === "recording"}
              className="flex-1 rounded-full border border-slate-200 py-3 text-sm font-semibold text-muted transition hover:bg-slate-50 disabled:opacity-40"
            >
              ← Previous
            </button>
          ) : (
            <div className="flex-1" />
          )}
          {canGoNext && (
            <button
              type="button"
              onClick={handleNext}
              disabled={recordState === "recording"}
              className={[
                "flex-1 rounded-full py-3 text-sm font-semibold text-white transition active:scale-[0.98] disabled:opacity-40",
                isLastPrompt ? "bg-emerald-600 hover:bg-emerald-700" : "bg-primary hover:bg-primaryStrong",
              ].join(" ")}
            >
              {nextLabel}
            </button>
          )}
        </div>
      )}

      {/* Upload progress */}
      {submitting && (
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-5">
          <div className="flex items-center gap-3">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
            <p className="text-sm text-muted">Uploading… {submitProgress}%</p>
          </div>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${submitProgress}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

const QA_COLOR: Record<string, string> = {
  approved: "bg-emerald-100 text-emerald-700",
  rejected: "bg-rose-100 text-rose-700",
  "in-review": "bg-amber-100 text-amber-700",
  pending: "bg-slate-100 text-slate-500",
};
const QA_LABEL: Record<string, string> = {
  approved: "Approved",
  rejected: "Rejected",
  "in-review": "In review",
  pending: "Pending",
};

// ─── Re-record flow ───────────────────────────────────────────────────────────

function ReRecordFlow({
  assignment,
  project,
  speaker,
  rejectedSessions,
  onDone,
}: {
  assignment: DCAssignment;
  project: DCProject | null;
  speaker: DCSpeaker;
  rejectedSessions: DCSession[];
  onDone: () => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [blobs, setBlobs] = useState<Map<number, Blob>>(new Map());
  const [uploadedSet, setUploadedSet] = useState<Set<number>>(new Set());
  const [recordState, setRecordState] = useState<"idle" | "recording" | "stopped">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const elapsedRef = useRef(0);

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const session = rejectedSessions[currentIdx];
  const tasks = project?.tasks ?? [];
  const taskTitle = tasks.find((t) => t.id === session?.taskId)?.title ?? "";
  const isFirst = currentIdx === 0;
  const isLast = currentIdx >= rejectedSessions.length - 1;
  const currentBlob = blobs.get(currentIdx) ?? null;
  const allUploaded = uploadedSet.size === rejectedSessions.length;

  function stopTimer() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  async function startRecording() {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const mr = new MediaRecorder(stream, { mimeType });
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        setBlobs((prev) => new Map(prev).set(currentIdx, blob));
        setRecordState("stopped");
        stopStream();
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecordState("recording");
      setElapsed(0);
      elapsedRef.current = 0;
      timerRef.current = setInterval(() => {
        setElapsed((e) => { const n = e + 1; elapsedRef.current = n; return n; });
      }, 1000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Microphone access denied");
    }
  }

  function stopRecording() {
    stopTimer();
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    stopStream();
  }

  function navigateTo(idx: number) {
    if (recordState === "recording") stopRecording();
    setCurrentIdx(idx);
    setRecordState("idle");
    setElapsed(0);
    elapsedRef.current = 0;
    setError("");
  }

  async function uploadCurrent() {
    const blob = blobs.get(currentIdx);
    if (!blob || uploadedSet.has(currentIdx) || !session) return;
    setError("");
    try {
      await submitDCSession({
        projectId: assignment.projectId,
        projectName: assignment.projectName,
        speakerId: speaker.email,
        speakerName: speaker.name,
        assignmentId: assignment.id,
        taskId: session.taskId,
        promptIndex: session.promptIndex,
        promptText: session.promptText,
        audioBlob: blob,
        mimeType: blob.type || "audio/webm",
        duration: elapsedRef.current,
        sampleRate: 44100,
        bitDepth: 16,
        gender: speaker.gender,
        age: speaker.age,
        dialect: speaker.dialect,
        region: speaker.region,
      });
      setUploadedSet((prev) => new Set(prev).add(currentIdx));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    }
  }

  async function handleReSubmit() {
    setSubmitting(true);
    setError("");
    try {
      // Upload any blobs not yet uploaded
      for (let i = 0; i < rejectedSessions.length; i++) {
        if (blobs.has(i) && !uploadedSet.has(i)) {
          const s = rejectedSessions[i];
          const blob = blobs.get(i)!;
          await submitDCSession({
            projectId: assignment.projectId,
            projectName: assignment.projectName,
            speakerId: speaker.email,
            speakerName: speaker.name,
            assignmentId: assignment.id,
            taskId: s.taskId,
            promptIndex: s.promptIndex,
            promptText: s.promptText,
            audioBlob: blob,
            mimeType: blob.type || "audio/webm",
            duration: 0,
            sampleRate: 44100,
            bitDepth: 16,
            gender: speaker.gender,
            age: speaker.age,
            dialect: speaker.dialect,
            region: speaker.region,
          });
        }
      }
      await submitAssignmentForReview(assignment.id);
      setSubmitDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitDone) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Reviews</h1>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
          <p className="text-3xl">✓</p>
          <p className="mt-3 text-base font-semibold text-emerald-900">Re-submitted for review</p>
          <p className="mt-1 text-sm text-emerald-700">Your updated recordings have been sent. You'll be notified once reviewed.</p>
          <button
            type="button"
            onClick={onDone}
            className="mt-5 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            Back to reviews
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button type="button" onClick={onDone} className="text-sm font-medium text-muted hover:text-primary">
          ← Back
        </button>
        <div>
          <h1 className="text-xl font-semibold text-ink sm:text-2xl">Re-record</h1>
          <p className="text-xs text-muted">Rejection {currentIdx + 1} of {rejectedSessions.length}</p>
        </div>
      </div>

      {/* Stepper dots */}
      {rejectedSessions.length > 1 && (
        <div className="flex gap-1.5">
          {rejectedSessions.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all ${
                uploadedSet.has(i)
                  ? "bg-emerald-400"
                  : i === currentIdx
                    ? "bg-primary"
                    : "bg-slate-200"
              }`}
            />
          ))}
        </div>
      )}

      {/* Rejection reason banner */}
      {session?.qaNote && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
          <span className="mt-0.5 shrink-0 text-rose-500">✕</span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-rose-600">Rejection reason</p>
            <p className="mt-0.5 text-sm text-rose-900">{session.qaNote}</p>
          </div>
        </div>
      )}

      {/* Prompt card */}
      <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5">
        {taskTitle && (
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">{taskTitle}</p>
        )}
        <p className="text-base font-medium leading-relaxed text-ink">{session?.promptText ?? "—"}</p>
      </div>

      {/* Already uploaded state */}
      {uploadedSet.has(currentIdx) ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <span className="text-emerald-500">✓</span>
          <p className="text-sm font-medium text-emerald-900">Recording saved</p>
          <button
            type="button"
            onClick={() => {
              setUploadedSet((prev) => { const s = new Set(prev); s.delete(currentIdx); return s; });
              setBlobs((prev) => { const m = new Map(prev); m.delete(currentIdx); return m; });
              setRecordState("idle");
            }}
            className="ml-auto text-xs text-emerald-700 underline hover:no-underline"
          >
            Re-record
          </button>
        </div>
      ) : (
        /* Recording UI */
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          {error && <p className="mb-3 text-sm text-rose-600">{error}</p>}

          {recordState === "idle" && !currentBlob && (
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                onClick={() => void startRecording()}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-500 text-2xl text-white shadow-lg transition hover:bg-rose-600 active:scale-95"
              >
                ●
              </button>
              <p className="text-sm text-muted">Tap to start recording</p>
            </div>
          )}

          {recordState === "recording" && (
            <div className="flex flex-col items-center gap-4 py-4">
              <button
                type="button"
                onClick={stopRecording}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-xl text-white shadow-lg transition hover:bg-rose-700 active:scale-95"
              >
                ■
              </button>
              <p className="font-mono text-sm text-rose-700">{elapsed}s recording…</p>
            </div>
          )}

          {recordState === "stopped" && currentBlob && (
            <div className="space-y-3">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls src={URL.createObjectURL(currentBlob)} className="w-full rounded-xl" />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setBlobs((prev) => { const m = new Map(prev); m.delete(currentIdx); return m; }); setRecordState("idle"); }}
                  className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-muted hover:bg-slate-50"
                >
                  Re-record
                </button>
                <button
                  type="button"
                  onClick={() => void uploadCurrent()}
                  className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
                >
                  Save ✓
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-3">
        <button
          type="button"
          disabled={isFirst}
          onClick={() => navigateTo(currentIdx - 1)}
          className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-ink hover:bg-slate-50 disabled:opacity-30"
        >
          ← Previous
        </button>
        <button
          type="button"
          disabled={isLast}
          onClick={() => navigateTo(currentIdx + 1)}
          className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-30"
        >
          Next →
        </button>
      </div>

      {/* Re-submit */}
      {allUploaded && (
        <button
          type="button"
          disabled={submitting}
          onClick={() => void handleReSubmit()}
          className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {submitting ? "Submitting…" : "Re-submit for review →"}
        </button>
      )}

      {error && <p className="text-center text-sm text-rose-600">{error}</p>}
    </div>
  );
}

// ─── Review detail page ────────────────────────────────────────────────────────

function ReviewDetail({
  assignment,
  assignmentSessions,
  project,
  onBack,
  onReRecord,
}: {
  assignment: DCAssignment;
  assignmentSessions: DCSession[];
  project: DCProject | null;
  onBack: () => void;
  onReRecord: (rejected: DCSession[]) => void;
}) {
  const tasks = project?.tasks ?? [];

  // Only count sessions that have a real audio recording and match the project's current task/prompt structure
  const validSessions = assignmentSessions.filter((s) => {
    if (!s.audioUrl) return false; // phantom/aborted session
    if (project === null) return false; // project not loaded yet — don't leak phantoms
    if (tasks.length === 0) return true; // loaded conversational project with no task structure
    if (!s.taskId || s.promptIndex == null) return false;
    const task = tasks.find((t) => t.id === s.taskId);
    if (!task) return false; // taskId doesn't match any current task
    return s.promptIndex >= 0 && s.promptIndex < task.prompts.length;
  });

  const rejected = validSessions.filter((s) => s.qaStatus === "rejected");
  const approved = validSessions.filter((s) => s.qaStatus === "approved");
  const inReview = validSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review");

  // Build ordered list using task+prompt order from project
  const ordered: DCSession[] = [];
  tasks.forEach((task) => {
    task.prompts.forEach((_, pi) => {
      const s = validSessions.find((sess) => sess.taskId === task.id && sess.promptIndex === pi);
      if (s) ordered.push(s);
    });
  });
  if (tasks.length === 0) ordered.push(...validSessions);

  const rejectedOrdered = ordered.filter((s) => s.qaStatus === "rejected");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-primary">
            ← Reviews
          </button>
          <h1 className="mt-1 text-xl font-semibold text-ink sm:text-2xl">{assignment.projectName}</h1>
          {assignment.projectDialect && (
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{assignment.projectDialect}</p>
          )}
        </div>
        {rejected.length > 0 && (
          <button
            type="button"
            onClick={() => onReRecord(rejectedOrdered)}
            className="shrink-0 rounded-full bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700"
          >
            Re-record {rejected.length > 1 ? `${rejected.length} rejections` : "rejection"} →
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {rejected.length > 0 && (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{rejected.length} rejected</span>
        )}
        {inReview.length > 0 && (
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">{inReview.length} in review</span>
        )}
        {approved.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">{approved.length} approved</span>
        )}
        {approved.length === validSessions.length && validSessions.length > 0 && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">✓ All approved</span>
        )}
      </div>

      {/* Rejections — compact with audio */}
      {rejected.length > 0 && (
        <div className="overflow-hidden rounded-[1.25rem] border border-rose-200 bg-white">
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Rejections</p>
          </div>
          <div className="divide-y divide-rose-50">
            {rejectedOrdered.map((s, i) => {
              const task = tasks.find((t) => t.id === s.taskId);
              return (
                <div key={s.id} className="px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] text-muted">
                        {task ? `${task.title} · ` : ""}P{(s.promptIndex ?? i) + 1}
                      </p>
                      <p className="truncate text-sm font-medium text-ink">{s.promptText ?? "—"}</p>
                      {s.qaNote && (
                        <p className="truncate text-xs text-rose-700">{s.qaNote}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Rejected</span>
                  </div>
                  {s.audioUrl && (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <audio controls src={s.audioUrl} className="mt-2 h-8 w-full rounded-lg" style={{ height: "32px" }} />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* In review — compact, no audio */}
      {inReview.length > 0 && (
        <div className="overflow-hidden rounded-[1.25rem] border border-amber-200 bg-white">
          <div className="border-b border-amber-100 bg-amber-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-600">Under review</p>
          </div>
          <div className="divide-y divide-amber-50">
            {inReview.map((s, i) => {
              const task = tasks.find((t) => t.id === s.taskId);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted">
                      {task ? `${task.title} · ` : ""}P{(s.promptIndex ?? i) + 1}
                    </p>
                    <p className="truncate text-sm text-ink">{s.promptText ?? "—"}</p>
                  </div>
                  <span className={["shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold", QA_COLOR[s.qaStatus] ?? QA_COLOR.pending].join(" ")}>
                    {QA_LABEL[s.qaStatus] ?? "Pending"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Approved — compact, no audio */}
      {approved.length > 0 && (
        <div className="overflow-hidden rounded-[1.25rem] border border-emerald-200 bg-white">
          <div className="border-b border-emerald-100 bg-emerald-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-600">Approved</p>
          </div>
          <div className="divide-y divide-emerald-50">
            {approved.map((s, i) => {
              const task = tasks.find((t) => t.id === s.taskId);
              return (
                <div key={s.id} className="flex items-center justify-between gap-2 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] text-muted">
                      {task ? `${task.title} · ` : ""}P{(s.promptIndex ?? i) + 1}
                    </p>
                    <p className="truncate text-sm text-ink">{s.promptText ?? "—"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">✓ Approved</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {assignmentSessions.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No recordings found for this project.</p>
      )}
    </div>
  );
}

// ─── Reviews list ─────────────────────────────────────────────────────────────

function Reviews({
  assignments,
  sessions,
  speaker,
}: {
  assignments: DCAssignment[];
  sessions: DCSession[];
  speaker: DCSpeaker;
}) {
  const [selectedAssignment, setSelectedAssignment] = useState<DCAssignment | null>(null);
  const [detailProject, setDetailProject] = useState<DCProject | null>(null);
  const [reRecordSessions, setReRecordSessions] = useState<DCSession[] | null>(null);
  const [projectsMap, setProjectsMap] = useState<Record<string, DCProject>>({});

  // Subscribe to all submitted projects so the list can apply the same validity filter
  const submitted = assignments.filter((a) => a.submittedForReview);
  const submittedIds = submitted.map((a) => a.id).join(",");
  useEffect(() => {
    if (submitted.length === 0) return;
    const unsubs = submitted.map((a) =>
      subscribeToDCProjectById(a.projectId, (p) => {
        if (p) setProjectsMap((prev) => ({ ...prev, [a.projectId]: p }));
      })
    );
    return () => { unsubs.forEach((u) => u()); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submittedIds]);

  useEffect(() => {
    if (!selectedAssignment) { setDetailProject(null); return; }
    return subscribeToDCProjectById(selectedAssignment.projectId, setDetailProject);
  }, [selectedAssignment?.id]);

  // ── Re-record flow ──
  if (reRecordSessions && selectedAssignment) {
    return (
      <ReRecordFlow
        assignment={selectedAssignment}
        project={detailProject}
        speaker={speaker}
        rejectedSessions={reRecordSessions}
        onDone={() => setReRecordSessions(null)}
      />
    );
  }

  // ── Detail page ──
  if (selectedAssignment) {
    const assignmentSessions = sessions.filter((s) => s.assignmentId === selectedAssignment.id && Boolean(s.audioUrl));
    return (
      <ReviewDetail
        assignment={selectedAssignment}
        assignmentSessions={assignmentSessions}
        project={detailProject}
        onBack={() => setSelectedAssignment(null)}
        onReRecord={(rejected) => setReRecordSessions(rejected)}
      />
    );
  }

  // ── Empty state ──
  if (submitted.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Reviews</h1>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-2xl">◎</p>
          <p className="mt-3 text-sm font-medium text-ink">Nothing submitted yet</p>
          <p className="mt-1 text-sm text-muted">Complete a project and submit it for review — it will appear here.</p>
        </div>
      </div>
    );
  }

  // ── List ──
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">Reviews</h1>

      <div className="space-y-3">
        {submitted.map((a) => {
          const assignmentSessions = sessions.filter((s) => s.assignmentId === a.id && Boolean(s.audioUrl));
          const project = projectsMap[a.projectId] ?? null;
          const tasks = project?.tasks ?? [];
          const validSessions = project === null || tasks.length === 0
            ? assignmentSessions
            : assignmentSessions.filter((s) => {
                if (!s.taskId || s.promptIndex == null) return false;
                const task = tasks.find((t) => t.id === s.taskId);
                return task != null && s.promptIndex >= 0 && s.promptIndex < task.prompts.length;
              });
          const rejectedCount = validSessions.filter((s) => s.qaStatus === "rejected").length;
          const approvedCount = validSessions.filter((s) => s.qaStatus === "approved").length;
          const pendingCount = validSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review").length;
          const allApproved = approvedCount === validSessions.length && validSessions.length > 0;

          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setSelectedAssignment(a)}
              className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-slate-300 hover:shadow-sm"
            >
              <div className="min-w-0">
                {a.projectDialect && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{a.projectDialect}</p>
                )}
                <p className="truncate text-sm font-semibold text-ink">{a.projectName}</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {allApproved && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">All approved ✓</span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{rejectedCount} rejected</span>
                  )}
                  {pendingCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{pendingCount} in review</span>
                  )}
                  {approvedCount > 0 && !allApproved && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{approvedCount} approved</span>
                  )}
                </div>
              </div>
              <span className="shrink-0 text-sm text-muted/50">›</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── Profile sub-components ───────────────────────────────────────────────────

const fieldCls = "w-full rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/40 focus:border-primary focus:bg-white focus:ring-2 focus:ring-primary/10";
const labelCls = "mb-1.5 block text-[13px] font-medium text-ink";

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
        <div className="h-3.5 w-[3px] shrink-0 rounded-full bg-primary" />
        <span className="text-[13px] font-semibold text-ink">{title}</span>
      </div>
      <div className="space-y-4 p-5">{children}</div>
    </div>
  );
}

function LanguagePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [pickKey, setPickKey] = useState(0);

  return (
    <div className="space-y-3">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((lang) => (
            <span
              key={lang}
              className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary"
            >
              {lang}
              <button
                type="button"
                onClick={() => onChange(selected.filter((l) => l !== lang))}
                aria-label={`Remove ${lang}`}
                className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[15px] leading-none text-primary/50 transition hover:bg-primary/20 hover:text-primary"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <select
        key={pickKey}
        className={fieldCls}
        defaultValue=""
        onChange={(e) => {
          const val = e.target.value;
          if (val && !selected.includes(val)) {
            onChange([...selected, val]);
            setPickKey((k) => k + 1);
          }
        }}
      >
        <option value="" disabled>
          {selected.length === 0 ? "Select a language…" : "+ Add another language…"}
        </option>
        {LANGUAGES.filter((l) => !selected.includes(l)).map((l) => (
          <option key={l} value={l}>{l}</option>
        ))}
      </select>
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function Profile({
  speaker,
  onSaved,
  isOnboarding,
  joiningRoomId,
}: {
  speaker: DCSpeaker;
  onSaved: (s: DCSpeaker) => void;
  isOnboarding: boolean;
  joiningRoomId?: string;
}) {
  const [editing, setEditing] = useState(isOnboarding);
  const [form, setForm] = useState({
    firstName: speaker.firstName,
    lastName: speaker.lastName,
    dateOfBirth: speaker.dateOfBirth,
    gender: speaker.gender,
    country: speaker.country,
    region: speaker.region,
    languages: speaker.languages,
    phoneCountryCode:
      speaker.phoneCountryCode ||
      (COUNTRIES.find((c) => c.name === speaker.country)?.dial ?? ""),
    phone: speaker.phone,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleCountryChange(country: string) {
    const dial = COUNTRIES.find((c) => c.name === country)?.dial ?? form.phoneCountryCode;
    setForm((f) => ({ ...f, country, phoneCountryCode: dial }));
  }

  function cancelEdit() {
    setForm({
      firstName: speaker.firstName,
      lastName: speaker.lastName,
      dateOfBirth: speaker.dateOfBirth,
      gender: speaker.gender,
      country: speaker.country,
      region: speaker.region,
      languages: speaker.languages,
      phoneCountryCode:
        speaker.phoneCountryCode ||
        (COUNTRIES.find((c) => c.name === speaker.country)?.dial ?? ""),
      phone: speaker.phone,
    });
    setError("");
    setEditing(false);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!form.firstName.trim() || !form.lastName.trim()) {
      setError("Please enter your first and last name.");
      return;
    }
    if (!form.dateOfBirth) {
      setError("Please enter your date of birth.");
      return;
    }
    if (calcAge(form.dateOfBirth) < 18) {
      setError("You must be at least 18 years old to participate.");
      return;
    }
    if (!form.gender) {
      setError("Please select your gender.");
      return;
    }
    if (!form.country) {
      setError("Please select your country.");
      return;
    }
    if (!form.region.trim()) {
      setError("Please enter your city or region.");
      return;
    }
    if (form.languages.length === 0) {
      setError("Please select at least one language.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Please enter your phone number.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const updatedName = `${firstName} ${lastName}`;
      await updateDCSpeakerProfile({
        firstName,
        lastName,
        name: updatedName,
        dateOfBirth: form.dateOfBirth,
        age: String(calcAge(form.dateOfBirth)),
        gender: form.gender,
        country: form.country,
        region: form.region.trim(),
        languages: form.languages,
        phoneCountryCode: form.phoneCountryCode,
        phone: form.phone.trim(),
      });
      onSaved({
        ...speaker,
        firstName,
        lastName,
        name: updatedName,
        dateOfBirth: form.dateOfBirth,
        age: String(calcAge(form.dateOfBirth)),
        gender: form.gender,
        country: form.country,
        region: form.region.trim(),
        languages: form.languages,
        phoneCountryCode: form.phoneCountryCode,
        phone: form.phone.trim(),
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  // ── Read-only view ────────────────────────────────────────────────────────

  if (!editing) {
    const initials = [speaker.firstName?.[0], speaker.lastName?.[0]]
      .filter(Boolean)
      .join("")
      .toUpperCase() || "?";

    return (
      <div className="space-y-3">
        {/* Hero card */}
        <div className="relative overflow-hidden rounded-[1.75rem] border border-slate-200 bg-gradient-to-br from-primary/[0.07] via-primary/[0.03] to-transparent p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-[#4ea3ff] text-lg font-bold text-white shadow-sm">
                {initials}
              </div>
              <div>
                <p className="text-base font-semibold text-ink">{speaker.firstName} {speaker.lastName}</p>
                <p className="mt-0.5 text-sm text-muted">{speaker.email}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="shrink-0 rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-muted shadow-sm hover:bg-slate-50 active:scale-95"
            >
              Edit
            </button>
          </div>

          {/* Stat pills */}
          <div className="mt-4 flex flex-wrap gap-1.5">
            {speaker.gender && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink capitalize shadow-sm">
                {speaker.gender.replace("_", " ")}
              </span>
            )}
            {speaker.age && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                {speaker.age} yrs
              </span>
            )}
            {speaker.country && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                {speaker.country}
              </span>
            )}
            {speaker.region && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                {speaker.region}
              </span>
            )}
            {speaker.languages.length > 0 && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                {speaker.languages.length} language{speaker.languages.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Details list */}
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Date of birth</p>
            <p className="text-sm font-medium text-ink">{formatDOB(speaker.dateOfBirth)}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Age</p>
            <p className="text-sm font-medium text-ink">{speaker.age ? `${speaker.age} years old` : "—"}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Gender</p>
            <p className="text-sm font-medium capitalize text-ink">{speaker.gender ? speaker.gender.replace("_", " ") : "—"}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Country</p>
            <p className="text-sm font-medium text-ink">{speaker.country || "—"}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">City / Region</p>
            <p className="text-sm font-medium text-ink">{speaker.region || "—"}</p>
          </div>
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="mb-2.5 text-xs font-medium text-muted">Languages</p>
            {speaker.languages.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {speaker.languages.map((l) => (
                  <span key={l} className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                    {l}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm font-medium text-ink">—</p>
            )}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <p className="text-xs font-medium text-muted">Phone</p>
            <p className="text-sm font-medium text-ink">
              {[speaker.phoneCountryCode, speaker.phone].filter(Boolean).join(" ") || "—"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit / Onboarding form ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Saving overlay — shown during onboarding profile save */}
      {isOnboarding && saving && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/95 backdrop-blur-sm">
          <div className="flex w-72 flex-col items-center text-center">
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-primary" />
            <p className="mt-5 text-base font-semibold text-ink">Saving your profile…</p>
            <p className="mt-1 text-sm text-muted">This only takes a moment.</p>
            <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div className="h-full animate-pulse rounded-full bg-primary" />
            </div>
          </div>
        </div>
      )}

      {/* Room-join banner (shown when arriving via invite link) */}
      {isOnboarding && joiningRoomId && (
        <div className="flex items-start gap-3 rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3.5">
          <span className="mt-0.5 shrink-0 text-base">🎙️</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">You&apos;ve been invited to a recording session</p>
            <p className="mt-0.5 text-xs leading-5 text-amber-700">
              Complete your speaker profile below and you&apos;ll be taken straight into the session.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      {isOnboarding ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent px-5 pb-6 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Speaker Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">
            {joiningRoomId ? "One quick step to join" : "Set up your profile"}
          </h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            {joiningRoomId
              ? "Your details are embedded in every recording. Fill these in accurately — it only takes a minute."
              : "Your details are embedded in every recording — fill these in correctly."}
          </p>
        </div>
      ) : (
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Edit Profile</h1>
      )}

      {/* Signed-in email */}
      <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {speaker.email[0].toUpperCase()}
        </div>
        <div>
          <p className="text-[11px] text-muted">Signed in as</p>
          <p className="text-sm font-medium text-ink">{speaker.email}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      )}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-3">
        {/* Personal details */}
        <SectionCard title="Personal details">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>First name <span className="text-primary">*</span></span>
              <input
                className={fieldCls}
                placeholder="Ali"
                value={form.firstName}
                onChange={(e) => set("firstName", e.target.value)}
                required
              />
            </label>
            <label className="block">
              <span className={labelCls}>Last name <span className="text-primary">*</span></span>
              <input
                className={fieldCls}
                placeholder="Ahmed"
                value={form.lastName}
                onChange={(e) => set("lastName", e.target.value)}
                required
              />
            </label>
          </div>
          <label className="block">
            <span className={labelCls}>Date of birth <span className="text-primary">*</span></span>
            <input
              type="date"
              max={maxDOBDate()}
              className={fieldCls}
              value={form.dateOfBirth}
              onChange={(e) => set("dateOfBirth", e.target.value)}
              required
            />
            {form.dateOfBirth && (
              <p className="mt-1.5 text-xs text-muted">
                Age: <span className="font-semibold text-ink">{calcAge(form.dateOfBirth)} years old</span>
              </p>
            )}
          </label>
          <label className="block">
            <span className={labelCls}>Gender <span className="text-primary">*</span></span>
            <select
              className={fieldCls}
              value={form.gender}
              onChange={(e) => set("gender", e.target.value)}
              required
            >
              <option value="">Select gender…</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </select>
          </label>
        </SectionCard>

        {/* Location */}
        <SectionCard title="Where are you based?">
          <label className="block">
            <span className={labelCls}>Country <span className="text-primary">*</span></span>
            <select
              className={fieldCls}
              value={form.country}
              onChange={(e) => handleCountryChange(e.target.value)}
              required
            >
              <option value="">Select country…</option>
              {COUNTRIES.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>City / Region <span className="text-primary">*</span></span>
            <input
              className={fieldCls}
              placeholder="e.g. Lahore, London, Dubai"
              value={form.region}
              onChange={(e) => set("region", e.target.value)}
              required
            />
          </label>
        </SectionCard>

        {/* Languages */}
        <SectionCard title="Languages you speak">
          <p className="text-xs text-muted -mt-1">Add all languages you can record in — you can add more than one.</p>
          <LanguagePicker
            selected={form.languages}
            onChange={(langs) => set("languages", langs)}
          />
        </SectionCard>

        {/* Phone */}
        <SectionCard title="Phone number">
          <div>
            <span className={labelCls}>Number <span className="text-primary">*</span></span>
            <div className="grid grid-cols-[148px_1fr] gap-2">
              <select
                className={fieldCls}
                value={form.phoneCountryCode}
                onChange={(e) => set("phoneCountryCode", e.target.value)}
              >
                <option value="">Code…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.name} value={c.dial}>{c.dial} ({c.name})</option>
                ))}
              </select>
              <input
                type="tel"
                className={fieldCls}
                placeholder="3001234567"
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                required
              />
            </div>
          </div>
        </SectionCard>

        {/* Actions */}
        <div className={["pt-1", !isOnboarding ? "grid grid-cols-2 gap-3" : ""].join(" ")}>
          {!isOnboarding && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-full border border-slate-200 py-3.5 text-sm font-semibold text-muted hover:bg-slate-50 active:scale-[0.98]"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(43,133,240,0.3)] hover:bg-primaryStrong disabled:opacity-60 active:scale-[0.98]"
          >
            {saving ? "Saving…" : isOnboarding ? (joiningRoomId ? "Complete Profile & Join Session →" : "Complete Profile →") : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Guidelines ───────────────────────────────────────────────────────────────

function Guidelines() {
  const sections = [
    { title: "Microphone setup", body: "Use a dedicated microphone or a good quality headset. Position it 15–20 cm from your mouth, slightly off to the side. On mobile, hold the phone naturally — don't cover the mic with your fingers." },
    { title: "Recording environment", body: "Record in a quiet, enclosed room. Soft furnishings like carpets and curtains absorb echo. Avoid open windows, fans, air conditioners, or busy roads." },
    { title: "Background noise", body: "Silence your phone notifications, close doors, and ask others to stay quiet. Do not record near a TV, radio, or music." },
    { title: "How to speak", body: "Speak naturally and clearly at your normal pace. Do not over-enunciate or slow down — natural speech is exactly what the project needs." },
    { title: "Prompts", body: "Each task may include prompts shown to you before recording. Read each one carefully and speak freely. Spontaneous natural speech is preferred over scripted delivery." },
    { title: "Session length", body: "Each session has a minimum and maximum duration shown in your task cards. Aim for the upper end when you can — longer uninterrupted sessions are more valuable." },
    { title: "Making mistakes", body: "If you stumble, pause briefly and continue. Do not stop and re-record unless the error was significant. Minor stumbles are fine and natural." },
    { title: "How submissions are reviewed", body: "After you submit, recordings go through automated transcription then a human QA review checking audio quality, dialect accuracy, and natural speech. You can see session status in your Dashboard." },
    { title: "Support", body: "If you have a technical issue or question about a project, contact your project coordinator at the email you were invited from." },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Recording Guidelines</h1>
        <p className="mt-1 text-sm text-muted">Everything you need to record high-quality speech data.</p>
      </div>
      <div className="space-y-2">
        {sections.map((s) => (
          <details key={s.title} className="group rounded-xl border border-slate-200 bg-white px-5 py-4">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-medium text-ink">
              {s.title}
              <span className="shrink-0 text-muted transition group-open:rotate-180">▾</span>
            </summary>
            <p className="mt-3 text-sm leading-7 text-muted">{s.body}</p>
          </details>
        ))}
      </div>
    </div>
  );
}

// ─── Conversational project ───────────────────────────────────────────────────

const STUN_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
];

function ConversationalProjectView({
  user,
  speaker,
  assignment,
  project,
  roomId: propRoomId,
  onBack,
}: {
  user: User;
  speaker: DCSpeaker;
  assignment: DCAssignment | null;
  project: DCProject | null;
  roomId: string;
  onBack: () => void;
}) {
  const [room, setRoom] = useState<DCConversationRoom | null>(null);
  const [roomLoading, setRoomLoading] = useState(true);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [kicked, setKicked] = useState(false);
  // For secondary speakers: true once /api/dc-room/join-secondary succeeds (primary starts true)
  const [secondaryApiDone, setSecondaryApiDone] = useState(assignment !== null);
  const [copyDone, setCopyDone] = useState(false);

  // Local recording state (reset per task)
  const [localBlob, setLocalBlob] = useState<{ blob: Blob; mimeType: string; duration: number; url: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [levelBars, setLevelBars] = useState<number[]>(Array(24).fill(0));
  const [warnShown, setWarnShown] = useState(false);
  const [myUploadStatus, setMyUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [localConnecting, setLocalConnecting] = useState(false);
  const [webrtcError, setWebrtcError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const processedIcePrimaryRef = useRef<Set<string>>(new Set());
  const processedIceSecondaryRef = useRef<Set<string>>(new Set());
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const offerHandledRef = useRef(false);
  const answerHandledRef = useRef(false);
  const roomRef = useRef<DCConversationRoom | null>(null);
  const prevTaskIndexRef = useRef(-1);
  const prevStatusRef = useRef<string>("waiting");
  const everJoinedRef = useRef(false);

  const myEmail = user.email?.toLowerCase() ?? "";
  const isPrimary = assignment !== null;
  const roomId = room?.id ?? propRoomId;
  const myParticipant = room?.participants.find((p) => p.email === myEmail) ?? null;
  const iAmJoined = myParticipant !== null;
  const currentTaskIndex = room?.taskIndex ?? 0;
  const currentTask = project?.tasks[currentTaskIndex] ?? null;
  const prompt = currentTask?.prompts[0] ?? null;
  const minSec = currentTask?.minDurationSeconds ?? 10;
  const maxSec = currentTask?.maxDurationSeconds ?? 300;
  const totalTasks = project?.tasks.length ?? 0;
  const isLastTask = currentTaskIndex >= totalTasks - 1;
  const requiredSpeakers = room?.speakersRequired ?? 2;
  const onlineCount = room?.participants.filter((p) => p.online).length ?? 0;
  const allJoined = onlineCount >= requiredSpeakers;
  const allUploaded = (room?.participants ?? []).length > 0 &&
    room!.participants.every((p) => p.uploadStatus === "done");

  // Keep roomRef current for use inside async callbacks
  useEffect(() => { roomRef.current = room; }, [room]);

  // Initialize room (primary only)
  useEffect(() => {
    if (!assignment || !project) return;
    const speakersRequired = project.tasks[0]?.speakersRequired ?? 2;
    void createOrGetConversationRoom({
      assignmentId: assignment.id,
      projectId: assignment.projectId,
      primaryUid: user.uid,
      primaryEmail: myEmail,
      primaryName: speaker.name || `${speaker.firstName} ${speaker.lastName}`.trim() || myEmail,
      speakersRequired,
      totalTasks: project.tasks.length,
    }).catch((e) => setJoinError(e instanceof Error ? e.message : "Failed to create session."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignment?.id]);

  // Secondary: ensure speakerAccess doc exists before subscribing
  useEffect(() => {
    if (isPrimary) return;
    const { auth } = getFirebaseClientServices();
    void (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("Not signed in");
        const name = speaker.name || `${speaker.firstName} ${speaker.lastName}`.trim() || myEmail;
        const res = await fetch("/api/dc-room/join-secondary", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
          body: JSON.stringify({ name }),
        });
        if (!res.ok) {
          const j = await res.json() as { error?: string };
          throw new Error(j.error ?? `API error ${res.status}`);
        }
        setSecondaryApiDone(true);
      } catch (e) {
        setJoinError(e instanceof Error ? e.message : "Failed to join session.");
        setRoomLoading(false);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Subscribe to room
  useEffect(() => {
    if (!propRoomId || !secondaryApiDone) return;
    return subscribeToConversationRoom(
      propRoomId,
      (r) => {
        setRoom(r);
        setRoomLoading(false);
        if (!isPrimary && r) {
          const amIn = r.participants.some((p) => p.email === myEmail);
          if (amIn) everJoinedRef.current = true;
          else if (everJoinedRef.current) setKicked(true);
        }
      },
      (err) => {
        setJoinError(
          err.message.includes("permission")
            ? "Access denied. Ask the host to re-share the invite link."
            : err.message,
        );
        setRoomLoading(false);
      },
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propRoomId, secondaryApiDone]);

  // Secondary: join room when it appears and we haven't joined
  useEffect(() => {
    if (isPrimary || !room || iAmJoined) return;
    void joinConversationRoom(room.id, {
      uid: user.uid,
      email: myEmail,
      name: speaker.name || `${speaker.firstName} ${speaker.lastName}`.trim() || myEmail,
      online: true,
      ready: false,
      uploadStatus: "idle",
    }).catch((e) => setJoinError(e instanceof Error ? e.message : "Failed to join session."));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, isPrimary, iAmJoined]);

  // Secondary: set up WebRTC as soon as the offer appears in the room doc.
  // This fires while status is still "waiting" (before primary's PC connects),
  // so we can't rely on the status-change effect for this.
  useEffect(() => {
    if (isPrimary || !room?.offer || offerHandledRef.current || localStreamRef.current !== null) return;
    void setupWebRTCAndMic();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.offer]);

  // React to room status / taskIndex changes
  useEffect(() => {
    if (!room) return;
    const prevStatus = prevStatusRef.current;
    const prevTaskIndex = prevTaskIndexRef.current;
    prevStatusRef.current = room.status;
    prevTaskIndexRef.current = room.taskIndex;

    const taskChanged = room.taskIndex !== prevTaskIndex && prevTaskIndex !== -1;
    const startedRecording = room.status === "recording" && prevStatus !== "recording";
    const stoppedRecording = room.status === "stopped" && prevStatus === "recording";

    if (startedRecording || (taskChanged && room.status === "recording")) {
      // Reset per-task local state
      if (localBlob?.url) URL.revokeObjectURL(localBlob.url);
      setLocalBlob(null);
      setElapsed(0);
      setWarnShown(false);
      setMyUploadStatus("idle");
      setUploadError(null);
      // Only start if mic is already acquired; setupWebRTCAndMic() will start
      // recording at its end if it finishes after the status has changed.
      if (localStreamRef.current) {
        startLocalRecording();
      }
    }

    if (stoppedRecording) {
      stopLocalRecording();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.status, room?.taskIndex]);

  // Process WebRTC signaling whenever room updates
  useEffect(() => {
    if (!room || !pcRef.current) return;
    void processSignaling(room);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.offer, room?.answer, room?.icePrimary?.length, room?.iceSecondary?.length]);

  // Auto-stop at max duration (primary only)
  useEffect(() => {
    if (room?.status !== "recording" || !isPrimary) return;
    if (elapsed >= maxSec) void handlePrimaryStop();
    if (!warnShown && maxSec - elapsed <= 60 && elapsed > 0) setWarnShown(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, maxSec, room?.status]);

  async function setupWebRTCAndMic() {
    setLocalConnecting(true);
    setWebrtcError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      startVisualizer(stream);

      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote audio
      const remoteStream = new MediaStream();
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = new MediaStream(remoteStream.getTracks());
      };
      if (remoteAudioRef.current) remoteAudioRef.current.srcObject = remoteStream;

      // ICE candidates
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void addConvIceCandidate(roomId, isPrimary ? "primary" : "secondary", JSON.stringify(e.candidate.toJSON()));
        }
      };

      // Connection state
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          setLocalConnecting(false);
          // Primary: signal all to start recording
          if (isPrimary) {
            void updateConversationRoomStatus(roomId, "recording", { taskIndex: 0 });
          }
        }
        if (pc.connectionState === "failed") {
          setWebrtcError("Audio connection failed. Please try again.");
          setLocalConnecting(false);
        }
      };

      // Primary: create offer
      if (isPrimary && !offerHandledRef.current) {
        offerHandledRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateConversationRoomFields(roomId, { offer: JSON.stringify(offer) });
      }

      // Process any signaling that arrived before PC was ready
      if (roomRef.current) void processSignaling(roomRef.current);

      // Race-condition guard: if status is already "recording" by the time mic
      // setup finishes (primary connected quickly), start recording immediately.
      if (roomRef.current?.status === "recording" && localStreamRef.current) {
        startLocalRecording();
      }
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setWebrtcError("Microphone access denied. Please allow microphone access and try again.");
      } else {
        setWebrtcError(e instanceof Error ? e.message : "Could not access microphone.");
      }
      setLocalConnecting(false);
    }
  }

  async function processSignaling(r: DCConversationRoom) {
    const pc = pcRef.current;
    if (!pc) return;

    if (!isPrimary) {
      // Secondary: handle offer
      if (r.offer && !offerHandledRef.current && pc.signalingState === "stable") {
        offerHandledRef.current = true;
        try {
          const offer = JSON.parse(r.offer) as RTCSessionDescriptionInit;
          await pc.setRemoteDescription(offer);
          // Drain pending ICE
          for (const c of pendingIceRef.current) {
            await pc.addIceCandidate(c).catch(() => {});
          }
          pendingIceRef.current = [];
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await updateConversationRoomFields(roomId, { answer: JSON.stringify(answer) });
        } catch (e) { console.error("[WebRTC] answer error:", e); }
      }
      // Process ICE from primary
      if (r.icePrimary) {
        for (const c of r.icePrimary) {
          if (processedIcePrimaryRef.current.has(c)) continue;
          processedIcePrimaryRef.current.add(c);
          const candidate = JSON.parse(c) as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(() => {});
          } else {
            pendingIceRef.current.push(candidate);
          }
        }
      }
    } else {
      // Primary: handle answer
      if (r.answer && !answerHandledRef.current && pc.signalingState === "have-local-offer") {
        answerHandledRef.current = true;
        try {
          const answer = JSON.parse(r.answer) as RTCSessionDescriptionInit;
          await pc.setRemoteDescription(answer);
          // Drain pending ICE
          for (const c of pendingIceRef.current) {
            await pc.addIceCandidate(c).catch(() => {});
          }
          pendingIceRef.current = [];
        } catch (e) { console.error("[WebRTC] setAnswer error:", e); }
      }
      // Process ICE from secondary
      if (r.iceSecondary) {
        for (const c of r.iceSecondary) {
          if (processedIceSecondaryRef.current.has(c)) continue;
          processedIceSecondaryRef.current.add(c);
          const candidate = JSON.parse(c) as RTCIceCandidateInit;
          if (pc.remoteDescription) {
            await pc.addIceCandidate(candidate).catch(() => {});
          } else {
            pendingIceRef.current.push(candidate);
          }
        }
      }
    }
  }

  function startVisualizer(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      ctx.createMediaStreamSource(stream).connect(analyser);
      function tick() {
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        setLevelBars(Array.from({ length: 24 }, (_, i) =>
          Math.round((data[Math.floor((i / 24) * data.length)] / 255) * 100),
        ));
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();
    } catch { /* AudioContext may not be available */ }
  }

  function startLocalRecording() {
    const stream = localStreamRef.current;
    if (!stream) return;
    chunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      const preferred = MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : "audio/mp4";
      recorder = new MediaRecorder(stream, { mimeType: preferred });
    } catch { recorder = new MediaRecorder(stream); }
    const rawMime = recorder.mimeType || "";
    const mimeType = rawMime.startsWith("audio/mp4") ? "audio/mp4" : "audio/webm";
    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setLocalBlob({ blob, mimeType, duration: elapsed, url });
    };
    mediaRecorderRef.current = recorder;
    recorder.start(100);
    if (timerRef.current) clearInterval(timerRef.current);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stopLocalRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    try { mediaRecorderRef.current?.stop(); } catch { /* already stopped */ }
  }

  async function handlePrimaryStart() {
    setLocalConnecting(true);
    setWebrtcError(null);
    offerHandledRef.current = false;
    answerHandledRef.current = false;
    processedIcePrimaryRef.current.clear();
    processedIceSecondaryRef.current.clear();
    pendingIceRef.current = [];
    await setupWebRTCAndMic();
  }

  async function handlePrimaryStop() {
    stopLocalRecording();
    await updateConversationRoomStatus(roomId, "stopped");
  }

  async function handleUpload() {
    if (!localBlob || !currentTask || !project || !room) return;
    setMyUploadStatus("uploading");
    setUploadError(null);
    try {
      const sessionId = await submitConvSession({
        projectId: project.id,
        projectName: project.name,
        speakerId: myEmail,
        speakerName: speaker.name || `${speaker.firstName} ${speaker.lastName}`.trim() || myEmail,
        assignmentId: room.assignmentId,
        taskId: currentTask.id,
        promptIndex: 0,
        promptText: prompt?.text ?? "",
        audioBlob: localBlob.blob,
        mimeType: localBlob.mimeType,
        duration: localBlob.duration,
        sampleRate: 44100,
        bitDepth: 16,
        gender: speaker.gender ?? "",
        age: speaker.age ?? "",
        dialect: speaker.languages[0] ?? "",
        region: speaker.region ?? "",
      });
      setMyUploadStatus("done");
      await updateConversationRoomParticipant(roomId, user.uid, { uploadStatus: "done", sessionId });
    } catch (e) {
      setMyUploadStatus("error");
      setUploadError(e instanceof Error ? e.message : "Upload failed. Please try again.");
    }
  }

  async function handleNextTask() {
    if (!room || !isPrimary || !allUploaded) return;
    if (isLastTask) {
      setSubmitting(true);
      setSubmitError(null);
      try {
        await submitAssignmentForReview(room.assignmentId);
        await updateConversationRoomStatus(roomId, "done");
      } catch (e) {
        setSubmitError(e instanceof Error ? e.message : "Submission failed. Please try again.");
      } finally {
        setSubmitting(false);
      }
    } else {
      const nextIdx = currentTaskIndex + 1;
      const resetParticipants = room.participants.map((p) => ({ ...p, uploadStatus: "idle" as const }));
      // WebRTC connection stays alive between tasks — no signaling reset needed.
      await updateConversationRoomFields(roomId, {
        taskIndex: nextIdx,
        status: "recording",
        participants: resetParticipants,
      });
    }
  }

  async function handleRemoveParticipant(uid: string) {
    if (!room || !isPrimary) return;
    const removed = room.participants.find((p) => p.uid === uid);
    await updateConversationRoomFields(roomId, {
      participants: room.participants.filter((p) => p.uid !== uid),
      invitedEmails: removed
        ? room.invitedEmails.filter((e) => e !== removed.email)
        : room.invitedEmails,
    });
  }

  async function copyLink() {
    const url = `${window.location.origin}/speakers?section=projects&roomId=${propRoomId}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2500);
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pcRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (roomLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (kicked) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-ink">← Back</button>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <p className="text-base font-semibold text-rose-800">You have been removed from this session.</p>
          <p className="mt-1 text-sm text-rose-600">Please contact the host if you believe this is a mistake.</p>
        </div>
      </div>
    );
  }

  if (!room || !project) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-ink">← Back</button>
        <p className="text-sm text-rose-600">{joinError ?? "Session not found."}</p>
      </div>
    );
  }

  const roomStatus = room.status;

  // ── Done ──────────────────────────────────────────────────────────────────
  if (roomStatus === "done") {
    return (
      <div className="space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">← My Projects</button>
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-emerald-200 bg-emerald-50 px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">✓</span>
          <div>
            <h1 className="text-xl font-semibold text-emerald-900">Session complete</h1>
            <p className="mt-1.5 text-sm text-emerald-700">All recordings have been submitted for review.</p>
          </div>
          <button type="button" onClick={onBack} className="mt-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700">
            Back to projects
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting room ──────────────────────────────────────────────────────────
  if (roomStatus === "waiting") {
    const inviteLink = typeof window !== "undefined"
      ? `${window.location.origin}/speakers?section=projects&roomId=${room.id}`
      : "";

    return (
      <div className="space-y-5">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink">← My Projects</button>

        {/* Hero */}
        <div className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-6 py-7">
          <div className="relative z-10">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60">Conversational session</p>
            <h1 className="mt-1 text-2xl font-semibold text-white">{project.name}</h1>
            <p className="mt-2 text-sm text-white/70">
              {project.tasks.length} task{project.tasks.length !== 1 ? "s" : ""} · {requiredSpeakers} speakers required
            </p>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        </div>

        {/* Participants */}
        <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
          <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
            <p className="text-[13px] font-semibold text-ink">
              Participants ({room.participants.length}/{requiredSpeakers})
            </p>
          </div>
          <div className="divide-y divide-slate-100">
            {room.participants.map((p) => (
              <div key={p.uid} className="flex items-center gap-3 px-5 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {(p.name?.[0] ?? p.email[0] ?? "?").toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">{p.name || p.email}</p>
                  <p className="text-xs text-muted">{p.email}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {p.role === "primary" && (
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">Host</span>
                  )}
                  <span className={["h-2 w-2 rounded-full", p.online ? "bg-emerald-400" : "bg-slate-300"].join(" ")} />
                  {isPrimary && p.role !== "primary" && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveParticipant(p.uid)}
                      title="Remove speaker"
                      className="flex h-5 w-5 items-center justify-center rounded-full text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
            ))}
            {Array.from({ length: Math.max(0, requiredSpeakers - room.participants.length) }).map((_, i) => (
              <div key={`empty-${i}`} className="flex items-center gap-3 px-5 py-3 opacity-40">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-300">
                  <span className="text-slate-400">+</span>
                </div>
                <p className="text-sm text-muted">Waiting for speaker…</p>
              </div>
            ))}
          </div>
        </div>

        {/* Invite link (primary only) */}
        {isPrimary && (
          <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
            <div className="border-b border-slate-100 bg-slate-50/60 px-5 py-3.5">
              <p className="text-[13px] font-semibold text-ink">Invite other speakers</p>
            </div>
            <div className="space-y-3 p-5">
              <p className="text-sm text-muted">Share this link with the other speaker(s). They must be signed in to the speaker portal.</p>
              <div className="flex gap-2">
                <div className="min-w-0 flex-1 overflow-hidden rounded-[0.75rem] border border-slate-200 bg-panelStrong px-3.5 py-2.5">
                  <p className="truncate font-mono text-xs text-muted">{inviteLink}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="shrink-0 rounded-[0.75rem] bg-primary px-4 py-2.5 text-xs font-semibold text-white hover:bg-primaryStrong"
                >
                  {copyDone ? "Copied ✓" : "Copy"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Start / waiting */}
        {isPrimary ? (
          <div className="space-y-3">
            {!allJoined && (
              <p className="text-center text-sm text-muted">
                Waiting for {requiredSpeakers - room.participants.length} more speaker{requiredSpeakers - room.participants.length !== 1 ? "s" : ""} to join…
              </p>
            )}
            {webrtcError && <p className="text-center text-sm text-rose-600">{webrtcError}</p>}
            <button
              type="button"
              disabled={!allJoined || localConnecting}
              onClick={() => void handlePrimaryStart()}
              className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-40"
            >
              {localConnecting ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                  Connecting audio…
                </span>
              ) : "Start session →"}
            </button>
          </div>
        ) : (
          <div className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-6 text-center">
            <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
            <p className="mt-3 text-sm font-medium text-ink">You&apos;ve joined!</p>
            <p className="mt-1 text-xs text-muted">Waiting for the host to start the session…</p>
          </div>
        )}

        {joinError && <p className="text-center text-sm text-rose-600">{joinError}</p>}
      </div>
    );
  }

  // ── Recording / stopped phase ─────────────────────────────────────────────
  const isRecording = roomStatus === "recording";
  const isStopped = roomStatus === "stopped";
  const canStop = isPrimary && isRecording && elapsed >= minSec;
  const timerColor = elapsed >= maxSec * 0.9 ? "text-rose-500" : elapsed >= maxSec * 0.7 ? "text-amber-500" : "text-ink";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted">Task {currentTaskIndex + 1} of {totalTasks}</p>
          <h1 className="mt-0.5 text-xl font-semibold text-ink">{currentTask?.title ?? "Recording"}</h1>
        </div>
        <span className={[
          "shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
          isRecording ? "bg-rose-100 text-rose-700 animate-pulse" : "bg-amber-100 text-amber-700",
        ].join(" ")}>
          {isRecording ? "● Recording" : "■ Stopped"}
        </span>
      </div>

      {/* Participant upload status (stopped phase) */}
      {isStopped && (
        <div className="flex flex-wrap gap-2">
          {room.participants.map((p) => (
            <div key={p.uid} className={[
              "flex items-center gap-1.5 rounded-full border px-3 py-1",
              p.uploadStatus === "done" ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white",
            ].join(" ")}>
              <span className={["h-2 w-2 rounded-full shrink-0", p.uploadStatus === "done" ? "bg-emerald-400" : p.uploadStatus === "uploading" ? "bg-amber-400 animate-pulse" : "bg-slate-300"].join(" ")} />
              <span className="text-xs font-medium text-ink">{p.name?.split(" ")[0] ?? p.email}</span>
              <span className="text-[10px] text-muted">{p.uploadStatus === "done" ? "✓ uploaded" : p.uploadStatus === "uploading" ? "uploading…" : "pending"}</span>
            </div>
          ))}
        </div>
      )}

      {/* Prompt */}
      {prompt && (
        <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50 p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">Prompt</p>
          <p className="text-sm leading-7 text-ink">{prompt.text}</p>
          <p className="mt-2 text-[11px] text-muted">Min {minSec}s · Max {maxSec}s</p>
        </div>
      )}

      {/* 1-minute warning */}
      {warnShown && isRecording && (
        <div className="rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          ⚠ Less than 1 minute remaining — start wrapping up naturally.
        </div>
      )}

      {/* Remote audio (hidden — live call) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* Recorder UI */}
      {isRecording && (
        <div className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-slate-200 bg-white px-4 py-10">
          <p className={["font-mono text-5xl font-light tracking-tight sm:text-6xl", timerColor].join(" ")}>
            {formatDuration(elapsed)}
          </p>
          <div className="flex h-10 items-end gap-[2px]" aria-hidden="true">
            {levelBars.map((h, i) => (
              <div key={i} className="w-[3px] rounded-full bg-primary transition-all duration-75" style={{ height: `${Math.max(4, h)}%` }} />
            ))}
          </div>
          <p className="animate-pulse text-xs text-muted">Recording… speak naturally</p>
          {isPrimary ? (
            <button
              type="button"
              onClick={() => void handlePrimaryStop()}
              disabled={!canStop}
              className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-600 text-xl text-white shadow-[0_4px_24px_rgba(220,38,38,0.4)] hover:bg-rose-700 disabled:opacity-40 active:scale-95"
            >
              ⏹
            </button>
          ) : (
            <div className="text-xs text-muted">Recording in progress — host will stop when done</div>
          )}
          {!canStop && isPrimary && (
            <p className="text-xs text-muted">Minimum {minSec}s · {Math.max(0, minSec - elapsed)}s remaining before you can stop</p>
          )}
        </div>
      )}

      {/* Connecting spinner (waiting for WebRTC while room is recording) */}
      {isRecording && localConnecting && (
        <div className="flex items-center justify-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-4">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          <span className="text-sm text-muted">Setting up audio call…</span>
        </div>
      )}
      {webrtcError && (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{webrtcError}</div>
      )}

      {/* Stopped: playback + upload */}
      {isStopped && localBlob && (
        <div className="space-y-3 rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-ink">Your recording ({formatDuration(localBlob.duration)})</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={localBlob.url} className="w-full rounded-xl" />
          {myUploadStatus === "idle" && (
            <button
              type="button"
              onClick={() => void handleUpload()}
              className="w-full rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
            >
              Upload recording →
            </button>
          )}
          {myUploadStatus === "uploading" && (
            <div className="flex items-center justify-center gap-2 py-1">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
              <span className="text-sm text-muted">Uploading…</span>
            </div>
          )}
          {myUploadStatus === "done" && (
            <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2">
              <span className="text-emerald-500">✓</span>
              <span className="text-sm font-semibold text-emerald-900">Uploaded successfully</span>
            </div>
          )}
          {myUploadStatus === "error" && uploadError && (
            <div className="space-y-2">
              <p className="text-sm text-rose-600">{uploadError}</p>
              <button
                type="button"
                onClick={() => void handleUpload()}
                className="w-full rounded-full border border-rose-200 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50"
              >
                Retry upload
              </button>
            </div>
          )}
        </div>
      )}

      {/* Stopped with no local blob (joined late or mic failed) */}
      {isStopped && !localBlob && myUploadStatus === "idle" && (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-5 py-4">
          <p className="text-sm text-amber-800">No recording captured on your device.</p>
          <button
            type="button"
            onClick={() => {
              setMyUploadStatus("done");
              void updateConversationRoomParticipant(roomId, user.uid, { uploadStatus: "done" });
            }}
            className="mt-3 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"
          >
            Skip and continue
          </button>
        </div>
      )}

      {/* Next task / submit (primary only, all must upload first) */}
      {isStopped && isPrimary && (
        <div className="space-y-2">
          {!allUploaded && (
            <p className="text-center text-xs text-muted">Waiting for all speakers to finish uploading…</p>
          )}
          <button
            type="button"
            disabled={!allUploaded || submitting}
            onClick={() => void handleNextTask()}
            className="w-full rounded-full bg-primary py-3.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-40"
          >
            {submitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                Submitting…
              </span>
            ) : isLastTask ? "Submit for review →" : `Next task →`}
          </button>
          {submitError && <p className="text-center text-sm text-rose-600">{submitError}</p>}
        </div>
      )}

      {/* Secondary waiting for next task */}
      {isStopped && !isPrimary && myUploadStatus === "done" && (
        <div className="flex items-center justify-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4">
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          <span className="text-sm text-muted">Waiting for the host to advance…</span>
        </div>
      )}
    </div>
  );
}

// ─── Speaker portal (logged-in) ───────────────────────────────────────────────

function SpeakerPortal({ user }: { user: User }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSection = searchParams.get("section") ?? "dashboard";
  const section = (VALID_SECTIONS.includes(rawSection as SpeakerSection) ? rawSection : "dashboard") as SpeakerSection;
  const roomIdParam = searchParams.get("roomId");

  const [speaker, setSpeaker] = useState<DCSpeaker | null>(null);
  const [speakerLoading, setSpeakerLoading] = useState(true);
  const [assignments, setAssignments] = useState<DCAssignment[]>([]);
  const [sessions, setSessions] = useState<DCSession[]>([]);

  // Projects navigation state
  const [activeAssignment, setActiveAssignment] = useState<DCAssignment | null>(null);
  const [activeProject, setActiveProject] = useState<DCProject | null>(null);
  const [activeProjectLoading, setActiveProjectLoading] = useState(false);
  const [activeTask, setActiveTask] = useState<{ task: DCTaskTemplate; taskIndex: number; initialPromptIndex: number } | null>(null);
  const [pendingReRecord, setPendingReRecord] = useState<{ taskId: string; promptIndex: number } | null>(null);

  // Secondary speaker: joining via roomId URL param
  const [convRoom, setConvRoom] = useState<DCConversationRoom | null>(null);
  const [convProject, setConvProject] = useState<DCProject | null>(null);

  function navigateTo(s: SpeakerSection) {
    // Reset project drill-down when switching sections
    setActiveAssignment(null);
    setActiveProject(null);
    setActiveTask(null);
    router.push(`/speakers?section=${s}`);
  }

  useEffect(() => {
    setSpeakerLoading(true);
    return subscribeToDCSpeakerProfileByUid(user.uid, (s) => {
      setSpeaker((prev) => {
        // Never let a stale snapshot degrade a complete profile back to incomplete
        if (prev && s && isProfileComplete(prev) && !isProfileComplete(s)) return prev;
        return s;
      });
      setSpeakerLoading(false);
    });
  }, [user.uid]);

  useEffect(() => {
    if (!user.email) return;
    const email = user.email.trim().toLowerCase();
    const u1 = subscribeToDCAssignmentsBySpeaker(
      email,
      setAssignments,
      (err) => console.error("[Speaker] assignments error:", err),
    );
    const u2 = subscribeToDCSessionsBySpeaker(
      email,
      setSessions,
      (err) => console.error("[Speaker] sessions error:", err),
    );
    return () => { u1(); u2(); };
  }, [user.email]);

  // Subscribe to project detail when an assignment is selected
  useEffect(() => {
    if (!activeAssignment) {
      setActiveProject(null);
      return;
    }
    setActiveProjectLoading(true);
    return subscribeToDCProjectById(activeAssignment.projectId, (p) => {
      setActiveProject(p);
      setActiveProjectLoading(false);
    });
  }, [activeAssignment]);

  // Secondary: subscribe to room when joining via roomId URL param
  useEffect(() => {
    if (!roomIdParam) return;
    // If the user owns an assignment with this ID, treat as primary (handled normally)
    if (assignments.some((a) => a.id === roomIdParam)) return;
    return subscribeToConversationRoom(roomIdParam, setConvRoom);
  }, [roomIdParam, assignments]);

  useEffect(() => {
    if (!convRoom) return;
    return subscribeToDCProjectById(convRoom.projectId, setConvProject);
  }, [convRoom?.projectId]);

  // Navigate to a specific task/prompt once the project loads (used by Reviews re-record)
  useEffect(() => {
    if (!pendingReRecord || !activeProject) return;
    const tasks = activeProject.tasks ?? [];
    const taskIdx = tasks.findIndex((t) => t.id === pendingReRecord.taskId);
    if (taskIdx >= 0) {
      setActiveTask({ task: tasks[taskIdx], taskIndex: taskIdx, initialPromptIndex: pendingReRecord.promptIndex });
      setPendingReRecord(null);
    }
  }, [activeProject, pendingReRecord]);

  async function handleSignOut() {
    const { auth } = getFirebaseClientServices();
    await signOut(auth);
  }

  if (speakerLoading) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[60vh] items-center justify-center">
          <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      </DeaimerSiteShell>
    );
  }

  if (speaker?.status === "suspended") {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl font-semibold text-ink">Account suspended</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">Your speaker account has been suspended. Contact your project coordinator.</p>
          <button type="button" onClick={() => void handleSignOut()} className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong">
            Sign out
          </button>
        </div>
      </DeaimerSiteShell>
    );
  }

  const speakerForDisplay = speaker ?? createEmptySpeaker(user);
  const profileComplete = isProfileComplete(speakerForDisplay);
  const effectiveSection: SpeakerSection = profileComplete ? section : "profile";

  const speakerMenuItems: PlatformSideMenuItem[] = profileComplete
    ? [
        { label: "Main",        isSectionHeader: true },
        { label: "Dashboard",   href: "/speakers?section=dashboard",  active: effectiveSection === "dashboard" },
        { label: "My Projects", href: "/speakers?section=projects",   active: effectiveSection === "projects" },
        { label: "Reviews",     href: "/speakers?section=reviews",    active: effectiveSection === "reviews" },
        { label: "Account",     isSectionHeader: true },
        { label: "Profile",     href: "/speakers?section=profile",    active: effectiveSection === "profile" },
        { label: "Guidelines",  href: "/speakers?section=guidelines", active: effectiveSection === "guidelines" },
      ]
    : [];

  const userProfile = {
    name:
      (speakerForDisplay.firstName && speakerForDisplay.lastName
        ? `${speakerForDisplay.firstName} ${speakerForDisplay.lastName}`
        : speakerForDisplay.name) ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Speaker",
    href: "/speakers?section=profile",
    imageUrl: user.photoURL,
  };

  function renderProjects() {
    // Secondary speaker joining via roomId URL param
    if (roomIdParam && !assignments.some((a) => a.id === roomIdParam)) {
      return (
        <ConversationalProjectView
          user={user}
          speaker={speakerForDisplay}
          assignment={null}
          project={convProject}
          roomId={roomIdParam}
          onBack={() => router.push("/speakers?section=projects")}
        />
      );
    }

    // Conversational project — primary with active assignment
    if (activeAssignment) {
      if (activeProjectLoading || !activeProject) {
        return (
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          </div>
        );
      }
      if (activeProject.recordingMode === "conversational") {
        return (
          <ConversationalProjectView
            user={user}
            speaker={speakerForDisplay}
            assignment={activeAssignment}
            project={activeProject}
            roomId={activeAssignment.id}
            onBack={() => { setActiveAssignment(null); setActiveTask(null); }}
          />
        );
      }
    }

    // Utterance project — task view
    if (activeTask && activeAssignment && activeProject) {
      return (
        <TaskView
          key={activeTask.taskIndex}
          speaker={speakerForDisplay}
          assignment={activeAssignment}
          project={activeProject}
          taskIndex={activeTask.taskIndex}
          task={activeTask.task}
          initialPromptIndex={activeTask.initialPromptIndex}
          sessions={sessions.filter((s) => s.assignmentId === activeAssignment.id)}
          onBack={() => setActiveTask(null)}
          onNavigateTask={(taskIdx, promptIdx) => {
            const allTasks = activeProject.tasks ?? [];
            if (taskIdx >= 0 && taskIdx < allTasks.length) {
              setActiveTask({ task: allTasks[taskIdx], taskIndex: taskIdx, initialPromptIndex: promptIdx });
            } else {
              setActiveTask(null);
            }
          }}
        />
      );
    }

    // Utterance project — project overview
    if (activeAssignment) {
      if (activeProjectLoading || !activeProject) {
        return (
          <div className="flex min-h-[40vh] items-center justify-center">
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          </div>
        );
      }
      return (
        <ProjectView
          assignment={activeAssignment}
          project={activeProject}
          sessions={sessions.filter((s) => s.assignmentId === activeAssignment.id)}
          onBack={() => { setActiveAssignment(null); setActiveTask(null); }}
          onSelectTask={(task, taskIndex, promptIndex) => setActiveTask({ task, taskIndex, initialPromptIndex: promptIndex })}
          onNavigateToReviews={() => navigateTo("reviews")}
        />
      );
    }

    return <MyProjects assignments={assignments} onSelect={(a) => setActiveAssignment(a)} />;
  }

  return (
    <DeaimerSiteShell
      platformSideMenuItems={speakerMenuItems}
      userProfile={userProfile}
      onSignOut={() => void handleSignOut()}
    >
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          {effectiveSection === "dashboard" && (
            <Dashboard speaker={speakerForDisplay} assignments={assignments} sessions={sessions} onNavigate={navigateTo} />
          )}
          {effectiveSection === "projects" && renderProjects()}
          {effectiveSection === "reviews" && (
            <Reviews
              assignments={assignments}
              sessions={sessions}
              speaker={speakerForDisplay}
            />
          )}
          {effectiveSection === "profile" && (
            <Profile
              speaker={speakerForDisplay}
              onSaved={(s) => {
                setSpeaker(s);
                if (!profileComplete) {
                  if (roomIdParam) {
                    router.push(`/speakers?section=projects&roomId=${roomIdParam}`);
                  } else {
                    navigateTo("dashboard");
                  }
                }
              }}
              isOnboarding={!profileComplete}
              joiningRoomId={roomIdParam ?? undefined}
            />
          )}
          {effectiveSection === "guidelines" && <Guidelines />}
        </div>
      </main>
    </DeaimerSiteShell>
  );
}

// ─── Auth gate / sign-in ──────────────────────────────────────────────────────

type SpeakerEmailMode = "signup" | "signin";
const emptySpeakerEmailForm = { email: "", password: "", confirmPassword: "" };

function createEmptySpeaker(user: User): DCSpeaker {
  return {
    id: user.uid,
    email: user.email?.toLowerCase() ?? "",
    firstName: "",
    lastName: "",
    name: user.displayName ?? "",
    dateOfBirth: "",
    age: "",
    gender: "",
    country: "",
    region: "",
    languages: [],
    phoneCountryCode: "+1",
    phone: "",
    dialect: "",
    secondaryDialect: "",
    bio: "",
    status: "pending",
    totalHours: 0,
    projectsCount: 0,
    invitedByEmail: "",
    invitedByUid: "",
  };
}

export function SpeakersShell() {
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [emailMode, setEmailMode] = useState<SpeakerEmailMode>("signup");
  const [emailForm, setEmailForm] = useState(emptySpeakerEmailForm);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !firebaseReady) { setAuthReady(true); setIsAuthResolving(false); return; }
    let cancelled = false;
    const { auth } = getFirebaseClientServices();
    // Eagerly restore in-memory auth state — avoids sign-in flash when already signed in
    if (auth.currentUser) {
      setUser(auth.currentUser);
      setAuthReady(true);
      setIsAuthResolving(false);
    } else {
      // Mark resolving so spinner stays up until onAuthStateChanged fires
      setIsAuthResolving(true);
    }
    async function init() {
      try { await ensureFirebaseAuthPersistence(); await resolveFirebaseRedirectSignIn(); } catch (e) { console.warn("[Auth] redirect sign-in error:", e); }
      if (cancelled) return;
      const unsub = onAuthStateChanged(auth, (u) => {
        if (cancelled) return;
        setUser(u);
        setAuthReady(true);
        setIsAuthResolving(false);
        setIsSigningIn(false);
      });
      return unsub;
    }
    const unsubPromise = init();
    return () => { cancelled = true; unsubPromise.then((unsub) => unsub?.()); };
  }, [mounted, firebaseReady]);

  async function handleGoogleSignIn() {
    if (!firebaseReady) return;
    setIsSigningIn(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Google sign in did not complete. Please try again.");
    } finally {
      setIsSigningIn(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseReady) return;
    const email = emailForm.email.trim().toLowerCase();
    if (!email) { setErrorMessage("Enter your email first."); return; }
    if (!emailForm.password) { setErrorMessage("Enter your password first."); return; }
    if (emailMode === "signup" && emailForm.password !== emailForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }
    setIsEmailBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      await ensureFirebaseAuthPersistence();
      const { auth } = getFirebaseClientServices();
      if (emailMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, emailForm.password);
      } else {
        await signInWithEmailAndPassword(auth, email, emailForm.password);
      }
      setEmailForm(emptySpeakerEmailForm);
      setSuccessMessage(
        emailMode === "signup"
          ? "Account created. Finish your profile to continue."
          : "Signed in successfully.",
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Sign in did not complete. Please try again.");
    } finally {
      setIsEmailBusy(false);
    }
  }

  if (!mounted || !authReady || isAuthResolving) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faff]">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (user) return <SpeakerPortal user={user} />;

  return (
    <PlatformAuthPage
      title={emailMode === "signup" ? "Join as a speaker" : "Sign in to your account"}
      email={emailForm.email}
      password={emailForm.password}
      confirmPassword={emailMode === "signup" ? emailForm.confirmPassword : undefined}
      passwordAutocomplete={emailMode === "signup" ? "new-password" : "current-password"}
      submitLabel={emailMode === "signup" ? "Create account" : "Sign in"}
      isSubmitting={isEmailBusy || isAuthResolving}
      notice={!firebaseReady ? (firebaseConfigError ?? undefined) : undefined}
      errorMessage={errorMessage ?? undefined}
      successMessage={successMessage ?? undefined}
      oauthAction={
        <button
          type="button"
          onClick={() => void handleGoogleSignIn()}
          disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady}
          className="inline-flex w-full items-center justify-center gap-3 rounded-[10px] border border-[#e5ecf3] bg-white px-4 py-[13px] text-sm font-semibold text-[#0a1628] transition hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSigningIn
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#d0dbe8] border-t-[#2b85f0]" />
            : <GoogleMark />}
          {isSigningIn ? "Opening Google…" : "Continue with Google"}
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
      onEmailChange={(value) => setEmailForm((f) => ({ ...f, email: value }))}
      onPasswordChange={(value) => setEmailForm((f) => ({ ...f, password: value }))}
      onConfirmPasswordChange={(value) => setEmailForm((f) => ({ ...f, confirmPassword: value }))}
      onSubmit={handleEmailAuth}
    />
  );
}
