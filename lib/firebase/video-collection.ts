import type { User } from "firebase/auth";
import {
  addDoc,
  collection,
  collectionGroup,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { normalizeEmail } from "@/lib/auth/access-control";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { saveClientApproval } from "@/lib/firebase/client-access";

export interface VideoScheduleSlot {
  id: string;       // "2026-06-09-9AM"
  date: string;     // "YYYY-MM-DD"
  time: string;     // "9AM" | "11AM" | "1PM"
  dayLabel: string; // "Monday, Jun 9"
  label: string;    // "Monday, Jun 9 · 9AM EDT"
}

function buildVideoScheduleSlots(): VideoScheduleSlot[] {
  const slots: VideoScheduleSlot[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i <= 18; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-");
    const dayLabel = new Intl.DateTimeFormat("en-US", {
      weekday: "long", month: "short", day: "numeric",
    }).format(d);
    for (const time of ["9AM", "11AM", "1PM"] as const) {
      slots.push({ id: `${dateStr}-${time}`, date: dateStr, time, dayLabel, label: `${dayLabel} · ${time} EDT` });
    }
  }
  return slots;
}

export interface VideoCompany {
  id: string;
  name: string;
  servicePermissions: string[];
  managers: Array<{ name: string; email: string }>;
  managerEmails: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VideoProject {
  id: string;
  title: string;
  jobDescription: string;
  companyId: string;
  companyName: string;
  assignedAdminEmails: string[];
  assignedAdminUids: string[];
  status: "active" | "paused" | "completed";
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface VideoProjectParticipant {
  id: string;
  projectId: string;
  uid: string;
  email: string;
  fullName: string;
  source: "admin" | "super";
  addedByEmail: string;
  addedByUid: string;
  selectedSlotIds: string[];
  schedulingNotes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type VideoMeetingClientStatus =
  | "under_review"
  | "meeting_booked"
  | "session_approved"
  | "session_rejected"
  | "no_show_up";

export interface VideoMeeting {
  id: string;
  projectId: string;
  slotId: string;
  date: string;
  time: string;
  participantAUid: string;
  participantBUid: string;
  participantAName: string;
  participantBName: string;
  meetingUrl: string;
  notes: string;
  clientStatus: VideoMeetingClientStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const VIDEO_SCHEDULE_SLOTS = buildVideoScheduleSlots();

function db() {
  return getFirebaseClientServices().firestore;
}

function companiesCollection() {
  return collection(db(), "videoCompanies");
}

function projectsCollection() {
  return collection(db(), "videoProjects");
}

function participantsCollection(projectId: string) {
  return collection(db(), "videoProjects", projectId, "participants");
}

function participantRef(projectId: string, uid: string) {
  return doc(db(), "videoProjects", projectId, "participants", uid);
}

function meetingsCollection(projectId: string) {
  return collection(db(), "videoProjects", projectId, "meetings");
}

function meetingRef(projectId: string, meetingId: string) {
  return doc(db(), "videoProjects", projectId, "meetings", meetingId);
}

function mapCompany(data: DocumentData, id: string): VideoCompany {
  return {
    id,
    name: String(data.name ?? ""),
    servicePermissions: Array.isArray(data.servicePermissions)
      ? data.servicePermissions.map(String).filter(Boolean)
      : [],
    managers: Array.isArray(data.managers)
      ? data.managers.map((manager) => ({
          name: String(manager?.name ?? ""),
          email: normalizeEmail(String(manager?.email ?? "")),
        })).filter((manager) => manager.email)
      : [],
    managerEmails: Array.isArray(data.managerEmails)
      ? data.managerEmails.map((email) => normalizeEmail(String(email))).filter(Boolean)
      : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapProject(data: DocumentData, id: string): VideoProject {
  return {
    id,
    title: String(data.title ?? ""),
    jobDescription: String(data.jobDescription ?? ""),
    companyId: String(data.companyId ?? ""),
    companyName: String(data.companyName ?? ""),
    assignedAdminEmails: Array.isArray(data.assignedAdminEmails)
      ? data.assignedAdminEmails.map((email) => normalizeEmail(String(email))).filter(Boolean)
      : [],
    assignedAdminUids: Array.isArray(data.assignedAdminUids)
      ? data.assignedAdminUids.map(String).filter(Boolean)
      : [],
    status:
      data.status === "paused" || data.status === "completed"
        ? data.status
        : "active",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapParticipant(data: DocumentData, id: string): VideoProjectParticipant {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    uid: String(data.uid ?? id),
    email: normalizeEmail(String(data.email ?? "")),
    fullName: String(data.fullName ?? ""),
    source: data.source === "super" ? "super" : "admin",
    addedByEmail: normalizeEmail(String(data.addedByEmail ?? "")),
    addedByUid: String(data.addedByUid ?? ""),
    selectedSlotIds: Array.isArray(data.selectedSlotIds)
      ? data.selectedSlotIds.map(String).filter(Boolean)
      : [],
    schedulingNotes: String(data.schedulingNotes ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

const VALID_CLIENT_STATUSES: VideoMeetingClientStatus[] = [
  "meeting_booked", "session_approved", "session_rejected", "no_show_up",
];

function mapMeeting(data: DocumentData, id: string): VideoMeeting {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    slotId: String(data.slotId ?? ""),
    date: String(data.date ?? ""),
    time: String(data.time ?? ""),
    participantAUid: String(data.participantAUid ?? ""),
    participantBUid: String(data.participantBUid ?? ""),
    participantAName: String(data.participantAName ?? ""),
    participantBName: String(data.participantBName ?? ""),
    meetingUrl: String(data.meetingUrl ?? ""),
    notes: String(data.notes ?? ""),
    clientStatus: VALID_CLIENT_STATUSES.includes(data.clientStatus)
      ? (data.clientStatus as VideoMeetingClientStatus)
      : "under_review",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function formatVideoScheduleDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(year, month - 1, day));
}

export function getVideoSlot(slotId: string) {
  return VIDEO_SCHEDULE_SLOTS.find((slot) => slot.id === slotId) ?? null;
}

export function subscribeToVideoCompanies(
  callback: (companies: VideoCompany[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(companiesCollection(), orderBy("name", "asc")),
    (snapshot) => callback(snapshot.docs.map((document) => mapCompany(document.data(), document.id))),
    onError,
  );
}

export function subscribeToVideoProject(
  projectId: string,
  callback: (project: VideoProject | null) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    doc(db(), "videoProjects", projectId),
    (snapshot) => callback(snapshot.exists() ? mapProject(snapshot.data(), snapshot.id) : null),
    onError,
  );
}

export function subscribeToVideoProjects(
  callback: (projects: VideoProject[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(projectsCollection(), orderBy("updatedAt", "desc")),
    (snapshot) => callback(snapshot.docs.map((document) => mapProject(document.data(), document.id))),
    onError,
  );
}

export function subscribeToAdminVideoProjects(
  adminEmail: string | null | undefined,
  callback: (projects: VideoProject[]) => void,
  onError?: (error: Error) => void,
) {
  const email = normalizeEmail(adminEmail);

  if (!email) {
    callback([]);
    return () => undefined;
  }

  return onSnapshot(
    query(projectsCollection(), where("assignedAdminEmails", "array-contains", email)),
    (snapshot) => {
      const projects = snapshot.docs
        .map((document) => mapProject(document.data(), document.id))
        .sort((a, b) => {
          const aTime = (a.updatedAt as { seconds?: number })?.seconds ?? 0;
          const bTime = (b.updatedAt as { seconds?: number })?.seconds ?? 0;
          return bTime - aTime;
        });
      callback(projects);
    },
    onError,
  );
}

export function subscribeToClientVideoProjects(
  clientEmail: string | null | undefined,
  callback: (projects: VideoProject[]) => void,
  onError?: (error: Error) => void,
  clientCompanyName?: string | null,
) {
  const companyName = (clientCompanyName ?? "").trim();

  if (!companyName) {
    callback([]);
    return () => undefined;
  }

  // Query videoProjects directly by companyName — this is set when the project is
  // created from the DC form and always matches clientAccess.company
  return onSnapshot(
    query(projectsCollection(), where("companyName", "==", companyName)),
    (snapshot) => callback(snapshot.docs.map((d) => mapProject(d.data(), d.id))),
    onError,
  );
}

export function subscribeToVideoProjectParticipants(
  projectId: string,
  callback: (participants: VideoProjectParticipant[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(participantsCollection(projectId), orderBy("updatedAt", "desc")),
    (snapshot) => callback(snapshot.docs.map((document) => mapParticipant(document.data(), document.id))),
    onError,
  );
}

export function subscribeToMyVideoAssignments(
  uid: string,
  email: string | null | undefined,
  callback: (assignments: Array<{ project: VideoProject; participant: VideoProjectParticipant }>) => void,
  onError?: (error: Error) => void,
) {
  const normalizedEmail = normalizeEmail(email);
  const assignmentMap = new Map<string, { project: VideoProject; participant: VideoProjectParticipant }>();

  async function publishFromDocuments(documents: Array<{ id: string; data: () => DocumentData; ref: { parent: { parent: { id: string } | null } } }>) {
    await Promise.all(
      documents.map(async (document) => {
        const projectId = document.ref.parent.parent?.id;

        if (!projectId) {
          return;
        }

        const projectSnapshot = await getDoc(doc(db(), "videoProjects", projectId));

        if (!projectSnapshot.exists()) {
          assignmentMap.delete(`${projectId}:${document.id}`);
          return;
        }

        assignmentMap.set(`${projectId}:${document.id}`, {
          project: mapProject(projectSnapshot.data(), projectSnapshot.id),
          participant: mapParticipant(document.data(), document.id),
        });
      }),
    );

    callback(Array.from(assignmentMap.values()));
  }

  const unsubscribeUid = onSnapshot(
    query(collectionGroup(db(), "participants"), where("uid", "==", uid)),
    (snapshot) => {
      void publishFromDocuments(snapshot.docs).catch((error) => onError?.(error));
    },
    onError,
  );

  const unsubscribeEmail = normalizedEmail
    ? onSnapshot(
        query(collectionGroup(db(), "participants"), where("email", "==", normalizedEmail)),
        (snapshot) => {
          void publishFromDocuments(snapshot.docs).catch((error) => onError?.(error));
        },
        onError,
      )
    : () => undefined;

  return () => {
    unsubscribeUid();
    unsubscribeEmail();
  };
}

export function subscribeToVideoMeetings(
  projectId: string,
  callback: (meetings: VideoMeeting[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    query(meetingsCollection(projectId), orderBy("updatedAt", "desc")),
    (snapshot) => callback(snapshot.docs.map((document) => mapMeeting(document.data(), document.id))),
    onError,
  );
}

export async function saveVideoCompany(input: { name: string; managerEmails: string }) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Company name is required.");
  }

  const managerEmails = input.managerEmails
    .split(/[\n,]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  await addDoc(companiesCollection(), {
    name,
    servicePermissions: [],
    managers: [],
    managerEmails,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createClientCompany(input: {
  name: string;
  servicePermissions: string[];
}) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Company name is required.");
  }

  await addDoc(companiesCollection(), {
    name,
    servicePermissions: input.servicePermissions,
    managers: [],
    managerEmails: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateClientCompany(input: {
  companyId: string;
  name: string;
  servicePermissions: string[];
  managers: Array<{ name: string; email: string }>;
  actor: User;
}) {
  const name = input.name.trim();

  if (!name) {
    throw new Error("Company name is required.");
  }

  const managers = input.managers
    .map((manager) => ({
      name: manager.name.trim(),
      email: normalizeEmail(manager.email),
    }))
    .filter((manager) => manager.email);

  await updateDoc(doc(db(), "videoCompanies", input.companyId), {
    name,
    servicePermissions: input.servicePermissions,
    managers,
    managerEmails: managers.map((manager) => manager.email),
    updatedAt: serverTimestamp(),
  });

  await Promise.all(
    managers.map((manager) =>
      saveClientApproval(input.actor, {
        email: manager.email,
        company: name,
        contactName: manager.name,
        notes: `Client manager for ${name}`,
      }),
    ),
  );
}

export async function deleteClientCompany(companyId: string) {
  await deleteDoc(doc(db(), "videoCompanies", companyId));
}

export async function saveVideoProject(input: {
  title: string;
  jobDescription: string;
  company: VideoCompany | null;
  assignedAdminEmails: string;
}) {
  if (!input.title.trim()) {
    throw new Error("Project title is required.");
  }

  if (!input.company) {
    throw new Error("Assign a client company first.");
  }

  const assignedAdminEmails = input.assignedAdminEmails
    .split(/[\n,]+/)
    .map((email) => normalizeEmail(email))
    .filter(Boolean);

  await addDoc(projectsCollection(), {
    title: input.title.trim(),
    jobDescription: input.jobDescription.trim(),
    companyId: input.company.id,
    companyName: input.company.name,
    assignedAdminEmails,
    assignedAdminUids: [],
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function mirrorVideoProjectFromDataCollection(input: {
  projectId: string;
  title: string;
  jobDescription: string;
  companyName: string;
}) {
  const companyName = input.companyName.trim();
  const companySnapshot = companyName
    ? await getDocs(query(companiesCollection(), where("name", "==", companyName)))
    : null;
  const company = companySnapshot?.docs[0]
    ? mapCompany(companySnapshot.docs[0].data(), companySnapshot.docs[0].id)
    : null;

  await setDoc(
    doc(db(), "videoProjects", input.projectId),
    {
      title: input.title.trim(),
      jobDescription: input.jobDescription.trim(),
      companyId: company?.id ?? "",
      companyName: company?.name ?? companyName,
      assignedAdminEmails: [],
      assignedAdminUids: [],
      status: "active",
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function addVideoProjectParticipant(input: {
  project: VideoProject;
  uid: string;
  email: string;
  fullName: string;
  actor: User;
  source: "admin" | "super";
}) {
  const uid = input.uid.trim();
  const email = normalizeEmail(input.email);

  if (!uid && !email) {
    throw new Error("Add a participant UID or email.");
  }

  const id = uid || email;

  await setDoc(
    participantRef(input.project.id, id),
    {
      projectId: input.project.id,
      uid,
      email,
      fullName: input.fullName.trim(),
      source: input.source,
      selectedSlotIds: [],
      schedulingNotes: "",
      addedByUid: input.actor.uid,
      addedByEmail: normalizeEmail(input.actor.email),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function saveMyVideoAvailability(input: {
  projectId: string;
  participantId: string;
  uid: string;
  fullName: string;
  email: string;
  selectedSlotIds: string[];
  schedulingNotes: string;
}) {
  const selectedSlotIds = Array.from(new Set(input.selectedSlotIds)).filter(Boolean);

  await updateDoc(participantRef(input.projectId, input.participantId), {
    uid: input.uid,
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    selectedSlotIds,
    schedulingNotes: input.schedulingNotes.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function saveVideoMeeting(input: {
  projectId: string;
  slotId: string;
  participantA: VideoProjectParticipant;
  participantB: VideoProjectParticipant;
  meetingUrl: string;
  notes: string;
}) {
  if (input.participantA.id === input.participantB.id) {
    throw new Error("Choose two different participants.");
  }

  const slot = getVideoSlot(input.slotId);

  if (!slot) {
    throw new Error("Choose a valid meeting slot.");
  }

  await addDoc(meetingsCollection(input.projectId), {
    projectId: input.projectId,
    slotId: slot.id,
    date: slot.date,
    time: slot.time,
    participantAUid: input.participantA.uid || input.participantA.id,
    participantBUid: input.participantB.uid || input.participantB.id,
    participantAName: input.participantA.fullName || input.participantA.email,
    participantBName: input.participantB.fullName || input.participantB.email,
    meetingUrl: input.meetingUrl.trim(),
    notes: input.notes.trim(),
    clientStatus: "under_review",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateVideoMeetingUrl(
  projectId: string,
  meetingId: string,
  meetingUrl: string,
) {
  const url = meetingUrl.trim();
  const update: Record<string, unknown> = { meetingUrl: url, updatedAt: serverTimestamp() };
  if (url) update.clientStatus = "meeting_booked";
  await updateDoc(meetingRef(projectId, meetingId), update);
}

export async function updateVideoMeetingClientStatus(
  projectId: string,
  meetingId: string,
  clientStatus: VideoMeetingClientStatus,
) {
  await updateDoc(meetingRef(projectId, meetingId), {
    clientStatus,
    updatedAt: serverTimestamp(),
  });
}

export async function createVideoMeetingFromSlot(input: {
  projectId: string;
  slotId: string;
  participantA: VideoProjectParticipant;
  participantB: VideoProjectParticipant;
  meetingUrl: string;
}) {
  const slot = getVideoSlot(input.slotId);
  const parts = input.slotId.split("-");
  const slotDate = parts.slice(0, 3).join("-");
  const slotTime = parts[3] ?? "";
  await addDoc(meetingsCollection(input.projectId), {
    projectId: input.projectId,
    slotId: input.slotId,
    date: slot?.date ?? slotDate,
    time: slot?.time ?? slotTime,
    participantAUid: input.participantA.uid || input.participantA.id,
    participantBUid: input.participantB.uid || input.participantB.id,
    participantAName: input.participantA.fullName || input.participantA.email,
    participantBName: input.participantB.fullName || input.participantB.email,
    meetingUrl: input.meetingUrl.trim(),
    notes: "",
    clientStatus: input.meetingUrl.trim() ? "meeting_booked" : "under_review",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function createVideoCompany(name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Company name is required.");
  await addDoc(companiesCollection(), {
    name: trimmed,
    servicePermissions: [],
    managers: [],
    managerEmails: [],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateVideoCompanyPeople(input: {
  companyId: string;
  name: string;
  people: Array<{ name: string; email: string }>;
  actor: User;
}) {
  const name = input.name.trim();
  if (!name) throw new Error("Company name is required.");
  const people = input.people
    .map((p) => ({ name: p.name.trim(), email: normalizeEmail(p.email) }))
    .filter((p) => p.email);
  await updateDoc(doc(db(), "videoCompanies", input.companyId), {
    name,
    managers: people,
    managerEmails: people.map((p) => p.email),
    updatedAt: serverTimestamp(),
  });
  await Promise.all(
    people.map((person) =>
      saveClientApproval(input.actor, {
        email: person.email,
        company: name,
        contactName: person.name,
        notes: `Video collection client for ${name}`,
      }),
    ),
  );
}

export async function updateVideoProjectCompany(input: {
  projectId: string;
  companyId: string;
  companyName: string;
}) {
  await updateDoc(doc(db(), "videoProjects", input.projectId), {
    companyId: input.companyId,
    companyName: input.companyName,
    updatedAt: serverTimestamp(),
  });
}

export async function updateVideoProjectAdmins(input: {
  projectId: string;
  adminEmails: string[];
}) {
  await updateDoc(doc(db(), "videoProjects", input.projectId), {
    assignedAdminEmails: input.adminEmails,
    updatedAt: serverTimestamp(),
  });
}

export async function addCompanyPeopleToProject(input: {
  project: VideoProject;
  company: VideoCompany;
  actor: User;
}) {
  const people = input.company.managers.filter((p) => p.email);
  if (people.length === 0) throw new Error("This company has no people to add.");
  await Promise.all(
    people.map((person) =>
      addVideoProjectParticipant({
        project: input.project,
        uid: "",
        email: person.email,
        fullName: person.name,
        actor: input.actor,
        source: "super",
      }),
    ),
  );
}

export async function updateVideoParticipantInfo(input: {
  projectId: string;
  participantId: string;
  fullName: string;
  email: string;
  uid: string;
}) {
  await updateDoc(participantRef(input.projectId, input.participantId), {
    fullName: input.fullName.trim(),
    email: normalizeEmail(input.email),
    uid: input.uid.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function removeVideoParticipant(projectId: string, participantId: string) {
  await deleteDoc(participantRef(projectId, participantId));
}
