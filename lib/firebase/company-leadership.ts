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

export interface CompanyLeadershipMember {
  id: string;
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  initial: string;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CompanyLeadershipMemberDraft {
  name: string;
  role: string;
  bio: string;
  photoUrl: string;
  initial: string;
  order: number;
}

export const emptyLeadershipMemberDraft: CompanyLeadershipMemberDraft = {
  name: "",
  role: "",
  bio: "",
  photoUrl: "",
  initial: "",
  order: 0,
};

function buildMembersCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "company", "website", "leadership");
}

function buildMemberRef(memberId: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "company", "website", "leadership", memberId);
}

function mapMember(data: DocumentData, id: string): CompanyLeadershipMember {
  return {
    id,
    name: String(data.name ?? ""),
    role: String(data.role ?? ""),
    bio: String(data.bio ?? ""),
    photoUrl: String(data.photoUrl ?? ""),
    initial: String(data.initial ?? ""),
    order: Number(data.order ?? 0),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function subscribeToLeadershipMembers(
  callback: (members: CompanyLeadershipMember[]) => void,
  onError?: (error: Error) => void,
) {
  const membersQuery = query(buildMembersCollection(), orderBy("order", "asc"));

  return onSnapshot(
    membersQuery,
    (snapshot) => {
      callback(snapshot.docs.map((document) => mapMember(document.data(), document.id)));
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function saveLeadershipMember(
  user: User,
  draft: CompanyLeadershipMemberDraft,
  existingMemberId?: string | null,
) {
  const memberId = existingMemberId || doc(buildMembersCollection()).id;

  await setDoc(
    buildMemberRef(memberId),
    {
      name: draft.name.trim(),
      role: draft.role.trim(),
      bio: draft.bio.trim(),
      photoUrl: draft.photoUrl.trim(),
      initial: draft.initial.trim().charAt(0).toUpperCase() || draft.name.trim().charAt(0).toUpperCase(),
      order: Number(draft.order),
      savedByEmail: user.email ?? "",
      savedByUid: user.uid,
      updatedAt: serverTimestamp(),
      ...(existingMemberId ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  return memberId;
}

export async function deleteLeadershipMember(memberId: string) {
  await deleteDoc(buildMemberRef(memberId));
}
