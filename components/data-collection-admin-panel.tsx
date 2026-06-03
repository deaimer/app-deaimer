"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "firebase/auth";
import {
  inviteAndAssignSpeaker,
  inviteDCSpeaker,
  subscribeToDCAssignments,
  subscribeToDCAssignmentsByProject,
  subscribeToDCProjects,
  subscribeToDCSessions,
  subscribeToDCSessionsByProjects,
  subscribeToDCSpeakers,
  updateDCProject,
  updateDCSessionAssignment,
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
import {
  subscribeToAdminApproval,
  subscribeToAdminApprovals,
  updateAdminProjectAssignment,
  type AdminApprovalRecord,
} from "@/lib/firebase/admin-access";
import {
  addWorkerToProject,
  fetchOpsWorkersByProjects,
  removeWorkerFromProject,
  subscribeToOpsWorkersByProject,
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

// â”€â”€â”€ Small shared components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
            âœ•
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
  if (!val) return "â€”";
  try {
    const ts = (val as { toDate?: () => Date }).toDate?.();
    return (ts ?? new Date(val as string)).toLocaleDateString();
  } catch {
    return "â€”";
  }
}

// â”€â”€â”€ Projects section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function groupSessionsByProject(sessions: DCSession[]) {
  const groups = new Map<string, DCSession[]>();
  sessions.forEach((session) => {
    const key = session.projectId || session.projectName || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), session]);
  });
  return Array.from(groups.entries()).map(([projectId, projectSessions]) => ({
    projectId,
    projectName: projectSessions[0]?.projectName || "Untitled project",
    sessions: projectSessions,
    participantCount: new Set(projectSessions.map((s) => s.speakerId || s.speakerName).filter(Boolean)).size,
  }));
}

function groupSessionsByParticipant(sessions: DCSession[]) {
  const groups = new Map<string, DCSession[]>();
  sessions.forEach((session) => {
    const key = session.speakerId || session.speakerName || "unknown";
    groups.set(key, [...(groups.get(key) ?? []), session]);
  });
  return Array.from(groups.entries()).map(([speakerId, speakerSessions]) => ({
    speakerId,
    speakerName: speakerSessions[0]?.speakerName || speakerId,
    sessions: speakerSessions,
    duration: speakerSessions.reduce((sum, session) => sum + session.duration, 0),
    lastDate: speakerSessions[0]?.createdAt,
  }));
}

function workerOwnerForProject(worker: OpsWorker, projectId: string) {
  const owner = worker.projectAssignmentOwners?.[projectId];
  if (owner?.adminEmail) {
    return {
      email: owner.adminEmail.toLowerCase(),
      name: owner.adminName || owner.adminEmail,
    };
  }
  if (worker.invitedByAdminEmail) {
    return {
      email: worker.invitedByAdminEmail.toLowerCase(),
      name: worker.invitedByName || worker.invitedByAdminEmail,
    };
  }
  return {
    email: worker.invitedByEmail.toLowerCase(),
    name: worker.invitedByName || worker.invitedByEmail || "Super admin",
  };
}

function workerOwnedByAdmin(worker: OpsWorker, projectId: string, adminEmail: string) {
  return workerOwnerForProject(worker, projectId).email === adminEmail.trim().toLowerCase();
}

function ProjectsSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [allProjects, setAllProjects] = useState<DCProject[]>([]);
  const [adminProjectIds, setAdminProjectIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<DCProject | null>(null);

  useEffect(() => {
    return subscribeToDCProjects((p) => { setAllProjects(p); setLoading(false); });
  }, []);

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(activeUser.email, (approval) => {
      setAdminProjectIds(approval?.assignedProjectIds ?? []);
    });
  }, [isSuperAdmin, activeUser.email]);

  const projects = isSuperAdmin
    ? allProjects
    : allProjects.filter((p) => (adminProjectIds ?? []).includes(p.id));

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
                    {p.recordingMode === "utterance" ? (
                      <span className="text-xs text-muted">
                        {p.tasks.reduce((s, t) => s + t.prompts.length, 0)} prompts
                      </span>
                    ) : (
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
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{p.participantCount}</td>
                  <td className="px-4 py-3 text-muted">{p.deadline || "â€”"}</td>
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

// â”€â”€â”€ Project Detail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [adminApprovals, setAdminApprovals] = useState<AdminApprovalRecord[]>([]);
  const [showAssignAdmin, setShowAssignAdmin] = useState(false);
  const [assignAdminEmail, setAssignAdminEmail] = useState("");
  const [assigningAdmin, setAssigningAdmin] = useState(false);
  const [assignAdminError, setAssignAdminError] = useState("");
  const [workers, setWorkers] = useState<OpsWorker[]>([]);
  const [showAddWorker, setShowAddWorker] = useState(false);
  const [workerEmail, setWorkerEmail] = useState("");
  const [workerName, setWorkerName] = useState("");
  const [workerRoles, setWorkerRoles] = useState<OpsRole[]>(["transcription"]);
  const [addingWorker, setAddingWorker] = useState(false);
  const [addWorkerError, setAddWorkerError] = useState("");

  const isUtterance = project.recordingMode === "utterance";
  const totalExpectedPrompts = isUtterance
    ? project.tasks.reduce((sum, t) => sum + t.prompts.length, 0)
    : 0;
  const progress = isUtterance
    ? Math.min(100, totalExpectedPrompts > 0 ? (sessions.length / totalExpectedPrompts) * 100 : 0)
    : Math.min(100, (project.hoursCompleted / (project.targetHours || 1)) * 100);

  const evalAdmins = adminApprovals.filter((a) => a.servicePermissions.includes("evaluation-transcription"));
  const assignedAdmins = evalAdmins.filter((a) => a.assignedProjectIds.includes(project.id));
  const unassignedAdmins = evalAdmins.filter((a) => !a.assignedProjectIds.includes(project.id));

  useEffect(() => {
    const u1 = subscribeToDCAssignmentsByProject(project.id, setAssignments);
    const u2 = subscribeToDCSessions((s) => setSessions(s.filter((x) => x.projectId === project.id)));
    let cancelled = false;
    let u4: (() => void) | undefined;
    if (isSuperAdmin) {
      u4 = subscribeToOpsWorkersByProject(project.id, setWorkers);
    } else {
      void fetchOpsWorkersByProjects([project.id])
        .then((records) => {
          if (!cancelled) setWorkers(records);
        })
        .catch(() => {
          if (!cancelled) setWorkers([]);
        });
    }
    return () => { cancelled = true; u1(); u2(); u4?.(); };
  }, [isSuperAdmin, project.id]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    subscribeToAdminApprovals(setAdminApprovals);
  }, [isSuperAdmin]);

  // Auto-propagate QA/transcriptor assignments to re-submitted sessions that lost them
  useEffect(() => {
    if (sessions.length === 0) return;
    sessions.forEach((s) => {
      if ((s.submissionCount ?? 0) === 0) return;
      if (s.assignedQAEmail && s.assignedTranscriptorEmail) return;
      const original = sessions.find(
        (o) =>
          o.id !== s.id &&
          o.taskId === s.taskId &&
          o.promptIndex === s.promptIndex &&
          o.qaStatus === "rejected" &&
          (Boolean(o.assignedQAEmail) || Boolean(o.assignedTranscriptorEmail)),
      );
      if (!original) return;
      const needsTranscriptor = !s.assignedTranscriptorEmail && Boolean(original.assignedTranscriptorEmail);
      const needsQA = !s.assignedQAEmail && Boolean(original.assignedQAEmail);
      if (needsTranscriptor || needsQA) {
        void updateDCSessionAssignment(
          s.id,
          needsTranscriptor ? original.assignedTranscriptorEmail : undefined,
          needsQA ? original.assignedQAEmail : undefined,
        );
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.map((s) => s.id).join(",")]);

  async function handleAssignAdmin() {
    if (!assignAdminEmail) return;
    setAssigningAdmin(true);
    setAssignAdminError("");
    try {
      const admin = evalAdmins.find((a) => a.email === assignAdminEmail);
      if (!admin) throw new Error("Admin not found.");
      await updateAdminProjectAssignment(admin.email, [...admin.assignedProjectIds, project.id]);
      setShowAssignAdmin(false);
      setAssignAdminEmail("");
    } catch (err) {
      setAssignAdminError(err instanceof Error ? err.message : "Could not assign admin.");
    } finally {
      setAssigningAdmin(false);
    }
  }

  async function handleRemoveAdmin(admin: AdminApprovalRecord) {
    await updateAdminProjectAssignment(
      admin.email,
      admin.assignedProjectIds.filter((id) => id !== project.id),
    );
  }

  async function handleAddWorker() {
    if (!workerEmail.trim() || workerRoles.length === 0) return;
    setAddingWorker(true);
    setAddWorkerError("");
    try {
      await addWorkerToProject(
        workerEmail.trim(),
        workerName.trim(),
        workerRoles,
        project.id,
        activeUser.email ?? "",
        activeUser.uid,
        isSuperAdmin ? "super" : "admin",
        isSuperAdmin ? undefined : (activeUser.email ?? undefined),
        activeUser.displayName || activeUser.email || undefined,
      );
      setShowAddWorker(false);
      setWorkerEmail("");
      setWorkerName("");
      setWorkerRoles(["transcription"]);
    } catch (err) {
      setAddWorkerError(err instanceof Error ? err.message : "Could not add worker.");
    } finally {
      setAddingWorker(false);
    }
  }

  async function handleRemoveWorker(worker: OpsWorker) {
    if (!isSuperAdmin && !workerOwnedByAdmin(worker, project.id, activeUser.email ?? "")) return;
    await removeWorkerFromProject(worker.email, project.id);
    setWorkers((current) => current.filter((w) => w.email !== worker.email));
  }

  async function handleAssign(e: FormEvent) {
    e.preventDefault();
    setAssigning(true);
    setAssignError("");
    try {
      await inviteAndAssignSpeaker(
        project,
        assignEmail,
        assignName,
        project.targetHours || 0,
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
        â† Back to projects
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
            {isUtterance
              ? <span>{sessions.length} / {totalExpectedPrompts} prompts</span>
              : <span>{project.hoursCompleted.toFixed(1)} / {project.targetHours}h</span>
            }
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress}%` }} />
          </div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Dialect", value: project.dialect },
            { label: "Deadline", value: project.deadline || "â€”" },
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
                    {isUtterance ? (() => {
                      const done = sessions.filter((s) => s.assignmentId === a.id).length;
                      const pct = totalExpectedPrompts > 0 ? Math.min(100, Math.round((done / totalExpectedPrompts) * 100)) : 0;
                      return (
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-muted">{done}/{totalExpectedPrompts}</span>
                        </div>
                      );
                    })() : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (a.hoursCompleted / (a.hoursTarget || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted">{a.hoursCompleted.toFixed(1)}/{a.hoursTarget}h</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{a.sessionsCount}</td>
                  <td className="px-4 py-3"><StatusBadge status={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Demographic distribution */}
      {assignments.length > 0 && (() => {
        const genderCounts = sessions.reduce<Record<string, number>>((acc, s) => {
          const g = s.gender || "Unknown";
          acc[g] = (acc[g] ?? 0) + 1;
          return acc;
        }, {});
        const ageCounts = sessions.reduce<Record<string, number>>((acc, s) => {
          const raw = Number(s.age);
          let group = "Unknown";
          if (!isNaN(raw) && raw > 0) {
            if (raw < 25) group = "18â€“24";
            else if (raw < 35) group = "25â€“34";
            else if (raw < 45) group = "35â€“44";
            else if (raw < 55) group = "45â€“54";
            else if (raw < 65) group = "55â€“64";
            else group = "65+";
          }
          acc[group] = (acc[group] ?? 0) + 1;
          return acc;
        }, {});
        const tierCounts = assignments.reduce<Record<string, number>>((acc, a) => {
          const label = a.targetSampleRate === 48000 ? "48kHz" : a.targetSampleRate === 16000 ? "16kHz" : a.targetSampleRate === 8000 ? "8kHz" : "â€”";
          acc[label] = (acc[label] ?? 0) + 1;
          return acc;
        }, {});
        const uniqueSpeakers = new Set(sessions.map((s) => s.speakerId)).size;
        return (
          <div className="rounded-[1.25rem] border border-slate-200 bg-white p-5 space-y-4">
            <h3 className="font-semibold text-ink">Demographics</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Unique speakers</p>
                <p className="text-2xl font-light text-ink">{uniqueSpeakers}</p>
              </div>
              <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Gender</p>
                <div className="space-y-1">
                  {Object.entries(genderCounts).map(([g, n]) => (
                    <div key={g} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{g}</span>
                      <span className="font-medium text-ink">{n}</span>
                    </div>
                  ))}
                  {Object.keys(genderCounts).length === 0 && <p className="text-xs text-muted">No data</p>}
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Age groups</p>
                <div className="space-y-1">
                  {Object.entries(ageCounts).map(([g, n]) => (
                    <div key={g} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{g}</span>
                      <span className="font-medium text-ink">{n}</span>
                    </div>
                  ))}
                  {Object.keys(ageCounts).length === 0 && <p className="text-xs text-muted">No data</p>}
                </div>
              </div>
            </div>
            {isUtterance && (
              <div className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
                <p className="text-[11px] uppercase tracking-widest text-muted mb-2">Sample rate tiers (assigned)</p>
                <div className="flex flex-wrap gap-4">
                  {Object.entries(tierCounts).map(([tier, n]) => (
                    <div key={tier} className="flex items-center gap-1.5 text-xs">
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 font-medium text-ink">{tier}</span>
                      <span className="text-muted">{n} speakers</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Assigned Admins */}
      {isSuperAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Assigned Admins ({assignedAdmins.length})</h3>
            <button
              type="button"
              onClick={() => { setShowAssignAdmin(true); setAssignAdminEmail(""); setAssignAdminError(""); }}
              disabled={unassignedAdmins.length === 0}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primaryStrong disabled:opacity-40"
            >
              + Assign Admin
            </button>
          </div>
          {assignedAdmins.length === 0 ? (
            <EmptyState message="No admins assigned to this project yet." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                    {["Name", "Email", "Company", ""].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedAdmins.map((a) => (
                    <tr key={a.email} className="group hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{a.contactName || "â€”"}</td>
                      <td className="px-4 py-3 text-muted">{a.email}</td>
                      <td className="px-4 py-3 text-muted">{a.company || "â€”"}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => void handleRemoveAdmin(a)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 opacity-0 group-hover:opacity-100 hover:bg-rose-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <SlidePanel title="Assign Admin to Project" open={showAssignAdmin} onClose={() => setShowAssignAdmin(false)}>
            <div className="space-y-4">
              <p className="text-sm text-muted">
                Select an admin with <strong>Evaluation &amp; Transcription</strong> access to assign to this project.
                They will then be able to invite transcription and QA workers scoped to this project.
              </p>
              {assignAdminError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{assignAdminError}</div>
              )}
              {unassignedAdmins.length === 0 ? (
                <p className="text-sm text-muted italic">All eligible admins are already assigned to this project.</p>
              ) : (
                <div className="space-y-1">
                  {unassignedAdmins.map((a) => (
                    <label key={a.email} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-primary/30 text-sm">
                      <input
                        type="radio"
                        name="adminEmail"
                        value={a.email}
                        checked={assignAdminEmail === a.email}
                        onChange={() => setAssignAdminEmail(a.email)}
                        className="accent-primary"
                      />
                      <div>
                        <p className="font-medium text-ink">{a.contactName || a.email}</p>
                        <p className="text-[11px] text-muted">{a.email} Â· {a.company}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
              <button
                type="button"
                disabled={!assignAdminEmail || assigningAdmin}
                onClick={() => void handleAssignAdmin()}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50"
              >
                {assigningAdmin ? "Assigningâ€¦" : "Assign Admin"}
              </button>
            </div>
          </SlidePanel>
        </div>
      )}

      {/* Workers section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Workers ({workers.length})</h3>
          <button
            type="button"
            onClick={() => { setShowAddWorker(true); setWorkerEmail(""); setWorkerName(""); setWorkerRoles(["transcription"]); setAddWorkerError(""); }}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primaryStrong"
          >
            + Add Worker
          </button>
        </div>
        {workers.length === 0 ? (
          <EmptyState message="No transcriptors or QA workers assigned to this project yet." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Name", "Email", "Roles", "Added by", "Status", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w) => {
                  const canManage = isSuperAdmin || workerOwnedByAdmin(w, project.id, activeUser.email ?? "");
                  const owner = workerOwnerForProject(w, project.id);
                  return (
                    <tr key={w.email} className="group hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{w.name || "—"}</td>
                      <td className="px-4 py-3 text-muted">{w.email}</td>
                      <td className="px-4 py-3 text-muted capitalize">{w.roles.join(", ")}</td>
                      <td className="px-4 py-3 text-muted">{owner.name || "—"}</td>
                      <td className="px-4 py-3"><StatusBadge status={w.status} /></td>
                      <td className="px-4 py-3">
                        {canManage ? (
                          <button
                            type="button"
                            onClick={() => void handleRemoveWorker(w)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 opacity-0 group-hover:opacity-100 hover:bg-rose-50"
                          >
                            Remove
                          </button>
                        ) : (
                          <span className="text-xs text-muted">View only</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SlidePanel title="Add Worker to Project" open={showAddWorker} onClose={() => setShowAddWorker(false)}>
          <div className="space-y-4">
            <p className="text-sm text-muted">
              Add a transcriptor or QA specialist. They can sign in at <strong>/ops</strong> and will only see sessions assigned to them.
            </p>
            {addWorkerError && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{addWorkerError}</div>
            )}
            <Field label="Email" required>
              <input
                type="email"
                className={fieldCls}
                placeholder="worker@example.com"
                value={workerEmail}
                onChange={(e) => setWorkerEmail(e.target.value)}
              />
            </Field>
            <Field label="Name">
              <input
                className={fieldCls}
                placeholder="Full name (optional)"
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
              />
            </Field>
            <div className="space-y-2">
              <p className="text-xs font-semibold text-ink">Roles</p>
              {(["transcription", "qa"] as OpsRole[]).map((role) => (
                <label key={role} className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 hover:border-primary/30 text-sm">
                  <input
                    type="checkbox"
                    checked={workerRoles.includes(role)}
                    onChange={() => setWorkerRoles((prev) =>
                      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
                    )}
                    className="accent-primary"
                  />
                  <span className="capitalize font-medium text-ink">{role}</span>
                </label>
              ))}
            </div>
            <button
              type="button"
              disabled={!workerEmail.trim() || workerRoles.length === 0 || addingWorker}
              onClick={() => void handleAddWorker()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50"
            >
              {addingWorker ? (
                <>
                  <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Addingâ€¦
                </>
              ) : "Add Worker"}
            </button>
          </div>
        </SlidePanel>
      </div>

      <h3 className="font-semibold text-ink">Sessions ({sessions.length})</h3>
      {sessions.length === 0 ? (
        <EmptyState message="No sessions recorded yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session ID", "Speaker", "Duration", "Transcription", "QA", "Transcriptor", "QA Worker", "Date"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}â€¦</td>
                  <td className="px-4 py-3 text-ink">{s.speakerName || s.speakerId}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                  <td className="px-2 py-3">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink"
                      value={s.assignedTranscriptorEmail}
                      onChange={(e) => void updateDCSessionAssignment(s.id, e.target.value, undefined)}
                    >
                      <option value="">â€” unassigned â€”</option>
                      {workers.filter((w) => w.roles.includes("transcription")).map((w) => (
                        <option key={w.email} value={w.email}>{w.name || w.email}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-2 py-3">
                    <select
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-ink"
                      value={s.assignedQAEmail}
                      onChange={(e) => void updateDCSessionAssignment(s.id, undefined, e.target.value)}
                    >
                      <option value="">â€” unassigned â€”</option>
                      {workers.filter((w) => w.roles.includes("qa")).map((w) => (
                        <option key={w.email} value={w.email}>{w.name || w.email}</option>
                      ))}
                    </select>
                  </td>
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
          <button
            type="submit"
            disabled={assigning}
            className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-60"
          >
            {assigning ? "Addingâ€¦" : "Add Speaker to Project"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// â”€â”€â”€ Speakers section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SpeakersSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const [speakers, setSpeakers] = useState<DCSpeaker[]>([]);
  const [assignments, setAssignments] = useState<DCAssignment[]>([]);
  const [adminProjectIds, setAdminProjectIds] = useState<string[] | null>(isSuperAdmin ? [] : null);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");

  useEffect(() => {
    return subscribeToDCSpeakers((s) => { setSpeakers(s); setLoading(false); });
  }, []);

  useEffect(() => {
    return subscribeToDCAssignments(setAssignments);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(activeUser.email, (approval) => {
      setAdminProjectIds(approval?.assignedProjectIds ?? []);
    });
  }, [activeUser.email, isSuperAdmin]);

  const visibleSpeakers = isSuperAdmin
    ? speakers
    : speakers.filter((speaker) =>
        assignments.some((assignment) =>
          assignment.speakerEmail === speaker.email &&
          (adminProjectIds ?? []).includes(assignment.projectId),
        ),
      );

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
      ) : visibleSpeakers.length === 0 ? (
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
              {visibleSpeakers.map((s) => (
                <tr key={s.id} className="group hover:bg-panelStrong/50">
                  <td className="px-4 py-3 font-medium text-ink">{s.name || "â€”"}</td>
                  <td className="px-4 py-3 text-muted">{s.email}</td>
                  <td className="px-4 py-3 text-muted">{s.dialect || "â€”"}</td>
                  <td className="px-4 py-3 text-muted capitalize">{s.gender || "â€”"}</td>
                  <td className="px-4 py-3 text-muted">{s.region || "â€”"}</td>
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
            {inviting ? "Invitingâ€¦" : "Send Invitation"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// â”€â”€â”€ Sessions section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SessionsSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const [assignments, setAssignments] = useState<DCAssignment[]>([]);
  const [projects, setProjects] = useState<DCProject[]>([]);
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [speakers, setSpeakers] = useState<DCSpeaker[]>([]);
  const [adminProjectIds, setAdminProjectIds] = useState<string[] | null>(isSuperAdmin ? [] : null);
  const [loading, setLoading] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<DCAssignment | null>(null);
  const [filterText, setFilterText] = useState("");

  useEffect(() => {
    let loadedCount = 0;
    const done = () => { if (++loadedCount >= 4) setLoading(false); };
    const u1 = subscribeToDCAssignments((a) => { setAssignments(a); done(); });
    const u2 = subscribeToDCProjects((p) => { setProjects(p); done(); });
    const u3 = subscribeToDCSessions((s) => { setSessions(s); done(); });
    const u4 = subscribeToDCSpeakers((s) => { setSpeakers(s); done(); });
    return () => { u1(); u2(); u3(); u4(); };
  }, []);

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(activeUser.email, (approval) => {
      setAdminProjectIds(approval?.assignedProjectIds ?? []);
    });
  }, [activeUser.email, isSuperAdmin]);

  if (selectedAssignment) {
    return (
      <AssignmentDetail
        assignment={selectedAssignment}
        sessions={sessions.filter((s) => s.assignmentId === selectedAssignment.id && Boolean(s.audioUrl))}
        project={projects.find((p) => p.id === selectedAssignment.projectId) ?? null}
        speaker={speakers.find((s) => s.email === selectedAssignment.speakerEmail) ?? null}
        onBack={() => setSelectedAssignment(null)}
      />
    );
  }

  const scopedProjectIds = isSuperAdmin
    ? null
    : new Set(adminProjectIds ?? []);
  const scopedProjects = isSuperAdmin
    ? projects
    : projects.filter((p) => scopedProjectIds?.has(p.id));
  const scopedAssignments = isSuperAdmin
    ? assignments
    : assignments.filter((a) => scopedProjectIds?.has(a.projectId));
  const scopedSessions = isSuperAdmin
    ? sessions
    : sessions.filter((s) => scopedProjectIds?.has(s.projectId));
  const selectedProject = selectedProjectId
    ? scopedProjects.find((project) => project.id === selectedProjectId) ?? null
    : null;

  const sessionProjects = scopedProjects.filter((project) =>
    scopedAssignments.some((assignment) => assignment.projectId === project.id) ||
    scopedSessions.some((session) => session.projectId === project.id)
  );

  if (loading || (!isSuperAdmin && adminProjectIds == null)) {
    return (
      <div className="flex justify-center py-10">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (!selectedProject) {
    const totalSubmittedScoped = scopedAssignments.filter((a) => a.submittedForReview).length;
    const totalInProgressScoped = scopedAssignments.filter((a) => !a.submittedForReview).length;

    return (
      <div className="space-y-6">
        <SectionHeader title="Sessions" description="Choose a project to view participants and recordings." />

        <div className="grid gap-4 sm:grid-cols-3">
          <MetricCard label="Projects" value={String(sessionProjects.length)} sub="With assignments or sessions" />
          <MetricCard label="In Progress" value={String(totalInProgressScoped)} sub="Recording" />
          <MetricCard label="Submitted" value={String(totalSubmittedScoped)} sub="Awaiting QA" />
        </div>

        {sessionProjects.length === 0 ? (
          <EmptyState message="No projects with sessions found." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Project", "Participants", "Recorded", "Submitted", "In Progress", "Last Session", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sessionProjects.map((project) => {
                  const projectAssignments = scopedAssignments.filter((a) => a.projectId === project.id);
                  const projectSessions = scopedSessions.filter((s) => s.projectId === project.id && Boolean(s.audioUrl));
                  const submitted = projectAssignments.filter((a) => a.submittedForReview).length;
                  const inProgress = projectAssignments.length - submitted;
                  return (
                    <tr key={project.id} className="hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{project.name}</td>
                      <td className="px-4 py-3 text-muted">{projectAssignments.length}</td>
                      <td className="px-4 py-3 text-muted">{projectSessions.length}</td>
                      <td className="px-4 py-3 text-muted">{submitted}</td>
                      <td className="px-4 py-3 text-muted">{inProgress}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(projectSessions[0]?.createdAt)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedProjectId(project.id)}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          Open â†’
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  const projectAssignments = scopedAssignments.filter((a) => a.projectId === selectedProject.id);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => setSelectedProjectId(null)}
        className="text-sm font-medium text-muted hover:text-primary"
      >
        â† Back to projects
      </button>
      <SectionHeader title={selectedProject.name} description="Participants and their recorded sessions." />

      {projectAssignments.length === 0 ? (
        <EmptyState message="No participants assigned to this project." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Participant", "Gender Â· Dialect", "Recorded", "Progress", "Status", "Assigned", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectAssignments.map((assignment) => {
                const speaker = speakers.find((s) => s.email === assignment.speakerEmail);
                const assignmentSessions = scopedSessions.filter((s) => s.assignmentId === assignment.id && Boolean(s.audioUrl));
                const totalPrompts = selectedProject.tasks.reduce((sum, task) => sum + task.prompts.length, 0);
                const pct = totalPrompts > 0 ? Math.min(100, Math.round((assignmentSessions.length / totalPrompts) * 100)) : 0;
                return (
                  <tr key={assignment.id} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{speaker?.name || assignment.speakerName || "â€”"}</p>
                      <p className="text-xs text-muted">{assignment.speakerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {[speaker?.gender, speaker?.dialect].filter(Boolean).join(" Â· ") || "â€”"}
                    </td>
                    <td className="px-4 py-3 text-muted">{assignmentSessions.length}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted">
                          {assignmentSessions.length}/{totalPrompts > 0 ? totalPrompts : "?"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {assignment.submittedForReview ? (
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">Submitted</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">In Progress</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(assignment.assignedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedAssignment(assignment)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        Open â†’
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  const filtered = assignments.filter((a) => {
    if (!filterText) return true;
    const q = filterText.toLowerCase();
    return (
      a.speakerName.toLowerCase().includes(q) ||
      a.speakerEmail.toLowerCase().includes(q) ||
      a.projectName.toLowerCase().includes(q)
    );
  });

  const totalSubmitted = assignments.filter((a) => a.submittedForReview).length;
  const totalInProgress = assignments.filter((a) => !a.submittedForReview).length;

  return (
    <div className="space-y-6">
      <SectionHeader title="Sessions" description="One entry per speaker per project." />

      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard label="Total" value={String(assignments.length)} sub="Assignments" />
        <MetricCard label="In Progress" value={String(totalInProgress)} sub="Recording" />
        <MetricCard label="Submitted" value={String(totalSubmitted)} sub="Awaiting QA" />
      </div>

      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary"
        placeholder="Search by speaker or projectâ€¦"
        value={filterText}
        onChange={(e) => setFilterText(e.target.value)}
      />

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message="No assignments found." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Speaker", "Gender Â· Dialect", "Project", "Progress", "Status", "Assigned", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => {
                const project = projects.find((p) => p.id === a.projectId);
                const sp = speakers.find((s) => s.email === a.speakerEmail);
                const assignmentSessions = sessions.filter((s) => s.assignmentId === a.id && Boolean(s.audioUrl));
                const totalPrompts = project
                  ? project.tasks.reduce((sum, t) => sum + t.prompts.length, 0)
                  : 0;
                const pct = totalPrompts > 0 ? Math.min(100, Math.round((assignmentSessions.length / totalPrompts) * 100)) : 0;

                return (
                  <tr key={a.id} className="group hover:bg-panelStrong/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{sp?.name || a.speakerName || "â€”"}</p>
                      <p className="text-xs text-muted">{a.speakerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {[sp?.gender, sp?.dialect].filter(Boolean).join(" Â· ") || "â€”"}
                    </td>
                    <td className="px-4 py-3 text-muted">{a.projectName}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-muted">
                          {assignmentSessions.length}/{totalPrompts > 0 ? totalPrompts : "?"}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {a.submittedForReview ? (
                        <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11px] font-medium text-blue-800">Submitted</span>
                      ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-800">In Progress</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">{formatDate(a.assignedAt)}</td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => setSelectedAssignment(a)}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary opacity-0 hover:bg-primary/10 group-hover:opacity-100"
                      >
                        View â†’
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Assignment Detail (Sessions) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AssignmentDetail({
  assignment, sessions, project, speaker, onBack,
}: {
  assignment: DCAssignment;
  sessions: DCSession[];
  project: DCProject | null;
  speaker: DCSpeaker | null;
  onBack: () => void;
}) {
  const tasks = project?.tasks ?? [];
  // Filter out phantom sessions (no audioUrl or promptIndex outside task's range)
  const validSessions = sessions.filter((s) => {
    if (!s.audioUrl) return false;
    if (tasks.length === 0) return true;
    if (!s.taskId || s.promptIndex == null) return false;
    const task = tasks.find((t) => t.id === s.taskId);
    return task != null && s.promptIndex >= 0 && s.promptIndex < task.prompts.length;
  });
  const totalPrompts = tasks.reduce((sum, t) => sum + t.prompts.length, 0);
  const pct = totalPrompts > 0 ? Math.min(100, Math.round((validSessions.length / totalPrompts) * 100)) : 0;

  const profileFields = [
    { label: "Gender", value: speaker?.gender || "â€”" },
    { label: "Age", value: speaker?.age || "â€”" },
    { label: "Dialect", value: speaker?.dialect || "â€”" },
    { label: "Region", value: speaker?.region || "â€”" },
    { label: "Country", value: speaker?.country || "â€”" },
    { label: "Languages", value: speaker?.languages?.join(", ") || "â€”" },
  ];

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-primary">
        â† Back to sessions
      </button>

      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs text-muted">{assignment.projectName}</p>
            <h2 className="mt-0.5 text-xl font-semibold text-ink">{speaker?.name || assignment.speakerName}</h2>
            <p className="text-sm text-muted">{assignment.speakerEmail}</p>
          </div>
          {assignment.submittedForReview ? (
            <span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-800">
              Submitted for Review
            </span>
          ) : (
            <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              In Progress
            </span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {profileFields.map((f) => (
            <div key={f.label} className="rounded-xl border border-slate-100 bg-panelStrong px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-widest text-muted">{f.label}</p>
              <p className="mt-0.5 text-sm font-medium text-ink capitalize">{f.value}</p>
            </div>
          ))}
        </div>

        {totalPrompts > 0 && (
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between">
              <p className="text-xs text-muted">{sessions.length} / {totalPrompts} prompts recorded</p>
              <p className="text-xs font-semibold text-ink">{pct}%</p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            { label: "Recordings", value: String(sessions.length) },
            { label: "Tasks", value: String(tasks.length) },
            { label: "Deadline", value: assignment.deadline || "â€”" },
          ].map((item) => (
            <div key={item.label} className="rounded-xl border border-slate-100 bg-panelStrong px-4 py-3">
              <p className="text-[11px] uppercase tracking-widest text-muted">{item.label}</p>
              <p className="mt-1 text-sm font-semibold text-ink">{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {tasks.length > 0 ? (
        tasks.map((task, ti) => {
          const taskSessions = sessions.filter((s) => s.taskId === task.id);
          return (
            <div key={task.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                  {ti + 1}
                </div>
                <h3 className="font-semibold text-ink">{task.title}</h3>
                <span className="ml-auto text-xs text-muted">{taskSessions.length}/{task.prompts.length} done</span>
              </div>
              <div className="space-y-3">
                {task.prompts.map((prompt, pi) => {
                  const s = taskSessions.find((sess) => sess.promptIndex === pi);
                  return (
                    <div
                      key={pi}
                      className={`rounded-xl border px-4 py-3 ${s ? "border-emerald-200 bg-emerald-50/40" : "border-slate-100 bg-panelStrong"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                          <span className="mt-0.5 font-mono text-xs text-muted">P{pi + 1}</span>
                          <p className="text-sm leading-relaxed text-ink">{prompt.text}</p>
                        </div>
                        {s && <StatusBadge status={s.qaStatus} />}
                      </div>
                      {s?.audioUrl && (
                        <div className="mt-3">
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <audio controls src={s.audioUrl} className="w-full rounded-xl" />
                        </div>
                      )}
                      {!s && <p className="mt-2 text-xs italic text-muted">Not yet recorded</p>}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      ) : sessions.length === 0 ? (
        <EmptyState message="No recordings yet." />
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm text-ink">{s.promptText || "â€”"}</p>
                <StatusBadge status={s.qaStatus} />
              </div>
              {s.audioUrl && (
                <div className="mt-3">
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls src={s.audioUrl} className="w-full rounded-xl" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ Transcription section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function TranscriptionSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [adminWorkers, setAdminWorkers] = useState<OpsWorker[]>([]);
  const [adminProjectIds, setAdminProjectIds] = useState<string[] | null>(isSuperAdmin ? [] : null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "in-progress" | "completed">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(activeUser.email, (approval) => {
      setAdminProjectIds(approval?.assignedProjectIds ?? []);
    });
  }, [activeUser.email, isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    if (isSuperAdmin) {
      return subscribeToDCSessions((s) => { setSessions(s); setLoading(false); });
    }
    if (adminProjectIds == null) return;
    return subscribeToDCSessionsByProjects(adminProjectIds, (s) => {
      setSessions(s);
      setLoading(false);
    });
  }, [adminProjectIds, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin || adminProjectIds == null) return;
    let cancelled = false;
    void fetchOpsWorkersByProjects(adminProjectIds)
      .then((records) => {
        if (!cancelled) setAdminWorkers(records);
      })
      .catch(() => {
        if (!cancelled) setAdminWorkers([]);
      });
    return () => { cancelled = true; };
  }, [adminProjectIds, isSuperAdmin]);

  const adminEmail = activeUser.email ?? "";
  const ownedTranscriptionWorkerEmails = new Set(
    adminWorkers
      .filter((worker) => worker.roles.includes("transcription"))
      .filter((worker) => worker.assignedProjectIds.some((projectId) => workerOwnedByAdmin(worker, projectId, adminEmail)))
      .map((worker) => worker.email),
  );
  const transcribable = sessions.filter((s) =>
    Boolean(s.audioUrl) &&
    s.qaStatus === "approved" &&
    (isSuperAdmin || (Boolean(s.assignedTranscriptorEmail) && ownedTranscriptionWorkerEmails.has(s.assignedTranscriptorEmail))),
  );
  const pending = transcribable.filter((s) => s.transcriptionStatus === "pending");
  const inProgress = transcribable.filter((s) => s.transcriptionStatus === "human-review");
  const completed = transcribable.filter((s) => s.transcriptionStatus === "completed");
  const assigned = transcribable.filter((s) => Boolean(s.assignedTranscriptorEmail));
  const totalWer = transcribable.filter((s) => s.werScore != null).map((s) => s.werScore as number);
  const projectGroups = groupSessionsByProject(transcribable);
  const selectedProject = selectedProjectId
    ? projectGroups.find((project) => project.projectId === selectedProjectId)
    : null;
  const participantGroups = groupSessionsByParticipant(selectedProject?.sessions ?? []);
  const selectedParticipant = selectedParticipantId
    ? participantGroups.find((participant) => participant.speakerId === selectedParticipantId)
    : null;
  const selectedParticipantSessions = selectedParticipant?.sessions ?? [];
  const filteredParticipantSessions = selectedParticipantSessions.filter((s) => {
    const matchFilter =
      filter === "all" ||
      (filter === "pending" && s.transcriptionStatus === "pending") ||
      (filter === "in-progress" && s.transcriptionStatus === "human-review") ||
      (filter === "completed" && s.transcriptionStatus === "completed");
    const q = search.toLowerCase();
    return matchFilter && (!q || s.id.toLowerCase().includes(q));
  });
  const transcriptionFilters = [
    { key: "all" as const, label: `All (${selectedParticipantSessions.length})` },
    { key: "pending" as const, label: `Pending (${selectedParticipantSessions.filter((s) => s.transcriptionStatus === "pending").length})` },
    { key: "in-progress" as const, label: `In Progress (${selectedParticipantSessions.filter((s) => s.transcriptionStatus === "human-review").length})` },
    { key: "completed" as const, label: `Completed (${selectedParticipantSessions.filter((s) => s.transcriptionStatus === "completed").length})` },
  ];
  const avgWer = totalWer.length ? (totalWer.reduce((a, b) => a + b, 0) / totalWer.length).toFixed(1) : "â€”";

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

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (selectedProject && selectedParticipant) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => { setSelectedParticipantId(null); setSearch(""); setFilter("all"); }}
          className="text-sm font-medium text-muted hover:text-primary"
        >
          â† Back to participants
        </button>
        <SectionHeader title={selectedParticipant.speakerName} description={`${selectedProject.projectName} transcription sessions.`} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {transcriptionFilters.map((f) => (
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
          <input
            className="w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredParticipantSessions.length === 0 ? (
          <EmptyState message="No sessions match this filter." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Session", "Duration", "Rate", "Status", "Transcriptor", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipantSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}...</td>
                    <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                    <td className="px-4 py-3 text-muted">{s.sampleRate / 1000}k</td>
                    <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                    <td className="px-4 py-3 text-muted">{s.assignedTranscriptorEmail || "â€”"}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => { setSelectedProjectId(null); setSelectedParticipantId(null); setSearch(""); setFilter("all"); }}
          className="text-sm font-medium text-muted hover:text-primary"
        >
          â† Back to projects
        </button>
        <SectionHeader title={selectedProject.projectName} description="Participants in this transcription project." />

        {participantGroups.length === 0 ? (
          <EmptyState message="No participants in this transcription queue." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Participant", "Sessions", "Pending", "In Progress", "Completed", "Duration", "Transcriptor", "Last Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantGroups.map((participant) => {
                  const pendingForParticipant = participant.sessions.filter((s) => s.transcriptionStatus === "pending").length;
                  const inProgressForParticipant = participant.sessions.filter((s) => s.transcriptionStatus === "human-review").length;
                  const completedForParticipant = participant.sessions.filter((s) => s.transcriptionStatus === "completed").length;
                  const transcriptors = Array.from(new Set(participant.sessions.map((s) => s.assignedTranscriptorEmail).filter(Boolean)));
                  return (
                    <tr key={participant.speakerId} className="hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{participant.speakerName}</td>
                      <td className="px-4 py-3 text-muted">{participant.sessions.length}</td>
                      <td className="px-4 py-3 text-muted">{pendingForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{inProgressForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{completedForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{formatDuration(participant.duration)}</td>
                      <td className="px-4 py-3 text-muted">{transcriptors.join(", ") || "â€”"}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(participant.lastDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => { setSelectedParticipantId(participant.speakerId); setSearch(""); setFilter("all"); }}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          Open â†’
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Transcription" description="Choose a project to view transcription participants." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending" value={String(pending.length)} sub="Awaiting transcription" />
        <MetricCard label="Assigned" value={String(assigned.length)} sub={`${inProgress.length} in human review`} />
        <MetricCard label="Completed" value={String(completed.length)} sub="Fully transcribed" />
        <MetricCard label="Avg WER" value={avgWer === "â€”" ? "â€”" : `${avgWer}%`} sub="Word error rate across reviewed sessions" />
      </div>

      {projectGroups.length === 0 ? (
        <EmptyState message="No QA-approved sessions are ready for transcription." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Participants", "Pending", "In Progress", "Completed", "Sessions", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectGroups.map((project) => {
                const pendingForProject = project.sessions.filter((s) => s.transcriptionStatus === "pending").length;
                const inProgressForProject = project.sessions.filter((s) => s.transcriptionStatus === "human-review").length;
                const completedForProject = project.sessions.filter((s) => s.transcriptionStatus === "completed").length;
                return (
                  <tr key={project.projectId} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3 font-medium text-ink">{project.projectName}</td>
                    <td className="px-4 py-3 text-muted">{project.participantCount}</td>
                    <td className="px-4 py-3 text-muted">{pendingForProject}</td>
                    <td className="px-4 py-3 text-muted">{inProgressForProject}</td>
                    <td className="px-4 py-3 text-muted">{completedForProject}</td>
                    <td className="px-4 py-3 text-muted">{project.sessions.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.projectId)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        Open â†’
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="Transcription" description="Track QA-approved recordings assigned to transcription workers." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending" value={String(pending.length)} sub="Awaiting transcription" />
        <MetricCard label="Assigned" value={String(assigned.length)} sub={`${inProgress.length} in human review`} />
        <MetricCard label="Completed" value={String(completed.length)} sub="Fully transcribed" />
        <MetricCard label="Avg WER" value={avgWer === "â€”" ? "â€”" : `${avgWer}%`} sub="Word error rate across reviewed sessions" />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session", "Project", "Speaker", "Duration", "Status", "Transcriptor", "WER", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {transcribable.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}â€¦</td>
                  <td className="px-4 py-3 text-ink">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{s.speakerName || s.speakerId}</td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.transcriptionStatus} /></td>
                  <td className="px-4 py-3 text-muted">{s.assignedTranscriptorEmail || "â€”"}</td>
                  <td className="px-4 py-3 text-muted">{s.werScore != null ? `${s.werScore}%` : "â€”"}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {isSuperAdmin && s.transcriptionStatus === "pending" && (
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void triggerASR(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
                        >
                          {updating === s.id ? "â€¦" : "Trigger ASR"}
                        </button>
                      )}
                      {isSuperAdmin && (s.transcriptionStatus === "asr-done" || s.transcriptionStatus === "human-review") && (
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void markComplete(s.id)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {updating === s.id ? "â€¦" : "Mark Complete"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {transcribable.length === 0 && (
            <div className="border-t border-slate-100 px-6 py-8 text-center text-sm text-muted">
              No QA-approved sessions are ready for transcription.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// â”€â”€â”€ QA Review section â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QAReviewSection({ activeUser, isSuperAdmin }: { activeUser: User; isSuperAdmin: boolean }) {
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [adminWorkers, setAdminWorkers] = useState<OpsWorker[]>([]);
  const [adminProjectIds, setAdminProjectIds] = useState<string[] | null>(isSuperAdmin ? [] : null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedParticipantId, setSelectedParticipantId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "to-review" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(activeUser.email, (approval) => {
      setAdminProjectIds(approval?.assignedProjectIds ?? []);
    });
  }, [activeUser.email, isSuperAdmin]);

  useEffect(() => {
    setLoading(true);
    if (isSuperAdmin) {
      return subscribeToDCSessions((s) => { setSessions(s); setLoading(false); });
    }
    if (adminProjectIds == null) return;
    return subscribeToDCSessionsByProjects(adminProjectIds, (s) => {
      setSessions(s);
      setLoading(false);
    });
  }, [adminProjectIds, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin || adminProjectIds == null) return;
    let cancelled = false;
    void fetchOpsWorkersByProjects(adminProjectIds)
      .then((records) => {
        if (!cancelled) setAdminWorkers(records);
      })
      .catch(() => {
        if (!cancelled) setAdminWorkers([]);
      });
    return () => { cancelled = true; };
  }, [adminProjectIds, isSuperAdmin]);

  const adminEmail = activeUser.email ?? "";
  const ownedQAWorkerEmails = new Set(
    adminWorkers
      .filter((worker) => worker.roles.includes("qa"))
      .filter((worker) => worker.assignedProjectIds.some((projectId) => workerOwnedByAdmin(worker, projectId, adminEmail)))
      .map((worker) => worker.email),
  );
  const allSessions = sessions.filter((s) =>
    Boolean(s.audioUrl) &&
    (isSuperAdmin || (Boolean(s.assignedQAEmail) && ownedQAWorkerEmails.has(s.assignedQAEmail))),
  );
  const assigned = allSessions.filter((s) => Boolean(s.assignedQAEmail));
  const approved = allSessions.filter((s) => s.qaStatus === "approved");
  const rejected = allSessions.filter((s) => s.qaStatus === "rejected");
  const pending = allSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review");
  const approvalRate = allSessions.length ? Math.round((approved.length / allSessions.length) * 100) : 0;
  const projectGroups = groupSessionsByProject(allSessions);
  const selectedProject = selectedProjectId
    ? projectGroups.find((project) => project.projectId === selectedProjectId)
    : null;
  const participantGroups = groupSessionsByParticipant(selectedProject?.sessions ?? []);
  const selectedParticipant = selectedParticipantId
    ? participantGroups.find((participant) => participant.speakerId === selectedParticipantId)
    : null;
  const selectedParticipantSessions = selectedParticipant?.sessions ?? [];
  const filteredParticipantSessions = selectedParticipantSessions.filter((s) => {
    const matchFilter =
      filter === "all" ||
      (filter === "to-review" && (s.qaStatus === "pending" || s.qaStatus === "in-review")) ||
      (filter === "approved" && s.qaStatus === "approved") ||
      (filter === "rejected" && s.qaStatus === "rejected");
    const q = search.toLowerCase();
    return matchFilter && (!q || (s.promptText ?? "").toLowerCase().includes(q) || s.id.toLowerCase().includes(q));
  });
  const qaFilters = [
    { key: "all" as const, label: `All (${selectedParticipantSessions.length})` },
    { key: "to-review" as const, label: `To Review (${selectedParticipantSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review").length})` },
    { key: "approved" as const, label: `Approved (${selectedParticipantSessions.filter((s) => s.qaStatus === "approved").length})` },
    { key: "rejected" as const, label: `Rejected (${selectedParticipantSessions.filter((s) => s.qaStatus === "rejected").length})` },
  ];

  async function handleQAAction(session: DCSession, status: DCQAStatus) {
    setUpdating(session.id);
    try {
      await updateDCSessionQA(session.id, status, activeUser.email ?? "", undefined, noteInput[session.id] ?? session.qaNote);
    } finally {
      setUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
  }

  if (selectedProject && selectedParticipant) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => { setSelectedParticipantId(null); setSearch(""); setFilter("all"); }}
          className="text-sm font-medium text-muted hover:text-primary"
        >
          â† Back to participants
        </button>
        <SectionHeader title={selectedParticipant.speakerName} description={`${selectedProject.projectName} QA sessions.`} />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {qaFilters.map((f) => (
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
          <input
            className="w-48 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm outline-none focus:border-primary"
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {filteredParticipantSessions.length === 0 ? (
          <EmptyState message="No sessions match this filter." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Session", "Prompt", "Duration", "QA Status", "QA Worker", "Score", "Date"].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredParticipantSessions.map((s) => (
                  <tr key={s.id} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}...</td>
                    <td className="max-w-[220px] px-4 py-3 text-muted">
                      <span className="block truncate">{s.promptText ?? "â€”"}</span>
                      {s.submissionCount > 0 && (
                        <span className="mt-0.5 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                          Resubmission #{s.submissionCount}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                    <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                    <td className="px-4 py-3 text-muted">{s.assignedQAEmail || "â€”"}</td>
                    <td className="px-4 py-3 text-muted">{s.qaScore != null ? `${s.qaScore}/5` : "â€”"}</td>
                    <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  if (selectedProject) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          onClick={() => { setSelectedProjectId(null); setSelectedParticipantId(null); setSearch(""); setFilter("all"); }}
          className="text-sm font-medium text-muted hover:text-primary"
        >
          â† Back to projects
        </button>
        <SectionHeader title={selectedProject.projectName} description="Participants in this QA project." />

        {participantGroups.length === 0 ? (
          <EmptyState message="No participants in this QA queue." />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Participant", "Sessions", "To Review", "Approved", "Rejected", "Avg Score", "QA Worker", "Last Date", ""].map((h) => (
                    <th key={h} className="px-4 py-3 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantGroups.map((participant) => {
                  const toReviewForParticipant = participant.sessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review").length;
                  const approvedForParticipant = participant.sessions.filter((s) => s.qaStatus === "approved").length;
                  const rejectedForParticipant = participant.sessions.filter((s) => s.qaStatus === "rejected").length;
                  const scored = participant.sessions.filter((s) => s.qaScore != null).map((s) => s.qaScore as number);
                  const avgScore = scored.length ? (scored.reduce((sum, score) => sum + score, 0) / scored.length).toFixed(1) : "â€”";
                  const qaWorkers = Array.from(new Set(participant.sessions.map((s) => s.assignedQAEmail).filter(Boolean)));
                  return (
                    <tr key={participant.speakerId} className="hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{participant.speakerName}</td>
                      <td className="px-4 py-3 text-muted">{participant.sessions.length}</td>
                      <td className="px-4 py-3 text-muted">{toReviewForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{approvedForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{rejectedForParticipant}</td>
                      <td className="px-4 py-3 text-muted">{avgScore === "â€”" ? "â€”" : `${avgScore}/5`}</td>
                      <td className="px-4 py-3 text-muted">{qaWorkers.join(", ") || "â€”"}</td>
                      <td className="px-4 py-3 text-muted">{formatDate(participant.lastDate)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => { setSelectedParticipantId(participant.speakerId); setSearch(""); setFilter("all"); }}
                          className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                        >
                          Open â†’
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="QA Review" description="Choose a project to view QA participants." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending QA" value={String(pending.length)} sub="Recordings to review" />
        <MetricCard label="Assigned" value={String(assigned.length)} sub="Have a QA worker" />
        <MetricCard label="Approved" value={String(approved.length)} sub="Passed QA" />
        <MetricCard label="Approval rate" value={`${approvalRate}%`} sub={`${rejected.length} rejected`} />
      </div>

      {projectGroups.length === 0 ? (
        <EmptyState message="No recorded sessions are ready for QA review." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Participants", "To Review", "Approved", "Rejected", "Sessions", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projectGroups.map((project) => {
                const toReviewForProject = project.sessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review").length;
                const approvedForProject = project.sessions.filter((s) => s.qaStatus === "approved").length;
                const rejectedForProject = project.sessions.filter((s) => s.qaStatus === "rejected").length;
                return (
                  <tr key={project.projectId} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3 font-medium text-ink">{project.projectName}</td>
                    <td className="px-4 py-3 text-muted">{project.participantCount}</td>
                    <td className="px-4 py-3 text-muted">{toReviewForProject}</td>
                    <td className="px-4 py-3 text-muted">{approvedForProject}</td>
                    <td className="px-4 py-3 text-muted">{rejectedForProject}</td>
                    <td className="px-4 py-3 text-muted">{project.sessions.length}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedProjectId(project.projectId)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10"
                      >
                        Open â†’
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6">
      <SectionHeader title="QA Review" description="Track recorded sessions assigned to QA workers." />

      <div className="grid gap-4 sm:grid-cols-4">
        <MetricCard label="Pending QA" value={String(pending.length)} sub="Recordings to review" />
        <MetricCard label="Assigned" value={String(assigned.length)} sub="Have a QA worker" />
        <MetricCard label="Approved" value={String(approved.length)} sub="Passed QA" />
        <MetricCard label="Approval rate" value={`${approvalRate}%`} sub={`${rejected.length} rejected`} />
      </div>

      {loading ? (
        <div className="flex justify-center py-10"><span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" /></div>
      ) : allSessions.length === 0 ? (
        <EmptyState message="No recorded sessions are ready for QA review." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Session", "Project", "Speaker", "Prompt", "Duration", "QA Status", "QA Worker", "Score", "Date", "Actions"].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {allSessions.map((s) => (
                <tr key={s.id} className="align-top">
                  <td className="px-4 py-3 font-mono text-xs text-muted">{s.id.slice(0, 8)}...</td>
                  <td className="px-4 py-3 text-ink">{s.projectName}</td>
                  <td className="px-4 py-3 text-muted">{s.speakerName || s.speakerId}</td>
                  <td className="max-w-xs px-4 py-3 text-muted">
                    <p className="line-clamp-2">{s.promptText || "-"}</p>
                    {s.audioUrl && (
                      <div className="mt-2 min-w-56">
                        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                        <audio controls src={s.audioUrl} className="w-full rounded-xl" />
                      </div>
                    )}
                    {s.qaStatus === "rejected" && s.qaNote && (
                      <p className="mt-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800">
                        {s.qaNote}
                      </p>
                    )}
                    {s.qaStatus !== "approved" && (
                      <input
                        className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                        placeholder="Rejection reason (optional)..."
                        value={noteInput[s.id] ?? (s.qaNote || "")}
                        onChange={(e) => setNoteInput((n) => ({ ...n, [s.id]: e.target.value }))}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">{formatDuration(s.duration)}</td>
                  <td className="px-4 py-3"><StatusBadge status={s.qaStatus} /></td>
                  <td className="px-4 py-3 text-muted">{s.assignedQAEmail || "-"}</td>
                  <td className="px-4 py-3 text-muted">{s.qaScore != null ? `${s.qaScore}/5` : "-"}</td>
                  <td className="px-4 py-3 text-muted">{formatDate(s.createdAt)}</td>
                  <td className="px-4 py-3">
                    {s.qaStatus !== "approved" ? (
                      <div className="flex flex-col gap-2">
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void handleQAAction(s, "approved")}
                          className="whitespace-nowrap rounded-full bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                        >
                          {updating === s.id ? "..." : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={updating === s.id}
                          onClick={() => void handleQAAction(s, "rejected")}
                          className="whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                        >
                          {updating === s.id ? "..." : "Reject"}
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700">Approved</span>
                    )}
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

type DeliveryKind =
  | "full"
  | "metadata-json"
  | "metadata-csv"
  | "transcription-json"
  | "qa-csv"
  | "delivery-csv"
  | "itn-json";

function DeliverySection({ activeUser: _user }: { activeUser: User }) {
  const [projects, setProjects] = useState<DCProject[]>([]);
  const [sessions, setSessions] = useState<DCSession[]>([]);
  const [speakers, setSpeakers] = useState<DCSpeaker[]>([]);
  const [deliveryKind, setDeliveryKind] = useState<DeliveryKind>("full");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u1 = subscribeToDCProjects((p) => { setProjects(p); setLoading(false); });
    const u2 = subscribeToDCSessions(setSessions);
    const u3 = subscribeToDCSpeakers(setSpeakers);
    return () => { u1(); u2(); u3(); };
  }, []);

  const deliveryOptions: { key: DeliveryKind; label: string; description: string }[] = [
    { key: "full", label: "Full package", description: "All project metadata, transcripts, QA report, tracking, and ITN files." },
    { key: "metadata-json", label: "Metadata JSON", description: "Structured session and speaker metadata." },
    { key: "metadata-csv", label: "Metadata CSV", description: "Spreadsheet-ready metadata export." },
    { key: "transcription-json", label: "Transcripts", description: "Completed transcript records only." },
    { key: "qa-csv", label: "QA report", description: "Approved session QA details and scores." },
    { key: "delivery-csv", label: "Delivery tracker", description: "Compact client delivery tracking sheet." },
    { key: "itn-json", label: "ITN JSON", description: "Transcript records prepared for ITN workflows." },
  ];

  const speakerMap = new Map<string, DCSpeaker>();
  speakers.forEach((speaker) => {
    [speaker.id, speaker.speakerId, speaker.email, speaker.name].filter(Boolean).forEach((key) => {
      speakerMap.set(key, speaker);
    });
  });

  function slugify(value: string) {
    return (value || "project")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";
  }

  function downloadProjectDelivery(project: DCProject, approvedSessions: DCSession[]) {
    const baseName = slugify(project.name);
    const files: { filename: string; content: string; mime: string }[] = [];

    if (deliveryKind === "full" || deliveryKind === "metadata-json") {
      files.push({
        filename: `${baseName}-metadata.json`,
        content: generateMetadataJSON(approvedSessions, speakerMap),
        mime: "application/json",
      });
    }
    if (deliveryKind === "full" || deliveryKind === "metadata-csv") {
      files.push({
        filename: `${baseName}-metadata.csv`,
        content: generateMetadataCSV(approvedSessions, speakerMap),
        mime: "text/csv",
      });
    }
    if (deliveryKind === "full" || deliveryKind === "transcription-json") {
      files.push({
        filename: `${baseName}-transcriptions.json`,
        content: generateTranscriptionJSON(approvedSessions, speakerMap),
        mime: "application/json",
      });
    }
    if (deliveryKind === "full" || deliveryKind === "qa-csv") {
      files.push({
        filename: `${baseName}-qa-report.csv`,
        content: generateQAReportCSV(approvedSessions, speakerMap),
        mime: "text/csv",
      });
    }
    if (deliveryKind === "full" || deliveryKind === "delivery-csv") {
      files.push({
        filename: `${baseName}-delivery-tracker.csv`,
        content: generateDeliveryCSV(approvedSessions),
        mime: "text/csv",
      });
    }
    if (deliveryKind === "full" || deliveryKind === "itn-json") {
      files.push({
        filename: `${baseName}-itn.json`,
        content: generateITNJSON(approvedSessions, speakerMap),
        mime: "application/json",
      });
    }

    files.forEach((file) => downloadBlob(file.filename, file.content, file.mime));
  }

  return (
    <div className="space-y-6">
      <SectionHeader title="Delivery" description="Choose an export type and deliver approved project sessions." />

      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-4">
        {deliveryOptions.map((option) => {
          const selected = deliveryKind === option.key;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => setDeliveryKind(option.key)}
              className={`rounded-xl border p-4 text-left transition ${
                selected
                  ? "border-primary bg-primary/5 shadow-sm"
                  : "border-slate-200 bg-white hover:border-primary/40 hover:bg-panelStrong/40"
              }`}
            >
              <span className={`text-sm font-semibold ${selected ? "text-primary" : "text-ink"}`}>{option.label}</span>
              <span className="mt-1 block text-xs leading-5 text-muted">{option.description}</span>
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <span className="h-6 w-6 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
        </div>
      ) : projects.length === 0 ? (
        <EmptyState message="No projects to deliver yet." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Project", "Approved", "In QA", "Transcribed", "Ready Hours", "Delivery", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {projects.map((project) => {
                const projectSessions = sessions.filter((s) => s.projectId === project.id);
                const approvedSessions = projectSessions.filter((s) => s.qaStatus === "approved");
                const pendingSessions = projectSessions.filter((s) => s.qaStatus === "pending" || s.qaStatus === "in-review");
                const transcribedSessions = approvedSessions.filter((s) => s.transcriptionStatus === "completed" || Boolean(s.transcriptText));
                const approvedHours = approvedSessions.reduce((sum, s) => sum + s.duration / 3600, 0);
                const selectedDelivery = deliveryOptions.find((option) => option.key === deliveryKind);

                return (
                  <tr key={project.id} className="hover:bg-panelStrong/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{project.name}</p>
                      <p className="text-xs text-muted">{[project.client, project.dialect].filter(Boolean).join(" Â· ") || "No client set"}</p>
                    </td>
                    <td className="px-4 py-3 text-muted">{approvedSessions.length}</td>
                    <td className="px-4 py-3 text-muted">{pendingSessions.length}</td>
                    <td className="px-4 py-3 text-muted">{transcribedSessions.length}</td>
                    <td className="px-4 py-3 text-muted">{approvedHours.toFixed(2)}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold text-primary">
                        {selectedDelivery?.label ?? "Delivery"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        disabled={approvedSessions.length === 0}
                        onClick={() => downloadProjectDelivery(project, approvedSessions)}
                        className="rounded-lg px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Download
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );

}

// â”€â”€â”€ Main export â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function DataCollectionAdminPanel({ activeUser, activeSection, isSuperAdmin }: DataCollectionAdminPanelProps) {
  return (
    <div>
      {activeSection === "projects" && <ProjectsSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "speakers" && <SpeakersSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "sessions" && <SessionsSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "transcription" && <TranscriptionSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "qa-review" && <QAReviewSection activeUser={activeUser} isSuperAdmin={isSuperAdmin} />}
      {activeSection === "delivery" && (isSuperAdmin ? <DeliverySection activeUser={activeUser} /> : <EmptyState message="Delivery is only available to super admins." />)}
    </div>
  );
}
