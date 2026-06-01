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
  where,
  type DocumentData,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export type OpsRole = "transcription" | "qa" | "delivery";
export type OpsInvitedByRole = "super" | "admin";

export interface OpsWorker {
  email: string;
  name: string;
  roles: OpsRole[];
  assignedProjectIds: string[];
  status: "active" | "paused";
  invitedByEmail: string;
  invitedByUid: string;
  invitedByRole: OpsInvitedByRole;
  invitedByAdminEmail?: string;
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
    invitedByRole: data.invitedByRole === "admin" ? "admin" : "super",
    invitedByAdminEmail: data.invitedByAdminEmail ? String(data.invitedByAdminEmail) : undefined,
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
  invitedByRole: OpsInvitedByRole = "super",
  invitedByAdminEmail?: string,
  isNewWorker?: boolean,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const ref = doc(db(), "opsWorkers", normalized);
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
      invitedByRole,
      ...(invitedByAdminEmail ? { invitedByAdminEmail: invitedByAdminEmail.trim().toLowerCase() } : {}),
      updatedAt: serverTimestamp(),
      ...(isNewWorker ? { createdAt: serverTimestamp() } : {}),
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

export function subscribeToOpsWorkersByAdminEmail(
  adminEmail: string,
  callback: (workers: OpsWorker[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "opsWorkers"),
    where("invitedByAdminEmail", "==", adminEmail.trim().toLowerCase()),
    orderBy("createdAt", "desc"),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapWorker(d.data(), d.id))),
    onError,
  );
}

export function subscribeToOpsWorkersByProject(
  projectId: string,
  callback: (workers: OpsWorker[]) => void,
  onError?: (err: Error) => void,
) {
  const q = query(
    collection(db(), "opsWorkers"),
    where("assignedProjectIds", "array-contains", projectId),
  );
  return onSnapshot(
    q,
    (snap) => callback(snap.docs.map((d) => mapWorker(d.data(), d.id))),
    onError,
  );
}

export async function addWorkerToProject(
  email: string,
  name: string,
  roles: OpsRole[],
  projectId: string,
  inviterEmail: string,
  inviterUid: string,
  invitedByRole: OpsInvitedByRole,
  invitedByAdminEmail?: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const ref = doc(db(), "opsWorkers", normalized);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const existingRoles = (existing.data().roles ?? []) as OpsRole[];
    const mergedRoles = Array.from(new Set([...existingRoles, ...roles])) as OpsRole[];
    const existingProjects: string[] = existing.data().assignedProjectIds ?? [];
    await updateDoc(ref, {
      roles: mergedRoles,
      assignedProjectIds: Array.from(new Set([...existingProjects, projectId])),
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(ref, {
      email: normalized,
      name: name.trim(),
      roles,
      assignedProjectIds: [projectId],
      status: "active",
      invitedByEmail: inviterEmail,
      invitedByUid: inviterUid,
      invitedByRole,
      ...(invitedByAdminEmail ? { invitedByAdminEmail: invitedByAdminEmail.trim().toLowerCase() } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }
}

export async function removeWorkerFromProject(email: string, projectId: string): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const ref = doc(db(), "opsWorkers", normalized);
  const existing = await getDoc(ref);
  if (!existing.exists()) return;
  const currentProjects: string[] = existing.data().assignedProjectIds ?? [];
  await updateDoc(ref, {
    assignedProjectIds: currentProjects.filter((id) => id !== projectId),
    updatedAt: serverTimestamp(),
  });
}
