"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { normalizeEmail } from "@/lib/auth/access-control";
import {
  VIDEO_SCHEDULE_SLOTS,
  VideoCompany,
  VideoMeeting,
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
                      <p className="text-sm font-semibold text-ink">{getVideoSlot(meeting.slotId)?.label ?? `${meeting.date} ${meeting.time}`}</p>
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
