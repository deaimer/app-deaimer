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
  onAuthStateChanged,
  signOut,
  type User,
} from "firebase/auth";
import {
  DeaimerSiteShell,
  type PlatformSideMenuItem,
} from "@/components/deaimer-site-shell";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import {
  subscribeToDCAssignmentsBySpeaker,
  subscribeToDCProjectById,
  subscribeToDCSessionsBySpeaker,
  subscribeToDCSpeakerByEmail,
  submitAssignmentForReview,
  submitDCSession,
  updateDCSpeakerProfile,
  type DCAssignment,
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

  function submittedSetForTask(taskId: string): Set<number> {
    return new Set(
      sessions
        .filter((s) => s.taskId === taskId && s.promptIndex != null)
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
          {assignment.submittedForReview ? (
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
          ) : startContinue ? (
            <button
              type="button"
              onClick={() => onSelectTask(tasks[startContinue.taskIndex], startContinue.taskIndex, startContinue.promptIndex)}
              className="mt-5 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90 active:scale-[0.97]"
            >
              {startContinue.label} →
            </button>
          ) : allTasksDone ? (
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setSubmitting(true);
                  void submitAssignmentForReview(assignment.id).finally(() => setSubmitting(false));
                }}
                className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90 active:scale-[0.97] disabled:opacity-60"
              >
                {submitting ? "Submitting…" : "Submit for review →"}
              </button>
            </div>
          ) : null}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-44 w-44 rounded-full bg-white/10" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-6 right-20 h-28 w-28 rounded-full bg-white/5" />
      </div>

      {/* Task list */}
      {tasks.length === 0 ? (
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
            const hasRejection = sessions.some((s) => s.taskId === task.id && s.qaStatus === "rejected");
            // locked by sequencing, OR submitted for review with no rejections to fix
            const locked = isTaskLocked(idx) || (assignment.submittedForReview && !hasRejection);

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
      .filter((s) => s.taskId === task.id && s.promptIndex != null)
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
  const submittedSession = sessions.find((s) => s.taskId === task.id && s.promptIndex === promptIdx) ?? null;
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

function Reviews({
  assignments,
  sessions,
  onReRecord,
}: {
  assignments: DCAssignment[];
  sessions: DCSession[];
  onReRecord: (assignment: DCAssignment, taskId: string, promptIndex: number) => void;
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const submitted = assignments.filter((a) => a.submittedForReview);

  function toggle(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const qaColor: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
    "in-review": "bg-amber-100 text-amber-700",
    pending: "bg-slate-100 text-slate-500",
  };

  const qaLabel: Record<string, string> = {
    approved: "Approved",
    rejected: "Rejected",
    "in-review": "In review",
    pending: "Pending",
  };

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

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">Reviews</h1>

      {submitted.map((assignment) => {
        const assignmentSessions = sessions.filter((s) => s.assignmentId === assignment.id);
        const expanded = expandedIds.has(assignment.id);

        // Group sessions by taskId
        const taskMap = new Map<string, DCSession[]>();
        assignmentSessions.forEach((s) => {
          if (!s.taskId) return;
          if (!taskMap.has(s.taskId)) taskMap.set(s.taskId, []);
          taskMap.get(s.taskId)!.push(s);
        });

        const totalSessions = assignmentSessions.length;
        const approvedCount = assignmentSessions.filter((s) => s.qaStatus === "approved").length;
        const rejectedCount = assignmentSessions.filter((s) => s.qaStatus === "rejected").length;
        const inReviewCount = assignmentSessions.filter((s) => s.qaStatus === "in-review").length;

        return (
          <div key={assignment.id} className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
            {/* Assignment header */}
            <button
              type="button"
              onClick={() => toggle(assignment.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50"
            >
              <div className="min-w-0">
                {assignment.projectDialect && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{assignment.projectDialect}</p>
                )}
                <p className="truncate text-sm font-semibold text-ink">{assignment.projectName}</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {approvedCount > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{approvedCount} approved</span>
                  )}
                  {rejectedCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{rejectedCount} rejected</span>
                  )}
                  {inReviewCount > 0 && (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">{inReviewCount} in review</span>
                  )}
                  {totalSessions === approvedCount && totalSessions > 0 && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">All approved ✓</span>
                  )}
                </div>
              </div>
              <span className={["shrink-0 text-muted/40 text-sm transition-transform duration-200", expanded ? "rotate-180" : ""].join(" ")}>▾</span>
            </button>

            {expanded && (
              <div className="border-t border-slate-100">
                {taskMap.size === 0 ? (
                  <p className="px-5 py-4 text-sm text-muted">No sessions found for this project.</p>
                ) : (
                  Array.from(taskMap.entries()).map(([taskId, taskSessions]) => {
                    const sorted = [...taskSessions].sort((a, b) => (a.promptIndex ?? 0) - (b.promptIndex ?? 0));
                    const taskRejected = sorted.some((s) => s.qaStatus === "rejected");

                    return (
                      <div key={taskId} className="border-b border-slate-100 last:border-b-0">
                        <div className="flex items-center justify-between gap-3 bg-slate-50/60 px-5 py-3">
                          <p className="text-xs font-semibold text-ink">
                            {sorted[0]?.promptText ? `Task` : "Task"}
                          </p>
                          {taskRejected && (
                            <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Needs attention</span>
                          )}
                        </div>

                        <div className="divide-y divide-slate-50">
                          {sorted.map((s) => (
                            <div key={s.id} className="px-5 py-3.5">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-muted">Prompt {(s.promptIndex ?? 0) + 1}</p>
                                  {s.promptText && (
                                    <p className="mt-0.5 text-sm text-ink line-clamp-2">{s.promptText}</p>
                                  )}
                                  {s.qaStatus === "rejected" && s.qaNote && (
                                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2">
                                      <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-600">Rejection reason</p>
                                      <p className="mt-0.5 text-sm text-rose-900">{s.qaNote}</p>
                                    </div>
                                  )}
                                  {s.audioUrl && (
                                    // eslint-disable-next-line jsx-a11y/media-has-caption
                                    <audio controls src={s.audioUrl} className="mt-2 w-full rounded-xl" />
                                  )}
                                </div>
                                <div className="shrink-0 flex flex-col items-end gap-2">
                                  <span className={["rounded-full px-2.5 py-1 text-[10px] font-semibold", qaColor[s.qaStatus] ?? qaColor.pending].join(" ")}>
                                    {qaLabel[s.qaStatus] ?? "Pending"}
                                  </span>
                                  {s.qaStatus === "rejected" && (
                                    <button
                                      type="button"
                                      onClick={() => onReRecord(assignment, s.taskId!, s.promptIndex!)}
                                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50"
                                    >
                                      Re-record →
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        );
      })}
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
}: {
  speaker: DCSpeaker;
  onSaved: (s: DCSpeaker) => void;
  isOnboarding: boolean;
}) {
  const [editing, setEditing] = useState(isOnboarding);
  const [form, setForm] = useState({
    firstName: speaker.firstName,
    lastName: speaker.lastName,
    dateOfBirth: speaker.dateOfBirth,
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
      await updateDCSpeakerProfile(speaker.email, {
        firstName,
        lastName,
        name: updatedName,
        dateOfBirth: form.dateOfBirth,
        age: String(calcAge(form.dateOfBirth)),
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
      {/* Header */}
      {isOnboarding ? (
        <div className="overflow-hidden rounded-[1.75rem] border border-primary/10 bg-gradient-to-br from-primary/[0.08] via-primary/[0.04] to-transparent px-5 pb-6 pt-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary/70">Speaker Portal</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Set up your profile</h1>
          <p className="mt-1.5 text-sm leading-6 text-muted">
            Your details are embedded in every recording — fill these in correctly.
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
            {saving ? "Saving…" : isOnboarding ? "Complete Profile →" : "Save Changes"}
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

// ─── Speaker portal (logged-in) ───────────────────────────────────────────────

function SpeakerPortal({ user }: { user: User }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const rawSection = searchParams.get("section") ?? "dashboard";
  const section = (VALID_SECTIONS.includes(rawSection as SpeakerSection) ? rawSection : "dashboard") as SpeakerSection;

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

  function navigateTo(s: SpeakerSection) {
    // Reset project drill-down when switching sections
    setActiveAssignment(null);
    setActiveProject(null);
    setActiveTask(null);
    router.push(`/speakers?section=${s}`);
  }

  useEffect(() => {
    if (!user.email) return;
    setSpeakerLoading(true);
    return subscribeToDCSpeakerByEmail(user.email, (s) => {
      setSpeaker(s);
      setSpeakerLoading(false);
    });
  }, [user.email]);

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

  if (!speaker) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <p className="text-2xl">◎</p>
          <h1 className="mt-3 text-xl font-semibold text-ink">Account not found</h1>
          <p className="mt-2 max-w-sm text-sm leading-6 text-muted">
            Your Google account (<strong>{user.email}</strong>) is not registered as a speaker. Contact your project coordinator.
          </p>
          <button type="button" onClick={() => void handleSignOut()} className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong">
            Sign out
          </button>
        </div>
      </DeaimerSiteShell>
    );
  }

  if (speaker.status === "suspended") {
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

  const profileComplete = isProfileComplete(speaker);
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
      (speaker.firstName && speaker.lastName
        ? `${speaker.firstName} ${speaker.lastName}`
        : speaker.name) ||
      user.displayName ||
      user.email?.split("@")[0] ||
      "Speaker",
    href: "/speakers?section=profile",
    imageUrl: user.photoURL,
  };

  function renderProjects() {
    if (activeTask && activeAssignment && activeProject) {
      return (
        <TaskView
          key={activeTask.taskIndex}
          speaker={speaker!}
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
            <Dashboard speaker={speaker} assignments={assignments} sessions={sessions} onNavigate={navigateTo} />
          )}
          {effectiveSection === "projects" && renderProjects()}
          {effectiveSection === "reviews" && (
            <Reviews
              assignments={assignments}
              sessions={sessions}
              onReRecord={(assignment, taskId, promptIndex) => {
                setPendingReRecord({ taskId, promptIndex });
                setActiveAssignment(assignment);
                setActiveTask(null);
                router.push("/speakers?section=projects");
              }}
            />
          )}
          {effectiveSection === "profile" && (
            <Profile speaker={speaker} onSaved={setSpeaker} isOnboarding={!profileComplete} />
          )}
          {effectiveSection === "guidelines" && <Guidelines />}
        </div>
      </main>
    </DeaimerSiteShell>
  );
}

// ─── Auth gate / sign-in ──────────────────────────────────────────────────────

export function SpeakersShell() {
  const [mounted, setMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted || !isFirebaseConfigured()) { setAuthReady(true); return; }
    let cancelled = false;
    async function init() {
      try { await ensureFirebaseAuthPersistence(); await resolveFirebaseRedirectSignIn(); } catch { /* ok */ }
      if (cancelled) return;
      const { auth } = getFirebaseClientServices();
      const unsub = onAuthStateChanged(auth, (u) => {
        if (cancelled) return;
        setUser(u);
        setAuthReady(true);
      });
      return unsub;
    }
    const unsubPromise = init();
    return () => { cancelled = true; unsubPromise.then((unsub) => unsub?.()); };
  }, [mounted]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setAuthError("");
    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Sign in did not complete.");
    } finally {
      setSigningIn(false);
    }
  }

  if (!mounted || !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7faff]">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (user) return <SpeakerPortal user={user} />;

  return (
    <DeaimerSiteShell>
      <div className="flex min-h-[80vh] items-center justify-center px-4 py-12">
        <div className="w-full max-w-[380px]">
          <div className="mb-8 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">Speaker Portal</p>
            <h1 className="mt-3 text-2xl font-semibold text-ink sm:text-3xl">Sign in to record</h1>
            <p className="mt-2 text-sm leading-6 text-muted">
              Access your speaker workspace to record sessions, track progress, and manage your profile.
            </p>
          </div>

          {authError && (
            <div className="mb-5 rounded-[10px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{authError}</div>
          )}

          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={signingIn}
            className="inline-flex w-full items-center justify-center gap-3 rounded-[12px] border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-ink shadow-sm transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {signingIn ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /> : <GoogleMark />}
            {signingIn ? "Opening Google…" : "Continue with Google"}
          </button>

          <p className="mt-5 text-center text-xs text-muted">
            Only invited speakers can access this portal. Contact your project coordinator if you need access.
          </p>
        </div>
      </div>
    </DeaimerSiteShell>
  );
}
