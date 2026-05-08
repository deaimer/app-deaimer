import type { User } from "firebase/auth";
import { DocumentData, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { getLockedProfileEmail } from "@/lib/auth/access-control";
import type { PortalRole } from "@/lib/auth/portal-config";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export interface PortalProfileDraft {
  fullName: string;
  email: string;
  phone: string;
  organization: string;
  contactPerson: string;
  companyWebsite: string;
  companyAddress: string;
  jobTitle: string;
  location: string;
  bio: string;
  photoUrl: string;
}

export interface PortalProfile extends PortalProfileDraft {
  role: PortalRole;
  uid: string;
  authEmail: string;
  googleDisplayName: string;
  googlePhotoUrl: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function buildProfileRef(uid: string, role: PortalRole) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "users", uid, "portalProfiles", role);
}

function mapProfileDocument(role: PortalRole, uid: string, data: DocumentData): PortalProfile {
  return {
    role,
    uid,
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    phone: String(data.phone ?? ""),
    organization: String(data.organization ?? ""),
    contactPerson: String(data.contactPerson ?? ""),
    companyWebsite: String(data.companyWebsite ?? ""),
    companyAddress: String(data.companyAddress ?? ""),
    jobTitle: String(data.jobTitle ?? ""),
    location: String(data.location ?? ""),
    bio: String(data.bio ?? ""),
    photoUrl: String(data.photoUrl ?? ""),
    authEmail: String(data.authEmail ?? ""),
    googleDisplayName: String(data.googleDisplayName ?? ""),
    googlePhotoUrl: String(data.googlePhotoUrl ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function createProfileDraft(user: User, role?: PortalRole): PortalProfileDraft {
  return {
    fullName: user.displayName ?? "",
    email: role ? getLockedProfileEmail(role, user.email) : user.email ?? "",
    phone: user.phoneNumber ?? "",
    organization: "",
    contactPerson: user.displayName ?? "",
    companyWebsite: "",
    companyAddress: "",
    jobTitle: "",
    location: "",
    bio: "",
    photoUrl: user.photoURL ?? "",
  };
}

export async function getPortalProfile(uid: string, role: PortalRole) {
  const snapshot = await getDoc(buildProfileRef(uid, role));

  if (!snapshot.exists()) {
    return null;
  }

  return mapProfileDocument(role, uid, snapshot.data());
}

export async function savePortalProfile(user: User, role: PortalRole, draft: PortalProfileDraft) {
  const profileRef = buildProfileRef(user.uid, role);
  const existingProfile = await getPortalProfile(user.uid, role);
  const lockedProfileEmail = getLockedProfileEmail(role, user.email);
  const resolvedEmail = lockedProfileEmail || draft.email.trim();

  await setDoc(
    profileRef,
    {
      role,
      uid: user.uid,
      fullName: draft.fullName.trim(),
      email: resolvedEmail,
      phone: draft.phone.trim(),
      organization: draft.organization.trim(),
      contactPerson: draft.contactPerson.trim(),
      companyWebsite: draft.companyWebsite.trim(),
      companyAddress: draft.companyAddress.trim(),
      jobTitle: draft.jobTitle.trim(),
      location: draft.location.trim(),
      bio: draft.bio.trim(),
      photoUrl: draft.photoUrl.trim(),
      authEmail: user.email ?? "",
      googleDisplayName: user.displayName ?? "",
      googlePhotoUrl: user.photoURL ?? "",
      updatedAt: serverTimestamp(),
      ...(existingProfile
        ? {}
        : {
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true },
  );

  return getPortalProfile(user.uid, role);
}
