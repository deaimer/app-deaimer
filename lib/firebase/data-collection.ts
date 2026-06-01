import {
  addDoc,
  arrayUnion,
  collection,
  doc,
  getDoc,
  getDocs,
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
  participants48k: number;
  participants16k: number;
  participants8k: number;
  maxPromptsPerSpeaker: number;
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
  speakerId: string;
  firstName: string;
  lastName: string;
  name: string;
  dateOfBirth: string;
  age: string;
  ageGroup: string;
  country: string;
  region: string;
  languages: string[];
  phoneCountryCode: string;
  phone: string;
  gender: string;
  dialect: string;
  secondaryDialect: string;
  bio: string;
  deviceCategory: string;
  deviceManufacturer: string;
  deviceModel: string;
  educationLevel: string;
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
  submittedForReview: boolean;
  targetSampleRate: number;
  submittedAt?: unknown;
  assignedAt?: unknown;
}

export interface DCSession {
  id: string;
  projectId: string;
  projectName: string;
  speakerId: string;
  speakerName: string;
  assignmentId: string;
  taskId: string | null;
  promptIndex: number | null;
  promptText: string | null;
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
  submissionCount: number;
  assignedTranscriptorEmail: string;
  assignedQAEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface DCSessionInput {
  projectId: string;
  projectName: string;
  speakerId: string;
  speakerName: string;
  assignmentId: string;
  taskId?: string | null;
  promptIndex?: number | null;
  promptText?: string | null;
  audioBlob: Blob;
  mimeType: string;
  duration: number;
  sampleRate: number;
  bitDepth: number;
  gender: string;
  age: string;
  dialect: string;
  region: string;
  submissionCount?: number;
  assignedTranscriptorEmail?: string;
  assignedQAEmail?: string;
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
    participants48k: Number(data.participants48k ?? 0),
    participants16k: Number(data.participants16k ?? 0),
    participants8k: Number(data.participants8k ?? 0),
    maxPromptsPerSpeaker: Number(data.maxPromptsPerSpeaker ?? 0),
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

function calcAgeGroup(age: number): string {
  if (age < 25) return "18–24";
  if (age < 35) return "25–34";
  if (age < 45) return "35–44";
  if (age < 55) return "45–54";
  if (age < 65) return "55–64";
  return "65+";
}

function mapSpeaker(data: DocumentData, id: string): DCSpeaker {
  const firstName = String(data.firstName ?? "");
  const lastName = String(data.lastName ?? "");
  const legacyName = String(data.name ?? "");
  const name = (firstName || lastName) ? `${firstName} ${lastName}`.trim() : legacyName;
  const dateOfBirth = String(data.dateOfBirth ?? "");
  const age = dateOfBirth ? calcSpeakerAge(dateOfBirth) : Number(data.age ?? 0);
  return {
    id,
    email: String(data.email ?? id),
    speakerId: String(data.speakerId ?? ""),
    firstName,
    lastName,
    name,
    dateOfBirth,
    age: String(age || ""),
    ageGroup: age >= 18 ? calcAgeGroup(age) : String(data.ageGroup ?? ""),
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
    deviceCategory: String(data.deviceCategory ?? ""),
    deviceManufacturer: String(data.deviceManufacturer ?? ""),
    deviceModel: String(data.deviceModel ?? ""),
    educationLevel: String(data.educationLevel ?? ""),
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
    submittedForReview: Boolean(data.submittedForReview ?? false),
    targetSampleRate: Number(data.targetSampleRate ?? 48000),
    submittedAt: data.submittedAt,
    assignedAt: data.assignedAt,
  };
}

export async function submitAssignmentForReview(assignmentId: string): Promise<void> {
  await updateDoc(doc(db(), "dcAssignments", assignmentId), {
    submittedForReview: true,
    submittedAt: serverTimestamp(),
  });
}

function mapSession(data: DocumentData, id: string): DCSession {
  return {
    id,
    projectId: String(data.projectId ?? ""),
    projectName: String(data.projectName ?? ""),
    speakerId: String(data.speakerId ?? ""),
    speakerName: String(data.speakerName ?? ""),
    assignmentId: String(data.assignmentId ?? ""),
    taskId: data.taskId ?? null,
    promptIndex: data.promptIndex != null ? Number(data.promptIndex) : null,
    promptText: data.promptText ?? null,
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
    submissionCount: Number(data.submissionCount ?? 0),
    assignedTranscriptorEmail: String(data.assignedTranscriptorEmail ?? ""),
    assignedQAEmail: String(data.assignedQAEmail ?? ""),
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

export function subscribeToDCProjectById(
  projectId: string,
  callback: (project: DCProject | null) => void,
) {
  return onSnapshot(doc(db(), "dcProjects", projectId), (snap) =>
    callback(snap.exists() ? mapProject(snap.data(), snap.id) : null),
  );
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

export function subscribeToDCSpeakerProfileByUid(
  uid: string,
  callback: (s: DCSpeaker | null) => void,
) {
  return onSnapshot(doc(db(), "speakerProfiles", uid), (snap) =>
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
  updates: Partial<Omit<DCSpeaker, "id" | "email" | "invitedByEmail" | "invitedByUid" | "createdAt" | "totalHours" | "projectsCount">>,
) {
  const { auth } = getFirebaseClientServices();
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not signed in");

  const res = await fetch("/api/speaker/update-profile", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(json.error ?? "Profile update failed");
  }
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

  // Determine which sample-rate tier this speaker belongs to based on fill counts
  const existingSnap = await getDocs(
    query(collection(db(), "dcAssignments"), where("projectId", "==", project.id)),
  );
  const assignedCount = existingSnap.size;
  let targetSampleRate: number;
  if (assignedCount < project.participants48k) {
    targetSampleRate = 48000;
  } else if (assignedCount < project.participants48k + project.participants16k) {
    targetSampleRate = 16000;
  } else {
    targetSampleRate = 8000;
  }

  return createDCAssignment(project, speaker, hoursTarget, adminEmail, adminUid, targetSampleRate);
}

export async function createDCAssignment(
  project: DCProject,
  speaker: DCSpeaker,
  hoursTarget: number,
  inviterEmail: string,
  inviterUid: string,
  targetSampleRate = 48000,
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
    targetSampleRate,
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

export function subscribeToDCAssignments(
  callback: (assignments: DCAssignment[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db(), "dcAssignments"), orderBy("assignedAt", "desc"));
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapAssignment(d.data(), d.id))), onError);
}

// ─── Sessions ─────────────────────────────────────────────────────────────────

async function presignAndUpload(
  idToken: string,
  key: string,
  blob: Blob,
  contentType: string,
): Promise<string> {
  let presignRes: Response;
  try {
    presignRes = await fetch("/api/dc-audio/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ key, contentType }),
    });
  } catch (e) {
    throw new Error(`Presign network error: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (!presignRes.ok) {
    const body = await presignRes.text().catch(() => "");
    throw new Error(`Presign ${presignRes.status}: ${body}`);
  }
  const { presignedUrl, publicUrl } = await presignRes.json() as { presignedUrl: string; publicUrl: string };
  const uploadRes = await fetch(presignedUrl, { method: "PUT", body: blob, headers: { "Content-Type": contentType } });
  if (!uploadRes.ok) throw new Error(`R2 upload ${uploadRes.status}`);
  return publicUrl;
}

export async function submitDCSession(input: DCSessionInput): Promise<string> {
  const { auth } = getFirebaseClientServices();
  // Force refresh=true so mobile sessions with stale tokens don't fail
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Not authenticated — please sign out and sign back in.");

  const timestamp = Date.now();
  const base = `dc-audio/${input.projectId}/${input.speakerId}/${timestamp}`;

  const rateLabel = input.sampleRate >= 48000 ? "48k" : input.sampleRate >= 16000 ? "16k" : "8k";
  const normalizedMime = input.mimeType.split(";")[0].trim();
  const ext = normalizedMime.includes("mp4") ? "mp4" : normalizedMime.includes("wav") ? "wav" : "webm";
  const filePath = `${base}_${rateLabel}.${ext}`;
  const audioUrl = await presignAndUpload(idToken, filePath, input.audioBlob, normalizedMime);

  const docRef = await addDoc(collection(db(), "dcSessions"), {
    projectId: input.projectId,
    projectName: input.projectName,
    speakerId: input.speakerId,
    taskId: input.taskId ?? null,
    promptIndex: input.promptIndex ?? null,
    promptText: input.promptText ?? null,
    speakerName: input.speakerName,
    assignmentId: input.assignmentId,
    audioUrl,
    filePath,
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
    submissionCount: input.submissionCount ?? 0,
    ...(input.assignedTranscriptorEmail ? { assignedTranscriptorEmail: input.assignedTranscriptorEmail } : {}),
    ...(input.assignedQAEmail ? { assignedQAEmail: input.assignedQAEmail } : {}),
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

export function subscribeToDCSessionsByProjects(
  projectIds: string[],
  callback: (sessions: DCSession[]) => void,
) {
  if (projectIds.length === 0) {
    callback([]);
    return () => undefined;
  }
  const q = query(
    collection(db(), "dcSessions"),
    where("projectId", "in", projectIds.slice(0, 30)),
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

export async function updateDCSessionAssignment(
  sessionId: string,
  transcriptorEmail?: string,
  qaEmail?: string,
): Promise<void> {
  await updateDoc(doc(db(), "dcSessions", sessionId), {
    ...(transcriptorEmail !== undefined ? { assignedTranscriptorEmail: transcriptorEmail } : {}),
    ...(qaEmail !== undefined ? { assignedQAEmail: qaEmail } : {}),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToDCSessionsByTranscriptor(
  email: string,
  callback: (sessions: DCSession[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "dcSessions"),
    where("assignedTranscriptorEmail", "==", email.trim().toLowerCase()),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSession(d.data(), d.id))), onError);
}

export function subscribeToDCSessionsByQA(
  email: string,
  callback: (sessions: DCSession[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "dcSessions"),
    where("assignedQAEmail", "==", email.trim().toLowerCase()),
  );
  return onSnapshot(q, (snap) => callback(snap.docs.map((d) => mapSession(d.data(), d.id))), onError);
}

// ─── Conversational rooms ─────────────────────────────────────────────────────

export type DCConvStatus = "waiting" | "connected" | "recording" | "paused" | "stopped" | "done";

export interface DCConvParticipant {
  uid: string;
  email: string;
  name: string;
  role: "primary" | "secondary";
  online: boolean;
  ready: boolean;
  uploadStatus: "idle" | "uploading" | "done";
  audioUrl?: string;
  sessionId?: string;
}

export interface DCConversationRoom {
  id: string;
  projectId: string;
  assignmentId: string;
  primaryUid: string;
  primaryEmail: string;
  invitedEmails: string[];
  participants: DCConvParticipant[];
  speakersRequired: number;
  taskIndex: number;
  totalTasks: number;
  status: DCConvStatus;
  startSignalAt?: unknown;
  stopSignalAt?: unknown;
  createdAt?: unknown;
  // WebRTC signaling (primary → secondary offer/answer + ICE)
  offer?: string;
  answer?: string;
  icePrimary: string[];
  iceSecondary: string[];
}

export async function createOrGetConversationRoom(params: {
  assignmentId: string;
  projectId: string;
  primaryUid: string;
  primaryEmail: string;
  primaryName: string;
  speakersRequired: number;
  totalTasks: number;
}): Promise<DCConversationRoom> {
  const ref = doc(db(), "dcConversationRooms", params.assignmentId);
  const snap = await getDoc(ref);
  if (snap.exists()) return { id: snap.id, ...snap.data() } as DCConversationRoom;

  const room: Omit<DCConversationRoom, "id"> = {
    projectId: params.projectId,
    assignmentId: params.assignmentId,
    primaryUid: params.primaryUid,
    primaryEmail: params.primaryEmail,
    invitedEmails: [],
    participants: [{
      uid: params.primaryUid,
      email: params.primaryEmail,
      name: params.primaryName,
      role: "primary",
      online: true,
      ready: false,
      uploadStatus: "idle",
    }],
    speakersRequired: params.speakersRequired,
    taskIndex: 0,
    totalTasks: params.totalTasks,
    status: "waiting",
    icePrimary: [],
    iceSecondary: [],
    createdAt: serverTimestamp(),
  };
  await setDoc(ref, room);
  return { id: params.assignmentId, ...room };
}

export function subscribeToConversationRoom(
  roomId: string,
  callback: (room: DCConversationRoom | null) => void,
  onError?: (err: Error) => void,
) {
  return onSnapshot(
    doc(db(), "dcConversationRooms", roomId),
    (snap) => callback(snap.exists() ? { id: snap.id, ...snap.data() } as DCConversationRoom : null),
    (err) => onError?.(err),
  );
}

export async function joinConversationRoom(
  roomId: string,
  participant: Omit<DCConvParticipant, "role">,
) {
  const ref = doc(db(), "dcConversationRooms", roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Room not found.");
  const room = snap.data() as DCConversationRoom;
  const already = room.participants.some((p) => p.uid === participant.uid);
  if (already) {
    // Just mark online
    const updated = room.participants.map((p) =>
      p.uid === participant.uid ? { ...p, online: true } : p,
    );
    await updateDoc(ref, { participants: updated });
  } else {
    const newP: DCConvParticipant = { ...participant, role: "secondary", online: true, ready: false, uploadStatus: "idle" };
    await updateDoc(ref, {
      participants: arrayUnion(newP),
      invitedEmails: arrayUnion(participant.email),
    });
  }
}

export async function updateConversationRoomStatus(
  roomId: string,
  status: DCConvStatus,
  extra?: Record<string, unknown>,
) {
  const updates: Record<string, unknown> = { status };
  if (status === "recording") updates.startSignalAt = serverTimestamp();
  if (status === "stopped") updates.stopSignalAt = serverTimestamp();
  if (extra) Object.assign(updates, extra);
  await updateDoc(doc(db(), "dcConversationRooms", roomId), updates);
}

export async function updateConversationRoomParticipant(
  roomId: string,
  uid: string,
  fields: Partial<DCConvParticipant>,
) {
  const snap = await getDoc(doc(db(), "dcConversationRooms", roomId));
  if (!snap.exists()) return;
  const room = snap.data() as DCConversationRoom;
  const participants = room.participants.map((p) =>
    p.uid === uid ? { ...p, ...fields } : p,
  );
  await updateDoc(doc(db(), "dcConversationRooms", roomId), { participants });
}

export async function addConvIceCandidate(
  roomId: string,
  role: "primary" | "secondary",
  candidate: string,
) {
  const field = role === "primary" ? "icePrimary" : "iceSecondary";
  await updateDoc(doc(db(), "dcConversationRooms", roomId), {
    [field]: arrayUnion(candidate),
  });
}

export async function updateConversationRoomFields(
  roomId: string,
  fields: Record<string, unknown>,
) {
  await updateDoc(doc(db(), "dcConversationRooms", roomId), fields);
}

export async function submitConvSession(input: DCSessionInput): Promise<string> {
  const { auth } = getFirebaseClientServices();
  const idToken = await auth.currentUser?.getIdToken(true);
  if (!idToken) throw new Error("Not authenticated.");

  const timestamp = Date.now();
  const ext = input.mimeType.includes("mp4") ? "mp4" : input.mimeType.includes("wav") ? "wav" : "webm";
  const filename = `dc-audio/${input.projectId}/${input.speakerId}/${timestamp}.${ext}`;

  const presignRes = await fetch("/api/dc-audio/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${idToken}` },
    body: JSON.stringify({ key: filename, contentType: input.mimeType }),
  });
  if (!presignRes.ok) throw new Error(`Presign ${presignRes.status}`);
  const { presignedUrl, publicUrl: audioUrl } = await presignRes.json() as { presignedUrl: string; publicUrl: string };

  const uploadRes = await fetch(presignedUrl, {
    method: "PUT",
    body: input.audioBlob,
    headers: { "Content-Type": input.mimeType },
  });
  if (!uploadRes.ok) throw new Error(`Upload ${uploadRes.status}`);

  const docRef = await addDoc(collection(db(), "dcSessions"), {
    projectId: input.projectId,
    projectName: input.projectName,
    speakerId: input.speakerId,
    speakerName: input.speakerName,
    assignmentId: input.assignmentId,
    taskId: input.taskId ?? null,
    promptIndex: input.promptIndex ?? null,
    promptText: input.promptText ?? null,
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
    submissionCount: input.submissionCount ?? 0,
    ...(input.assignedTranscriptorEmail ? { assignedTranscriptorEmail: input.assignedTranscriptorEmail } : {}),
    ...(input.assignedQAEmail ? { assignedQAEmail: input.assignedQAEmail } : {}),
    createdAt: serverTimestamp(),
  });

  const durationHours = input.duration / 3600;

  // Assignment update may fail for secondary speakers (email mismatch) — ignore so audio is always saved
  try {
    await updateDoc(doc(db(), "dcAssignments", input.assignmentId), {
      hoursCompleted: increment(durationHours),
      sessionsCount: increment(1),
    });
  } catch {
    // secondary speakers don't own the assignment doc — safe to skip
  }
  try {
    await updateDoc(doc(db(), "dcProjects", input.projectId), {
      hoursCompleted: increment(durationHours),
      updatedAt: serverTimestamp(),
    });
  } catch {
    // best-effort
  }

  return docRef.id;
}
