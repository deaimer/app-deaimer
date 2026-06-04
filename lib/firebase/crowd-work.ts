import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

// ─── Options ─────────────────────────────────────────────────────────────────

export const crowdWorkTaskTypeOptions = [
  "Audio Recording",
  "Video Recording",
  "Annotation",
  "Transcription",
  "Data Labeling",
  "Image Annotation",
  "Video Annotation",
] as const;

export const crowdWorkStatusOptions = [
  "Active",
  "Paused",
  "Completed",
  "Archived",
] as const;

export const crowdWorkCurrencyOptions = [
  "USD",
  "PKR",
  "GBP",
  "EUR",
  "AED",
] as const;

export type CrowdWorkTaskType = (typeof crowdWorkTaskTypeOptions)[number];
export type CrowdWorkStatus = (typeof crowdWorkStatusOptions)[number];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrowdWorkPostDraft {
  title: string;
  taskType: string;
  description: string;
  languages: string[];
  dialects: string[];
  countries: string[];
  ethnicity: string;
  status: string;
  payPerSession: number;
  payCurrency: string;
  estimatedMinutesPerSession: number;
  totalSessionsNeeded: number;
  requirements: string;
  googleFormUrl: string;
  assignedAdminEmails: string[];
}

export interface CrowdWorkPost extends CrowdWorkPostDraft {
  id: string;
  postId: string;
  createdByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export function emptyCrowdWorkPostDraft(): CrowdWorkPostDraft {
  return {
    title: "",
    taskType: "",
    description: "",
    languages: [],
    dialects: [],
    countries: [],
    ethnicity: "",
    status: "Active",
    payPerSession: 0,
    payCurrency: "USD",
    estimatedMinutesPerSession: 0,
    totalSessionsNeeded: 0,
    requirements: "",
    googleFormUrl: "",
    assignedAdminEmails: [],
  };
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapCrowdWorkPost(id: string, data: DocumentData): CrowdWorkPost {
  return {
    id,
    postId: typeof data.postId === "string" ? data.postId : "",
    title: typeof data.title === "string" ? data.title : "",
    taskType: typeof data.taskType === "string" ? data.taskType : "",
    description: typeof data.description === "string" ? data.description : "",
    languages: Array.isArray(data.languages) ? data.languages : [],
    dialects: Array.isArray(data.dialects) ? data.dialects : [],
    countries: Array.isArray(data.countries) ? data.countries : [],
    ethnicity: typeof data.ethnicity === "string" ? data.ethnicity : "",
    status: typeof data.status === "string" ? data.status : "Active",
    payPerSession: typeof data.payPerSession === "number" ? data.payPerSession : 0,
    payCurrency: typeof data.payCurrency === "string" ? data.payCurrency : "USD",
    estimatedMinutesPerSession:
      typeof data.estimatedMinutesPerSession === "number" ? data.estimatedMinutesPerSession : 0,
    totalSessionsNeeded:
      typeof data.totalSessionsNeeded === "number" ? data.totalSessionsNeeded : 0,
    requirements: typeof data.requirements === "string" ? data.requirements : "",
    googleFormUrl: typeof data.googleFormUrl === "string" ? data.googleFormUrl : "",
    assignedAdminEmails: Array.isArray(data.assignedAdminEmails) ? data.assignedAdminEmails : [],
    createdByEmail: typeof data.createdByEmail === "string" ? data.createdByEmail : "",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function subscribeToCrowdWorkPosts(
  onData: (posts: CrowdWorkPost[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { firestore: db } = getFirebaseClientServices();
  const q = query(collection(db, "crowdWorkPosts"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapCrowdWorkPost(d.id, d.data()))),
    onError,
  );
}

export function subscribeToCrowdWorkPostsPublished(
  onData: (posts: CrowdWorkPost[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { firestore: db } = getFirebaseClientServices();
  // No orderBy here — avoids composite index requirement.
  const q = query(collection(db, "crowdWorkPosts"), where("status", "==", "Active"));
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => mapCrowdWorkPost(d.id, d.data()))
        .sort((a, b) => {
          const aMs = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
          const bMs = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
      onData(posts);
    },
    onError,
  );
}

export function subscribeToCrowdWorkPostsByAdmin(
  adminEmail: string,
  onData: (posts: CrowdWorkPost[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { firestore: db } = getFirebaseClientServices();
  const q = query(
    collection(db, "crowdWorkPosts"),
    where("assignedAdminEmails", "array-contains", adminEmail),
  );
  return onSnapshot(
    q,
    (snap) => {
      const posts = snap.docs
        .map((d) => mapCrowdWorkPost(d.id, d.data()))
        .sort((a, b) => {
          const aMs = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
          const bMs = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
          return bMs - aMs;
        });
      onData(posts);
    },
    onError,
  );
}

// ─── Writes ───────────────────────────────────────────────────────────────────

export async function saveCrowdWorkPost(
  draft: CrowdWorkPostDraft,
  createdByEmail: string,
  existingId?: string,
): Promise<string> {
  const { firestore: db } = getFirebaseClientServices();

  if (existingId) {
    const ref = doc(db, "crowdWorkPosts", existingId);
    await setDoc(ref, { ...draft, updatedAt: serverTimestamp() }, { merge: true });
    return existingId;
  }

  const postId = `CW-${Date.now().toString(36).toUpperCase()}`;
  const ref = await addDoc(collection(db, "crowdWorkPosts"), {
    ...draft,
    postId,
    createdByEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteCrowdWorkPost(id: string): Promise<void> {
  const { firestore: db } = getFirebaseClientServices();
  await deleteDoc(doc(db, "crowdWorkPosts", id));
}

// ─── Application Types ────────────────────────────────────────────────────────

export const crowdWorkApplicationStatusOptions = [
  "viewed",
  "applied",
  "under-review",
  "approved",
  "rejected",
] as const;

export type CrowdWorkApplicationStatus = (typeof crowdWorkApplicationStatusOptions)[number];

export interface CrowdWorkApplication {
  id: string;
  postDocId: string;
  postId: string;
  postTitle: string;
  uid: string;
  applicantName: string;
  applicantEmail: string;
  applicantWhatsapp: string;
  status: CrowdWorkApplicationStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function mapCrowdWorkApplication(id: string, data: DocumentData): CrowdWorkApplication {
  return {
    id,
    postDocId: typeof data.postDocId === "string" ? data.postDocId : "",
    postId: typeof data.postId === "string" ? data.postId : "",
    postTitle: typeof data.postTitle === "string" ? data.postTitle : "",
    uid: typeof data.uid === "string" ? data.uid : "",
    applicantName: typeof data.applicantName === "string" ? data.applicantName : "",
    applicantEmail: typeof data.applicantEmail === "string" ? data.applicantEmail : "",
    applicantWhatsapp: typeof data.applicantWhatsapp === "string" ? data.applicantWhatsapp : "",
    status: (crowdWorkApplicationStatusOptions as readonly string[]).includes(data.status)
      ? (data.status as CrowdWorkApplicationStatus)
      : "applied",
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

// ─── Application Subscriptions ────────────────────────────────────────────────

export function subscribeToCrowdWorkApplicationsByUid(
  uid: string,
  onData: (apps: CrowdWorkApplication[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { firestore: db } = getFirebaseClientServices();
  const q = query(collection(db, "crowdWorkApplications"), where("uid", "==", uid));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapCrowdWorkApplication(d.id, d.data()))),
    onError,
  );
}

export function subscribeToCrowdWorkAllApplications(
  onData: (apps: CrowdWorkApplication[]) => void,
  onError: (error: Error) => void,
): () => void {
  const { firestore: db } = getFirebaseClientServices();
  const q = query(collection(db, "crowdWorkApplications"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => onData(snap.docs.map((d) => mapCrowdWorkApplication(d.id, d.data()))),
    onError,
  );
}

export function subscribeToCrowdWorkApplicationsByPosts(
  postDocIds: string[],
  onData: (apps: CrowdWorkApplication[]) => void,
  onError: (error: Error) => void,
): () => void {
  if (postDocIds.length === 0) {
    onData([]);
    return () => {};
  }
  const { firestore: db } = getFirebaseClientServices();
  // Firestore `in` queries support up to 30 items; chunk if needed
  const chunks: string[][] = [];
  for (let i = 0; i < postDocIds.length; i += 30) {
    chunks.push(postDocIds.slice(i, i + 30));
  }
  const allApps = new Map<string, CrowdWorkApplication>();
  const unsubscribers: (() => void)[] = [];
  let callbackCount = 0;

  function notify() {
    const sorted = Array.from(allApps.values()).sort((a, b) => {
      const aMs = (a.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
      const bMs = (b.createdAt as { toMillis?: () => number } | null)?.toMillis?.() ?? 0;
      return bMs - aMs;
    });
    onData(sorted);
  }

  for (const chunk of chunks) {
    const q = query(
      collection(db, "crowdWorkApplications"),
      where("postDocId", "in", chunk),
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        for (const d of snap.docs) {
          allApps.set(d.id, mapCrowdWorkApplication(d.id, d.data()));
        }
        callbackCount++;
        if (callbackCount >= chunks.length) notify();
      },
      onError,
    );
    unsubscribers.push(unsub);
  }

  return () => unsubscribers.forEach((u) => u());
}

// ─── Application Writes ───────────────────────────────────────────────────────

export async function applyCrowdWork(
  postDocId: string,
  postId: string,
  postTitle: string,
  uid: string,
  applicantName: string,
  applicantEmail: string,
  applicantWhatsapp: string,
  status: CrowdWorkApplicationStatus = "applied",
): Promise<void> {
  const { firestore: db } = getFirebaseClientServices();
  const appId = `${postDocId}_${uid}`;
  const ref = doc(db, "crowdWorkApplications", appId);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const current = existing.data()?.status as CrowdWorkApplicationStatus | undefined;
    // Never downgrade from applied/approved/rejected (admin-set statuses)
    if (current === "applied" || current === "approved" || current === "under-review" || current === "rejected") return;
    // For "viewed": just update the timestamp
    await setDoc(ref, { status, updatedAt: serverTimestamp() }, { merge: true });
    return;
  }

  await setDoc(ref, {
    postDocId,
    postId,
    postTitle,
    uid,
    applicantName,
    applicantEmail,
    applicantWhatsapp,
    status,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateCrowdWorkApplicationStatus(
  appId: string,
  status: CrowdWorkApplicationStatus,
): Promise<void> {
  const { firestore: db } = getFirebaseClientServices();
  await setDoc(
    doc(db, "crowdWorkApplications", appId),
    { status, updatedAt: serverTimestamp() },
    { merge: true },
  );
}
