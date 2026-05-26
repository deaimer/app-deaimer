import {
  doc,
  onSnapshot,
} from "firebase/firestore";
import type { User } from "firebase/auth";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { isSuperAdminEmail, normalizeEmail } from "@/lib/auth/access-control";
import { requestSuperAccessApi } from "@/lib/firebase/super-access-api";

export interface SuperAccessRecord {
  email: string;
  invitedByEmail: string;
  invitedByUid: string;
  createdAt?: unknown;
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
  void requestSuperAccessApi<{ superAdmins: SuperAccessRecord[] }>()
    .then((payload) => callback(payload.superAdmins))
    .catch((error) => onError?.(error));

  return () => undefined;
}

export async function addSuperAdmin(_inviter: User, targetEmail: string): Promise<void> {
  const normalized = normalizeEmail(targetEmail);
  if (!normalized) throw new Error("Invalid email address.");
  await requestSuperAccessApi({
    method: "POST",
    body: JSON.stringify({ email: normalized }),
  });
}

export async function removeSuperAdmin(email: string): Promise<void> {
  await requestSuperAccessApi({
    method: "DELETE",
    body: JSON.stringify({ email: normalizeEmail(email) }),
  });
}
