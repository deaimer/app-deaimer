"use client";

import { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { ArrowLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  VideoMeeting,
  VideoMeetingClientStatus,
  VideoProject,
  VideoProjectParticipant,
  getVideoSlot,
  subscribeToClientVideoProjects,
  subscribeToVideoMeetings,
  subscribeToVideoProjectParticipants,
  VIDEO_SCHEDULE_SLOTS,
} from "@/lib/firebase/video-collection";

// ─── Types ────────────────────────────────────────────────────────────────────

type DcSummary = {
  id: string;
  name: string;
  recordingMode: "video" | "conversational" | "utterance";
  status: string;
  summary: string;
};

type Screen = "list" | "project" | "participants" | "scheduling" | "meeting";

type FilledSlot = {
  slotId: string;
  pA: VideoProjectParticipant;
  pB: VideoProjectParticipant;
  meeting: VideoMeeting | null;
};

function computeFilledSlots(
  participants: VideoProjectParticipant[],
  meetings: VideoMeeting[],
): FilledSlot[] {
  const map = new Map<string, VideoProjectParticipant[]>();
  participants.forEach((p) => {
    p.selectedSlotIds.forEach((sid) => {
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(p);
    });
  });
  return [...map.entries()]
    .filter(([, ps]) => ps.length >= 2)
    .map(([slotId, ps]) => ({
      slotId,
      pA: ps[0]!,
      pB: ps[1]!,
      meeting: meetings.find((m) => m.slotId === slotId) ?? null,
    }));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<VideoMeetingClientStatus, { label: string; cls: string }> = {
  under_review:    { label: "Under Review",    cls: "border-amber-200 bg-amber-50 text-amber-800" },
  meeting_booked:  { label: "Meeting Booked",  cls: "border-blue-200 bg-blue-50 text-blue-800" },
  session_approved:{ label: "Session Approved",cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  session_rejected:{ label: "Session Rejected",cls: "border-rose-200 bg-rose-50 text-rose-800" },
  no_show_up:      { label: "No Show Up",      cls: "border-slate-200 bg-slate-100 text-slate-600" },
};

const ALL_STATUSES: VideoMeetingClientStatus[] = [
  "under_review", "meeting_booked", "session_approved", "session_rejected", "no_show_up",
];

const TYPE_CLS: Record<string, string> = {
  video:           "border-violet-200 bg-violet-50 text-violet-800",
  conversational:  "border-sky-200 bg-sky-50 text-sky-800",
  utterance:       "border-orange-200 bg-orange-50 text-orange-800",
};

const TYPE_LABEL: Record<string, string> = {
  video: "Video", conversational: "Conversational", utterance: "Utterance",
};

function slotLabel(meeting: VideoMeeting): string {
  const slot = getVideoSlot(meeting.slotId);
  if (slot) return slot.label;
  const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(meeting.slotId);
  if (m) {
    const [, date, time] = m;
    const [y, mo, d] = date.split("-").map(Number);
    const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" })
      .format(new Date(y, mo - 1, d));
    return `${day} · ${time} EDT`;
  }
  return meeting.date ? `${meeting.date} · ${meeting.time}` : "Scheduled";
}

function StatusBadge({ status }: { status: VideoMeetingClientStatus }) {
  const { label, cls } = STATUS_CFG[status];
  return <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cls}`}>{label}</span>;
}

function BackBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-muted hover:bg-panelStrong hover:text-ink"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

// ─── Add / update link modal ──────────────────────────────────────────────────

function LinkModal({
  initial,
  saving,
  onSave,
  onClose,
}: {
  initial: string;
  saving: boolean;
  onSave: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-2xl">
        <p className="text-sm font-semibold text-ink">
          {initial ? "Update meeting link" : "Add meeting link"}
        </p>
        <p className="mt-1 text-xs text-muted">Zoom, Google Meet, Teams — paste the session URL.</p>
        <input
          type="url"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://zoom.us/j/…"
          className="mt-4 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary"
        />
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-muted hover:bg-panelStrong hover:text-ink"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving || !url.trim()}
            onClick={() => onSave(url.trim())}
            className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Saving…" : "Confirm →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Meeting detail ───────────────────────────────────────────────────────────

function MeetingDetailView({
  slot,
  project,
  onBack,
}: {
  slot: FilledSlot;
  project: VideoProject;
  onBack: () => void;
}) {
  const [linkOpen, setLinkOpen] = useState(false);
  const [savingLink, setSavingLink] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meeting = slot.meeting;
  const currentStatus: VideoMeetingClientStatus = meeting?.clientStatus ?? "under_review";
  const currentUrl = meeting?.meetingUrl ?? "";

  const label = meeting
    ? slotLabel(meeting)
    : (() => {
        const s = getVideoSlot(slot.slotId);
        if (s) return s.label;
        const m = /^(\d{4}-\d{2}-\d{2})-(.+)$/.exec(slot.slotId);
        if (m) {
          const [, date, time] = m;
          const [y, mo, d] = date.split("-").map(Number);
          const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric" })
            .format(new Date(y, mo - 1, d));
          return `${day} · ${time} EDT`;
        }
        return slot.slotId;
      })();

  async function apiCall(method: "POST" | "PATCH", body: Record<string, unknown>) {
    const token = await getAuth().currentUser?.getIdToken();
    const res = await fetch("/api/clients/meetings", {
      method,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token ?? ""}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(typeof data.error === "string" ? data.error : "Request failed.");
    }
  }

  async function handleSaveLink(url: string) {
    setSavingLink(true); setError(null);
    try {
      if (meeting) {
        await apiCall("PATCH", { projectId: project.id, meetingId: meeting.id, meetingUrl: url });
      } else {
        await apiCall("POST", {
          projectId: project.id,
          slotId: slot.slotId,
          pAUid: slot.pA.uid || slot.pA.id,
          pAName: slot.pA.fullName || slot.pA.email,
          pBUid: slot.pB.uid || slot.pB.id,
          pBName: slot.pB.fullName || slot.pB.email,
          meetingUrl: url,
        });
      }
      setLinkOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save link.");
    } finally {
      setSavingLink(false);
    }
  }

  async function handleStatus(status: VideoMeetingClientStatus) {
    if (!meeting || status === currentStatus) return;
    setSavingStatus(true); setError(null);
    try { await apiCall("PATCH", { projectId: project.id, meetingId: meeting.id, clientStatus: status }); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update status."); }
    finally { setSavingStatus(false); }
  }

  return (
    <>
      {linkOpen && (
        <LinkModal
          initial={currentUrl}
          saving={savingLink}
          onSave={(url) => void handleSaveLink(url)}
          onClose={() => setLinkOpen(false)}
        />
      )}
      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center gap-3">
          <BackBtn label="Scheduling" onClick={onBack} />
          <div className="min-w-0 flex-1">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{project.title}</p>
            <h2 className="text-base font-semibold text-ink">{label}</h2>
          </div>
          <StatusBadge status={currentStatus} />
        </div>

        {error && (
          <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
        )}

        {/* Participants */}
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Participants</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {[slot.pA, slot.pB].map((p, i) => (
              <div key={i} className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3">
                <p className="text-sm font-semibold text-ink">{p.fullName || p.email || "Participant"}</p>
                {p.email ? <p className="mt-0.5 text-xs text-muted">{p.email}</p> : null}
              </div>
            ))}
          </div>
        </section>

        {/* Meeting link */}
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Meeting link</p>
            <button
              type="button"
              onClick={() => setLinkOpen(true)}
              className="rounded-full border border-slate-200 bg-panelStrong px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary/40 hover:bg-primary/5"
            >
              {currentUrl ? "Update link" : "Add meeting link"}
            </button>
          </div>
          {currentUrl ? (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-sm text-primary underline-offset-2 hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{currentUrl}</span>
            </a>
          ) : (
            <p className="mt-3 text-sm text-muted">No meeting link added yet.</p>
          )}
        </section>

        {/* Status */}
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">Session status</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {ALL_STATUSES.map((s) => {
              const active = s === currentStatus;
              const { label: lbl, cls } = STATUS_CFG[s];
              return (
                <button
                  key={s}
                  type="button"
                  disabled={savingStatus || active || !meeting}
                  onClick={() => void handleStatus(s)}
                  title={!meeting ? "Add a meeting link first to manage status" : undefined}
                  className={[
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    active
                      ? `${cls} outline outline-2 outline-offset-1 outline-current/30`
                      : "border-slate-200 bg-white text-muted hover:border-slate-300 hover:text-ink disabled:opacity-50",
                  ].join(" ")}
                >
                  {lbl}{active ? " ✓" : ""}
                </button>
              );
            })}
          </div>
          {!meeting && (
            <p className="mt-2 text-xs text-muted">Add a meeting link to enable status management.</p>
          )}
        </section>
      </div>
    </>
  );
}

// ─── Scheduling list ──────────────────────────────────────────────────────────

function SchedulingListView({
  project,
  participants,
  meetings,
  onView,
  onBack,
}: {
  project: VideoProject;
  participants: VideoProjectParticipant[];
  meetings: VideoMeeting[];
  onView: (slotId: string) => void;
  onBack: () => void;
}) {
  const filledSlots = computeFilledSlots(participants, meetings);

  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <BackBtn label={project.title} onClick={onBack} />
        <h2 className="text-base font-semibold text-ink">Scheduling</h2>
      </div>
      {filledSlots.length === 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted">
          No confirmed sessions yet. Sessions appear here once two participants book the same slot.
        </div>
      ) : (
        <div className="space-y-2">
          {filledSlots.map((fs) => {
            const status: VideoMeetingClientStatus = fs.meeting?.clientStatus ?? "under_review";
            const s = getVideoSlot(fs.slotId);
            const label = s?.label ?? fs.slotId;
            return (
              <div
                key={fs.slotId}
                className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{label}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {fs.pA.fullName || fs.pA.email || "Participant A"} + {fs.pB.fullName || fs.pB.email || "Participant B"}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <StatusBadge status={status} />
                  <button
                    type="button"
                    onClick={() => onView(fs.slotId)}
                    className="flex items-center gap-1 rounded-full border border-slate-200 bg-panelStrong px-3 py-1.5 text-xs font-semibold text-ink hover:border-primary/30 hover:bg-primary/5"
                  >
                    View <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Participants list ────────────────────────────────────────────────────────

function ParticipantsListView({
  project,
  participants,
  onBack,
}: {
  project: VideoProject;
  participants: VideoProjectParticipant[];
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <div className="flex items-center gap-3">
        <BackBtn label={project.title} onClick={onBack} />
        <h2 className="text-base font-semibold text-ink">
          Participants{participants.length > 0 ? ` (${participants.length})` : ""}
        </h2>
      </div>
      {participants.length === 0 ? (
        <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-12 text-center text-sm text-muted">
          No participants added yet.
        </div>
      ) : (
        <div className="space-y-2">
          {participants.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-4 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-3.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">
                  {p.fullName || p.email || "Unnamed"}
                </p>
                {p.email ? <p className="truncate text-xs text-muted">{p.email}</p> : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Video project detail ─────────────────────────────────────────────────────

function VideoProjectDetailView({
  project,
  participants,
  meetings,
  onParticipants,
  onScheduling,
  onBack,
}: {
  project: VideoProject;
  participants: VideoProjectParticipant[];
  meetings: VideoMeeting[];
  onParticipants: () => void;
  onScheduling: () => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4 pt-4">
      <div className="flex flex-wrap items-center gap-3">
        <BackBtn label="Projects" onClick={onBack} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">{project.title}</h2>
            <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_CLS.video}`}>Video</span>
            <span className={[
              "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
              project.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-200 bg-white text-muted",
            ].join(" ")}>
              {project.status}
            </span>
          </div>
          {project.jobDescription ? (
            <p className="mt-0.5 truncate text-xs text-muted">{project.jobDescription}</p>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <button
          type="button"
          onClick={onParticipants}
          className="group flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-white p-5 text-left transition hover:border-primary/30 hover:bg-primary/5"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Participants</p>
            <p className="mt-2 text-3xl font-semibold text-ink">{String(participants.length).padStart(2, "0")}</p>
            <p className="mt-1 text-xs text-muted">
              {participants.length === 1 ? "1 person added" : `${participants.length} people added`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
        </button>

        <button
          type="button"
          onClick={onScheduling}
          className="group flex items-center justify-between rounded-[1.25rem] border border-slate-200 bg-white p-5 text-left transition hover:border-primary/30 hover:bg-primary/5"
        >
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-muted">Scheduling</p>
            <p className="mt-2 text-3xl font-semibold text-ink">
              {String(computeFilledSlots(participants, meetings).length).padStart(2, "0")}
            </p>
            <p className="mt-1 text-xs text-muted">
              {computeFilledSlots(participants, meetings).length === 1 ? "1 session filled" : `${computeFilledSlots(participants, meetings).length} sessions filled`}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted group-hover:text-primary" />
        </button>
      </div>
    </div>
  );
}

// ─── Project list ─────────────────────────────────────────────────────────────

function ProjectListView({
  videoProjects,
  dcProjects,
  loading,
  onSelectVideo,
}: {
  videoProjects: VideoProject[];
  dcProjects: DcSummary[];
  loading: boolean;
  onSelectVideo: (p: VideoProject) => void;
}) {
  const nonVideoDc = dcProjects.filter((p) => p.recordingMode !== "video");
  const empty = !loading && videoProjects.length === 0 && nonVideoDc.length === 0;

  return (
    <div className="space-y-5 pt-4">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">Workspace</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Projects</h1>
      </section>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      ) : empty ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm text-muted">
          No projects assigned to your company yet.
        </section>
      ) : (
        <div className="space-y-2">
          {videoProjects.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onSelectVideo(p)}
              className="group flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4 text-left transition hover:border-primary/30 hover:bg-primary/5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.title}</p>
                {p.jobDescription ? (
                  <p className="mt-0.5 truncate text-xs text-muted">{p.jobDescription}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_CLS.video}`}>Video</span>
                <span className={[
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  p.status === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-muted",
                ].join(" ")}>
                  {p.status}
                </span>
                <ChevronRight className="h-4 w-4 text-muted group-hover:text-primary" />
              </div>
            </button>
          ))}

          {nonVideoDc.map((p) => (
            <div
              key={p.id}
              className="flex w-full items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-white px-5 py-4"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                {p.summary ? <p className="mt-0.5 truncate text-xs text-muted">{p.summary}</p> : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TYPE_CLS[p.recordingMode] ?? TYPE_CLS.utterance}`}>
                  {TYPE_LABEL[p.recordingMode] ?? "Utterance"}
                </span>
                <span className={[
                  "rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                  p.status === "active"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-muted",
                ].join(" ")}>
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export function ClientVideoProgressPanel({
  clientEmail,
  companyName,
}: {
  clientEmail: string | null | undefined;
  companyName?: string | null;
}) {
  const [screen, setScreen] = useState<Screen>("list");
  const [selectedProject, setSelectedProject] = useState<VideoProject | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const [videoProjects, setVideoProjects] = useState<VideoProject[]>([]);
  const [dcProjects, setDcProjects] = useState<DcSummary[]>([]);
  const [dcLoading, setDcLoading] = useState(true);
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToClientVideoProjects(
      clientEmail,
      setVideoProjects,
      (e) => setError(e.message),
      companyName,
    );
  }, [clientEmail, companyName]);

  useEffect(() => {
    if (!companyName) { setDcLoading(false); return; }
    let cancelled = false;
    async function load() {
      setDcLoading(true);
      try {
        const token = await getAuth().currentUser?.getIdToken();
        if (!token) { if (!cancelled) setDcLoading(false); return; }
        const res = await fetch("/api/clients/projects", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!cancelled && res.ok) {
          const data = await res.json() as { projects: DcSummary[] };
          setDcProjects(data.projects ?? []);
        }
      } catch { /* ignore */ }
      if (!cancelled) setDcLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [companyName]);

  useEffect(() => {
    if (!selectedProject) return;
    setParticipants([]);
    setMeetings([]);
    const u1 = subscribeToVideoProjectParticipants(selectedProject.id, setParticipants, (e) => setError(e.message));
    const u2 = subscribeToVideoMeetings(selectedProject.id, setMeetings, (e) => setError(e.message));
    return () => { u1(); u2(); };
  }, [selectedProject]);

  function openProject(p: VideoProject) {
    setSelectedProject(p);
    setScreen("project");
  }

  function goList() { setScreen("list"); setSelectedProject(null); setSelectedSlotId(null); }

  const filledSlots = computeFilledSlots(participants, meetings);
  const activeSlot = filledSlots.find((fs) => fs.slotId === selectedSlotId) ?? null;
  const loading = dcLoading && videoProjects.length === 0 && dcProjects.length === 0;

  if (screen === "meeting" && selectedProject && activeSlot) {
    return (
      <MeetingDetailView
        slot={activeSlot}
        project={selectedProject}
        onBack={() => setScreen("scheduling")}
      />
    );
  }

  if (screen === "scheduling" && selectedProject) {
    return (
      <SchedulingListView
        project={selectedProject}
        participants={participants}
        meetings={meetings}
        onView={(slotId) => { setSelectedSlotId(slotId); setScreen("meeting"); }}
        onBack={() => setScreen("project")}
      />
    );
  }

  if (screen === "participants" && selectedProject) {
    return (
      <ParticipantsListView
        project={selectedProject}
        participants={participants}
        onBack={() => setScreen("project")}
      />
    );
  }

  if (screen === "project" && selectedProject) {
    return (
      <VideoProjectDetailView
        project={selectedProject}
        participants={participants}
        meetings={meetings}
        onParticipants={() => setScreen("participants")}
        onScheduling={() => setScreen("scheduling")}
        onBack={goList}
      />
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>
      )}
      <ProjectListView
        videoProjects={videoProjects}
        dcProjects={dcProjects}
        loading={loading}
        onSelectVideo={openProject}
      />
    </>
  );
}
