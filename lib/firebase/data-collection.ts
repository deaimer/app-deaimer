import {
  addDoc,
  collection,
  doc,
  getDoc,
  increment,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type DCProjectStatus = "active" | "paused" | "completed" | "archived";
export type DCTranscriptionStatus = "pending" | "asr-processing" | "asr-done" | "human-review" | "completed";
export type DCQAStatus = "pending" | "in-review" | "approved" | "rejected";
export type DCSpeakerStatus = "pending" | "active" | "suspended";

export interface DCLanguageEntry {
  languages: string[];
  countries: string[];
}

export interface DCPrompt {
  text: string;
  maxSeconds: number;
}

export interface DCTaskTemplate {
  id: string;
  title: string;
  guidelinesHtml: string;
  policy: string;
  prompts: DCPrompt[];
  minDurationSeconds: number;
  maxDurationSeconds: number;
  scenario: string;
  speakersRequired: number;
}

export interface DCProject {
  id: string;
  name: string;
  client: string;
  // Legacy plain-text description (kept for backward compat)
  description: string;
  // Extended fields
  summary: string;
  projectType: string;
  appsSupported: string[];
  languages: DCLanguageEntry[];
  jobType: string;
  isConversational: boolean;
  recordingMode: "utterance" | "conversational";
  // Volume & job config
  targetHours: number;
  estimatedJobs: number;
  maxQuotaHours: number;
  maxQuotaMinutes: number;
  maxQuotaSeconds: number;
  maxJobsPerTasker: number;
  totalAssetsPerJob: number;
  tatReworkHours: number;
  tatReworkMins: number;
  // Rich content
  descriptionHtml: string;
  guidelinesHtml: string;
  submissionPolicyHtml: string;
  // Tasks
  tasks: DCTaskTemplate[];
  // Legacy fields
  dialect: string;
  domainSplit: string;
  hoursCompleted: number;
  minDuration: number;
  maxDuration: number;
  deadline: string;
  audioFormat: { format: string; bitDepth: string; sampleRate: string };
  transcriptionRequired: boolean;
  qaRequired: boolean;
  status: DCProjectStatus;
  participantCount: number;
  promptText: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export type DCProjectInput = Omit<DCProject, "id" | "hoursCompleted" | "participantCount" | "createdAt" | "updatedAt">;

export interface DCSpeaker {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  age: string;
  country: string;
  region: string;
  languages: string[];
  phoneCountryCode: string;
  phone: string;
  gender: string;
  dialect: string;
  secondaryDialect: string;
  bio: string;
  status: DCSpeakerStatus;
  totalHours: number;
  projectsCount: number;
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DCAssignment {
  id: string;
  projectId: string;
  projectName: string;
  projectDialect: string;
  projectDomain: string;
  projectDescription: string;
  promptText: string;
  speakerId: string;
  speakerEmail: string;
  speakerName: string;
  hoursTarget: number;
  hoursCompleted: number;
  sessionsCount: number;
  deadline: string;
  status: "active" | "completed" | "paused";
  assignedAt?: unknown;
}

export interface DCSession {
  id: string;
  projectId: string;
  projectName: string;
  speakerId: string;
  speakerName: string;
  assignmentId: string;
  audioUrl: string;
  filePath: string;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  gender: string;
  age: string;
  dialect: string;
  region: string;
  transcriptionStatus: DCTranscriptionStatus;
  transcriptText: string;
  werScore: number | null;
  qaStatus: DCQAStatus;
  qaReviewerEmail: string;
  qaScore: number | null;
  qaNote: string;
  flags: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DCSessionInput {
  projectId: string;
  projectName: string;
  speakerId: string;
  speakerName: string;
  assignmentId: string;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  gender: string;
  age: string;
  dialect: string;
  region: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapTask(t: unknown): DCTaskTemplate {
  const d = (t ?? {}) as Record<string, unknown>;
  return {
    id: String(d.id ?? `task-${Math.random().toString(36).slice(2)}`),
    title: String(d.title ?? ""),
    guidelinesHtml: String(d.guidelinesHtml ?? ""),
    policy: String(d.policy ?? ""),
    prompts: Array.isArray(d.prompts)
      ? d.prompts.map((p: unknown) =>
          typeof p === "string"
            ? { text: p, maxSeconds: 30 }
            : {
                text: String((p as { text?: unknown }).text ?? ""),
                maxSeconds: Number((p as { maxSeconds?: unknown }).maxSeconds ?? 30),
              },
        )
      : [],
    minDurationSeconds: Number(d.minDurationSeconds ?? 30),
    maxDurationSeconds: Number(d.maxDurationSeconds ?? 300),
    scenario: String(d.scenario ?? ""),
    speakersRequired: Number(d.speakersRequired ?? 2),
  };
}

function mapProject(data: DocumentData, id: string): DCProject {
  return {
    id,
    name: String(data.name ?? ""),
    client: String(data.client ?? ""),
    description: String(data.description ?? ""),
    summary: String(data.summary ?? data.description ?? ""),
    projectType: String(data.projectType ?? "Data Collection: Audio"),
    appsSupported: Array.isArray(data.appsSupported) ? data.appsSupported.map(String) : [],
    languages: Array.isArray(data.languages)
      ? data.languages.map((l: unknown) => {
          const lObj = (l ?? {}) as Record<string, unknown>;
          // Support new {languages[], countries[]} and legacy {language, region} formats
          return {
            languages: Array.isArray(lObj.languages)
              ? lObj.languages.map(String)
              : lObj.language ? [String(lObj.language)] : [],
            countries: Array.isArray(lObj.countries)
              ? lObj.countries.map(String)
              : lObj.region ? [String(lObj.region)] : [],
          };
        })
      : [],
    jobType: String(data.jobType ?? ""),
    isConversational: Boolean(data.isConversational ?? false),
    recordingMode: (data.recordingMode === "conversational" || Boolean(data.isConversational))
      ? "conversational"
      : "utterance",
    estimatedJobs: Number(data.estimatedJobs ?? 0),
    maxQuotaHours: Number(data.maxQuotaHours ?? 0),
    maxQuotaMinutes: Number(data.maxQuotaMinutes ?? 0),
    maxQuotaSeconds: Number(data.maxQuotaSeconds ?? 0),
    maxJobsPerTasker: Number(data.maxJobsPerTasker ?? 1),
    totalAssetsPerJob: Number(data.totalAssetsPerJob ?? 0),
    tatReworkHours: Number(data.tatReworkHours ?? 72),
    tatReworkMins: Number(data.tatReworkMins ?? 0),
    descriptionHtml: String(data.descriptionHtml ?? ""),
    guidelinesHtml: String(data.guidelinesHtml ?? ""),
    submissionPolicyHtml: String(data.submissionPolicyHtml ?? ""),
    tasks: Array.isArray(data.tasks) ? data.tasks.map(mapTask) : [],
    dialect: String(data.dialect ?? ""),
    domainSplit: String(data.domainSplit ?? ""),
    targetHours: Number(data.targetHours ?? 0),
    hoursCompleted: Number(data.hoursCompleted ?? 0),
    minDuration: Number(data.minDuration ?? 60),
    maxDuration: Number(data.maxDuration ?? 300),
    deadline: String(data.deadline ?? ""),
    audioFormat: {
      format: String(data.audioFormat?.format ?? "WAV"),
      bitDepth: String(data.audioFormat?.bitDepth ?? "16-bit PCM"),
      sampleRate: String(data.audioFormat?.sampleRate ?? "44.1kHz"),
    },
    transcriptionRequired: Boolean(data.transcriptionRequired ?? true),
    qaRequired: Boolean(data.qaRequired ?? true),
    status: (["active", "paused", "completed", "archived"].includes(data.status)
      ? data.status
      : "active") as DCProjectStatus,
    participantCount: Number(data.participantCount ?? 0),
    promptText: String(data.promptText ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function calcSpeakerAge(dob: string): number {
  if (!dob) return 0;
  const today = new Date();
  const birth = new Date(dob + "T00:00:00");
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function mapSpeaker(data: DocumentData, id: string): DCSpeaker {
  const firstName = String(data.firstName ?? "");
  const lastName = String(data.lastName ?? "");
  const legacyName = String(data.name ?? "");
  const name = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : legacyName;
  const dateOfBirth = String(data.dateOfBirth ?? "");
  return {
    id,
    email: String(data.email ?? id),
    firstName,
    lastName,
    name,
    dateOfBirth,
    age: dateOfBirth ? String(calcSpeakerAge(dateOfBirth)) : String(data.age ?? ""),
    country: String(data.country ?? ""),
    region: String(data.region ?? ""),
    languages: Array.isArray(data.languages)
      ? (data.languages as unknown[]).map(String).filter(Boolean)
      : data.language
        ? [String(data.language)]
        : [],
    phoneCountryCode: String(data.phoneCountryCode ?? ""),
    phone: String(data.phone ?? ""),
    gender: String(data.gender ?? ""),
    dialect: String(data.dialect ?? ""),
    secondaryDialect: String(data.secondaryDialect ?? ""),
    bio: String(data.bio ?? ""),
    status: (["pending", "active", "suspended"].includes(data.status)
      ? data.status
      : "pending") as DCSpeakerStatus,
    totalHours: Number(data.totalHours ?? 0),
    projectsCount: Number(data.projectsCount ?? 0),
    invitedByEmail: String(data.invitedByEmail ?? ""),
    invitedByUid: String(data.invitedByUid ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapAssignment(data: DocumentData, id: string): DCAssignment {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    projectName: String(data.projectName ?? ""),
    projectDialect: String(data.projectDialect ?? ""),
    projectDomain: String(data.projectDomain ?? ""),
    projectDescription: String(data.projectDescription ?? ""),
    promptText: String(data.promptText ?? ""),
    speakerId: String(data.speakerId ?? ""),
    speakerEmail: String(data.speakerEmail ?? ""),
    speakerName: String(data.speakerName ?? ""),
    hoursTarget: Number(data.hoursTarget ?? 0),
    hoursCompleted: Number(data.hoursCompleted ?? 0),
    sessionsCount: Number(data.sessionsCount ?? 0),
    deadline: String(data.deadline ?? ""),
    status: (["active", "completed", "paused"].includes(data.status)
      ? data.status
      : "active") as DCAssignment["status"],
    assignedAt: data.assignedAt,
  };
}

function mapSession(data: DocumentData, id: string): DCSession {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    projectName: String(data.projectName ?? ""),
    speakerId: String(data.speakerId ?? ""),
    speakerName: String(data.speakerName ?? ""),
    assignmentId: String(data.assignmentId ?? ""),
    audioUrl: String(data.audioUrl ?? ""),
    filePath: String(data.filePath ?? ""),
    duration: Number(data.duration ?? 0),
    sampleRate: Number(data.sampleRate ?? 44100),
    bitDepth: Number(data.bitDepth ?? 16),
    gender: String(data.gender ?? ""),
    age: String(data.age ?? ""),
    dialect: String(data.dialect ?? ""),
    region: String(data.region ?? ""),
    transcriptionStatus: (["pending", "asr-processing", "asr-done", "human-review", "completed"].includes(data.transcriptionStatus)
      ? data.transcriptionStatus
      : "pending") as DCTranscriptionStatus,
    transcriptText: String(data.transcriptText ?? ""),
    werScore: data.werScore != null ? Number(data.werScore) : null,
    qaStatus: (["pending", "in-review", "approved", "rejected"].includes(data.qaStatus)
      ? data.qaStatus
      : "pending") as DCQAStatus,
    qaReviewerEmail: String(data.qaReviewerEmail ?? ""),
    qaScore: data.qaScore != null ? Number(data.qaScore) : null,
    qaNote: String(data.qaNote ?? ""),
    flags: Array.isArray(data.flags) ? data.flags.map(String) : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function db() {
  return getFirebaseClientServices().firestore;
}


// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createDCProject(input: DCProjectInput): Promise<string> {
  const ref = await addDoc(collection(db(), "dcProjects"), {
    ...input,
    hoursCompleted: 0,
    participantCount: 0,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateDCProject(
  id: string,
  updates: Partial<DCProjectInput & { status: DCProjectStatus }>,
) {
  await updateDoc(doc(db(), "dcProjects", id), { ...updates, updatedAt: serverTimestamp() });
}

export function subscribeToDCProjects(
  callback: (projects: DCProject[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db(), "dcProjects"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapProject(d.data(), d.id))), onError);
}

export function subscribeToDCProject(id: string, callback: (p: DCProject | null) => void) {
  return onSnapshot(doc(db(), "dcProjects", id), (snap) =>
    callback(snap.exists() ? mapProject(snap.data(), snap.id) : null),
  );
}

// ─── Speakers ─────────────────────────────────────────────────────────────────

export async function inviteDCSpeaker(
  email: string,
  name: string,
  inviterEmail: string,
  inviterUid: string,
) {
  const normalizedEmail = email.trim().toLowerCase();
  await setDoc(
    doc(db(), "speakerAccess", normalizedEmail),
    {
      email: normalizedEmail,
      name: name.trim(),
      age: "", gender: "", dialect: "", secondaryDialect: "",
      region: "", country: "", phone: "", bio: "",
      status: "pending",
      totalHours: 0,
      projectsCount: 0,
      invitedByEmail: inviterEmail,
      invitedByUid: inviterUid,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToDCSpeakers(
  callback: (speakers: DCSpeaker[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db(), "speakerAccess"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSpeaker(d.data(), d.id))), onError);
}

export async function getDCSpeakerByEmail(email: string): Promise<DCSpeaker | null> {
  const snap = await getDoc(doc(db(), "speakerAccess", email.trim().toLowerCase()));
  return snap.exists() ? mapSpeaker(snap.data(), snap.id) : null;
}

export function subscribeToDCSpeakerByEmail(
  email: string,
  callback: (s: DCSpeaker | null) => void,
) {
  return onSnapshot(doc(db(), "speakerAccess", email.trim().toLowerCase()), (snap) =>
    callback(snap.exists() ? mapSpeaker(snap.data(), snap.id) : null),
  );
}

export async function updateDCSpeakerStatus(email: string, status: DCSpeakerStatus) {
  await updateDoc(doc(db(), "speakerAccess", email.trim().toLowerCase()), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export async function updateDCSpeakerProfile(
  email: string,
  updates: Partial<Omit<DCSpeaker, "id" | "email" | "invitedByEmail" | "invitedByUid" | "createdAt" | "totalHours" | "projectsCount">>,
) {
  await setDoc(doc(db(), "speakerAccess", email.trim().toLowerCase()), {
    ...updates,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function inviteAndAssignSpeaker(
  project: DCProject,
  speakerEmail: string,
  speakerName: string,
  hoursTarget: number,
  adminEmail: string,
  adminUid: string,
): Promise<string> {
  const normalizedEmail = speakerEmail.trim().toLowerCase();

  // Create or update the speakerAccess record (merge so existing profiles aren't overwritten)
  await setDoc(
    doc(db(), "speakerAccess", normalizedEmail),
    {
      email: normalizedEmail,
      ...(speakerName.trim() ? { name: speakerName.trim() } : {}),
      status: "active",
      invitedByEmail: adminEmail,
      invitedByUid: adminUid,
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );

  // Get the speaker record (now guaranteed to exist)
  const snap = await getDoc(doc(db(), "speakerAccess", normalizedEmail));
  const speaker = mapSpeaker(snap.data()!, normalizedEmail);

  return createDCAssignment(project, speaker, hoursTarget, adminEmail, adminUid);
}

export async function createDCAssignment(
  project: DCProject,
  speaker: DCSpeaker,
  hoursTarget: number,
  inviterEmail: string,
  inviterUid: string,
): Promise<string> {
  const docRef = await addDoc(collection(db(), "dcAssignments"), {
    projectId: project.id,
    projectName: project.name,
    projectDialect: project.dialect,
    projectDomain: project.domainSplit,
    projectDescription: project.description,
    promptText: project.promptText,
    speakerId: speaker.email,
    speakerEmail: speaker.email,
    speakerName: speaker.name,
    hoursTarget,
    hoursCompleted: 0,
    sessionsCount: 0,
    deadline: project.deadline,
    status: "active",
    assignedAt: serverTimestamp(),
    assignedByEmail: inviterEmail,
    assignedByUid: inviterUid,
  });

  await updateDoc(doc(db(), "speakerAccess", speaker.email), {
    projectsCount: increment(1),
    status: "active",
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db(), "dcProjects", project.id), {
    participantCount: increment(1),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export function subscribeToDCAssignmentsByProject(
  projectId: string,
  callback: (assignments: DCAssignment[]) => void,
) {
  const q = query(
    collection(db(), "dcAssignments"),
    where("projectId", "==", projectId),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapAssignment(d.data(), d.id))));
}

export function subscribeToDCAssignmentsBySpeaker(
  speakerEmail: string,
  callback: (assignments: DCAssignment[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "dcAssignments"),
    where("speakerEmail", "==", speakerEmail.trim().toLowerCase()),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapAssignment(d.data(), d.id))), onError);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

export async function submitDCSession(input: DCSessionInput): Promise<string> {
  const { auth } = getFirebaseClientServices();
  // Force refresh=true so mobile sessions with stale tokens don't fail
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Not authenticated — please sign out and sign back in.");

  const timestamp = Date.now();
  const ext = input.mimeType.includes("mp4") ? "mp4" : "webm";
  const filename = `dc-audio/${input.projectId}/${input.speakerId}/${timestamp}.${ext}`;

  // 1. Get a short-lived presigned PUT URL from our API route
  const presignRes = await fetch("/api/dc-audio/presign", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${idToken}`,
    },
    body: JSON.stringify({ key: filename, contentType: input.mimeType }),
  });
  if (!presignRes.ok) throw new Error("Could not get upload URL");
  const { presignedUrl, publicUrl: audioUrl } = await presignRes.json() as {
    presignedUrl: string;
    publicUrl: string;
  };

  // 2. Upload the blob directly from the browser to R2 — no server roundtrip
  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    body: input.audioBlob,
    headers: { "Content-Type": input.mimeType },
  });
  if (!uploadRes.ok) throw new Error("Audio upload failed");

  const docRef = await addDoc(collection(db(), "dcSessions"), {
    projectId: input.projectId,
    projectName: input.projectName,
    speakerId: input.speakerId,
    speakerName: input.speakerName,
    assignmentId: input.assignmentId,
    audioUrl,
    filePath: filename,
    duration: input.duration,
    sampleRate: input.sampleRate,
    bitDepth: input.bitDepth,
    gender: input.gender,
    age: input.age,
    dialect: input.dialect,
    region: input.region,
    transcriptionStatus: "pending",
    transcriptText: "",
    werScore: null,
    qaStatus: "pending",
    qaReviewerEmail: "",
    qaScore: null,
    qaNote: "",
    flags: [],
    createdAt: serverTimestamp(),
  });

  const durationHours = input.duration / 3600;

  await updateDoc(doc(db(), "dcAssignments", input.assignmentId), {
    hoursCompleted: increment(durationHours),
    sessionsCount: increment(1),
  });

  await updateDoc(doc(db(), "dcProjects", input.projectId), {
    hoursCompleted: increment(durationHours),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db(), "speakerAccess", input.speakerId), {
    totalHours: increment(durationHours),
    updatedAt: serverTimestamp(),
  });

  return docRef.id;
}

export function subscribeToDCSessions(
  callback: (sessions: DCSession[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db(), "dcSessions"), orderBy("createdAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSession(d.data(), d.id))), onError);
}

export function subscribeToDCSessionsByProject(
  projectId: string,
  callback: (sessions: DCSession[]) => void,
) {
  const q = query(
    collection(db(), "dcSessions"),
    where("projectId", "==", projectId),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSession(d.data(), d.id))));
}

export function subscribeToDCSessionsBySpeaker(
  speakerEmail: string,
  callback: (sessions: DCSession[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "dcSessions"),
    where("speakerId", "==", speakerEmail.trim().toLowerCase()),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSession(d.data(), d.id))), onError);
}

export async function updateDCSessionQA(
  sessionId: string,
  status: DCQAStatus,
  reviewerEmail: string,
  score?: number,
  note?: string,
) {
  await updateDoc(doc(db(), "dcSessions", sessionId), {
    qaStatus: status,
    qaReviewerEmail: reviewerEmail,
    ...(score != null ? { qaScore: score } : {}),
    ...(note != null ? { qaNote: note } : {}),
    updatedAt: serverTimestamp(),
  });
}

export async function updateDCSessionTranscription(
  sessionId: string,
  status: DCTranscriptionStatus,
  text?: string,
  wer?: number,
) {
  await updateDoc(doc(db(), "dcSessions", sessionId), {
    transcriptionStatus: status,
    ...(text != null ? { transcriptText: text } : {}),
    ...(wer != null ? { werScore: wer } : {}),
    updatedAt: serverTimestamp(),
  });
}
