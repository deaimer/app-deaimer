"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
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
  VideoMeetingClientStatus,
  VideoProjectParticipant,
  getVideoSlot,
  saveMyVideoAvailability,
  type VideoProject,
} from "@/lib/firebase/video-collection";

// ─── Types ────────────────────────────────────────────────────────────────────

type ParticipantView = "home" | "projects" | "profile" | "settings";
type EmailMode = "signup" | "signin";

type SlotMeeting = {
  id: string;
  slotId: string;
  meetingUrl: string;
  clientStatus: VideoMeetingClientStatus;
  participantAUid: string;
  participantBUid: string;
  participantAName: string;
  participantBName: string;
};

type Assignment = {
  project: VideoProject;
  participant: VideoProjectParticipant;
  meetings: SlotMeeting[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const SESSION_STATUS_CFG: Record<VideoMeetingClientStatus, { label: string; cls: string }> = {
  under_review:     { label: "Under Review",     cls: "border-amber-200 bg-amber-50 text-amber-800" },
  meeting_booked:   { label: "Meeting Booked",   cls: "border-blue-200 bg-blue-50 text-blue-800" },
  session_approved: { label: "Session Approved", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  session_rejected: { label: "Session Rejected", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  no_show_up:       { label: "No Show Up",       cls: "border-slate-200 bg-slate-100 text-slate-600" },
};

const emptyEmailForm = { email: "", password: "", confirmPassword: "" };

function isSlotExpired(slotId: string): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(slotId);
  if (!m) return false;
  const [, date, time] = m;
  const [y, mo, d] = date.split("-").map(Number);
  const hour = time === "9AM" ? 9 : time === "11AM" ? 11 : time === "1PM" ? 13 : 0;
  return new Date(y, mo - 1, d, hour + 1) < new Date();
}
const emptyDraft: PortalProfileDraft = {
  firstName: "",
  lastName: "",
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: VideoMeetingClientStatus }) {
  const { label, cls } = SESSION_STATUS_CFG[status];
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function getPartnerName(meeting: SlotMeeting, myUid: string): string {
  return meeting.participantAUid === myUid ? meeting.participantBName : meeting.participantAName;
}

// ─── Google icon ──────────────────────────────────────────────────────────────

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

// ─── Profile form ─────────────────────────────────────────────────────────────

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
              ["First name", profile.firstName || profile.fullName.split(" ")[0] || "Not added"],
              ["Last name", profile.lastName || profile.fullName.split(" ").slice(1).join(" ") || "Not added"],
              ["Email", profile.email || activeUser?.email || "Not added"],
              ["Country", profileCountry || "Not added"],
              ["City", profileCity || "Not added"],
              ["Phone", profile.phone || "Not added"],
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
            <span className="mb-2 block text-sm font-medium text-ink">First name</span>
            <input name="firstName" value={draft.firstName} onChange={onChange} required placeholder="First name" className={fieldClass} />
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Last name</span>
            <input name="lastName" value={draft.lastName} onChange={onChange} required placeholder="Last name" className={fieldClass} />
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
            <span className="mb-2 block text-sm font-medium text-ink">Country Code</span>
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
                <option key={item.code} value={item.code}>{item.label} ({item.code})</option>
              ))}
            </select>
          </label>
          <label>
            <span className="mb-2 block text-sm font-medium text-ink">Phone</span>
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
        </div>
        <button disabled={isSaving} className="mt-5 w-full rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Saving profile..." : "Save profile"}
        </button>
      </section>
    </form>
  );
}

// ─── Slot grid ────────────────────────────────────────────────────────────────

const SLOT_TIME_LABELS = ["9AM", "11AM", "1PM"] as const;

type SlotVariant = "selected" | "full" | "notAllowed" | "popular" | "open" | "disabled" | "locked";

const SLOT_BTN_CLS: Record<SlotVariant, string> = {
  selected:   "border-primary bg-primary text-white shadow-sm",
  full:       "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500",
  notAllowed: "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-400",
  popular:    "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
  open:       "border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary",
  disabled:   "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300",
  locked:     "cursor-not-allowed border-blue-200 bg-blue-50 text-blue-700",
};

function SlotGrid({
  days,
  slot1,
  slot2,
  step,
  slotDemand,
  slotNames,
  conflictedSlots,
  lockedSlotIds,
  onSlotClick,
  isLoading,
}: {
  days: Array<{ date: string; dayLabel: string; slots: typeof VIDEO_SCHEDULE_SLOTS }>;
  slot1: string | null;
  slot2: string | null;
  step: 1 | 2;
  slotDemand: Record<string, number>;
  slotNames: Record<string, string>;
  conflictedSlots: Set<string>;
  lockedSlotIds: Set<string>;
  onSlotClick: (slotId: string) => void;
  isLoading?: boolean;
}) {
  if (isLoading) {
    return (
      <section className="flex min-h-[260px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </section>
    );
  }

  if (days.length === 0) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center text-sm text-muted">
        The scheduling window has passed. Contact your project manager.
      </section>
    );
  }

  function renderSlotBtn(
    slot: (typeof VIDEO_SCHEDULE_SLOTS)[number],
    timeLabel?: string,
  ) {
    const demand = slotDemand[slot.id] ?? 0;
    const isStep1 = slot.id === slot1;
    const isStep2 = slot.id === slot2;
    const isSelectedByMe = isStep1 || isStep2;
    const isFull = demand >= 2 && !isSelectedByMe;
    const isConflicted = step === 2 && !isSelectedByMe && conflictedSlots.has(slot.id);
    const isLimitReached = slot1 !== null && slot2 !== null && !isSelectedByMe;
    const isSameAsStep1 = step === 2 && slot.id === slot1;

    const isLocked = lockedSlotIds.has(slot.id);

    let variant: SlotVariant;
    if (isLocked) variant = "locked";
    else if (isStep1 || isStep2) variant = "selected";
    else if (isFull) variant = "full";
    else if (isConflicted) variant = "notAllowed";
    else if (isLimitReached || isSameAsStep1) variant = "disabled";
    else if (demand === 1) variant = "popular";
    else variant = "open";

    const isClickable = variant !== "full" && variant !== "disabled" && variant !== "notAllowed" && variant !== "locked";
    const peerName = slotNames[slot.id];
    const selLabel = isStep1 ? "Session 1" : "Session 2";

    return (
      <button
        key={slot.id}
        type="button"
        disabled={!isClickable}
        onClick={() => onSlotClick(slot.id)}
        className={`inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border py-3 text-[11px] font-semibold transition ${SLOT_BTN_CLS[variant]}`}
      >
        {/* Time label shown inside the button on mobile */}
        {timeLabel ? (
          <span className={`text-[9px] font-bold uppercase tracking-wider mb-0.5 ${variant === "selected" ? "opacity-75" : "opacity-50"}`}>
            {timeLabel}
          </span>
        ) : null}

        {variant === "selected" ? (
          <>
            <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>{selLabel}</span>
          </>
        ) : variant === "full" ? (
          <span>Full</span>
        ) : variant === "notAllowed" ? (
          <>
            <span>Not</span>
            <span>Allowed</span>
          </>
        ) : variant === "popular" ? (
          <>
            <span className="w-full truncate px-1 text-center">{peerName ?? "1 joined"}</span>
            <span className="text-[9px] font-normal opacity-70">1 open</span>
          </>
        ) : variant === "open" ? (
          <span>Open</span>
        ) : null}
      </button>
    );
  }

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      {/* ── Desktop column header (hidden on mobile) ── */}
      <div className="hidden sm:grid sm:grid-cols-[1fr_repeat(3,_108px)] gap-x-2 border-b border-slate-100 bg-panelStrong px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Day</span>
        {SLOT_TIME_LABELS.map((t) => (
          <span key={t} className="text-center text-[10px] font-bold uppercase tracking-widest text-muted">{t} EDT</span>
        ))}
      </div>

      <div className="divide-y divide-slate-100">
        {days.map(({ date, dayLabel, slots }) => (
          <div key={date}>
            {/* ── Desktop row ── */}
            <div className="hidden sm:grid sm:grid-cols-[1fr_repeat(3,_108px)] items-center gap-x-2 px-5 py-2.5">
              <span className="text-sm font-medium text-ink">{dayLabel}</span>
              {slots.map((slot) => renderSlotBtn(slot))}
            </div>

            {/* ── Mobile row: day label + 3 equal-width buttons ── */}
            <div className="sm:hidden px-3 py-3">
              <p className="mb-2 text-xs font-semibold text-muted">{dayLabel}</p>
              <div className="grid grid-cols-3 gap-2">
                {slots.map((slot, i) => renderSlotBtn(slot, SLOT_TIME_LABELS[i]))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Schedule workspace ───────────────────────────────────────────────────────

function ParticipantScheduleWorkspace({
  user,
  profile,
  assignments,
  onDone,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Assignment[];
  onDone?: (slot1: string, slot2: string) => void;
}) {
  const assignment = assignments[0] ?? null;
  const [step, setStep] = useState<1 | 2>(1);
  const [slot1, setSlot1] = useState<string | null>(null);
  const [slot2, setSlot2] = useState<string | null>(null);
  const [slotDemand, setSlotDemand] = useState<Record<string, number>>({});
  const [slotNames, setSlotNames] = useState<Record<string, string>>({});
  const [pairings, setPairings] = useState<[string, string][]>([]);
  const [isLoadingDemand, setIsLoadingDemand] = useState(true);
  const [notes, setNotes] = useState("");
  const [confirmedSlots, setConfirmedSlots] = useState<[string, string] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lockedSlotIds = useMemo(() => {
    const locked = new Set<string>();
    (assignment?.meetings ?? []).forEach((m) => { if (m.meetingUrl) locked.add(m.slotId); });
    return locked;
  }, [assignment]);

  useEffect(() => {
    if (!assignment) return;
    const saved = assignment.participant.selectedSlotIds;
    const locked = new Set<string>();
    assignment.meetings.forEach((m) => { if (m.meetingUrl) locked.add(m.slotId); });
    const hasMeeting = (sid: string) => assignment.meetings.some((m) => m.slotId === sid);

    let initSlot1: string | null = saved[0] ?? null;
    let initSlot2: string | null = saved[1] ?? null;

    // Clear expired+unmatched slots (not locked by client URL)
    if (initSlot1 && !locked.has(initSlot1) && isSlotExpired(initSlot1) && !hasMeeting(initSlot1)) initSlot1 = null;
    if (initSlot2 && !locked.has(initSlot2) && isSlotExpired(initSlot2) && !hasMeeting(initSlot2)) initSlot2 = null;

    setSlot1(initSlot1);
    setSlot2(initSlot2);
    setNotes(assignment.participant.schedulingNotes);
    // Start at step 1 if slot1 is empty (and it's not a locked slot), else step 2
    setStep(!initSlot1 && !locked.has(saved[0] ?? "") ? 1 : 2);
  }, [assignment?.project.id]);

  useEffect(() => {
    if (!assignment || !user) return;
    let cancelled = false;
    setIsLoadingDemand(true);
    void (async () => {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(
          `/api/video/slot-demand?projectId=${encodeURIComponent(assignment.project.id)}&uid=${encodeURIComponent(user.uid)}`,
          { headers: { Authorization: `Bearer ${idToken}` } },
        );
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json() as { demand: Record<string, number>; pairings: [string, string][]; slotNames: Record<string, string> };
          setSlotDemand(data.demand ?? {});
          setPairings(data.pairings ?? []);
          setSlotNames(data.slotNames ?? {});
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setIsLoadingDemand(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignment?.project.id, user.uid]);

  const savedSlotIds = assignment?.participant.selectedSlotIds ?? [];

  const allDays = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const toDateStr = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    const dates = new Set<string>();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Always include tomorrow if it's a weekday (bookable near-future slot)
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    if (tomorrow.getDay() !== 0 && tomorrow.getDay() !== 6) {
      const tomorrowStr = toDateStr(tomorrow);
      if (VIDEO_SCHEDULE_SLOTS.some((s) => s.date === tomorrowStr)) {
        dates.add(tomorrowStr);
      }
    }

    // 6 fresh future weekdays starting from day-after-tomorrow
    let daysAdded = 0;
    let offset = 2;
    while (daysAdded < 6 && offset <= 30) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      offset++;
      if (d.getDay() === 0 || d.getDay() === 6) continue;
      const dateStr = toDateStr(d);
      if (!VIDEO_SCHEDULE_SLOTS.some((s) => s.date === dateStr)) break;
      dates.add(dateStr);
      daysAdded++;
    }

    // Always include already-booked slot dates (past or within buffer)
    for (const slotId of savedSlotIds) {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(slotId);
      if (m) dates.add(m[1]);
    }

    return [...dates].sort().map((dateStr) => {
      const fromLib = VIDEO_SCHEDULE_SLOTS.filter((s) => s.date === dateStr);
      if (fromLib.length > 0) return { date: dateStr, dayLabel: fromLib[0].dayLabel, slots: fromLib };
      const [y, mo, d] = dateStr.split("-").map(Number);
      const dayLabel = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" })
        .format(new Date(y, mo - 1, d));
      return {
        date: dateStr,
        dayLabel,
        slots: (["9AM", "11AM", "1PM"] as const).map((time) => ({
          id: `${dateStr}-${time}`, date: dateStr, time, dayLabel, label: `${dayLabel} · ${time} EDT`,
        })),
      };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedSlotIds.join(",")]);

  const conflictedSlots = useMemo(() => {
    if (!slot1) return new Set<string>();
    const conflicts = new Set<string>();
    for (const [a, b] of pairings) {
      if (a === slot1) conflicts.add(b);
      if (b === slot1) conflicts.add(a);
    }
    return conflicts;
  }, [slot1, pairings]);

  function handleSlotClick(slotId: string) {
    if (lockedSlotIds.has(slotId)) return;
    const demand = slotDemand[slotId] ?? 0;
    if (demand >= 2) return;
    if (step === 1) {
      if (lockedSlotIds.has(slot1 ?? "")) return; // slot1 is locked, skip
      setSlot1((cur) => (cur === slotId ? null : slotId));
    } else {
      if (lockedSlotIds.has(slot2 ?? "")) return; // slot2 is locked, skip
      if (slotId === slot1) return;
      if (conflictedSlots.has(slotId)) return;
      setSlot2((cur) => (cur === slotId ? null : slotId));
    }
  }

  async function handleSubmit() {
    if (!assignment || !slot1 || !slot2) return;
    setIsSaving(true);
    setError(null);
    try {
      await saveMyVideoAvailability({
        projectId: assignment.project.id,
        participantId: assignment.participant.id,
        uid: user.uid,
        fullName: profile.fullName,
        email: profile.email || user.email || "",
        selectedSlotIds: [slot1, slot2],
        schedulingNotes: notes,
      });
      setConfirmedSlots([slot1, slot2]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!assignment) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center">
        <h1 className="text-2xl font-semibold text-ink">No project assigned yet</h1>
        <p className="mt-3 text-sm leading-7 text-muted">Check back soon — your project will appear here once assigned.</p>
      </section>
    );
  }

  if (confirmedSlots) {
    return (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
          <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <h2 className="mt-5 text-2xl font-semibold text-ink">Sessions confirmed!</h2>
        <p className="mt-2 text-sm text-muted">Your availability has been submitted. We will be in touch with next steps.</p>
        <div className="mx-auto mt-6 grid max-w-sm gap-3 text-left">
          <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1</p>
            <p className="mt-1 text-sm font-semibold text-ink">{getVideoSlot(confirmedSlots[0])?.label ?? confirmedSlots[0]}</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-5 py-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 2</p>
            <p className="mt-1 text-sm font-semibold text-ink">{getVideoSlot(confirmedSlots[1])?.label ?? confirmedSlots[1]}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onDone?.(confirmedSlots[0], confirmedSlots[1])}
          className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
        >
          Back to project
        </button>
      </section>
    );
  }

  const description = assignment.project.jobDescription.replace(/<[^>]*>/g, "").trim();

  return (
    <div className="space-y-4">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Scheduling</p>
            <h1 className="mt-1.5 text-2xl font-semibold text-ink">{assignment.project.title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className={`h-2 w-2 rounded-full ${step >= 1 ? "bg-primary" : "bg-slate-200"}`} />
              <div className={`h-6 w-px ${step >= 2 ? "bg-primary" : "bg-slate-200"}`} />
              <div className={`h-2 w-2 rounded-full ${step >= 2 ? "bg-primary" : "bg-slate-200"}`} />
            </div>
            <span className="text-xs font-medium text-muted">Step {step} of 2</span>
          </div>
        </div>
        <p className="mt-3 text-xs leading-5 text-muted">
          {step === 1
            ? "Select your first available session — all times are in Eastern Daylight Time (EDT)."
            : "Choose your second session. Sessions with open spots are shown — pick one to be paired with another participant."}
        </p>
      </section>

      {error ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      ) : null}

      <SlotGrid
        days={allDays}
        slot1={slot1}
        slot2={slot2}
        step={step}
        slotDemand={slotDemand}
        slotNames={slotNames}
        conflictedSlots={conflictedSlots}
        lockedSlotIds={lockedSlotIds}
        onSlotClick={handleSlotClick}
        isLoading={isLoadingDemand}
      />

      {step === 1 && slot1 ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-3 rounded-[1.5rem] border border-primary/20 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-sm sm:px-6">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1 locked in</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">{getVideoSlot(slot1)?.label ?? slot1}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="shrink-0 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong sm:px-5"
          >
            Next →
          </button>
        </div>
      ) : null}

      {step === 2 ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-4 sm:p-5">
          <label className="block">
            <span className="text-sm font-medium text-ink">Notes for the scheduler <span className="font-normal text-muted">(optional)</span></span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any scheduling preferences or constraints..."
              className="mt-2 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/70 focus:border-primary"
            />
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <div className="sticky bottom-4 z-10 rounded-[1.5rem] border border-slate-200 bg-white/95 px-4 py-4 shadow-lg backdrop-blur-sm sm:px-6">
          {/* Sessions summary */}
          <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-4">
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink sm:text-sm">{getVideoSlot(slot1 ?? "")?.label ?? slot1 ?? "—"}</p>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 2</p>
              <p className="mt-0.5 truncate text-xs font-semibold text-ink sm:text-sm">
                {slot2 ? (getVideoSlot(slot2)?.label ?? slot2) : <span className="font-normal text-muted">Pick above</span>}
              </p>
            </div>
          </div>
          {/* Buttons */}
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-slate-300"
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={isSaving || !slot1 || !slot2}
              onClick={() => void handleSubmit()}
              className="flex-1 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Confirm →"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Project detail / list view ───────────────────────────────────────────────

function sessionSlotLabel(slotId: string): string {
  const slot = getVideoSlot(slotId);
  if (slot) return slot.label;
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(slotId);
  if (m) {
    const [, date, time] = m;
    const [y, mo, d] = date.split("-").map(Number);
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" })
      .format(new Date(y, mo - 1, d));
    return `${day} · ${time} EDT`;
  }
  return slotId;
}

function ParticipantProjectsView({
  user,
  profile,
  assignments,
  isLoading,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Assignment[];
  isLoading: boolean;
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [confirmedMap, setConfirmedMap] = useState<Record<string, [string, string]>>({});

  function openProject(projectId: string) {
    setSelectedProjectId(projectId);
    setScheduleOpen(false);
  }

  const selectedAssignment = assignments.find((a) => a.project.id === selectedProjectId) ?? null;

  // Schedule workspace view
  if (selectedAssignment && scheduleOpen) {
    return (
      <div className="space-y-4 pt-4">
        <button
          type="button"
          onClick={() => setScheduleOpen(false)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:bg-panelStrong hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to project
        </button>
        <ParticipantScheduleWorkspace
          user={user}
          profile={profile}
          assignments={[selectedAssignment]}
          onDone={(s1, s2) => {
            setConfirmedMap((cur) => ({ ...cur, [selectedAssignment.project.id]: [s1, s2] }));
            setScheduleOpen(false);
          }}
        />
      </div>
    );
  }

  // Project detail view
  if (selectedAssignment) {
    const { project, participant, meetings } = selectedAssignment;
    const localConfirmed = confirmedMap[project.id] ?? null;
    const savedSlots = participant.selectedSlotIds;
    const isConfirmed = !!(localConfirmed ?? (savedSlots.length >= 2 ? savedSlots : null));
    const s1 = localConfirmed?.[0] ?? savedSlots[0] ?? null;
    const s2 = localConfirmed?.[1] ?? savedSlots[1] ?? null;
    const description = project.jobDescription.replace(/<[^>]*>/g, "").trim();
    const hasMeetings = meetings.length > 0;

    // Locked = client has added a meeting URL for that slot
    const lockedSlotSet = new Set(meetings.filter((m) => m.meetingUrl).map((m) => m.slotId));
    const isS1Locked = !!(s1 && lockedSlotSet.has(s1));
    const isS2Locked = !!(s2 && lockedSlotSet.has(s2));
    const allSessionsLocked = isS1Locked && isS2Locked;

    // Expired+unmatched = past their time with no meeting booked
    const hasMeetingForSlot = (sid: string) => meetings.some((m) => m.slotId === sid);
    const expiredSlots = [s1, s2].filter((sid): sid is string =>
      !!sid && !lockedSlotSet.has(sid) && isSlotExpired(sid) && !hasMeetingForSlot(sid)
    );
    const hasExpiredSlots = expiredSlots.length > 0;

    return (
      <div className="space-y-4 pt-4">
        <button
          type="button"
          onClick={() => setSelectedProjectId(null)}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:bg-panelStrong hover:text-ink"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to projects
        </button>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-ink">{project.title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
        </section>

        {isConfirmed ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-3 mb-5">
              {hasMeetings ? (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50">
                    <svg className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                      <path d="M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.894L15 14M3 8a2 2 0 012-2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-ink">Meeting Booked</h2>
                    <p className="text-xs text-muted">Your sessions have been confirmed by the client.</p>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50">
                    <svg className="h-5 w-5 text-emerald-600" fill="none" viewBox="0 0 24 24">
                      <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-ink">Schedule Confirmed</h2>
                    <p className="text-xs text-muted">Your sessions have been submitted successfully.</p>
                  </div>
                </>
              )}
            </div>

            {s1 && s2 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {([{ label: "Session 1", slotId: s1 }, { label: "Session 2", slotId: s2 }] as const).map(({ label, slotId }) => {
                  const meeting = meetings.find((m) => m.slotId === slotId);
                  const status: VideoMeetingClientStatus = meeting?.clientStatus ?? "under_review";
                  const partnerName = meeting ? getPartnerName(meeting, participant.uid || participant.id) : null;
                  return (
                    <div key={label} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-primary">{label}</p>
                        <StatusBadge status={status} />
                      </div>
                      <p className="mt-2 text-sm font-semibold text-ink">{sessionSlotLabel(slotId)}</p>
                      {partnerName ? (
                        <p className="mt-1 text-xs text-muted">Partner: <span className="font-medium text-ink">{partnerName}</span></p>
                      ) : null}
                      {meeting?.meetingUrl ? (
                        <a
                          href={meeting.meetingUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-2 block truncate text-xs text-primary underline-offset-2 hover:underline"
                        >
                          {meeting.meetingUrl}
                        </a>
                      ) : (
                        <p className="mt-2 text-xs text-muted/70">Meeting link will appear here once added.</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : null}

            {hasExpiredSlots && (
              <div className="mt-4 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {expiredSlots.length === 1
                  ? "One of your sessions passed without a match. Please select a new time slot."
                  : "Both sessions passed without a match. Please select new time slots."}
              </div>
            )}
            {!allSessionsLocked && (
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className={`mt-4 rounded-full border px-5 py-2.5 text-sm font-medium transition ${
                  hasExpiredSlots
                    ? "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                    : "border-slate-200 bg-white text-muted hover:border-slate-300"
                }`}
              >
                {hasExpiredSlots ? "Reschedule now →" : "Change sessions"}
              </button>
            )}
          </section>
        ) : (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <svg className="h-7 w-7 text-primary" fill="none" viewBox="0 0 24 24">
                  <rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Schedule your sessions</h2>
              <p className="mt-2 max-w-xs text-sm text-muted">
                Select two available time slots so we can pair you with another participant.
              </p>
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                disabled={isLoading}
                className="mt-5 inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-70"
              >
                {isLoading ? (
                  <>
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                    Loading...
                  </>
                ) : "Schedule Meeting →"}
              </button>
            </div>
          </section>
        )}
      </div>
    );
  }

  // Project list view
  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs uppercase tracking-[0.2em] text-muted">Participant workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Projects</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Video collection projects assigned to you appear here.
        </p>
      </section>

      {isLoading ? (
        <section className="flex min-h-[180px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </section>
      ) : assignments.length === 0 ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm leading-7 text-muted">
          No projects have been assigned to you yet. Check back soon.
        </section>
      ) : (
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map(({ project, participant, meetings }) => {
            const localConfirmed = confirmedMap[project.id];
            const isConfirmed = !!(localConfirmed ?? (participant.selectedSlotIds.length >= 2 ? true : false));
            const hasMeetings = meetings.length > 0;
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => openProject(project.id)}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-primary/40 hover:shadow-panel"
              >
                <p className="font-semibold text-ink">{project.title}</p>
                <p className="mt-2 text-xs text-muted">
                  {isConfirmed ? (hasMeetings ? "Meeting scheduled" : "2 sessions selected") : "Availability not submitted yet"}
                </p>
                <span className={[
                  "mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold",
                  !isConfirmed
                    ? "bg-primary/10 text-primary"
                    : hasMeetings
                      ? "bg-blue-50 text-blue-700"
                      : "bg-emerald-50 text-emerald-700",
                ].join(" ")}>
                  {!isConfirmed ? "Open →" : hasMeetings ? "Meeting Booked" : "Schedule confirmed ✓"}
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

// ─── Profile completion gate ──────────────────────────────────────────────────

function isProfileComplete(p: PortalProfile) {
  const [country = "", city = ""] = p.location.split(" | ");
  return !!(p.fullName && country && city && p.phone);
}

function ProfileCompletionGate({
  draft,
  activeUser,
  isSaving,
  error,
  onChange,
  onSubmit,
}: {
  draft: PortalProfileDraft;
  activeUser: User;
  isSaving: boolean;
  error: string | null;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const [country = "", city = ""] = draft.location.split(" | ");
  const [phoneCode = "+1", phoneNumber = ""] = draft.phone.split(" ");

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-lg">
        <div className="rounded-[1.5rem] border border-slate-200 bg-white p-8 shadow-panel">
          <p className="text-xs uppercase tracking-[0.2em] text-muted">Welcome</p>
          <h1 className="mt-2 text-2xl font-semibold text-ink">Complete your profile</h1>
          <p className="mt-3 text-sm leading-7 text-muted">
            Please fill in your details before continuing. This information is required for scheduling.
          </p>

          {error ? (
            <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">First name</span>
                <input name="firstName" value={draft.firstName} onChange={onChange} required placeholder="First name" className={fieldClass} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Last name</span>
                <input name="lastName" value={draft.lastName} onChange={onChange} required placeholder="Last name" className={fieldClass} />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Email</span>
              <input type="email" value={activeUser.email ?? ""} disabled className={fieldClass} />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Country</span>
              <select
                value={country}
                onChange={(e) =>
                  onChange({
                    target: { name: "location", value: `${e.target.value} | ${city}` },
                  } as ChangeEvent<HTMLSelectElement>)
                }
                required
                className={fieldClass}
              >
                <option value="">Select country</option>
                {countryOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">City</span>
              <input
                value={city}
                onChange={(e) =>
                  onChange({
                    target: { name: "location", value: `${country} | ${e.target.value}` },
                  } as ChangeEvent<HTMLInputElement>)
                }
                required
                placeholder="Your city"
                className={fieldClass}
              />
            </label>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Phone code</span>
                <select
                  value={phoneCode}
                  onChange={(e) =>
                    onChange({
                      target: { name: "phone", value: `${e.target.value} ${phoneNumber}` },
                    } as ChangeEvent<HTMLSelectElement>)
                  }
                  className={fieldClass}
                >
                  {phoneCountryCodes.map((item) => (
                    <option key={item.code} value={item.code}>{item.label} ({item.code})</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Phone number</span>
                <input
                  value={phoneNumber}
                  onChange={(e) =>
                    onChange({
                      target: { name: "phone", value: `${phoneCode} ${e.target.value}` },
                    } as ChangeEvent<HTMLInputElement>)
                  }
                  required
                  placeholder="Your number"
                  className={fieldClass}
                />
              </label>
            </div>
            <button disabled={isSaving} className="mt-2 w-full rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white disabled:opacity-60">
              {isSaving ? "Saving..." : "Continue"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

// ─── Main portal ──────────────────────────────────────────────────────────────

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
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
  const [isAuthBusy, setIsAuthBusy] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setHasMounted(true);
    const savedTheme = window.localStorage.getItem("deaimer-participant-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    if (searchParams.get("projects") === "1") { setActiveView("projects"); return; }
    if (searchParams.get("profile") === "1") { setActiveView("profile"); return; }
    if (searchParams.get("settings") === "1") { setActiveView("settings"); return; }
    setActiveView("home");
  }, [searchParams]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady) { setAuthReady(true); return; }
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;
    async function init() {
      await ensureFirebaseAuthPersistence();
      await resolveFirebaseRedirectSignIn();
      const { auth } = getFirebaseClientServices();
      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (cancelled) return;
        if (user) setIsLoadingProfile(true);
        else setIsLoadingProfile(false);
        setActiveUser(user);
        setAuthReady(true);
      });
    }
    void init().catch((nextError) => {
      setError(nextError instanceof Error ? nextError.message : "Could not initialize sign in.");
      setAuthReady(true);
    });
    return () => { cancelled = true; unsubscribe?.(); };
  }, [firebaseReady, hasMounted]);

  useEffect(() => {
    if (!activeUser || !firebaseReady) { setProfile(null); setIsLoadingProfile(false); return; }
    let cancelled = false;
    void getPortalProfile(activeUser.uid, "participants")
      .then((existing) => {
        if (cancelled) return;
        setProfile(existing);
        setDraft(existing ?? createProfileDraft(activeUser, "participants"));
        setIsEditingProfile(!existing);
      })
      .catch((nextError) => setError(nextError instanceof Error ? nextError.message : "Could not load profile."))
      .finally(() => { if (!cancelled) setIsLoadingProfile(false); });
    return () => { cancelled = true; };
  }, [activeUser, firebaseReady]);

  const loadAssignments = useCallback(async () => {
    if (!activeUser || !profile) { setAssignments([]); setIsLoadingAssignments(false); return; }
    setIsLoadingAssignments(true);
    try {
      const idToken = await activeUser.getIdToken();
      const email = encodeURIComponent(activeUser.email ?? "");
      const uid = encodeURIComponent(activeUser.uid);
      const res = await fetch(`/api/video/assignments?uid=${uid}&email=${email}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Could not load assignments.");
      const data = await res.json() as { assignments: Assignment[] };
      setAssignments(data.assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignments.");
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [activeUser, profile]);

  useEffect(() => { void loadAssignments(); }, [loadAssignments]);
  useEffect(() => {
    if (activeView === "projects") void loadAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView]);

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
    setDraft((current) => {
      const next = { ...current, [name]: value };
      if (name === "firstName") next.fullName = `${value} ${current.lastName}`.trim();
      if (name === "lastName") next.fullName = `${current.firstName} ${value}`.trim();
      return next;
    });
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
      const code = (nextError as { code?: string }).code;
      if (code === "auth/invalid-credential" || code === "auth/wrong-password" || code === "auth/user-not-found") {
        setError("Incorrect email or password. Please check your credentials and try again.");
      } else if (code === "auth/too-many-requests") {
        setError("Too many failed attempts. Please wait a moment and try again.");
      } else if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists. Try signing in instead.");
      } else {
        setError(nextError instanceof Error ? nextError.message : "Email sign in failed.");
      }
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
    if (!activeUser || !profile) return;
    const confirmed = window.confirm(
      "Delete your participant profile and scheduling account data? This cannot be undone.",
    );
    if (!confirmed) return;
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

  if (!hasMounted || !authReady || (!!activeUser && isLoadingProfile)) {
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

  if (!profile || !isProfileComplete(profile)) {
    return (
      <ProfileCompletionGate
        draft={draft}
        activeUser={activeUser}
        isSaving={isSaving}
        error={error}
        onChange={onDraftChange}
        onSubmit={onProfileSubmit}
      />
    );
  }

  const content = (
    <DeaimerSiteShell
      platformSideMenuItems={menuItems.map((item) => ({ ...item, active: item.active }))}
      userProfile={{ name: profile.fullName || activeUser.email || "Participant", href: "/participants", imageUrl: profile.photoUrl || activeUser.photoURL }}
      onSignOut={() => void onSignOut()}
      themeToggle={{ theme, onToggle: () => changeTheme(theme === "dark" ? "light" : "dark") }}
    >
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {error ? <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
        {message ? <div className="mb-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

        {activeView === "home" ? (
          <div className="space-y-6">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-muted">Participant home</p>
              <h1 className="mt-2 text-3xl font-semibold text-ink">Welcome, {profile.firstName || profile.fullName}</h1>
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

        {activeView === "projects" ? <ParticipantProjectsView user={activeUser} profile={profile} assignments={assignments} isLoading={isLoadingAssignments} /> : null}
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
