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
  Timestamp,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export interface CareerOpening {
  id: string;
  title: string;
  location: string;
  employmentType: string;
  department: string;
  createdAt?: Timestamp | null;
  updatedAt?: unknown;
}

export interface CareerOpeningDraft {
  title: string;
  location: string;
  employmentType: string;
  department: string;
}

export const emptyCareerOpeningDraft: CareerOpeningDraft = {
  title: "",
  location: "",
  employmentType: "Full-time",
  department: "",
};

function buildOpeningsCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "company", "website", "career-openings");
}

function buildOpeningRef(id: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "company", "website", "career-openings", id);
}

function mapOpening(data: DocumentData, id: string): CareerOpening {
  return {
    id,
    title: String(data.title ?? ""),
    location: String(data.location ?? ""),
    employmentType: String(data.employmentType ?? "Full-time"),
    department: String(data.department ?? ""),
    createdAt: data.createdAt ?? null,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToCareerOpenings(
  callback: (openings: CareerOpening[]) => void,
  onError?: (error: Error) => void,
) {
  const q = query(buildOpeningsCollection(), orderBy("createdAt", "desc"));
  return onSnapshot(
    q,
    (snapshot) => callback(snapshot.docs.map((d) => mapOpening(d.data(), d.id))),
    (error) => onError?.(error),
  );
}

export async function saveCareerOpening(
  user: User,
  draft: CareerOpeningDraft,
  existingId?: string | null,
) {
  const openingId = existingId || doc(buildOpeningsCollection()).id;
  await setDoc(
    buildOpeningRef(openingId),
    {
      title: draft.title.trim(),
      location: draft.location.trim(),
      employmentType: draft.employmentType.trim(),
      department: draft.department.trim(),
      savedByEmail: user.email ?? "",
      savedByUid: user.uid,
      updatedAt: serverTimestamp(),
      ...(existingId ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
  return openingId;
}

export async function deleteCareerOpening(id: string) {
  await deleteDoc(buildOpeningRef(id));
}
