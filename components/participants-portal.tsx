"use client";

import { ChangeEvent, FormEvent, useCallback, useEffect, useMemo, useState } from "react";
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


function SlotGrid({
  days,
  slot1,
  slot2,
  step,
  slotDemand,
  conflictedSlots,
  onSlotClick,
  isLoading,
}: {
  days: Array<{ date: string; dayLabel: string; slots: typeof VIDEO_SCHEDULE_SLOTS }>;
  slot1: string | null;
  slot2: string | null;
  step: 1 | 2;
  slotDemand: Record<string, number>;
  conflictedSlots: Set<string>;
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

  return (
    <section className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
      <div className="grid grid-cols-[1fr_repeat(3,_108px)] gap-x-2 border-b border-slate-100 bg-panelStrong px-5 py-3">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Day</span>
        {(["9AM", "11AM", "1PM"] as const).map((t) => (
          <span key={t} className="text-center text-[10px] font-bold uppercase tracking-widest text-muted">{t} EDT</span>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {days.map(({ date, dayLabel, slots }) => (
          <div key={date} className="grid grid-cols-[1fr_repeat(3,_108px)] items-center gap-x-2 px-5 py-2.5">
            <span className="text-sm font-medium text-ink">{dayLabel}</span>
            {slots.map((slot) => {
              const demand = slotDemand[slot.id] ?? 0;
              const isStep1 = slot.id === slot1;
              const isStep2 = slot.id === slot2;
              const isSelectedByMe = isStep1 || isStep2;
              const isFull = demand >= 2 && !isSelectedByMe;
              const isConflicted = step === 2 && !isSelectedByMe && conflictedSlots.has(slot.id);
              const isLimitReached = slot1 !== null && slot2 !== null && !isSelectedByMe;
              const isSameAsStep1 = step === 2 && slot.id === slot1;

              type Variant = "selected" | "full" | "notAllowed" | "popular" | "open" | "disabled";
              let variant: Variant;
              if (isStep1 || isStep2) variant = "selected";
              else if (isFull) variant = "full";
              else if (isConflicted) variant = "notAllowed";
              else if (isLimitReached || isSameAsStep1) variant = "disabled";
              else if (demand === 1) variant = "popular";
              else variant = "open";

              const isClickable = variant !== "full" && variant !== "disabled" && variant !== "notAllowed";

              const btnClass: Record<Variant, string> = {
                selected: "border-primary bg-primary text-white shadow-sm",
                full: "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-500",
                notAllowed: "cursor-not-allowed border-rose-200 bg-rose-50 text-rose-400",
                popular: "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100",
                open: "border-slate-200 bg-white text-slate-500 hover:border-primary/50 hover:text-primary",
                disabled: "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300",
              };

              const label = isStep1 ? "Session 1" : isStep2 ? "Session 2" : null;

              return (
                <button
                  key={slot.id}
                  type="button"
                  disabled={!isClickable}
                  onClick={() => onSlotClick(slot.id)}
                  className={`inline-flex w-full flex-col items-center justify-center gap-0.5 rounded-xl border py-2.5 text-[11px] font-semibold transition ${btnClass[variant]}`}
                >
                  {variant === "selected" ? (
                    <>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span>{label}</span>
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
                      <span>1 joined</span>
                      <span className="text-[9px] font-normal opacity-70">1 open</span>
                    </>
                  ) : variant === "open" ? (
                    <span>Open</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </section>
  );
}

function ParticipantScheduleWorkspace({
  user,
  profile,
  assignments,
  onDone,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }>;
  onDone?: (slot1: string, slot2: string) => void;
}) {
  const assignment = assignments[0] ?? null;
  const [step, setStep] = useState<1 | 2>(1);
  const [slot1, setSlot1] = useState<string | null>(null);
  const [slot2, setSlot2] = useState<string | null>(null);
  const [slotDemand, setSlotDemand] = useState<Record<string, number>>({});
  const [pairings, setPairings] = useState<[string, string][]>([]);
  const [isLoadingDemand, setIsLoadingDemand] = useState(true);
  const [notes, setNotes] = useState("");
  const [confirmedSlots, setConfirmedSlots] = useState<[string, string] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!assignment) return;
    const saved = assignment.participant.selectedSlotIds;
    setSlot1(saved[0] ?? null);
    setSlot2(saved[1] ?? null);
    setNotes(assignment.participant.schedulingNotes);
    setStep(saved.length >= 1 ? 2 : 1);
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
          const data = await res.json() as { demand: Record<string, number>; pairings: [string, string][] };
          setSlotDemand(data.demand ?? {});
          setPairings(data.pairings ?? []);
        }
      } catch {
        // non-fatal
      } finally {
        if (!cancelled) setIsLoadingDemand(false);
      }
    })();
    return () => { cancelled = true; };
  }, [assignment?.project.id, user.uid]);

  // 8 weekdays (Mon–Fri) from tomorrow
  const allDays = useMemo(() => {
    const result: Array<{ date: string; dayLabel: string; slots: typeof VIDEO_SCHEDULE_SLOTS }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let daysAdded = 0;
    let offset = 1;
    while (daysAdded < 8 && offset <= 30) {
      const d = new Date(today);
      d.setDate(today.getDate() + offset);
      offset++;
      const dow = d.getDay();
      if (dow === 0 || dow === 6) continue;
      const pad = (n: number) => String(n).padStart(2, "0");
      const dateStr = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const slots = VIDEO_SCHEDULE_SLOTS.filter((s) => s.date === dateStr);
      if (slots.length === 0) break;
      result.push({ date: dateStr, dayLabel: slots[0].dayLabel, slots });
      daysAdded++;
    }
    return result;
  }, []);

  // Slots that would create a double-pairing with the same person (blocked in step 2)
  const conflictedSlots = useMemo(() => {
    if (!slot1) return new Set<string>();
    const conflicts = new Set<string>();
    for (const [a, b] of pairings) {
      if (a === slot1) conflicts.add(b);
      if (b === slot1) conflicts.add(a);
    }
    return conflicts;
  }, [slot1, pairings]);

  const displayDays = allDays;

  function handleSlotClick(slotId: string) {
    const demand = slotDemand[slotId] ?? 0;
    if (demand >= 2) return;
    if (step === 1) {
      setSlot1((cur) => (cur === slotId ? null : slotId));
    } else {
      if (slotId === slot1) return;
      if (conflictedSlots.has(slotId)) return;
      setSlot2((cur) => (cur === slotId ? null : slotId));
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
      {/* Header */}
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-muted">Scheduling</p>
            <h1 className="mt-1.5 text-2xl font-semibold text-ink">{assignment.project.title}</h1>
            {description ? <p className="mt-2 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
          </div>
          {/* Step indicator */}
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
        days={displayDays}
        slot1={slot1}
        slot2={slot2}
        step={step}
        slotDemand={slotDemand}
        conflictedSlots={conflictedSlots}
        onSlotClick={handleSlotClick}
        isLoading={isLoadingDemand}
      />

      {/* Sticky bottom bar — step 1 */}
      {step === 1 && slot1 ? (
        <div className="sticky bottom-4 z-10 flex items-center justify-between gap-4 rounded-[1.5rem] border border-primary/20 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-sm">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1 locked in</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink">{getVideoSlot(slot1)?.label ?? slot1}</p>
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
          >
            Choose session 2 →
          </button>
        </div>
      ) : null}

      {/* Notes — visible on step 2 */}
      {step === 2 ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
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

      {/* Step 2 confirm bar */}
      {step === 2 ? (
        <form onSubmit={handleSubmit}>
          <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-4 rounded-[1.5rem] border border-slate-200 bg-white/95 px-6 py-4 shadow-lg backdrop-blur-sm">
            <div className="flex flex-1 flex-wrap items-center gap-4 min-w-0">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-ink">{getVideoSlot(slot1 ?? "")?.label ?? slot1 ?? "—"}</p>
              </div>
              <div className="h-8 w-px bg-slate-200" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 2</p>
                <p className="mt-0.5 truncate text-sm font-semibold text-ink">
                  {slot2 ? (getVideoSlot(slot2)?.label ?? slot2) : <span className="font-normal text-muted">Pick a session above</span>}
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-full border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-slate-300"
              >
                ← Back
              </button>
              <button
                disabled={isSaving || !slot1 || !slot2}
                className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Confirm →"}
              </button>
            </div>
          </div>
        </form>
      ) : null}
    </div>
  );
}

function ParticipantProjectsView({
  user,
  profile,
  assignments,
  isLoading,
}: {
  user: User;
  profile: PortalProfile;
  assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }>;
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
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setScheduleOpen(false)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to project
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
    const { project, participant } = selectedAssignment;
    const localConfirmed = confirmedMap[project.id] ?? null;
    const savedSlots = participant.selectedSlotIds;
    const isConfirmed = !!(localConfirmed ?? (savedSlots.length >= 2 ? savedSlots : null));
    const s1 = localConfirmed?.[0] ?? savedSlots[0] ?? null;
    const s2 = localConfirmed?.[1] ?? savedSlots[1] ?? null;
    const description = project.jobDescription.replace(/<[^>]*>/g, "").trim();

    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={() => setSelectedProjectId(null)}
          className="text-sm font-semibold text-primary hover:underline"
        >
          ← Back to projects
        </button>

        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-ink">{project.title}</h1>
          {description ? <p className="mt-3 max-w-2xl text-sm leading-7 text-muted">{description}</p> : null}
        </section>

        {isConfirmed ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-8">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
                <svg className="h-7 w-7 text-emerald-600" fill="none" viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <h2 className="mt-4 text-xl font-semibold text-ink">Schedule Confirmed</h2>
              <p className="mt-1.5 text-sm text-muted">Your sessions have been submitted successfully.</p>
              {s1 && s2 ? (
                <div className="mt-6 grid w-full max-w-md gap-3 text-left">
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 1</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{getVideoSlot(s1)?.label ?? s1}</p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-5 py-4">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary">Session 2</p>
                    <p className="mt-1 text-sm font-semibold text-ink">{getVideoSlot(s2)?.label ?? s2}</p>
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => setScheduleOpen(true)}
                className="mt-5 rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-muted transition hover:border-slate-300"
              >
                Change sessions
              </button>
            </div>
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
          {assignments.map(({ project, participant }) => {
            const localConfirmed = confirmedMap[project.id];
            const isConfirmed = !!(localConfirmed ?? (participant.selectedSlotIds.length >= 2 ? true : false));
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => openProject(project.id)}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-left transition hover:border-primary/40 hover:shadow-panel"
              >
                <p className="font-semibold text-ink">{project.title}</p>
                <p className="mt-2 text-xs text-muted">
                  {isConfirmed ? "2 sessions selected" : "Availability not submitted yet"}
                </p>
                <span className={[
                  "mt-3 inline-block rounded-full px-3 py-1 text-xs font-semibold",
                  isConfirmed ? "bg-emerald-50 text-emerald-700" : "bg-primary/10 text-primary",
                ].join(" ")}>
                  {isConfirmed ? "Schedule confirmed ✓" : "Open →"}
                </span>
              </button>
            );
          })}
        </section>
      )}
    </div>
  );
}

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
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Full name</span>
              <input name="fullName" value={draft.fullName} onChange={onChange} required placeholder="Your full name" className={fieldClass} />
            </label>
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
  const [isLoadingAssignments, setIsLoadingAssignments] = useState(true);
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

  const loadAssignments = useCallback(async () => {
    if (!activeUser || !profile) {
      setAssignments([]);
      setIsLoadingAssignments(false);
      return;
    }
    setIsLoadingAssignments(true);
    try {
      const idToken = await activeUser.getIdToken();
      const email = encodeURIComponent(activeUser.email ?? "");
      const uid = encodeURIComponent(activeUser.uid);
      const res = await fetch(`/api/video/assignments?uid=${uid}&email=${email}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error("Could not load assignments.");
      const data = await res.json() as { assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }> };
      setAssignments(data.assignments);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load assignments.");
    } finally {
      setIsLoadingAssignments(false);
    }
  }, [activeUser, profile]);

  useEffect(() => {
    void loadAssignments();
  }, [loadAssignments]);

  useEffect(() => {
    if (activeView === "projects") void loadAssignments();
    // Only re-fetch when the tab becomes active, not on every loadAssignments reference change
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
