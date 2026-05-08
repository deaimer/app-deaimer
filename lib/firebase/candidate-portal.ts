import type { User } from "firebase/auth";
import {
  DocumentData,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import {
  deleteGlobalWorkforceJobApplication,
  globalWorkforceApplicationStatusOptions,
  type GlobalWorkforceApplicationStatus,
  type GlobalWorkforceJobPost,
  saveGlobalWorkforceJobApplication,
} from "@/lib/firebase/global-workforce-jobs";

export const candidateResumeMaxFileSizeBytes = 5 * 1024 * 1024;

export function generateCandidateDisplayId(uid: string): string {
  let hash = 0;
  for (let i = 0; i < uid.length; i++) {
    hash = ((hash << 5) - hash + uid.charCodeAt(i)) | 0;
  }
  return String((Math.abs(hash) % 900000) + 100000);
}
export const candidateCoverLetterMaxCharacters = 2500;
export const candidateAdditionalNotesMaxCharacters = 600;

const allowedResumeContentTypes = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const candidateEmploymentStatusOptions = [
  "Employed",
  "Freelance",
  "Open to work",
  "Student",
] as const;

export const candidateAvailabilityOptions = [
  "Immediate",
  "2 weeks",
  "1 month",
  "Not looking",
] as const;

export const candidateWorkTypeOptions = [
  "Remote",
  "On-site",
  "Hybrid",
] as const;

export const candidateJobTypeOptions = [
  "Full-time",
  "Part-time",
  "Contract",
  "Freelance",
] as const;

export const candidateLanguageProficiencyOptions = [
  "Native",
  "Fluent",
  "Intermediate",
  "Basic",
] as const;

export const candidateCommonLanguages = [
  "Arabic",
  "Bengali",
  "English",
  "French",
  "German",
  "Hindi",
  "Indonesian",
  "Italian",
  "Japanese",
  "Korean",
  "Mandarin",
  "Pashto",
  "Persian",
  "Portuguese",
  "Punjabi",
  "Russian",
  "Spanish",
  "Swahili",
  "Turkish",
  "Urdu",
  "Vietnamese",
] as const;

export interface CandidateLanguageEntry {
  language: string;
  proficiency: string;
}

export interface CandidateProfileResume {
  fileName: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
}

export interface CandidateProfileDraft {
  // Identity
  candidateDisplayId: string;
  fullName: string;
  email: string;
  country: string;
  city: string;
  phoneCountryCode: string;
  phoneNumber: string;
  dateOfBirth: string;
  photoUrl: string;
  // Professional
  headline: string;
  bio: string;
  yearsOfExperience: string;
  employmentStatus: string;
  availability: string;
  // Skills & Languages
  skills: string[];
  languages: CandidateLanguageEntry[];
  // Links
  linkedinUrl: string;
  githubUrl: string;
  websiteUrl: string;
  // Preferences
  preferredWorkType: string;
  preferredJobType: string;
  openToRelocation: boolean;
  // Documents
  profileResume: CandidateProfileResume | null;
}

export interface CandidateProfile extends CandidateProfileDraft {
  uid: string;
  authEmail: string;
  googleDisplayName: string;
  googlePhotoUrl: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface CandidateApplicationDraft {
  coverLetter: string;
  profileLink: string;
  additionalNotes: string;
}

export interface CandidateResumeUpload {
  fileName: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
}

export interface CandidateJobApplication extends CandidateApplicationDraft {
  uid: string;
  candidateDisplayId?: string;
  jobId: string;
  jobTitle: string;
  workplace: string;
  jobType: string;
  country: string;
  status: GlobalWorkforceApplicationStatus;
  commissionApproved?: boolean;
  commissionAmount?: number;
  applicantEmail: string;
  applicantName: string;
  applicantCountry: string;
  applicantCity: string;
  applicantPhoneCountryCode: string;
  applicantPhoneNumber: string;
  applicantDateOfBirth: string;
  applicantPhotoUrl: string;
  resumeFileName: string;
  resumeFileUrl: string;
  resumeFilePath: string;
  resumeContentType: string;
  resumeSizeBytes: number;
  createdAt?: unknown;
  updatedAt?: unknown;
}

function buildCandidateProfileRef(uid: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "users", uid, "candidateProfile", "profile");
}

function buildCandidateApplicationsCollection(uid: string) {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "users", uid, "candidateApplications");
}

function buildCandidateApplicationRef(uid: string, jobId: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "users", uid, "candidateApplications", jobId);
}

function mapProfileResume(data: unknown): CandidateProfileResume | null {
  if (!data || typeof data !== "object") return null;
  const source = data as Record<string, unknown>;
  if (!source.fileUrl) return null;
  return {
    fileName: String(source.fileName ?? ""),
    fileUrl: String(source.fileUrl ?? ""),
    filePath: String(source.filePath ?? ""),
    contentType: String(source.contentType ?? ""),
    sizeBytes: Math.max(0, Number(source.sizeBytes ?? 0)),
  };
}

function mapLanguages(data: unknown): CandidateLanguageEntry[] {
  if (!Array.isArray(data)) return [];
  return data
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      language: String(item.language ?? ""),
      proficiency: String(item.proficiency ?? ""),
    }))
    .filter((entry) => entry.language.trim());
}

function mapSkills(data: unknown): string[] {
  if (!Array.isArray(data)) return [];
  return data.map((item) => String(item ?? "")).filter((s) => s.trim());
}

function mapCandidateProfile(uid: string, data: DocumentData): CandidateProfile {
  return {
    uid,
    // Identity
    candidateDisplayId: String(data.candidateDisplayId ?? ""),
    fullName: String(data.fullName ?? ""),
    email: String(data.email ?? ""),
    country: String(data.country ?? ""),
    city: String(data.city ?? ""),
    phoneCountryCode: String(data.phoneCountryCode ?? "+1"),
    phoneNumber: String(data.phoneNumber ?? ""),
    dateOfBirth: String(data.dateOfBirth ?? ""),
    photoUrl: String(data.photoUrl ?? ""),
    // Professional
    headline: String(data.headline ?? ""),
    bio: String(data.bio ?? ""),
    yearsOfExperience: String(data.yearsOfExperience ?? ""),
    employmentStatus: String(data.employmentStatus ?? ""),
    availability: String(data.availability ?? ""),
    // Skills & Languages
    skills: mapSkills(data.skills),
    languages: mapLanguages(data.languages),
    // Links
    linkedinUrl: String(data.linkedinUrl ?? ""),
    githubUrl: String(data.githubUrl ?? ""),
    websiteUrl: String(data.websiteUrl ?? ""),
    // Preferences
    preferredWorkType: String(data.preferredWorkType ?? ""),
    preferredJobType: String(data.preferredJobType ?? ""),
    openToRelocation: Boolean(data.openToRelocation ?? false),
    // Documents
    profileResume: mapProfileResume(data.profileResume),
    // Meta
    authEmail: String(data.authEmail ?? ""),
    googleDisplayName: String(data.googleDisplayName ?? ""),
    googlePhotoUrl: String(data.googlePhotoUrl ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapCandidateApplication(data: DocumentData): CandidateJobApplication {
  return {
    uid: String(data.uid ?? ""),
    jobId: String(data.jobId ?? ""),
    jobTitle: String(data.jobTitle ?? ""),
    workplace: String(data.workplace ?? ""),
    jobType: String(data.jobType ?? ""),
    country: String(data.country ?? ""),
    status: globalWorkforceApplicationStatusOptions.includes(data.status as GlobalWorkforceApplicationStatus)
      ? (data.status as GlobalWorkforceApplicationStatus)
      : "applied",
    commissionApproved: data.commissionApproved === true,
    commissionAmount: Math.max(0, Math.round(Number(data.commissionAmount ?? 0))),
    applicantEmail: String(data.applicantEmail ?? ""),
    applicantName: String(data.applicantName ?? ""),
    applicantCountry: String(data.applicantCountry ?? ""),
    applicantCity: String(data.applicantCity ?? ""),
    applicantPhoneCountryCode: String(data.applicantPhoneCountryCode ?? ""),
    applicantPhoneNumber: String(data.applicantPhoneNumber ?? ""),
    applicantDateOfBirth: String(data.applicantDateOfBirth ?? ""),
    applicantPhotoUrl: String(data.applicantPhotoUrl ?? ""),
    resumeFileName: String(data.resumeFileName ?? ""),
    resumeFileUrl: String(data.resumeFileUrl ?? ""),
    resumeFilePath: String(data.resumeFilePath ?? ""),
    resumeContentType: String(data.resumeContentType ?? ""),
    resumeSizeBytes: Math.max(0, Number(data.resumeSizeBytes ?? 0)),
    coverLetter: String(data.coverLetter ?? ""),
    profileLink: String(data.profileLink ?? ""),
    additionalNotes: String(data.additionalNotes ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function sanitizeResumeFileName(fileName: string) {
  const trimmed = fileName.trim() || "resume";
  return trimmed.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createCandidateProfileDraft(user: User): CandidateProfileDraft {
  return {
    candidateDisplayId: "",
    fullName: user.displayName ?? "",
    email: user.email ?? "",
    country: "",
    city: "",
    phoneCountryCode: "+1",
    phoneNumber: user.phoneNumber ?? "",
    dateOfBirth: "",
    photoUrl: user.photoURL ?? "",
    headline: "",
    bio: "",
    yearsOfExperience: "",
    employmentStatus: "",
    availability: "",
    skills: [],
    languages: [],
    linkedinUrl: "",
    githubUrl: "",
    websiteUrl: "",
    preferredWorkType: "",
    preferredJobType: "",
    openToRelocation: false,
    profileResume: null,
  };
}

export function createCandidateApplicationDraft(): CandidateApplicationDraft {
  return {
    coverLetter: "",
    profileLink: "",
    additionalNotes: "",
  };
}

export function subscribeToCandidateProfile(
  uid: string | null | undefined,
  callback: (profile: CandidateProfile | null) => void,
  onError?: (error: Error) => void,
) {
  if (!uid) {
    callback(null);
    return () => undefined;
  }

  return onSnapshot(
    buildCandidateProfileRef(uid),
    (snapshot) => {
      callback(
        snapshot.exists() ? mapCandidateProfile(uid, snapshot.data()) : null,
      );
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function getCandidateProfile(uid: string) {
  const snapshot = await getDoc(buildCandidateProfileRef(uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapCandidateProfile(uid, snapshot.data());
}

export async function saveCandidateProfile(
  user: User,
  draft: CandidateProfileDraft,
) {
  const profileRef = buildCandidateProfileRef(user.uid);
  const existingProfile = await getCandidateProfile(user.uid);

  const candidateDisplayId =
    existingProfile?.candidateDisplayId ||
    draft.candidateDisplayId ||
    generateCandidateDisplayId(user.uid);

  await setDoc(
    profileRef,
    {
      uid: user.uid,
      candidateDisplayId,
      // Identity
      fullName: draft.fullName.trim(),
      email: draft.email.trim(),
      country: draft.country.trim(),
      city: draft.city.trim(),
      phoneCountryCode: draft.phoneCountryCode.trim(),
      phoneNumber: draft.phoneNumber.trim(),
      dateOfBirth: draft.dateOfBirth.trim(),
      photoUrl: draft.photoUrl.trim(),
      // Professional
      headline: draft.headline.trim(),
      bio: draft.bio.trim(),
      yearsOfExperience: draft.yearsOfExperience.trim(),
      employmentStatus: draft.employmentStatus.trim(),
      availability: draft.availability.trim(),
      // Skills & Languages
      skills: draft.skills.map((s) => s.trim()).filter(Boolean),
      languages: draft.languages
        .filter((l) => l.language.trim())
        .map((l) => ({ language: l.language.trim(), proficiency: l.proficiency.trim() })),
      // Links
      linkedinUrl: draft.linkedinUrl.trim(),
      githubUrl: draft.githubUrl.trim(),
      websiteUrl: draft.websiteUrl.trim(),
      // Preferences
      preferredWorkType: draft.preferredWorkType.trim(),
      preferredJobType: draft.preferredJobType.trim(),
      openToRelocation: draft.openToRelocation,
      // Documents
      profileResume: draft.profileResume ?? null,
      // Meta
      authEmail: user.email ?? "",
      googleDisplayName: user.displayName ?? "",
      googlePhotoUrl: user.photoURL ?? "",
      updatedAt: serverTimestamp(),
      ...(existingProfile ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  return getCandidateProfile(user.uid);
}

export async function uploadCandidateProfileResume(
  user: User,
  file: File,
): Promise<CandidateProfileResume> {
  if (file.size > candidateResumeMaxFileSizeBytes) {
    throw new Error("Resume must be 5 MB or smaller.");
  }

  if (!allowedResumeContentTypes.has(file.type)) {
    throw new Error("Resume must be a PDF, DOC, or DOCX file.");
  }

  const { storage } = getFirebaseClientServices();
  const sanitizedFileName = sanitizeResumeFileName(file.name);
  const filePath = `candidateProfileResumes/${user.uid}/${Date.now()}-${sanitizedFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file, { contentType: file.type });
  const fileUrl = await getDownloadURL(storageRef);

  return {
    fileName: sanitizedFileName,
    fileUrl,
    filePath,
    contentType: file.type,
    sizeBytes: file.size,
  };
}

export async function deleteCandidateProfileResume(resume: CandidateProfileResume | null) {
  if (!resume?.filePath) return;

  const { storage } = getFirebaseClientServices();
  try {
    await deleteObject(ref(storage, resume.filePath));
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;
    if (code !== "storage/object-not-found") throw error;
  }
}

export function subscribeToCandidateApplications(
  uid: string,
  onValue: (applications: CandidateJobApplication[]) => void,
  onError: (error: Error) => void,
) {
  return onSnapshot(
    buildCandidateApplicationsCollection(uid),
    (snapshot) => {
      onValue(
        snapshot.docs
          .map((document) => mapCandidateApplication(document.data()))
          .sort((left, right) => left.jobTitle.localeCompare(right.jobTitle)),
      );
    },
    onError,
  );
}

export async function uploadCandidateResume(
  user: User,
  jobId: string,
  file: File,
): Promise<CandidateResumeUpload> {
  if (file.size > candidateResumeMaxFileSizeBytes) {
    throw new Error("Resume/CV must be 5 MB or smaller.");
  }

  if (!allowedResumeContentTypes.has(file.type)) {
    throw new Error("Resume/CV must be a PDF, DOC, or DOCX file.");
  }

  const { storage } = getFirebaseClientServices();
  const sanitizedFileName = sanitizeResumeFileName(file.name);
  const filePath = `candidateResumes/${user.uid}/${jobId}/${Date.now()}-${sanitizedFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  const fileUrl = await getDownloadURL(storageRef);

  return {
    fileName: sanitizedFileName,
    fileUrl,
    filePath,
    contentType: file.type,
    sizeBytes: file.size,
  };
}

export async function applyToCandidateJob(
  user: User,
  profile: CandidateProfile,
  job: GlobalWorkforceJobPost,
  applicationDraft: CandidateApplicationDraft,
  resumeUpload: CandidateResumeUpload,
) {
  const applicationRef = buildCandidateApplicationRef(user.uid, job.id);
  const existingApplication = await getDoc(applicationRef);
  const applicationPayload: CandidateJobApplication = {
    uid: user.uid,
    candidateDisplayId: profile.candidateDisplayId || generateCandidateDisplayId(user.uid),
    jobId: job.id,
    jobTitle: job.title,
    workplace: job.workplace,
    jobType: job.jobType,
    country: job.country,
    status: "applied",
    applicantEmail: profile.email.trim() || user.email || "",
    applicantName: profile.fullName.trim() || user.displayName || "",
    applicantCountry: profile.country.trim(),
    applicantCity: profile.city.trim(),
    applicantPhoneCountryCode: profile.phoneCountryCode.trim(),
    applicantPhoneNumber: profile.phoneNumber.trim(),
    applicantDateOfBirth: profile.dateOfBirth.trim(),
    applicantPhotoUrl: profile.photoUrl.trim(),
    resumeFileName: resumeUpload.fileName,
    resumeFileUrl: resumeUpload.fileUrl,
    resumeFilePath: resumeUpload.filePath,
    resumeContentType: resumeUpload.contentType,
    resumeSizeBytes: resumeUpload.sizeBytes,
    coverLetter: applicationDraft.coverLetter.trim(),
    profileLink: applicationDraft.profileLink.trim(),
    additionalNotes: applicationDraft.additionalNotes.trim(),
  };

  await setDoc(
    applicationRef,
    {
      ...applicationPayload,
      updatedAt: serverTimestamp(),
      ...(existingApplication.exists()
        ? {}
        : {
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true },
  );

  await saveGlobalWorkforceJobApplication(applicationPayload);
}

export async function recordViewedExternalCandidateJob(
  user: User,
  profile: CandidateProfile,
  job: GlobalWorkforceJobPost,
  resumeUpload?: CandidateResumeUpload,
) {
  const applicationRef = buildCandidateApplicationRef(user.uid, job.id);
  const existingApplication = await getDoc(applicationRef);

  if (existingApplication.exists() && existingApplication.data().status === "applied") {
    return;
  }

  const applicationPayload: CandidateJobApplication = {
    uid: user.uid,
    candidateDisplayId: profile.candidateDisplayId || generateCandidateDisplayId(user.uid),
    jobId: job.id,
    jobTitle: job.title,
    workplace: job.workplace,
    jobType: job.jobType,
    country: job.country,
    status: "viewed",
    applicantEmail: profile.email.trim() || user.email || "",
    applicantName: profile.fullName.trim() || user.displayName || "",
    applicantCountry: profile.country.trim(),
    applicantCity: profile.city.trim(),
    applicantPhoneCountryCode: profile.phoneCountryCode.trim(),
    applicantPhoneNumber: profile.phoneNumber.trim(),
    applicantDateOfBirth: profile.dateOfBirth.trim(),
    applicantPhotoUrl: profile.photoUrl.trim(),
    resumeFileName: resumeUpload?.fileName ?? "",
    resumeFileUrl: resumeUpload?.fileUrl ?? "",
    resumeFilePath: resumeUpload?.filePath ?? "",
    resumeContentType: resumeUpload?.contentType ?? "",
    resumeSizeBytes: resumeUpload?.sizeBytes ?? 0,
    coverLetter: "",
    profileLink: "",
    additionalNotes: "External application link opened.",
  };

  await setDoc(
    applicationRef,
    {
      ...applicationPayload,
      updatedAt: serverTimestamp(),
      ...(existingApplication.exists() ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );

  await saveGlobalWorkforceJobApplication(applicationPayload);
}

export async function mirrorCandidateApplicationToGlobalWorkforce(
  application: CandidateJobApplication,
) {
  await saveGlobalWorkforceJobApplication(application);
}

export async function deleteCandidateProfileAndData(uid: string) {
  const { storage } = getFirebaseClientServices();
  const applicationsSnapshot = await getDocs(buildCandidateApplicationsCollection(uid));

  await Promise.all(
    applicationsSnapshot.docs.map(async (document) => {
      const data = document.data();
      const jobId = String(data.jobId ?? "");
      const resumeFilePath = String(data.resumeFilePath ?? "");

      if (resumeFilePath) {
        try {
          await deleteObject(ref(storage, resumeFilePath));
        } catch (error) {
          const code = (error as { code?: string } | undefined)?.code;

          if (code !== "storage/object-not-found") {
            throw error;
          }
        }
      }

      if (jobId) {
        await deleteGlobalWorkforceJobApplication(jobId, uid);
      }

      await deleteDoc(document.ref);
    }),
  );

  await deleteDoc(buildCandidateProfileRef(uid));
}
