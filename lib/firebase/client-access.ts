import type { User } from "firebase/auth";
import {
  doc,
  deleteDoc,
  DocumentData,
  serverTimestamp,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { normalizeEmail } from "@/lib/auth/access-control";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { requestSuperAccessApi } from "@/lib/firebase/super-access-api";

export interface ClientApprovalPerson {
  name: string;
  email: string;
  tempPassword?: string;
  tempPasswordHash?: string;
  passwordUpdated?: boolean;
  active?: boolean;
}

export interface ClientPersonRecord {
  name: string;
  email: string;
  companyEmail: string;
  tempPasswordHash: string;
  passwordUpdated: boolean;
  active: boolean;
}

export interface ClientApprovalInput {
  email: string;
  company: string;
  contactName: string;
  notes: string;
  people?: ClientApprovalPerson[];
}

export interface ClientApprovalRecord extends ClientApprovalInput {
  id: string;
  people: ClientApprovalPerson[];
  status: "approved";
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
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
    people: Array.isArray(data.people)
      ? data.people.map((p: unknown) => {
          const person = p as Record<string, unknown>;
          return {
            name: String(person.name ?? ""),
            email: String(person.email ?? ""),
            tempPassword: String(person.tempPassword ?? ""),
            tempPasswordHash: String(person.tempPasswordHash ?? ""),
            passwordUpdated: Boolean(person.passwordUpdated),
            active: Boolean(person.active),
          };
        })
      : [],
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
      people: (approval.people ?? []).map((p) => ({
        name: p.name.trim(),
        email: p.email.trim().toLowerCase(),
        tempPassword: p.tempPassword ?? "",
        tempPasswordHash: p.tempPasswordHash ?? "",
        passwordUpdated: p.passwordUpdated ?? false,
        active: p.active ?? false,
      })),
      status: "approved",
      invitedByEmail: normalizeEmail(user.email),
      invitedByUid: user.uid,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function deleteClientApproval(email: string) {
  const { firestore } = getFirebaseClientServices();
  await deleteDoc(doc(firestore, "clientAccess", normalizeEmail(email)));
}

function buildClientPersonRef(email: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "clientPersons", normalizeEmail(email));
}

function mapClientPerson(data: DocumentData, id: string): ClientPersonRecord {
  return {
    name: String(data.name ?? ""),
    email: String(data.email ?? id),
    companyEmail: String(data.companyEmail ?? ""),
    tempPasswordHash: String(data.tempPasswordHash ?? ""),
    passwordUpdated: Boolean(data.passwordUpdated),
    active: Boolean(data.active),
  };
}

export async function getClientPerson(email: string | null | undefined): Promise<ClientPersonRecord | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const snap = await getDoc(buildClientPersonRef(normalized));
  if (!snap.exists()) return null;
  return mapClientPerson(snap.data(), snap.id);
}

export async function saveClientPerson(
  person: Omit<ClientPersonRecord, "passwordUpdated" | "active"> & {
    passwordUpdated?: boolean;
    active?: boolean;
  },
): Promise<void> {
  const email = normalizeEmail(person.email);
  if (!email) throw new Error("Person email is required.");
  await setDoc(
    buildClientPersonRef(email),
    {
      name: person.name.trim(),
      email,
      companyEmail: normalizeEmail(person.companyEmail),
      tempPasswordHash: person.tempPasswordHash,
      passwordUpdated: person.passwordUpdated ?? false,
      active: person.active ?? false,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateClientPersonPassword(
  email: string,
  newPasswordHash: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Email is required.");

  const companyRef = buildClientPersonRef(normalized);
  await updateDoc(companyRef, {
    passwordUpdated: true,
    active: true,
    tempPasswordHash: newPasswordHash,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteClientPerson(email: string): Promise<void> {
  const { firestore: db } = getFirebaseClientServices();
  await deleteDoc(doc(db, "clientPersons", normalizeEmail(email)));
}

export function subscribeToClientApprovals(
  callback: (records: ClientApprovalRecord[]) => void,
  onError?: (error: Error) => void,
) {
  void requestSuperAccessApi<{ clients: ClientApprovalRecord[] }>()
    .then((payload) => callback(payload.clients))
    .catch((error) => onError?.(error));

  return () => undefined;
}
