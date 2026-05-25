"use client";

import { FormEvent, useEffect, useState } from "react";
import type { User } from "firebase/auth";
import {
  subscribeToDCProjects,
  type DCProject,
} from "@/lib/firebase/data-collection";
import { subscribeToAdminApproval, type AdminApprovalRecord } from "@/lib/firebase/admin-access";
import {
  saveOpsWorker,
  subscribeToOpsWorkers,
  subscribeToOpsWorkersByAdminEmail,
  updateOpsWorkerStatus,
  type OpsRole,
  type OpsWorker,
} from "@/lib/firebase/ops-data";

export type EvalTranscriptionSection = "transcription-workers" | "qa-workers";

// ─── Shared UI ────────────────────────────────────────────────────────────────

const inputCls =
  "w-full rounded-[1rem] border border-slate-200 bg-white px-4 py-2.5 text-sm text-ink outline-none transition placeholder:text-muted/40 focus:border-primary focus:ring-1 focus:ring-primary/20";
const btnPrimary =
  "inline-flex items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50 transition";
const btnSecondary =
  "inline-flex items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-ink hover:bg-panelStrong disabled:opacity-50 transition";

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    active: "border-emerald-200 bg-emerald-50 text-emerald-800",
    paused: "border-amber-200 bg-amber-50 text-amber-800",
    transcription: "border-blue-200 bg-blue-50 text-blue-800",
    qa: "border-purple-200 bg-purple-50 text-purple-800",
    delivery: "border-slate-200 bg-slate-50 text-slate-600",
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

function Field({ label, required, hint, children }: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
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

// ─── Workers table ────────────────────────────────────────────────────────────

function WorkersTable({
  workers,
  roleFilter,
  adminProjects,
  allProjects,
  activeUser,
  adminEmail,
  adminApproval,
}: {
  workers: OpsWorker[];
  roleFilter: OpsRole;
  adminProjects: DCProject[];
  allProjects: DCProject[];
  activeUser: User;
  adminEmail: string;
  adminApproval: AdminApprovalRecord | null;
}) {
  const [showPanel, setShowPanel] = useState(false);
  const [editTarget, setEditTarget] = useState<OpsWorker | null>(null);

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  // Admin can only assign their own assigned projects to workers
  const assignableProjects = adminApproval
    ? allProjects.filter((p) => adminApproval.assignedProjectIds.includes(p.id))
    : adminProjects;

  const filtered = workers.filter((w) => w.roles.includes(roleFilter));

  function openNew() {
    setEditTarget(null);
    setEmail(""); setName(""); setProjectIds([]);
    setFormError("");
    setShowPanel(true);
  }

  function openEdit(w: OpsWorker) {
    setEditTarget(w);
    setEmail(w.email); setName(w.name);
    // Only show projects this admin controls
    setProjectIds(w.assignedProjectIds.filter((id) =>
      assignableProjects.some((p) => p.id === id)
    ));
    setFormError("");
    setShowPanel(true);
  }

  function toggleProject(id: string) {
    setProjectIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setFormError("Email is required."); return; }
    setSaving(true);
    setFormError("");
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const existingWorker = editTarget ?? workers.find((w) => w.email === normalizedEmail);

      // Merge roles so a worker can hold both qa and transcription
      const mergedRoles: OpsRole[] = existingWorker
        ? Array.from(new Set([...existingWorker.roles, roleFilter]))
        : [roleFilter];

      // Preserve project assignments managed by other admins
      const adminProjectIds = new Set(assignableProjects.map((p) => p.id));
      const otherAdminProjects = existingWorker
        ? existingWorker.assignedProjectIds.filter((id) => !adminProjectIds.has(id))
        : [];
      const mergedProjectIds = Array.from(new Set([...otherAdminProjects, ...projectIds]));

      await saveOpsWorker(
        email,
        name,
        mergedRoles,
        mergedProjectIds,
        activeUser.email ?? "",
        activeUser.uid,
        "admin",
        adminEmail,
        !existingWorker,
      );
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

  const roleLabel = roleFilter === "transcription" ? "Transcription" : "QA";

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-ink">{roleLabel} Workers</h2>
          <p className="mt-1 text-sm text-muted">
            Invite people to handle {roleLabel.toLowerCase()} tasks on your assigned projects.
            {assignableProjects.length === 0 && (
              <span className="ml-1 text-amber-700"> No projects assigned yet — contact a super admin.</span>
            )}
          </p>
        </div>
        <button type="button" onClick={openNew} disabled={assignableProjects.length === 0} className={btnPrimary}>
          + Add Worker
        </button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message={`No ${roleLabel.toLowerCase()} workers yet.`} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                {["Name", "Email", "Projects", "Status", ""].map((h) => (
                  <th key={h} className="px-4 py-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((w) => (
                <tr key={w.email} className="group hover:bg-panelStrong/40">
                  <td className="px-4 py-3 font-medium text-ink">{w.name || "—"}</td>
                  <td className="px-4 py-3 text-muted">{w.email}</td>
                  <td className="px-4 py-3 text-muted">
                    {w.assignedProjectIds.length === 0
                      ? "—"
                      : w.assignedProjectIds
                          .map((id) => allProjects.find((p) => p.id === id)?.name ?? id)
                          .join(", ")}
                  </td>
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

      <SlidePanel title={editTarget ? `Edit ${roleLabel} Worker` : `Add ${roleLabel} Worker`} open={showPanel} onClose={() => setShowPanel(false)}>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          {formError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{formError}</div>
          )}
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
            <p className="mb-1 text-[13px] font-medium text-ink">Role</p>
            <span className="inline-flex rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold capitalize text-primary">
              {roleFilter}
            </span>
            <p className="mt-1 text-[11px] text-muted">Role is fixed to this section.</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Assign Projects</p>
            {assignableProjects.length === 0 ? (
              <p className="text-xs text-amber-700">No projects assigned to you yet.</p>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-xl border border-slate-200 bg-panelStrong p-3">
                {assignableProjects.map((p) => (
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
            )}
          </div>
          <button type="submit" disabled={saving} className={btnPrimary + " w-full"}>
            {saving ? "Saving…" : editTarget ? "Save Changes" : "Add Worker"}
          </button>
        </form>
      </SlidePanel>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface EvalTranscriptionPanelProps {
  activeUser: User;
  activeSection: EvalTranscriptionSection;
  isSuperAdmin: boolean;
}

export function EvalTranscriptionPanel({ activeUser, activeSection, isSuperAdmin }: EvalTranscriptionPanelProps) {
  const adminEmail = activeUser.email ?? "";
  const [workers, setWorkers] = useState<OpsWorker[]>([]);
  const [allProjects, setAllProjects] = useState<DCProject[]>([]);
  const [adminApproval, setAdminApproval] = useState<AdminApprovalRecord | null>(null);

  useEffect(() => {
    return subscribeToDCProjects(setAllProjects);
  }, []);

  useEffect(() => {
    if (isSuperAdmin) return;
    return subscribeToAdminApproval(adminEmail, setAdminApproval);
  }, [adminEmail, isSuperAdmin]);

  useEffect(() => {
    if (isSuperAdmin) {
      return subscribeToOpsWorkers(setWorkers);
    }
    return subscribeToOpsWorkersByAdminEmail(adminEmail, setWorkers);
  }, [adminEmail, isSuperAdmin]);

  // For super admin: all projects are assignable
  const adminProjects = isSuperAdmin
    ? allProjects
    : allProjects.filter((p) => (adminApproval?.assignedProjectIds ?? []).includes(p.id));

  const roleFilter: OpsRole = activeSection === "transcription-workers" ? "transcription" : "qa";

  return (
    <WorkersTable
      workers={workers}
      roleFilter={roleFilter}
      adminProjects={adminProjects}
      allProjects={allProjects}
      activeUser={activeUser}
      adminEmail={adminEmail}
      adminApproval={adminApproval}
    />
  );
}
