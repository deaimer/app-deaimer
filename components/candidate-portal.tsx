"use client";

import { ChangeEvent, FormEvent, MouseEvent, ReactNode, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { countryOptions, phoneCountryCodes } from "@/lib/candidates/portal-data";
import {
  candidateAdditionalNotesMaxCharacters,
  candidateCoverLetterMaxCharacters,
  candidateResumeMaxFileSizeBytes,
  createCandidateApplicationDraft,
  type CandidateJobApplication,
  type CandidateApplicationDraft,
  type CandidateProfile,
  type CandidateProfileDraft,
  applyToCandidateJob,
  type CandidateResumeUpload,
  createCandidateProfileDraft,
  deleteCandidateProfileAndData,
  getCandidateProfile,
  mirrorCandidateApplicationToGlobalWorkforce,
  recordViewedExternalCandidateJob,
  saveCandidateProfile,
  subscribeToCandidateApplications,
  uploadCandidateResume,
} from "@/lib/firebase/candidate-portal";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import { FormattedJobDescription } from "@/components/formatted-job-description";
import { DeaimerSiteShell, type PlatformSideMenuItem } from "@/components/deaimer-site-shell";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import {
  globalWorkforcePayRateOptions,
  globalWorkforceSeniorityOptions,
  globalWorkforceStatusOptions,
  globalWorkforceJobTypeOptions,
  globalWorkforceWorkplaceOptions,
  type GlobalWorkforceApplicationStatus,
  type GlobalWorkforceJobPost,
  subscribeToGlobalWorkforceJobPosts,
} from "@/lib/firebase/global-workforce-jobs";
import {
  applyCrowdWork,
  subscribeToCrowdWorkApplicationsByUid,
  subscribeToCrowdWorkPostsPublished,
  type CrowdWorkApplication,
  type CrowdWorkPost,
} from "@/lib/firebase/crowd-work";

type CandidatePortalView =
  | "entry"
  | "home"
  | "jobs"
  | "applications"
  | "saved-roles"
  | "crowd-work"
  | "profile"
  | "settings";
type EmailMode = "signup" | "signin";

const candidateApplicationStatusLabels: Record<GlobalWorkforceApplicationStatus, string> = {
  viewed: "Pending verification",
  applied: "Applied",
  "ready-for-projects": "Ready for Projects",
  "not-eligible": "Not Eligible",
  "under-review": "Under Review",
  "ready-for-contract": "Ready for Contract",
  "pending-ai-interview": "Pending Interview",
  "message-sent": "Message Sent",
};

function getCandidateStatusStyle(status: GlobalWorkforceApplicationStatus) {
  if (status === "applied" || status === "ready-for-projects" || status === "ready-for-contract") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }
  if (status === "not-eligible") {
    return "border-slate-200 bg-slate-100 text-slate-600";
  }
  if (status === "under-review") {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }
  return "border-amber-200 bg-amber-50 text-amber-900";
}

const candidateFieldClassName =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary disabled:cursor-not-allowed disabled:bg-slate-100";

const emptyCandidateProfileDraft: CandidateProfileDraft = {
  candidateDisplayId: "",
  fullName: "",
  email: "",
  country: "",
  city: "",
  phoneCountryCode: "+1",
  phoneNumber: "",
  dateOfBirth: "",
  photoUrl: "",
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
  openToCrowdWork: true,
  profileResume: null,
};

const emptyEmailForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

function getLatestEligibleBirthDate(referenceDate = new Date()) {
  const date = new Date(
    referenceDate.getFullYear(),
    referenceDate.getMonth(),
    referenceDate.getDate(),
  );
  date.setFullYear(date.getFullYear() - 18);
  return date;
}

function formatDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInputValue(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

function validateRequiredCandidateProfileFields(draft: CandidateProfileDraft) {
  const requiredFields = [
    { value: draft.fullName, message: "Enter your full name." },
    { value: draft.email, message: "Enter your email." },
    { value: draft.country, message: "Select your country." },
    { value: draft.city, message: "Enter your city." },
    { value: draft.phoneCountryCode, message: "Select your country code." },
    { value: draft.phoneNumber, message: "Enter your WhatsApp phone number." },
    { value: draft.dateOfBirth, message: "Enter your date of birth." },
  ];
  const missingField = requiredFields.find((field) => !field.value.trim());

  if (missingField) {
    return missingField.message;
  }

  if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) {
    return "Enter a valid email address.";
  }

  const phoneDigits = draft.phoneNumber.replace(/\D/g, "");

  if (phoneDigits.length < 7) {
    return "Enter a valid WhatsApp phone number.";
  }

  const dateOfBirth = parseDateInputValue(draft.dateOfBirth.trim());

  if (!dateOfBirth) {
    return "Enter a valid date of birth.";
  }

  if (dateOfBirth > getLatestEligibleBirthDate()) {
    return "Candidates must be at least 18 years old.";
  }

  return null;
}

function formatJobLanguages(job: Pick<GlobalWorkforceJobPost, "languages">) {
  return job.languages.length > 0 ? job.languages.join(", ") : "Not set";
}

function unwrapReferralReturnUrl(referralLink: string) {
  try {
    const outerUrl = new URL(referralLink);
    const returnUrl = outerUrl.searchParams.get("return_url");

    if (!returnUrl) {
      return referralLink;
    }

    return new URL(returnUrl, outerUrl.origin).toString();
  } catch {
    return referralLink;
  }
}

function resolveExternalApplyLink(referralLink: string, externalJobId: string) {
  const trimmedReferralLink = unwrapReferralReturnUrl(referralLink.trim());
  const trimmedExternalJobId = externalJobId.trim();

  if (!trimmedReferralLink) {
    return "";
  }

  if (!trimmedExternalJobId) {
    return trimmedReferralLink;
  }

  const encodedExternalJobId = encodeURIComponent(trimmedExternalJobId);
  const replacedReferralLink = trimmedReferralLink
    .replaceAll("{{JOB_ID}}", encodedExternalJobId)
    .replaceAll("{JOB_ID}", encodedExternalJobId)
    .replaceAll("[JOB_ID]", encodedExternalJobId)
    .replaceAll("JOB_ID", encodedExternalJobId)
    .replaceAll("job_id", encodedExternalJobId);

  if (replacedReferralLink !== trimmedReferralLink) {
    return replacedReferralLink;
  }

  const [baseUrl, hashFragment] = trimmedReferralLink.split("#", 2);
  const separator = baseUrl.includes("?")
    ? baseUrl.endsWith("?") || baseUrl.endsWith("&")
      ? ""
      : "&"
    : "?";
  const resolvedUrl = `${baseUrl}${separator}jobid=${encodedExternalJobId}`;

  return hashFragment === undefined ? resolvedUrl : `${resolvedUrl}#${hashFragment}`;
}

const candidatePlatformMenuItems: PlatformSideMenuItem[] = [
  { label: "Work", isSectionHeader: true },
  {
    label: "Jobs",
    href: "/candidates/jobs",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="7" width="20" height="14" rx="2" />
        <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    label: "Crowd Work",
    href: "/candidates/crowd-work",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    label: "Applications",
    href: "/candidates/applications",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="1" />
        <path d="m9 12 2 2 4-4" />
      </svg>
    ),
  },
  {
    label: "Saved roles",
    href: "/candidates/saved-roles",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
      </svg>
    ),
  },
  { label: "Personal", isSectionHeader: true },
  {
    label: "Profile",
    href: "/candidates/profile",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 20a8 8 0 0 1 16 0" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/candidates/settings",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-[15px] w-[15px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
  },
];

type CandidatePlaceholderCard = {
  title: string;
  body: string;
};


const candidateWorkspacePlaceholderContent: Record<
  "saved-roles",
  {
    eyebrow: string;
    title: string;
    description: string;
    cards: CandidatePlaceholderCard[];
  }
> = {
  "saved-roles": {
    eyebrow: "Saved roles",
    title: "Build a shortlist you can revisit any time",
    description:
      "Keep interesting openings in one place, compare fit, and come back when you are ready to apply.",
    cards: [
      {
        title: "Role watchlist",
        body: "Bookmark roles you want to revisit later and keep your shortlist organized.",
      },
      {
        title: "Comparison notes",
        body: "Add quick notes about compensation, location, and required skills before you decide.",
      },
      {
        title: "Apply when ready",
        body: "Move saved jobs back into your active pipeline when the timing makes sense.",
      },
    ],
  },
};

const candidateHomeTabSummaries = [
  {
    href: "/candidates/jobs",
    label: "Jobs",
    body: "Browse live openings, review full role details, and apply from one focused board.",
  },
  {
    href: "/candidates/applications",
    label: "Applications",
    body: "Track every submitted application, resume file, and cover letter in one place.",
  },
  {
    href: "/candidates/saved-roles",
    label: "Saved roles",
    body: "Keep promising openings in your shortlist so you can revisit them later.",
  },
  {
    href: "/candidates/crowd-work",
    label: "Crowd Work",
    body: "Short paid tasks — audio recording, annotation, transcription — matched to your profile.",
  },
  {
    href: "/candidates/profile",
    label: "Profile",
    body: "Keep your personal details, photo, phone number, and location ready for new applications.",
  },
  {
    href: "/candidates/settings",
    label: "Settings",
    body: "Manage account preferences and account-level controls.",
  },
] as const;


function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#4285F4"
        d="M21.6 12.23c0-.76-.07-1.49-.19-2.2H12v4.16h5.38a4.6 4.6 0 0 1-1.99 3.02v2.69h3.23c1.89-1.74 2.98-4.3 2.98-7.67Z"
      />
      <path
        fill="#34A853"
        d="M12 22c2.7 0 4.96-.89 6.62-2.4l-3.23-2.69c-.9.6-2.04.95-3.39.95-2.6 0-4.81-1.76-5.6-4.12H3.06v2.78A10 10 0 0 0 12 22Z"
      />
      <path
        fill="#FBBC05"
        d="M6.4 13.74a6 6 0 0 1 0-3.48V7.48H3.06a10.01 10.01 0 0 0 0 9.04l3.34-2.78Z"
      />
      <path
        fill="#EA4335"
        d="M12 6.14c1.47 0 2.79.51 3.83 1.5l2.86-2.86A9.6 9.6 0 0 0 12 2 10 10 0 0 0 3.06 7.48l3.34 2.78c.79-2.36 3-4.12 5.6-4.12Z"
      />
    </svg>
  );
}

function LoadingSpinner({
  className = "h-5 w-5 border-current border-r-transparent",
}: {
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex animate-spin rounded-full border-2 ${className}`}
    />
  );
}

async function resizeProfileImage(file: File) {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== "string") {
        reject(new Error("We could not read this image file."));
        return;
      }

      const previewImage = new window.Image();

      previewImage.onload = () => {
        const canvas = document.createElement("canvas");
        const maxSize = 320;
        // Keep the uploaded photo light enough to store safely in Firestore.
        const scale = Math.min(
          maxSize / previewImage.width,
          maxSize / previewImage.height,
          1,
        );
        const width = Math.max(1, Math.round(previewImage.width * scale));
        const height = Math.max(1, Math.round(previewImage.height * scale));
        const context = canvas.getContext("2d");

        if (!context) {
          reject(new Error("We could not prepare this image."));
          return;
        }

        canvas.width = width;
        canvas.height = height;
        context.drawImage(previewImage, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      };

      previewImage.onerror = () => {
        reject(new Error("We could not load this image."));
      };

      previewImage.src = reader.result;
    };

    reader.onerror = () => {
      reject(new Error("We could not read this image file."));
    };

    reader.readAsDataURL(file);
  });

  return dataUrl;
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${Math.max(1, Math.round(sizeBytes / 1024))} KB`;
}

function CandidateApplicationFormCard({
  job,
  applicationDraft,
  resumeFile,
  onClose,
  onDraftChange,
  onResumeChange,
  onSubmit,
  isSubmitting,
  isApplied = false,
  cancelHref = "/candidates/jobs",
}: {
  job: GlobalWorkforceJobPost;
  applicationDraft: CandidateApplicationDraft;
  resumeFile: File | null;
  onClose: () => void;
  onDraftChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onResumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isApplied?: boolean;
  cancelHref?: string;
}) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white shadow-panel">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Apply
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">{job.title}</h2>
            <p className="mt-2 text-sm text-muted">
              Upload your resume/CV and add a short cover letter for this role.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-ink transition hover:bg-panelStrong"
            aria-label="Close application form"
          >
            ×
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Job ID</p>
              <p className="mt-2 text-sm font-semibold text-ink">{job.jobId}</p>
            </div>
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Role</p>
              <p className="mt-2 text-sm font-semibold text-ink">{job.title}</p>
            </div>
          </div>

          <div className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-ink">Resume / CV</p>
                <p className="mt-1 text-sm leading-6 text-muted">
                  PDF, DOC, or DOCX only. Max size {formatFileSize(candidateResumeMaxFileSizeBytes)}.
                </p>
              </div>

              <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  onChange={onResumeChange}
                  className="sr-only"
                />
                {resumeFile ? "Change file" : "Upload file"}
              </label>
            </div>

            {resumeFile ? (
              <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                {resumeFile.name} ({formatFileSize(resumeFile.size)})
              </div>
            ) : (
              <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-muted">
                No file selected yet.
              </div>
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Cover letter</span>
            <textarea
              name="coverLetter"
              value={applicationDraft.coverLetter}
              onChange={onDraftChange}
              rows={8}
              maxLength={candidateCoverLetterMaxCharacters}
              className={`${candidateFieldClassName} min-h-[180px] resize-y`}
              placeholder="Write a clear, short cover letter about why you're a fit for this role."
            />
            <p className="mt-2 text-xs text-muted">
              {applicationDraft.coverLetter.length}/{candidateCoverLetterMaxCharacters} characters
            </p>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                LinkedIn or portfolio link
              </span>
              <input
                name="profileLink"
                value={applicationDraft.profileLink}
                onChange={onDraftChange}
                className={candidateFieldClassName}
                placeholder="https://linkedin.com/in/yourname"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">
                Additional notes
              </span>
              <textarea
                name="additionalNotes"
                value={applicationDraft.additionalNotes}
                onChange={onDraftChange}
                rows={4}
                maxLength={candidateAdditionalNotesMaxCharacters}
                className={`${candidateFieldClassName} min-h-[120px] resize-y`}
                placeholder="Availability, notice period, or any useful extra context."
              />
              <p className="mt-2 text-xs text-muted">
                {applicationDraft.additionalNotes.length}/{candidateAdditionalNotesMaxCharacters} characters
              </p>
            </label>
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? <LoadingSpinner /> : null}
              {isSubmitting ? "Submitting application..." : "Submit application"}
            </button>
          </div>
        </form>
    </section>
  );
}

function CandidateApplicationPageCard({
  job,
  applicationDraft,
  resumeFile,
  onDraftChange,
  onResumeChange,
  onSubmit,
  isSubmitting,
  isApplied = false,
}: {
  job: GlobalWorkforceJobPost;
  applicationDraft: CandidateApplicationDraft;
  resumeFile: File | null;
  onDraftChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onResumeChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  isSubmitting: boolean;
  isApplied?: boolean;
}) {
  return (
    <section className="rounded-[1.6rem] border border-slate-200 bg-white shadow-panel">
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
            Apply
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{job.title}</h2>
          <p className="mt-2 text-sm text-muted">
            Upload your resume/CV and add a short cover letter for this role.
          </p>
        </div>

        <Link
          href={`/candidates/jobs/${job.id}`}
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-panelStrong"
        >
          Back to job
        </Link>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 px-6 py-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Job ID</p>
            <p className="mt-2 text-sm font-semibold text-ink">{job.jobId}</p>
          </div>
          <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Role</p>
            <p className="mt-2 text-sm font-semibold text-ink">{job.title}</p>
          </div>
        </div>

        <div className="rounded-[1.2rem] border border-slate-200 bg-white p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-ink">Resume / CV</p>
              <p className="mt-1 text-sm leading-6 text-muted">
                PDF, DOC, or DOCX only. Max size {formatFileSize(candidateResumeMaxFileSizeBytes)}.
              </p>
            </div>

            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-panelStrong">
              <input
                type="file"
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={onResumeChange}
                className="sr-only"
              />
              {resumeFile ? "Change file" : "Upload file"}
            </label>
          </div>

          {resumeFile ? (
            <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {resumeFile.name} ({formatFileSize(resumeFile.size)})
            </div>
          ) : (
            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-muted">
              No file selected yet.
            </div>
          )}
        </div>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-ink">Cover letter</span>
          <textarea
            name="coverLetter"
            value={applicationDraft.coverLetter}
            onChange={onDraftChange}
            rows={8}
            maxLength={candidateCoverLetterMaxCharacters}
            className={`${candidateFieldClassName} min-h-[180px] resize-y`}
            placeholder="Write a clear, short cover letter about why you're a fit for this role."
          />
          <p className="mt-2 text-xs text-muted">
            {applicationDraft.coverLetter.length}/{candidateCoverLetterMaxCharacters} characters
          </p>
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              LinkedIn or portfolio link
            </span>
            <input
              name="profileLink"
              value={applicationDraft.profileLink}
              onChange={onDraftChange}
              className={candidateFieldClassName}
              placeholder="https://linkedin.com/in/yourname"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              Additional notes
            </span>
            <textarea
              name="additionalNotes"
              value={applicationDraft.additionalNotes}
              onChange={onDraftChange}
              rows={4}
              maxLength={candidateAdditionalNotesMaxCharacters}
              className={`${candidateFieldClassName} min-h-[120px] resize-y`}
              placeholder="Availability, notice period, or any useful extra context."
            />
            <p className="mt-2 text-xs text-muted">
              {applicationDraft.additionalNotes.length}/{candidateAdditionalNotesMaxCharacters} characters
            </p>
          </label>
        </div>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link
            href={`/candidates/jobs/${job.id}`}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={isSubmitting || isApplied}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? <LoadingSpinner /> : null}
            {isApplied ? "Already applied" : isSubmitting ? "Submitting application..." : "Submit application"}
          </button>
        </div>
      </form>
    </section>
  );
}

function CandidateJobRow({
  job,
  isApplied,
  isViewed,
  isSelected,
  onSelect,
}: {
  job: GlobalWorkforceJobPost;
  isApplied: boolean;
  isViewed: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "block w-full border-b border-slate-100 px-4 py-3.5 text-left transition",
        isSelected ? "bg-[#eaf4ff]" : "bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <article className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary">
          {job.title.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{job.title}</p>
            {isApplied ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                Applied
              </span>
            ) : isViewed && !isApplied ? (
              <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                Viewed
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {job.compensation} · {job.country}
          </p>
        </div>
      </article>
    </button>
  );
}

function CandidateApplicationRow({
  application,
}: {
  application: CandidateJobApplication;
}) {
  return (
    <Link
      href={`/candidates/applications/${application.jobId}`}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-primary/20 hover:bg-[#f9fbff]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {application.jobTitle.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <span
          className={[
            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            getCandidateStatusStyle(application.status),
          ].join(" ")}
        >
          {candidateApplicationStatusLabels[application.status]}
        </span>
        <p className="mt-1 text-sm font-semibold text-ink">{application.jobTitle}</p>
        <p className="mt-0.5 text-xs text-muted">
          {application.jobType} · {application.workplace} · {application.country}
        </p>
      </div>
    </Link>
  );
}

function CandidateApplicationDetailCard({
  application,
}: {
  application: CandidateJobApplication;
}) {
  return (
    <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/candidates/applications"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary"
          >
            <span aria-hidden="true">&larr;</span>
            Back to applications
          </Link>
          <p className="mt-5 text-xs font-semibold uppercase tracking-[0.2em] text-primarySoft">
            {application.status === "viewed" ? "External role" : "Applied"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink">{application.jobTitle}</h1>
          <p className="mt-3 text-sm text-muted">
            {application.jobType} · {application.workplace} · {application.country}
          </p>
        </div>

        <span
          className={[
            "inline-flex w-fit items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
            getCandidateStatusStyle(application.status),
          ].join(" ")}
        >
          {candidateApplicationStatusLabels[application.status]}
        </span>
      </div>

      <div className="mt-6 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted">
          Documents submitted for this job
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          {application.resumeFileUrl ? (
            <a
              href={application.resumeFileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
            >
              {application.resumeFileName ? `View ${application.resumeFileName}` : "View resume"}
            </a>
          ) : (
            <span className="text-sm text-muted">
              No resume/CV was submitted through this portal.
            </span>
          )}
          {application.profileLink ? (
            <a
              href={application.profileLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
            >
              Open profile link
            </a>
          ) : null}
        </div>
      </div>

      {application.status === "viewed" ? (
        <div className="mt-6 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
          You opened the external application link for this role. Our team will verify and update your status once your application is confirmed with the partner.
        </div>
      ) : application.additionalNotes === "External application link opened." && !application.resumeFileUrl && !application.profileLink ? (
        <div className="mt-6 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
          This role was posted through a partner platform. Your application has been verified and confirmed by our team. No documents were collected through this portal.
        </div>
      ) : (
        <>
          {false && application.resumeFileUrl ? (
            <div className="mt-6">
              <a
                href={application.resumeFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                View resume
              </a>
            </div>
          ) : null}

          <div className="mt-6 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
            <p className="text-xs uppercase tracking-[0.18em] text-muted">Cover letter</p>
            <p className="mt-2 text-sm leading-7 text-ink">
              {application.coverLetter || "No cover letter submitted."}
            </p>
          </div>

          {application.additionalNotes ? (
            <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted">Additional notes</p>
              <p className="mt-2 text-sm leading-7 text-ink">{application.additionalNotes}</p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}



const crowdStatusRowBadge: Record<string, string> = {
  viewed: "bg-slate-100 text-slate-500",
  applied: "bg-emerald-100 text-emerald-800",
  "under-review": "bg-sky-100 text-sky-800",
  approved: "bg-emerald-100 text-emerald-800",
  rejected: "bg-rose-100 text-rose-700",
};
const crowdStatusRowLabel: Record<string, string> = {
  viewed: "Viewed",
  applied: "Applied",
  "under-review": "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

function CandidateCrowdWorkRow({
  post,
  isSelected,
  status,
  onSelect,
}: {
  post: CrowdWorkPost;
  isSelected: boolean;
  status?: string | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "block w-full border-b border-slate-100 px-4 py-3.5 text-left transition",
        isSelected ? "bg-[#eaf4ff]" : "bg-white hover:bg-slate-50",
      ].join(" ")}
    >
      <article className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-[13px] font-bold text-primary">
          {post.title.slice(0, 1).toUpperCase() || "C"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-ink">{post.title}</p>
            {status ? (
              <span className={`shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${status === "viewed" ? crowdStatusRowBadge.viewed : crowdStatusRowBadge.applied}`}>
                {status === "viewed" ? "Viewed" : "Applied"}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-muted">
            {post.payPerSession > 0 ? `${post.payCurrency} ${post.payPerSession}/session` : "Pay TBD"}
            {post.taskType ? ` · ${post.taskType}` : ""}
          </p>
        </div>
      </article>
    </button>
  );
}

function CandidateCrowdApplicationRow({ app }: { app: CrowdWorkApplication }) {
  const crowdStatusLabel: Record<string, string> = {
    viewed: "Viewed",
    applied: "Applied",
    "under-review": "Under Review",
    approved: "Approved",
    rejected: "Rejected",
  };
  const crowdStatusStyle: Record<string, string> = {
    viewed: "border-slate-200 bg-slate-50 text-slate-600",
    applied: "border-amber-200 bg-amber-50 text-amber-900",
    "under-review": "border-sky-200 bg-sky-50 text-sky-900",
    approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
    rejected: "border-rose-200 bg-rose-50 text-rose-700",
  };
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {app.postTitle.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={["inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", crowdStatusStyle[app.status] ?? crowdStatusStyle.viewed].join(" ")}>
            {crowdStatusLabel[app.status] ?? app.status}
          </span>
          <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700">
            Crowd
          </span>
        </div>
        <p className="mt-1 text-sm font-semibold text-ink">{app.postTitle}</p>
        <p className="mt-0.5 text-xs text-muted">{app.postId}</p>
      </div>
    </div>
  );
}

const crowdDetailStatusBadge: Record<string, string> = {
  viewed: "border-slate-200 bg-slate-50 text-slate-600",
  applied: "border-amber-200 bg-amber-50 text-amber-900",
  "under-review": "border-sky-200 bg-sky-50 text-sky-900",
  approved: "border-emerald-200 bg-emerald-50 text-emerald-900",
  rejected: "border-rose-200 bg-rose-50 text-rose-700",
};
const crowdDetailStatusLabel: Record<string, string> = {
  viewed: "Viewed",
  applied: "Applied",
  "under-review": "Under Review",
  approved: "Approved",
  rejected: "Rejected",
};

function CandidateCrowdWorkDetailCard({
  post,
  application = null,
  onApply,
}: {
  post: CrowdWorkPost;
  application?: CrowdWorkApplication | null;
  onApply?: () => void;
}) {
  const status = application?.status ?? null;
  const isLocked = status === "applied" || status === "under-review" || status === "approved" || status === "rejected";

  const taskInfoItems = [
    { label: "Project ID", value: post.postId || "—" },
    { label: "Task type", value: post.taskType || "—" },
    { label: "Pay/session", value: post.payPerSession > 0 ? `${post.payCurrency} ${post.payPerSession}` : "TBD" },
    { label: "Duration", value: post.estimatedMinutesPerSession > 0 ? `~${post.estimatedMinutesPerSession} min` : "TBD" },
    { label: "Sessions", value: post.totalSessionsNeeded > 0 ? post.totalSessionsNeeded.toLocaleString() : "TBD" },
    { label: "Countries", value: post.countries.length === 0 || post.countries.includes("Worldwide") ? "Worldwide" : post.countries.join(", ") },
    ...(post.ethnicity ? [{ label: "Ethnicity", value: post.ethnicity }] : []),
  ];

  return (
    <div className="space-y-5">
      {/* Apply / status — always first */}
      <div className="flex flex-wrap items-center gap-2">
        {status ? (
          <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${status === "viewed" ? "border-slate-200 bg-slate-50 text-slate-600" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {status === "viewed" ? "Viewed" : "Applied"}
          </span>
        ) : null}
        {isLocked ? (
          <span className="inline-flex min-w-[100px] cursor-not-allowed items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-5 py-2 text-sm font-semibold text-slate-400">
            Apply
          </span>
        ) : (
          <Link
            href={`/candidates/crowd-work/${post.id}/apply`}
            onClick={onApply}
            className="inline-flex min-w-[100px] items-center justify-center rounded-full bg-primary px-5 py-2 text-sm font-semibold text-white transition hover:bg-primaryStrong"
          >
            Apply
          </Link>
        )}
      </div>

      {/* Title + meta */}
      <div>
        <h2 className="text-2xl font-semibold leading-snug text-ink sm:text-3xl">{post.title}</h2>
        <div
          className="mt-2 flex items-center gap-x-3 gap-y-1 overflow-x-auto text-sm text-muted [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
          style={{ scrollbarWidth: "none" }}
        >
          {post.payPerSession > 0 ? (
            <span className="shrink-0">{post.payCurrency} {post.payPerSession}/session</span>
          ) : null}
          {post.taskType ? (
            <><span className="shrink-0 text-slate-200">·</span><span className="shrink-0">{post.taskType}</span></>
          ) : null}
          {post.estimatedMinutesPerSession > 0 ? (
            <><span className="shrink-0 text-slate-200">·</span><span className="shrink-0">~{post.estimatedMinutesPerSession} min/session</span></>
          ) : null}
        </div>
      </div>

      {/* Task info pills */}
      <div className="space-y-2">
        {/* Mobile: scrollable */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden sm:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Task info:</span>
          {taskInfoItems.map((item) => (
            <span key={item.label} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted">
              {item.label}: <span className="font-semibold text-ink">{item.value}</span>
            </span>
          ))}
        </div>
        {/* Desktop: wrapping */}
        <div className="hidden sm:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Task info</p>
          <div className="flex flex-wrap gap-1.5">
            {taskInfoItems.map((item) => (
              <span key={item.label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted">
                {item.label}: <span className="font-semibold text-ink">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Languages pills */}
        {post.languages.length > 0 ? (
          <>
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden sm:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Languages:</span>
              {post.languages.map((l) => (
                <span key={l} className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{l}</span>
              ))}
              {post.dialects.map((d) => (
                <span key={d} className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted">{d}</span>
              ))}
            </div>
            <div className="hidden sm:block">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Languages</p>
              <div className="flex flex-wrap gap-1.5">
                {post.languages.map((l) => (
                  <span key={l} className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800">{l}</span>
                ))}
                {post.dialects.map((d) => (
                  <span key={d} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted">{d}</span>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Description */}
      {post.description ? (
        <div className="border-t border-slate-100 pt-5">
          <FormattedJobDescription content={post.description} />
        </div>
      ) : null}

    </div>
  );
}

function CandidateSavedRoleRow({
  job,
  isApplied,
  isViewed,
}: {
  job: GlobalWorkforceJobPost;
  isApplied: boolean;
  isViewed: boolean;
}) {
  return (
    <Link
      href={`/candidates/saved-roles/${job.id}`}
      className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 transition hover:border-primary/20 hover:bg-[#f9fbff]"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
        {job.title.slice(0, 1).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm font-semibold text-ink">{job.title}</p>
          {isApplied ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
              Applied
            </span>
          ) : isViewed && !isApplied ? (
            <span className="inline-flex shrink-0 items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600">
              Viewed
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted">
          {job.compensation} · {job.country}
        </p>
      </div>
    </Link>
  );
}

function CandidateJobDetailCard({
  job,
  isApplied,
  isViewed,
  isApplying,
  onApply,
  isSaved = false,
  onToggleSave,
}: {
  job: GlobalWorkforceJobPost;
  isApplied: boolean;
  isViewed: boolean;
  isApplying: boolean;
  onApply: () => void;
  isSaved?: boolean;
  onToggleSave?: () => void;
}) {
  const isOpen = job.status === "Open";
  const isExternal = job.pipeline === "External";
  const applyLabel = isExternal
    ? isApplied
      ? "Applied"
      : isOpen
        ? "Apply"
        : job.status === "Paused"
          ? "Applications paused"
          : "Closed"
    : isApplied
      ? "Applied"
      : isApplying
        ? "Submitting..."
        : isOpen
          ? "Apply"
          : job.status === "Paused"
            ? "Applications paused"
            : "Closed";

  const detailItems = [
    {
      label: isExternal ? "External Job ID" : "Job ID",
      value: isExternal && job.referenceLink ? job.referenceLink : job.jobId,
    },
    { label: "Job type", value: job.jobType },
    { label: "Workplace", value: job.workplace },
    { label: "Languages", value: formatJobLanguages(job) },
    { label: "Country", value: job.country },
    { label: "Openings", value: String(job.openings) },
  ];

  return (
    <div className="space-y-5">
      {/* Actions — always first */}
      <div className="flex flex-wrap items-center gap-2">
        {isViewed && !isApplied ? (
          <span className="text-xs font-medium text-muted">Viewed ·</span>
        ) : null}
        <button
          type="button"
          onClick={onApply}
          disabled={isExternal ? (!isOpen || isApplied) : (!isOpen || isApplied || isApplying)}
          className={[
            "inline-flex min-w-[100px] items-center justify-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60",
            isApplied && !isExternal
              ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
              : isOpen
                ? "bg-primary text-white hover:bg-primaryStrong"
                : "border border-slate-200 bg-panelStrong text-muted",
          ].join(" ")}
        >
          {isApplying ? <LoadingSpinner className="h-4 w-4 border-current border-r-transparent" /> : null}
          {applyLabel}
        </button>
        <button
          type="button"
          onClick={onToggleSave}
          className={[
            "inline-flex min-w-[80px] items-center justify-center rounded-full border px-5 py-2 text-sm font-semibold transition",
            isSaved
              ? "border-primary/30 bg-primary/10 text-primary"
              : "border-slate-200 bg-white text-ink hover:bg-slate-50",
          ].join(" ")}
        >
          {isSaved ? "Saved" : "Save"}
        </button>
      </div>

      {/* Title + meta */}
      <div>
        <h2 className="text-2xl font-semibold leading-snug text-ink sm:text-3xl">{job.title}</h2>
        <div
          className="mt-2 flex items-center gap-x-3 gap-y-1 overflow-x-auto text-sm text-muted [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:overflow-visible"
          style={{ scrollbarWidth: "none" }}
        >
          {job.compensation ? <span className="shrink-0 sm:shrink">{job.compensation}</span> : null}
          {job.seniority ? <><span className="shrink-0 text-slate-200 sm:shrink">·</span><span className="shrink-0 sm:shrink">{job.seniority}</span></> : null}
          {job.country ? <><span className="shrink-0 text-slate-200 sm:shrink">·</span><span className="shrink-0 sm:shrink">{job.country}</span></> : null}
          {job.workplace ? <><span className="shrink-0 text-slate-200 sm:shrink">·</span><span className="shrink-0 sm:shrink">{job.workplace}</span></> : null}
          {isExternal ? <><span className="shrink-0 text-slate-200 sm:shrink">·</span><span className="shrink-0 sm:shrink">External</span></> : null}
        </div>
      </div>

      {/* Job info + Keywords — grouped tightly */}
      <div className="space-y-2">
        {/* Job info — Mobile: inline label + scrollable pills */}
        <div
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden sm:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Job info:</span>
          {detailItems.map((item) => (
            <span
              key={item.label}
              className="shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted"
            >
              {item.label}: <span className="font-semibold text-ink">{item.value}</span>
            </span>
          ))}
        </div>
        {/* Job info — Desktop: label on its own line, pills wrap */}
        <div className="hidden sm:block">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Job info</p>
          <div className="flex flex-wrap gap-1.5">
            {detailItems.map((item) => (
              <span
                key={item.label}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-muted"
              >
                {item.label}: <span className="font-semibold text-ink">{item.value}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Keywords — Mobile: inline label + scrollable pills */}
        {job.keywords.length > 0 ? (
          <>
            <div
              className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden sm:hidden"
              style={{ scrollbarWidth: "none" }}
            >
              <span className="shrink-0 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Keywords:</span>
              {job.keywords.map((keyword) => (
                <span
                  key={keyword}
                  className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                >
                  {keyword}
                </span>
              ))}
            </div>
            {/* Keywords — Desktop: label on its own line, pills wrap */}
            <div className="hidden sm:block">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {job.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      {/* Description */}
      <div className="border-t border-slate-100 pt-5">
        <FormattedJobDescription content={job.description} />
      </div>
    </div>
  );
}


function CandidateWorkspaceMetric({
  label,
  value,
  hint,
  className = "",
}: {
  label: string;
  value: string;
  hint: string;
  className?: string;
}) {
  return (
    <article className={["rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-5", className].join(" ")}>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60 sm:text-[11px]">{label}</p>
      <p className="mt-1.5 text-2xl font-light tabular-nums tracking-tight text-ink sm:mt-2.5 sm:text-4xl">{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted sm:mt-2 sm:text-xs">{hint}</p>
    </article>
  );
}

function CandidateProfileField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 text-muted">{value}</dd>
    </div>
  );
}

export function CandidatePortal({
  view,
  allowProfileEdit = false,
  selectedJobId,
  applyMode = false,
  instructionsMode = false,
  selectedApplicationJobId,
  selectedSavedJobId,
  selectedCrowdPostId,
  crowdApplyMode = false,
}: {
  view: CandidatePortalView;
  allowProfileEdit?: boolean;
  selectedJobId?: string;
  applyMode?: boolean;
  instructionsMode?: boolean;
  selectedApplicationJobId?: string;
  selectedSavedJobId?: string;
  selectedCrowdPostId?: string;
  crowdApplyMode?: boolean;
}) {
  const router = useRouter();
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();
  const isEditRequested = view === "entry" && allowProfileEdit;
  const isHomeView = view === "home";
  const isJobsView = view === "jobs";
  const isSavedRolesView = view === "saved-roles";
  const isSettingsView = view === "settings";
  const isJobInstructionsView = isJobsView && Boolean(selectedJobId) && instructionsMode;
  const isJobApplyView = isJobsView && Boolean(selectedJobId) && applyMode;
  const isJobDetailView = isJobsView && Boolean(selectedJobId) && !applyMode && !instructionsMode;
  const isApplicationsView = view === "applications";
  const isApplicationDetailView = isApplicationsView && Boolean(selectedApplicationJobId);
  const isProfileView = view === "profile";
  const isCrowdWorkView = view === "crowd-work" && !crowdApplyMode;
  const isCrowdApplyView = view === "crowd-work" && Boolean(selectedCrowdPostId) && crowdApplyMode;
  const isWorkspaceView = view !== "entry";
  const shouldLoadApplications =
    isHomeView || isJobsView || isApplicationsView || isSavedRolesView || isProfileView;
  const shouldLoadJobs = isHomeView || isJobsView || isSavedRolesView;

  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [draft, setDraft] = useState<CandidateProfileDraft>(emptyCandidateProfileDraft);
  const [jobs, setJobs] = useState<GlobalWorkforceJobPost[]>([]);
  const [applications, setApplications] = useState<CandidateJobApplication[]>([]);
  const [applicationDraft, setApplicationDraft] = useState<CandidateApplicationDraft>(
    createCandidateApplicationDraft(),
  );
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [externalResumeFile, setExternalResumeFile] = useState<File | null>(null);
  const [showInstructionsPanel, setShowInstructionsPanel] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileResolved, setIsProfileResolved] = useState(false);
  const [resolvedProfileUid, setResolvedProfileUid] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(
    view === "entry" && allowProfileEdit,
  );
  const [isDeletingProfile, setIsDeletingProfile] = useState(false);
  const [isRedirectingToJobs, setIsRedirectingToJobs] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isApplicationsLoading, setIsApplicationsLoading] = useState(false);
  const [isJobsLoading, setIsJobsLoading] = useState(false);
  const [crowdWorkPosts, setCrowdWorkPosts] = useState<CrowdWorkPost[]>([]);
  const [crowdWorkApplications, setCrowdWorkApplications] = useState<CrowdWorkApplication[]>([]);
  const [isCrowdWorkLoading, setIsCrowdWorkLoading] = useState(false);
  const [selectedBoardCrowdWorkId, setSelectedBoardCrowdWorkId] = useState<string | null>(null);
  const [mobileCrowdWorkDrawerId, setMobileCrowdWorkDrawerId] = useState<string | null>(null);
  const [crowdWorkSearchQuery, setCrowdWorkSearchQuery] = useState("");
  const [crowdWorkTypeFilter, setCrowdWorkTypeFilter] = useState("all");
  const [crowdWorkLangFilter, setCrowdWorkLangFilter] = useState("all");
  const crowdWorkFiltersScrollRef = useRef<HTMLDivElement | null>(null);
  const [isSubmittingCrowdApply, setIsSubmittingCrowdApply] = useState(false);
  const [crowdApplyDone, setCrowdApplyDone] = useState(false);
  const [googleFormOpened, setGoogleFormOpened] = useState(false);
  const [applyingJobId, setApplyingJobId] = useState<string | null>(null);
  const [emailMode, setEmailMode] = useState<EmailMode>("signup");
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [isWhatsappNumberConfirmed, setIsWhatsappNumberConfirmed] = useState(false);
  const [isPoliciesAccepted, setIsPoliciesAccepted] = useState(false);
  const [jobSearchQuery, setJobSearchQuery] = useState("");
  const [jobCountryFilter, setJobCountryFilter] = useState("all");
  const countryFilterAutoSetRef = useRef(false);
  const [jobWorkplaceFilter, setJobWorkplaceFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [jobLanguageFilter, setJobLanguageFilter] = useState("all");
  const [jobSeniorityFilter, setJobSeniorityFilter] = useState("all");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobRatePeriodFilter, setJobRatePeriodFilter] = useState("all");
  const [jobPayMinFilter, setJobPayMinFilter] = useState("");
  const [jobPayMaxFilter, setJobPayMaxFilter] = useState("");
  const [selectedBoardJobId, setSelectedBoardJobId] = useState<string | null>(null);
  const [mobileDrawerJobId, setMobileDrawerJobId] = useState<string | null>(null);
  const [savedJobIds, setSavedJobIds] = useState<string[]>([]);
  const [viewedExternalJobIds, setViewedExternalJobIds] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [candidateTheme, setCandidateTheme] = useState<"light" | "dark">("light");
  const jobFiltersScrollRef = useRef<HTMLDivElement | null>(null);
  const mirroredApplicationKeysRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted || typeof window === "undefined") return;
    const stored = window.localStorage.getItem("deaimer-candidate-theme");
    if (stored === "dark" || stored === "light") setCandidateTheme(stored);
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem("deaimer-candidate-saved-jobs");

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setSavedJobIds(parsed.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // Ignore broken local storage payloads and keep the UI usable.
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || typeof window === "undefined") {
      return;
    }

    try {
      const stored = window.localStorage.getItem("deaimer-candidate-viewed-external-jobs");

      if (!stored) {
        return;
      }

      const parsed = JSON.parse(stored);

      if (Array.isArray(parsed)) {
        setViewedExternalJobIds(parsed.filter((value): value is string => typeof value === "string"));
      }
    } catch {
      // Ignore broken local storage payloads and keep the UI usable.
    }
  }, [hasMounted]);

  useEffect(() => {
    if (!hasMounted || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "deaimer-candidate-saved-jobs",
      JSON.stringify(savedJobIds),
    );
  }, [hasMounted, savedJobIds]);

  useEffect(() => {
    if (!hasMounted || typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(
      "deaimer-candidate-viewed-external-jobs",
      JSON.stringify(viewedExternalJobIds),
    );
  }, [hasMounted, viewedExternalJobIds]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (!firebaseReady) {
      setAuthReady(true);
      setIsAuthResolving(false);
      return;
    }

    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    async function initializeAuth() {
      setAuthReady(false);
      setIsAuthResolving(true);
      const { auth } = getFirebaseClientServices();
      const existingUser = auth.currentUser;

      if (existingUser) {
        setActiveUser(existingUser);
        setAuthReady(true);
        setIsAuthResolving(false);
        setIsSigningIn(false);
        setIsProfileLoading(true);
        setIsProfileResolved(false);
      }

      try {
        await ensureFirebaseAuthPersistence();
        await resolveFirebaseRedirectSignIn();
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Google sign in did not complete. Please try again.",
          );
        }
      }

      if (cancelled) {
        return;
      }

      unsubscribe = onAuthStateChanged(auth, (user) => {
        if (cancelled) {
          return;
        }

        setActiveUser(user);
        setAuthReady(true);
        setIsAuthResolving(false);
        setIsSigningIn(false);

        if (!user) {
          setProfile(null);
          setJobs([]);
          setApplications([]);
          setResolvedProfileUid(null);
          setIsProfileLoading(false);
          setIsProfileResolved(true);
          setSuccessMessage(null);
          return;
        }

        setResolvedProfileUid(null);
        setIsProfileLoading(true);
        setIsProfileResolved(false);
        setErrorMessage(null);
      });
    }

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseReady, hasMounted]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady || !activeUser) {
      setProfile(null);
      setDraft(activeUser ? createCandidateProfileDraft(activeUser) : emptyCandidateProfileDraft);
      setResolvedProfileUid(null);
      setIsProfileLoading(false);
      setIsProfileResolved(true);
      return;
    }

    let cancelled = false;
    const currentUser = activeUser;

    async function loadProfile() {
      setIsProfileLoading(true);
      setIsProfileResolved(false);

      try {
        const existingProfile = await getCandidateProfile(currentUser.uid);

        if (cancelled) {
          return;
        }

        setProfile(existingProfile);
        setDraft(existingProfile ?? createCandidateProfileDraft(currentUser));
        setIsWhatsappNumberConfirmed(Boolean(existingProfile?.phoneNumber));
        setResolvedProfileUid(currentUser.uid);
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "We could not load your candidate profile.",
          );
          setResolvedProfileUid(currentUser.uid);
        }
      } finally {
        if (!cancelled) {
          setIsProfileLoading(false);
          setIsProfileResolved(true);
        }
      }
    }

    void loadProfile();

    return () => {
      cancelled = true;
    };
  }, [activeUser, firebaseReady, hasMounted]);

  useEffect(() => {
    if (!profile?.country || countryFilterAutoSetRef.current) {
      return;
    }
    countryFilterAutoSetRef.current = true;
    setJobCountryFilter(profile.country);
  }, [profile]);

  useEffect(() => {
    if (!shouldLoadApplications || !firebaseReady || !activeUser) {
      setApplications([]);
      setIsApplicationsLoading(false);
      return;
    }

    setIsApplicationsLoading(true);

    return subscribeToCandidateApplications(
      activeUser.uid,
      (nextApplications) => {
        setApplications(nextApplications);
        setIsApplicationsLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsApplicationsLoading(false);
      },
    );
  }, [activeUser, firebaseReady, shouldLoadApplications]);

  useEffect(() => {
    if (!shouldLoadJobs || !firebaseReady || !activeUser) {
      setJobs([]);
      setIsJobsLoading(false);
      return;
    }

    setIsJobsLoading(true);

    return subscribeToGlobalWorkforceJobPosts(
      (nextJobs) => {
        setJobs(nextJobs);
        setIsJobsLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsJobsLoading(false);
      },
    );
  }, [activeUser, firebaseReady, shouldLoadJobs]);

  useEffect(() => {
    if ((!isCrowdWorkView && !isCrowdApplyView) || !firebaseReady) {
      setCrowdWorkPosts([]);
      setIsCrowdWorkLoading(false);
      return;
    }
    setIsCrowdWorkLoading(true);
    return subscribeToCrowdWorkPostsPublished(
      (posts) => {
        setCrowdWorkPosts(posts);
        setIsCrowdWorkLoading(false);
      },
      () => setIsCrowdWorkLoading(false),
    );
  }, [firebaseReady, isCrowdWorkView, isCrowdApplyView]);

  useEffect(() => {
    if ((!isCrowdWorkView && !isCrowdApplyView && !isApplicationsView) || !firebaseReady || !activeUser) {
      setCrowdWorkApplications([]);
      return;
    }
    return subscribeToCrowdWorkApplicationsByUid(
      activeUser.uid,
      setCrowdWorkApplications,
      () => {},
    );
  }, [activeUser, firebaseReady, isCrowdWorkView, isCrowdApplyView, isApplicationsView]);

  useEffect(() => {
    if (!firebaseReady || !activeUser || applications.length === 0) {
      return;
    }

    applications.forEach((application) => {
      const mirrorKey = `${application.jobId}-${application.status}`;

      if (mirroredApplicationKeysRef.current.has(mirrorKey)) {
        return;
      }

      mirroredApplicationKeysRef.current.add(mirrorKey);

      void mirrorCandidateApplicationToGlobalWorkforce(application).catch(() => {
        mirroredApplicationKeysRef.current.delete(mirrorKey);
      });
    });
  }, [activeUser, applications, firebaseReady]);

  useEffect(() => {
    if (
      !hasMounted ||
      !authReady ||
      !activeUser ||
      resolvedProfileUid !== activeUser.uid ||
      !isProfileResolved ||
      isProfileLoading ||
      !firebaseReady
    ) {
      return;
    }

    if (view === "entry" && profile && (!isEditRequested || isRedirectingToJobs)) {
      router.replace("/candidates/home");
      return;
    }

    if (isWorkspaceView && !isProfileView && !profile) {
      router.replace("/candidates");
      return;
    }

  }, [
    activeUser,
    authReady,
    firebaseReady,
    hasMounted,
    isProfileView,
    isWorkspaceView,
    isEditRequested,
    isProfileLoading,
    isRedirectingToJobs,
    isProfileResolved,
    profile,
    resolvedProfileUid,
    router,
    view,
  ]);

  async function handleGoogleSignIn() {
    if (!firebaseReady) {
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const { auth, googleProvider } = getFirebaseClientServices();
      await signInWithGoogle(auth, googleProvider);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Google sign in did not complete. Please try again.",
      );
    } finally {
      setIsSigningIn(false);
    }
  }

  function handleDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = event.target;

    if (name === "phoneNumber" || name === "phoneCountryCode") {
      setIsWhatsappNumberConfirmed(false);
    }

    setDraft((current) => ({
      ...current,
      [name]: type === "checkbox" ? (event.target as HTMLInputElement).checked : value,
    }));
  }

  function handleEmailFormChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    setEmailForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleProfilePhotoChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    setIsUploadingPhoto(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const photoUrl = await resizeProfileImage(file);
      setDraft((current) => ({
        ...current,
        photoUrl,
      }));
      setSuccessMessage("Profile photo added. Save your profile when you are ready.");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not upload that image.",
      );
    } finally {
      setIsUploadingPhoto(false);
    }
  }

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseReady) {
      return;
    }

    const email = emailForm.email.trim().toLowerCase();

    if (!email) {
      setErrorMessage("Enter your email first.");
      return;
    }

    if (!emailForm.password) {
      setErrorMessage("Enter your password first.");
      return;
    }

    if (emailMode === "signup" && emailForm.password !== emailForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsEmailBusy(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await ensureFirebaseAuthPersistence();
      const { auth } = getFirebaseClientServices();

      if (emailMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, emailForm.password);
      } else {
        await signInWithEmailAndPassword(auth, email, emailForm.password);
      }

      setEmailForm(emptyEmailForm);
      setSuccessMessage(
        emailMode === "signup"
          ? "Account created. Finish your profile to continue."
          : "Signed in successfully.",
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Email sign in did not complete.",
      );
    } finally {
      setIsEmailBusy(false);
    }
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeUser) {
      setErrorMessage("Sign in first to save your profile.");
      return;
    }

    const validationError = validateRequiredCandidateProfileFields(draft);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    if (!isWhatsappNumberConfirmed) {
      setErrorMessage("Confirm that your phone number is available on WhatsApp.");
      return;
    }

    if (!isPoliciesAccepted) {
      setErrorMessage("You must accept the Deaimer Privacy & Data Policy to continue.");
      return;
    }

    setIsSavingProfile(true);
    setIsRedirectingToJobs(false);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const savedProfile = await saveCandidateProfile(activeUser, draft);
      setProfile(savedProfile);
      setDraft(savedProfile ?? draft);
      setResolvedProfileUid(activeUser.uid);
      setIsEditingProfile(false);

      if (isProfileView) {
        setIsRedirectingToJobs(false);
        setSuccessMessage("Profile updated successfully.");
        return;
      }

      setIsRedirectingToJobs(true);
      setSuccessMessage("Profile saved. Opening your candidate portal...");
      router.replace("/candidates/home");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save your candidate profile.",
      );
      setIsRedirectingToJobs(false);
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handleDeleteProfile() {
    if (!activeUser || !profile) {
      return;
    }

    const confirmed = window.confirm(
      "Delete your candidate profile, applications, uploaded resumes, and saved role data? This cannot be undone.",
    );

    if (!confirmed) {
      return;
    }

    setIsDeletingProfile(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteCandidateProfileAndData(activeUser.uid);

      if (typeof window !== "undefined") {
        window.localStorage.removeItem("deaimer-candidate-saved-jobs");
      }

      const { auth } = getFirebaseClientServices();

      setSavedJobIds([]);
      setApplications([]);
      setJobs([]);
      setProfile(null);
      setDraft(createCandidateProfileDraft(activeUser));
      setIsWhatsappNumberConfirmed(false);
      setIsPoliciesAccepted(false);
      setResolvedProfileUid(null);
      setIsEditingProfile(false);
      setIsRedirectingToJobs(false);

      await signOut(auth);
      router.replace("/candidates");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not delete your candidate profile right now.",
      );
    } finally {
      setIsDeletingProfile(false);
    }
  }

  function handleApplicationDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setApplicationDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleResumeFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (file.size > candidateResumeMaxFileSizeBytes) {
      setErrorMessage("Resume/CV must be 5 MB or smaller.");
      return;
    }

    setResumeFile(file);
    setErrorMessage(null);
  }

  function openApplicationPage(jobId: string) {
    setApplicationDraft(createCandidateApplicationDraft());
    setResumeFile(null);
    setErrorMessage(null);
    setSuccessMessage(null);
    const targetJob = jobs.find((j) => j.id === jobId);
    if (targetJob?.pipeline === "External") {
      router.push(`/candidates/jobs/${jobId}/instructions`);
    } else {
      router.push(`/candidates/jobs/${jobId}/apply`);
    }
  }

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeUser || !profile) {
      return;
    }

    const jobForApplication = jobs.find((job) => job.id === selectedJobId);

    if (!jobForApplication) {
      return;
    }

    if (!resumeFile) {
      setErrorMessage("Upload your resume/CV before submitting.");
      return;
    }

    if (!applicationDraft.coverLetter.trim()) {
      setErrorMessage("Add a cover letter before submitting.");
      return;
    }

    if (applicationDraft.coverLetter.length > candidateCoverLetterMaxCharacters) {
      setErrorMessage("Cover letter is too long.");
      return;
    }

    if (applicationDraft.additionalNotes.length > candidateAdditionalNotesMaxCharacters) {
      setErrorMessage("Additional notes are too long.");
      return;
    }

    setApplyingJobId(jobForApplication.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const resumeUpload = await uploadCandidateResume(
        activeUser,
        jobForApplication.id,
        resumeFile,
      );
      await applyToCandidateJob(
        activeUser,
        profile,
        jobForApplication,
        applicationDraft,
        resumeUpload,
      );
      setSuccessMessage(`Application submitted for ${jobForApplication.title}.`);
      router.replace("/candidates/applications");
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not submit your application right now.",
      );
    } finally {
      setApplyingJobId(null);
    }
  }

  async function handleSignOut() {
    if (!firebaseReady) {
      return;
    }

    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setActiveUser(null);
    setProfile(null);
    setApplications([]);
    setDraft(emptyCandidateProfileDraft);
    setEmailForm(emptyEmailForm);
    setIsWhatsappNumberConfirmed(false);
    setIsPoliciesAccepted(false);
    setResolvedProfileUid(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (isWorkspaceView || isEditRequested) {
      router.replace("/candidates");
    }
  }

  function clearJobFilters() {
    setJobSearchQuery("");
    setJobCountryFilter("all");
    setJobWorkplaceFilter("all");
    setJobTypeFilter("all");
    setJobLanguageFilter("all");
    setJobSeniorityFilter("all");
    setJobStatusFilter("all");
    setJobRatePeriodFilter("all");
    setJobPayMinFilter("");
    setJobPayMaxFilter("");
  }

  function scrollJobFilters(direction: "left" | "right") {
    const container = jobFiltersScrollRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  }

  function toggleSavedJob(jobId: string) {
    setSavedJobIds((current) =>
      current.includes(jobId)
        ? current.filter((savedJobId) => savedJobId !== jobId)
        : [...current, jobId],
    );
  }

  function markExternalJobViewed(jobId: string) {
    setViewedExternalJobIds((current) =>
      current.includes(jobId) ? current : [...current, jobId],
    );
  }

  function handleThemeChange(theme: "light" | "dark") {
    setCandidateTheme(theme);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("deaimer-candidate-theme", theme);
    }
  }

  async function handleExternalApplyClick(
    event: MouseEvent<HTMLAnchorElement>,
    job: GlobalWorkforceJobPost,
    applyUrl: string,
  ) {
    event.preventDefault();

    // Open URL immediately (before any await) so browsers don't treat it as a blocked popup
    if (typeof window !== "undefined") {
      window.open(applyUrl, "_blank", "noopener,noreferrer");
    }

    if (!activeUser || !profile) {
      return;
    }

    setApplyingJobId(job.id);
    setErrorMessage(null);

    try {
      let resumeUpload: CandidateResumeUpload | undefined;
      if (externalResumeFile) {
        resumeUpload = await uploadCandidateResume(activeUser, job.id, externalResumeFile);
      }
      await recordViewedExternalCandidateJob(activeUser, profile, job, resumeUpload);
      markExternalJobViewed(job.id);
      setExternalResumeFile(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save that you viewed this external application.",
      );
    } finally {
      setApplyingJobId(null);
    }
  }

  const profilePreviewName =
    draft.fullName || activeUser?.displayName || activeUser?.email || "Candidate";
  const appliedJobIds = new Set(
    applications
      .filter((application) => application.status !== "viewed")
      .map((application) => application.jobId),
  );
  const viewedExternalJobIdSet = new Set(viewedExternalJobIds);
  applications
    .filter((application) => application.status === "viewed")
    .forEach((application) => viewedExternalJobIdSet.add(application.jobId));
  const savedJobs = jobs.filter((job) => savedJobIds.includes(job.id));
  const selectedSavedJob =
    selectedSavedJobId
      ? savedJobs.find((job) => job.id === selectedSavedJobId) ?? null
      : null;
  const selectedApplication =
    selectedApplicationJobId
      ? applications.find((application) => application.jobId === selectedApplicationJobId) ?? null
      : null;
  const visibleJobs = jobs.filter(
    (job) => job.status !== "Closed" || appliedJobIds.has(job.id),
  );
  const jobCountryOptions = Array.from(
    new Set(visibleJobs.map((job) => job.country).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
  const jobLanguageOptions = Array.from(
    new Set(visibleJobs.flatMap((job) => job.languages).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
  const filteredJobs = visibleJobs.filter((job) => {
    const normalizedSearchQuery = jobSearchQuery.trim().toLowerCase();
    const searchableValue = [
      job.jobId,
      job.referenceLink,
      job.title,
      job.country,
      ...job.languages,
      job.jobType,
      job.workplace,
      job.seniority,
      job.status,
      job.compensation,
      ...job.keywords,
    ]
      .join(" ")
      .toLowerCase();

    if (normalizedSearchQuery && !searchableValue.includes(normalizedSearchQuery)) {
      return false;
    }

    if (jobCountryFilter !== "all" && job.country !== "Worldwide" && job.country !== jobCountryFilter) {
      return false;
    }

    if (jobWorkplaceFilter !== "all" && job.workplace !== jobWorkplaceFilter) {
      return false;
    }

    if (jobTypeFilter !== "all" && job.jobType !== jobTypeFilter) {
      return false;
    }

    if (jobLanguageFilter !== "all" && !job.languages.includes(jobLanguageFilter)) {
      return false;
    }

    if (jobSeniorityFilter !== "all" && job.seniority !== jobSeniorityFilter) {
      return false;
    }

    if (jobStatusFilter !== "all" && job.status !== jobStatusFilter) {
      return false;
    }

    if (jobRatePeriodFilter !== "all" && job.payRatePeriod !== jobRatePeriodFilter) {
      return false;
    }

    const minimumRequestedPay = Number(jobPayMinFilter);
    if (jobPayMinFilter && Number.isFinite(minimumRequestedPay) && job.payMax < minimumRequestedPay) {
      return false;
    }

    const maximumRequestedPay = Number(jobPayMaxFilter);
    if (jobPayMaxFilter && Number.isFinite(maximumRequestedPay) && job.payMin > maximumRequestedPay) {
      return false;
    }

    return true;
  });
  const selectedBoardJob =
    filteredJobs.find((job) => job.id === selectedBoardJobId) ?? filteredJobs[0] ?? null;
  const mobileDrawerJob = mobileDrawerJobId
    ? filteredJobs.find((job) => job.id === mobileDrawerJobId) ?? null
    : null;
  const selectedCandidateJob = selectedJobId
    ? jobs.find((job) => job.id === selectedJobId) ?? null
    : null;
  const isStandaloneProfilePage = Boolean(activeUser || isEditRequested);
  const isCurrentUserProfileResolved =
    Boolean(activeUser) &&
    resolvedProfileUid === activeUser?.uid &&
    isProfileResolved &&
    !isProfileLoading;
  const isCreatingCandidateProfile =
    Boolean(activeUser) &&
    isCurrentUserProfileResolved &&
    !profile;
  const latestEligibleBirthDateInputValue = formatDateInputValue(
    getLatestEligibleBirthDate(),
  );
  const applicationCount = applications.length;
  const submittedDocumentsCount = applications.filter(
    (application) => Boolean(application.resumeFileUrl),
  ).length;
  const uniqueApplicationCountries = new Set(
    applications.map((application) => application.country).filter(Boolean),
  ).size;
  const candidateShellUserProfile = activeUser
    ? {
        name:
          draft.fullName ||
          profile?.fullName ||
          activeUser.displayName ||
          activeUser.email?.split("@")[0] ||
          "Candidate",
        href: "/candidates/profile",
        imageUrl: draft.photoUrl || profile?.photoUrl || activeUser.photoURL,
      }
    : undefined;
  const candidateShellSideMenuItems = activeUser
    ? candidatePlatformMenuItems.filter(
        (item) => item.label !== "Documents" && item.href !== "/candidates/documents",
      )
    : undefined;
  const shouldShowProfileForm =
    Boolean(activeUser) &&
    (!profile || isEditingProfile || isEditRequested);
  const shouldShowProfileSummary =
    Boolean(activeUser) &&
    Boolean(profile) &&
    !isEditingProfile &&
    !isEditRequested;

  useEffect(() => {
    if (filteredJobs.length === 0) {
      setSelectedBoardJobId(null);
      return;
    }

    setSelectedBoardJobId((current) =>
      current && filteredJobs.some((job) => job.id === current)
        ? current
        : filteredJobs[0]?.id ?? null,
    );
  }, [filteredJobs]);

  // ── Crowd Work board computed values ──────────────────────────────────────
  const crowdWorkTypeOptions = Array.from(
    new Set(crowdWorkPosts.map((p) => p.taskType).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const crowdWorkLangOptions = Array.from(
    new Set(crowdWorkPosts.flatMap((p) => p.languages).filter(Boolean)),
  ).sort((a, b) => a.localeCompare(b));
  const filteredCrowdWorkPosts = crowdWorkPosts.filter((p) => {
    const q = crowdWorkSearchQuery.trim().toLowerCase();
    if (q && !([p.title, p.taskType, p.description, p.postId].join(" ").toLowerCase().includes(q))) return false;
    if (crowdWorkTypeFilter !== "all" && p.taskType !== crowdWorkTypeFilter) return false;
    if (crowdWorkLangFilter !== "all" && !p.languages.includes(crowdWorkLangFilter)) return false;
    return true;
  });
  const selectedBoardCrowdWork =
    filteredCrowdWorkPosts.find((p) => p.id === selectedBoardCrowdWorkId) ??
    filteredCrowdWorkPosts[0] ??
    null;
  const mobileCrowdWorkPost = mobileCrowdWorkDrawerId
    ? crowdWorkPosts.find((p) => p.id === mobileCrowdWorkDrawerId) ?? null
    : null;
  const crowdWorkApplicationMap = new Map(
    crowdWorkApplications.map((a) => [a.postDocId, a])
  );
  const crowdApplyPost = selectedCrowdPostId
    ? crowdWorkPosts.find((p) => p.id === selectedCrowdPostId) ?? null
    : null;
  const crowdApplyPostApplication = selectedCrowdPostId
    ? crowdWorkApplicationMap.get(selectedCrowdPostId) ?? null
    : null;

  useEffect(() => {
    if (filteredCrowdWorkPosts.length === 0) {
      setSelectedBoardCrowdWorkId(null);
      return;
    }
    setSelectedBoardCrowdWorkId((current) =>
      current && filteredCrowdWorkPosts.some((p) => p.id === current)
        ? current
        : filteredCrowdWorkPosts[0]?.id ?? null,
    );
  }, [filteredCrowdWorkPosts]);

  function clearCrowdWorkFilters() {
    setCrowdWorkSearchQuery("");
    setCrowdWorkTypeFilter("all");
    setCrowdWorkLangFilter("all");
  }

  async function submitCrowdApply() {
    if (!crowdApplyPost || !activeUser) return;
    const hasForm = Boolean(crowdApplyPost.googleFormUrl?.trim());
    setIsSubmittingCrowdApply(true);
    try {
      if (hasForm) {
        window.open(crowdApplyPost.googleFormUrl, "_blank", "noopener,noreferrer");
        await applyCrowdWork(
          crowdApplyPost.id,
          crowdApplyPost.postId,
          crowdApplyPost.title,
          activeUser.uid,
          profile?.fullName?.trim() || activeUser.displayName || activeUser.email || "",
          activeUser.email ?? "",
          profile ? `${profile.phoneCountryCode ?? ""}${profile.phoneNumber ?? ""}`.trim() : "",
          "viewed",
        );
        setGoogleFormOpened(true);
      } else {
        await applyCrowdWork(
          crowdApplyPost.id,
          crowdApplyPost.postId,
          crowdApplyPost.title,
          activeUser.uid,
          profile?.fullName?.trim() || activeUser.displayName || activeUser.email || "",
          activeUser.email ?? "",
          profile ? `${profile.phoneCountryCode ?? ""}${profile.phoneNumber ?? ""}`.trim() : "",
          "applied",
        );
        setCrowdApplyDone(true);
      }
    } catch {
      if (hasForm) setGoogleFormOpened(true); else setCrowdApplyDone(true);
    } finally {
      setIsSubmittingCrowdApply(false);
    }
  }

  function scrollCrowdWorkFilters(direction: "left" | "right") {
    const container = crowdWorkFiltersScrollRef.current;
    if (!container) return;
    container.scrollBy({ left: direction === "left" ? -240 : 240, behavior: "smooth" });
  }

  const themeClass = candidateTheme === "dark" ? "cand-dark" : "";

  function shell(content: ReactNode): ReactNode {
    const siteShell = (
      <DeaimerSiteShell
        platformSideMenuItems={candidateShellSideMenuItems}
        userProfile={candidateShellUserProfile}
        onSignOut={() => void handleSignOut()}
        themeToggle={{
          theme: candidateTheme,
          onToggle: () => handleThemeChange(candidateTheme === "dark" ? "light" : "dark"),
        }}
      >
        {content}
      </DeaimerSiteShell>
    );
    return themeClass ? <div className={themeClass}>{siteShell}</div> : siteShell;
  }

  function renderCandidateWorkspacePage({
    eyebrow,
    title,
    description,
    children,
    primaryActionHref,
    primaryActionLabel,
  }: {
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    primaryActionHref?: string;
    primaryActionLabel?: string;
  }) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          {errorMessage ? (
            <div className="mb-6 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mb-6 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
              {successMessage}
            </div>
          ) : null}

          {children}
        </div>
      </main>
    );
  }

  if (!hasMounted) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-6xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="rounded-[1.25rem] border border-slate-200 bg-white px-6 py-5 text-sm text-muted">
            Preparing candidate portal...
          </div>
        </div>
      </main>
    );
  }

  if (isWorkspaceView && (!authReady || isAuthResolving)) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-muted">
              <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
              <span>Opening your candidate workspace...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isWorkspaceView && !activeUser) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <section className="w-full max-w-2xl rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primarySoft">
              Candidate workspace
            </p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight text-ink">
              Sign in to open your candidate workspace
            </h1>
            <p className="mt-5 text-base leading-8 text-muted">
              Your jobs, applications, messages, and profile tools are available after
              you sign in and complete your candidate profile.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/candidates"
                className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Go to candidate sign in
              </a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  if (
    isWorkspaceView &&
    !isProfileView &&
    activeUser &&
    !isCurrentUserProfileResolved
  ) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-muted">
              <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
              <span>Opening your candidate workspace...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (
    isWorkspaceView &&
    !isProfileView &&
    activeUser &&
    isCurrentUserProfileResolved &&
    !profile
  ) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5">
            <div className="flex items-center gap-3 text-sm text-muted">
              <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
              <span>Finish your candidate profile to continue...</span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (isHomeView && activeUser) {
    const firstName =
      profile?.fullName.split(" ")[0] ||
      activeUser.displayName?.split(" ")[0] ||
      "there";

    return renderCandidateWorkspacePage({
      eyebrow: "Home",
      title: "",
      description: "",
      children: (
        <div className="space-y-6">
          {/* Hero welcome banner */}
          <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-8 py-10 sm:px-10 sm:py-12">
            <div className="relative z-10">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
                Candidate portal
              </p>
              <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
                Welcome back, {firstName}
              </h1>
              <p className="mt-3 max-w-lg text-sm leading-7 text-white/75">
                Browse open roles, track your applications, and manage your profile — all in one place.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/candidates/jobs"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
                >
                  Browse jobs
                </Link>
                <Link
                  href="/candidates/profile"
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  {profile?.fullName ? "View profile" : "Complete profile"}
                </Link>
              </div>
            </div>
            <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 right-16 h-32 w-32 rounded-full bg-white/5" />
          </section>

          {/* Metrics */}
          <div className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0" style={{ scrollbarWidth: "none" }}>
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 xl:w-auto"
              label="Open roles"
              value={String(
                (() => {
                  const cc = profile?.country?.trim();
                  return cc
                    ? visibleJobs.filter((j) => !j.country || j.country === "Worldwide" || j.country === cc).length
                    : visibleJobs.length;
                })(),
              ).padStart(2, "0")}
              hint={
                profile?.country?.trim()
                  ? `Live job posts available for you in ${profile.country}.`
                  : "Live job posts currently available for you to apply to."
              }
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 xl:w-auto"
              label="Applications"
              value={String(applicationCount).padStart(2, "0")}
              hint="Roles tracked in your candidate pipeline."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 xl:w-auto"
              label="Saved roles"
              value={String(savedJobs.length).padStart(2, "0")}
              hint="Roles you bookmarked from the jobs board."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 xl:w-auto"
              label="Profile"
              value={profile?.fullName ? "Ready" : "Pending"}
              hint="Your candidate profile status."
            />
          </div>

          {/* Quick-access cards */}
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
            {candidateHomeTabSummaries.map((tab) => {
              const isJobs = tab.label === "Jobs";
              return isJobs ? (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primaryStrong p-3 sm:p-5"
                >
                  <div className="relative z-10">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{tab.label}</p>
                      <span className="shrink-0 text-white/60 transition group-hover:text-white">→</span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-white/75">{tab.body}</p>
                  </div>
                  <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-5 h-20 w-20 rounded-full bg-white/10" />
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-3 right-8 h-12 w-12 rounded-full bg-white/5" />
                </Link>
              ) : (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className="group rounded-xl border border-slate-200 bg-white p-3 transition hover:border-primary/25 hover:bg-[#f9fbff] sm:p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-ink">{tab.label}</p>
                    <span className="shrink-0 text-muted/40 transition group-hover:text-primary">→</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">{tab.body}</p>
                </Link>
              );
            })}
          </div>
        </div>
      ),
    });
  }

  if (isJobDetailView && activeUser) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          {/* Page-level back link — always at the top */}
          <div className="mb-5">
            <Link
              href="/candidates/jobs"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
              >
                <span aria-hidden="true">←</span>
                All jobs
              </Link>
            </div>

            {errorMessage ? (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-6 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
                {successMessage}
              </div>
            ) : null}

            {isJobsLoading && !selectedCandidateJob ? (
              <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
                <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                <span>Loading job details...</span>
              </div>
            ) : null}

            {!isJobsLoading && !selectedCandidateJob ? (
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                  Job not found
                </p>
                <h1 className="mt-4 text-3xl font-semibold text-ink">This role is no longer available here</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                  The job may have been removed or the link may be incorrect. Head back to the jobs board to browse current openings.
                </p>
                <div className="mt-6">
                  <Link
                    href="/candidates/jobs"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Back to jobs
                  </Link>
                </div>
              </section>
            ) : null}

            {selectedCandidateJob ? (
              <CandidateJobDetailCard
                job={selectedCandidateJob}
                isApplied={appliedJobIds.has(selectedCandidateJob.id)}
                isViewed={viewedExternalJobIdSet.has(selectedCandidateJob.id)}
                isApplying={applyingJobId === selectedCandidateJob.id}
                onApply={() => openApplicationPage(selectedCandidateJob.id)}
                isSaved={savedJobIds.includes(selectedCandidateJob.id)}
                onToggleSave={() => toggleSavedJob(selectedCandidateJob.id)}
              />
            ) : null}
        </div>
      </main>
    );
  }

  if (isJobsView && !selectedJobId && activeUser) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="lg:mx-auto lg:max-w-[1440px] lg:px-6 lg:py-8 xl:px-10">
            {errorMessage ? (
              <div className="mx-4 mb-4 mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900 lg:mx-0 lg:mb-6 lg:mt-0">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mx-4 mb-4 mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900 lg:mx-0 lg:mb-6 lg:mt-0">
                {successMessage}
              </div>
            ) : null}

            <section className="bg-white lg:overflow-hidden lg:rounded-[1.85rem] lg:border lg:border-slate-200">
              {/* Filter bar */}
              <div className="border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
                {/* Search — full width on mobile only */}
                <div className="mb-2.5 sm:hidden">
                  <input
                    value={jobSearchQuery}
                    onChange={(event) => setJobSearchQuery(event.target.value)}
                    className={[
                      "h-11 w-full rounded-full border px-4 text-sm font-medium outline-none transition",
                      jobSearchQuery
                        ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                        : "border-slate-300 bg-white text-ink placeholder:text-muted",
                    ].join(" ")}
                    placeholder="Search jobs"
                  />
                </div>
                {/* Scrollable filters row */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => scrollJobFilters("left")}
                    aria-label="Scroll filters left"
                    className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white h-11 w-11 text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <div
                    ref={jobFiltersScrollRef}
                    className="overflow-x-auto py-1 sm:px-14 [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none" }}
                  >
                    <div className="flex min-w-max items-center gap-2.5">
                      {/* Search — in scroll row on sm+ only */}
                      <input
                        value={jobSearchQuery}
                        onChange={(event) => setJobSearchQuery(event.target.value)}
                        className={[
                          "hidden h-11 w-[220px] rounded-full border px-4 text-sm font-medium outline-none transition sm:block",
                          jobSearchQuery
                            ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                            : "border-slate-300 bg-white text-ink placeholder:text-muted",
                        ].join(" ")}
                        placeholder="Search jobs"
                      />
                      <select
                        value={jobCountryFilter}
                        onChange={(event) => setJobCountryFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[130px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobCountryFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Location</option>
                        {jobCountryOptions.map((country) => (
                          <option key={country} value={country}>{country}</option>
                        ))}
                      </select>
                      <select
                        value={jobWorkplaceFilter}
                        onChange={(event) => setJobWorkplaceFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[130px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobWorkplaceFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Remote</option>
                        {globalWorkforceWorkplaceOptions.map((workplace) => (
                          <option key={workplace} value={workplace}>{workplace}</option>
                        ))}
                      </select>
                      <select
                        value={jobTypeFilter}
                        onChange={(event) => setJobTypeFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[180px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobTypeFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Job type</option>
                        {globalWorkforceJobTypeOptions.map((jobType) => (
                          <option key={jobType} value={jobType}>{jobType}</option>
                        ))}
                      </select>
                      <select
                        value={jobSeniorityFilter}
                        onChange={(event) => setJobSeniorityFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[180px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobSeniorityFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Seniority</option>
                        {globalWorkforceSeniorityOptions.map((seniority) => (
                          <option key={seniority} value={seniority}>{seniority}</option>
                        ))}
                      </select>
                      <select
                        value={jobLanguageFilter}
                        onChange={(event) => setJobLanguageFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[130px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobLanguageFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Language</option>
                        {jobLanguageOptions.map((language) => (
                          <option key={language} value={language}>{language}</option>
                        ))}
                      </select>
                      <select
                        value={jobStatusFilter}
                        onChange={(event) => setJobStatusFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[110px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobStatusFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Status</option>
                        {globalWorkforceStatusOptions
                          .filter((status) => status !== "Closed")
                          .map((status) => (
                            <option key={status} value={status}>{status}</option>
                          ))}
                      </select>
                      <select
                        value={jobRatePeriodFilter}
                        onChange={(event) => setJobRatePeriodFilter(event.target.value)}
                        className={[
                          "h-11 min-w-[110px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobRatePeriodFilter !== "all"
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-slate-300 bg-white text-ink",
                        ].join(" ")}
                      >
                        <option value="all">Pay</option>
                        {globalWorkforcePayRateOptions.map((period) => (
                          <option key={period} value={period}>{period}</option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="0"
                        value={jobPayMinFilter}
                        onChange={(event) => setJobPayMinFilter(event.target.value)}
                        className={[
                          "h-11 w-[110px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobPayMinFilter
                            ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                            : "border-slate-300 bg-white text-ink placeholder:text-muted",
                        ].join(" ")}
                        placeholder="Min pay"
                      />
                      <input
                        type="number"
                        min="0"
                        value={jobPayMaxFilter}
                        onChange={(event) => setJobPayMaxFilter(event.target.value)}
                        className={[
                          "h-11 w-[110px] rounded-full border px-4 text-sm font-medium outline-none transition",
                          jobPayMaxFilter
                            ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                            : "border-slate-300 bg-white text-ink placeholder:text-muted",
                        ].join(" ")}
                        placeholder="Max pay"
                      />
                      <button
                        type="button"
                        onClick={clearJobFilters}
                        className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => scrollJobFilters("right")}
                    aria-label="Scroll filters right"
                    className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white h-11 w-11 text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
                  >
                    <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                      <path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Split layout — mobile: full-width list only; desktop: list + detail panel */}
              <div className="grid lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
                {/* Job list — always visible on mobile */}
                <aside className="flex flex-col border-slate-100 lg:max-h-[calc(100vh-14rem)] lg:border-r">
                  <div className="shrink-0 border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-muted/70 lg:px-5">
                    {isJobsLoading
                      ? "Loading jobs..."
                      : filteredJobs.length > 0
                        ? `${filteredJobs.length} role${filteredJobs.length === 1 ? "" : "s"} available`
                        : "No matching jobs"}
                  </div>
                  <div className="flex-1 lg:overflow-y-auto">
                    {!isJobsLoading && visibleJobs.length === 0 ? (
                      <div className="px-5 py-8 text-sm leading-7 text-muted">
                        No Global Workforce jobs are available yet. Check back after an admin publishes new posts.
                      </div>
                    ) : null}
                    {!isJobsLoading && visibleJobs.length > 0 && filteredJobs.length === 0 ? (
                      <div className="px-5 py-8 text-sm leading-7 text-muted">
                        No roles match your current filters. Clear a few filters and try again.
                      </div>
                    ) : null}
                    {filteredJobs.map((job) => (
                      <CandidateJobRow
                        key={job.id}
                        job={job}
                        isApplied={appliedJobIds.has(job.id)}
                        isViewed={viewedExternalJobIdSet.has(job.id)}
                        isSelected={selectedBoardJob?.id === job.id}
                        onSelect={() => {
                          setSelectedBoardJobId(job.id);
                          setMobileDrawerJobId(job.id);
                        }}
                      />
                    ))}
                  </div>
                </aside>

                {/* Job detail — desktop only; mobile uses bottom drawer */}
                <section className="hidden bg-white lg:block lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                  <div className="p-5 sm:p-6">
                    {isJobsLoading && !selectedBoardJob ? (
                      <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm text-muted shadow-panel">
                        <div className="flex items-center gap-3">
                          <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                          <span>Loading job details...</span>
                        </div>
                      </div>
                    ) : null}
                    {!isJobsLoading && !selectedBoardJob ? (
                      <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm leading-7 text-muted shadow-panel">
                        Select a job from the list to review the full role details.
                      </div>
                    ) : null}
                    {selectedBoardJob ? (
                      <CandidateJobDetailCard
                        job={selectedBoardJob}
                        isApplied={appliedJobIds.has(selectedBoardJob.id)}
                        isViewed={viewedExternalJobIdSet.has(selectedBoardJob.id)}
                        isApplying={applyingJobId === selectedBoardJob.id}
                        onApply={() => openApplicationPage(selectedBoardJob.id)}
                        isSaved={savedJobIds.includes(selectedBoardJob.id)}
                        onToggleSave={() => toggleSavedJob(selectedBoardJob.id)}
                      />
                    ) : null}
                  </div>
                </section>
              </div>
            </section>
          </div>

          {/* Mobile bottom drawer */}
          {mobileDrawerJobId ? (
            <div className="fixed inset-0 z-50 lg:hidden">
              {/* Backdrop — tap anywhere to close */}
              <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setMobileDrawerJobId(null)}
              />
              <div className="absolute bottom-0 left-0 right-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
                {/* Drag handle — full-width tappable close strip */}
                <button
                  type="button"
                  onClick={() => setMobileDrawerJobId(null)}
                  aria-label="Close"
                  className="flex w-full shrink-0 flex-col items-center gap-1.5 pb-2 pt-3"
                >
                  <div className="h-1 w-10 rounded-full bg-slate-300" />
                </button>
                {/* Header row with Back to jobs + X */}
                <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 pb-3">
                  <button
                    type="button"
                    onClick={() => setMobileDrawerJobId(null)}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                  >
                    <span aria-hidden="true">←</span>
                    Back to jobs
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileDrawerJobId(null)}
                    aria-label="Close"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6l-12 12"/></svg>
                  </button>
                </div>
                {/* Scrollable job detail */}
                <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
                  {mobileDrawerJob ? (
                    <CandidateJobDetailCard
                      job={mobileDrawerJob}
                      isApplied={appliedJobIds.has(mobileDrawerJob.id)}
                      isViewed={viewedExternalJobIdSet.has(mobileDrawerJob.id)}
                      isApplying={applyingJobId === mobileDrawerJob.id}
                      onApply={() => openApplicationPage(mobileDrawerJob.id)}
                      isSaved={savedJobIds.includes(mobileDrawerJob.id)}
                      onToggleSave={() => toggleSavedJob(mobileDrawerJob.id)}
                    />
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
      </main>
    );
  }

  if (isJobInstructionsView && activeUser) {
    const selectedCandidateJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null;
    const externalApplyUrl = selectedCandidateJob
      ? resolveExternalApplyLink(
          selectedCandidateJob.referenceId,
          selectedCandidateJob.referenceLink,
        )
      : "";

    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-[900px] px-4 py-8 sm:px-6 lg:px-10">
          {isJobsLoading && !selectedCandidateJob ? (
            <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
              <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
              <span>Loading job details...</span>
              </div>
            ) : null}

            {!isJobsLoading && !selectedCandidateJob ? (
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                  Job not found
                </p>
                <h1 className="mt-4 text-3xl font-semibold text-ink">This role is no longer available</h1>
                <div className="mt-6">
                  <Link
                    href="/candidates/jobs"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Back to jobs
                  </Link>
                </div>
              </section>
            ) : null}

            {errorMessage ? (
              <div className="mb-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">
                {errorMessage}
              </div>
            ) : null}

            {selectedCandidateJob ? (
              <section className="space-y-5">
                <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-panel">
                  <Link
                    href={`/candidates/jobs/${selectedCandidateJob.id}`}
                    className="inline-flex items-center gap-2 text-sm font-medium text-muted transition hover:text-primary"
                  >
                    <span aria-hidden="true">&larr;</span>
                    Back to job
                  </Link>

                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-panelStrong px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                      {selectedCandidateJob.status}
                    </span>
                  </div>

                  <h1 className="mt-4 text-3xl font-semibold text-ink sm:text-4xl">
                    {selectedCandidateJob.title}
                  </h1>
                  <p className="mt-3 text-sm text-muted">
                    {selectedCandidateJob.referenceLink
                      ? `Job ${selectedCandidateJob.referenceLink}`
                      : ""}{" "}
                    {selectedCandidateJob.referenceLink && selectedCandidateJob.country ? "·" : ""}{" "}
                    {selectedCandidateJob.country}
                  </p>
                </div>

                {/* Status card — shown after user has acted */}
                {appliedJobIds.has(selectedCandidateJob.id) ? (
                  <div className="rounded-[1.35rem] border border-emerald-200 bg-emerald-50 p-6 shadow-panel">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-sm font-bold text-white">
                        ✓
                      </span>
                      <div>
                        <p className="text-base font-semibold text-emerald-900">Application confirmed</p>
                        <p className="mt-0.5 text-sm text-emerald-700">
                          Our team has verified and confirmed your application for this role.
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowInstructionsPanel((v) => !v)}
                      className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 transition hover:text-emerald-900"
                    >
                      {showInstructionsPanel ? "Hide instructions" : "View instructions"}
                      <span aria-hidden="true">{showInstructionsPanel ? "↑" : "↓"}</span>
                    </button>
                  </div>
                ) : viewedExternalJobIdSet.has(selectedCandidateJob.id) && externalApplyUrl ? (
                  <div className="rounded-[1.35rem] border border-amber-200 bg-amber-50 p-6 shadow-panel">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-100 text-base">
                        ⏳
                      </span>
                      <div>
                        <p className="text-base font-semibold text-amber-900">Under verification</p>
                        <p className="mt-1 text-sm leading-6 text-amber-800">
                          You opened the application on the partner site. Our team will confirm your
                          status shortly — no further action needed right now.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-center gap-3">
                      <a
                        href={externalApplyUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) =>
                          void handleExternalApplyClick(event, selectedCandidateJob, externalApplyUrl)
                        }
                        className="inline-flex items-center justify-center rounded-full border border-amber-300 bg-white px-5 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
                      >
                        Return to partner site
                        <span aria-hidden="true" className="ml-1.5">↗</span>
                      </a>
                      <button
                        type="button"
                        onClick={() => setShowInstructionsPanel((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 transition hover:text-amber-900"
                      >
                        {showInstructionsPanel ? "Hide instructions" : "Show instructions & resume"}
                        <span aria-hidden="true">{showInstructionsPanel ? "↑" : "↓"}</span>
                      </button>
                    </div>
                  </div>
                ) : null}

                {/* Instructions + resume — always shown pre-apply, collapsible after */}
                {(!viewedExternalJobIdSet.has(selectedCandidateJob.id) &&
                  !appliedJobIds.has(selectedCandidateJob.id)) ||
                showInstructionsPanel ? (
                  <div className="rounded-[1.35rem] border border-slate-200 bg-white p-6 shadow-panel">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                      How to apply
                    </p>
                    {selectedCandidateJob.instructions ? (
                      <div className="mt-4">
                        <FormattedJobDescription
                          content={selectedCandidateJob.instructions}
                          className="job-rich-content space-y-3 text-sm leading-7 text-ink"
                        />
                      </div>
                    ) : (
                      <p className="mt-4 text-sm leading-7 text-muted">
                        This is an external role. Click Apply to go directly to the partner site.
                      </p>
                    )}

                    {!appliedJobIds.has(selectedCandidateJob.id) && externalApplyUrl ? (
                      <>
                        <div className="mt-6 border-t border-slate-100 pt-5">
                          <p className="text-sm font-semibold text-ink">Resume / CV</p>
                          <p className="mt-1 text-xs leading-5 text-muted">
                            Attach your resume so we can keep it on file. PDF, DOC, or DOCX — max{" "}
                            {formatFileSize(candidateResumeMaxFileSizeBytes)}.
                          </p>
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                              <input
                                type="file"
                                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                onChange={(e) => setExternalResumeFile(e.target.files?.[0] ?? null)}
                                className="sr-only"
                              />
                              {externalResumeFile ? "Change file" : "Upload file"}
                            </label>
                            {externalResumeFile ? (
                              <span className="text-sm font-medium text-emerald-700">
                                {externalResumeFile.name} ({formatFileSize(externalResumeFile.size)})
                              </span>
                            ) : (
                              <span className="text-sm text-muted">No file selected.</span>
                            )}
                          </div>
                        </div>

                        {!viewedExternalJobIdSet.has(selectedCandidateJob.id) ? (
                          <div className="mt-6">
                            <a
                              href={externalApplyUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) =>
                                void handleExternalApplyClick(
                                  event,
                                  selectedCandidateJob,
                                  externalApplyUrl,
                                )
                              }
                              className="inline-flex items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                            >
                              {applyingJobId === selectedCandidateJob.id ? "Saving..." : "Apply"}
                              <span aria-hidden="true" className="ml-2">↗</span>
                            </a>
                          </div>
                        ) : null}
                      </>
                    ) : null}
                  </div>
                ) : null}
              </section>
            ) : null}
        </div>
      </main>
    );
  }

  if (isJobApplyView && activeUser) {
    const selectedCandidateJob = selectedJobId ? jobs.find((job) => job.id === selectedJobId) ?? null : null;

    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
            {errorMessage ? (
              <div className="mb-6 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="mb-6 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
                {successMessage}
              </div>
            ) : null}

            {isJobsLoading && !selectedCandidateJob ? (
              <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
                <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                <span>Loading application form...</span>
              </div>
            ) : null}

            {!isJobsLoading && !selectedCandidateJob ? (
              <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-panel">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                  Job not found
                </p>
                <h1 className="mt-4 text-3xl font-semibold text-ink">This role is no longer available here</h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                  The role may have been removed or the link may be incorrect. Head back to the jobs board to browse current openings.
                </p>
                <div className="mt-6">
                  <Link
                    href="/candidates/jobs"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Back to jobs
                  </Link>
                </div>
              </section>
            ) : null}

            {selectedCandidateJob ? (
              <CandidateApplicationPageCard
                job={selectedCandidateJob}
                applicationDraft={applicationDraft}
                resumeFile={resumeFile}
                onDraftChange={handleApplicationDraftChange}
                onResumeChange={handleResumeFileChange}
                onSubmit={handleApplicationSubmit}
                isSubmitting={applyingJobId === selectedCandidateJob.id}
                isApplied={appliedJobIds.has(selectedCandidateJob.id)}
              />
            ) : null}
        </div>
      </main>
    );
  }

  if (isApplicationsView && activeUser) {
    if (isApplicationDetailView) {
      return renderCandidateWorkspacePage({
        eyebrow: "Applications",
        title: "Application details",
        description: "Full details of this role — your submitted files, cover letter, and current status.",
        primaryActionHref: "/candidates/applications",
        primaryActionLabel: "All applications",
        children: (
          <>
            {isApplicationsLoading ? (
              <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
                <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                <span>Loading your submitted application...</span>
              </div>
            ) : null}

            {!isApplicationsLoading && !selectedApplication ? (
              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
                <p className="text-lg font-semibold text-ink">Application not found</p>
                <p className="mt-3 text-sm leading-7 text-muted">
                  This submitted application could not be found in your workspace.
                </p>
                <div className="mt-5">
                  <Link
                    href="/candidates/applications"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Back to applications
                  </Link>
                </div>
              </div>
            ) : null}

            {!isApplicationsLoading && selectedApplication ? (
              <div className="mt-6">
                <CandidateApplicationDetailCard application={selectedApplication} />
              </div>
            ) : null}
          </>
        ),
      });
    }

    return renderCandidateWorkspacePage({
      eyebrow: "Applications",
      title: "Your application pipeline",
      description: "Track every role you've opened or applied to — view your resumes, cover letters, and current status.",
      primaryActionHref: "/candidates/jobs",
      primaryActionLabel: "Browse jobs",
      children: (
        <>
          <div className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0" style={{ scrollbarWidth: "none" }}>
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Tracked roles"
              value={String(applicationCount).padStart(2, "0")}
              hint="Viewed external roles and verified applications in your candidate workspace."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Resume uploads"
              value={String(submittedDocumentsCount).padStart(2, "0")}
              hint="Uploaded application files currently stored with your submitted jobs."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Countries"
              value={String(uniqueApplicationCountries).padStart(2, "0")}
              hint="Regions covered across the jobs you have applied for so far."
            />
          </div>

          {isApplicationsLoading ? (
            <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
              <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
              <span>Loading your applications...</span>
            </div>
          ) : null}

          {!isApplicationsLoading && applications.length === 0 && crowdWorkApplications.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
              <p className="text-lg font-semibold text-ink">No applications yet</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Once you open an external application or apply to an internal role, it will show up here.
              </p>
            </div>
          ) : null}

          {!isApplicationsLoading && applications.length > 0 ? (
            <div className="mt-6 space-y-3">
              {applications.map((application) => (
                <CandidateApplicationRow
                  key={`${application.jobId}-${application.uid}`}
                  application={application}
                />
              ))}
            </div>
          ) : null}

          {crowdWorkApplications.length > 0 ? (
            <div className="mt-6 space-y-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Crowd Work</p>
              {crowdWorkApplications.map((app) => (
                <CandidateCrowdApplicationRow key={app.id} app={app} />
              ))}
            </div>
          ) : null}

          {false && !isApplicationsLoading && applications.length > 0 ? (
            <div className="mt-6 space-y-4">
              {applications.map((application) => (
                <article
                  key={`${application.jobId}-${application.uid}`}
                  className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primarySoft">
                        Applied
                      </p>
                      <h2 className="mt-2 text-2xl font-semibold text-ink">
                        {application.jobTitle}
                      </h2>
                      <p className="mt-3 text-sm text-muted">
                        {application.jobType} • {application.workplace} • {application.country}
                      </p>
                    </div>

                    <span className="inline-flex w-fit items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-900">
                      {application.status}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Cover letter</p>
                      <p className="mt-2 text-sm leading-7 text-ink">
                        {application.coverLetter || "No cover letter submitted."}
                      </p>
                    </div>
                    <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-muted">Additional notes</p>
                      <p className="mt-2 text-sm leading-7 text-ink">
                        {application.additionalNotes || "No extra notes added."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    {application.resumeFileUrl ? (
                      <a
                        href={application.resumeFileUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                      >
                        View submitted resume
                      </a>
                    ) : null}
                    {application.profileLink ? (
                      <a
                        href={application.profileLink}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                      >
                        Open profile link
                      </a>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : null}
        </>
      ),
    });
  }

  if (isSavedRolesView && activeUser) {
    if (selectedSavedJobId) {
      return renderCandidateWorkspacePage({
        eyebrow: "Saved roles",
        title: "Saved role",
        description: "Full job details for a role in your shortlist.",
        primaryActionHref: "/candidates/saved-roles",
        primaryActionLabel: "All saved roles",
        children: (
          <>
            <div className="mb-5">
              <Link
                href="/candidates/saved-roles"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-muted transition hover:text-ink"
              >
                <span aria-hidden="true">←</span>
                All saved roles
              </Link>
            </div>

            {isJobsLoading ? (
              <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
                <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                <span>Loading your saved role...</span>
              </div>
            ) : null}

            {!isJobsLoading && !selectedSavedJob ? (
              <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
                <p className="text-lg font-semibold text-ink">Saved role not found</p>
                <p className="mt-3 text-sm leading-7 text-muted">
                  This role may have been removed from your saved list or is no longer available.
                </p>
                <div className="mt-5">
                  <Link
                    href="/candidates/saved-roles"
                    className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Back to saved roles
                  </Link>
                </div>
              </div>
            ) : null}

            {!isJobsLoading && selectedSavedJob ? (
              <div className="mt-6">
                <CandidateJobDetailCard
                  job={selectedSavedJob}
                  isApplied={appliedJobIds.has(selectedSavedJob.id)}
                  isViewed={viewedExternalJobIdSet.has(selectedSavedJob.id)}
                  isApplying={applyingJobId === selectedSavedJob.id}
                  onApply={() => openApplicationPage(selectedSavedJob.id)}
                  isSaved={savedJobIds.includes(selectedSavedJob.id)}
                  onToggleSave={() => toggleSavedJob(selectedSavedJob.id)}
                />
              </div>
            ) : null}
          </>
        ),
      });
    }

    return renderCandidateWorkspacePage({
      eyebrow: "Saved roles",
      title: "Your shortlist",
      description: "Roles you bookmarked from the jobs board — open any one whenever you're ready to apply.",
      primaryActionHref: "/candidates/jobs",
      primaryActionLabel: "Browse jobs",
      children: (
        <>
          <div className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0" style={{ scrollbarWidth: "none" }}>
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Saved roles"
              value={String(savedJobs.length).padStart(2, "0")}
              hint="Roles you bookmarked from the jobs board."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Applied"
              value={String(savedJobs.filter((job) => appliedJobIds.has(job.id)).length).padStart(2, "0")}
              hint="Saved roles you already moved into your application pipeline."
            />
            <CandidateWorkspaceMetric
              className="w-40 shrink-0 md:w-auto"
              label="Countries"
              value={String(new Set(savedJobs.map((job) => job.country).filter(Boolean)).size).padStart(2, "0")}
              hint="Regions represented across your saved shortlist."
            />
          </div>

          {isJobsLoading ? (
            <div className="mt-6 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
              <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
              <span>Loading your saved roles...</span>
            </div>
          ) : null}

          {!isJobsLoading && savedJobs.length === 0 ? (
            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
              <p className="text-lg font-semibold text-ink">No saved roles yet</p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Save roles from the jobs board and they will appear here as your shortlist.
              </p>
            </div>
          ) : null}

          {!isJobsLoading && savedJobs.length > 0 ? (
            <div className="mt-6 space-y-3">
              {savedJobs.map((job) => (
                <CandidateSavedRoleRow
                  key={job.id}
                  job={job}
                  isApplied={appliedJobIds.has(job.id)}
                  isViewed={viewedExternalJobIdSet.has(job.id)}
                />
              ))}
            </div>
          ) : null}
        </>
      ),
    });
  }

  if (isCrowdApplyView && activeUser) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-[1100px] px-4 py-8 sm:px-6 lg:px-10">
          {isCrowdWorkLoading && !crowdApplyPost ? (
            <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted shadow-panel">
              <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
              <span>Loading...</span>
            </div>
          ) : null}

          {!isCrowdWorkLoading && !crowdApplyPost ? (
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-8 shadow-panel">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                Task not found
              </p>
              <h1 className="mt-4 text-3xl font-semibold text-ink">This task is no longer available</h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
                The task may have been removed or the link may be incorrect.
              </p>
              <div className="mt-6">
                <Link
                  href="/candidates/crowd-work"
                  className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                >
                  Back to crowd work
                </Link>
              </div>
            </section>
          ) : null}

          {crowdApplyPost ? (
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-panel sm:p-8">
              {/* Back link */}
              <Link
                href="/candidates/crowd-work"
                className="mb-6 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-muted transition hover:text-ink"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                </svg>
                Crowd Work
              </Link>

              {/* Title + meta */}
              <div className="mb-5">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primarySoft">
                  {crowdApplyPost.googleFormUrl ? "Apply via Google Form" : "Apply"}
                </p>
                <h1 className="mt-2 text-2xl font-semibold text-ink sm:text-3xl">{crowdApplyPost.title}</h1>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {crowdApplyPost.taskType ? (
                    <span className="rounded-full border border-slate-200 bg-panelStrong px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                      {crowdApplyPost.taskType}
                    </span>
                  ) : null}
                  <span className="rounded-full border border-slate-200 bg-panelStrong px-2.5 py-0.5 text-[10px] font-semibold text-muted">
                    {crowdApplyPost.postId}
                  </span>
                  {crowdApplyPost.payPerSession > 0 ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800">
                      {crowdApplyPost.payCurrency} {crowdApplyPost.payPerSession}/session
                    </span>
                  ) : null}
                </div>
              </div>

              {(() => {
                const applyStatus = crowdApplyPostApplication?.status ?? null;
                const isApplyLocked = applyStatus === "applied" || applyStatus === "under-review" || applyStatus === "approved" || applyStatus === "rejected";

                if (isApplyLocked) {
                  return (
                    <div className="border-t border-slate-100 pt-5">
                      <div className={[
                        "rounded-[1.2rem] border px-5 py-6 text-center",
                        applyStatus === "approved" ? "border-emerald-200 bg-emerald-50" :
                        applyStatus === "rejected" ? "border-rose-200 bg-rose-50" :
                        "border-amber-200 bg-amber-50",
                      ].join(" ")}>
                        <p className={[
                          "text-base font-semibold",
                          applyStatus === "approved" ? "text-emerald-900" :
                          applyStatus === "rejected" ? "text-rose-800" :
                          "text-amber-900",
                        ].join(" ")}>
                          {crowdDetailStatusLabel[applyStatus] ?? applyStatus}
                        </p>
                        <p className={[
                          "mt-1.5 text-sm leading-6",
                          applyStatus === "approved" ? "text-emerald-700" :
                          applyStatus === "rejected" ? "text-rose-700" :
                          "text-amber-700",
                        ].join(" ")}>
                          {applyStatus === "approved"
                            ? "Your application has been approved."
                            : applyStatus === "rejected"
                            ? "Your application was not successful for this task."
                            : "Your application is being reviewed. We will be in touch."}
                        </p>
                      </div>
                      <div className="mt-5">
                        <Link href="/candidates/crowd-work" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                          Back to Crowd Work
                        </Link>
                      </div>
                    </div>
                  );
                }

                // No-form: show success state (Firestore will flip isApplyLocked shortly after)
                if (crowdApplyDone && !crowdApplyPost.googleFormUrl) {
                  return (
                    <div className="border-t border-slate-100 pt-5">
                      <div className="rounded-[1.2rem] border border-emerald-200 bg-emerald-50 px-5 py-6 text-center">
                        <p className="text-base font-semibold text-emerald-900">Application submitted!</p>
                        <p className="mt-1.5 text-sm leading-6 text-emerald-700">We will review your application and be in touch.</p>
                      </div>
                      <div className="mt-5">
                        <Link href="/candidates/crowd-work" className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                          Back to Crowd Work
                        </Link>
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="space-y-5 border-t border-slate-100 pt-5">
                    {crowdApplyPost.requirements ? (
                      <div>
                        <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-muted/60">Instructions</p>
                        <FormattedJobDescription content={crowdApplyPost.requirements} />
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-muted">
                        {crowdApplyPost.googleFormUrl
                          ? "Click below to open the application form in a new tab."
                          : "Click below to confirm your application for this task."}
                      </p>
                    )}
                    {/* "Form opened" info banner — shown after first click, button stays alive */}
                    {googleFormOpened && crowdApplyPost.googleFormUrl ? (
                      <div className="rounded-[1.1rem] border border-sky-200 bg-sky-50 px-4 py-4">
                        <p className="text-sm font-semibold text-sky-900">Google Form opened!</p>
                        <p className="mt-1 text-xs leading-5 text-sky-700">
                          Complete the form in the new tab to submit your application. You can click the button below to reopen the form if needed.
                        </p>
                      </div>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void submitCrowdApply()}
                      disabled={isSubmittingCrowdApply}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
                    >
                      {isSubmittingCrowdApply ? (
                        <>
                          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          <span>Opening…</span>
                        </>
                      ) : crowdApplyPost.googleFormUrl ? (
                        <>
                          <span>{googleFormOpened ? "Reopen Google Form" : "Apply — opens Google Form"}</span>
                          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                          </svg>
                        </>
                      ) : "Apply"}
                    </button>
                  </div>
                );
              })()}
            </section>
          ) : null}
        </div>
      </main>
    );
  }

  if (isCrowdWorkView && activeUser) {
    return shell(
      <main className="min-h-screen bg-background text-ink">
        <div className="lg:mx-auto lg:max-w-[1440px] lg:px-6 lg:py-8 xl:px-10">
          {profile && !profile.openToCrowdWork && (
            <div className="mx-4 mb-4 mt-4 flex items-start gap-4 rounded-[1.25rem] border border-amber-200 bg-amber-50 p-4 lg:mx-0 lg:mb-5 lg:mt-0">
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-900">You are not opted in to Crowd Work</p>
                <p className="mt-0.5 text-xs leading-6 text-amber-700">
                  Enable Crowd Work in your profile preferences to be matched to paid tasks.
                </p>
              </div>
              <Link
                href="/candidates/profile"
                className="shrink-0 rounded-full bg-amber-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
              >
                Update preferences
              </Link>
            </div>
          )}

          <section className="bg-white lg:overflow-hidden lg:rounded-[1.85rem] lg:border lg:border-slate-200">
            {/* Filter bar */}
            <div className="border-b border-slate-100 bg-white px-4 py-3 sm:px-5">
              {/* Mobile search */}
              <div className="mb-2.5 sm:hidden">
                <input
                  value={crowdWorkSearchQuery}
                  onChange={(e) => setCrowdWorkSearchQuery(e.target.value)}
                  className={[
                    "h-11 w-full rounded-full border px-4 text-sm font-medium outline-none transition",
                    crowdWorkSearchQuery
                      ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                      : "border-slate-300 bg-white text-ink placeholder:text-muted",
                  ].join(" ")}
                  placeholder="Search tasks"
                />
              </div>
              {/* Scrollable filter row */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => scrollCrowdWorkFilters("left")}
                  aria-label="Scroll filters left"
                  className="absolute left-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white h-11 w-11 text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <div
                  ref={crowdWorkFiltersScrollRef}
                  className="overflow-x-auto py-1 sm:px-14 [&::-webkit-scrollbar]:hidden"
                  style={{ scrollbarWidth: "none" }}
                >
                  <div className="flex min-w-max items-center gap-2.5">
                    {/* Desktop search */}
                    <input
                      value={crowdWorkSearchQuery}
                      onChange={(e) => setCrowdWorkSearchQuery(e.target.value)}
                      className={[
                        "hidden h-11 w-[220px] rounded-full border px-4 text-sm font-medium outline-none transition sm:block",
                        crowdWorkSearchQuery
                          ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
                          : "border-slate-300 bg-white text-ink placeholder:text-muted",
                      ].join(" ")}
                      placeholder="Search tasks"
                    />
                    <select
                      value={crowdWorkTypeFilter}
                      onChange={(e) => setCrowdWorkTypeFilter(e.target.value)}
                      className={[
                        "h-11 min-w-[160px] rounded-full border px-4 text-sm font-medium outline-none transition",
                        crowdWorkTypeFilter !== "all"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-slate-300 bg-white text-ink",
                      ].join(" ")}
                    >
                      <option value="all">Task type</option>
                      {crowdWorkTypeOptions.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select
                      value={crowdWorkLangFilter}
                      onChange={(e) => setCrowdWorkLangFilter(e.target.value)}
                      className={[
                        "h-11 min-w-[140px] rounded-full border px-4 text-sm font-medium outline-none transition",
                        crowdWorkLangFilter !== "all"
                          ? "border-primary/30 bg-primary/10 text-primary"
                          : "border-slate-300 bg-white text-ink",
                      ].join(" ")}
                    >
                      <option value="all">Language</option>
                      {crowdWorkLangOptions.map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                    <button
                      type="button"
                      onClick={clearCrowdWorkFilters}
                      className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => scrollCrowdWorkFilters("right")}
                  aria-label="Scroll filters right"
                  className="absolute right-0 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white h-11 w-11 text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
                >
                  <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                    <path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Split layout */}
            <div className="grid lg:grid-cols-[minmax(260px,0.42fr)_minmax(0,1fr)]">
              {/* Task list */}
              <aside className="flex flex-col border-slate-100 lg:max-h-[calc(100vh-14rem)] lg:border-r">
                <div className="shrink-0 border-b border-slate-100 px-4 py-2.5 text-xs font-medium text-muted/70 lg:px-5">
                  {isCrowdWorkLoading
                    ? "Loading tasks..."
                    : filteredCrowdWorkPosts.length > 0
                      ? `${filteredCrowdWorkPosts.length} task${filteredCrowdWorkPosts.length === 1 ? "" : "s"} available`
                      : "No matching tasks"}
                </div>
                <div className="flex-1 lg:overflow-y-auto">
                  {!isCrowdWorkLoading && crowdWorkPosts.length === 0 ? (
                    <div className="px-5 py-8 text-sm leading-7 text-muted">
                      No crowd work tasks are available yet. Check back once tasks are published.
                    </div>
                  ) : null}
                  {!isCrowdWorkLoading && crowdWorkPosts.length > 0 && filteredCrowdWorkPosts.length === 0 ? (
                    <div className="px-5 py-8 text-sm leading-7 text-muted">
                      No tasks match your current filters. Clear a filter and try again.
                    </div>
                  ) : null}
                  {filteredCrowdWorkPosts.map((post) => (
                    <CandidateCrowdWorkRow
                      key={post.id}
                      post={post}
                      isSelected={selectedBoardCrowdWork?.id === post.id}
                      status={crowdWorkApplicationMap.get(post.id)?.status ?? null}
                      onSelect={() => {
                        setSelectedBoardCrowdWorkId(post.id);
                        setMobileCrowdWorkDrawerId(post.id);
                      }}
                    />
                  ))}
                </div>
              </aside>

              {/* Detail panel — desktop only */}
              <section className="hidden bg-white lg:block lg:max-h-[calc(100vh-14rem)] lg:overflow-y-auto">
                <div className="p-5 sm:p-6">
                  {isCrowdWorkLoading && !selectedBoardCrowdWork ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm text-muted shadow-panel">
                      <div className="flex items-center gap-3">
                        <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                        <span>Loading task details...</span>
                      </div>
                    </div>
                  ) : null}
                  {!isCrowdWorkLoading && !selectedBoardCrowdWork ? (
                    <div className="flex min-h-[320px] items-center justify-center rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 text-sm leading-7 text-muted shadow-panel">
                      Select a task from the list to review its full details.
                    </div>
                  ) : null}
                  {selectedBoardCrowdWork ? (
                    <CandidateCrowdWorkDetailCard
                      post={selectedBoardCrowdWork}
                      application={crowdWorkApplicationMap.get(selectedBoardCrowdWork.id) ?? null}
                      onApply={undefined}
                    />
                  ) : null}
                </div>
              </section>
            </div>
          </section>
        </div>

        {/* Mobile bottom drawer */}
        {mobileCrowdWorkDrawerId ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/50"
              onClick={() => setMobileCrowdWorkDrawerId(null)}
            />
            <div className="absolute bottom-0 left-0 right-0 flex max-h-[92dvh] flex-col rounded-t-3xl bg-white shadow-2xl">
              <button
                type="button"
                onClick={() => setMobileCrowdWorkDrawerId(null)}
                aria-label="Close"
                className="flex w-full shrink-0 flex-col items-center gap-1.5 pb-2 pt-3"
              >
                <div className="h-1 w-10 rounded-full bg-slate-300" />
              </button>
              <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 pb-3">
                <button
                  type="button"
                  onClick={() => setMobileCrowdWorkDrawerId(null)}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary"
                >
                  <span aria-hidden="true">←</span>
                  Back to tasks
                </button>
                <button
                  type="button"
                  onClick={() => setMobileCrowdWorkDrawerId(null)}
                  aria-label="Close"
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 6l12 12M18 6l-12 12"/></svg>
                </button>
              </div>
              <div className="flex-1 overflow-y-auto px-5 pb-8 pt-5">
                {mobileCrowdWorkPost ? (
                  <CandidateCrowdWorkDetailCard
                    post={mobileCrowdWorkPost}
                    application={crowdWorkApplicationMap.get(mobileCrowdWorkPost.id) ?? null}
                    onApply={undefined}
                  />
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

      </main>
    );
  }

  if (isSettingsView && activeUser) {
    return renderCandidateWorkspacePage({
      eyebrow: "Settings",
      title: "Account settings",
      description: "Manage your candidate account preferences and data.",
      children: (
        <div className="space-y-5">
          {/* Appearance — toggle lives in the sidebar */}
          <div className="flex items-center justify-between rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-panel">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                {candidateTheme === "dark" ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79Z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.07-.707.707M5.636 18.364l-.707.707m12.728 0-.707-.707M5.636 5.636l-.707-.707M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
                  </svg>
                )}
              </span>
              <div>
                <p className="text-sm font-semibold text-ink">Appearance</p>
                <p className="text-xs text-muted">{candidateTheme === "dark" ? "Dark mode" : "Light mode"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleThemeChange(candidateTheme === "dark" ? "light" : "dark")}
              className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
            >
              {candidateTheme === "dark" ? "Switch to Light" : "Switch to Dark"}
            </button>
          </div>

          {/* Danger zone */}
          <div className="rounded-[1.5rem] border border-rose-200 bg-rose-50 p-6">
            <p className="text-sm font-semibold text-rose-800">Delete account</p>
            <p className="mt-2 text-sm leading-6 text-rose-700">
              Permanently remove your profile, applications, and uploaded files. This cannot be undone.
            </p>
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void handleDeleteProfile()}
                disabled={isDeletingProfile}
                className="rounded-full border border-rose-300 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingProfile ? "Deleting..." : "Delete account"}
              </button>
            </div>
          </div>
        </div>
      ),
    });
  }

  if (
    isWorkspaceView &&
    activeUser &&
    view in candidateWorkspacePlaceholderContent
  ) {
    const page = candidateWorkspacePlaceholderContent[
      view as keyof typeof candidateWorkspacePlaceholderContent
    ];

    return renderCandidateWorkspacePage({
      eyebrow: page.eyebrow,
      title: page.title,
      description: page.description,
      children: (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {page.cards.map((card) => (
              <article
                key={card.title}
                className="rounded-[1.3rem] border border-slate-200 bg-white p-5 shadow-panel"
              >
                <p className="text-lg font-semibold text-ink">{card.title}</p>
                <p className="mt-3 text-sm leading-7 text-muted">{card.body}</p>
              </article>
            ))}
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-lg font-semibold text-ink">This workspace is ready for real data next</p>
            <p className="mt-3 text-sm leading-7 text-muted">
              The page is now live in your candidate sidebar. We can connect real saved
              roles, interview schedules, inbox threads, or support workflows here next
              without changing the overall navigation again.
            </p>
          </div>
        </>
      ),
    });
  }

  if (!activeUser) {
    return (
      <PlatformAuthPage
        title={emailMode === "signup" ? "Create your account" : "Sign in to your account"}
        email={emailForm.email}
        password={emailForm.password}
        confirmPassword={emailMode === "signup" ? emailForm.confirmPassword : undefined}
        passwordAutocomplete={emailMode === "signup" ? "new-password" : "current-password"}
        submitLabel={emailMode === "signup" ? "Create account" : "Sign in"}
        isSubmitting={isEmailBusy || isAuthResolving}
        notice={
          !firebaseReady
            ? (
                <>
                  <span className="font-semibold">Firebase setup needed</span>
                  <span className="mt-1 block">{firebaseConfigError}</span>
                </>
              )
            : isAuthResolving
              ? "Restoring your session..."
              : null
        }
        errorMessage={errorMessage}
        successMessage={successMessage}
        oauthAction={
          <button
            type="button"
            onClick={() => void handleGoogleSignIn()}
            disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady}
            className="inline-flex w-full items-center justify-center gap-3 rounded-[10px] border border-[#e5ecf3] bg-white px-4 py-[13px] text-sm font-semibold text-[#0a1628] transition hover:bg-[#f6f9fc] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSigningIn || isAuthResolving ? <LoadingSpinner className="h-4 w-4" /> : <GoogleMark />}
            {isSigningIn
              ? "Opening Google..."
              : isAuthResolving
                ? "Finishing sign in..."
                : "Continue with Google"}
          </button>
        }
        secondaryAction={
          <button
            type="button"
            onClick={() => setEmailMode(emailMode === "signup" ? "signin" : "signup")}
            className="text-[13px] font-medium text-[#2b85f0] transition hover:text-[#1f6dd1] hover:underline"
          >
            {emailMode === "signup" ? "Already have an account?" : "Create an account"}
          </button>
        }
        onEmailChange={(value) => setEmailForm((current) => ({ ...current, email: value }))}
        onPasswordChange={(value) => setEmailForm((current) => ({ ...current, password: value }))}
        onConfirmPasswordChange={(value) =>
          setEmailForm((current) => ({ ...current, confirmPassword: value }))
        }
        onSubmit={handleEmailAuth}
      />
    );
  }

  return shell(
    <main className="min-h-screen bg-background text-ink">
        <div
          className={[
            "mx-auto min-h-[70vh] px-4 py-10 sm:px-6 lg:px-10",
            isStandaloneProfilePage
              ? "max-w-6xl"
              : "flex max-w-3xl items-center justify-center",
          ].join(" ")}
        >
          <section
            className={[
              isStandaloneProfilePage
                ? "w-full"
                : "w-full rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-panel sm:p-8",
              !isStandaloneProfilePage ? "max-w-[460px]" : "",
            ].join(" ")}
          >
          <p className={isStandaloneProfilePage ? "hidden" : "text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft"}>
            Candidate profile
          </p>

          <h2 className={isStandaloneProfilePage ? "hidden" : "mt-3 text-2xl font-semibold text-ink"}>
            {shouldShowProfileSummary
              ? "Your candidate profile"
              : profile
                ? "Edit your candidate profile"
                : "Complete your candidate profile"}
          </h2>

          {!firebaseReady ? (
            <div className="mt-5 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-7 text-amber-900">
              <p className="font-semibold text-ink">Firebase setup needed</p>
              <p className="mt-2">{firebaseConfigError}</p>
            </div>
          ) : null}

          {errorMessage ? (
            <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
              {errorMessage}
            </div>
          ) : null}

          {successMessage ? (
            <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
              {successMessage}
            </div>
          ) : null}

          {!activeUser ? (
            <div className={errorMessage || successMessage || !firebaseReady ? "mt-5 space-y-5" : "mt-6 space-y-5"}>
              {isAuthResolving ? (
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                  <div className="flex items-center gap-3 text-sm leading-7 text-muted">
                    <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                    <span>Restoring your Google session...</span>
                  </div>
                </div>
              ) : null}

              <div>
                <button
                  type="button"
                  onClick={() => void handleGoogleSignIn()}
                  disabled={!firebaseReady || isSigningIn || isAuthResolving || !authReady}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSigningIn || isAuthResolving ? <LoadingSpinner /> : <GoogleMark />}
                  {isSigningIn
                    ? "Opening Google..."
                    : isAuthResolving
                      ? "Finishing sign in..."
                      : "Continue with Google"}
                </button>
              </div>

              <div className="flex items-center gap-3">
                <span className="h-px flex-1 bg-slate-200" />
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                  or
                </span>
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <div>
                <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-panelStrong p-1">
                  <button
                    type="button"
                    onClick={() => setEmailMode("signup")}
                    className={[
                      "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                      emailMode === "signup" ? "bg-white text-ink shadow-sm" : "text-muted",
                    ].join(" ")}
                  >
                    Email sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode("signin")}
                    className={[
                      "flex-1 rounded-full px-4 py-2 text-sm font-semibold transition",
                      emailMode === "signin" ? "bg-white text-ink shadow-sm" : "text-muted",
                    ].join(" ")}
                  >
                    Email sign in
                  </button>
                </div>

                <form onSubmit={handleEmailAuth} className="mt-5 space-y-4">
                  <input
                    name="email"
                    type="email"
                    value={emailForm.email}
                    onChange={handleEmailFormChange}
                    required
                    placeholder="you@example.com"
                    className={candidateFieldClassName}
                  />
                  <input
                    name="password"
                    type="password"
                    value={emailForm.password}
                    onChange={handleEmailFormChange}
                    required
                    placeholder="Password"
                    className={candidateFieldClassName}
                  />
                  {emailMode === "signup" ? (
                    <input
                      name="confirmPassword"
                      type="password"
                      value={emailForm.confirmPassword}
                      onChange={handleEmailFormChange}
                      required
                      placeholder="Confirm password"
                      className={candidateFieldClassName}
                    />
                  ) : null}
                  <button
                    type="submit"
                    disabled={isEmailBusy}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-full border border-slate-300 bg-white px-5 py-3.5 text-sm font-semibold text-ink transition hover:bg-panelStrong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isEmailBusy ? <LoadingSpinner className="h-4 w-4" /> : null}
                    {isEmailBusy
                      ? "Working..."
                      : emailMode === "signup"
                        ? "Create account with email"
                        : "Sign in with email"}
                  </button>
                </form>
              </div>
            </div>
          ) : null}

          {activeUser ? (
            <div className="mt-5 space-y-5">
              {!isStandaloneProfilePage ? (
              <div className="flex items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-panelStrong p-4">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-white">
                    {draft.photoUrl ? (
                      <Image
                        src={draft.photoUrl}
                        alt={profilePreviewName}
                        fill
                        sizes="48px"
                        className="object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-base font-semibold text-primary">
                        {profilePreviewName.slice(0, 1).toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink">
                      {activeUser.displayName || draft.fullName || "Candidate account"}
                    </p>
                    <p className="truncate text-xs text-muted">{activeUser.email}</p>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2">
                  {profile && shouldShowProfileSummary ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDraft(profile);
                          setIsWhatsappNumberConfirmed(Boolean(profile.phoneNumber));
                          setIsEditingProfile(true);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-100"
                      >
                        Edit profile
                      </button>
                    </>
                  ) : null}

                  {profile && !shouldShowProfileSummary ? (
                    <button
                      type="button"
                      onClick={() => {
                        setDraft(profile);
                        setIsWhatsappNumberConfirmed(Boolean(profile.phoneNumber));
                        setIsEditingProfile(false);
                        setErrorMessage(null);
                        setSuccessMessage(null);
                      }}
                      className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-slate-100"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
              </div>
              ) : null}

              {isProfileLoading || (!isProfileResolved && !profile) ? (
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                  <div className="flex items-center gap-3 text-sm leading-7 text-muted">
                    <LoadingSpinner className="h-5 w-5 border-primary/30 border-t-primary" />
                    <span>
                      {profile ? "Refreshing your profile..." : "Loading your candidate profile..."}
                    </span>
                  </div>
                </div>
              ) : null}

              {!isProfileLoading && isProfileResolved && shouldShowProfileSummary && profile ? (
                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-5">
                        <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                          {profile.photoUrl ? (
                            <Image
                              src={profile.photoUrl}
                              alt={profile.fullName || profilePreviewName}
                              fill
                              sizes="96px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                              {(profile.fullName || profilePreviewName).slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="min-w-0">
                          <h3 className="text-2xl font-semibold text-ink">
                            {profile.fullName || "Candidate"}
                          </h3>
                          <p className="mt-2 text-sm text-muted">
                            {profile.email || activeUser.email || "No email added"}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setDraft(profile);
                          setIsWhatsappNumberConfirmed(Boolean(profile.phoneNumber));
                          setIsEditingProfile(true);
                          setErrorMessage(null);
                          setSuccessMessage(null);
                        }}
                        className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                      >
                        Edit profile
                      </button>
                          </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white px-6 py-5 shadow-panel">
                    <p className="text-sm font-semibold text-ink">Identity</p>
                    <dl className="mt-3">
                    <CandidateProfileField label="Full name" value={profile.fullName || "Not added"} />
                    <CandidateProfileField label="Email" value={profile.email || activeUser.email || "Not added"} />
                    <CandidateProfileField label="Country" value={profile.country || "Not added"} />
                    <CandidateProfileField label="City" value={profile.city || "Not added"} />
                    <CandidateProfileField
                      label="Phone"
                      value={
                        profile.phoneNumber
                          ? `${profile.phoneCountryCode} ${profile.phoneNumber}`
                          : "Not added"
                      }
                    />
                    <CandidateProfileField
                      label="Date of birth"
                      value={profile.dateOfBirth || "Not added"}
                    />
                    </dl>
                  </div>
                </div>
              ) : null}

              {!isProfileLoading && isProfileResolved && shouldShowProfileForm ? (
                <form onSubmit={handleProfileSubmit} className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                      <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                        {draft.photoUrl ? (
                          <Image
                            src={draft.photoUrl}
                            alt={profilePreviewName}
                            fill
                            sizes="96px"
                            className="object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                            {profilePreviewName.slice(0, 1).toUpperCase()}
                          </div>
                        )}
                      </div>

                      <div>
                        <p className="text-sm font-semibold text-ink">
                          Profile picture
                        </p>
                        <p className="mt-2 text-sm leading-7 text-muted">
                          Add a clear headshot or keep your Google photo.
                        </p>
                        <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-panelStrong">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleProfilePhotoChange}
                            className="sr-only"
                          />
                          {isUploadingPhoto ? "Uploading photo..." : "Upload photo"}
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Full name
                        </span>
                        <input
                          name="fullName"
                          value={draft.fullName}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                          placeholder="Your full name"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Email
                        </span>
                        <input
                          name="email"
                          type="email"
                          value={draft.email}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                          placeholder="you@example.com"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Country
                        </span>
                        <select
                          name="country"
                          value={draft.country}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                        >
                          <option value="">Select country</option>
                          {countryOptions.map((country) => (
                            <option key={country} value={country}>
                              {country}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          City
                        </span>
                        <input
                          name="city"
                          value={draft.city}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                          placeholder="City"
                        />
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Country code
                        </span>
                        <select
                          name="phoneCountryCode"
                          value={draft.phoneCountryCode}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                        >
                          {phoneCountryCodes.map((entry) => (
                            <option key={`${entry.label}-${entry.code}`} value={entry.code}>
                              {entry.label} ({entry.code})
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Phone number
                        </span>
                        <input
                          name="phoneNumber"
                          type="tel"
                          inputMode="tel"
                          value={draft.phoneNumber}
                          onChange={handleDraftChange}
                          required
                          className={candidateFieldClassName}
                          placeholder="300 1234567"
                        />
                      </label>

                      <label className="block sm:col-span-2">
                        <span className="mb-2 block text-sm font-medium text-ink">
                          Date of birth
                        </span>
                        <input
                          name="dateOfBirth"
                          type="date"
                          value={draft.dateOfBirth}
                          onChange={handleDraftChange}
                          required
                          max={latestEligibleBirthDateInputValue}
                          className={candidateFieldClassName}
                        />
                        <span className="mt-2 block text-xs leading-5 text-muted">
                          You must be at least 18 years old to create a candidate profile.
                        </span>
                      </label>
                    </div>
                  </div>

                  <div className="divide-y divide-slate-100 rounded-[1rem] border border-slate-200 bg-white">
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm leading-6 text-ink transition hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={isWhatsappNumberConfirmed}
                        onChange={(e) => setIsWhatsappNumberConfirmed(e.target.checked)}
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                      />
                      <span>I confirm that all information I provide — including my phone number, name, and contact details — may be used to contact me about roles, tasks, and application updates.</span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm leading-6 text-ink transition hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={isPoliciesAccepted}
                        onChange={(e) => setIsPoliciesAccepted(e.target.checked)}
                        required
                        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                      />
                      <span>
                        I have read and agree to the{" "}
                        <a href="/policy" target="_blank" rel="noreferrer" className="font-semibold text-primary underline underline-offset-2 hover:text-primaryStrong">
                          Privacy &amp; Data Policy
                        </a>
                        , including how my personal data and profile information will be collected, stored, and used.
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-3 px-4 py-3 text-sm leading-6 text-ink transition hover:bg-slate-50">
                      <input
                        name="openToCrowdWork"
                        type="checkbox"
                        checked={draft.openToCrowdWork}
                        onChange={handleDraftChange}
                        className="mt-0.5 h-4 w-4 shrink-0 rounded accent-primary"
                      />
                      <span>Consider me for Crowd Work — short paid tasks matched to my language and profile.</span>
                    </label>
                  </div>

                  <button
                    type="submit"
                    disabled={isSavingProfile || isUploadingPhoto}
                    className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingProfile ? <LoadingSpinner /> : null}
                    {isSavingProfile
                      ? "Saving profile..."
                      : isProfileView
                        ? "Save profile"
                        : "Save profile and continue"}
                  </button>
                </form>
              ) : null}
            </div>
          ) : null}
          </section>
        </div>
      </main>
  );
}
