"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
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
import { isSuperAdminEmail } from "@/lib/auth/access-control";
import {
  subscribeToDCProjects,
  subscribeToDCSessions,
  subscribeToDCSessionsByProjects,
  subscribeToDCSpeakers,
  updateDCSessionQA,
  updateDCSessionTranscription,
  type DCProject,
  type DCQAStatus,
  type DCSession,
  type DCSpeaker,
} from "@/lib/firebase/data-collection";
import {
  saveOpsWorker,
  subscribeToOpsWorkerByEmail,
  subscribeToOpsWorkers,
  updateOpsWorkerStatus,
  type OpsRole,
  type OpsWorker,
} from "@/lib/firebase/ops-data";
import {
  downloadBlob,
  generateDeliveryCSV,
  generateITNJSON,
  generateMetadataCSV,
  generateMetadataJSON,
  generateQAReportCSV,
  generateTranscriptionJSON,
} from "@/lib/ops-exports";

// ─── Types ────────────────────────────────────────────────────────────────────

export type OpsSection = "dashboard" | "transcription" | "qa" | "workers" | "exports";

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary/20";
const selectCls = inputCls + " cursor-pointer";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50 transition";
const btnSecondary =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-panelStrong disabled:opacity-50 transition";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "border-slate-200 bg-white text-muted",
    "human-review": "border-amber-200 bg-amber-50 text-amber-800",
    "asr-processing": "border-blue-200 bg-blue-50 text-blue-800",
    "asr-done": "border-purple-200 bg-purple-50 text-purple-800",
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    "in-review": "border-amber-200 bg-amber-50 text-amber-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    paused: "border-amber-200 bg-amber-50 text-amber-800",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-medium capitalize ${map[status] ?? "border-slate-200 bg-white text-muted"}`}>
      {status.replace(/-/g, " ")}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

function SlidePanel({
  title,
  open,
  onClose,
  children,
}: {
  title: string;
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100">✕</button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {hint && <span className="mb-1.5 block text-[11px] text-muted">{hint}</span>}
      {children}
    </label>
  );
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatDate(val: unknown): string {
  if (!val) return "—";
  try {
    const ts = (val as { toDate?: () => Date }).toDate?.();
    return (ts ?? new Date(val as string)).toLocaleDateString();
  } catch { return "—"; }
}

// ─── Transcription Workspace ──────────────────────────────────────────────────

function TranscriptionWorkspace({
  session,
  workerEmail,
  onBack,
}: {
  session: DCSession;
  workerEmail: string;
  onBack: () => void;
}) {
  const [text, setText] = useState(session.transcriptText ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  async function save(markComplete: boolean) {
    setSaving(true);
    setError("");
    try {
      const status = markComplete ? "completed" : "human-review";
      await updateDCSessionTranscription(session.id, status, text.trim());
      setSaved(true);
      if (markComplete) setTimeout(onBack, 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-primary">← Queue</button>
        <StatusBadge status={session.transcriptionStatus} />
        {saved && <span className="text-xs text-emerald-600">Saved ✓</span>}
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span><strong className="text-ink">{session.projectName}</strong></span>
          <span>Speaker: {session.speakerName || session.speakerId}</span>
          <span>Duration: {formatDuration(session.duration)}</span>
          <span>{session.sampleRate / 1000}kHz · {session.bitDepth}-bit</span>
        </div>
        {session.promptText && (
          <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Prompt</p>
            <p className="mt-1 text-sm text-ink">{session.promptText}</p>
          </div>
        )}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={session.audioUrl} className="w-full rounded-xl" />
      </div>

      <div className="space-y-2">
        <label className="block text-[13px] font-medium text-ink">Verbatim Transcription</label>
        <textarea
          rows={6}
          className={inputCls + " resize-y font-mono text-[13px]"}
          placeholder="Type exactly what you hear, word for word…"
          value={text}
          onChange={(e) => { setText(e.target.value); setSaved(false); }}
        />
        <p className="text-[11px] text-muted">{text.trim().split(/\s+/).filter(Boolean).length} words</p>
      </div>

      {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          disabled={saving || !text.trim()}
          onClick={() => void save(false)}
          className={btnSecondary}
        >
          {saving ? "Saving…" : "Save Draft"}
        </button>
        <button
          type="button"
          disabled={saving || !text.trim()}
          onClick={() => void save(true)}
          className={btnPrimary}
        >
          {saving ? "Saving…" : "Mark Complete ✓"}
        </button>
      </div>
    </div>
  );
}

// ─── Transcription Section ────────────────────────────────────────────────────

type TranscriptionFilter = "all" | "pending" | "in-progress" | "completed";

function TranscriptionSection({
  sessions,
  workerEmail,
}: {
  sessions: DCSession[];
  workerEmail: string;
}) {
  const [filter, setFilter] = useState<TranscriptionFilter>("pending");
  const [selected, setSelected] = useState<DCSession | null>(null);
  const [search, setSearch] = useState("");

  if (selected) {
    return (
      <TranscriptionWorkspace
        session={selected}
        workerEmail={workerEmail}
        onBack={() => setSelected(null)}
      />
    );
  }

  const withAudio = sessions.filter((s) => Boolean(s.audioUrl));
  const filtered = withAudio.filter((s) => {
    const matchFilter =
      filter === "all" ||
      (filter === "pending" && s.transcriptionStatus === "pending") ||
      (filter === "in-progress" && s.transcriptionStatus === "human-review") ||
      (filter === "completed" && s.transcriptionStatus === "completed");
    const q = search.toLowerCase();
    const matchSearch = !q || s.speakerName.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q) || (s.promptText ?? "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    pending: withAudio.filter((s) => s.transcriptionStatus === "pending").length,
    "in-progress": withAudio.filter((s) => s.transcriptionStatus === "human-review").length,
    completed: withAudio.filter((s) => s.transcriptionStatus === "completed").length,
  };

  const FILTERS: { key: TranscriptionFilter; label: string }[] = [
    { key: "all", label: `All (${withAudio.length})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "in-progress", label: `In Progress (${counts["in-progress"]})` },
    { key: "completed", label: `Completed (${counts.completed})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">Transcription Queue</h2>
          <p className="mt-0.5 text-sm text-muted">Listen to audio and type verbatim transcriptions.</p>
        </div>
        <input
          className="w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${filter === f.key ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-muted hover:text-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={filter === "pending" ? "No sessions pending transcription." : "No sessions match this filter."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Speaker", "Prompt", "Duration", "Rate", "Status", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-panelStrong/40">
                  <td className="px-4 py-3 text-ink font-medium">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{s.speakerName || s.speakerId}</td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted">{s.promptText ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3 text-muted">{s.sampleRate / 1000}k</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                    >
                      {s.transcriptionStatus === "completed" ? "Review" : "Transcribe →"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── QA Workspace ─────────────────────────────────────────────────────────────

function QAWorkspace({
  session,
  workerEmail,
  onBack,
}: {
  session: DCSession;
  workerEmail: string;
  onBack: () => void;
}) {
  const [score, setScore] = useState<number>(session.qaScore ?? 0);
  const [note, setNote] = useState(session.qaNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(status: DCQAStatus) {
    if (status === "approved" && !score) {
      setError("Set a score before approving.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await updateDCSessionQA(session.id, status, workerEmail, score || undefined, note.trim() || undefined);
      setTimeout(onBack, 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      setSaving(false);
    }
  }

  async function markInReview() {
    if (session.qaStatus !== "pending") return;
    await updateDCSessionQA(session.id, "in-review", workerEmail);
  }

  useEffect(() => {
    void markInReview();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isDecided = session.qaStatus === "approved" || session.qaStatus === "rejected";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="text-sm font-medium text-muted hover:text-primary">← Queue</button>
        <StatusBadge status={session.qaStatus} />
      </div>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span><strong className="text-ink">{session.projectName}</strong></span>
          <span>Speaker: {session.speakerName || session.speakerId}</span>
          <span>Duration: {formatDuration(session.duration)}</span>
          <span>{session.sampleRate / 1000}kHz · {session.bitDepth}-bit</span>
        </div>
        {session.promptText && (
          <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Prompt</p>
            <p className="mt-1 text-sm text-ink">{session.promptText}</p>
          </div>
        )}
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio controls src={session.audioUrl} className="w-full rounded-xl" />
      </div>

      {session.transcriptText ? (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4 space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Verbatim Transcript</p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-wrap">{session.transcriptText}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          No transcript available — transcription may not be complete.
        </div>
      )}

      {!isDecided && (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Quality Score (1–5)</p>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setScore(n)}
                  className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${score === n ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-muted hover:border-primary/40 hover:text-ink"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
          <Field label="Notes" hint="Reason for rejection or quality observations.">
            <textarea
              rows={3}
              className={inputCls + " resize-none"}
              placeholder="Optional notes…"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
          {error && <p className="text-sm text-rose-600">{error}</p>}
          <div className="flex gap-3">
            <button type="button" disabled={saving} onClick={() => void submit("approved")} className={btnPrimary}>
              {saving ? "Saving…" : "Approve ✓"}
            </button>
            <button type="button" disabled={saving} onClick={() => void submit("rejected")} className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-5 py-2.5 text-sm font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-50 transition">
              {saving ? "Saving…" : "Reject ✗"}
            </button>
          </div>
        </div>
      )}

      {isDecided && (
        <div className={`rounded-xl border px-4 py-3 text-sm font-medium ${session.qaStatus === "approved" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800"}`}>
          This session has been {session.qaStatus}. Score: {session.qaScore ?? "—"}
          {session.qaNote ? ` · ${session.qaNote}` : ""}
        </div>
      )}
    </div>
  );
}

// ─── QA Section ───────────────────────────────────────────────────────────────

type QAFilter = "all" | "pending" | "in-review" | "approved" | "rejected";

function QASection({
  sessions,
  workerEmail,
}: {
  sessions: DCSession[];
  workerEmail: string;
}) {
  const [filter, setFilter] = useState<QAFilter>("pending");
  const [selected, setSelected] = useState<DCSession | null>(null);
  const [search, setSearch] = useState("");

  if (selected) {
    return <QAWorkspace session={selected} workerEmail={workerEmail} onBack={() => setSelected(null)} />;
  }

  const qaable = sessions.filter((s) => Boolean(s.audioUrl) && s.transcriptionStatus === "completed");
  const allWithAudio = sessions.filter((s) => Boolean(s.audioUrl));

  const filtered = allWithAudio.filter((s) => {
    const matchFilter =
      filter === "all" ||
      (filter === "pending" && s.qaStatus === "pending") ||
      (filter === "in-review" && s.qaStatus === "in-review") ||
      (filter === "approved" && s.qaStatus === "approved") ||
      (filter === "rejected" && s.qaStatus === "rejected");
    const q = search.toLowerCase();
    const matchSearch = !q || s.speakerName.toLowerCase().includes(q) || s.projectName.toLowerCase().includes(q) || (s.promptText ?? "").toLowerCase().includes(q);
    return matchFilter && matchSearch;
  });

  const counts = {
    pending: allWithAudio.filter((s) => s.qaStatus === "pending").length,
    "in-review": allWithAudio.filter((s) => s.qaStatus === "in-review").length,
    approved: allWithAudio.filter((s) => s.qaStatus === "approved").length,
    rejected: allWithAudio.filter((s) => s.qaStatus === "rejected").length,
  };

  const FILTERS: { key: QAFilter; label: string }[] = [
    { key: "all", label: `All (${allWithAudio.length})` },
    { key: "pending", label: `Pending (${counts.pending})` },
    { key: "in-review", label: `In Review (${counts["in-review"]})` },
    { key: "approved", label: `Approved (${counts.approved})` },
    { key: "rejected", label: `Rejected (${counts.rejected})` },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-ink">QA Queue</h2>
          <p className="mt-0.5 text-sm text-muted">
            Review transcribed sessions — approve or reject with a score.
            {qaable.length > 0 && <span className="ml-2 font-medium text-primary">{qaable.length} ready to review</span>}
          </p>
        </div>
        <input
          className="w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="flex gap-2 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${filter === f.key ? "border-primary bg-primary text-white" : "border-slate-200 bg-white text-muted hover:text-ink"}`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={filter === "pending" ? "No sessions pending QA." : "No sessions match this filter."} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Speaker", "Prompt", "Duration", "Transcript", "QA Status", "Score", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="hover:bg-panelStrong/40">
                  <td className="px-4 py-3 font-medium text-ink">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{s.speakerName || s.speakerId}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted">{s.promptText ?? "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="max-w-[160px] truncate px-4 py-3 text-muted text-xs">{s.transcriptText || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                  <td className="px-4 py-3 text-muted">{s.qaScore != null ? `${s.qaScore}/5` : "—"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      disabled={s.transcriptionStatus !== "completed"}
                      className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:opacity-40"
                      title={s.transcriptionStatus !== "completed" ? "Transcription not complete" : ""}
                    >
                      Review →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Dashboard Section ────────────────────────────────────────────────────────

function DashboardSection({
  sessions,
  worker,
  isSuperAdmin,
  onNavigate,
}: {
  sessions: DCSession[];
  worker: OpsWorker | null;
  isSuperAdmin: boolean;
  onNavigate: (s: OpsSection) => void;
}) {
  const withAudio = sessions.filter((s) => Boolean(s.audioUrl));
  const pendingTranscription = withAudio.filter((s) => s.transcriptionStatus === "pending").length;
  const inProgressTranscription = withAudio.filter((s) => s.transcriptionStatus === "human-review").length;
  const completedTranscription = withAudio.filter((s) => s.transcriptionStatus === "completed").length;
  const pendingQA = withAudio.filter((s) => s.transcriptionStatus === "completed" && s.qaStatus === "pending").length;
  const approvedQA = withAudio.filter((s) => s.qaStatus === "approved").length;
  const rejectedQA = withAudio.filter((s) => s.qaStatus === "rejected").length;

  const canTranscribe = isSuperAdmin || (worker?.roles ?? []).includes("transcription");
  const canQA = isSuperAdmin || (worker?.roles ?? []).includes("qa");

  const stats = [
    { label: "Pending Transcription", value: String(pendingTranscription), sub: `${inProgressTranscription} in progress`, show: canTranscribe, section: "transcription" as OpsSection },
    { label: "Transcribed", value: String(completedTranscription), sub: "All done", show: canTranscribe, section: "transcription" as OpsSection },
    { label: "Pending QA", value: String(pendingQA), sub: "Ready to review", show: canQA, section: "qa" as OpsSection },
    { label: "Approved", value: String(approvedQA), sub: `${rejectedQA} rejected`, show: canQA, section: "qa" as OpsSection },
  ].filter((s) => s.show);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Dashboard</h2>
        <p className="mt-1 text-sm text-muted">
          {isSuperAdmin ? "Ops overview — all projects." : `Welcome back${worker?.name ? `, ${worker.name}` : ""}. Your queue across assigned projects.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onNavigate(s.section)}
            className="rounded-xl border border-slate-200 bg-white px-5 py-5 text-left hover:border-primary/30 hover:shadow-sm transition"
          >
            <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60">{s.label}</p>
            <p className="mt-1.5 text-3xl font-light tabular-nums text-ink">{s.value}</p>
            {s.sub && <p className="mt-1 text-[11px] text-muted">{s.sub}</p>}
          </button>
        ))}
      </div>

      {worker && !isSuperAdmin && (
        <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted">Your Access</p>
          <div className="flex flex-wrap gap-2">
            {worker.roles.map((r) => (
              <span key={r} className="rounded-full border border-primary/20 bg-primary/5 px-3 py-0.5 text-xs font-semibold capitalize text-primary">{r}</span>
            ))}
          </div>
          <p className="text-xs text-muted">{worker.assignedProjectIds.length} project{worker.assignedProjectIds.length !== 1 ? "s" : ""} assigned</p>
        </div>
      )}
    </div>
  );
}

// ─── Workers Section (super admin) ───────────────────────────────────────────

function WorkersSection({
  activeUser,
  projects,
}: {
  activeUser: User;
  projects: DCProject[];
}) {
  const [workers, setWorkers] = useState<OpsWorker[]>([]);
  const [showPanel, setShowPanel] = useState(false);
  const [editTarget, setEditTarget] = useState<OpsWorker | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roles, setRoles] = useState<OpsRole[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    return subscribeToOpsWorkers(setWorkers);
  }, []);

  function openNew() {
    setEditTarget(null);
    setEmail(""); setName(""); setRoles([]); setProjectIds([]);
    setFormError("");
    setShowPanel(true);
  }

  function openEdit(w: OpsWorker) {
    setEditTarget(w);
    setEmail(w.email); setName(w.name); setRoles(w.roles); setProjectIds(w.assignedProjectIds);
    setFormError("");
    setShowPanel(true);
  }

  function toggleRole(r: OpsRole) {
    setRoles((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]);
  }

  function toggleProject(id: string) {
    setProjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setFormError("Email is required."); return; }
    if (roles.length === 0) { setFormError("Select at least one role."); return; }
    setSaving(true);
    setFormError("");
    try {
      await saveOpsWorker(email, name, roles, projectIds, activeUser.email ?? "", activeUser.uid);
      setShowPanel(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to save worker.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleStatus(w: OpsWorker) {
    await updateOpsWorkerStatus(w.email, w.status === "active" ? "paused" : "active");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">Ops Workers</h2>
          <p className="mt-1 text-sm text-muted">Assign people to transcription, QA, or delivery roles.</p>
        </div>
        <button type="button" onClick={openNew} className={btnPrimary}>+ Add Worker</button>
      </div>

      {workers.length === 0 ? (
        <EmptyState message="No ops workers yet. Add one to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Name", "Email", "Roles", "Projects", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {workers.map((w) => (
                <tr key={w.email} className="group hover:bg-panelStrong/40">
                  <td className="px-4 py-3 font-medium text-ink">{w.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{w.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {w.roles.map((r) => (
                        <span key={r} className="rounded-full border border-primary/20 bg-primary/5 px-2 py-0.5 text-[10px] font-semibold capitalize text-primary">{r}</span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{w.assignedProjectIds.length}</td>
                  <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      <button type="button" onClick={() => openEdit(w)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10">Edit</button>
                      <button type="button" onClick={() => void toggleStatus(w)} className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:bg-slate-100">
                        {w.status === "active" ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title={editTarget ? "Edit Worker" : "Add Ops Worker"} open={showPanel} onClose={() => setShowPanel(false)}>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{formError}</div>}
          <Field label="Email address" required>
            <input
              type="email"
              className={inputCls}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={!!editTarget}
              required
            />
          </Field>
          <Field label="Full name">
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Worker's name"
            />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Roles <span className="text-primary">*</span></p>
            <div className="flex flex-wrap gap-3">
              {(["transcription", "qa", "delivery"] as OpsRole[]).map((r) => (
                <label key={r} className="flex cursor-pointer items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded accent-primary"
                    checked={roles.includes(r)}
                    onChange={() => toggleRole(r)}
                  />
                  <span className="capitalize">{r}</span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Assigned Projects</p>
            <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 bg-panelStrong p-3">
              {projects.length === 0 && <p className="text-xs text-muted">No projects yet.</p>}
              {projects.map((p) => (
                <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white text-sm">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded accent-primary"
                    checked={projectIds.includes(p.id)}
                    onChange={() => toggleProject(p.id)}
                  />
                  <span className="text-ink">{p.name}</span>
                  <span className="ml-auto text-[11px] text-muted">{p.client}</span>
                </label>
              ))}
            </div>
          </div>
          <button type="submit" disabled={saving} className={btnPrimary + " w-full"}>
            {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Worker"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// ─── Exports Section (super admin) ───────────────────────────────────────────

function ExportsSection({
  sessions,
  projects,
  speakers,
}: {
  sessions: DCSession[];
  projects: DCProject[];
  speakers: DCSpeaker[];
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  const speakerMap = new Map(speakers.map((s) => [s.email, s]));

  const filtered = selectedProjectId === "all"
    ? sessions.filter((s) => Boolean(s.audioUrl))
    : sessions.filter((s) => s.projectId === selectedProjectId && Boolean(s.audioUrl));

  const counts = {
    total: filtered.length,
    transcribed: filtered.filter((s) => s.transcriptText).length,
    completed: filtered.filter((s) => s.transcriptionStatus === "completed").length,
    approved: filtered.filter((s) => s.qaStatus === "approved").length,
    rejected: filtered.filter((s) => s.qaStatus === "rejected").length,
  };

  const projectName = selectedProjectId === "all"
    ? "all-projects"
    : (projects.find((p) => p.id === selectedProjectId)?.name ?? selectedProjectId).replace(/\s+/g, "-").toLowerCase();

  type ExportFormat = {
    label: string;
    description: string;
    ext: string;
    mime: string;
    generate: () => string;
    count?: number;
  };

  const exports: ExportFormat[] = [
    {
      label: "Metadata CSV",
      description: "Speaker + session fields for all recordings. Use for internal tracking.",
      ext: "csv",
      mime: "text/csv",
      generate: () => generateMetadataCSV(filtered, speakerMap),
      count: counts.total,
    },
    {
      label: "Metadata JSON",
      description: "Same as CSV but structured JSON with nested speaker object.",
      ext: "json",
      mime: "application/json",
      generate: () => generateMetadataJSON(filtered, speakerMap),
      count: counts.total,
    },
    {
      label: "Transcription JSON",
      description: "Verbatim transcripts for all completed sessions. Delivery-ready.",
      ext: "json",
      mime: "application/json",
      generate: () => generateTranscriptionJSON(filtered, speakerMap),
      count: counts.completed,
    },
    {
      label: "ITN Annotation JSON",
      description: "Same as Transcription JSON with an itn_text field (post-process ITN externally).",
      ext: "json",
      mime: "application/json",
      generate: () => generateITNJSON(filtered, speakerMap),
      count: counts.transcribed,
    },
    {
      label: "Delivery Tracking CSV",
      description: "All sessions with status columns. For project managers and clients.",
      ext: "csv",
      mime: "text/csv",
      generate: () => generateDeliveryCSV(filtered),
      count: counts.total,
    },
    {
      label: "QA Report CSV",
      description: "Per-session QA scores, notes, and reviewer. For quality analysis.",
      ext: "csv",
      mime: "text/csv",
      generate: () => generateQAReportCSV(filtered, speakerMap),
      count: counts.total,
    },
  ];

  function handleExport(fmt: ExportFormat) {
    const content = fmt.generate();
    const label = fmt.label.toLowerCase().replace(/\s+/g, "-");
    downloadBlob(`${projectName}_${label}.${fmt.ext}`, content, fmt.mime);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-ink">Exports</h2>
        <p className="mt-1 text-sm text-muted">Generate and download data packages for delivery or analysis.</p>
      </div>

      <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-[13px] font-medium text-ink">Project scope</p>
        <select className={selectCls} value={selectedProjectId} onChange={(e) => setSelectedProjectId(e.target.value)}>
          <option value="all">All projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name} — {p.client}</option>
          ))}
        </select>
        <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted">
          <span><strong className="text-ink">{counts.total}</strong> sessions</span>
          <span><strong className="text-ink">{counts.transcribed}</strong> transcribed</span>
          <span><strong className="text-ink">{counts.completed}</strong> transcription complete</span>
          <span><strong className="text-ink">{counts.approved}</strong> QA approved</span>
          <span><strong className="text-ink">{counts.rejected}</strong> rejected</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {exports.map((fmt) => (
          <div key={fmt.label} className="flex flex-col justify-between rounded-[1.25rem] border border-slate-200 bg-white p-5 space-y-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="rounded border border-slate-200 bg-panelStrong px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted">.{fmt.ext}</span>
                <p className="text-sm font-semibold text-ink">{fmt.label}</p>
              </div>
              <p className="mt-1.5 text-xs text-muted leading-5">{fmt.description}</p>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted">{fmt.count ?? 0} records</span>
              <button
                type="button"
                disabled={(fmt.count ?? 0) === 0}
                onClick={() => handleExport(fmt)}
                className={btnSecondary + " py-1.5 px-4 text-xs"}
              >
                Download ↓
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Ops Portal ───────────────────────────────────────────────────────────────

function OpsPortal({
  user,
  worker,
  isSuperAdmin,
  initialSection,
  initialProjectId,
}: {
  user: User;
  worker: OpsWorker | null;
  isSuperAdmin: boolean;
  initialSection: OpsSection;
  initialProjectId: string | null;
}) {
  const router = useRouter();
  const [section, setSection] = useState<OpsSection>(initialSection);
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [projects, setProjects] = useState<DCProject[]>([]);
  const [speakers, setSpeakers] = useState<DCSpeaker[]>([]);

  useEffect(() => {
    const u2 = subscribeToDCProjects(setProjects);
    const u3 = subscribeToDCSpeakers(setSpeakers);
    return () => { u2(); u3(); };
  }, []);

  useEffect(() => {
    if (isSuperAdmin) {
      return subscribeToDCSessions(setSessions);
    }
    if (!worker || worker.assignedProjectIds.length === 0) {
      setSessions([]);
      return;
    }
    return subscribeToDCSessionsByProjects(worker.assignedProjectIds, setSessions);
  }, [isSuperAdmin, worker?.assignedProjectIds.join(",")]);

  function navigateTo(s: OpsSection) {
    setSection(s);
    router.replace(`/ops?section=${s}`, { scroll: false });
  }

  function handleSignOut() {
    void signOut(getFirebaseClientServices().auth);
  }

  const canTranscribe = isSuperAdmin || (worker?.roles ?? []).includes("transcription");
  const canQA = isSuperAdmin || (worker?.roles ?? []).includes("qa");
  const canManageWorkers = isSuperAdmin;
  const canExport = isSuperAdmin || (worker?.roles ?? []).includes("delivery");

  const sideMenuItems: PlatformSideMenuItem[] = [
    { label: "Ops", isSectionHeader: true },
    { label: "Dashboard", href: "/ops?section=dashboard", active: section === "dashboard" },
    ...(canTranscribe ? [{ label: "Transcription", href: "/ops?section=transcription", active: section === "transcription" } as PlatformSideMenuItem] : []),
    ...(canQA ? [{ label: "QA Review", href: "/ops?section=qa", active: section === "qa" } as PlatformSideMenuItem] : []),
    ...(canManageWorkers ? [
      { label: "Management", isSectionHeader: true } as PlatformSideMenuItem,
      { label: "Workers", href: "/ops?section=workers", active: section === "workers" } as PlatformSideMenuItem,
    ] : []),
    ...(canExport ? [
      { label: "Delivery", isSectionHeader: true } as PlatformSideMenuItem,
      { label: "Exports", href: "/ops?section=exports", active: section === "exports" } as PlatformSideMenuItem,
    ] : []),
  ];

  const userProfile = {
    name: worker?.name || user.displayName || user.email?.split("@")[0] || "Worker",
    href: "/ops",
    imageUrl: user.photoURL,
  };

  const content = (() => {
    switch (section) {
      case "dashboard":
        return <DashboardSection sessions={sessions} worker={worker} isSuperAdmin={isSuperAdmin} onNavigate={navigateTo} />;
      case "transcription":
        return canTranscribe
          ? <TranscriptionSection sessions={sessions} workerEmail={user.email ?? ""} />
          : <EmptyState message="You don't have transcription access." />;
      case "qa":
        return canQA
          ? <QASection sessions={sessions} workerEmail={user.email ?? ""} />
          : <EmptyState message="You don't have QA access." />;
      case "workers":
        return canManageWorkers
          ? <WorkersSection activeUser={user} projects={projects} />
          : <EmptyState message="Super admin access required." />;
      case "exports":
        return canExport
          ? <ExportsSection sessions={sessions} projects={projects} speakers={speakers} />
          : <EmptyState message="You don't have export access." />;
    }
  })();

  return (
    <DeaimerSiteShell
      platformSideMenuItems={sideMenuItems}
      userProfile={userProfile}
    >
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
          {content}
        </div>
      </div>
    </DeaimerSiteShell>
  );
}

// ─── Auth wrapper ─────────────────────────────────────────────────────────────

function OpsShellContent({
  initialSection,
  initialProjectId,
}: {
  initialSection: OpsSection;
  initialProjectId: string | null;
}) {
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [worker, setWorker] = useState<OpsWorker | null>(null);
  const [workerLoading, setWorkerLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!isFirebaseConfigured()) { setIsAuthLoading(false); return; }

    async function init() {
      try {
        await ensureFirebaseAuthPersistence();
        await resolveFirebaseRedirectSignIn();
      } catch { /* handled by auth state */ }
      if (cancelled) return;
      const { auth } = getFirebaseClientServices();
      const unsub = onAuthStateChanged(auth, (u) => {
        if (cancelled) return;
        setUser(u);
        setIsAuthLoading(false);
      });
      return unsub;
    }

    const cleanup = init();
    return () => { cancelled = true; cleanup.then((unsub) => unsub?.())};
  }, []);

  useEffect(() => {
    if (!user?.email) { setWorker(null); setWorkerLoading(false); return; }
    if (isSuperAdminEmail(user.email)) { setWorkerLoading(false); return; }
    setWorkerLoading(true);
    return subscribeToOpsWorkerByEmail(user.email, (w) => {
      setWorker(w);
      setWorkerLoading(false);
    });
  }, [user?.email]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    setAuthError("");
    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : "Sign-in failed");
      setSigningIn(false);
    }
  }

  if (isAuthLoading || (user && workerLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Ops Portal</p>
          <h1 className="mt-3 text-2xl font-semibold text-ink">Sign in to continue</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">Access is restricted to authorised transcription and QA workers.</p>
          {authError && <p className="mt-3 text-sm text-rose-600">{authError}</p>}
          <button
            type="button"
            disabled={signingIn}
            onClick={() => void handleGoogleSignIn()}
            className="mt-6 inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-panelStrong disabled:opacity-60"
          >
            <svg width="18" height="18" viewBox="0 0 48 48" fill="none">
              <path d="M44.5 20H24v8.5h11.7C34.2 33.3 29.6 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20c11 0 19.7-8 19.7-20 0-1.3-.2-2.7-.2-4z" fill="#4285F4"/>
              <path d="M6.3 14.7l7 5.1C15 16.2 19.2 13 24 13c3 0 5.7 1.1 7.8 2.9l6-6C34.5 6.5 29.6 4 24 4 16.2 4 9.6 8.4 6.3 14.7z" fill="#EA4335"/>
              <path d="M24 44c5.5 0 10.5-1.8 14.4-5l-6.7-5.5C29.6 35.3 27 36 24 36c-5.6 0-10.2-3.7-11.7-8.5L6.2 33c3.2 6.4 9.9 11 17.8 11z" fill="#34A853"/>
              <path d="M44.5 20H24v8.5h11.7c-.7 2-2.1 3.7-3.8 4.9L38.5 39c4.1-3.8 6.5-9.4 6.5-15 0-1.3-.2-2.7-.2-4z" fill="#FBBC05"/>
            </svg>
            {signingIn ? "Signing in…" : "Continue with Google"}
          </button>
        </div>
      </DeaimerSiteShell>
    );
  }

  const isSuperAdmin = isSuperAdminEmail(user.email);
  const isAuthorized = isSuperAdmin || (worker !== null && worker.status === "active");

  if (!isAuthorized) {
    return (
      <DeaimerSiteShell>
        <div className="flex min-h-[80vh] flex-col items-center justify-center px-4 text-center">
          <h1 className="text-xl font-semibold text-ink">Access denied</h1>
          <p className="mt-2 max-w-sm text-sm text-muted">
            {worker?.status === "paused"
              ? "Your ops access is currently paused. Contact a super admin."
              : "Your account is not authorised for the ops portal. Contact a super admin."}
          </p>
          <button
            type="button"
            onClick={() => void signOut(getFirebaseClientServices().auth)}
            className="mt-5 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
          >
            Sign out
          </button>
        </div>
      </DeaimerSiteShell>
    );
  }

  return (
    <OpsPortal
      user={user}
      worker={isSuperAdmin ? null : worker}
      isSuperAdmin={isSuperAdmin}
      initialSection={initialSection}
      initialProjectId={initialProjectId}
    />
  );
}

export function OpsShell({
  initialSection,
  initialProjectId,
}: {
  initialSection: OpsSection;
  initialProjectId: string | null;
}) {
  return <OpsShellContent initialSection={initialSection} initialProjectId={initialProjectId} />;
}
