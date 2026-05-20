import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export type OpsRole = "transcription" | "qa" | "delivery";

export interface OpsWorker {
  email: string;
  name: string;
  roles: OpsRole[];
  assignedProjectIds: string[];
  status: "active" | "paused";
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const VALID_ROLES: OpsRole[] = ["transcription", "qa", "delivery"];

function db() {
  return getFirebaseClientServices().firestore;
}

function mapWorker(data: DocumentData, id: string): OpsWorker {
  return {
    email: String(data.email ?? id),
    name: String(data.name ?? ""),
    roles: Array.isArray(data.roles)
      ? data.roles.filter((r: unknown): r is OpsRole =>
          typeof r === "string" && VALID_ROLES.includes(r as OpsRole),
        )
      : [],
    assignedProjectIds: Array.isArray(data.assignedProjectIds)
      ? data.assignedProjectIds.map(String)
      : [],
    status: data.status === "paused" ? "paused" : "active",
    invitedByEmail: String(data.invitedByEmail ?? ""),
    invitedByUid: String(data.invitedByUid ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function saveOpsWorker(
  email: string,
  name: string,
  roles: OpsRole[],
  assignedProjectIds: string[],
  inviterEmail: string,
  inviterUid: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const ref = doc(db(), "opsWorkers", normalized);
  const existing = await getDoc(ref);
  await setDoc(
    ref,
    {
      email: normalized,
      name: name.trim(),
      roles,
      assignedProjectIds,
      status: "active",
      invitedByEmail: inviterEmail,
      invitedByUid: inviterUid,
      updatedAt: serverTimestamp(),
      ...(!existing.exists() ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

export async function updateOpsWorkerStatus(
  email: string,
  status: "active" | "paused",
): Promise<void> {
  await updateDoc(doc(db(), "opsWorkers", email.trim().toLowerCase()), {
    status,
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToOpsWorkers(
  callback: (workers: OpsWorker[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(collection(db(), "opsWorkers"), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapWorker(d.data(), d.id))),
    onError,
  );
}

export function subscribeToOpsWorkerByEmail(
  email: string,
  callback: (worker: OpsWorker | null) => void,
) {
  return onSnapshot(
    doc(db(), "opsWorkers", email.trim().toLowerCase()),
    (snap) => callback(snap.exists() ? mapWorker(snap.data(), snap.id) : null),
  );
}
