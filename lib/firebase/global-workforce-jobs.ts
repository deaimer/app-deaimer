import type { User } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { getFirebaseClientServices } from "@/lib/firebase/client";

export const globalWorkforceJobTypeOptions = [
  "Contract",
  "Full-time",
  "Part-time",
  "Project-based",
] as const;

export const globalWorkforceWorkplaceOptions = [
  "Remote",
  "In office",
] as const;

export const globalWorkforceStatusOptions = [
  "Open",
  "Closed",
  "Paused",
] as const;

export const globalWorkforceSeniorityOptions = [
  "Junior Level",
  "Middle Level",
  "Middle to Senior Level",
  "Senior Level",
  "Lead Level",
] as const;

export const globalWorkforcePayRateOptions = [
  "Hour",
  "Day",
  "Week",
  "Month",
  "Year",
] as const;

export const globalWorkforcePipelineOptions = [
  "Internal",
  "External",
] as const;

export const globalWorkforceApplicationStatusOptions = [
  "viewed",
  "applied",
  "ready-for-projects",
  "not-eligible",
  "under-review",
  "ready-for-contract",
  "pending-ai-interview",
  "message-sent",
] as const;

export type GlobalWorkforceApplicationStatus =
  (typeof globalWorkforceApplicationStatusOptions)[number];

export const worldLanguageOptions = [
  "Abkhazian", "Afar", "Afrikaans", "Akan", "Albanian", "Amharic", "Arabic",
  "Aragonese", "Armenian", "Assamese", "Avaric", "Avestan", "Aymara",
  "Azerbaijani", "Bambara", "Bashkir", "Basque", "Belarusian", "Bengali",
  "Bislama", "Bosnian", "Breton", "Bulgarian", "Burmese", "Catalan",
  "Chamorro", "Chechen", "Chichewa", "Chinese (Cantonese)",
  "Chinese (Mandarin)", "Church Slavonic", "Chuvash", "Cornish", "Corsican",
  "Cree", "Croatian", "Czech", "Danish", "Divehi", "Dutch", "Dzongkha",
  "English", "Esperanto", "Estonian", "Ewe", "Faroese", "Fijian",
  "Filipino (Tagalog)", "Finnish", "French", "Fulah", "Galician", "Ganda",
  "Georgian", "German", "Greek", "Guarani", "Gujarati", "Haitian Creole",
  "Hausa", "Hebrew", "Herero", "Hindi", "Hiri Motu", "Hungarian",
  "Icelandic", "Ido", "Igbo", "Indonesian", "Interlingua", "Interlingue",
  "Inuktitut", "Inupiaq", "Irish", "Italian", "Japanese", "Javanese",
  "Kalaallisut", "Kannada", "Kanuri", "Kashmiri", "Kazakh", "Khmer",
  "Kikuyu", "Kinyarwanda", "Kirundi", "Komi", "Kongo", "Korean", "Kurdish",
  "Kyrgyz", "Lao", "Latin", "Latvian", "Limburgish", "Lingala",
  "Lithuanian", "Luba-Katanga", "Luxembourgish", "Macedonian", "Malagasy",
  "Malay", "Malayalam", "Maltese", "Manx", "Maori", "Marathi", "Marshallese",
  "Mongolian", "Nauru", "Navajo", "Northern Ndebele", "Northern Sami",
  "Norwegian", "Norwegian Bokmal", "Norwegian Nynorsk", "Occitan", "Ojibwa",
  "Oriya", "Oromo", "Ossetian", "Pali", "Pashto", "Persian (Farsi)",
  "Polish", "Portuguese", "Punjabi", "Quechua", "Romanian", "Romansh",
  "Russian", "Samoan", "Sango", "Sanskrit", "Sardinian", "Scottish Gaelic",
  "Serbian", "Shona", "Sichuan Yi", "Sindhi", "Sinhalese", "Slovak",
  "Slovenian", "Somali", "Southern Ndebele", "Southern Sotho", "Spanish",
  "Sundanese", "Swahili", "Swati", "Swedish", "Tahitian", "Tajik", "Tamil",
  "Tatar", "Telugu", "Thai", "Tibetan", "Tigrinya", "Tonga", "Tsonga",
  "Tswana", "Turkish", "Turkmen", "Twi", "Uighur", "Ukrainian", "Urdu",
  "Uzbek", "Venda", "Vietnamese", "Volapuk", "Walloon", "Welsh",
  "Western Frisian", "Wolof", "Xhosa", "Yiddish", "Yoruba", "Zhuang", "Zulu",
] as const;

export interface GlobalWorkforceJobDraft {
  title: string;
  jobType: string;
  workplace: string;
  languages: string[];
  description: string;
  instructions: string;
  keywords: string[];
  status: string;
  countries: string[];
  country: string;
  openings: number;
  seniority: string;
  payMin: number;
  payMax: number;
  payRatePeriod: string;
  pipeline: string;
  referenceId: string;
  referenceLink: string;
  assignedAdminEmails: string[];
}

export interface GlobalWorkforceJobPost extends GlobalWorkforceJobDraft {
  id: string;
  jobId: string;
  compensation: string;
  createdByEmail: string;
  createdByUid: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface GlobalWorkforceJobApplication {
  uid: string;
  candidateDisplayId?: string;
  jobId: string;
  jobTitle: string;
  applicantName: string;
  applicantEmail: string;
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
  coverLetter: string;
  profileLink: string;
  additionalNotes: string;
  status: GlobalWorkforceApplicationStatus;
  commissionApproved?: boolean;
  commissionAmount?: number;
  commissionApprovedByEmail?: string;
  commissionApprovedByUid?: string;
  commissionApprovedAt?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const emptyGlobalWorkforceJobDraft: GlobalWorkforceJobDraft = {
  title: "",
  jobType: globalWorkforceJobTypeOptions[0],
  workplace: globalWorkforceWorkplaceOptions[0],
  languages: [],
  description: "",
  instructions: "",
  keywords: [],
  status: "Open",
  countries: [],
  country: "",
  openings: 1,
  seniority: "Middle to Senior Level",
  payMin: 10,
  payMax: 33,
  payRatePeriod: "Hour",
  pipeline: "Internal",
  referenceId: "",
  referenceLink: "",
  assignedAdminEmails: [],
};

function buildJobPostsCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "globalWorkforce", "workspace", "jobPosts");
}

function buildJobPostRef(jobId: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "globalWorkforce", "workspace", "jobPosts", jobId);
}

function buildJobApplicationsCollection(jobId: string) {
  const { firestore } = getFirebaseClientServices();
  return collection(
    firestore,
    "globalWorkforce",
    "workspace",
    "jobPosts",
    jobId,
    "applications",
  );
}

function buildJobApplicationRef(jobId: string, uid: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(
    firestore,
    "globalWorkforce",
    "workspace",
    "jobPosts",
    jobId,
    "applications",
    uid,
  );
}

function normalizeKeywords(keywords: string[] | null | undefined) {
  const values = Array.isArray(keywords) ? keywords : [];

  return Array.from(
    new Set(
      values
        .map((keyword) => keyword.trim())
        .filter(Boolean),
    ),
  );
}

function unwrapReferenceReturnUrl(referenceLink: string) {
  try {
    const outerUrl = new URL(referenceLink);
    const returnUrl = outerUrl.searchParams.get("return_url");

    if (!returnUrl) {
      return referenceLink;
    }

    return new URL(returnUrl, outerUrl.origin).toString();
  } catch {
    return referenceLink;
  }
}

export function formatGlobalWorkforceCompensation(
  payMin: number,
  payMax: number,
  payRatePeriod: string,
) {
  return `$${payMin} - $${payMax} / ${payRatePeriod.toLowerCase()}`;
}

function mapJobPost(data: DocumentData, id: string): GlobalWorkforceJobPost {
  const payMin = Math.max(0, Number(data.payMin ?? 10));
  const payMax = Math.max(payMin, Number(data.payMax ?? 33));
  const payRatePeriod = String(data.payRatePeriod ?? "Hour");

  return {
    id,
    jobId: String(data.jobId ?? id),
    title: String(data.title ?? ""),
    jobType: String(data.jobType ?? ""),
    workplace: String(data.workplace ?? ""),
    languages: Array.isArray(data.languages)
      ? data.languages.map(String).filter(Boolean)
      : data.language
        ? [String(data.language)]
        : [],
    description: String(data.description ?? ""),
    keywords: normalizeKeywords(data.keywords),
    status: String(data.status ?? "Open"),
    countries: Array.isArray(data.countries)
      ? data.countries.map(String).filter(Boolean)
      : data.country
        ? [String(data.country)]
        : [],
    country: Array.isArray(data.countries) && data.countries.length > 0
      ? String(data.countries[0])
      : String(data.country ?? ""),
    openings: Math.max(1, Number(data.openings ?? 1)),
    seniority: String(data.seniority ?? ""),
    payMin,
    payMax,
    payRatePeriod,
    compensation:
      String(data.compensation ?? "") ||
      formatGlobalWorkforceCompensation(payMin, payMax, payRatePeriod),
    pipeline: String(data.pipeline ?? "Internal"),
    instructions: String(data.instructions ?? ""),
    referenceId: String(data.referenceId ?? ""),
    referenceLink: String(data.referenceLink ?? ""),
    assignedAdminEmails: Array.isArray(data.assignedAdminEmails)
      ? data.assignedAdminEmails.map((e: unknown) => String(e)).filter(Boolean)
      : [],
    createdByEmail: String(data.createdByEmail ?? ""),
    createdByUid: String(data.createdByUid ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapJobApplication(data: DocumentData): GlobalWorkforceJobApplication {
  const rawStatus = String(data.status ?? "applied");
  const status = globalWorkforceApplicationStatusOptions.includes(
    rawStatus as GlobalWorkforceApplicationStatus,
  )
    ? (rawStatus as GlobalWorkforceApplicationStatus)
    : "applied";

  return {
    uid: String(data.uid ?? ""),
    candidateDisplayId: String(data.candidateDisplayId ?? ""),
    jobId: String(data.jobId ?? ""),
    jobTitle: String(data.jobTitle ?? ""),
    applicantName: String(data.applicantName ?? ""),
    applicantEmail: String(data.applicantEmail ?? ""),
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
    status,
    commissionApproved: data.commissionApproved === true,
    commissionAmount: Math.max(0, Math.round(Number(data.commissionAmount ?? 0))),
    commissionApprovedByEmail: String(data.commissionApprovedByEmail ?? ""),
    commissionApprovedByUid: String(data.commissionApprovedByUid ?? ""),
    commissionApprovedAt: data.commissionApprovedAt,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export function generateGlobalWorkforceJobId() {
  const timestampSegment = Date.now().toString().slice(-6);
  const randomSegment = Math.floor(Math.random() * 900 + 100).toString();

  return `${timestampSegment}${randomSegment}`;
}

export async function getGlobalWorkforceJobPost(jobId: string) {
  const snapshot = await getDoc(buildJobPostRef(jobId));

  if (!snapshot.exists()) {
    return null;
  }

  return mapJobPost(snapshot.data(), snapshot.id);
}

export async function saveGlobalWorkforceJobPost(
  user: User,
  draft: GlobalWorkforceJobDraft,
  existingJobId?: string | null,
) {
  const resolvedJobId = existingJobId || generateGlobalWorkforceJobId();
  const existingJob = await getGlobalWorkforceJobPost(resolvedJobId);
  const normalizedKeywords = normalizeKeywords(draft.keywords);
  const payMin = Math.max(0, Math.round(Number(draft.payMin) || 0));
  const payMax = Math.max(payMin, Math.round(Number(draft.payMax) || payMin));
  const compensation = formatGlobalWorkforceCompensation(
    payMin,
    payMax,
    draft.payRatePeriod.trim() || "Hour",
  );

  await setDoc(
    buildJobPostRef(resolvedJobId),
    {
      jobId: resolvedJobId,
      title: draft.title.trim(),
      jobType: draft.jobType.trim(),
      workplace: draft.workplace.trim(),
      languages: draft.languages.filter(Boolean),
      description: draft.description.trim(),
      keywords: normalizedKeywords,
      compensation,
      status: draft.status.trim(),
      countries: draft.countries.filter(Boolean),
      country: draft.countries[0]?.trim() ?? draft.country.trim(),
      openings: Math.max(1, Math.round(Number(draft.openings) || 1)),
      seniority: draft.seniority.trim(),
      payMin,
      payMax,
      payRatePeriod: draft.payRatePeriod.trim(),
      pipeline: draft.pipeline.trim() || "Internal",
      instructions: draft.instructions.trim(),
      referenceId: draft.referenceId.trim(),
      referenceLink: draft.referenceLink.trim(),
      assignedAdminEmails: draft.assignedAdminEmails.filter(Boolean),
      createdByEmail: user.email ?? "",
      createdByUid: user.uid,
      updatedAt: serverTimestamp(),
      ...(existingJob
        ? {}
        : {
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true },
  );

  return getGlobalWorkforceJobPost(resolvedJobId);
}

export function subscribeToGlobalWorkforceJobPosts(
  callback: (jobs: GlobalWorkforceJobPost[]) => void,
  onError?: (error: Error) => void,
) {
  const jobsQuery = query(buildJobPostsCollection(), orderBy("updatedAt", "desc"));

  return onSnapshot(
    jobsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) => mapJobPost(document.data(), document.id)),
      );
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function subscribeToGlobalWorkforceJobApplications(
  jobId: string,
  callback: (applications: GlobalWorkforceJobApplication[]) => void,
  onError?: (error: Error) => void,
) {
  const applicationsQuery = query(
    buildJobApplicationsCollection(jobId),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    applicationsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) => mapJobApplication(document.data())),
      );
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function deleteGlobalWorkforceJobPost(jobId: string) {
  const applicationsSnapshot = await getDocs(buildJobApplicationsCollection(jobId));

  await Promise.all(
    applicationsSnapshot.docs.map((document) => deleteDoc(document.ref)),
  );

  await deleteDoc(buildJobPostRef(jobId));
}

export async function saveGlobalWorkforceJobApplication(
  application: GlobalWorkforceJobApplication,
) {
  const applicationRef = buildJobApplicationRef(application.jobId, application.uid);

  await setDoc(
    applicationRef,
    {
      uid: application.uid,
      candidateDisplayId: application.candidateDisplayId ?? "",
      jobId: application.jobId,
      jobTitle: application.jobTitle,
      applicantName: application.applicantName,
      applicantEmail: application.applicantEmail,
      applicantCountry: application.applicantCountry,
      applicantCity: application.applicantCity,
      applicantPhoneCountryCode: application.applicantPhoneCountryCode,
      applicantPhoneNumber: application.applicantPhoneNumber,
      applicantDateOfBirth: application.applicantDateOfBirth,
      applicantPhotoUrl: application.applicantPhotoUrl,
      resumeFileName: application.resumeFileName,
      resumeFileUrl: application.resumeFileUrl,
      resumeFilePath: application.resumeFilePath,
      resumeContentType: application.resumeContentType,
      resumeSizeBytes: application.resumeSizeBytes,
      coverLetter: application.coverLetter,
      profileLink: application.profileLink,
      additionalNotes: application.additionalNotes,
      status: application.status,
      commissionApproved: application.commissionApproved ?? false,
      commissionAmount: Math.max(0, Math.round(Number(application.commissionAmount ?? 0))),
      commissionApprovedByEmail: application.commissionApprovedByEmail ?? "",
      commissionApprovedByUid: application.commissionApprovedByUid ?? "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function updateGlobalWorkforceJobApplicationStatus(
  jobId: string,
  uid: string,
  status: GlobalWorkforceApplicationStatus,
) {
  const { firestore } = getFirebaseClientServices();
  const timestamp = serverTimestamp();

  await Promise.all([
    setDoc(
      buildJobApplicationRef(jobId, uid),
      {
        status,
        updatedAt: timestamp,
      },
      { merge: true },
    ),
    setDoc(
      doc(firestore, "users", uid, "candidateApplications", jobId),
      {
        status,
        updatedAt: timestamp,
      },
      { merge: true },
    ),
  ]);
}

export async function updateGlobalWorkforceJobApplicationPhone(
  jobId: string,
  uid: string,
  phoneCountryCode: string,
  phoneNumber: string,
) {
  const { firestore } = getFirebaseClientServices();
  const timestamp = serverTimestamp();
  const payload = {
    applicantPhoneCountryCode: phoneCountryCode,
    applicantPhoneNumber: phoneNumber,
    updatedAt: timestamp,
  };

  await Promise.all([
    setDoc(buildJobApplicationRef(jobId, uid), payload, { merge: true }),
    setDoc(
      doc(firestore, "users", uid, "candidateApplications", jobId),
      payload,
      { merge: true },
    ),
  ]);
}

export async function approveGlobalWorkforceJobApplicationCommission(
  user: User,
  jobId: string,
  uid: string,
  commissionAmount: number,
) {
  const timestamp = serverTimestamp();
  const amount = Math.max(0, Math.round(Number(commissionAmount) || 0));
  const payload = {
    commissionApproved: true,
    commissionAmount: amount,
    commissionApprovedByEmail: user.email ?? "",
    commissionApprovedByUid: user.uid,
    commissionApprovedAt: timestamp,
    updatedAt: timestamp,
  };

  await Promise.all([
    setDoc(buildJobApplicationRef(jobId, uid), payload, { merge: true }),
    setDoc(doc(getFirebaseClientServices().firestore, "users", uid, "candidateApplications", jobId), payload, {
      merge: true,
    }),
  ]);
}

export async function assignGlobalWorkforceJobAdmins(
  jobId: string,
  adminEmails: string[],
) {
  await updateDoc(
    buildJobPostRef(jobId),
    { assignedAdminEmails: adminEmails.filter(Boolean), updatedAt: serverTimestamp() },
  );
}

export async function replaceGlobalWorkforceJobReferenceLinks(
  previousReferenceLink: string,
  nextReferenceLink: string,
) {
  const normalizedPrevious = previousReferenceLink.trim();
  const normalizedNext = nextReferenceLink.trim();

  if (!normalizedPrevious || !normalizedNext || normalizedPrevious === normalizedNext) {
    return 0;
  }

  const jobsSnapshot = await getDocs(
    query(buildJobPostsCollection(), where("referenceId", "==", normalizedPrevious)),
  );

  await Promise.all(
    jobsSnapshot.docs.map((document) =>
      updateDoc(document.ref, {
        referenceId: normalizedNext,
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  return jobsSnapshot.size;
}

export async function normalizeGlobalWorkforceJobReferenceLinks() {
  const jobsSnapshot = await getDocs(buildJobPostsCollection());
  const jobsToUpdate = jobsSnapshot.docs
    .map((document) => {
      const currentReferenceLink = String(document.data().referenceId ?? "").trim();
      const normalizedReferenceLink = unwrapReferenceReturnUrl(currentReferenceLink);

      return {
        document,
        currentReferenceLink,
        normalizedReferenceLink,
      };
    })
    .filter(
      (job) =>
        job.currentReferenceLink &&
        job.normalizedReferenceLink &&
        job.currentReferenceLink !== job.normalizedReferenceLink,
    );

  await Promise.all(
    jobsToUpdate.map((job) =>
      updateDoc(job.document.ref, {
        referenceId: job.normalizedReferenceLink,
        updatedAt: serverTimestamp(),
      }),
    ),
  );

  return jobsToUpdate.length;
}

export async function resetGlobalWorkforceJobApplicationCommission(
  jobId: string,
  uid: string,
) {
  const { firestore } = getFirebaseClientServices();
  const timestamp = serverTimestamp();
  const payload = {
    commissionApproved: false,
    commissionAmount: 0,
    commissionApprovedByEmail: "",
    commissionApprovedByUid: "",
    commissionApprovedAt: null,
    updatedAt: timestamp,
  };
  await Promise.all([
    setDoc(buildJobApplicationRef(jobId, uid), payload, { merge: true }),
    setDoc(doc(firestore, "users", uid, "candidateApplications", jobId), payload, { merge: true }),
  ]);
}

export async function deleteGlobalWorkforceJobApplication(
  jobId: string,
  uid: string,
) {
  const { firestore } = getFirebaseClientServices();
  await Promise.all([
    deleteDoc(buildJobApplicationRef(jobId, uid)),
    deleteDoc(doc(firestore, "users", uid, "candidateApplications", jobId)),
  ]);
}
