import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { isSuperAdminEmail, normalizeEmail } from "@/lib/auth/access-control";

export interface SuperAccessRecord {
  email: string;
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
}

function buildSuperAccessCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "superAccess");
}

function buildSuperAccessRef(email: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "superAccess", normalizeEmail(email));
}

export function subscribeSuperAdminStatus(
  email: string,
  callback: (isSuperAdmin: boolean) => void,
  onError?: (error: Error) => void,
) {
  const normalizedEmail = normalizeEmail(email);
  const hasBootstrapAccess = isSuperAdminEmail(normalizedEmail);
  const ref = buildSuperAccessRef(normalizedEmail);
  return onSnapshot(
    ref,
    (snap) => callback(snap.exists() || hasBootstrapAccess),
    (error) => {
      callback(hasBootstrapAccess);
      onError?.(error);
    },
  );
}

export function subscribeToSuperAdmins(
  callback: (records: SuperAccessRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(buildSuperAccessCollection(), orderBy("createdAt", "asc"));
  return onSnapshot(
    q,
    (snapshot) => {
      callback(
        snapshot.docs.map((d) => ({
          email: String(d.data().email ?? ""),
          invitedByEmail: String(d.data().invitedByEmail ?? ""),
          invitedByUid: String(d.data().invitedByUid ?? ""),
          createdAt: d.data().createdAt,
        })),
      );
    },
    (error) => onError?.(error),
  );
}

export async function addSuperAdmin(inviter: User, targetEmail: string): Promise<void> {
  const normalized = normalizeEmail(targetEmail);
  if (!normalized) throw new Error("Invalid email address.");
  await setDoc(buildSuperAccessRef(normalized), {
    email: normalized,
    invitedByEmail: inviter.email ?? "",
    invitedByUid: inviter.uid,
    createdAt: serverTimestamp(),
  });
}

export async function removeSuperAdmin(email: string): Promise<void> {
  await deleteDoc(buildSuperAccessRef(email));
}
