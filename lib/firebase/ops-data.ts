import {
  collection,
  deleteField,
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
  projectAssignmentOwners: Record<string, { adminEmail: string; adminName: string }>;
  status: "active" | "paused";
  invitedByEmail: string;
  invitedByUid: string;
  invitedByRole: OpsInvitedByRole;
  invitedByAdminEmail?: string;
  invitedByName?: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

const VALID_ROLES: OpsRole[] = ["transcription", "qa", "delivery"];

function db() {
  return getFirebaseClientServices().firestore;
}

function mapWorker(data: DocumentData, id: string): OpsWorker {
  const rawOwners = data.projectAssignmentOwners && typeof data.projectAssignmentOwners === "object"
    ? data.projectAssignmentOwners as Record<string, unknown>
    : {};
  const projectAssignmentOwners = Object.fromEntries(
    Object.entries(rawOwners).map(([projectId, owner]) => {
      const value = owner && typeof owner === "object" ? owner as Record<string, unknown> : {};
      return [projectId, {
        adminEmail: String(value.adminEmail ?? ""),
        adminName: String(value.adminName ?? ""),
      }];
    }),
  );

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
    projectAssignmentOwners,
    status: data.status === "paused" ? "paused" : "active",
    invitedByEmail: String(data.invitedByEmail ?? ""),
    invitedByUid: String(data.invitedByUid ?? ""),
    invitedByRole: data.invitedByRole === "admin" ? "admin" : "super",
    invitedByAdminEmail: data.invitedByAdminEmail ? String(data.invitedByAdminEmail) : undefined,
    invitedByName: data.invitedByName ? String(data.invitedByName) : undefined,
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
  inviterName?: string,
  ownedProjectIds?: string[],
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const normalizedAdminEmail = invitedByAdminEmail?.trim().toLowerCase();
  const ownerProjectIds = Array.from(new Set((ownedProjectIds ?? assignedProjectIds).filter(Boolean)));
  const projectAssignmentOwners = normalizedAdminEmail
    ? Object.fromEntries(ownerProjectIds.map((projectId) => [projectId, {
        adminEmail: normalizedAdminEmail,
        adminName: inviterName?.trim() || normalizedAdminEmail,
      }]))
    : {};
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
      ...(normalizedAdminEmail ? { invitedByAdminEmail: normalizedAdminEmail } : {}),
      ...(inviterName?.trim() ? { invitedByName: inviterName.trim() } : {}),
      ...(Object.keys(projectAssignmentOwners).length > 0 ? { projectAssignmentOwners } : {}),
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

export function subscribeToOpsWorkersByProjects(
  projectIds: string[],
  callback: (workers: OpsWorker[]) => void,
  onError?: (err: Error) => void,
) {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  if (ids.length === 0) {
    callback([]);
    return () => undefined;
  }

  const workersByProject = new Map<string, OpsWorker[]>();
  const emit = () => {
    const merged = new Map<string, OpsWorker>();
    workersByProject.forEach((workers) => {
      workers.forEach((worker) => merged.set(worker.email, worker));
    });
    callback(Array.from(merged.values()));
  };

  const unsubscribes = ids.map((projectId) => {
    const q = query(
      collection(db(), "opsWorkers"),
      where("assignedProjectIds", "array-contains", projectId),
    );
    return onSnapshot(
      q,
      (snap) => {
        workersByProject.set(projectId, snap.docs.map((d) => mapWorker(d.data(), d.id)));
        emit();
      },
      onError,
    );
  });

  return () => {
    unsubscribes.forEach((unsubscribe) => unsubscribe());
  };
}

export async function fetchOpsWorkersByProjects(projectIds: string[]): Promise<OpsWorker[]> {
  const ids = Array.from(new Set(projectIds.filter(Boolean)));
  if (ids.length === 0) return [];

  const token = await getFirebaseClientServices().auth.currentUser?.getIdToken();
  if (!token) throw new Error("Not authenticated.");

  const params = new URLSearchParams({ projectIds: ids.join(",") });
  const response = await fetch(`/api/ops/workers?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json().catch(() => ({})) as { workers?: OpsWorker[]; error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Could not load workers.");
  return payload.workers ?? [];
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
  inviterName?: string,
): Promise<void> {
  const normalized = email.trim().toLowerCase();
  const normalizedAdminEmail = invitedByAdminEmail?.trim().toLowerCase();
  const ownerPayload = normalizedAdminEmail
    ? {
        [`projectAssignmentOwners.${projectId}`]: {
          adminEmail: normalizedAdminEmail,
          adminName: inviterName?.trim() || normalizedAdminEmail,
        },
      }
    : {};
  const ref = doc(db(), "opsWorkers", normalized);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const existingRoles = (existing.data().roles ?? []) as OpsRole[];
    const mergedRoles = Array.from(new Set([...existingRoles, ...roles])) as OpsRole[];
    const existingProjects: string[] = existing.data().assignedProjectIds ?? [];
    await updateDoc(ref, {
      roles: mergedRoles,
      assignedProjectIds: Array.from(new Set([...existingProjects, projectId])),
      ...ownerPayload,
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
      ...(normalizedAdminEmail ? { invitedByAdminEmail: normalizedAdminEmail } : {}),
      ...(inviterName?.trim() ? { invitedByName: inviterName.trim() } : {}),
      ...(
        normalizedAdminEmail
          ? {
              projectAssignmentOwners: {
                [projectId]: {
                  adminEmail: normalizedAdminEmail,
                  adminName: inviterName?.trim() || normalizedAdminEmail,
                },
              },
            }
          : {}
      ),
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
    [`projectAssignmentOwners.${projectId}`]: deleteField(),
    updatedAt: serverTimestamp(),
  });
}
