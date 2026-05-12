"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  inviteAndAssignSpeaker,
  inviteDCSpeaker,
  subscribeToDCAssignmentsByProject,
  subscribeToDCProjects,
  subscribeToDCSessions,
  subscribeToDCSpeakers,
  updateDCProject,
  updateDCSessionQA,
  updateDCSessionTranscription,
  updateDCSpeakerStatus,
  type DCAssignment,
  type DCProject,
  type DCQAStatus,
  type DCSession,
  type DCSpeaker,
  type DCTranscriptionStatus,
} from "@/lib/firebase/data-collection";

export type DCAdminSection =
  | "projects"
  | "speakers"
  | "sessions"
  | "transcription"
  | "qa-review"
  | "delivery";

interface DataCollectionAdminPanelProps {
  activeUser: User;
  activeSection: DCAdminSection;
  isSuperAdmin: boolean;
}

// ─── Small shared components ──────────────────────────────────────────────────

function SectionHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h2 className="text-xl font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}

function MetricCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-4 py-4 sm:px-5 sm:py-5">
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60 sm:text-[11px]">{label}</p>
      <p className="mt-1.5 text-2xl font-light tabular-nums tracking-tight text-ink sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-[11px] leading-5 text-muted">{sub}</p>}
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    completed: "border-blue-200 bg-blue-50 text-blue-800",
    paused: "border-amber-200 bg-amber-50 text-amber-800",
    archived: "border-slate-200 bg-slate-100 text-slate-600",
    pending: "border-slate-200 bg-white text-muted",
    suspended: "border-rose-200 bg-rose-50 text-rose-800",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-800",
    rejected: "border-rose-200 bg-rose-50 text-rose-800",
    "in-review": "border-amber-200 bg-amber-50 text-amber-800",
    "asr-processing": "border-blue-200 bg-blue-50 text-blue-800",
    "asr-done": "border-purple-200 bg-purple-50 text-purple-800",
    "human-review": "border-amber-200 bg-amber-50 text-amber-800",
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
      <button
        type="button"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
        aria-label="Close"
      />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

const fieldCls =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-primary";

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-ink">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
    </label>
  );
}

function formatDuration(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
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

// ─── Projects section ─────────────────────────────────────────────────────────

function ProjectsSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [projects, setProjects] = useState<DCProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<DCProject | null>(null);

  useEffect(() => {
    return subscribeToDCProjects((p) => { setProjects(p); setLoading(false); });
  }, []);

  async function handleStatusChange(project: DCProject, status: DCProject["status"]) {
    await updateDCProject(project.id, { status });
  }

  if (selectedProject) {
    return (
      <ProjectDetail
        project={selectedProject}
        activeUser={activeUser}
        isSuperAdmin={isSuperAdmin}
        onBack={() => setSelectedProject(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Projects"
        description="Manage all speech data collection projects."
        action={
          isSuperAdmin ? (
            <button
              type="button"
              onClick={() => router.push("/super/data-collection/create")}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
            >
              + Create Project
            </button>
          ) : undefined
        }
      />

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState message="No projects yet. Create your first data collection project." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Client", "Dialect", "Progress", "Speakers", "Deadline", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((p) => (
                <tr key={p.id} className="group hover:bg-panelStrong/50">
                  <td className="px-4 py-3 font-medium text-ink">{p.name}</td>
                  <td className="px-4 py-3 text-muted">{p.client}</td>
                  <td className="px-4 py-3 text-muted">{p.dialect}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${Math.min(100, (p.hoursCompleted / (p.targetHours || 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted">
                        {p.hoursCompleted.toFixed(1)}/{p.targetHours}h
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.participantCount}</td>
                  <td className="px-4 py-3 text-muted">{p.deadline || "—"}</td>
                  <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setSelectedProject(p)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                      >
                        View
                      </button>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => router.push(`/super/data-collection/edit/${p.id}`)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-ink hover:bg-slate-100"
                        >
                          Edit
                        </button>
                      )}
                      {p.status === "active" && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(p, "paused")}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-muted hover:bg-slate-100"
                        >
                          Pause
                        </button>
                      )}
                      {p.status === "paused" && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(p, "active")}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          Resume
                        </button>
                      )}
                      {isSuperAdmin && p.status !== "archived" && (
                        <button
                          type="button"
                          onClick={() => void handleStatusChange(p, "archived")}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Archive
                        </button>
                      )}
                    </div>
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

// ─── Project Detail ───────────────────────────────────────────────────────────

function ProjectDetail({
  project,
  activeUser,
  isSuperAdmin,
  onBack,
}: {
  project: DCProject;
  activeUser: User;
  isSuperAdmin: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [assignments, setAssignments] = useState<DCAssignment[]>([]);
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignName, setAssignName] = useState("");
  const [assignHours, setAssignHours] = useState(5);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");

  const progress = Math.min(100, (project.hoursCompleted / (project.targetHours || 1)) * 100);

  useEffect(() => {
    const u1 = subscribeToDCAssignmentsByProject(project.id, setAssignments);
    const u2 = subscribeToDCSessions((s) => setSessions(s.filter((x) => x.projectId === project.id)));
    return () => { u1(); u2(); };
  }, [project.id]);

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignError("");
    try {
      await inviteAndAssignSpeaker(
        project,
        assignEmail,
        assignName,
        assignHours,
        activeUser.email ?? "",
        activeUser.uid,
      );
      setShowAssign(false);
      setAssignEmail("");
      setAssignName("");
    } catch (err) {
      setAssignError(err instanceof Error ? err.message : "Could not assign speaker.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary"
      >
        ← Back to projects
      </button>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">{project.client}</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">{project.name}</h2>
            <p className="mt-1 text-sm leading-6 text-muted">{project.description}</p>
          </div>
          <div className="flex items-center gap-2">
            <StatusBadge status={project.status} />
            {isSuperAdmin && (
              <button
                type="button"
                onClick={() => router.push(`/super/data-collection/edit/${project.id}`)}
                className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-muted hover:bg-slate-50 active:scale-95"
              >
                Edit Project
              </button>
            )}
          </div>
        </div>
        <div className="mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>Progress</span>
            <span>{project.hoursCompleted.toFixed(1)} / {project.targetHours}h</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Dialect", value: project.dialect },
            { label: "Deadline", value: project.deadline || "—" },
            { label: "Sample rate", value: project.audioFormat.sampleRate },
            { label: "Bit depth", value: project.audioFormat.bitDepth },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-ink">Speakers ({assignments.length})</h3>
        <button
          type="button"
          onClick={() => setShowAssign(true)}
          className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primaryStrong"
        >
          + Add Speaker
        </button>
      </div>

      {assignments.length === 0 ? (
        <EmptyState message="No speakers assigned yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Speaker", "Email", "Progress", "Sessions", "Status"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-3 font-medium text-ink">{a.speakerName || a.speakerEmail}</td>
                  <td className="px-4 py-3 text-muted">{a.speakerEmail}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (a.hoursCompleted / (a.hoursTarget || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-xs text-muted">{a.hoursCompleted.toFixed(1)}/{a.hoursTarget}h</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{a.sessionsCount}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="font-semibold text-ink">Sessions ({sessions.length})</h3>
      {sessions.length === 0 ? (
        <EmptyState message="No sessions recorded yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session ID", "Speaker", "Duration", "Transcription", "QA", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ink">{s.speakerName || s.speakerId}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                  <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Add Speaker to Project" open={showAssign} onClose={() => { setShowAssign(false); setAssignError(""); }}>
        <form onSubmit={(e) => void handleAssign(e)} className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-xs leading-5 text-muted">
            Enter the speaker's email. If they haven't been invited before, they'll be created automatically.
            They can then sign in at <strong>/speakers</strong> using that Google account.
          </div>
          {assignError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{assignError}</div>
          )}
          <Field label="Speaker email" required>
            <input
              type="email"
              className={fieldCls}
              placeholder="speaker@example.com"
              value={assignEmail}
              onChange={(e) => setAssignEmail(e.target.value)}
              required
            />
          </Field>
          <Field label="Speaker name">
            <input
              className={fieldCls}
              placeholder="Full name (optional if already registered)"
              value={assignName}
              onChange={(e) => setAssignName(e.target.value)}
            />
          </Field>
          <Field label="Hours target" required>
            <input
              type="number"
              min={1}
              className={fieldCls}
              value={assignHours}
              onChange={(e) => setAssignHours(Number(e.target.value))}
              required
            />
          </Field>
          <button
            type="submit"
            disabled={assigning}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-60"
          >
            {assigning ? "Adding…" : "Add Speaker to Project"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// ─── Speakers section ─────────────────────────────────────────────────────────

function SpeakersSection({ activeUser }: { activeUser: User }) {
  const [speakers, setSpeakers] = useState<DCSpeaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    return subscribeToDCSpeakers((s) => { setSpeakers(s); setLoading(false); });
  }, []);

  async function handleInvite(e: FormEvent) {
    e.preventDefault();
    setInviting(true);
    setInviteError("");
    try {
      await inviteDCSpeaker(inviteEmail, inviteName, activeUser.email ?? "", activeUser.uid);
      setInviteName("");
      setInviteEmail("");
      setShowInvite(false);
    } catch (err) {
      setInviteError(err instanceof Error ? err.message : "Could not invite speaker.");
    } finally {
      setInviting(false);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Speakers"
        description="Manage all registered speakers across your data collection projects."
        action={
          <button
            type="button"
            onClick={() => setShowInvite(true)}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong"
          >
            + Invite Speaker
          </button>
        }
      />

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : speakers.length === 0 ? (
        <EmptyState message="No speakers invited yet. Invite your first speaker to get started." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Name", "Email", "Dialect", "Gender", "Region", "Projects", "Hours", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {speakers.map((s) => (
                <tr key={s.id} className="group hover:bg-panelStrong/50">
                  <td className="px-4 py-3 font-medium text-ink">{s.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{s.email}</td>
                  <td className="px-4 py-3 text-muted">{s.dialect || "—"}</td>
                  <td className="px-4 py-3 text-muted capitalize">{s.gender || "—"}</td>
                  <td className="px-4 py-3 text-muted">{s.region || "—"}</td>
                  <td className="px-4 py-3 text-muted">{s.projectsCount}</td>
                  <td className="px-4 py-3 text-muted">{s.totalHours.toFixed(2)}h</td>
                  <td className="px-4 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100">
                      {s.status !== "suspended" && (
                        <button
                          type="button"
                          onClick={() => void updateDCSpeakerStatus(s.email, "suspended")}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50"
                        >
                          Suspend
                        </button>
                      )}
                      {s.status === "suspended" && (
                        <button
                          type="button"
                          onClick={() => void updateDCSpeakerStatus(s.email, "active")}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50"
                        >
                          Reactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SlidePanel title="Invite Speaker" open={showInvite} onClose={() => setShowInvite(false)}>
        <form onSubmit={(e) => void handleInvite(e)} className="space-y-4">
          {inviteError && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{inviteError}</div>}
          <Field label="Full name" required>
            <input className={fieldCls} placeholder="Speaker's name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} required />
          </Field>
          <Field label="Email address" required>
            <input type="email" className={fieldCls} placeholder="speaker@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
          </Field>
          <p className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-xs leading-5 text-muted">
            The speaker will be able to sign in at <strong>/speakers</strong> with this email address once invited.
          </p>
          <button
            type="submit"
            disabled={inviting}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-60"
          >
            {inviting ? "Inviting…" : "Send Invitation"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// ─── Sessions section ─────────────────────────────────────────────────────────

function SessionsSection({ activeUser: _user }: { activeUser: User }) {
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<DCSession | null>(null);
  const [filterProject, setFilterProject] = useState("");
  const [filterQA, setFilterQA] = useState("");

  useEffect(() => {
    return subscribeToDCSessions((s) => { setSessions(s); setLoading(false); });
  }, []);

  const filtered = sessions.filter((s) => {
    if (filterProject && !s.projectName.toLowerCase().includes(filterProject.toLowerCase())) return false;
    if (filterQA && s.qaStatus !== filterQA) return false;
    return true;
  });

  if (selected) {
    return <SessionDetail session={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div className="space-y-6">
      <SectionHeader
        title="Sessions"
        description="All recorded sessions across every project and speaker."
      />

      <div className="flex flex-wrap gap-3">
        <input
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
          placeholder="Filter by project…"
          value={filterProject}
          onChange={(e) => setFilterProject(e.target.value)}
        />
        <select
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
          value={filterQA}
          onChange={(e) => setFilterQA(e.target.value)}
        >
          <option value="">All QA statuses</option>
          {["pending", "in-review", "approved", "rejected"].map((v) => (
            <option key={v} value={v}>{v}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No sessions match the current filters." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session", "Speaker", "Project", "Duration", "Transcription", "QA", "Date", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((s) => (
                <tr key={s.id} className="group hover:bg-panelStrong/50">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ink">{s.speakerName || s.speakerId}</td>
                  <td className="px-4 py-3 text-muted">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                  <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setSelected(s)}
                      className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary opacity-0 hover:bg-primary/10 group-hover:opacity-100"
                    >
                      Review
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

// ─── Session Detail ───────────────────────────────────────────────────────────

function SessionDetail({ session, onBack }: { session: DCSession; onBack: () => void }) {
  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        ← Back to sessions
      </button>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-mono text-muted">{session.id}</p>
            <h2 className="mt-1 text-xl font-semibold text-ink">{session.speakerName || session.speakerId}</h2>
            <p className="mt-0.5 text-sm text-muted">{session.projectName} · {formatDuration(session.duration)}</p>
          </div>
          <div className="flex gap-2">
            <StatusBadge status={session.transcriptionStatus} />
            <StatusBadge status={session.qaStatus} />
          </div>
        </div>

        {session.audioUrl && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Audio</p>
            {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
            <audio controls src={session.audioUrl} className="w-full rounded-xl" />
          </div>
        )}

        {session.transcriptText && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">Transcript</p>
            <div className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-sm leading-7 text-ink">
              {session.transcriptText}
            </div>
          </div>
        )}

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Gender", value: session.gender || "—" },
            { label: "Age", value: session.age || "—" },
            { label: "Dialect", value: session.dialect || "—" },
            { label: "Region", value: session.region || "—" },
            { label: "Sample rate", value: `${session.sampleRate} Hz` },
            { label: "Bit depth", value: `${session.bitDepth}-bit` },
            { label: "WER score", value: session.werScore != null ? `${session.werScore}%` : "—" },
            { label: "QA score", value: session.qaScore != null ? `${session.qaScore}/10` : "—" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>

        {session.qaNote && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <strong>QA Note:</strong> {session.qaNote}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Transcription section ────────────────────────────────────────────────────

function TranscriptionSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToDCSessions((s) => { setSessions(s); setLoading(false); });
  }, []);

  const pending = sessions.filter((s) => s.transcriptionStatus === "pending");
  const asrDone = sessions.filter((s) => s.transcriptionStatus === "asr-done");
  const completed = sessions.filter((s) => s.transcriptionStatus === "completed");
  const totalWer = sessions.filter((s) => s.werScore != null).map((s) => s.werScore as number);
  const avgWer = totalWer.length ? (totalWer.reduce((a, b) => a + b, 0) / totalWer.length).toFixed(1) : "—";

  async function triggerASR(sessionId: string) {
    setUpdating(sessionId);
    try {
      await updateDCSessionTranscription(sessionId, "asr-processing");
    } finally {
      setUpdating(null);
    }
  }

  async function markComplete(sessionId: string) {
    setUpdating(sessionId);
    try {
      await updateDCSessionTranscription(sessionId, "completed");
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Transcription" description="Manage transcription workflows across all sessions." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending" value={String(pending.length)} sub="Awaiting transcription" />
        <MetricCard label="ASR Done" value={String(asrDone.length)} sub="Ready for human review" />
        <MetricCard label="Completed" value={String(completed.length)} sub="Fully transcribed" />
        <MetricCard label="Avg WER" value={avgWer === "—" ? "—" : `${avgWer}%`} sub="Word error rate across reviewed sessions" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session", "Project", "Speaker", "Duration", "Status", "WER", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}…</td>
                  <td className="px-4 py-3 text-ink">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{s.speakerName || s.speakerId}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3 text-muted">{s.werScore != null ? `${s.werScore}%` : "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isSuperAdmin && s.transcriptionStatus === "pending" && (
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void triggerASR(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {updating === s.id ? "…" : "Trigger ASR"}
                        </button>
                      )}
                      {isSuperAdmin && (s.transcriptionStatus === "asr-done" || s.transcriptionStatus === "human-review") && (
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void markComplete(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {updating === s.id ? "…" : "Mark Complete"}
                        </button>
                      )}
                    </div>
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

// ─── QA Review section ────────────────────────────────────────────────────────

function QAReviewSection({ activeUser }: { activeUser: User }) {
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  useEffect(() => {
    return subscribeToDCSessions((s) => { setSessions(s); setLoading(false); });
  }, []);

  const pending = sessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review");
  const approved = sessions.filter((s) => s.qaStatus === "approved");
  const rejected = sessions.filter((s) => s.qaStatus === "rejected");
  const approvalRate = sessions.length ? Math.round((approved.length / sessions.length) * 100) : 0;

  async function handleQAAction(session: DCSession, status: DCQAStatus) {
    setUpdating(session.id);
    try {
      await updateDCSessionQA(session.id, status, activeUser.email ?? "", undefined, noteInput[session.id]);
    } finally {
      setUpdating(null);
    }
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="QA Review" description="Review, approve, and reject session recordings." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending QA" value={String(pending.length)} sub="Awaiting review" />
        <MetricCard label="Approved" value={String(approved.length)} sub="Passed QA" />
        <MetricCard label="Rejected" value={String(rejected.length)} sub="Failed QA" />
        <MetricCard label="Approval rate" value={`${approvalRate}%`} sub="Across all reviewed sessions" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : pending.length === 0 ? (
        <EmptyState message="No sessions pending QA review." />
      ) : (
        <div className="space-y-3">
          {pending.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted">{s.id.slice(0, 12)}…</p>
                  <p className="font-medium text-ink">{s.speakerName || s.speakerId} <span className="font-normal text-muted">· {s.projectName}</span></p>
                  <p className="text-xs text-muted">{formatDuration(s.duration)} · {formatDate(s.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={s.qaStatus} />
                  {s.werScore != null && <span className="text-xs text-muted">WER: {s.werScore}%</span>}
                </div>
              </div>
              {s.audioUrl && (
                <div className="mt-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={s.audioUrl} className="w-full rounded-xl" />
                </div>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <input
                  className="flex-1 rounded-xl border border-slate-200 bg-panelStrong px-3 py-2 text-sm outline-none focus:border-primary"
                  placeholder="QA note (optional)…"
                  value={noteInput[s.id] ?? ""}
                  onChange={(e) => setNoteInput((n) => ({ ...n, [s.id]: e.target.value }))}
                />
                <button
                  type="button"
                  disabled={updating === s.id}
                  onClick={() => void handleQAAction(s, "approved")}
                  className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {updating === s.id ? "…" : "Approve"}
                </button>
                <button
                  type="button"
                  disabled={updating === s.id}
                  onClick={() => void handleQAAction(s, "rejected")}
                  className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                >
                  {updating === s.id ? "…" : "Reject"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Delivery section ─────────────────────────────────────────────────────────

function DeliverySection({ activeUser: _user }: { activeUser: User }) {
  const [projects, setProjects] = useState<DCProject[]>([]);
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToDCProjects((p) => { setProjects(p); setLoading(false); });
    const u2 = subscribeToDCSessions(setSessions);
    return () => { u1(); u2(); };
  }, []);

  return (
    <div className="space-y-6">
      <SectionHeader title="Delivery" description="Package and export approved audio data for clients." />

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : projects.length === 0 ? (
        <EmptyState message="No projects to deliver yet." />
      ) : (
        <div className="space-y-4">
          {projects.map((p) => {
            const projectSessions = sessions.filter((s) => s.projectId === p.id);
            const approvedSessions = projectSessions.filter((s) => s.qaStatus === "approved");
            const pendingSessions = projectSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review");
            const approvedHours = approvedSessions.reduce((sum, s) => sum + s.duration / 3600, 0);

            return (
              <div key={p.id} className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs text-muted">{p.client}</p>
                    <h3 className="font-semibold text-ink">{p.name}</h3>
                    <p className="mt-0.5 text-xs text-muted">{p.dialect}</p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-emerald-700">Approved</p>
                    <p className="mt-1 text-lg font-light text-ink">{approvedSessions.length} <span className="text-xs text-muted">sessions</span></p>
                    <p className="text-xs text-muted">{approvedHours.toFixed(2)}h ready</p>
                  </div>
                  <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-amber-700">In QA</p>
                    <p className="mt-1 text-lg font-light text-ink">{pendingSessions.length} <span className="text-xs text-muted">sessions</span></p>
                  </div>
                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-[11px] uppercase tracking-widest text-muted">Total</p>
                    <p className="mt-1 text-lg font-light text-ink">{projectSessions.length} <span className="text-xs text-muted">sessions</span></p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <button
                    type="button"
                    disabled={approvedSessions.length === 0}
                    className="rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-40"
                    onClick={() => alert("Package generation requires a backend Cloud Function to bundle audio + metadata ZIP. The data is ready.")}
                  >
                    Generate Package
                  </button>
                  <p className="text-xs text-muted">
                    Folder structure: {p.name}/ → speaker_id/ → audio + metadata.json
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function DataCollectionAdminPanel({ activeUser, activeSection, isSuperAdmin }: DataCollectionAdminPanelProps) {
  return (
    <div>
      {activeSection === "projects" && <ProjectsSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "speakers" && <SpeakersSection activeUser={activeUser} />}
      {activeSection === "sessions" && <SessionsSection activeUser={activeUser} />}
      {activeSection === "transcription" && <TranscriptionSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "qa-review" && <QAReviewSection activeUser={activeUser} />}
      {activeSection === "delivery" && <DeliverySection activeUser={activeUser} />}
    </div>
  );
}
