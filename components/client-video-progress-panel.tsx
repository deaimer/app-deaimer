"use client";

import { useEffect, useMemo, useState } from "react";
import {
  VideoMeeting,
  VideoProject,
  VideoProjectParticipant,
  getVideoSlot,
  subscribeToClientVideoProjects,
  subscribeToVideoMeetings,
  subscribeToVideoProjectParticipants,
  updateVideoMeetingUrl,
} from "@/lib/firebase/video-collection";

function ProjectProgressCard({
  project,
}: {
  project: VideoProject;
}) {
  const [participants, setParticipants] = useState<VideoProjectParticipant[]>([]);
  const [meetings, setMeetings] = useState<VideoMeeting[]>([]);
  const [urlDrafts, setUrlDrafts] = useState<Record<string, string>>({});
  const [savingUrlId, setSavingUrlId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeParticipants = subscribeToVideoProjectParticipants(
      project.id,
      setParticipants,
      (nextError) => setError(nextError.message),
    );
    const unsubscribeMeetings = subscribeToVideoMeetings(
      project.id,
      (records) => {
        setMeetings(records);
        setUrlDrafts((current) => {
          const next = { ...current };
          records.forEach((meeting) => {
            if (!(meeting.id in next)) next[meeting.id] = meeting.meetingUrl;
          });
          return next;
        });
      },
      (nextError) => setError(nextError.message),
    );

    return () => {
      unsubscribeParticipants();
      unsubscribeMeetings();
    };
  }, [project.id]);

  const submitted = participants.filter((participant) => participant.selectedSlotIds.length > 0);
  const meetingUids = new Set<string>();
  meetings.forEach((meeting) => {
    meetingUids.add(meeting.participantAUid);
    meetingUids.add(meeting.participantBUid);
  });
  const oneParticipantWaiting = submitted.filter(
    (participant) => !meetingUids.has(participant.uid) && !meetingUids.has(participant.id),
  ).length;

  async function handleUrlSave(meeting: VideoMeeting) {
    setSavingUrlId(meeting.id);
    setError(null);

    try {
      await updateVideoMeetingUrl(project.id, meeting.id, urlDrafts[meeting.id] ?? "");
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not update meeting URL.");
    } finally {
      setSavingUrlId(null);
    }
  }

  return (
    <article className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted">{project.companyName}</p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{project.title}</h2>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
            {project.jobDescription || "Video collection project."}
          </p>
        </div>
        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
          {project.status}
        </span>
      </div>

      {error ? (
        <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 md:grid-cols-4">
        {[
          ["Total sign-ups", participants.length],
          ["Submitted availability", submitted.length],
          ["Filled meetings", meetings.length],
          ["One waiting", oneParticipantWaiting],
        ].map(([label, value]) => (
          <div key={label} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
            <p className="text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-ink">{String(value).padStart(2, "0")}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-ink">Participant sign-ups</h3>
          <div className="mt-3 space-y-2">
            {participants.length === 0 ? (
              <p className="text-sm text-muted">No participants added yet.</p>
            ) : (
              participants.slice(0, 8).map((participant) => (
                <div key={participant.id} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-3">
                  <p className="text-sm font-semibold text-ink">{participant.fullName || participant.email || participant.uid}</p>
                  <p className="mt-1 text-xs text-muted">
                    {participant.selectedSlotIds.length > 0
                      ? `${participant.selectedSlotIds.length} slots submitted`
                      : "Waiting for availability"}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-ink">Filled meetings</h3>
          <div className="mt-3 space-y-2">
            {meetings.length === 0 ? (
              <p className="text-sm text-muted">No filled meetings yet.</p>
            ) : (
              meetings.slice(0, 8).map((meeting) => (
                <div key={meeting.id} className="rounded-[1rem] border border-slate-200 bg-panelStrong p-3">
                  <p className="text-sm font-semibold text-ink">
                    {getVideoSlot(meeting.slotId)?.label ?? `${meeting.date} ${meeting.time}`}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {meeting.participantAName} + {meeting.participantBName}
                  </p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      value={urlDrafts[meeting.id] ?? ""}
                      onChange={(event) =>
                        setUrlDrafts((current) => ({
                          ...current,
                          [meeting.id]: event.target.value,
                        }))
                      }
                      placeholder="Meeting URL"
                      className="min-w-0 flex-1 rounded-[0.85rem] border border-slate-300 bg-white px-3 py-2 text-xs outline-none focus:border-primary"
                    />
                    <button
                      type="button"
                      onClick={() => void handleUrlSave(meeting)}
                      disabled={savingUrlId === meeting.id}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-ink disabled:opacity-60"
                    >
                      {savingUrlId === meeting.id ? "Saving" : "Save URL"}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function ClientVideoProgressPanel({ clientEmail }: { clientEmail: string | null | undefined }) {
  const [projects, setProjects] = useState<VideoProject[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToClientVideoProjects(
      clientEmail,
      setProjects,
      (nextError) => setError(nextError.message),
    );
  }, [clientEmail]);

  const activeProjects = useMemo(
    () => projects.filter((project) => project.status === "active"),
    [projects],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">
          Client projects
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Video collection progress</h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-muted">
          Track participant sign-ups, submitted availability, and filled two-person meetings
          for your company projects.
        </p>
      </section>

      {error ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {error}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        {[
          ["Company projects", projects.length],
          ["Active projects", activeProjects.length],
          ["Placeholder tabs", 4],
        ].map(([label, value]) => (
          <article key={label} className="rounded-[1.25rem] border border-slate-200 bg-white p-5">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">{label}</p>
            <p className="mt-3 text-3xl font-semibold text-ink">{String(value).padStart(2, "0")}</p>
          </article>
        ))}
      </section>

      {projects.length === 0 ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 text-sm leading-7 text-muted">
          No video collection projects are connected to this client email yet.
        </section>
      ) : (
        projects.map((project) => <ProjectProgressCard key={project.id} project={project} />)
      )}
    </div>
  );
}
