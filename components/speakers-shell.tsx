"use client";

import {
  FormEvent,
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
  subscribeToDCSessionsBySpeaker,
  subscribeToDCSpeakerByEmail,
  submitDCSession,
  updateDCSpeakerProfile,
  type DCAssignment,
  type DCSession,
  type DCSpeaker,
} from "@/lib/firebase/data-collection";

// ─── Types ────────────────────────────────────────────────────────────────────

type SpeakerSection = "dashboard" | "tasks" | "record" | "profile" | "guidelines";

const VALID_SECTIONS: SpeakerSection[] = ["dashboard", "tasks", "record", "profile", "guidelines"];

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function isProfileComplete(speaker: DCSpeaker) {
  return !!(speaker.name && speaker.gender && speaker.dialect && speaker.region);
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

// ─── Bottom tab bar (mobile only) ─────────────────────────────────────────────

const TABS: { section: SpeakerSection; label: string; icon: string }[] = [
  { section: "dashboard", label: "Home",      icon: "⊞" },
  { section: "tasks",     label: "Tasks",     icon: "☑" },
  { section: "record",    label: "Record",    icon: "⏺" },
  { section: "profile",   label: "Profile",   icon: "◎" },
];

function BottomTabBar({
  active,
  onNavigate,
}: {
  active: SpeakerSection;
  onNavigate: (s: SpeakerSection) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white lg:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {TABS.map((tab) => {
        const isRecord = tab.section === "record";
        const isActive = active === tab.section;
        return (
          <button
            key={tab.section}
            type="button"
            onClick={() => onNavigate(tab.section)}
            className={[
              "flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium transition",
              isRecord
                ? "relative"
                : isActive
                  ? "text-primary"
                  : "text-muted",
            ].join(" ")}
          >
            {isRecord ? (
              <span className={[
                "flex h-10 w-10 items-center justify-center rounded-full text-lg shadow-md transition",
                isActive ? "bg-primary text-white" : "bg-primary/10 text-primary",
              ].join(" ")}>
                {tab.icon}
              </span>
            ) : (
              <span className="text-xl leading-none">{tab.icon}</span>
            )}
            <span className={isRecord ? (isActive ? "text-primary" : "text-muted") : ""}>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

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
  const firstName = speaker.name?.split(" ")[0] || "there";
  const totalHours = sessions.reduce((sum, s) => sum + s.duration / 3600, 0);
  const activeProjects = assignments.filter((a) => a.status === "active").length;
  const pendingTasks = assignments.filter((a) => a.status === "active" && a.hoursCompleted < a.hoursTarget).length;
  const recentSessions = sessions.slice(0, 5);
  const profileComplete = isProfileComplete(speaker);

  return (
    <div className="space-y-5">
      {!profileComplete && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 text-amber-500">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-900">Complete your profile</p>
            <p className="text-sm text-amber-800">Fill in your name, gender, dialect, and region — this data is embedded in every recording.</p>
            <button type="button" onClick={() => onNavigate("profile")} className="mt-2 text-xs font-semibold text-amber-900 underline">Go to profile →</button>
          </div>
        </div>
      )}

      <div>
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Welcome back, {firstName}</h1>
        <p className="mt-0.5 text-sm text-muted">Your recording activity at a glance.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total hours", value: totalHours.toFixed(2) + "h" },
          { label: "Sessions", value: String(sessions.length) },
          { label: "Active projects", value: String(activeProjects) },
          { label: "Pending tasks", value: String(pendingTasks) },
        ].map((card) => (
          <article key={card.label} className="rounded-xl border border-slate-200 bg-white px-4 py-4">
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60">{card.label}</p>
            <p className="mt-1.5 text-2xl font-light text-ink">{card.value}</p>
          </article>
        ))}
      </div>

      {pendingTasks > 0 && (
        <div className="flex items-center justify-between rounded-[1.25rem] bg-gradient-to-r from-primary to-[#4ea3ff] px-5 py-4 text-white">
          <div>
            <p className="text-sm font-semibold">You have {pendingTasks} active task{pendingTasks !== 1 ? "s" : ""}</p>
            <p className="mt-0.5 text-xs text-white/80">Keep recording to hit your target.</p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate("tasks")}
            className="shrink-0 rounded-full bg-white/20 px-4 py-2 text-sm font-semibold text-white hover:bg-white/30"
          >
            Start →
          </button>
        </div>
      )}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-ink">Recent Activity</h2>
        {recentSessions.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
            <p className="text-sm text-muted">No sessions yet. Head to Tasks to start recording.</p>
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
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.qaStatus === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : s.qaStatus === "rejected" ? "border-rose-200 bg-rose-50 text-rose-800" : "border-slate-200 bg-white text-muted"}`}>
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

// ─── My Tasks ─────────────────────────────────────────────────────────────────

function MyTasks({
  assignments,
  onRecord,
}: {
  assignments: DCAssignment[];
  onRecord: (assignment: DCAssignment) => void;
}) {
  if (assignments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">My Tasks</h1>
        <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-2xl">☑</p>
          <p className="mt-3 text-sm font-medium text-ink">No tasks yet</p>
          <p className="mt-1 text-sm text-muted">You haven't been assigned to any projects. Check back soon.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">My Tasks</h1>
      <div className="space-y-3 sm:grid sm:grid-cols-2 sm:gap-4 sm:space-y-0">
        {assignments.map((a) => {
          const progress = Math.min(100, (a.hoursCompleted / (a.hoursTarget || 1)) * 100);
          const remaining = Math.max(0, a.hoursTarget - a.hoursCompleted);
          const done = remaining <= 0;

          return (
            <article key={a.id} className="flex flex-col rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex-1">
                {a.projectDialect && (
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-primary">{a.projectDialect}</p>
                )}
                <h3 className="mt-1 text-base font-semibold text-ink">{a.projectName}</h3>
                <p className="mt-1 text-xs leading-5 text-muted line-clamp-2">{a.projectDescription}</p>

                <div className="mt-4">
                  <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
                    <span>{a.hoursCompleted.toFixed(2)}h recorded</span>
                    <span>{a.hoursTarget}h target</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted">
                  <span>{a.sessionsCount} session{a.sessionsCount !== 1 ? "s" : ""}</span>
                  {a.deadline && <span>Deadline: {a.deadline}</span>}
                  {!done && <span className="text-primary font-medium">{remaining.toFixed(2)}h remaining</span>}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onRecord(a)}
                disabled={a.status !== "active" || done}
                className={[
                  "mt-5 w-full rounded-full py-3 text-sm font-semibold transition",
                  done
                    ? "bg-slate-100 text-muted cursor-not-allowed"
                    : "bg-primary text-white hover:bg-primaryStrong active:scale-[0.98]",
                ].join(" ")}
              >
                {done ? "Target reached ✓" : "Start Recording ⏺"}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ─── Recorder ─────────────────────────────────────────────────────────────────

type RecordState = "idle" | "recording" | "stopped" | "submitting" | "done";

function Recorder({
  speaker,
  assignment,
  onDone,
  onPickTask,
}: {
  speaker: DCSpeaker;
  assignment: DCAssignment | null;
  onDone: () => void;
  onPickTask: () => void;
}) {
  const [state, setState] = useState<RecordState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [levelBars, setLevelBars] = useState<number[]>(Array(24).fill(0));

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const profileComplete = isProfileComplete(speaker);

  function stopVisualizer() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    setLevelBars(Array(24).fill(0));
  }

  function startVisualizer(stream: MediaStream) {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    source.connect(analyser);
    analyserRef.current = analyser;
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
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setState("stopped");
        stopVisualizer();
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start(100);
      setState("recording");
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setError("BLOCKED");
      } else if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        setError("No microphone found. Please connect a microphone and try again.");
      } else {
        setError("Could not access microphone. Please try again.");
      }
    }
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    mediaRecorderRef.current?.stop();
    stopVisualizer();
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }

  function reRecord() {
    setAudioBlob(null);
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setElapsed(0);
    setState("idle");
  }

  async function handleSubmit() {
    if (!audioBlob || !assignment) return;
    setState("submitting");
    setError("");
    try {
      await submitDCSession({
        projectId: assignment.projectId,
        projectName: assignment.projectName,
        speakerId: speaker.email,
        speakerName: speaker.name,
        assignmentId: assignment.id,
        audioBlob,
        duration: elapsed,
        sampleRate: 44100,
        bitDepth: 16,
        gender: speaker.gender,
        age: speaker.age,
        dialect: speaker.dialect,
        region: speaker.region,
      });
      setState("done");
    } catch {
      setState("stopped");
      setError("Could not submit recording. Please try again.");
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      stopVisualizer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  if (!assignment) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Record</h1>
        <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-white px-6 py-14 text-center">
          <p className="text-3xl">⏺</p>
          <p className="mt-3 text-sm font-medium text-ink">No task selected</p>
          <p className="mt-1 text-sm text-muted">Pick a task first to start recording.</p>
          <button
            type="button"
            onClick={onPickTask}
            className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
          >
            Go to Tasks
          </button>
        </div>
      </div>
    );
  }

  if (state === "done") {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Record</h1>
        <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-8 text-center">
          <p className="text-4xl">✓</p>
          <h2 className="mt-3 text-lg font-semibold text-emerald-900">Recording submitted</h2>
          <p className="mt-1 text-sm text-emerald-800">Your recording for <strong>{assignment.projectName}</strong> has been saved.</p>
          <button type="button" onClick={onDone} className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong">
            Back to tasks
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold text-ink sm:text-2xl">Record</h1>
        <span className="rounded-full border border-slate-200 bg-panelStrong px-3 py-0.5 text-xs text-muted">{assignment.projectName}</span>
      </div>

      {!profileComplete && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Your profile is incomplete. Metadata fields will be empty for this session.
        </div>
      )}

      {assignment.promptText && (
        <div className="rounded-[1.25rem] border border-blue-100 bg-blue-50 p-4">
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-widest text-primary">Prompt</p>
          <p className="text-sm leading-7 text-ink">{assignment.promptText}</p>
        </div>
      )}

      {error && (
        error === "BLOCKED" ? (
          <div className="rounded-[1.25rem] border border-rose-200 bg-rose-50 p-4">
            <p className="font-semibold text-rose-900">Microphone access blocked</p>
            <p className="mt-1 text-sm text-rose-800">To fix this:</p>
            <ol className="mt-2 list-decimal list-inside space-y-1 text-sm text-rose-800">
              <li>Tap the <strong>lock icon</strong> in your browser's address bar</li>
              <li>Set <strong>Microphone</strong> to <strong>Allow</strong></li>
              <li>Refresh and try again</li>
            </ol>
          </div>
        ) : (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        )
      )}

      {/* Recorder card */}
      <div className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-slate-200 bg-white py-10 px-4">
        {/* Timer */}
        <p className="font-mono text-5xl font-light tracking-tight text-ink sm:text-6xl">
          {formatDuration(elapsed)}
        </p>

        {/* Waveform */}
        <div className="flex h-10 items-end gap-[2px]" aria-hidden="true">
          {levelBars.map((h, i) => (
            <div
              key={i}
              className={[
                "w-[3px] rounded-full transition-all duration-75",
                state === "recording" ? "bg-primary" : "bg-slate-200",
              ].join(" ")}
              style={{ height: `${Math.max(4, h)}%` }}
            />
          ))}
        </div>

        {/* Record / Stop */}
        {state === "idle" && (
          <button
            type="button"
            onClick={() => void startRecording()}
            className="flex h-20 w-20 items-center justify-center rounded-full bg-primary text-white shadow-[0_4px_24px_rgba(43,133,240,0.4)] active:scale-95 hover:bg-primaryStrong"
          >
            <span className="text-2xl">⏺</span>
          </button>
        )}
        {state === "recording" && (
          <>
            <button
              type="button"
              onClick={stopRecording}
              className="flex h-20 w-20 items-center justify-center rounded-full bg-rose-600 text-white shadow-[0_4px_24px_rgba(220,38,38,0.4)] active:scale-95 hover:bg-rose-700"
            >
              <span className="text-2xl">⏹</span>
            </button>
            <p className="animate-pulse text-xs text-muted">Recording… speak naturally</p>
          </>
        )}
      </div>

      {/* Playback */}
      {state === "stopped" && audioUrl && (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 space-y-4">
          <p className="text-sm font-semibold text-ink">Playback</p>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <audio controls src={audioUrl} className="w-full rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <button type="button" onClick={reRecord} className="rounded-full border border-slate-200 py-3 text-sm font-semibold text-muted hover:bg-slate-50 active:scale-[0.98]">
              Re-record
            </button>
            <button type="button" onClick={() => void handleSubmit()} className="rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primaryStrong active:scale-[0.98]">
              Submit ✓
            </button>
          </div>
        </div>
      )}

      {state === "submitting" && (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-6">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          <p className="text-sm text-muted">Uploading your recording…</p>
        </div>
      )}
    </div>
  );
}

// ─── Profile ──────────────────────────────────────────────────────────────────

const fieldCls = "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-primary focus:ring-1 focus:ring-primary/20";

function Profile({ speaker, onSaved }: { speaker: DCSpeaker; onSaved: (s: DCSpeaker) => void }) {
  const [form, setForm] = useState({
    name: speaker.name,
    age: speaker.age,
    gender: speaker.gender,
    dialect: speaker.dialect,
    secondaryDialect: speaker.secondaryDialect,
    region: speaker.region,
    country: speaker.country,
    phone: speaker.phone,
    bio: speaker.bio,
  });
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setSuccess(false);
    try {
      await updateDCSpeakerProfile(speaker.email, form);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold text-ink sm:text-2xl">Profile</h1>

      <div className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-sm">
        <p className="text-muted"><span className="font-medium text-ink">Account email:</span> {speaker.email}</p>
      </div>

      {!isProfileComplete(speaker) && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          ⚠ Please fill in your name, gender, dialect, and region. This data is embedded in every recording.
        </div>
      )}
      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">Profile saved ✓</div>}

      <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Full name <span className="text-primary">*</span></span>
            <input className={fieldCls} value={form.name} onChange={(e) => set("name", e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Age</span>
            <input type="number" min={16} max={80} className={fieldCls} value={form.age} onChange={(e) => set("age", e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Gender <span className="text-primary">*</span></span>
          <select className={fieldCls} value={form.gender} onChange={(e) => set("gender", e.target.value)} required>
            <option value="">Select…</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="prefer-not-to-say">Prefer not to say</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Primary dialect <span className="text-primary">*</span></span>
            <input className={fieldCls} placeholder="e.g. Pakistani Urdu, Gulf Arabic" value={form.dialect} onChange={(e) => set("dialect", e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Secondary dialect</span>
            <input className={fieldCls} placeholder="Optional" value={form.secondaryDialect} onChange={(e) => set("secondaryDialect", e.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Region / City <span className="text-primary">*</span></span>
            <input className={fieldCls} value={form.region} onChange={(e) => set("region", e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[13px] font-medium text-ink">Country</span>
            <input className={fieldCls} value={form.country} onChange={(e) => set("country", e.target.value)} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Phone</span>
          <input type="tel" className={fieldCls} value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-[13px] font-medium text-ink">Short bio</span>
          <textarea rows={3} className={fieldCls} placeholder="A brief description about yourself…" value={form.bio} onChange={(e) => set("bio", e.target.value)} />
        </label>

        <button type="submit" disabled={saving} className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-60 active:scale-[0.98]">
          {saving ? "Saving…" : "Save Profile"}
        </button>
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
  const [recordingAssignment, setRecordingAssignment] = useState<DCAssignment | null>(null);

  function navigateTo(s: SpeakerSection) {
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

  async function handleSignOut() {
    const { auth } = getFirebaseClientServices();
    await signOut(auth);
  }

  function handleStartRecording(assignment: DCAssignment) {
    setRecordingAssignment(assignment);
    navigateTo("record");
  }

  function handleRecordingDone() {
    setRecordingAssignment(null);
    navigateTo("tasks");
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

  const speakerMenuItems: PlatformSideMenuItem[] = [
    { label: "Main",        isSectionHeader: true },
    { label: "Dashboard",   href: "/speakers?section=dashboard",  active: section === "dashboard" },
    { label: "My Tasks",    href: "/speakers?section=tasks",      active: section === "tasks" },
    { label: "Record",      href: "/speakers?section=record",     active: section === "record" },
    { label: "Account",     isSectionHeader: true },
    { label: "Profile",     href: "/speakers?section=profile",    active: section === "profile" },
    { label: "Guidelines",  href: "/speakers?section=guidelines", active: section === "guidelines" },
  ];

  const userProfile = {
    name: speaker.name || user.displayName || user.email?.split("@")[0] || "Speaker",
    href: "/speakers?section=profile",
    imageUrl: user.photoURL,
  };

  return (
    <DeaimerSiteShell
      platformSideMenuItems={speakerMenuItems}
      userProfile={userProfile}
      onSignOut={() => void handleSignOut()}
    >
      {/* Mobile bottom tab bar */}
      <BottomTabBar active={section} onNavigate={navigateTo} />

      {/* Content — extra bottom padding on mobile for the tab bar */}
      <div className="mx-auto max-w-2xl px-4 pb-28 pt-6 sm:px-6 lg:max-w-3xl lg:pb-10 lg:pt-8">
        {section === "dashboard" && (
          <Dashboard speaker={speaker} assignments={assignments} sessions={sessions} onNavigate={navigateTo} />
        )}
        {section === "tasks" && (
          <MyTasks assignments={assignments} onRecord={handleStartRecording} />
        )}
        {section === "record" && (
          <Recorder speaker={speaker} assignment={recordingAssignment} onDone={handleRecordingDone} onPickTask={() => navigateTo("tasks")} />
        )}
        {section === "profile" && (
          <Profile speaker={speaker} onSaved={setSpeaker} />
        )}
        {section === "guidelines" && <Guidelines />}
      </div>
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

  // ── Sign-in page ──
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
