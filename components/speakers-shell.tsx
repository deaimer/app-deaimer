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

// ─── Device / education static data ──────────────────────────────────────────

const DEVICE_CATEGORIES = [
  "Smartphone",
  "Laptop",
  "Tablet",
  "Desktop",
  "Dedicated Microphone",
  "Other",
];

const DEVICE_MANUFACTURERS = [
  "Apple", "Samsung", "Huawei", "Xiaomi", "OnePlus", "OPPO", "Vivo", "Realme",
  "Google", "Sony", "Nokia", "Motorola", "LG", "HP", "Dell", "Lenovo", "ASUS",
  "Acer", "Microsoft", "Logitech", "Blue Microphones", "Audio-Technica", "Rode",
];

const EDUCATION_LEVELS = [
  "No formal education",
  "Primary / Elementary",
  "Secondary / High School",
  "Vocational / Technical",
  "Bachelor's Degree",
  "Master's Degree",
  "Doctoral Degree",
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

function calcAgeGroup(age: number): string {
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  if (age < 65) return "55–64";
  return "65+";
}

function maxDOBDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0];
}

function parseSampleRate(str: string): number {
  if (!str) return 16000;
  const m = str.match(/(\d+\.?\d*)\s*k/i);
  if (m) return Math.round(parseFloat(m[1]) * 1000);
  const plain = str.match(/(\d+)/);
  if (plain) return parseInt(plain[1], 10);
  return 16000;
}

function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeStr(offset: number, s: string) {
    for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i));
  }

  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  let off = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    off += 2;
  }
  return new Blob([buffer], { type: "audio/wav" });
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
    speaker.phone &&
    speaker.deviceCategory &&
    speaker.deviceManufacturer &&
    speaker.educationLevel
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

type PromptRecordState = "idle" | "recording" | "processing" | "stopped" | "saving";

interface PromptBlob { blob: Blob; sampleRate: number; duration: number; url: string }

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

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const isCollectingRef = useRef(false);

  const currentPrompt = prompts[promptIdx];
  const maxSec = currentPrompt?.maxSeconds ?? 30;
  const currentBlob = blobs.get(promptIdx) ?? null;
  const isSubmitted = submittedSet.has(promptIdx);
  const isLastPrompt = promptIdx === prompts.length - 1;
  const canGoNext = submittedSet.has(promptIdx) || blobs.has(promptIdx);
  const canGoPrev = promptIdx > 0 || taskIndex > 0;
  const newBlobCount = Array.from(blobs.keys()).filter((i) => !submittedSet.has(i)).length;
  const submittedSession = sessions.find((s) => s.taskId === task.id && s.promptIndex === promptIdx && Boolean(s.audioUrl)) ?? null;
  // Max prompts per speaker enforcement (0 = unlimited)
  const totalSubmittedPrompts = sessions.filter((s) => s.assignmentId === assignment.id && Boolean(s.audioUrl)).length;
  const maxPromptsLimit = project.maxPromptsPerSpeaker ?? 0;
  const maxPromptsReached = maxPromptsLimit > 0 && totalSubmittedPrompts >= maxPromptsLimit && !isSubmitted;
  // Lock recording once submitted for review, except for rejected prompts
  const isRecordingAllowed = (!assignment.submittedForReview && !maxPromptsReached) || submittedSession?.qaStatus === "rejected";

  useEffect(() => {
    if (recordState === "recording" && elapsed >= maxSec) {
      void stopRecording();
    }
  }, [elapsed, maxSec, recordState]);

  function stopVisualizer() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    setLevelBars(Array(24).fill(0));
  }

  function startVisualizer(ctx: AudioContext, stream: MediaStream) {
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

      const targetRate = assignment.targetSampleRate || parseSampleRate(project.audioFormat?.sampleRate ?? "48kHz");
      const ctx = new AudioContext({ sampleRate: targetRate });
      audioCtxRef.current = ctx;

      startVisualizer(ctx, stream);

      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      pcmChunksRef.current = [];
      isCollectingRef.current = true;

      processor.onaudioprocess = (e) => {
        if (!isCollectingRef.current) return;
        pcmChunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };

      source.connect(processor);
      processor.connect(ctx.destination);

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

  async function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    isCollectingRef.current = false;
    stopVisualizer();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const chunks = pcmChunksRef.current;
    const ctx = audioCtxRef.current;

    processorRef.current?.disconnect();
    void ctx?.close();
    audioCtxRef.current = null;
    processorRef.current = null;

    if (chunks.length === 0) {
      setRecordState("idle");
      return;
    }

    setRecordState("processing");

    const sampleRate = assignment.targetSampleRate || parseSampleRate(project.audioFormat?.sampleRate ?? "48kHz");
    const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
    const pcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunks) { pcm.set(chunk, offset); offset += chunk.length; }

    const durationSec = Math.round(totalLength / sampleRate);
    const blob = encodeWAV(pcm, sampleRate);
    const url = URL.createObjectURL(blob);

    setBlobs((prev) => new Map(prev).set(promptIdx, { blob, sampleRate, duration: durationSec, url }));
    setRecordState("stopped");
  }

  function reRecord() {
    const existing = blobs.get(promptIdx);
    if (existing?.url) URL.revokeObjectURL(existing.url);
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
          mimeType: "audio/wav",
          duration: entry.duration,
          sampleRate: entry.sampleRate,
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
      isCollectingRef.current = false;
      stopVisualizer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      processorRef.current?.disconnect();
      void audioCtxRef.current?.close();
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
            <p className="text-center text-xs text-muted">
              {maxPromptsReached ? `Prompt limit reached (${maxPromptsLimit})` : "Locked — submitted for review"}
            </p>
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

      {/* Max prompts reached banner */}
      {maxPromptsReached && (
        <div className="rounded-[1.25rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          You have reached the maximum of <strong>{maxPromptsLimit}</strong> prompts for this project. No further recordings are allowed.
        </div>
      )}

      {/* Recorder — hidden when reviewing a submitted prompt, or locked */}
      {(recordState !== "idle" || !isSubmitted || blobs.has(promptIdx)) && isRecordingAllowed && (
      <div className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-slate-200 bg-white px-4 py-10">
        {recordState === "processing" ? (
          <div className="flex flex-col items-center gap-3">
            <span className="h-10 w-10 animate-spin rounded-full border-[3px] border-slate-200 border-t-primary" />
            <p className="text-sm font-medium text-ink">Processing audio…</p>
            <p className="text-xs text-muted">Encoding audio…</p>
          </div>
        ) : (
          <>
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
                <button type="button" onClick={() => void stopRecording()} className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_4px_24px_rgba(220,38,38,0.4)] hover:bg-rose-700 active:scale-95">
                  <span className="text-2xl">⏹</span>
                </button>
                <p className="animate-pulse text-xs text-muted">Recording… speak naturally</p>
              </>
            )}
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
              disabled={recordState === "recording" || recordState === "processing"}
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
              disabled={recordState === "recording" || recordState === "processing"}
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
  const [savedSet, setSavedSet] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [recordState, setRecordState] = useState<"idle" | "recording" | "stopped">("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ done: number; total: number } | null>(null);
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
  const allSaved = savedSet.size === rejectedSessions.length;

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

  async function saveCurrent() {
    if (!blobs.has(currentIdx) || savedSet.has(currentIdx)) return;
    setSaving(true);
    await new Promise<void>((r) => setTimeout(r, 350));
    setSavedSet((prev) => new Set(prev).add(currentIdx));
    setSaving(false);
  }

  async function handleReSubmit() {
    setSubmitting(true);
    setUploadProgress({ done: 0, total: rejectedSessions.length });
    setError("");
    try {
      for (let i = 0; i < rejectedSessions.length; i++) {
        if (blobs.has(i)) {
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
            submissionCount: (s.submissionCount ?? 0) + 1,
            assignedTranscriptorEmail: s.assignedTranscriptorEmail || undefined,
            assignedQAEmail: s.assignedQAEmail || undefined,
          });
          setUploadProgress({ done: i + 1, total: rejectedSessions.length });
        }
      }
      await submitAssignmentForReview(assignment.id);
      setSubmitDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed — try again.");
      setUploadProgress(null);
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
                savedSet.has(i)
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

      {/* Recording UI — same look as normal recording */}
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

        {(recordState === "stopped" || savedSet.has(currentIdx)) && currentBlob && (
          <div className="space-y-3">
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={URL.createObjectURL(currentBlob)} className="w-full rounded-xl" />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setSavedSet((prev) => { const s = new Set(prev); s.delete(currentIdx); return s; });
                  setBlobs((prev) => { const m = new Map(prev); m.delete(currentIdx); return m; });
                  setRecordState("idle");
                }}
                className="flex-1 rounded-full border border-slate-200 py-2.5 text-sm font-semibold text-muted hover:bg-slate-50"
              >
                Re-record
              </button>
              {savedSet.has(currentIdx) ? (
                <span className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700">
                  ✓ Saved
                </span>
              ) : (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveCurrent()}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-70"
                >
                  {saving ? (
                    <>
                      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      Saving
                    </>
                  ) : "Save ✓"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

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
        {!isLast && savedSet.has(currentIdx) && (
          <button
            type="button"
            onClick={() => navigateTo(currentIdx + 1)}
            className="flex-1 rounded-full bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
          >
            Next →
          </button>
        )}
      </div>

      {/* Upload progress bar */}
      {uploadProgress && (
        <div className="space-y-2 rounded-[1.25rem] border border-slate-200 bg-white p-4">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Uploading recordings…</span>
            <span>{uploadProgress.done} / {uploadProgress.total}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.round((uploadProgress.done / uploadProgress.total) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Re-submit — only when all are saved locally */}
      {allSaved && !submitting && !uploadProgress && (
        <button
          type="button"
          onClick={() => void handleReSubmit()}
          className="w-full rounded-full bg-emerald-600 py-3 text-sm font-semibold text-white shadow-md hover:bg-emerald-700"
        >
          Upload &amp; submit for review →
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

  const rejectedOrdered = (() => {
    const fromOrder = ordered.filter((s) => s.qaStatus === "rejected");
    return fromOrder.length > 0 ? fromOrder : rejected;
  })();

  // A rejection is "resubmitted" if a newer session exists for the same prompt
  const resubmittedIds = new Set(
    rejected
      .filter((s) =>
        assignmentSessions.some(
          (other) =>
            other.id !== s.id &&
            other.taskId === s.taskId &&
            other.promptIndex === s.promptIndex &&
            (other.submissionCount ?? 0) > (s.submissionCount ?? 0),
        ),
      )
      .map((s) => s.id),
  );

  const activeRejections = rejectedOrdered.filter((s) => !resubmittedIds.has(s.id));
  const resubmittedCount = resubmittedIds.size;

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
        {activeRejections.length > 0 && (
          <button
            type="button"
            onClick={() => onReRecord(activeRejections)}
            className="shrink-0 rounded-full bg-rose-600 px-5 py-3 text-sm font-bold text-white shadow-lg ring-2 ring-rose-300 hover:bg-rose-700 active:scale-95 transition"
          >
            Re-record {activeRejections.length} {activeRejections.length > 1 ? "rejections" : "rejection"} →
          </button>
        )}
      </div>

      {/* Summary chips */}
      <div className="flex flex-wrap gap-2">
        {activeRejections.length > 0 && (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">{activeRejections.length} rejected</span>
        )}
        {resubmittedCount > 0 && (
          <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-700">↑ {resubmittedCount} resubmitted</span>
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

      {/* Rejections — only active (not yet resubmitted) */}
      {activeRejections.length > 0 && (
        <div className="overflow-hidden rounded-[1.25rem] border border-rose-200 bg-white">
          <div className="border-b border-rose-100 bg-rose-50 px-4 py-2.5">
            <p className="text-xs font-semibold uppercase tracking-widest text-rose-600">Rejections</p>
          </div>
          <div className="divide-y divide-rose-50">
            {activeRejections.map((s, i) => {
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
                        <p className="mt-0.5 text-xs font-medium text-rose-700">{s.qaNote}</p>
                      )}
                    </div>
                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Rejected</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rejected.length === 0 && assignmentSessions.length === 0 && (
        <p className="py-6 text-center text-sm text-muted">No recordings found for this project.</p>
      )}

      {rejected.length === 0 && assignmentSessions.length > 0 && (
        <p className="py-6 text-center text-sm text-muted">No rejections — keep it up!</p>
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
          const rejected = validSessions.filter((s) => s.qaStatus === "rejected");
          const approvedCount = validSessions.filter((s) => s.qaStatus === "approved").length;
          const pendingCount = validSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review").length;
          const allApproved = approvedCount === validSessions.length && validSessions.length > 0;

          const resubmitted = rejected.filter((s) =>
            assignmentSessions.some(
              (other) =>
                other.id !== s.id &&
                other.taskId === s.taskId &&
                other.promptIndex === s.promptIndex &&
                (other.submissionCount ?? 0) > (s.submissionCount ?? 0),
            ),
          );
          const activeRejectedCount = rejected.length - resubmitted.length;
          const resubmittedCount = resubmitted.length;

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
                  {activeRejectedCount > 0 && (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">{activeRejectedCount} rejected</span>
                  )}
                  {resubmittedCount > 0 && (
                    <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[10px] font-semibold text-sky-700">↑ {resubmittedCount} resubmitted</span>
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
    deviceCategory: speaker.deviceCategory,
    deviceManufacturer: speaker.deviceManufacturer,
    deviceModel: speaker.deviceModel,
    educationLevel: speaker.educationLevel,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [manufacturerOtherMode, setManufacturerOtherMode] = useState(
    !!speaker.deviceManufacturer && !DEVICE_MANUFACTURERS.includes(speaker.deviceManufacturer),
  );

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
      deviceCategory: speaker.deviceCategory,
      deviceManufacturer: speaker.deviceManufacturer,
      deviceModel: speaker.deviceModel,
      educationLevel: speaker.educationLevel,
    });
    setManufacturerOtherMode(
      !!speaker.deviceManufacturer && !DEVICE_MANUFACTURERS.includes(speaker.deviceManufacturer),
    );
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
    if (!form.deviceCategory) {
      setError("Please select your device category.");
      return;
    }
    if (!form.deviceManufacturer.trim()) {
      setError("Please enter your device manufacturer.");
      return;
    }
    if (!form.educationLevel) {
      setError("Please select your education level.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const firstName = form.firstName.trim();
      const lastName = form.lastName.trim();
      const updatedName = `${firstName} ${lastName}`;
      const age = calcAge(form.dateOfBirth);
      await updateDCSpeakerProfile({
        firstName,
        lastName,
        name: updatedName,
        dateOfBirth: form.dateOfBirth,
        age: String(age),
        ageGroup: calcAgeGroup(age),
        gender: form.gender,
        country: form.country,
        region: form.region.trim(),
        languages: form.languages,
        phoneCountryCode: form.phoneCountryCode,
        phone: form.phone.trim(),
        deviceCategory: form.deviceCategory,
        deviceManufacturer: form.deviceManufacturer.trim(),
        deviceModel: form.deviceModel.trim(),
        educationLevel: form.educationLevel,
      });
      onSaved({
        ...speaker,
        firstName,
        lastName,
        name: updatedName,
        dateOfBirth: form.dateOfBirth,
        age: String(age),
        ageGroup: calcAgeGroup(age),
        gender: form.gender,
        country: form.country,
        region: form.region.trim(),
        languages: form.languages,
        phoneCountryCode: form.phoneCountryCode,
        phone: form.phone.trim(),
        deviceCategory: form.deviceCategory,
        deviceManufacturer: form.deviceManufacturer.trim(),
        deviceModel: form.deviceModel.trim(),
        educationLevel: form.educationLevel,
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
            {speaker.speakerId && (
              <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                #{speaker.speakerId}
              </span>
            )}
            {speaker.gender && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink capitalize shadow-sm">
                {speaker.gender.replace("_", " ")}
              </span>
            )}
            {speaker.ageGroup && (
              <span className="rounded-full border border-white/80 bg-white px-2.5 py-1 text-xs font-medium text-ink shadow-sm">
                {speaker.ageGroup}
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
          {speaker.speakerId && (
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <p className="text-xs font-medium text-muted">Speaker ID</p>
              <p className="text-sm font-semibold text-primary">#{speaker.speakerId}</p>
            </div>
          )}
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Date of birth</p>
            <p className="text-sm font-medium text-ink">{formatDOB(speaker.dateOfBirth)}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Age / Age group</p>
            <p className="text-sm font-medium text-ink">
              {speaker.age ? `${speaker.age} yrs` : "—"}{speaker.ageGroup ? ` · ${speaker.ageGroup}` : ""}
            </p>
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
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Education</p>
            <p className="text-sm font-medium text-ink">{speaker.educationLevel || "—"}</p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Device</p>
            <p className="text-sm font-medium text-ink">
              {speaker.deviceManufacturer
                ? [speaker.deviceManufacturer, speaker.deviceModel].filter(Boolean).join(" ")
                : "—"}
            </p>
          </div>
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <p className="text-xs font-medium text-muted">Device type</p>
            <p className="text-sm font-medium text-ink">{speaker.deviceCategory || "—"}</p>
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

        {/* Education */}
        <SectionCard title="Education">
          <label className="block">
            <span className={labelCls}>Education level <span className="text-primary">*</span></span>
            <select
              className={fieldCls}
              value={form.educationLevel}
              onChange={(e) => set("educationLevel", e.target.value)}
              required
            >
              <option value="">Select education level…</option>
              {EDUCATION_LEVELS.map((level) => (
                <option key={level} value={level}>{level}</option>
              ))}
            </select>
          </label>
        </SectionCard>

        {/* Recording device */}
        <SectionCard title="Recording device">
          <p className="text-xs text-muted -mt-1">Tell us what device you use to record. This helps us with audio quality metadata.</p>
          <label className="block">
            <span className={labelCls}>Device category <span className="text-primary">*</span></span>
            <select
              className={fieldCls}
              value={form.deviceCategory}
              onChange={(e) => set("deviceCategory", e.target.value)}
              required
            >
              <option value="">Select device type…</option>
              {DEVICE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={labelCls}>Manufacturer <span className="text-primary">*</span></span>
            <select
              className={fieldCls}
              value={manufacturerOtherMode ? "__other__" : form.deviceManufacturer}
              onChange={(e) => {
                if (e.target.value === "__other__") {
                  setManufacturerOtherMode(true);
                  set("deviceManufacturer", "");
                } else {
                  setManufacturerOtherMode(false);
                  set("deviceManufacturer", e.target.value);
                }
              }}
            >
              <option value="">Select manufacturer…</option>
              {DEVICE_MANUFACTURERS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="__other__">Other…</option>
            </select>
          </label>
          {manufacturerOtherMode && (
            <label className="block">
              <span className={labelCls}>Manufacturer name <span className="text-primary">*</span></span>
              <input
                className={fieldCls}
                placeholder="e.g. Xiaomi, Tecno, JBL…"
                value={form.deviceManufacturer}
                onChange={(e) => set("deviceManufacturer", e.target.value)}
                autoFocus
              />
            </label>
          )}
          {form.deviceManufacturer && (
            <label className="block">
              <span className={labelCls}>Device model</span>
              <input
                className={fieldCls}
                placeholder="e.g. iPhone 15 Pro, Galaxy S24, MacBook Air…"
                value={form.deviceModel}
                onChange={(e) => set("deviceModel", e.target.value)}
              />
            </label>
          )}
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

// STUN for direct connections + TURN relay for symmetric NAT (required on mobile networks)
const ICE_SERVERS: RTCIceServer[] = [
  { urls: ["stun:stun.l.google.com:19302", "stun:stun1.l.google.com:19302"] },
  {
    // Open Relay — replace with your own TURN credentials in production
    urls: [
      "turn:openrelay.metered.ca:80",
      "turn:openrelay.metered.ca:443",
      "turns:openrelay.metered.ca:443?transport=tcp",
    ],
    username: "openrelayproject",
    credential: "openrelayproject",
  },
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
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
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
  const recordingStartedRef = useRef(false);
  const keepAliveCtxRef = useRef<AudioContext | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const mixingCtxRef = useRef<{ ctx: AudioContext; dest: MediaStreamAudioDestinationNode } | null>(null);

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

  // Presence tracking: keep our online flag live in Firestore.
  // Also auto-pauses the session when this user loses their network connection.
  useEffect(() => {
    if (!room?.id || !iAmJoined) return;
    const rid = room.id;
    const uid = user.uid;
    const markOnline = () =>
      void updateConversationRoomParticipant(rid, uid, { online: true }).catch(() => {});
    const markOffline = () => {
      void updateConversationRoomParticipant(rid, uid, { online: false }).catch(() => {});
      // Auto-pause when this user loses network mid-recording
      if (roomRef.current?.status === "recording") {
        void updateConversationRoomStatus(rid, "paused").catch(() => {});
      }
    };
    // visibilitychange: update presence but don't pause (screen-off keeps call alive via keep-alive ctx)
    const onVisibility = () => { if (document.hidden) markOffline(); else markOnline(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", markOnline);
    window.addEventListener("offline", markOffline);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", markOnline);
      window.removeEventListener("offline", markOffline);
      markOffline();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, iAmJoined]);

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

    // Reset local recording state whenever the task advances
    if (taskChanged) {
      if (localBlob?.url) URL.revokeObjectURL(localBlob.url);
      setLocalBlob(null);
      setElapsed(0);
      setWarnShown(false);
      setMyUploadStatus("idle");
      setUploadError(null);
    }

    const nowRecording = room.status === "recording" && prevStatus !== "recording" && prevStatus !== "paused";
    const resumed = room.status === "recording" && prevStatus === "paused";
    const paused = room.status === "paused" && prevStatus === "recording";
    const stopped = room.status === "stopped" && prevStatus !== "stopped";

    if (nowRecording && localStreamRef.current) {
      startLocalRecording();
    } else if (resumed) {
      resumeLocalRecording();
    } else if (paused) {
      pauseLocalRecording();
    } else if (stopped) {
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

  // Auto-pause at max duration (primary only — pausing triggers recording gate + forces submit)
  useEffect(() => {
    if (room?.status !== "recording" || !isPrimary) return;
    if (elapsed >= maxSec) {
      void handlePauseRecording();
    } else if (!warnShown && maxSec - elapsed <= 60 && elapsed > 0) {
      setWarnShown(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, maxSec, room?.status]);

  async function setupWebRTCAndMic() {
    setLocalConnecting(true);
    setWebrtcError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
      localStreamRef.current = stream;
      startVisualizer(stream);

      // Primary only: build an AudioContext that mixes local mic + incoming remote audio.
      // This single context is used by startLocalRecording() to record both voices in one file.
      if (isPrimary) {
        try {
          const ctx = new AudioContext();
          await ctx.resume(); // needed if context starts in "suspended" state on mobile
          const dest = ctx.createMediaStreamDestination();
          ctx.createMediaStreamSource(stream).connect(dest); // local mic → dest
          mixingCtxRef.current = { ctx, dest };
        } catch { /* fallback: local-only recording */ }
      }

      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      // Remote audio — one persistent MediaStream; tracks added as they arrive.
      // Assign to element once so play() state is preserved across track additions.
      const remoteStream = new MediaStream();
      remoteStreamRef.current = remoteStream;
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = remoteStream;
        // Attempt immediate play; on iOS this may fail until a user gesture fires
        remoteAudioRef.current.play().catch(() => setNeedsAudioUnlock(true));
      }
      pc.ontrack = (e) => {
        e.streams[0]?.getTracks().forEach((t) => {
          // Deduplicate — ontrack can fire multiple times
          if (!remoteStream.getTrackById(t.id)) remoteStream.addTrack(t);
        });
        // Re-attempt play each time a track arrives (handles iOS autoplay gate)
        if (remoteAudioRef.current?.paused) {
          remoteAudioRef.current.play().catch(() => setNeedsAudioUnlock(true));
        }
        // Connect incoming remote audio into the mixing context (primary only)
        if (isPrimary && mixingCtxRef.current) {
          try {
            mixingCtxRef.current.ctx
              .createMediaStreamSource(remoteStream)
              .connect(mixingCtxRef.current.dest);
          } catch { /* already connected or ctx closed */ }
        }
      };

      // ICE candidates → write to Firestore for the other peer
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          void addConvIceCandidate(roomId, isPrimary ? "primary" : "secondary", JSON.stringify(e.candidate.toJSON()));
        }
      };

      // Keep AudioContext alive when screen turns off (iOS/Android background)
      try {
        const kCtx = new AudioContext();
        keepAliveCtxRef.current = kCtx;
        const buf = kCtx.createBuffer(1, kCtx.sampleRate, kCtx.sampleRate);
        const src = kCtx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        src.connect(kCtx.destination);
        src.start();
      } catch { /* non-critical */ }

      // Called when ICE connection is established (most reliable signal on mobile)
      const onConnected = () => {
        if (recordingStartedRef.current) return;
        recordingStartedRef.current = true;
        setLocalConnecting(false);
        // Signal call is live — do NOT auto-start recording; either party will do that manually
        if (isPrimary) {
          void updateConversationRoomStatus(roomId, "connected");
        }
      };

      pc.oniceconnectionstatechange = () => {
        const s = pc.iceConnectionState;
        if (s === "connected" || s === "completed") {
          onConnected();
        } else if (s === "disconnected") {
          // Temporary drop (e.g. switching WiFi↔mobile) — WebRTC retries automatically
          setWebrtcError("Connection interrupted — reconnecting…");
        } else if (s === "failed") {
          setWebrtcError("Audio connection failed. Please go back and try again.");
          setLocalConnecting(false);
        } else if (s === "checking" || s === "new") {
          setWebrtcError(null);
        }
      };

      // Fallback: some browsers only fire connectionState, not iceConnectionState
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          onConnected();
        } else if (pc.connectionState === "failed") {
          setWebrtcError("Audio connection failed. Please go back and try again.");
          setLocalConnecting(false);
        } else if (pc.connectionState === "disconnected") {
          setWebrtcError("Connection interrupted — reconnecting…");
        }
      };

      // Primary: create offer and write to Firestore for secondary to pick up
      if (isPrimary && !offerHandledRef.current) {
        offerHandledRef.current = true;
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await updateConversationRoomFields(roomId, { offer: JSON.stringify(offer) });
      }

      // Process any signaling (offer/answer/ICE) that arrived before PC was ready
      if (roomRef.current) void processSignaling(roomRef.current);

      // Race-condition guard: status already "recording" by the time mic finishes
      if (roomRef.current?.status === "recording" && localStreamRef.current) {
        startLocalRecording();
      }
    } catch (e) {
      const name = (e as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setWebrtcError("Microphone access denied. Please allow it and try again.");
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
    // Secondary: only runs the timer — no file recorded; host captures both sides.
    if (!isPrimary) {
      setElapsed(0);
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return;
    }

    // Primary: record from mixing AudioContext (local mic + remote audio) → one file.
    const recordingStream = mixingCtxRef.current?.dest.stream ?? localStreamRef.current;
    if (!recordingStream) return;

    chunksRef.current = [];
    let recorder: MediaRecorder;
    try {
      const preferred = MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported?.("audio/webm") ? "audio/webm" : "audio/mp4";
      recorder = new MediaRecorder(recordingStream, { mimeType: preferred });
    } catch { recorder = new MediaRecorder(recordingStream); }

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

  function pauseLocalRecording() {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (mediaRecorderRef.current?.state === "recording") {
      try { mediaRecorderRef.current.pause(); } catch { /* best-effort */ }
    }
  }

  function resumeLocalRecording() {
    if (mediaRecorderRef.current?.state === "paused") {
      try { mediaRecorderRef.current.resume(); } catch { /* best-effort */ }
    }
    if (!timerRef.current) {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    }
  }

  async function handleStartRecording() {
    await updateConversationRoomStatus(roomId, "recording");
  }

  async function handlePauseRecording() {
    await updateConversationRoomStatus(roomId, "paused");
  }

  async function handleResumeRecording() {
    await updateConversationRoomStatus(roomId, "recording");
  }

  async function handlePrimaryStart() {
    setLocalConnecting(true);
    setWebrtcError(null);
    offerHandledRef.current = false;
    answerHandledRef.current = false;
    recordingStartedRef.current = false;
    processedIcePrimaryRef.current.clear();
    processedIceSecondaryRef.current.clear();
    pendingIceRef.current = [];
    await setupWebRTCAndMic();
  }

  async function handlePrimaryStop() {
    stopLocalRecording();
    await updateConversationRoomStatus(roomId, "stopped");
  }

  // Host submits the current take: upload the mixed recording, then advance or finish.
  // Secondary does not upload — host's mixed file captures both voices.
  async function handleSubmitTask() {
    if (!isPrimary || !room || !project || !currentTask) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      if (localBlob) {
        setMyUploadStatus("uploading");
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
          duration: elapsed,
          sampleRate: 44100,
          bitDepth: 16,
          gender: speaker.gender ?? "",
          age: speaker.age ?? "",
          dialect: speaker.languages[0] ?? "",
          region: speaker.region ?? "",
        });
        setMyUploadStatus("done");
        await updateConversationRoomParticipant(roomId, user.uid, { uploadStatus: "done", sessionId });
      }

      if (isLastTask) {
        await submitAssignmentForReview(room.assignmentId);
        await updateConversationRoomStatus(roomId, "done");
      } else {
        const resetParticipants = room.participants.map((p) => ({ ...p, uploadStatus: "idle" as const }));
        await updateConversationRoomFields(roomId, {
          taskIndex: currentTaskIndex + 1,
          status: "connected",
          participants: resetParticipants,
        });
        // Reset local recording state for next task
        if (localBlob?.url) URL.revokeObjectURL(localBlob.url);
        setLocalBlob(null);
        setElapsed(0);
        setWarnShown(false);
        setMyUploadStatus("idle");
        setUploadError(null);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Submission failed. Please try again.");
      setMyUploadStatus("idle");
    } finally {
      setSubmitting(false);
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
      keepAliveCtxRef.current?.close().catch(() => {});
      mixingCtxRef.current?.ctx.close().catch(() => {});
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

  // Secondary: room may not exist yet (host hasn't opened it). Subscription is live — wait.
  if (!room && !isPrimary) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-ink">← Back</button>
        {joinError ? (
          <p className="text-sm text-rose-600">{joinError}</p>
        ) : (
          <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-amber-200 bg-amber-50 px-6 py-12 text-center">
            <span className="h-7 w-7 animate-spin rounded-full border-2 border-amber-300 border-t-amber-600" />
            <div>
              <p className="text-base font-semibold text-amber-900">Waiting for the host to open the session</p>
              <p className="mt-1 text-sm text-amber-700">You&apos;ll be connected automatically — no need to refresh.</p>
            </div>
          </div>
        )}
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

  // ── Active session (connected / recording / paused) ───────────────────────
  const isConnected = roomStatus === "connected";
  const isRecording = roomStatus === "recording";
  const isPaused = roomStatus === "paused";
  const isActiveSession = isConnected || isRecording || isPaused;

  // Submit gate: paused AND within the valid time range AND host only
  const inValidRange = elapsed >= minSec && elapsed <= maxSec;
  const reachedMax = elapsed >= maxSec;
  const timerColor = elapsed >= maxSec * 0.9 ? "text-rose-500" : elapsed >= maxSec * 0.7 ? "text-amber-500" : "text-ink";

  return (
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium text-muted">Task {currentTaskIndex + 1} of {totalTasks}</p>
          <h1 className="mt-0.5 text-lg font-semibold text-ink">{currentTask?.title ?? "Recording"}</h1>
        </div>
        <span className={[
          "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold",
          isRecording ? "bg-rose-100 text-rose-700 animate-pulse"
            : isPaused ? "bg-amber-100 text-amber-700"
            : isConnected ? "bg-emerald-100 text-emerald-700"
            : "bg-slate-100 text-slate-600",
        ].join(" ")}>
          {isRecording ? "● REC" : isPaused ? "⏸ Paused" : isConnected ? "● Live" : "■ Done"}
        </span>
      </div>

      {/* ── Participant pills (always visible) ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        {room.participants.map((p) => (
          <span key={p.uid} className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-2 py-0.5">
            <span className={["h-1.5 w-1.5 rounded-full shrink-0", p.online ? "bg-emerald-400" : "bg-amber-400"].join(" ")} />
            <span className="text-[11px] font-medium text-ink">
              {p.name?.split(" ")[0] ?? p.email.split("@")[0]}
              {!p.online && <span className="ml-1 text-amber-500 text-[9px]">away</span>}
            </span>
          </span>
        ))}
      </div>

      {/* ── Prompt (always on top, compact) ── */}
      {prompt && (
        <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-primary">Prompt</p>
          <p className="text-sm leading-6 text-ink">{prompt.text}</p>
          <p className="mt-1.5 text-[10px] text-muted">min {minSec}s · max {formatDuration(maxSec)}</p>
        </div>
      )}

      {/* Remote audio (hidden — live call) */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

      {/* iOS autoplay gate: user must tap to unmute */}
      {needsAudioUnlock && (
        <button
          type="button"
          onClick={() => {
            remoteAudioRef.current?.play().then(() => setNeedsAudioUnlock(false)).catch(() => {});
          }}
          className="w-full rounded-[1rem] border border-amber-200 bg-amber-50 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
        >
          🔊 Tap to enable call audio
        </button>
      )}

      {/* WebRTC error / reconnect banner */}
      {webrtcError && (
        <div className="rounded-[1rem] border border-rose-100 bg-rose-50 px-4 py-2.5 text-xs text-rose-700">{webrtcError}</div>
      )}

      {/* Connecting spinner — only before call is live */}
      {localConnecting && isConnected && (
        <div className="flex items-center justify-center gap-2 rounded-[1rem] border border-slate-200 bg-white px-4 py-3">
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          <span className="text-xs text-muted">Establishing audio…</span>
        </div>
      )}

      {/* ── Connected: ready to record ── */}
      {isConnected && !localConnecting && (
        <div className="flex flex-col items-center gap-3 rounded-[1.75rem] border border-emerald-100 bg-white px-4 py-8">
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs font-medium text-emerald-700">Call is live — either speaker can start</span>
          </div>
          <button
            type="button"
            onClick={() => void handleStartRecording()}
            className="flex items-center gap-2 rounded-full bg-rose-600 px-8 py-3.5 text-sm font-semibold text-white shadow-[0_4px_20px_rgba(220,38,38,0.35)] hover:bg-rose-700 active:scale-95 transition-transform"
          >
            <span className="h-3 w-3 rounded-full bg-white/80" />
            Start Recording
          </button>
        </div>
      )}

      {/* ── Recording ── */}
      {isRecording && (
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-rose-100 bg-white px-4 py-8">
          <div className="flex flex-col items-center gap-1">
            <p className={["font-mono text-5xl font-light tracking-tight", timerColor].join(" ")}>
              {formatDuration(elapsed)}
            </p>
          </div>

          <div className="flex h-8 items-end gap-[2px]" aria-hidden="true">
            {levelBars.map((h, i) => (
              <div key={i} className="w-[3px] rounded-full bg-rose-400 transition-all duration-75" style={{ height: `${Math.max(4, h)}%` }} />
            ))}
          </div>

          {warnShown && (
            <p className="text-[11px] font-medium text-amber-600">⚠ Under 1 min left — wrap up naturally</p>
          )}

          <div className="flex items-center gap-3">
            {/* Pause — either party */}
            <button
              type="button"
              onClick={() => void handlePauseRecording()}
              className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-white text-lg text-slate-600 hover:bg-slate-50 active:scale-95 transition-transform"
              title="Pause"
            >
              ⏸
            </button>
          </div>
          {elapsed < minSec && (
            <p className="text-[10px] text-muted">{minSec - elapsed}s until you can submit</p>
          )}
        </div>
      )}

      {/* ── Paused ── */}
      {isPaused && (
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] border border-amber-100 bg-white px-4 py-8">
          <div className="flex flex-col items-center gap-1">
            <p className="font-mono text-5xl font-light tracking-tight text-amber-500">
              {formatDuration(elapsed)}
            </p>
            {reachedMax && (
              <p className="text-[11px] font-medium text-rose-600">Maximum time reached</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {/* Resume — either party, only if max not reached */}
            {!reachedMax && (
              <button
                type="button"
                onClick={() => void handleResumeRecording()}
                className="flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white hover:bg-primaryStrong active:scale-95 transition-transform"
              >
                ▶ Resume
              </button>
            )}

            {/* Submit — primary only, when in valid range */}
            {isPrimary && inValidRange && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleSubmitTask()}
                className="flex items-center gap-2 rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 active:scale-95 transition-transform"
              >
                {submitting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    {myUploadStatus === "uploading" ? "Uploading…" : "Submitting…"}
                  </>
                ) : (
                  isLastTask ? "Submit for review →" : "Submit & next task →"
                )}
              </button>
            )}
          </div>

          {!isPrimary && inValidRange && (
            <p className="text-[11px] text-muted">Waiting for host to submit…</p>
          )}
          {!inValidRange && !reachedMax && (
            <p className="text-[11px] text-muted">{minSec - elapsed}s more needed before submitting</p>
          )}
          {submitError && <p className="text-center text-sm text-rose-600">{submitError}</p>}
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
  const [geoBlocked, setGeoBlocked] = useState(false);
  const [geoDetectedCountry, setGeoDetectedCountry] = useState("");
  const [speakerTheme, setSpeakerTheme] = useState<"light" | "dark">("light");

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
    const saved = localStorage.getItem("deaimer-speaker-theme");
    if (saved === "dark" || saved === "light") setSpeakerTheme(saved);
  }, []);

  function handleSpeakerThemeChange(theme: "light" | "dark") {
    setSpeakerTheme(theme);
    localStorage.setItem("deaimer-speaker-theme", theme);
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

  // IP geolocation: verify speaker's registered country matches their actual location
  useEffect(() => {
    if (!speaker?.country) return;
    void (async () => {
      try {
        const res = await fetch("https://ipapi.co/json/");
        if (!res.ok) return; // fail open — don't block on API error
        const data = await res.json() as { country_name?: string };
        const detected = (data.country_name ?? "").trim();
        if (!detected) return;
        setGeoDetectedCountry(detected);
        if (detected.toLowerCase() !== speaker.country.toLowerCase()) {
          setGeoBlocked(true);
        }
      } catch {
        // fail open — network issues must not lock out speakers
      }
    })();
  }, [speaker?.country]);

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

  if (geoBlocked) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl font-semibold text-ink">Location mismatch</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            Your profile country is <strong>{speaker?.country}</strong>, but your current location appears to be <strong>{geoDetectedCountry}</strong>.
            Only speakers located in their registered country can access the platform.
          </p>
          <p className="mt-2 max-w-sm text-xs text-muted">If this is incorrect, please contact your project coordinator.</p>
          <button type="button" onClick={() => void handleSignOut()} className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong">
            Sign out
          </button>
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

  const themeClass = speakerTheme === "dark" ? "cand-dark" : "";
  const shell = (
    <DeaimerSiteShell
      platformSideMenuItems={speakerMenuItems}
      userProfile={userProfile}
      onSignOut={() => void handleSignOut()}
      themeToggle={{
        theme: speakerTheme,
        onToggle: () => handleSpeakerThemeChange(speakerTheme === "dark" ? "light" : "dark"),
      }}
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
  return themeClass ? <div className={themeClass}>{shell}</div> : shell;
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
    speakerId: "",
    ageGroup: "",
    deviceCategory: "",
    deviceManufacturer: "",
    deviceModel: "",
    educationLevel: "",
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
