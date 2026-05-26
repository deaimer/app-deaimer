import type { User } from "firebase/auth";
import {
  collection,
  doc,
  DocumentData,
  onSnapshot,
  serverTimestamp,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { normalizeEmail } from "@/lib/auth/access-control";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { requestSuperAccessApi } from "@/lib/firebase/super-access-api";

export interface ClientApprovalInput {
  email: string;
  company: string;
  contactName: string;
  notes: string;
}

export interface ClientApprovalRecord extends ClientApprovalInput {
  id: string;
  status: "approved";
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function getClientAccessCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "clientAccess");
}

function buildClientAccessRef(email: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "clientAccess", normalizeEmail(email));
}

function mapClientApproval(data: DocumentData, id: string): ClientApprovalRecord {
  return {
    id,
    email: String(data.email ?? id),
    company: String(data.company ?? ""),
    contactName: String(data.contactName ?? ""),
    notes: String(data.notes ?? ""),
    status: "approved",
    invitedByEmail: String(data.invitedByEmail ?? ""),
    invitedByUid: String(data.invitedByUid ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getClientApproval(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const snapshot = await getDoc(buildClientAccessRef(normalizedEmail));

  if (!snapshot.exists()) {
    return null;
  }

  return mapClientApproval(snapshot.data(), snapshot.id);
}

export async function saveClientApproval(
  user: User,
  approval: ClientApprovalInput,
) {
  const normalizedEmail = normalizeEmail(approval.email);

  if (!normalizedEmail) {
    throw new Error("A client email is required.");
  }

  await setDoc(
    buildClientAccessRef(normalizedEmail),
    {
      email: normalizedEmail,
      company: approval.company.trim(),
      contactName: approval.contactName.trim(),
      notes: approval.notes.trim(),
      status: "approved",
      invitedByEmail: normalizeEmail(user.email),
      invitedByUid: user.uid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export function subscribeToClientApprovals(
  callback: (records: ClientApprovalRecord[]) => void,
  onError?: (error: Error) => void,
) {
  return onSnapshot(
    getClientAccessCollection(),
    (snapshot) => {
      callback(
        snapshot.docs
          .map((document) => mapClientApproval(document.data(), document.id))
          .sort((a, b) => a.email.localeCompare(b.email)),
      );
    },
    (error) => {
      requestSuperAccessApi<{ clients: ClientApprovalRecord[] }>()
        .then((payload) => callback(payload.clients))
        .catch(() => onError?.(error));
    },
  );
}
