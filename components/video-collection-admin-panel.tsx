"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { User } from "firebase/auth";
import { normalizeEmail } from "@/lib/auth/access-control";
import {
  VIDEO_SCHEDULE_SLOTS,
  VideoCompany,
  VideoMeeting,
  VideoMeetingClientStatus,
  VideoProject,
  VideoProjectParticipant,
  addCompanyPeopleToProject,
  addVideoProjectParticipant,
  getVideoSlot,
  removeVideoParticipant,
  saveVideoMeeting,
  subscribeToAdminVideoProjects,
  subscribeToVideoCompanies,
  subscribeToVideoMeetings,
  subscribeToVideoProject,
  subscribeToVideoProjectParticipants,
  subscribeToVideoProjects,
  updateVideoMeetingUrl,
  updateVideoParticipantInfo,
  updateVideoProjectAdmins,
  updateVideoProjectCompany,
} from "@/lib/firebase/video-collection";

// ─── Shared sub-components ────────────────────────────────────────────────────

function StatusBanner({ message, error }: { message: string | null; error: string | null }) {
  return (
    <>
      {error ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
      {message ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}
    </>
  );
}

const inputCls = "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary";

function SlidePanel({ title, open, onClose, children }: { title: string; open: boolean; onClose: () => void; children: React.ReactNode }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button type="button" className="absolute inset-0 bg-black/30" onClick={onClose} aria-label="Close" />
      <aside className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h3 className="font-semibold text-ink">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-slate-100 hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 px-6 py-5">{children}</div>
      </aside>
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return <p className="py-6 text-center text-sm text-muted">{message}</p>;
}

// ─── Participant row ──────────────────────────────────────────────────────────

function ParticipantRow({
  participant,
  isEditable,
  isSuperAdmin,
  onDelete,
}: {
  participant: VideoProjectParticipant;
  isEditable: boolean;
  isSuperAdmin: boolean;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ fullName: participant.fullName, email: participant.email, uid: participant.uid });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      await updateVideoParticipantInfo({
        projectId: participant.projectId,
        participantId: participant.id,
        fullName: draft.fullName,
        email: draft.email,
        uid: draft.uid,
      });
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  }

  if (editing) {
    return (
      <form onSubmit={handleSave} className="rounded-[1rem] border border-primary/30 bg-primary/5 p-4 space-y-3">
        {error ? <p className="text-xs text-rose-700">{error}</p> : null}
        <div className="grid gap-3 sm:grid-cols-3">
          <input value={draft.fullName} onChange={(e) => setDraft((c) => ({ ...c, fullName: e.target.value }))} placeholder="Name" className={inputCls} />
          <input type="email" value={draft.email} onChange={(e) => setDraft((c) => ({ ...c, email: e.target.value }))} placeholder="Email" className={inputCls} />
          <input value={draft.uid} onChange={(e) => setDraft((c) => ({ ...c, uid: e.target.value }))} placeholder="UID (optional)" className={inputCls} />
        </div>
        <div className="flex gap-2">
          <button type="submit" disabled={isSaving} className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
            {isSaving ? "Saving..." : "Save"}
          </button>
          <button type="button" onClick={() => setEditing(false)} className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-ink">
            Cancel
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-ink">{participant.fullName || participant.email || participant.uid || "Unnamed"}</p>
        <p className="mt-0.5 text-xs text-muted">
          {participant.email || participant.uid}
          {participant.selectedSlotIds.length > 0 ? ` · ${participant.selectedSlotIds.length} slots` : " · No availability yet"}
          {!isEditable ? <span className="ml-2 text-muted/60">(view only)</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        {isEditable ? (
          <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink hover:bg-panelStrong">
            Edit
          </button>
        ) : null}
        {(isEditable || isSuperAdmin) && onDelete ? (
          <button type="button" onClick={onDelete} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50">
            Remove
          </button>
        ) : null}
      </div>
    </div>
  );
}

// ─── Super admin panel ────────────────────────────────────────────────────────

function SuperVideoPanel({ activeUser }: { activeUser: User }) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [companies, setCompanies] = useState<VideoCompany[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [participantDraft, setParticipantDraft] = useState({ uid: "", email: "", fullName: "" });
  const [meetingDraft, setMeetingDraft] = useState({ slotId: "", participantAId: "", participantBId: "", meetingUrl: "", notes: "" });
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { return subscribeToVideoProjects(setProjects, (e) => setError(e.message)); }, []);
  useEffect(() => { return subscribeToVideoCompanies(setCompanies, (e) => setError(e.message)); }, []);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) { setParticipants([]); setMeetings([]); return; }
    const unsub1 = subscribeToVideoProjectParticipants(selectedProjectId, setParticipants, (e) => setError(e.message));
    const unsub2 = subscribeToVideoMeetings(selectedProjectId, (records) => {
      setMeetings(records);
      setUrlDrafts((cur) => {
        const next = { ...cur };
        records.forEach((m) => { if (!(m.id in next)) next[m.id] = m.meetingUrl; });
        return next;
      });
    }, (e) => setError(e.message));
    return () => { unsub1(); unsub2(); };
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const selectedCompany = companies.find((c) => c.id === selectedProject?.companyId) ?? null;
  const submittedParticipants = participants.filter((p) => p.selectedSlotIds.length > 0);
  const slotParticipants = useMemo(
    () => participants.filter((p) => meetingDraft.slotId ? p.selectedSlotIds.includes(meetingDraft.slotId) : p.selectedSlotIds.length > 0),
    [meetingDraft.slotId, participants],
  );

  async function handleAssignCompany(companyId: string) {
    if (!selectedProject) return;
    const company = companies.find((c) => c.id === companyId);
    setError(null); setMessage(null);
    try {
      await updateVideoProjectCompany({ projectId: selectedProject.id, companyId, companyName: company?.name ?? "" });
      setMessage("Company assigned.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not assign company."); }
  }

  async function handleAddCompanyPeople() {
    if (!selectedProject || !selectedCompany) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await addCompanyPeopleToProject({ project: selectedProject, company: selectedCompany, actor: activeUser });
      setMessage(`Added ${selectedCompany.managers.length} people from ${selectedCompany.name}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add company people."); }
    finally { setIsSaving(false); }
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject || !adminEmailInput.trim()) return;
    const email = normalizeEmail(adminEmailInput);
    if (!email) return;
    const current = selectedProject.assignedAdminEmails ?? [];
    if (current.includes(email)) { setError("Admin already assigned."); return; }
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await updateVideoProjectAdmins({ projectId: selectedProject.id, adminEmails: [...current, email] });
      setAdminEmailInput("");
      setMessage(`${email} assigned as admin.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not assign admin."); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveAdmin(email: string) {
    if (!selectedProject) return;
    const current = selectedProject.assignedAdminEmails ?? [];
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await updateVideoProjectAdmins({ projectId: selectedProject.id, adminEmails: current.filter((e) => e !== email) });
      setMessage(`${email} removed.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove admin."); }
    finally { setIsSaving(false); }
  }

  async function handleAddParticipant(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await addVideoProjectParticipant({ project: selectedProject, uid: participantDraft.uid, email: participantDraft.email, fullName: participantDraft.fullName, actor: activeUser, source: "super" });
      setParticipantDraft({ uid: "", email: "", fullName: "" });
      setMessage("Participant added.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add participant."); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveParticipant(participantId: string) {
    if (!selectedProjectId) return;
    setError(null); setMessage(null);
    try { await removeVideoParticipant(selectedProjectId, participantId); setMessage("Participant removed."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove."); }
  }

  async function handleFillMeeting(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      const pA = participants.find((p) => p.id === meetingDraft.participantAId);
      const pB = participants.find((p) => p.id === meetingDraft.participantBId);
      if (!pA || !pB) throw new Error("Choose both participants.");
      await saveVideoMeeting({ projectId: selectedProject.id, slotId: meetingDraft.slotId, participantA: pA, participantB: pB, meetingUrl: meetingDraft.meetingUrl, notes: meetingDraft.notes });
      setMeetingDraft({ slotId: "", participantAId: "", participantBId: "", meetingUrl: "", notes: "" });
      setMessage("Meeting saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save meeting."); }
    finally { setIsSaving(false); }
  }

  async function handleUrlSave(meeting: VideoMeeting) {
    setSavingUrlId(meeting.id); setError(null); setMessage(null);
    try { await updateVideoMeetingUrl(meeting.projectId, meeting.id, urlDrafts[meeting.id] ?? ""); setMessage("URL updated."); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not update URL."); }
    finally { setSavingUrlId(null); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">Video collection</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Video project scheduling</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">Assign clients and admins, add participants from the /participants platform, and schedule two-person meetings.</p>
      </section>

      <StatusBanner message={message} error={error} />

      <section className="grid gap-4 md:grid-cols-4">
        {[["Projects", projects.length], ["Participants", participants.length], ["Submitted", submittedParticipants.length], ["Meetings", meetings.length]].map(([label, value]) => (
          <article key={label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{String(value).padStart(2, "0")}</p>
          </article>
        ))}
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        {/* Project list */}
        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Projects</h2>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? <p className="text-sm text-muted">No video projects yet.</p> : projects.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)}
                className={["w-full rounded-[1rem] border px-3 py-2.5 text-left text-sm transition", selectedProjectId === project.id ? "border-primary bg-primary/5 text-ink" : "border-slate-200 bg-panelStrong text-muted hover:bg-white"].join(" ")}>
                <span className="block font-semibold">{project.title}</span>
                <span className="mt-0.5 block text-xs">{project.companyName || "No company"}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Project detail */}
        {selectedProject ? (
          <div className="space-y-5">
            {/* Company & Admins */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Client company</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <select
                    value={selectedProject.companyId || ""}
                    onChange={(e) => void handleAssignCompany(e.target.value)}
                    className="rounded-[1rem] border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary"
                  >
                    <option value="">No company</option>
                    {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {selectedCompany && selectedCompany.managers.length > 0 ? (
                    <button type="button" onClick={() => void handleAddCompanyPeople()} disabled={isSaving}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60 hover:bg-panelStrong">
                      Add {selectedCompany.managers.length} company people
                    </button>
                  ) : null}
                </div>
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Assigned admins</p>
                <div className="mt-2 space-y-1.5">
                  {(selectedProject.assignedAdminEmails ?? []).length === 0 ? (
                    <p className="text-xs text-muted">No admins assigned.</p>
                  ) : (
                    (selectedProject.assignedAdminEmails ?? []).map((email) => (
                      <div key={email} className="flex items-center justify-between gap-3 rounded-[0.85rem] border border-slate-200 bg-panelStrong px-3 py-2">
                        <span className="text-xs text-ink">{email}</span>
                        <button type="button" onClick={() => void handleRemoveAdmin(email)} className="text-xs font-semibold text-rose-600 hover:underline">Remove</button>
                      </div>
                    ))
                  )}
                </div>
                <form onSubmit={handleAddAdmin} className="mt-2 flex gap-2">
                  <input type="email" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)} placeholder="admin@deaimer.com" className="flex-1 rounded-[1rem] border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button type="submit" disabled={isSaving || !adminEmailInput.trim()} className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white disabled:opacity-60">Add</button>
                </form>
              </div>
            </div>

            {/* Add participant */}
            <form onSubmit={handleAddParticipant} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
              <p className="text-sm font-semibold text-ink">Add participant</p>
              <p className="text-xs text-muted">Enter the participant&apos;s email or UID from the /participants platform.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={participantDraft.fullName} onChange={(e) => setParticipantDraft((c) => ({ ...c, fullName: e.target.value }))} placeholder="Name" className={inputCls} />
                <input type="email" value={participantDraft.email} onChange={(e) => setParticipantDraft((c) => ({ ...c, email: e.target.value }))} placeholder="Email" className={inputCls} />
                <input value={participantDraft.uid} onChange={(e) => setParticipantDraft((c) => ({ ...c, uid: e.target.value }))} placeholder="UID (optional)" className={inputCls} />
              </div>
              <button type="submit" disabled={isSaving || (!participantDraft.email && !participantDraft.uid)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? "Adding..." : "Add participant"}
              </button>
            </form>

            {/* Participants list */}
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-ink">Participants ({participants.length})</p>
              <div className="mt-3 space-y-2">
                {participants.length === 0 ? <p className="text-sm text-muted">No participants yet.</p> : participants.map((p) => (
                  <ParticipantRow key={p.id} participant={p} isEditable isSuperAdmin onDelete={() => void handleRemoveParticipant(p.id)} />
                ))}
              </div>
            </div>

            {/* Fill meeting */}
            <form onSubmit={handleFillMeeting} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
              <p className="text-sm font-semibold text-ink">Fill a meeting</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <select value={meetingDraft.slotId} onChange={(e) => setMeetingDraft((c) => ({ ...c, slotId: e.target.value, participantAId: "", participantBId: "" }))} className={inputCls}>
                  <option value="">Select slot</option>
                  {VIDEO_SCHEDULE_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
                <input type="url" value={meetingDraft.meetingUrl} onChange={(e) => setMeetingDraft((c) => ({ ...c, meetingUrl: e.target.value }))} placeholder="Meeting URL" className={inputCls} />
                <select value={meetingDraft.participantAId} onChange={(e) => setMeetingDraft((c) => ({ ...c, participantAId: e.target.value }))} className={inputCls}>
                  <option value="">Participant 1</option>
                  {slotParticipants.map((p) => <option key={p.id} value={p.id}>{p.fullName || p.email}</option>)}
                </select>
                <select value={meetingDraft.participantBId} onChange={(e) => setMeetingDraft((c) => ({ ...c, participantBId: e.target.value }))} className={inputCls}>
                  <option value="">Participant 2</option>
                  {slotParticipants.filter((p) => p.id !== meetingDraft.participantAId).map((p) => <option key={p.id} value={p.id}>{p.fullName || p.email}</option>)}
                </select>
                <textarea value={meetingDraft.notes} onChange={(e) => setMeetingDraft((c) => ({ ...c, notes: e.target.value }))} rows={2} placeholder="Notes" className="sm:col-span-2 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary" />
              </div>
              <button type="submit" disabled={isSaving || !meetingDraft.slotId || !meetingDraft.participantAId || !meetingDraft.participantBId} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? "Saving..." : "Save meeting"}
              </button>
            </form>

            {/* Meetings list */}
            {meetings.length > 0 ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-ink">Meetings ({meetings.length})</p>
                <div className="mt-3 space-y-3">
                  {meetings.map((meeting) => (
                    <div key={meeting.id} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                      <p className="text-sm font-semibold text-ink">{getVideoSlot(meeting.slotId)?.label ?? meeting.date}</p>
                      <p className="mt-0.5 text-xs text-muted">{meeting.participantAName} + {meeting.participantBName}</p>
                      <div className="mt-3 flex gap-2">
                        <input value={urlDrafts[meeting.id] ?? ""} onChange={(e) => setUrlDrafts((c) => ({ ...c, [meeting.id]: e.target.value }))} placeholder="Meeting URL" className="min-w-0 flex-1 rounded-[1rem] border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-primary" />
                        <button type="button" onClick={() => void handleUrlSave(meeting)} disabled={savingUrlId === meeting.id} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60">
                          {savingUrlId === meeting.id ? "Saving..." : "Save URL"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-muted">
            Select a project to manage it.
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Admin panel ──────────────────────────────────────────────────────────────

function AdminVideoPanel({ activeUser }: { activeUser: User }) {
  const myEmail = normalizeEmail(activeUser.email);
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [participantDraft, setParticipantDraft] = useState({ uid: "", email: "", fullName: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToAdminVideoProjects(activeUser.email, setProjects, (e) => setError(e.message));
  }, [activeUser.email]);

  useEffect(() => {
    if (!selectedProjectId && projects[0]) setSelectedProjectId(projects[0].id);
  }, [projects, selectedProjectId]);

  useEffect(() => {
    if (!selectedProjectId) { setParticipants([]); return; }
    return subscribeToVideoProjectParticipants(selectedProjectId, setParticipants, (e) => setError(e.message));
  }, [selectedProjectId]);

  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;
  const myParticipants = participants.filter((p) => p.addedByEmail === myEmail);
  const otherParticipants = participants.filter((p) => p.addedByEmail !== myEmail);

  async function handleAddParticipant(e: FormEvent) {
    e.preventDefault();
    if (!selectedProject) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await addVideoProjectParticipant({ project: selectedProject, uid: participantDraft.uid, email: participantDraft.email, fullName: participantDraft.fullName, actor: activeUser, source: "admin" });
      setParticipantDraft({ uid: "", email: "", fullName: "" });
      setMessage("Participant added.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add participant."); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">Video collection</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Assigned video projects</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">Add participants from the /participants platform to your assigned projects.</p>
      </section>

      <StatusBanner message={message} error={error} />

      <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
        {/* Project list */}
        <aside className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-ink">Assigned projects</h2>
          <div className="mt-3 space-y-2">
            {projects.length === 0 ? <p className="text-sm text-muted">No projects assigned to you yet.</p> : projects.map((project) => (
              <button key={project.id} type="button" onClick={() => setSelectedProjectId(project.id)}
                className={["w-full rounded-[1rem] border px-3 py-2.5 text-left text-sm transition", selectedProjectId === project.id ? "border-primary bg-primary/5 text-ink" : "border-slate-200 bg-panelStrong text-muted hover:bg-white"].join(" ")}>
                <span className="block font-semibold">{project.title}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Project detail */}
        {selectedProject ? (
          <div className="space-y-5">
            {/* Add participant form */}
            <form onSubmit={handleAddParticipant} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
              <p className="text-sm font-semibold text-ink">Add participant</p>
              <p className="text-xs text-muted">Enter the participant&apos;s email or UID from the /participants platform.</p>
              <div className="grid gap-2 sm:grid-cols-3">
                <input value={participantDraft.fullName} onChange={(e) => setParticipantDraft((c) => ({ ...c, fullName: e.target.value }))} placeholder="Name" className={inputCls} />
                <input type="email" value={participantDraft.email} onChange={(e) => setParticipantDraft((c) => ({ ...c, email: e.target.value }))} placeholder="Email" className={inputCls} />
                <input value={participantDraft.uid} onChange={(e) => setParticipantDraft((c) => ({ ...c, uid: e.target.value }))} placeholder="UID (optional)" className={inputCls} />
              </div>
              <button type="submit" disabled={isSaving || (!participantDraft.email && !participantDraft.uid)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
                {isSaving ? "Adding..." : "Add participant"}
              </button>
            </form>

            {/* My participants (editable) */}
            {myParticipants.length > 0 ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-ink">Added by you ({myParticipants.length})</p>
                <div className="mt-3 space-y-2">
                  {myParticipants.map((p) => (
                    <ParticipantRow key={p.id} participant={p} isEditable isSuperAdmin={false} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Other participants (view only) */}
            {otherParticipants.length > 0 ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
                <p className="text-sm font-semibold text-ink">Other participants ({otherParticipants.length})</p>
                <div className="mt-3 space-y-2">
                  {otherParticipants.map((p) => (
                    <ParticipantRow key={p.id} participant={p} isEditable={false} isSuperAdmin={false} />
                  ))}
                </div>
              </div>
            ) : null}

            {participants.length === 0 ? (
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-muted">
                No participants added yet. Use the form above to add participants.
              </div>
            ) : null}
          </div>
        ) : (
          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5 text-sm text-muted">
            {projects.length === 0 ? "No video projects have been assigned to your account yet." : "Select a project to manage participants."}
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Scoped: company + admins + participants for one project (Details tab) ────

export function VideoProjectScopedDetails({
  projectId,
  activeUser,
  isSuperAdmin,
}: {
  projectId: string;
  activeUser: User;
  isSuperAdmin: boolean;
}) {
  const myEmail = normalizeEmail(activeUser.email);
  const [project, setProject] = useState<VideoProject | null>(null);
  const [companies, setCompanies] = useState<VideoCompany[]>([]);
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [showAssignAdmin, setShowAssignAdmin] = useState(false);
  const [adminEmailInput, setAdminEmailInput] = useState("");
  const [showAddParticipant, setShowAddParticipant] = useState(false);
  const [participantDraft, setParticipantDraft] = useState({ uid: "", email: "", fullName: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToVideoProject(projectId, setProject, (e) => setError(e.message)), [projectId]);
  useEffect(() => { if (isSuperAdmin) return subscribeToVideoCompanies(setCompanies, (e) => setError(e.message)); }, [isSuperAdmin]);
  useEffect(() => subscribeToVideoProjectParticipants(projectId, setParticipants, (e) => setError(e.message)), [projectId]);

  const selectedCompany = companies.find((c) => c.id === project?.companyId) ?? null;

  async function handleAssignCompany(companyId: string) {
    if (!project) return;
    const company = companies.find((c) => c.id === companyId);
    setError(null); setMessage(null);
    try {
      await updateVideoProjectCompany({ projectId: project.id, companyId, companyName: company?.name ?? "" });
    } catch (err) { setError(err instanceof Error ? err.message : "Could not assign company."); }
  }

  async function handleAddCompanyPeople() {
    if (!project || !selectedCompany) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await addCompanyPeopleToProject({ project, company: selectedCompany, actor: activeUser });
      setMessage(`Added ${selectedCompany.managers.length} people from ${selectedCompany.name}.`);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add company people."); }
    finally { setIsSaving(false); }
  }

  async function handleAddAdmin(e: FormEvent) {
    e.preventDefault();
    if (!project || !adminEmailInput.trim()) return;
    const email = normalizeEmail(adminEmailInput);
    if (!email) return;
    const current = project.assignedAdminEmails ?? [];
    if (current.includes(email)) { setError("Admin already assigned."); return; }
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await updateVideoProjectAdmins({ projectId: project.id, adminEmails: [...current, email] });
      setAdminEmailInput(""); setShowAssignAdmin(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not assign admin."); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveAdmin(email: string) {
    if (!project) return;
    const current = project.assignedAdminEmails ?? [];
    try { await updateVideoProjectAdmins({ projectId: project.id, adminEmails: current.filter((e) => e !== email) }); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not remove admin."); }
  }

  async function handleAddParticipant(e: FormEvent) {
    e.preventDefault();
    if (!project) return;
    setIsSaving(true); setError(null); setMessage(null);
    try {
      await addVideoProjectParticipant({ project, uid: participantDraft.uid, email: participantDraft.email, fullName: participantDraft.fullName, actor: activeUser, source: isSuperAdmin ? "super" : "admin" });
      setParticipantDraft({ uid: "", email: "", fullName: "" });
      setShowAddParticipant(false);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not add participant."); }
    finally { setIsSaving(false); }
  }

  async function handleRemoveParticipant(participantId: string) {
    setError(null);
    try {
      const idToken = await activeUser.getIdToken();
      const res = await fetch("/api/video/participants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ projectId, participantId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "Could not remove.");
      }
    } catch (err) { setError(err instanceof Error ? err.message : "Could not remove."); }
  }

  const assignedAdmins = project?.assignedAdminEmails ?? [];

  return (
    <div className="space-y-6">
      <StatusBanner message={message} error={error} />

      {/* Client Company (super only) */}
      {isSuperAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Client Company</h3>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <select
                value={project?.companyId ?? ""}
                onChange={(e) => void handleAssignCompany(e.target.value)}
                className="rounded-[1rem] border border-slate-200 bg-panelStrong px-3 py-2 text-sm text-ink outline-none focus:border-primary"
              >
                <option value="">— Select company —</option>
                {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {(project?.companyId || project?.companyName) && (
                <span className="text-sm font-medium text-ink">{selectedCompany?.name ?? project?.companyName}</span>
              )}
              {selectedCompany && selectedCompany.managers.length > 0 && (
                <button type="button" onClick={() => void handleAddCompanyPeople()} disabled={isSaving}
                  className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-semibold text-muted hover:bg-panelStrong disabled:opacity-60">
                  + Add {selectedCompany.managers.length} company contacts
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Assigned Admins (super only) */}
      {isSuperAdmin && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-ink">Assigned Admins ({assignedAdmins.length})</h3>
            <button
              type="button"
              onClick={() => { setShowAssignAdmin(true); setAdminEmailInput(""); setError(null); }}
              className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primaryStrong"
            >
              + Assign Admin
            </button>
          </div>
          {assignedAdmins.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-muted">No admins assigned to this project yet.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                    {["Email", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {assignedAdmins.map((email) => (
                    <tr key={email} className="group hover:bg-panelStrong/40">
                      <td className="px-4 py-3 text-ink">{email}</td>
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => void handleRemoveAdmin(email)}
                          className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 opacity-0 group-hover:opacity-100 hover:bg-rose-50">
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
            <form onSubmit={(e) => void handleAddAdmin(e)} className="space-y-4">
              <p className="text-sm text-muted">Enter the admin email to assign them to this video project.</p>
              {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>}
              <input type="email" value={adminEmailInput} onChange={(e) => setAdminEmailInput(e.target.value)}
                placeholder="admin@deaimer.com" required className={inputCls} />
              <button type="submit" disabled={isSaving || !adminEmailInput.trim()}
                className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50">
                {isSaving ? "Assigning…" : "Assign Admin"}
              </button>
            </form>
          </SlidePanel>
        </div>
      )}

      {/* Participants */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-ink">Participants ({participants.length})</h3>
          <button
            type="button"
            onClick={() => { setShowAddParticipant(true); setParticipantDraft({ uid: "", email: "", fullName: "" }); setError(null); }}
            className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primaryStrong"
          >
            + Add Participant
          </button>
        </div>
        {participants.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-muted">No participants added yet.</div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-panelStrong text-left text-[11px] uppercase tracking-widest text-muted">
                  {["Participant", "Email", "Availability", ""].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participants.map((p) => {
                  const canRemove = isSuperAdmin || p.addedByEmail === myEmail;
                  return (
                    <tr key={p.id} className="group hover:bg-panelStrong/40">
                      <td className="px-4 py-3 font-medium text-ink">{p.fullName || p.uid || "—"}</td>
                      <td className="px-4 py-3 text-muted">{p.email || "—"}</td>
                      <td className="px-4 py-3 text-muted">
                        {p.selectedSlotIds.length > 0 ? `${p.selectedSlotIds.length} slot${p.selectedSlotIds.length !== 1 ? "s" : ""}` : "No availability yet"}
                      </td>
                      <td className="px-4 py-3">
                        {canRemove && (
                          <button type="button" onClick={() => void handleRemoveParticipant(p.id)}
                            className="rounded-lg px-2.5 py-1 text-xs font-medium text-rose-700 opacity-0 group-hover:opacity-100 hover:bg-rose-50">
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <SlidePanel title="Add Participant" open={showAddParticipant} onClose={() => setShowAddParticipant(false)}>
          <form onSubmit={(e) => void handleAddParticipant(e)} className="space-y-4">
            <p className="text-sm text-muted">Enter the participant&apos;s details from the /participants platform.</p>
            {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div>}
            <div className="space-y-3">
              <input value={participantDraft.fullName} onChange={(e) => setParticipantDraft((c) => ({ ...c, fullName: e.target.value }))}
                placeholder="Full name" className={inputCls} />
              <input type="email" value={participantDraft.email} onChange={(e) => setParticipantDraft((c) => ({ ...c, email: e.target.value }))}
                placeholder="Email" className={inputCls} />
              <input value={participantDraft.uid} onChange={(e) => setParticipantDraft((c) => ({ ...c, uid: e.target.value }))}
                placeholder="UID (optional)" className={inputCls} />
            </div>
            <button type="submit" disabled={isSaving || (!participantDraft.email && !participantDraft.uid)}
              className="inline-flex w-full items-center justify-center rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primaryStrong disabled:opacity-50">
              {isSaving ? "Adding…" : "Add Participant"}
            </button>
          </form>
        </SlidePanel>
      </div>
    </div>
  );
}

// ─── Scoped: meeting scheduler for one project (Scheduling tab) ───────────────

const ADMIN_STATUS_CFG: Record<VideoMeetingClientStatus, { label: string; cls: string }> = {
  under_review:     { label: "Under Review",     cls: "border-amber-200 bg-amber-50 text-amber-800" },
  meeting_booked:   { label: "Meeting Booked",   cls: "border-blue-200 bg-blue-50 text-blue-800" },
  session_approved: { label: "Session Approved", cls: "border-emerald-200 bg-emerald-50 text-emerald-800" },
  session_rejected: { label: "Session Rejected", cls: "border-rose-200 bg-rose-50 text-rose-800" },
  no_show_up:       { label: "No Show Up",       cls: "border-slate-200 bg-slate-100 text-slate-600" },
};

export function VideoProjectScopedMeetings({
  projectId,
}: {
  projectId: string;
}) {
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [meetingDraft, setMeetingDraft] = useState({ slotId: "", participantAId: "", participantBId: "", notes: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => subscribeToVideoProjectParticipants(projectId, setParticipants, (e) => setError(e.message)), [projectId]);
  useEffect(() => subscribeToVideoMeetings(projectId, setMeetings, (e) => setError(e.message)), [projectId]);

  const slotParticipants = useMemo(
    () => participants.filter((p) => meetingDraft.slotId ? p.selectedSlotIds.includes(meetingDraft.slotId) : p.selectedSlotIds.length > 0),
    [meetingDraft.slotId, participants],
  );

  // Compute filled slots: slots where 2+ participants submitted availability
  const filledSlots = useMemo(() => {
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
  }, [participants, meetings]);

  const matchedUids = useMemo(() => {
    const s = new Set<string>();
    meetings.forEach((m) => { s.add(m.participantAUid); s.add(m.participantBUid); });
    return s;
  }, [meetings]);

  async function handleFillMeeting(e: FormEvent) {
    e.preventDefault();
    setIsSaving(true); setError(null); setMessage(null);
    try {
      const pA = participants.find((p) => p.id === meetingDraft.participantAId);
      const pB = participants.find((p) => p.id === meetingDraft.participantBId);
      if (!pA || !pB) throw new Error("Choose both participants.");
      await saveVideoMeeting({ projectId, slotId: meetingDraft.slotId, participantA: pA, participantB: pB, meetingUrl: "", notes: meetingDraft.notes });
      setMeetingDraft({ slotId: "", participantAId: "", participantBId: "", notes: "" });
      setMessage("Meeting saved.");
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save meeting."); }
    finally { setIsSaving(false); }
  }

  return (
    <div className="space-y-5">
      <StatusBanner message={message} error={error} />

      {/* Participant availability */}
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-ink">
          Participant availability
          {participants.length > 0 && (
            <span className="ml-2 rounded-full bg-panelStrong px-2 py-0.5 text-xs font-normal text-muted">
              {participants.filter((p) => p.selectedSlotIds.length > 0).length}/{participants.length} submitted
            </span>
          )}
        </p>
        {participants.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No participants added yet.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {participants.map((p) => {
              const isMatched = matchedUids.has(p.uid) || matchedUids.has(p.id);
              return (
                <div key={p.id} className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{p.fullName || p.email || p.uid || "Unnamed"}</p>
                      {p.email ? <p className="text-xs text-muted">{p.email}</p> : null}
                    </div>
                    <span className={[
                      "shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                      isMatched
                        ? "border border-blue-200 bg-blue-50 text-blue-800"
                        : p.selectedSlotIds.length > 0
                          ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                          : "border border-slate-200 bg-white text-muted",
                    ].join(" ")}>
                      {isMatched ? "Matched" : p.selectedSlotIds.length > 0 ? "Availability submitted" : "Awaiting"}
                    </span>
                  </div>
                  {p.selectedSlotIds.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {p.selectedSlotIds.map((sid) => (
                        <span key={sid} className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-muted">
                          {getVideoSlot(sid)?.label ?? sid}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Filled slots — read-only view for super admin */}
      <div className="rounded-[1.5rem] border border-slate-200 bg-white p-5">
        <p className="text-sm font-semibold text-ink">
          Confirmed sessions
          {filledSlots.length > 0 && (
            <span className="ml-2 rounded-full bg-panelStrong px-2 py-0.5 text-xs font-normal text-muted">
              {filledSlots.length}
            </span>
          )}
        </p>
        {filledSlots.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No slots filled yet — sessions appear once two participants book the same slot.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {filledSlots.map(({ slotId, pA, pB, meeting }) => {
              const slot = getVideoSlot(slotId);
              const label = slot?.label ?? slotId;
              const status: VideoMeetingClientStatus = meeting?.clientStatus ?? "under_review";
              const { label: statusLabel, cls: statusCls } = ADMIN_STATUS_CFG[status];
              return (
                <div key={slotId} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{label}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {pA.fullName || pA.email} + {pB.fullName || pB.email}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusCls}`}>
                      {statusLabel}
                    </span>
                  </div>
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
                    <p className="mt-2 text-xs text-muted">No meeting link added by client yet.</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Schedule a meeting (admin pairing) */}
      <form onSubmit={(e) => void handleFillMeeting(e)} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 space-y-3">
        <p className="text-sm font-semibold text-ink">Pair participants manually</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={meetingDraft.slotId} onChange={(e) => setMeetingDraft((c) => ({ ...c, slotId: e.target.value, participantAId: "", participantBId: "" }))} className={inputCls}>
            <option value="">Select slot</option>
            {VIDEO_SCHEDULE_SLOTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
          <select value={meetingDraft.participantAId} onChange={(e) => setMeetingDraft((c) => ({ ...c, participantAId: e.target.value }))} className={inputCls}>
            <option value="">Participant 1</option>
            {slotParticipants.map((p) => <option key={p.id} value={p.id}>{p.fullName || p.email}</option>)}
          </select>
          <select value={meetingDraft.participantBId} onChange={(e) => setMeetingDraft((c) => ({ ...c, participantBId: e.target.value }))} className={inputCls}>
            <option value="">Participant 2</option>
            {slotParticipants.filter((p) => p.id !== meetingDraft.participantAId).map((p) => <option key={p.id} value={p.id}>{p.fullName || p.email}</option>)}
          </select>
          <textarea value={meetingDraft.notes} onChange={(e) => setMeetingDraft((c) => ({ ...c, notes: e.target.value }))} rows={2} placeholder="Notes (optional)" className="sm:col-span-2 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-primary" />
        </div>
        <button type="submit" disabled={isSaving || !meetingDraft.slotId || !meetingDraft.participantAId || !meetingDraft.participantBId} className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60">
          {isSaving ? "Saving..." : "Save pairing"}
        </button>
      </form>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

export function VideoCollectionAdminPanel({
  activeUser,
  isSuperAdmin,
}: {
  activeUser: User;
  isSuperAdmin: boolean;
}) {
  return isSuperAdmin
    ? <SuperVideoPanel activeUser={activeUser} />
    : <AdminVideoPanel activeUser={activeUser} />;
}
