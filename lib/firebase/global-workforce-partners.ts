import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export interface GlobalWorkforcePartner {
  id: string;
  name: string;
  partnerId: string;
  referenceId: string;
  notes: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GlobalWorkforcePartnerDraft {
  name: string;
  partnerId: string;
  referenceId: string;
  notes: string;
}

export const emptyGlobalWorkforcePartnerDraft: GlobalWorkforcePartnerDraft = {
  name: "",
  partnerId: "",
  referenceId: "",
  notes: "",
};

function buildPartnersCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "globalWorkforce", "workspace", "partners");
}

function buildPartnerRef(partnerId: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "globalWorkforce", "workspace", "partners", partnerId);
}

function mapPartner(data: DocumentData, id: string): GlobalWorkforcePartner {
  return {
    id,
    name: String(data.name ?? ""),
    partnerId: String(data.partnerId ?? ""),
    referenceId: String(data.referenceId ?? ""),
    notes: String(data.notes ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToGlobalWorkforcePartners(
  callback: (partners: GlobalWorkforcePartner[]) => void,
  onError?: (error: Error) => void,
) {
  const partnersQuery = query(buildPartnersCollection(), orderBy("name", "asc"));

  return onSnapshot(
    partnersQuery,
    (snapshot) => {
      callback(snapshot.docs.map((document) => mapPartner(document.data(), document.id)));
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function saveGlobalWorkforcePartner(
  user: User,
  draft: GlobalWorkforcePartnerDraft,
  existingPartnerId?: string | null,
) {
  const partnerId =
    existingPartnerId ||
    doc(buildPartnersCollection()).id;

  await setDoc(
    buildPartnerRef(partnerId),
    {
      name: draft.name.trim(),
      partnerId: draft.partnerId.trim(),
      referenceId: draft.referenceId.trim(),
      notes: draft.notes.trim(),
      savedByEmail: user.email ?? "",
      savedByUid: user.uid,
      updatedAt: serverTimestamp(),
      ...(existingPartnerId ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  return partnerId;
}

export async function deleteGlobalWorkforcePartner(partnerId: string) {
  await deleteDoc(buildPartnerRef(partnerId));
}
