"use client";

import {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";
import { FormattedJobDescription } from "@/components/formatted-job-description";
import { RichTextEditor } from "@/components/rich-text-editor";
import { mergeHtmlContinuationParagraphs } from "@/lib/html-content";
import { countryOptions } from "@/lib/candidates/portal-data";
import {
  deleteGlobalWorkforceJobApplication,
  deleteGlobalWorkforceJobPost,
  emptyGlobalWorkforceJobDraft,
  formatGlobalWorkforceCompensation,
  getGlobalWorkforceJobPost,
  globalWorkforceJobTypeOptions,
  globalWorkforcePayRateOptions,
  globalWorkforcePipelineOptions,
  globalWorkforceSeniorityOptions,
  globalWorkforceStatusOptions,
  globalWorkforceWorkplaceOptions,
  globalWorkforceApplicationStatusOptions,
  approveGlobalWorkforceJobApplicationCommission,
  assignGlobalWorkforceJobAdmins,
  resetGlobalWorkforceJobApplicationCommission,
  saveGlobalWorkforceJobPost,
  subscribeToGlobalWorkforceJobApplications,
  subscribeToGlobalWorkforceJobPosts,
  updateGlobalWorkforceJobApplicationStatus,
  updateGlobalWorkforceJobApplicationPhone,
  type GlobalWorkforceApplicationStatus,
  worldLanguageOptions,
  type GlobalWorkforceJobApplication,
  type GlobalWorkforceJobDraft,
  type GlobalWorkforceJobPost,
} from "@/lib/firebase/global-workforce-jobs";
import {
  subscribeToGlobalWorkforcePartners,
  type GlobalWorkforcePartner,
} from "@/lib/firebase/global-workforce-partners";
import { generateCandidateDisplayId } from "@/lib/firebase/candidate-portal";
import {
  subscribeToAdminApprovals,
  type AdminApprovalRecord,
} from "@/lib/firebase/admin-access";
import { servicePages } from "@/lib/service-pages";

const jobPayRateRangeOptions: { value: string; label: string; min: number; max: number | null }[] = [
  { value: "0-10",   label: "Under $10",      min: 0,   max: 10   },
  { value: "10-20",  label: "$10 – $20",      min: 10,  max: 20   },
  { value: "20-35",  label: "$20 – $35",      min: 20,  max: 35   },
  { value: "35-50",  label: "$35 – $50",      min: 35,  max: 50   },
  { value: "50-75",  label: "$50 – $75",      min: 50,  max: 75   },
  { value: "75-100", label: "$75 – $100",     min: 75,  max: 100  },
  { value: "100-150",label: "$100 – $150",    min: 100, max: 150  },
  { value: "150-200",label: "$150 – $200",    min: 150, max: 200  },
  { value: "200+",   label: "$200+",          min: 200, max: null },
];

export type GlobalWorkforceAdminSection =
  | "dashboard"
  | "job-posts"
  | "candidates"
  | "signups"
  | "interviews"
  | "data"
  | "commissions"
  | "policies";

type GlobalWorkforceApplicationRecord = GlobalWorkforceJobApplication & {
  jobDocumentId: string;
  jobHumanId: string;
  jobCountry: string;
  jobWorkplace: string;
  jobSeniority: string;
  jobStatus: string;
  jobPipeline: string;
  jobReferenceLink: string;
  jobCompensation: string;
  jobType: string;
  jobOpenings: number;
  jobAssignedAdminEmails: string[];
};

const globalWorkforceApplicationStatusLabels: Record<GlobalWorkforceApplicationStatus, string> = {
  viewed: "Viewed",
  applied: "Applied",
  "ready-for-projects": "Ready for Projects",
  "not-eligible": "Not Eligible",
  "under-review": "Under Review",
  "ready-for-contract": "Ready for Contract",
  "pending-ai-interview": "Pending AI Interview",
  "message-sent": "Message Sent",
};

function buildGlobalWorkforceRoute(
  routeBase: string,
  section: GlobalWorkforceAdminSection,
  params: Record<string, string> = {},
) {
  const separator = routeBase.includes("?") ? "&" : "?";
  const query = new URLSearchParams({ section, ...params });
  return `${routeBase}${separator}${query.toString()}`;
}

function getGlobalWorkforceJobDisplayId(job: Pick<GlobalWorkforceJobPost, "jobId" | "pipeline" | "referenceLink">) {
  return job.pipeline === "External" && job.referenceLink.trim()
    ? job.referenceLink.trim()
    : job.jobId;
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

function getDescriptionText(content: string) {
  return content
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatJobLanguages(job: Pick<GlobalWorkforceJobPost, "languages">) {
  return job.languages.length > 0 ? job.languages.join(", ") : "Not set";
}

function CounterField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (nextValue: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-ink">{label}</span>
      <div className="grid h-12 grid-cols-[44px_minmax(0,1fr)_44px] overflow-hidden rounded-[0.9rem] border border-slate-300 bg-white shadow-sm transition focus-within:border-primary">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          className="inline-flex h-full items-center justify-center border-r border-slate-200 bg-slate-50 text-base font-semibold text-ink transition hover:bg-slate-100"
          aria-label={`Decrease ${label}`}
        >
          -
        </button>
        <input
          type="number"
          min={min}
          value={value}
          onChange={(event) => onChange(Math.max(min, Number(event.target.value) || min))}
          className="h-full w-full border-0 bg-transparent text-center text-sm font-semibold text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
        <button
          type="button"
          onClick={() => onChange(value + 1)}
          className="inline-flex h-full items-center justify-center border-l border-slate-200 bg-slate-50 text-base font-semibold text-ink transition hover:bg-slate-100"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
    </label>
  );
}

function WorkspaceMetricCard({
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
    <article className={["rounded-[1.15rem] border border-slate-200 bg-white px-3 py-3 shadow-panel sm:px-4 sm:py-4", className].join(" ")}>
      <p className="text-[10px] uppercase tracking-[0.2em] text-muted sm:text-[11px]">{label}</p>
      <p className="mt-1.5 text-xl font-semibold text-ink sm:mt-3 sm:text-2xl">{value}</p>
      <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted sm:mt-2 sm:text-sm sm:leading-6">{hint}</p>
    </article>
  );
}

function EmptyWorkspaceState({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-[1.15rem] border border-slate-200 bg-white px-5 py-5 text-sm leading-7 text-muted shadow-panel">
      <p className="text-base font-semibold text-ink">{title}</p>
      <p className="mt-2">{body}</p>
    </div>
  );
}

function ApplicationStatusBadge({ status }: { status: GlobalWorkforceApplicationStatus }) {
  const isPositive = status === "applied" || status === "ready-for-projects" || status === "ready-for-contract";
  const isReview = status === "viewed" || status === "under-review" || status === "pending-ai-interview";
  const isInfo = status === "message-sent";

  return (
    <span
      className={[
        "inline-flex w-fit rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em]",
        isPositive
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : isReview
            ? "border-amber-200 bg-amber-50 text-amber-900"
            : isInfo
              ? "border-sky-200 bg-sky-50 text-sky-900"
              : "border-rose-200 bg-rose-50 text-rose-900",
      ].join(" ")}
    >
      {globalWorkforceApplicationStatusLabels[status] ?? status}
    </span>
  );
}

function formatWhatsAppPhone(countryCode: string, phoneNumber: string) {
  return `${countryCode}${phoneNumber}`.replace(/[^\d]/g, "");
}

function WhatsAppMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
      <path
        fill="currentColor"
        d="M12.04 2a9.86 9.86 0 0 0-8.42 15.01L2.5 21.14a.31.31 0 0 0 .38.38l4.22-1.1A9.86 9.86 0 1 0 12.04 2Zm0 1.7a8.16 8.16 0 1 1-4.27 15.12l-.3-.18-2.57.67.68-2.5-.2-.32A8.16 8.16 0 0 1 12.04 3.7Zm-3.5 4.3c-.2 0-.52.08-.8.38-.28.3-1.05 1.03-1.05 2.5 0 1.48 1.08 2.91 1.23 3.11.15.2 2.1 3.36 5.2 4.57 2.58 1 3.1.8 3.66.75.56-.05 1.8-.73 2.05-1.44.25-.71.25-1.32.18-1.45-.07-.13-.28-.2-.58-.35-.3-.15-1.8-.89-2.08-.99-.28-.1-.48-.15-.68.15-.2.3-.78.99-.95 1.19-.18.2-.35.23-.65.08-.3-.15-1.28-.47-2.43-1.5-.9-.8-1.5-1.78-1.68-2.08-.18-.3-.02-.46.13-.61.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.03-.53-.08-.15-.68-1.64-.93-2.25-.24-.58-.49-.5-.68-.51h-.58Z"
      />
    </svg>
  );
}

function WhatsAppCandidateAction({
  countryCode,
  phoneNumber,
  alwaysVisible = false,
}: {
  countryCode: string;
  phoneNumber: string;
  alwaysVisible?: boolean;
}) {
  const whatsappPhone = formatWhatsAppPhone(countryCode, phoneNumber);

  if (!whatsappPhone) {
    return null;
  }

  return (
    <a
      href={`https://wa.me/${whatsappPhone}`}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={[
        "inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-100 focus:opacity-100",
        alwaysVisible ? "opacity-100" : "opacity-100 sm:opacity-0 sm:group-hover:opacity-100",
      ].join(" ")}
    >
      <WhatsAppMark />
      <span>WhatsApp</span>
    </a>
  );
}

function WhatsAppEditInline({
  jobId,
  uid,
  countryCode,
  phoneNumber,
}: {
  jobId: string;
  uid: string;
  countryCode: string;
  phoneNumber: string;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [draftCode, setDraftCode] = useState(countryCode);
  const [draftNumber, setDraftNumber] = useState(phoneNumber);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing) {
      setDraftCode(countryCode);
      setDraftNumber(phoneNumber);
    }
  }, [countryCode, phoneNumber, isEditing]);

  async function handleSave() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await updateGlobalWorkforceJobApplicationPhone(jobId, uid, draftCode.trim(), draftNumber.trim());
      setIsEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save.");
    } finally {
      setIsSaving(false);
    }
  }

  if (!isEditing) {
    const current = [countryCode, phoneNumber].filter(Boolean).join(" ");
    return (
      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); setIsEditing(true); }}
        className="inline-flex items-center gap-1 text-xs text-muted transition hover:text-primary"
        title="Edit WhatsApp number"
      >
        <span className="font-semibold">{current || "No number"}</span>
        <svg viewBox="0 0 16 16" fill="currentColor" className="h-3 w-3 opacity-50 group-hover:opacity-100"><path d="M11.013 1.427a1.75 1.75 0 0 1 2.474 0l1.086 1.086a1.75 1.75 0 0 1 0 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 0 1-.927-.928l.929-3.25c.081-.286.235-.547.445-.758l8.61-8.609Zm1.414 1.06a.25.25 0 0 0-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 0 0 0-.354l-1.086-1.086ZM11.189 6.25 9.75 4.81 3.428 11.13c-.04.04-.068.086-.083.137l-.575 2.014 2.014-.574a.268.268 0 0 0 .137-.084l6.268-6.374Z" /></svg>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draftCode}
          onChange={(e) => setDraftCode(e.target.value)}
          placeholder="+92"
          className="h-7 w-16 rounded-full border border-slate-300 bg-white px-2 text-xs text-ink outline-none focus:border-primary"
        />
        <input
          value={draftNumber}
          onChange={(e) => setDraftNumber(e.target.value)}
          placeholder="Phone number"
          className="h-7 w-32 rounded-full border border-slate-300 bg-white px-2 text-xs text-ink outline-none focus:border-primary"
        />
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          className="h-7 rounded-full bg-primary px-3 text-xs font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
        >
          {isSaving ? "..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => { setIsEditing(false); setSaveError(null); }}
          className="h-7 w-7 rounded-full border border-slate-200 text-xs text-slate-400 transition hover:bg-slate-100"
        >
          ×
        </button>
      </div>
      {saveError ? <p className="text-xs text-rose-600">{saveError}</p> : null}
    </div>
  );
}

function VerifyApplicationButton({
  application,
  verifyingApplicationKey,
  onVerify,
}: {
  application: GlobalWorkforceJobApplication;
  verifyingApplicationKey: string | null;
  onVerify: (application: GlobalWorkforceJobApplication) => Promise<void>;
}) {
  const key = `${application.jobId}-${application.uid}`;

  if (application.status !== "viewed") {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void onVerify(application)}
      disabled={verifyingApplicationKey === key}
      className="inline-flex w-fit items-center justify-center rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {verifyingApplicationKey === key ? "Verifying..." : "Mark applied"}
    </button>
  );
}

function ApplicationStatusSelect({
  application,
  isUpdating,
  onChange,
}: {
  application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">;
  isUpdating: boolean;
  onChange: (
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) => Promise<void>;
}) {
  return (
    <select
      value={application.status}
      disabled={isUpdating}
      onClick={(event) => event.stopPropagation()}
      onChange={(event) =>
        void onChange(application, event.target.value as GlobalWorkforceApplicationStatus)
      }
      className="h-8 rounded-full border border-slate-300 bg-white px-3 text-[11px] font-semibold text-ink outline-none transition hover:bg-panelStrong disabled:cursor-not-allowed disabled:opacity-60"
    >
      {globalWorkforceApplicationStatusOptions.map((status) => (
        <option key={status} value={status}>
          {globalWorkforceApplicationStatusLabels[status]}
        </option>
      ))}
    </select>
  );
}

function CandidateApplicationDetailsPage({
  application,
  verifyingApplicationKey,
  onBack,
  onVerifyApplication,
  canManageStatuses,
  onUpdateStatus,
}: {
  application: GlobalWorkforceApplicationRecord;
  verifyingApplicationKey: string | null;
  onBack: () => void;
  onVerifyApplication: (application: GlobalWorkforceJobApplication) => Promise<void>;
  canManageStatuses: boolean;
  onUpdateStatus: (
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) => Promise<void>;
}) {
  const displayId =
    application.candidateDisplayId || generateCandidateDisplayId(application.uid);
  const isVerifying = verifyingApplicationKey === `${application.jobId}-${application.uid}`;
  const candidateDetails = [
    { label: "Candidate ID", value: `#${displayId}` },
    { label: "Email", value: application.applicantEmail || "Not available" },
    {
      label: "Location",
      value:
        [application.applicantCity, application.applicantCountry]
          .filter(Boolean)
          .join(", ") || "Not available",
    },
    {
      label: "Phone",
      value:
        [application.applicantPhoneCountryCode, application.applicantPhoneNumber]
          .filter(Boolean)
          .join(" ") || "Not available",
    },
    { label: "Date of birth", value: application.applicantDateOfBirth || "Not available" },
    { label: "Submitted", value: formatApplicationTimestamp(application.createdAt) },
  ];
  const jobDetails = [
    { label: application.jobPipeline === "External" ? "External Job ID" : "Job ID", value: application.jobHumanId },
    { label: "Title", value: application.jobTitle || "Not available" },
    { label: "Pipeline", value: application.jobPipeline || "Internal" },
    { label: "Status", value: application.jobStatus || "Not available" },
    { label: "Country", value: application.jobCountry || "Not available" },
    { label: "Workplace", value: application.jobWorkplace || "Not available" },
    { label: "Job type", value: application.jobType || "Not available" },
    { label: "Seniority", value: application.jobSeniority || "Not available" },
    { label: "Compensation", value: application.jobCompensation || "Not available" },
    { label: "Openings", value: String(application.jobOpenings || "Not available") },
  ];

  return (
    <div className="space-y-5">
        <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-primary"
              >
                <span aria-hidden="true">&lt;</span>
                Candidates
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                Candidate details
              </p>
              <h2 className="mt-2 truncate text-2xl font-semibold text-ink">
                {application.applicantName || "Candidate"}
              </h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <ApplicationStatusBadge status={application.status} />
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {application.jobPipeline === "External" ? "External role" : "Internal role"}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
              {canManageStatuses ? (
                <ApplicationStatusSelect
                  application={application}
                  isUpdating={isVerifying}
                  onChange={onUpdateStatus}
                />
              ) : null}
              <WhatsAppCandidateAction
                countryCode={application.applicantPhoneCountryCode}
                phoneNumber={application.applicantPhoneNumber}
                alwaysVisible
              />
              {application.status === "viewed" ? (
                <button
                  type="button"
                  onClick={() => void onVerifyApplication(application)}
                  disabled={isVerifying}
                  className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isVerifying ? "Marking..." : "Mark applied"}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onBack}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
              >
                Back
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-5 px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-2">
            {candidateDetails.map((item) => (
              <article
                key={item.label}
                className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  {item.label}
                </p>
                {item.label === "Phone" ? (
                  <div className="mt-1.5">
                    <WhatsAppEditInline
                      jobId={application.jobId}
                      uid={application.uid}
                      countryCode={application.applicantPhoneCountryCode}
                      phoneNumber={application.applicantPhoneNumber}
                    />
                  </div>
                ) : (
                  <p className="mt-1.5 break-words text-sm font-semibold leading-6 text-ink">
                    {item.value}
                  </p>
                )}
              </article>
            ))}
          </section>

          <section className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Job info
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {jobDetails.map((item) => (
                <article
                  key={item.label}
                  className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3"
                >
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                    {item.label}
                  </p>
                  <p className="mt-1.5 break-words text-sm font-semibold leading-6 text-ink">
                    {item.value}
                  </p>
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Documents submitted for this job
            </p>
            <div className="mt-4 space-y-3">
              {application.resumeFileUrl ? (
                <a
                  href={application.resumeFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-1 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm transition hover:bg-emerald-100"
                >
                  <span className="font-semibold text-emerald-950">Resume/CV</span>
                  <span className="break-words text-emerald-900">
                    {application.resumeFileName || "Open submitted resume"}
                  </span>
                </a>
              ) : (
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-muted">
                  Resume/CV was not submitted for this job.
                </div>
              )}

              {application.profileLink ? (
                <a
                  href={application.profileLink}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col gap-1 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-3 text-sm transition hover:bg-slate-100"
                >
                  <span className="font-semibold text-ink">Profile link</span>
                  <span className="break-words text-primary">{application.profileLink}</span>
                </a>
              ) : null}
            </div>
          </section>

          {application.coverLetter || application.additionalNotes ? (
            <section className="space-y-3">
              {application.coverLetter ? (
                <article className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Cover letter
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">
                    {application.coverLetter}
                  </p>
                </article>
              ) : null}
              {application.additionalNotes ? (
                <article className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                    Additional notes
                  </p>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-muted">
                    {application.additionalNotes}
                  </p>
                </article>
              ) : null}
            </section>
          ) : null}
        </div>
    </div>
  );
}

function JobApplicantsSummary({ jobId }: { jobId: string }) {
  const [counts, setCounts] = useState({ viewed: 0, applied: 0 });

  useEffect(() => {
    return subscribeToGlobalWorkforceJobApplications(jobId, (applications) => {
      setCounts({
        viewed: applications.filter((application) => application.status === "viewed").length,
        applied: applications.filter((application) => application.status === "applied").length,
      });
    });
  }, [jobId]);

  return (
    <span className="grid min-w-[120px] gap-0.5 text-right text-xs font-semibold text-ink">
      <span>{counts.applied} applied</span>
      {counts.viewed > 0 ? <span className="text-amber-700">{counts.viewed} viewed</span> : null}
    </span>
  );
}

function JobRow({
  job,
  onEdit,
  onDelete,
  onView,
  isDeleting,
  canManageJobs,
  approvedAdmins,
  onAssignAdmins,
}: {
  job: GlobalWorkforceJobPost;
  onEdit: () => void;
  onDelete: () => void;
  onView: () => void;
  isDeleting: boolean;
  canManageJobs: boolean;
  approvedAdmins?: AdminApprovalRecord[];
  onAssignAdmins?: (jobId: string, emails: string[]) => Promise<void>;
}) {
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [localEmails, setLocalEmails] = useState(job.assignedAdminEmails);
  const [isSavingAssign, setIsSavingAssign] = useState(false);
  const flyoutRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalEmails(job.assignedAdminEmails);
  }, [job.assignedAdminEmails]);

  useEffect(() => {
    if (!isAssignOpen) return;
    function handleOutside(e: MouseEvent) {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        setIsAssignOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [isAssignOpen]);

  async function handleToggleAdmin(email: string) {
    const next = localEmails.includes(email)
      ? localEmails.filter((e) => e !== email)
      : [...localEmails, email];
    setLocalEmails(next);
    setIsSavingAssign(true);
    try {
      await onAssignAdmins?.(job.id, next);
    } finally {
      setIsSavingAssign(false);
    }
  }

  const showAdminsButton = canManageJobs && approvedAdmins && approvedAdmins.length > 0;

  return (
    <article className="group relative grid w-full gap-3 rounded-[1.1rem] border border-slate-200 bg-white px-4 py-3.5 transition hover:border-slate-300 hover:bg-panelStrong md:grid-cols-[132px_minmax(0,1fr)_auto] md:items-center">
      <span className="text-sm font-semibold text-ink">
        Job {getGlobalWorkforceJobDisplayId(job)}
      </span>
      <span className="truncate text-sm font-medium text-ink md:text-base">{job.title}</span>
      {/* Applicant count — desktop only, fades out on hover */}
      <div className={["hidden md:flex items-center justify-end transition-opacity duration-150", isAssignOpen ? "opacity-0" : "group-hover:opacity-0"].join(" ")}>
        <JobApplicantsSummary jobId={job.id} />
      </div>
      {/* Action buttons — mobile: always visible below title; desktop: hover-reveal anchored right */}
      <div className={["flex flex-wrap items-center gap-1.5 transition-opacity duration-150 md:absolute md:inset-y-0 md:right-4 md:flex-nowrap", isAssignOpen ? "md:opacity-100" : "md:opacity-0 md:group-hover:opacity-100"].join(" ")}>
        <button
          type="button"
          onClick={onView}
          className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-slate-100"
        >
          View
        </button>
        {canManageJobs ? (
          <>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-ink transition hover:bg-slate-100"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={isDeleting}
              className="inline-flex items-center justify-center whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isDeleting ? "..." : "Delete"}
            </button>
            {showAdminsButton ? (
              <div ref={flyoutRef} className="relative inline-flex items-center">
                <button
                  type="button"
                  onClick={() => setIsAssignOpen((v) => !v)}
                  className={[
                    "inline-flex items-center justify-center whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                    localEmails.length > 0
                      ? "border-primary/40 bg-[#eef4fb] text-primary hover:bg-primary/20"
                      : "border-slate-300 bg-white text-ink hover:bg-slate-100",
                  ].join(" ")}
                >
                  {isSavingAssign ? "..." : localEmails.length > 0 ? `${localEmails.length} admin${localEmails.length > 1 ? "s" : ""}` : "Assign"}
                </button>
                {isAssignOpen ? (
                  <div className="absolute right-0 top-full z-50 mt-1.5 w-60 rounded-[1rem] border border-slate-200 bg-white py-1.5 shadow-[0_12px_36px_rgba(10,22,40,0.12)]">
                    <p className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Assign to admins
                    </p>
                    {approvedAdmins?.map((admin) => {
                      const assigned = localEmails.includes(admin.email);
                      return (
                        <button
                          key={admin.email}
                          type="button"
                          disabled={isSavingAssign}
                          onClick={() => void handleToggleAdmin(admin.email)}
                          className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition hover:bg-slate-50 disabled:opacity-60"
                        >
                          <span className={["inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold", assigned ? "border-primary bg-primary text-white" : "border-slate-300"].join(" ")}>
                            {assigned ? "✓" : ""}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{admin.contactName || admin.email}</span>
                            {admin.contactName ? <span className="block truncate text-[11px] text-slate-400">{admin.email}</span> : null}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

function JobDetailsDrawer({
  job,
  partners,
  onClose,
  onEdit,
  onDelete,
  isDeleting,
}: {
  job: GlobalWorkforceJobPost;
  partners: GlobalWorkforcePartner[];
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const [isMounted, setIsMounted] = useState(false);
  const [applications, setApplications] = useState<GlobalWorkforceJobApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [verifyingApplicationKey, setVerifyingApplicationKey] = useState<string | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setIsMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  function handleClose() {
    setIsMounted(false);
    setTimeout(onClose, 300);
  }

  useEffect(() => {
    setIsLoadingApplications(true);
    setApplicationsError(null);

    return subscribeToGlobalWorkforceJobApplications(
      job.id,
      (nextApplications) => {
        setApplications(nextApplications);
        setIsLoadingApplications(false);
      },
      (error) => {
        setApplicationsError(error.message);
        setIsLoadingApplications(false);
      },
    );
  }, [job.id]);

  async function verifyApplication(application: GlobalWorkforceJobApplication) {
    const key = `${application.jobId}-${application.uid}`;
    setVerifyingApplicationKey(key);
    setApplicationsError(null);

    try {
      await updateGlobalWorkforceJobApplicationStatus(
        application.jobId,
        application.uid,
        "applied",
      );
    } catch (error) {
      setApplicationsError(
        error instanceof Error
          ? error.message
          : "We could not mark this candidate as applied.",
      );
    } finally {
      setVerifyingApplicationKey(null);
    }
  }

  const detailItems = [
    { label: "Job type", value: job.jobType },
    { label: "Workplace", value: job.workplace },
    { label: "Languages", value: formatJobLanguages(job) },
    { label: "Countries", value: (job.countries.length > 0 ? job.countries : job.country ? [job.country] : []).join(", ") || "Not set" },
    { label: "Seniority", value: job.seniority },
    { label: "Openings", value: String(job.openings) },
    { label: "Pay", value: job.compensation },
    { label: "Pipeline", value: job.pipeline || "Internal" },
  ];

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div
        aria-hidden="true"
        onClick={handleClose}
        className={[
          "absolute inset-0 transition-opacity duration-300 bg-slate-950/35",
          isMounted ? "opacity-100" : "opacity-0 pointer-events-none",
        ].join(" ")}
      />
      {/* Transform container — no overflow so the slide animation is GPU-composited cleanly */}
      <aside
        className={[
          "absolute bottom-0 left-0 right-0 flex flex-col bg-white shadow-panel transition-transform duration-300 ease-out",
          "max-h-[90vh] rounded-t-2xl",
          "sm:inset-y-0 sm:left-auto sm:max-w-4xl sm:max-h-none sm:rounded-none sm:border-l sm:border-slate-200",
          isMounted
            ? "translate-y-0 sm:translate-x-0"
            : "translate-y-full sm:translate-x-full sm:translate-y-0",
        ].join(" ")}
      >
        <div className="shrink-0 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                Job {getGlobalWorkforceJobDisplayId(job)}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">{job.title}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {job.status}
                </span>
                <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                  {applications.length} tracked
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={onDelete}
                disabled={isDeleting}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeleting ? <LoadingSpinner className="h-4 w-4 border-rose-300 border-t-rose-900" /> : null}
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-lg text-ink transition hover:bg-panelStrong"
                aria-label="Close drawer"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        {/* Scrollable content — separate from the transform container so animation is always smooth */}
        <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 px-5 py-5">
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {detailItems.map((item) => (
              <article
                key={item.label}
                className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3"
              >
                <p className="text-[11px] uppercase tracking-[0.18em] text-muted">
                  {item.label}
                </p>
                <p className="mt-1.5 text-sm font-semibold leading-6 text-ink">{item.value}</p>
              </article>
            ))}
          </section>

          <section className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Keywords
            </p>
            {job.keywords.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {job.keywords.map((keyword) => (
                  <span
                    key={keyword}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted">No keywords added.</p>
            )}
          </section>

          <section className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
              Job description
            </p>
            <div className="mt-4">
              <FormattedJobDescription content={job.description} />
            </div>
          </section>

          {job.instructions ? (
            <section className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Application instructions
              </p>
              <div className="mt-4">
                <FormattedJobDescription
                  content={job.instructions}
                  className="job-rich-content space-y-3 text-sm leading-7 text-ink"
                />
              </div>
            </section>
          ) : null}

          <section className="rounded-[1.2rem] border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Candidate activity
              </p>
              <span className="text-sm font-semibold text-ink">{applications.length}</span>
            </div>

            {isLoadingApplications ? (
              <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
                <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
                <span>Loading candidates...</span>
              </div>
            ) : null}

            {applicationsError ? (
              <div className="mt-4 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                {applicationsError}
              </div>
            ) : null}

            {!isLoadingApplications && applications.length === 0 ? (
              <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
                No candidate activity has been recorded for this job yet.
              </div>
            ) : null}

            {!isLoadingApplications && applications.length > 0 ? (
              <div className="mt-4 space-y-3">
                {applications.map((application) => (
                  <article
                    key={`${application.jobId}-${application.uid}`}
                    className="group rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="relative h-12 w-12 overflow-hidden rounded-full border border-slate-200 bg-white">
                          {application.applicantPhotoUrl ? (
                            <Image
                              src={application.applicantPhotoUrl}
                              alt={application.applicantName || "Candidate"}
                              fill
                              sizes="48px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary">
                              {(application.applicantName || "C").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {application.applicantName || "Candidate"}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {application.applicantEmail}
                          </p>
                          <div className="mt-2">
                            <ApplicationStatusBadge status={application.status} />
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-3 md:items-end">
                        <WhatsAppCandidateAction
                          countryCode={application.applicantPhoneCountryCode}
                          phoneNumber={application.applicantPhoneNumber}
                        />
                        <div className="grid gap-2 text-sm text-muted md:text-right">
                          <p>
                            {[application.applicantCity, application.applicantCountry]
                              .filter(Boolean)
                              .join(", ") || "Location not set"}
                          </p>
                          <WhatsAppEditInline
                            jobId={application.jobId}
                            uid={application.uid}
                            countryCode={application.applicantPhoneCountryCode}
                            phoneNumber={application.applicantPhoneNumber}
                          />
                        </div>
                        <VerifyApplicationButton
                          application={application}
                          verifyingApplicationKey={verifyingApplicationKey}
                          onVerify={verifyApplication}
                        />
                      </div>
                    </div>

                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                      {application.resumeFileUrl ? (
                        <a
                          href={application.resumeFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex text-sm font-semibold text-primary transition hover:text-primaryStrong"
                        >
                          Open resume/CV
                        </a>
                      ) : (
                        <p className="text-sm text-muted">Resume/CV not available.</p>
                      )}

                      {application.profileLink ? (
                        <p className="text-sm leading-7 text-muted">
                          <span className="font-semibold text-ink">Profile link:</span>{" "}
                          <a
                            href={application.profileLink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary transition hover:text-primaryStrong"
                          >
                            {application.profileLink}
                          </a>
                        </p>
                      ) : null}

                      {application.coverLetter ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                            Cover letter
                          </p>
                          <p className="mt-2 text-sm leading-7 text-muted">
                            {application.coverLetter}
                          </p>
                        </div>
                      ) : null}

                      {application.additionalNotes ? (
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                            Additional notes
                          </p>
                          <p className="mt-2 text-sm leading-7 text-muted">
                            {application.additionalNotes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </div>
        </div>
      </aside>
    </div>
  );
}

function GlobalWorkforceJobViewPage({
  jobId,
  partners,
  routeBase,
  canManageJobs,
}: {
  jobId: string;
  partners: GlobalWorkforcePartner[];
  routeBase: string;
  canManageJobs: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState<GlobalWorkforceJobPost | null>(null);
  const [isLoadingJob, setIsLoadingJob] = useState(true);
  const [applications, setApplications] = useState<GlobalWorkforceJobApplication[]>([]);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [verifyingApplicationKey, setVerifyingApplicationKey] = useState<string | null>(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoadingJob(true);

    getGlobalWorkforceJobPost(jobId)
      .then((loaded) => {
        if (!cancelled) {
          setJob(loaded ?? null);
          setIsLoadingJob(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to load job.");
          setIsLoadingJob(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jobId]);

  useEffect(() => {
    if (!job) return;
    setIsLoadingApplications(true);

    return subscribeToGlobalWorkforceJobApplications(
      job.id,
      (apps) => {
        setApplications(apps);
        setIsLoadingApplications(false);
      },
      (err) => {
        setErrorMessage(err.message);
        setIsLoadingApplications(false);
      },
    );
  }, [job]);

  async function handleVerify(application: GlobalWorkforceJobApplication) {
    const key = `${application.jobId}-${application.uid}`;
    setVerifyingApplicationKey(key);
    try {
      await updateGlobalWorkforceJobApplicationStatus(application.jobId, application.uid, "applied");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not mark as applied.");
    } finally {
      setVerifyingApplicationKey(null);
    }
  }

  async function handleUpdateStatus(
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) {
    if (!canManageJobs || application.status === status) {
      return;
    }

    const key = `${application.jobId}-${application.uid}`;
    setVerifyingApplicationKey(key);
    setErrorMessage(null);

    try {
      await updateGlobalWorkforceJobApplicationStatus(application.jobId, application.uid, status);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not update candidate status.");
    } finally {
      setVerifyingApplicationKey(null);
    }
  }

  async function handleDelete() {
    if (!canManageJobs) return;
    if (!job) return;
    if (
      !window.confirm(
        `Delete Job ${job.jobId} (${job.title})? This will also remove its candidate applications.`,
      )
    )
      return;
    setIsDeletingJob(true);
    try {
      await deleteGlobalWorkforceJobPost(job.id);
      router.replace(buildGlobalWorkforceRoute(routeBase, "job-posts"));
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Could not delete this job.");
      setIsDeletingJob(false);
    }
  }

  function handleEdit() {
    if (!canManageJobs) return;
    if (!job) return;
    router.push(
      buildGlobalWorkforceRoute(routeBase, "job-posts", { jobEditor: job.jobId }),
    );
  }

  const backHref = buildGlobalWorkforceRoute(routeBase, "job-posts");

  if (isLoadingJob) {
    return (
      <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
        <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
        <span>Loading job...</span>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="space-y-4">
        {errorMessage ? (
          <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-900">
            {errorMessage}
          </div>
        ) : null}
        <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-5 text-sm text-muted">
          Job not found.{" "}
          <a href={backHref} className="font-semibold text-primary hover:text-primaryStrong">
            Back to job posts
          </a>
        </div>
      </div>
    );
  }

  const detailItems = [
    { label: "Job type", value: job.jobType },
    { label: "Workplace", value: job.workplace },
    { label: "Languages", value: formatJobLanguages(job) },
    { label: "Countries", value: (job.countries.length > 0 ? job.countries : job.country ? [job.country] : []).join(", ") || "Not set" },
    { label: "Seniority", value: job.seniority },
    { label: "Openings", value: String(job.openings) },
    { label: "Pay", value: job.compensation },
    { label: "Pipeline", value: job.pipeline || "Internal" },
    ...(canManageJobs && job.pipeline === "External"
      ? [
          {
            label: "Partner company",
            value:
              partners.find((p) => p.referenceId === job.referenceId)?.name ??
              "Company not found",
          },
          { label: "External Job ID", value: job.referenceLink || "—" },
        ]
      : []),
    ...(canManageJobs ? [{ label: "Created by", value: job.createdByEmail || "Not available" }] : []),
  ];

  return (
    <div className="space-y-6">
      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <a
              href={backHref}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted transition hover:text-primary"
            >
              <span aria-hidden="true">←</span>
              Job posts
            </a>
            <p className="mt-3 text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Job {getGlobalWorkforceJobDisplayId(job)}
            </p>
            <h2 className="mt-1.5 text-2xl font-semibold text-ink">{job.title}</h2>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {job.status}
              </span>
              <span className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                {applications.length} tracked
              </span>
            </div>
          </div>
          {canManageJobs ? (
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleEdit}
                className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
              >
                Edit
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={isDeletingJob}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isDeletingJob ? (
                  <LoadingSpinner className="h-4 w-4 border-rose-300 border-t-rose-900" />
                ) : null}
                {isDeletingJob ? "Deleting..." : "Delete"}
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {detailItems.map((item) => (
          <article
            key={item.label}
            className="rounded-[1rem] border border-slate-200 bg-white px-3 py-3 shadow-sm"
          >
            <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{item.label}</p>
            <p className="mt-1.5 text-sm font-semibold leading-6 text-ink">{item.value}</p>
          </article>
        ))}
      </section>

      <section className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Keywords</p>
        {job.keywords.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {job.keywords.map((keyword) => (
              <span
                key={keyword}
                className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900"
              >
                {keyword}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-3 text-sm text-muted">No keywords added.</p>
        )}
      </section>

      <section className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
          Job description
        </p>
        <div className="mt-4">
          <FormattedJobDescription content={job.description} />
        </div>
      </section>

      {job.instructions ? (
        <section className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Application instructions
          </p>
          <div className="mt-4">
            <FormattedJobDescription
              content={job.instructions}
              className="job-rich-content space-y-3 text-sm leading-7 text-ink"
            />
          </div>
        </section>
      ) : null}

      <section className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Candidate activity
          </p>
          <span className="text-sm font-semibold text-ink">{applications.length}</span>
        </div>

        {isLoadingApplications ? (
          <div className="mt-4 flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
            <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
            <span>Loading candidates...</span>
          </div>
        ) : null}

        {!isLoadingApplications && applications.length === 0 ? (
          <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
            No candidate activity recorded for this job yet.
          </div>
        ) : null}

        {!isLoadingApplications && applications.length > 0 ? (
          <div className="mt-4 overflow-hidden rounded-[1rem] border border-slate-200">
            <div className="divide-y divide-slate-100">
              {applications.map((application) => {
                const displayId =
                  application.candidateDisplayId ||
                  generateCandidateDisplayId(application.uid);
                const verifyKey = `${application.jobId}-${application.uid}`;
                const isVerifying = verifyingApplicationKey === verifyKey;

                return (
                  <article
                    key={verifyKey}
                    className="group px-4 py-3 transition hover:bg-slate-50"
                  >
                    <div className="flex items-center justify-between gap-3 min-w-0">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-white">
                          {application.applicantPhotoUrl ? (
                            <Image
                              src={application.applicantPhotoUrl}
                              alt={application.applicantName || "Candidate"}
                              fill
                              sizes="32px"
                              className="object-cover"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-primary">
                              {(application.applicantName || "C").slice(0, 1).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[10px] font-bold text-primarySoft">
                              #{displayId}
                            </span>
                            <span className="truncate text-sm font-semibold text-ink">
                              {application.applicantName || "Candidate"}
                            </span>
                          </div>
                          <p className="truncate text-xs text-muted">
                            {application.applicantEmail}
                          </p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <WhatsAppCandidateAction
                          countryCode={application.applicantPhoneCountryCode}
                          phoneNumber={application.applicantPhoneNumber}
                        />
                        <ApplicationStatusBadge status={application.status} />
                        {canManageJobs ? (
                          <span className="hidden sm:block">
                            <ApplicationStatusSelect
                              application={application}
                              isUpdating={isVerifying}
                              onChange={handleUpdateStatus}
                            />
                          </span>
                        ) : null}
                        {application.status === "viewed" ? (
                          <button
                            type="button"
                            onClick={() => void handleVerify(application)}
                            disabled={isVerifying}
                            className="hidden sm:inline-flex items-center justify-center rounded-full bg-primary px-3 py-1 text-[11px] font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isVerifying ? "..." : "Mark applied"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-10 text-xs text-muted">
                      <span>
                        {[application.applicantCity, application.applicantCountry]
                          .filter(Boolean)
                          .join(", ") || "Location not set"}
                      </span>
                      {application.resumeFileUrl ? (
                        <a
                          href={application.resumeFileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="font-semibold text-primary hover:text-primaryStrong"
                        >
                          Resume/CV
                        </a>
                      ) : null}
                      {application.coverLetter ? (
                        <span className="text-slate-400 italic">Has cover letter</span>
                      ) : null}
                      <WhatsAppEditInline
                        jobId={application.jobId}
                        uid={application.uid}
                        countryCode={application.applicantPhoneCountryCode}
                        phoneNumber={application.applicantPhoneNumber}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}

function GlobalWorkforceDashboardSection({
  jobs,
  applications,
}: {
  jobs: GlobalWorkforceJobPost[];
  applications: GlobalWorkforceApplicationRecord[];
}) {
  const openJobs = jobs.filter((job) => job.status === "Open").length;
  const activeCountries = new Set(jobs.flatMap((job) => job.countries.length > 0 ? job.countries : job.country ? [job.country] : []).filter(Boolean)).size;
  const activeLanguages = new Set(jobs.flatMap((job) => job.languages).filter(Boolean)).size;
  const appliedCandidates = new Set(applications.map((application) => application.uid)).size;
  const latestApplications = applications.slice(0, 6);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Dashboard</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Keep an eye on hiring momentum, active coverage, and the current candidate
          pipeline for Global Managed Workforce roles.
        </p>
      </section>

      <section className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0" style={{ scrollbarWidth: "none" }}>
        <WorkspaceMetricCard
          className="w-40 shrink-0 xl:w-auto"
          label="Open roles"
          value={String(openJobs).padStart(2, "0")}
          hint="Job posts that are still accepting applications."
        />
        <WorkspaceMetricCard
          className="w-40 shrink-0 xl:w-auto"
          label="Applications"
          value={String(applications.length).padStart(2, "0")}
          hint="Submitted applications mirrored into the workforce workspace."
        />
        <WorkspaceMetricCard
          className="w-40 shrink-0 xl:w-auto"
          label="Candidate pool"
          value={String(appliedCandidates).padStart(2, "0")}
          hint="Unique candidates currently active across your jobs."
        />
        <WorkspaceMetricCard
          className="w-40 shrink-0 xl:w-auto"
          label="Coverage"
          value={`${activeCountries}/${activeLanguages}`}
          hint="Countries and languages represented across live postings."
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                Recent candidate activity
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                The newest applications coming into Global Managed Workforce.
              </p>
            </div>
            <span className="text-sm font-semibold text-ink">{applications.length}</span>
          </div>

          {latestApplications.length === 0 ? (
            <div className="mt-4">
              <EmptyWorkspaceState
                title="No applications yet"
                body="Once candidates apply to job posts, their activity will show up here."
              />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {latestApplications.map((application) => (
                <article
                  key={`${application.jobId}-${application.uid}`}
                  className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {application.applicantName || "Candidate"}
                      </p>
                      <p className="mt-1 text-sm text-muted">{application.jobTitle}</p>
                    </div>
                    <div className="text-sm text-muted sm:text-right">
                      <p>{[application.applicantCity, application.applicantCountry].filter(Boolean).join(", ") || "Location not set"}</p>
                      <p className="mt-1">{application.applicantEmail}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="rounded-[1.2rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Workforce snapshot
          </p>
          <div className="mt-4 space-y-3">
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Paused roles</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {jobs.filter((job) => job.status === "Paused").length}
              </p>
            </div>
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Closed roles</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {jobs.filter((job) => job.status === "Closed").length}
              </p>
            </div>
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted">Openings listed</p>
              <p className="mt-2 text-lg font-semibold text-ink">
                {jobs.reduce((total, job) => total + job.openings, 0)}
              </p>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}

function formatApplicationTimestamp(createdAt: unknown): string {
  if (!createdAt || typeof createdAt !== "object") return "—";
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  const date = ts.toDate ? ts.toDate() : ts.seconds ? new Date(ts.seconds * 1000) : null;
  if (!date) return "—";
  return `${date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })} · ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
}

function getTimestampMs(createdAt: unknown): number {
  if (!createdAt || typeof createdAt !== "object") return 0;
  const ts = createdAt as { toDate?: () => Date; seconds?: number };
  if (ts.toDate) return ts.toDate().getTime();
  if (ts.seconds) return ts.seconds * 1000;
  return 0;
}

function CandidateApplicationDrawer({
  application,
  onClose,
  verifyingApplicationKey,
  onVerifyApplication,
  onUpdateStatus,
  onDeleteApplication,
  canManageStatuses,
  canMarkMessageSent = false,
}: {
  application: GlobalWorkforceApplicationRecord;
  onClose: () => void;
  verifyingApplicationKey: string | null;
  onVerifyApplication: (application: GlobalWorkforceJobApplication) => Promise<void>;
  onUpdateStatus: (
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) => Promise<void>;
  onDeleteApplication?: (application: GlobalWorkforceApplicationRecord) => Promise<void>;
  canManageStatuses: boolean;
  canMarkMessageSent?: boolean;
}) {
  const [isDeleting, setIsDeleting] = useState(false);
  const displayId = application.candidateDisplayId || generateCandidateDisplayId(application.uid);
  const verifyKey = `${application.jobId}-${application.uid}`;
  const isVerifying = verifyingApplicationKey === verifyKey;

  useEffect(() => {
    function onKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function handleDelete() {
    if (!onDeleteApplication) return;
    if (!window.confirm(`Delete ${application.applicantName || "this candidate"}? This cannot be undone.`)) return;
    setIsDeleting(true);
    try {
      await onDeleteApplication(application);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  }

  const candidateDetails = [
    { label: "Candidate ID", value: `#${displayId}` },
    { label: "Email", value: application.applicantEmail || "Not available" },
    {
      label: "Location",
      value: [application.applicantCity, application.applicantCountry].filter(Boolean).join(", ") || "Not available",
    },
    { label: "Date of birth", value: application.applicantDateOfBirth || "Not available" },
    { label: "Submitted", value: formatApplicationTimestamp(application.createdAt) },
  ];
  const jobDetails = [
    { label: application.jobPipeline === "External" ? "External ID" : "Job ID", value: application.jobHumanId },
    { label: "Title", value: application.jobTitle || "Not available" },
    { label: "Status", value: application.jobStatus || "Not available" },
    { label: "Country", value: application.jobCountry || "Not available" },
    { label: "Workplace", value: application.jobWorkplace || "Not available" },
    { label: "Type", value: application.jobType || "Not available" },
    { label: "Seniority", value: application.jobSeniority || "Not available" },
    { label: "Compensation", value: application.jobCompensation || "Not available" },
  ];

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel: bottom sheet on mobile, right side panel on lg+ */}
      <div className={[
        "absolute flex flex-col overflow-hidden bg-white",
        /* mobile: bottom sheet */
        "bottom-0 left-0 right-0 max-h-[88vh] rounded-t-[1.5rem] shadow-[0_-20px_60px_rgba(10,22,40,0.22)]",
        /* desktop: right panel */
        "lg:bottom-0 lg:left-auto lg:right-0 lg:top-0 lg:h-full lg:w-[480px] lg:max-h-full lg:rounded-none lg:rounded-l-[1.5rem] lg:shadow-[-24px_0_60px_rgba(10,22,40,0.14)]",
      ].join(" ")}>
        {/* Mobile drag handle only */}
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-slate-200 lg:hidden" />

        {/* Header */}
        <div className="flex shrink-0 items-start justify-between gap-4 px-5 pb-4 pt-3 lg:pt-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted">
              Candidate
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold text-ink">
                {application.applicantName || "Candidate"}
              </h2>
              <span className="font-mono text-sm font-bold text-primarySoft">#{displayId}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <ApplicationStatusBadge status={application.status} />
              {application.jobPipeline === "External" ? (
                <span className="rounded-full border border-slate-200 bg-panelStrong px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
                  External
                </span>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3">
          {canManageStatuses ? (
            <ApplicationStatusSelect
              application={application}
              isUpdating={isVerifying}
              onChange={onUpdateStatus}
            />
          ) : canMarkMessageSent && (application.status === "applied" || application.status === "viewed") ? (
            <button
              type="button"
              onClick={() => void onUpdateStatus(application, "message-sent")}
              disabled={isVerifying}
              className="inline-flex items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-900 transition hover:bg-sky-100 disabled:opacity-60"
            >
              {isVerifying ? "Updating..." : "Mark message sent"}
            </button>
          ) : null}
          <WhatsAppCandidateAction
            countryCode={application.applicantPhoneCountryCode}
            phoneNumber={application.applicantPhoneNumber}
            alwaysVisible
          />
          {application.status === "viewed" && canManageStatuses ? (
            <button
              type="button"
              onClick={() => void onVerifyApplication(application)}
              disabled={isVerifying}
              className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
            >
              {isVerifying ? "Marking..." : "Mark applied"}
            </button>
          ) : null}
          {onDeleteApplication ? (
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={isDeleting}
              className="inline-flex items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-900 transition hover:bg-rose-100 disabled:opacity-60"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          ) : null}
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200">
          <div className="space-y-5 px-5 py-5">
            {/* Candidate details */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Candidate details
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {candidateDetails.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-muted">Phone</p>
                  <div className="mt-1">
                    <WhatsAppEditInline
                      jobId={application.jobId}
                      uid={application.uid}
                      countryCode={application.applicantPhoneCountryCode}
                      phoneNumber={application.applicantPhoneNumber}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Job info */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Job info · <span className="font-mono">{application.jobHumanId}</span>
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {jobDetails.map((item) => (
                  <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                    <p className="text-[10px] uppercase tracking-[0.18em] text-muted">{item.label}</p>
                    <p className="mt-1 break-words text-sm font-semibold text-ink">{item.value}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Documents */}
            <section>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted">
                Documents
              </p>
              <div className="space-y-2">
                {application.resumeFileUrl ? (
                  <a
                    href={application.resumeFileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-100"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-emerald-600">
                      <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{application.resumeFileName || "Open resume"}</span>
                  </a>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-sm text-muted">
                    No resume submitted.
                  </div>
                )}
                {application.profileLink ? (
                  <a
                    href={application.profileLink}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 rounded-xl border border-slate-200 bg-panelStrong px-4 py-3 text-sm transition hover:bg-slate-100"
                  >
                    <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-slate-400">
                      <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                      <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                    </svg>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-ink">Profile link</span>
                      <span className="block truncate text-xs text-primary">{application.profileLink}</span>
                    </span>
                  </a>
                ) : null}
              </div>
            </section>
          </div>
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
}

function GlobalWorkforceCandidatesSection({
  applications,
  verifyingApplicationKey,
  onVerifyApplication,
  onUpdateStatus,
  onOpenApplication,
  onDeleteApplication,
  errorMessage,
  successMessage,
  canManageStatuses,
  canMarkMessageSent = false,
  approvedAdmins,
  mode = "candidates",
}: {
  applications: GlobalWorkforceApplicationRecord[];
  verifyingApplicationKey: string | null;
  onVerifyApplication: (application: GlobalWorkforceJobApplication) => Promise<void>;
  onUpdateStatus: (
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) => Promise<void>;
  onOpenApplication: (application: GlobalWorkforceApplicationRecord) => void;
  onDeleteApplication?: (application: GlobalWorkforceApplicationRecord) => Promise<void>;
  errorMessage?: string | null;
  successMessage?: string | null;
  canManageStatuses: boolean;
  canMarkMessageSent?: boolean;
  approvedAdmins?: AdminApprovalRecord[];
  mode?: "candidates" | "signups";
}) {
  const [drawerApplication, setDrawerApplication] = useState<GlobalWorkforceApplicationRecord | null>(null);
  const [candidateSearchQuery, setCandidateSearchQuery] = useState("");
  const [candidateCountryFilter, setCandidateCountryFilter] = useState("all");
  const [candidateUserFilter, setCandidateUserFilter] = useState("all");
  const [candidateStatusFilter, setCandidateStatusFilter] = useState("all");
  const [candidateJobStatusFilter, setCandidateJobStatusFilter] = useState("all");
  const [candidateWorkplaceFilter, setCandidateWorkplaceFilter] = useState("all");
  const [candidateSeniorityFilter, setCandidateSeniorityFilter] = useState("all");
  const [candidateJobFilter, setCandidateJobFilter] = useState("all");
  const [candidateDateFromFilter, setCandidateDateFromFilter] = useState("");
  const [candidateDateToFilter, setCandidateDateToFilter] = useState("");
  const [candidateSortMode, setCandidateSortMode] = useState<"latest" | "status">("latest");
  const candidateFiltersScrollRef = useRef<HTMLDivElement | null>(null);
  const viewedCount = applications.filter((a) => a.status === "viewed").length;
  const appliedCount = applications.filter((a) => a.status === "applied").length;

  const sorted = useMemo(
    () =>
      [...applications].sort((a, b) => {
        if (candidateSortMode === "status") {
          const statusDelta =
            globalWorkforceApplicationStatusOptions.indexOf(a.status) -
            globalWorkforceApplicationStatusOptions.indexOf(b.status);

          if (statusDelta !== 0) {
            return statusDelta;
          }
        }

        return getTimestampMs(b.createdAt) - getTimestampMs(a.createdAt);
      }),
    [applications, candidateSortMode],
  );
  const candidateCountryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          applications
            .flatMap((application) => [
              application.applicantCountry,
              application.jobCountry,
            ])
            .filter(Boolean),
        ),
      ).sort((left, right) => left.localeCompare(right)),
    [applications],
  );
  const candidateUserOptions = useMemo(() => {
    const users = new Map<string, string>();

    applications.forEach((application) => {
      if (!application.uid || users.has(application.uid)) {
        return;
      }

      const displayId =
        application.candidateDisplayId || generateCandidateDisplayId(application.uid);
      const label = [
        `#${displayId}`,
        application.applicantName || "Candidate",
        application.applicantEmail,
      ]
        .filter(Boolean)
        .join(" - ");

      users.set(application.uid, label);
    });

    return Array.from(users.entries()).sort((left, right) =>
      left[1].localeCompare(right[1]),
    );
  }, [applications]);
  const candidateJobOptions = useMemo(
    () =>
      Array.from(
        applications.reduce((map, application) => {
          const jobKey = application.jobDocumentId || application.jobId;
          if (!jobKey || map.has(jobKey)) {
            return map;
          }

          map.set(
            jobKey,
            [application.jobHumanId, application.jobTitle].filter(Boolean).join(" - "),
          );
          return map;
        }, new Map<string, string>()),
      ).sort((left, right) => left[1].localeCompare(right[1])),
    [applications],
  );
  const filteredApplications = useMemo(() => {
    const normalizedSearchQuery = candidateSearchQuery.trim().toLowerCase();
    const dateFromMs = candidateDateFromFilter
      ? new Date(`${candidateDateFromFilter}T00:00:00`).getTime()
      : null;
    const dateToMs = candidateDateToFilter
      ? new Date(`${candidateDateToFilter}T23:59:59`).getTime()
      : null;

    return sorted.filter((application) => {
      const displayId =
        application.candidateDisplayId || generateCandidateDisplayId(application.uid);
      const searchableValue = [
        displayId,
        application.uid,
        application.applicantName,
        application.applicantEmail,
        application.applicantCountry,
        application.applicantCity,
        application.jobHumanId,
        application.jobTitle,
        application.jobCountry,
        application.jobWorkplace,
        application.jobSeniority,
        application.jobStatus,
        application.status,
        application.resumeFileName,
      ]
        .join(" ")
        .toLowerCase();
      const applicationTimeMs = getTimestampMs(application.createdAt);
      const applicationJobKey = application.jobDocumentId || application.jobId;

      if (normalizedSearchQuery && !searchableValue.includes(normalizedSearchQuery)) {
        return false;
      }

      if (
        candidateCountryFilter !== "all" &&
        application.applicantCountry !== candidateCountryFilter &&
        application.jobCountry !== candidateCountryFilter
      ) {
        return false;
      }

      if (candidateUserFilter !== "all" && application.uid !== candidateUserFilter) {
        return false;
      }

      if (candidateStatusFilter !== "all" && application.status !== candidateStatusFilter) {
        return false;
      }

      if (
        candidateJobStatusFilter !== "all" &&
        application.jobStatus !== candidateJobStatusFilter
      ) {
        return false;
      }

      if (
        candidateWorkplaceFilter !== "all" &&
        application.jobWorkplace !== candidateWorkplaceFilter
      ) {
        return false;
      }

      if (
        candidateSeniorityFilter !== "all" &&
        application.jobSeniority !== candidateSeniorityFilter
      ) {
        return false;
      }

      if (candidateJobFilter !== "all" && applicationJobKey !== candidateJobFilter) {
        return false;
      }

      if (dateFromMs !== null && applicationTimeMs < dateFromMs) {
        return false;
      }

      if (dateToMs !== null && applicationTimeMs > dateToMs) {
        return false;
      }

      return true;
    });
  }, [
    candidateCountryFilter,
    candidateDateFromFilter,
    candidateDateToFilter,
    candidateJobFilter,
    candidateJobStatusFilter,
    candidateSearchQuery,
    candidateSeniorityFilter,
    candidateStatusFilter,
    candidateUserFilter,
    candidateWorkplaceFilter,
    sorted,
  ]);

  function clearCandidateFilters() {
    setCandidateSearchQuery("");
    setCandidateCountryFilter("all");
    setCandidateUserFilter("all");
    setCandidateStatusFilter("all");
    setCandidateJobStatusFilter("all");
    setCandidateWorkplaceFilter("all");
    setCandidateSeniorityFilter("all");
    setCandidateJobFilter("all");
    setCandidateDateFromFilter("");
    setCandidateDateToFilter("");
    setCandidateSortMode("latest");
  }

  function scrollCandidateFilters(direction: "left" | "right") {
    const container = candidateFiltersScrollRef.current;

    if (!container) {
      return;
    }

    container.scrollBy({
      left: direction === "left" ? -320 : 320,
      behavior: "smooth",
    });
  }

  const filterInputClassName = (isActive: boolean, extraClassName = "") =>
    [
      "h-11 rounded-full border px-4 text-sm font-medium outline-none transition",
      isActive
        ? "border-primary/30 bg-primary/10 text-primary placeholder:text-primary/70"
        : "border-slate-300 bg-white text-ink placeholder:text-muted",
      extraClassName,
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">
          {mode === "signups" ? "Signups" : "Candidates"}
        </h2>
        {mode === "signups" ? (
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
            Everyone who has signed up for a job — including those yet to apply. Use the status filter to separate viewed-only from fully applied.
          </p>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900">
            {viewedCount} {mode === "signups" ? "not applied" : "viewed"}
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
            {appliedCount} applied
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-muted">
            {sorted.length} total entries
          </span>
          <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            {filteredApplications.length} shown
          </span>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      {sorted.length === 0 ? (
        <EmptyWorkspaceState
          title={mode === "signups" ? "No signups yet" : "No candidates yet"}
          body={mode === "signups"
            ? "Signups will appear here as soon as candidates interact with any of your job posts."
            : "Candidates will appear here as soon as they apply to one of your job posts."}
        />
      ) : (
        <section className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-white shadow-panel">
          <div className="border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="mb-2.5 sm:hidden">
              <input
                value={candidateSearchQuery}
                onChange={(event) => setCandidateSearchQuery(event.target.value)}
                className={filterInputClassName(Boolean(candidateSearchQuery), "w-full")}
                placeholder="Search candidates"
              />
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => scrollCandidateFilters("left")}
                aria-label="Scroll filters left"
                className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M12.5 5 7.5 10l5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <div
                ref={candidateFiltersScrollRef}
                className="overflow-x-auto py-1 sm:px-14 [&::-webkit-scrollbar]:hidden"
                style={{ scrollbarWidth: "none" }}
              >
                <div className="flex min-w-max items-center gap-2.5">
                  <input
                    value={candidateSearchQuery}
                    onChange={(event) => setCandidateSearchQuery(event.target.value)}
                    className={filterInputClassName(Boolean(candidateSearchQuery), "hidden w-[220px] sm:block")}
                    placeholder="Search candidates"
                  />
                  <select
                    value={candidateStatusFilter}
                    onChange={(event) => setCandidateStatusFilter(event.target.value)}
                    className={filterInputClassName(candidateStatusFilter !== "all", "min-w-[120px]")}
                  >
                    <option value="all">Status</option>
                    {globalWorkforceApplicationStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {globalWorkforceApplicationStatusLabels[status]}
                      </option>
                    ))}
                  </select>
                  <select
                    value={candidateCountryFilter}
                    onChange={(event) => setCandidateCountryFilter(event.target.value)}
                    className={filterInputClassName(candidateCountryFilter !== "all", "min-w-[130px]")}
                  >
                    <option value="all">Country</option>
                    {candidateCountryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                  <select
                    value={candidateJobFilter}
                    onChange={(event) => setCandidateJobFilter(event.target.value)}
                    className={filterInputClassName(candidateJobFilter !== "all", "min-w-[220px]")}
                  >
                    <option value="all">Job post</option>
                    {candidateJobOptions.map(([jobId, label]) => (
                      <option key={jobId} value={jobId}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={candidateUserFilter}
                    onChange={(event) => setCandidateUserFilter(event.target.value)}
                    className={filterInputClassName(candidateUserFilter !== "all", "min-w-[220px]")}
                  >
                    <option value="all">User</option>
                    {candidateUserOptions.map(([uid, label]) => (
                      <option key={uid} value={uid}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={candidateDateFromFilter}
                    onChange={(event) => setCandidateDateFromFilter(event.target.value)}
                    className={filterInputClassName(Boolean(candidateDateFromFilter), "w-[150px]")}
                    aria-label="Submitted from date"
                  />
                  <input
                    type="date"
                    value={candidateDateToFilter}
                    onChange={(event) => setCandidateDateToFilter(event.target.value)}
                    className={filterInputClassName(Boolean(candidateDateToFilter), "w-[150px]")}
                    aria-label="Submitted to date"
                  />
                  <select
                    value={candidateSortMode}
                    onChange={(event) => setCandidateSortMode(event.target.value as "latest" | "status")}
                    className={filterInputClassName(candidateSortMode !== "latest", "min-w-[130px]")}
                  >
                    <option value="latest">Latest first</option>
                    <option value="status">Status</option>
                  </select>
                  <select
                    value={candidateJobStatusFilter}
                    onChange={(event) => setCandidateJobStatusFilter(event.target.value)}
                    className={filterInputClassName(candidateJobStatusFilter !== "all", "min-w-[130px]")}
                  >
                    <option value="all">Job status</option>
                    {globalWorkforceStatusOptions.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <select
                    value={candidateWorkplaceFilter}
                    onChange={(event) => setCandidateWorkplaceFilter(event.target.value)}
                    className={filterInputClassName(candidateWorkplaceFilter !== "all", "min-w-[130px]")}
                  >
                    <option value="all">Remote</option>
                    {globalWorkforceWorkplaceOptions.map((workplace) => (
                      <option key={workplace} value={workplace}>
                        {workplace}
                      </option>
                    ))}
                  </select>
                  <select
                    value={candidateSeniorityFilter}
                    onChange={(event) => setCandidateSeniorityFilter(event.target.value)}
                    className={filterInputClassName(candidateSeniorityFilter !== "all", "min-w-[180px]")}
                  >
                    <option value="all">Seniority</option>
                    {globalWorkforceSeniorityOptions.map((seniority) => (
                      <option key={seniority} value={seniority}>
                        {seniority}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={clearCandidateFilters}
                    className="inline-flex h-11 items-center justify-center rounded-full border border-slate-300 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                  >
                    Clear
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => scrollCandidateFilters("right")}
                aria-label="Scroll filters right"
                className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white text-ink shadow-sm transition hover:border-primary/30 hover:bg-panelStrong sm:inline-flex"
              >
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden="true">
                  <path d="M7.5 5 12.5 10l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">
            <span>ID · Candidate</span>
            <span className="hidden sm:block">Job ID · Status</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredApplications.length === 0 ? (
              <div className="px-4 py-5 text-sm leading-7 text-muted">
                No candidates match your current filters. Clear a few filters and try again.
              </div>
            ) : null}
            {filteredApplications.map((application) => {
              const displayId =
                application.candidateDisplayId ||
                generateCandidateDisplayId(application.uid);
              const detailKey = `${application.jobDocumentId || application.jobId}-${application.uid}`;

              return (
                <article
                  key={detailKey}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (mode === "candidates") {
                      setDrawerApplication(application);
                    } else {
                      onOpenApplication(application);
                    }
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      if (mode === "candidates") {
                        setDrawerApplication(application);
                      } else {
                        onOpenApplication(application);
                      }
                    }
                  }}
                  className="group flex cursor-pointer items-center gap-3 px-4 py-3 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary/30"
                >
                  <span className="shrink-0 font-mono text-[11px] font-bold text-primarySoft">
                    #{displayId}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold text-ink">
                    {application.applicantName || "Candidate"}
                  </span>
                  <span className="hidden shrink-0 max-w-[180px] truncate text-xs text-muted sm:block">
                    {application.applicantEmail}
                  </span>
                  <span className="hidden shrink-0 font-mono text-[11px] text-muted sm:block">
                    {application.jobHumanId}
                  </span>
                  <ApplicationStatusBadge status={application.status} />
                  <svg className="h-3.5 w-3.5 shrink-0 text-slate-300 transition group-hover:text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </article>
              );
            })}
          </div>
        </section>
      )}
      {drawerApplication ? (
        <CandidateApplicationDrawer
          application={drawerApplication}
          onClose={() => setDrawerApplication(null)}
          verifyingApplicationKey={verifyingApplicationKey}
          onVerifyApplication={onVerifyApplication}
          onUpdateStatus={onUpdateStatus}
          onDeleteApplication={onDeleteApplication}
          canManageStatuses={canManageStatuses}
          canMarkMessageSent={canMarkMessageSent}
        />
      ) : null}
    </div>
  );
}

function GlobalWorkforceInterviewsSection({
  applications,
}: {
  applications: GlobalWorkforceApplicationRecord[];
}) {
  const interviewQueue = applications.slice(0, 8);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Interviews</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          This view can become your interview pipeline. For now it highlights candidates
          who are ready for scheduling and review.
        </p>
      </section>

      {interviewQueue.length === 0 ? (
        <EmptyWorkspaceState
          title="No interview pipeline yet"
          body="As applications come in, this space can be used to schedule and track interview rounds."
        />
      ) : (
        <section className="space-y-3">
          {interviewQueue.map((application, index) => (
            <article
              key={`${application.jobId}-${application.uid}`}
              className="rounded-[1.15rem] border border-slate-200 bg-white px-5 py-4 shadow-panel"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-lg font-semibold text-ink">
                    {application.applicantName || "Candidate"}
                  </p>
                  <p className="mt-1 text-sm text-muted">{application.jobTitle}</p>
                  <p className="mt-1 text-sm text-muted">{application.applicantEmail}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-900">
                    {index % 2 === 0 ? "Needs scheduling" : "Ready for review"}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-panelStrong px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">
                    {application.jobWorkplace}
                  </span>
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function GlobalWorkforceDataSection({
  jobs,
  applications,
}: {
  jobs: GlobalWorkforceJobPost[];
  applications: GlobalWorkforceApplicationRecord[];
}) {
  const topCountries = Array.from(
    jobs.reduce((map, job) => {
      map.set(job.country, (map.get(job.country) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .filter(([country]) => Boolean(country))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const topLanguages = Array.from(
    jobs.reduce((map, job) => {
      job.languages.forEach((language) => {
        map.set(language, (map.get(language) ?? 0) + 1);
      });
      return map;
    }, new Map<string, number>()),
  )
    .filter(([language]) => Boolean(language))
    .sort((left, right) => right[1] - left[1])
    .slice(0, 6);

  const topKeywords = Array.from(
    jobs.reduce((map, job) => {
      job.keywords.forEach((keyword) => {
        map.set(keyword, (map.get(keyword) ?? 0) + 1);
      });
      return map;
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 10);

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Data</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          A quick view into the role mix, regional spread, and candidate demand across
          Global Managed Workforce.
        </p>
      </section>

      <section className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0" style={{ scrollbarWidth: "none" }}>
        <WorkspaceMetricCard
          className="w-40 shrink-0 md:w-auto"
          label="Jobs tracked"
          value={String(jobs.length).padStart(2, "0")}
          hint="Total workforce job posts in this workspace."
        />
        <WorkspaceMetricCard
          className="w-40 shrink-0 md:w-auto"
          label="Applications tracked"
          value={String(applications.length).padStart(2, "0")}
          hint="All mirrored candidate applications across job posts."
        />
        <WorkspaceMetricCard
          className="w-40 shrink-0 md:w-auto"
          label="Keywords in use"
          value={String(topKeywords.length).padStart(2, "0")}
          hint="Most common role signals pulled from active posts."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Top countries
          </p>
          <div className="mt-4 space-y-3">
            {topCountries.length === 0 ? (
              <p className="text-sm text-muted">No countries yet.</p>
            ) : (
              topCountries.map(([country, count]) => (
                <div key={country} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{country}</span>
                  <span className="text-muted">{count}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Top languages
          </p>
          <div className="mt-4 space-y-3">
            {topLanguages.length === 0 ? (
              <p className="text-sm text-muted">No languages yet.</p>
            ) : (
              topLanguages.map(([language, count]) => (
                <div key={language} className="flex items-center justify-between text-sm">
                  <span className="font-medium text-ink">{language}</span>
                  <span className="text-muted">{count}</span>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Top keywords
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {topKeywords.length === 0 ? (
              <p className="text-sm text-muted">No keywords yet.</p>
            ) : (
              topKeywords.map(([keyword, count]) => (
                <span
                  key={keyword}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900"
                >
                  {keyword} · {count}
                </span>
              ))
            )}
          </div>
        </article>
      </section>
    </div>
  );
}

function GlobalWorkforceCommissionsSection({
  applications,
  canManageCommissions,
  canApproveCommissions,
  onApproveCommission,
  onDeleteCommission,
  activeCommissionKey,
  errorMessage,
  successMessage,
  approvedAdmins,
}: {
  applications: GlobalWorkforceApplicationRecord[];
  canManageCommissions: boolean;
  canApproveCommissions: boolean;
  onApproveCommission: (application: GlobalWorkforceApplicationRecord, amount: number) => Promise<void>;
  onDeleteCommission?: (application: GlobalWorkforceApplicationRecord) => Promise<void>;
  activeCommissionKey: string | null;
  errorMessage?: string | null;
  successMessage?: string | null;
  approvedAdmins?: AdminApprovalRecord[];
}) {
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, string>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [approvingKey, setApprovingKey] = useState<string | null>(null);

  const visibleApplications = useMemo(
    () =>
      applications
        .filter((a) =>
          canManageCommissions || canApproveCommissions
            ? a.status === "ready-for-projects"
            : a.commissionApproved === true,
        )
        .sort((l, r) => getTimestampMs(r.updatedAt) - getTimestampMs(l.updatedAt)),
    [applications, canManageCommissions, canApproveCommissions],
  );

  const pendingApplications = visibleApplications.filter((a) => !a.commissionApproved);
  const approvedApplications = visibleApplications.filter((a) => a.commissionApproved);
  const approvedTotal = approvedApplications.reduce(
    (total, a) => total + Math.max(0, a.commissionAmount ?? 0),
    0,
  );

  function getDraft(rowKey: string, current: number | undefined) {
    return commissionDrafts[rowKey] ?? String(current || "");
  }

  function setDraft(rowKey: string, value: string) {
    setCommissionDrafts((prev) => ({ ...prev, [rowKey]: value }));
  }

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Commissions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-muted">
            {visibleApplications.length} candidates
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
            ${approvedTotal} approved
          </span>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-7 text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      {successMessage ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm leading-7 text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      {visibleApplications.length === 0 ? (
        <EmptyWorkspaceState
          title={canManageCommissions ? "No candidates ready for projects" : "No approved commissions yet"}
          body={
            canManageCommissions
              ? "Candidates appear here after super marks them as Ready for Projects."
              : "Approved candidate commissions will appear here once super sets the dollar amount."
          }
        />
      ) : canManageCommissions ? (
        /* ── Super admin view ──────────────────────────────────────────────── */
        <div className="space-y-5">
          {pendingApplications.length > 0 ? (
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Pending approval · {pendingApplications.length}
              </p>
              {pendingApplications.map((application) => {
                const rowKey = `${application.jobId}-${application.uid}`;
                const draft = getDraft(rowKey, application.commissionAmount);
                const isBusy = activeCommissionKey === rowKey;
                return (
                  <article key={rowKey} className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-panel">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                        <p className="text-xs text-muted">{application.applicantEmail}</p>
                        <p className="text-xs text-muted">{[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}</p>
                        {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0 ? (
                          <p className="text-xs text-primary/70">
                            {application.jobAssignedAdminEmails
                              .map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          step={1}
                          value={draft}
                          onChange={(e) => setDraft(rowKey, e.target.value)}
                          className="h-9 w-28 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
                          placeholder="$"
                        />
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => void onApproveCommission(application, Number(draft))}
                          className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
                        >
                          {isBusy ? "..." : "Approve"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          {approvedApplications.length > 0 ? (
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Approved · {approvedApplications.length}
              </p>
              {approvedApplications.map((application) => {
                const rowKey = `${application.jobId}-${application.uid}`;
                const isEditing = editingKey === rowKey;
                const draft = getDraft(rowKey, application.commissionAmount);
                const isBusy = activeCommissionKey === rowKey;
                return (
                  <article key={rowKey} className="group rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-panel">
                    {isEditing ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                          <p className="text-xs text-muted">{application.applicantEmail}</p>
                          <p className="text-xs text-muted">{[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}</p>
                          {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0 ? (
                            <p className="text-xs text-primary/70">
                              {application.jobAssignedAdminEmails
                                .map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={draft}
                            onChange={(e) => setDraft(rowKey, e.target.value)}
                            className="h-9 w-28 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
                            placeholder="$"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void onApproveCommission(application, Number(draft)).then(() => setEditingKey(null))}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
                          >
                            {isBusy ? "..." : "Update"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingKey(null)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                          <p className="text-xs text-muted">
                            {application.applicantEmail} · {[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}
                            {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0
                              ? ` · ${application.jobAssignedAdminEmails.map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e).join(", ")}`
                              : null}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-semibold text-ink">${application.commissionAmount ?? 0}</span>
                          <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                            <button
                              type="button"
                              onClick={() => setEditingKey(rowKey)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void onDeleteCommission?.(application)}
                              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ) : null}
        </div>
      ) : (
        /* ── Admin view ────────────────────────────────────────────────────── */
        <div className="space-y-5">
          {pendingApplications.length > 0 ? (
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Pending approval · {pendingApplications.length}
              </p>
              {pendingApplications.map((application) => {
                const rowKey = `${application.jobId}-${application.uid}`;
                const isOpen = approvingKey === rowKey;
                const draft = getDraft(rowKey, application.commissionAmount);
                const isBusy = activeCommissionKey === rowKey;
                return (
                  <article key={rowKey} className="group rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-panel">
                    {isOpen ? (
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                          <p className="text-xs text-muted">{application.applicantEmail}</p>
                          <p className="text-xs text-muted">{[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}</p>
                          {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0 ? (
                            <p className="text-xs text-primary/70">
                              {application.jobAssignedAdminEmails
                                .map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e)
                                .join(", ")}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={draft}
                            onChange={(e) => setDraft(rowKey, e.target.value)}
                            className="h-9 w-28 rounded-full border border-slate-300 bg-white px-3 text-sm font-semibold text-ink outline-none transition focus:border-primary"
                            placeholder="$"
                            autoFocus
                          />
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void onApproveCommission(application, Number(draft)).then(() => setApprovingKey(null))}
                            className="inline-flex h-9 items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-60"
                          >
                            {isBusy ? "..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setApprovingKey(null)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-400 transition hover:bg-slate-100"
                          >
                            ×
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                          <p className="text-xs text-muted">
                            {application.applicantEmail} · {[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}
                            {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0
                              ? ` · ${application.jobAssignedAdminEmails.map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e).join(", ")}`
                              : null}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setApprovingKey(rowKey)}
                          className="inline-flex h-8 shrink-0 items-center rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-600 opacity-0 transition hover:bg-slate-50 group-hover:opacity-100"
                        >
                          Approve
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </section>
          ) : null}

          {approvedApplications.length > 0 ? (
            <section className="space-y-2">
              <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                Approved · {approvedApplications.length}
              </p>
              {approvedApplications.map((application) => {
                const rowKey = `${application.jobId}-${application.uid}`;
                return (
                  <article key={rowKey} className="rounded-[1rem] border border-slate-200 bg-white px-4 py-3 shadow-panel">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink">{application.applicantName || "Candidate"}</p>
                        <p className="text-xs text-muted">
                          {application.applicantEmail} · {[application.jobHumanId, application.jobTitle].filter(Boolean).join(" · ")}
                          {application.jobAssignedAdminEmails?.length > 0 && approvedAdmins && approvedAdmins.length > 0
                            ? ` · ${application.jobAssignedAdminEmails.map((e) => approvedAdmins.find((a) => a.email === e)?.contactName || e).join(", ")}`
                            : null}
                        </p>
                      </div>
                      <span className="shrink-0 text-sm font-semibold text-ink">${application.commissionAmount ?? 0}</span>
                    </div>
                  </article>
                );
              })}
            </section>
          ) : null}

          {approvedApplications.length === 0 ? (
            <EmptyWorkspaceState
              title="No approved commissions yet"
              body="Approved candidate commissions will appear here once set by the business."
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function GlobalWorkforcePoliciesSection() {
  const service = servicePages.find(
    (item) => item.slug === "global-managed-workforce",
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
          Global workforce
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-ink">Policies</h2>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted">
          Keep the operating standards for Global Managed Workforce visible to every admin.
        </p>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Operating principles
          </p>
          <div className="mt-4 space-y-3">
            {(service?.features ?? []).map((feature) => (
              <div
                key={feature}
                className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm leading-7 text-ink"
              >
                {feature}
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
            Admin reminders
          </p>
          <div className="mt-4 space-y-3">
            {[
              "Only publish roles with clear ownership, pay range, and country coverage.",
              "Keep candidate handling compliant with privacy and resume retention expectations.",
              "Use the workforce pipeline views to coordinate interviews and hiring decisions.",
              "Review keywords, seniority, and workplace settings before each post goes live.",
            ].map((item) => (
              <div
                key={item}
                className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm leading-7 text-ink"
              >
                {item}
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function GlobalWorkforceJobEditor({
  activeUser,
  editingJobId,
  routeBase,
  existingJobs,
}: {
  activeUser: User;
  editingJobId: string | null;
  routeBase: string;
  existingJobs: GlobalWorkforceJobPost[];
}) {
  const router = useRouter();
  const [jobDraft, setJobDraft] = useState<GlobalWorkforceJobDraft>(
    emptyGlobalWorkforceJobDraft,
  );
  const [partners, setPartners] = useState<GlobalWorkforcePartner[]>([]);
  const [approvedAdmins, setApprovedAdmins] = useState<AdminApprovalRecord[]>([]);
  const [keywordInput, setKeywordInput] = useState("");
  const [languageSelect, setLanguageSelect] = useState("");
  const [countrySelect, setCountrySelect] = useState("");
  const [isLoadingJob, setIsLoadingJob] = useState(Boolean(editingJobId));
  const [isSavingJob, setIsSavingJob] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    return subscribeToGlobalWorkforcePartners((records) => setPartners(records));
  }, []);

  useEffect(() => {
    return subscribeToAdminApprovals((records) => setApprovedAdmins(records));
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadJob() {
      if (!editingJobId) {
        setJobDraft(emptyGlobalWorkforceJobDraft);
        setIsLoadingJob(false);
        return;
      }

      setIsLoadingJob(true);
      setErrorMessage(null);

      try {
        const job = await getGlobalWorkforceJobPost(editingJobId);

        if (!job) {
          if (!cancelled) {
            setErrorMessage("This job could not be found.");
            setIsLoadingJob(false);
          }
          return;
        }

        if (!cancelled) {
          setJobDraft({
            title: job.title,
            jobType: job.jobType,
            workplace: job.workplace,
            languages: job.languages,
            description: job.description,
            instructions: job.instructions,
            keywords: job.keywords,
            status: job.status,
            countries: job.countries.length > 0 ? job.countries : job.country ? [job.country] : [],
            country: job.country,
            openings: job.openings,
            seniority: job.seniority,
            payMin: job.payMin,
            payMax: job.payMax,
            payRatePeriod: job.payRatePeriod,
            pipeline: job.pipeline,
            referenceId: job.referenceId,
            referenceLink: job.referenceLink,
            assignedAdminEmails: job.assignedAdminEmails,
          });
          setIsLoadingJob(false);
        }
      } catch (error) {
        if (!cancelled) {
          setErrorMessage(
            error instanceof Error ? error.message : "We could not load this job.",
          );
          setIsLoadingJob(false);
        }
      }
    }

    void loadJob();

    return () => {
      cancelled = true;
    };
  }, [editingJobId]);

  function handleDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setJobDraft((current) => ({
      ...current,
      [name]:
        name === "openings" || name === "payMin" || name === "payMax"
          ? Math.max(0, Number(value) || 0)
          : value,
    }));
  }

  function setCounterValue(
    field: "openings" | "payMin" | "payMax",
    nextValue: number,
  ) {
    setJobDraft((current) => {
      if (field === "payMin") {
        const payMin = Math.max(0, nextValue);
        return {
          ...current,
          payMin,
          payMax: Math.max(payMin, current.payMax),
        };
      }

      if (field === "payMax") {
        return {
          ...current,
          payMax: Math.max(current.payMin, nextValue),
        };
      }

      return {
        ...current,
        openings: Math.max(1, nextValue),
      };
    });
  }

  function addKeyword() {
    const normalizedKeyword = keywordInput.trim();

    if (!normalizedKeyword) {
      return;
    }

    setJobDraft((current) => ({
      ...current,
      keywords: Array.from(new Set([...current.keywords, normalizedKeyword])),
    }));
    setKeywordInput("");
  }

  function handleKeywordKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    addKeyword();
  }

  function removeKeyword(keywordToRemove: string) {
    setJobDraft((current) => ({
      ...current,
      keywords: current.keywords.filter((keyword) => keyword !== keywordToRemove),
    }));
  }

  function addLanguage() {
    if (!languageSelect) return;
    setJobDraft((current) => ({
      ...current,
      languages: Array.from(new Set([...current.languages, languageSelect])),
    }));
    setLanguageSelect("");
  }

  function removeLanguage(lang: string) {
    setJobDraft((current) => ({
      ...current,
      languages: current.languages.filter((l) => l !== lang),
    }));
  }

  function addCountry() {
    if (!countrySelect) return;
    setJobDraft((current) => ({
      ...current,
      countries: Array.from(new Set([...current.countries, countrySelect])),
    }));
    setCountrySelect("");
  }

  function removeCountry(c: string) {
    setJobDraft((current) => ({
      ...current,
      countries: current.countries.filter((x) => x !== c),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!jobDraft.title.trim()) {
      setErrorMessage("Add a role title first.");
      return;
    }

    if (!getDescriptionText(jobDraft.description)) {
      setErrorMessage("Add a job description.");
      return;
    }

    if (jobDraft.languages.length === 0) {
      setErrorMessage("Add at least one language for this post.");
      return;
    }

    if (jobDraft.countries.length === 0) {
      setErrorMessage("Select at least one country.");
      return;
    }

    if (jobDraft.keywords.length === 0) {
      setErrorMessage("Add at least one keyword.");
      return;
    }

    if (jobDraft.pipeline === "External" && !jobDraft.referenceId.trim()) {
      setErrorMessage("Select the partner company for this external job.");
      return;
    }

    if (jobDraft.pipeline === "External" && !jobDraft.referenceLink.trim()) {
      setErrorMessage("Add the External Job ID for this partner job.");
      return;
    }

    if (jobDraft.referenceLink.trim()) {
      const externalId = jobDraft.referenceLink.trim();
      const draftCountries = new Set(jobDraft.countries);
      const conflictingJob = existingJobs.find((j) => {
        if (j.id === editingJobId) return false;
        if (j.referenceLink.trim() !== externalId) return false;
        return j.countries.some((c) => draftCountries.has(c));
      });
      if (conflictingJob) {
        const overlap = conflictingJob.countries.filter((c) => draftCountries.has(c));
        setErrorMessage(
          `A job with the same External Job ID already exists for ${overlap.join(", ")} (Job ID: ${conflictingJob.jobId}). Use a different External Job ID or remove the conflicting country.`,
        );
        return;
      }
    }

    setIsSavingJob(true);
    setErrorMessage(null);

      try {
        const cleanedDraft = {
          ...jobDraft,
          description: mergeHtmlContinuationParagraphs(jobDraft.description),
        };
        await saveGlobalWorkforceJobPost(activeUser, cleanedDraft, editingJobId);
        router.replace(buildGlobalWorkforceRoute(routeBase, "job-posts"));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not save this job right now.",
      );
    } finally {
      setIsSavingJob(false);
    }
  }

  return (
    <div className="space-y-4">
      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      {isLoadingJob ? (
        <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
          <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
          <span>Loading job...</span>
        </div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-panel"
        >
          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Job ID</span>
              <input
                value={editingJobId || "Automatically assigned when saved"}
                disabled
                className="w-full rounded-[1rem] border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-muted outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Role title</span>
              <input
                name="title"
                value={jobDraft.title}
                onChange={handleDraftChange}
                required
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                placeholder="Global Workforce Operations Analyst"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Job type</span>
              <select
                name="jobType"
                value={jobDraft.jobType}
                onChange={handleDraftChange}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                {globalWorkforceJobTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Workplace</span>
              <select
                name="workplace"
                value={jobDraft.workplace}
                onChange={handleDraftChange}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                {globalWorkforceWorkplaceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Status</span>
              <select
                name="status"
                value={jobDraft.status}
                onChange={handleDraftChange}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                {globalWorkforceStatusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Pipeline</span>
              <select
                name="pipeline"
                value={jobDraft.pipeline}
                onChange={handleDraftChange}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                {globalWorkforcePipelineOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>

            {jobDraft.pipeline === "External" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Partner company</span>
                  <select
                    value={jobDraft.referenceId}
                    onChange={(event) => {
                      const selectedPartner = partners.find(
                        (partner) => partner.referenceId === event.target.value,
                      );
                      setJobDraft((current) => ({
                        ...current,
                        referenceId: event.target.value,
                        ...(selectedPartner ? {} : {}),
                      }));
                    }}
                    className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                  >
                    <option value="">Select a partner company</option>
                    {partners.map((partner) => (
                      <option key={partner.id} value={partner.referenceId}>
                        {partner.name}
                      </option>
                    ))}
                  </select>
                  {partners.length === 0 ? (
                    <span className="mt-1.5 block text-xs text-amber-700">
                      No partner companies added yet. Add them in Super → Partner companies.
                    </span>
                  ) : null}
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">External Job ID</span>
                  <input
                    name="referenceLink"
                    value={jobDraft.referenceLink}
                    onChange={handleDraftChange}
                    className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                    placeholder="Partner job ID to insert into the company Reference Link"
                  />
                </label>
              </>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <span className="block text-sm font-medium text-ink">Languages</span>
              <div className="flex gap-2">
                <select
                  value={languageSelect}
                  onChange={(event) => setLanguageSelect(event.target.value)}
                  className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                >
                  <option value="">Select a language</option>
                  {worldLanguageOptions.map((lang) => (
                    <option key={lang} value={lang}>
                      {lang}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addLanguage}
                  className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                >
                  Add
                </button>
              </div>
              {jobDraft.languages.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {jobDraft.languages.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => removeLanguage(lang)}
                      className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                    >
                      {lang} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No languages added yet.</p>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-sm font-medium text-ink">Countries</span>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_80px] sm:items-center">
                <select
                  value={countrySelect}
                  onChange={(e) => setCountrySelect(e.target.value)}
                  className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                >
                  <option value="">Select a country</option>
                  <option value="Worldwide">Worldwide (all countries)</option>
                  {countryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addCountry}
                  className="shrink-0 inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                >
                  Add
                </button>
              </div>
              {jobDraft.countries.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {jobDraft.countries.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => removeCountry(c)}
                      className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/20"
                    >
                      {c} ×
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted">No countries added yet.</p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Keywords</span>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_132px] sm:items-center">
                <input
                  value={keywordInput}
                  onChange={(event) => setKeywordInput(event.target.value)}
                  onKeyDown={handleKeywordKeyDown}
                  className="h-12 w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  placeholder="Add a keyword and press Enter"
                />
                <button
                  type="button"
                  onClick={addKeyword}
                  className="inline-flex h-12 items-center justify-center rounded-[0.9rem] border border-slate-300 bg-white px-4 text-sm font-semibold text-ink transition hover:bg-panelStrong"
                >
                  Add
                </button>
              </div>
            </label>

            {jobDraft.keywords.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {jobDraft.keywords.map((keyword) => (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => removeKeyword(keyword)}
                    className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                  >
                    {keyword} ×
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted">
                Add keywords like transcription, Arabic, evaluation, QA, or remote.
              </p>
            )}
          </div>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">Job description</span>
            <RichTextEditor
              value={jobDraft.description}
              onChange={(nextDescription) =>
                setJobDraft((current) => ({
                  ...current,
                  description: nextDescription,
                }))
              }
              placeholder="Describe the role, the work, and what a strong candidate will handle."
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-ink">
              Application instructions
            </span>
            <RichTextEditor
              value={jobDraft.instructions}
              onChange={(nextInstructions) =>
                setJobDraft((current) => ({
                  ...current,
                  instructions: nextInstructions,
                }))
              }
              placeholder="Steps the candidate should follow to apply — shown to them before they proceed."
            />
          </label>

          <div className="rounded-[1.1rem] border border-slate-200 bg-slate-50 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <CounterField
                label="Min pay"
                value={jobDraft.payMin}
                min={0}
                onChange={(nextValue) => setCounterValue("payMin", nextValue)}
              />
              <CounterField
                label="Max pay"
                value={jobDraft.payMax}
                min={jobDraft.payMin}
                onChange={(nextValue) => setCounterValue("payMax", nextValue)}
              />
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Pay rate</span>
                <select
                  name="payRatePeriod"
                  value={jobDraft.payRatePeriod}
                  onChange={handleDraftChange}
                  className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                >
                  {globalWorkforcePayRateOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="mt-4 rounded-[0.9rem] border border-slate-200 bg-white px-3 py-2 text-sm leading-6 text-muted">
              Preview:{" "}
              <span className="font-semibold text-ink">
                {formatGlobalWorkforceCompensation(
                  jobDraft.payMin,
                  Math.max(jobDraft.payMin, jobDraft.payMax),
                  jobDraft.payRatePeriod,
                )}
              </span>
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <CounterField
              label="Openings"
              value={Math.max(1, jobDraft.openings)}
              min={1}
              onChange={(nextValue) => setCounterValue("openings", nextValue)}
            />

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Seniority</span>
              <select
                name="seniority"
                value={jobDraft.seniority}
                onChange={handleDraftChange}
                className="w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
              >
                {globalWorkforceSeniorityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {approvedAdmins.length > 0 ? (
            <div>
              <p className="mb-2 block text-sm font-medium text-ink">Assign to admins</p>
              <div className="flex flex-wrap gap-2">
                {approvedAdmins.map((admin) => {
                  const isAssigned = jobDraft.assignedAdminEmails.includes(admin.email);
                  return (
                    <button
                      key={admin.email}
                      type="button"
                      onClick={() =>
                        setJobDraft((prev) => ({
                          ...prev,
                          assignedAdminEmails: isAssigned
                            ? prev.assignedAdminEmails.filter((e) => e !== admin.email)
                            : [...prev.assignedAdminEmails, admin.email],
                        }))
                      }
                      className={[
                        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold transition",
                        isAssigned
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border text-[8px]",
                          isAssigned
                            ? "border-primary bg-primary text-white"
                            : "border-slate-300",
                        ].join(" ")}
                      >
                        {isAssigned ? "✓" : ""}
                      </span>
                      {admin.contactName || admin.email}
                    </button>
                  );
                })}
              </div>
              {jobDraft.assignedAdminEmails.length === 0 ? (
                <p className="mt-2 text-xs text-slate-400">No admins assigned — this job will not appear in any admin&apos;s panel.</p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() =>
                router.replace(buildGlobalWorkforceRoute(routeBase, "job-posts"))
              }
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSavingJob}
              className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingJob ? <LoadingSpinner /> : null}
              {isSavingJob ? "Saving job..." : editingJobId ? "Update job" : "Save job"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function GlobalWorkforceAdminPanel({
  activeUser,
  activeSection,
  routeBase = "/admin?service=global-managed-workforce",
  canManageJobs = true,
  canApproveCommissions = false,
  isSuperAdmin = false,
}: {
  activeUser: User;
  activeSection: GlobalWorkforceAdminSection;
  routeBase?: string;
  canManageJobs?: boolean;
  canApproveCommissions?: boolean;
  isSuperAdmin?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [jobs, setJobs] = useState<GlobalWorkforceJobPost[]>([]);
  const [partners, setPartners] = useState<GlobalWorkforcePartner[]>([]);
  const [applicationsByJobId, setApplicationsByJobId] = useState<
    Record<string, GlobalWorkforceJobApplication[]>
  >({});
  const [isLoadingJobs, setIsLoadingJobs] = useState(false);
  const [isLoadingApplications, setIsLoadingApplications] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isDeletingJob, setIsDeletingJob] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [applicationsError, setApplicationsError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [verifyingApplicationKey, setVerifyingApplicationKey] = useState<string | null>(null);
  const [activeCommissionKey, setActiveCommissionKey] = useState<string | null>(null);
  const [approvedAdmins, setApprovedAdmins] = useState<AdminApprovalRecord[]>([]);
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState("all");
  const [jobCountryFilter, setJobCountryFilter] = useState("all");
  const [jobTypeFilter, setJobTypeFilter] = useState("all");
  const [jobPayRangeFilter, setJobPayRangeFilter] = useState("all");
  const [jobSeniorityFilter, setJobSeniorityFilter] = useState("all");
  const [jobWorkplaceFilter, setJobWorkplaceFilter] = useState("all");

  useEffect(() => {
    return subscribeToGlobalWorkforcePartners((records) => setPartners(records));
  }, []);

  useEffect(() => {
    if (!canManageJobs) return;
    return subscribeToAdminApprovals((records) => setApprovedAdmins(records));
  }, [canManageJobs]);

  useEffect(() => {
    setIsLoadingJobs(true);

    return subscribeToGlobalWorkforceJobPosts(
      (nextJobs) => {
        const adminEmail = activeUser.email ?? "";
        const filtered = canManageJobs
          ? nextJobs
          : nextJobs.filter((job) => job.assignedAdminEmails.includes(adminEmail));
        setJobs(filtered);
        setIsLoadingJobs(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsLoadingJobs(false);
      },
    );
  }, [canManageJobs, activeUser.email]);

  useEffect(() => {
    setApplicationsError(null);

    if (jobs.length === 0) {
      setApplicationsByJobId({});
      setIsLoadingApplications(false);
      return;
    }

    setApplicationsByJobId({});
    setIsLoadingApplications(true);

    const resolvedJobIds = new Set<string>();

    const unsubscribers = jobs.map((job) =>
      subscribeToGlobalWorkforceJobApplications(
        job.id,
        (applications) => {
          setApplicationsByJobId((current) => ({
            ...current,
            [job.id]: applications,
          }));

          resolvedJobIds.add(job.id);
          if (resolvedJobIds.size >= jobs.length) {
            setIsLoadingApplications(false);
          }
        },
        (error) => {
          setApplicationsError(error.message);
          setIsLoadingApplications(false);
        },
      ),
    );

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [jobs]);

  const editorJobIdParam = searchParams.get("jobEditor");
  const isEditingInDedicatedView = canManageJobs && activeSection === "job-posts" && Boolean(editorJobIdParam);
  const viewJobIdParam = searchParams.get("jobView");
  const isViewingInDedicatedView = activeSection === "job-posts" && Boolean(viewJobIdParam);
  const candidateJobIdParam = searchParams.get("candidateJob");
  const candidateUidParam = searchParams.get("candidateUid");
  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ??
    jobs.find((job) => job.jobId === selectedJobId) ??
    null;

  const applications = useMemo<GlobalWorkforceApplicationRecord[]>(
    () =>
      jobs.flatMap((job) =>
        (applicationsByJobId[job.id] ?? []).map((application) => ({
          ...application,
          jobDocumentId: job.id,
          jobHumanId: getGlobalWorkforceJobDisplayId(job),
          jobCountry: job.country,
          jobWorkplace: job.workplace,
          jobSeniority: job.seniority,
          jobStatus: job.status,
          jobPipeline: job.pipeline,
          jobReferenceLink: job.referenceLink,
          jobCompensation: job.compensation,
          jobType: job.jobType,
          jobOpenings: job.openings,
          jobAssignedAdminEmails: job.assignedAdminEmails,
        })),
      ),
    [applicationsByJobId, jobs],
  );
  const selectedCandidateApplication =
    candidateJobIdParam && candidateUidParam
      ? applications.find(
          (application) =>
            (application.jobDocumentId === candidateJobIdParam ||
              application.jobId === candidateJobIdParam) &&
            application.uid === candidateUidParam,
        ) ?? null
      : null;

  useEffect(() => {
    if (!selectedJobId) {
      return;
    }

    if (!jobs.some((job) => job.id === selectedJobId || job.jobId === selectedJobId)) {
      setSelectedJobId(null);
    }
  }, [jobs, selectedJobId]);

  function openEditor(jobId?: string) {
    if (!canManageJobs) {
      return;
    }

    const destination = jobId
      ? buildGlobalWorkforceRoute(routeBase, "job-posts", { jobEditor: jobId })
      : buildGlobalWorkforceRoute(routeBase, "job-posts", { jobEditor: "new" });

    router.push(destination);
  }

  function openJobView(job: GlobalWorkforceJobPost) {
    router.push(
      buildGlobalWorkforceRoute(routeBase, "job-posts", { jobView: job.id }),
    );
  }

  function openCandidateApplication(application: GlobalWorkforceApplicationRecord) {
    router.push(
      buildGlobalWorkforceRoute(routeBase, "candidates", {
        candidateJob: application.jobDocumentId || application.jobId,
        candidateUid: application.uid,
      }),
    );
  }

  function backToCandidates() {
    router.push(buildGlobalWorkforceRoute(routeBase, "candidates"));
  }

  async function handleAssignAdmins(jobId: string, emails: string[]) {
    if (!canManageJobs) return;
    try {
      await assignGlobalWorkforceJobAdmins(jobId, emails);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not update admin assignment.");
    }
  }

  async function handleDelete(job: GlobalWorkforceJobPost) {
    if (!canManageJobs) {
      return;
    }

    const shouldDelete = window.confirm(
      `Are you sure you want to delete Job ${job.jobId} (${job.title})? This will also remove its candidate applications from Firebase.`,
    );

    if (!shouldDelete) {
      return;
    }

    setSelectedJobId(job.id);
    setIsDeletingJob(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteGlobalWorkforceJobPost(job.id);
      setSelectedJobId(null);
      setSuccessMessage(`Job ${job.jobId} was deleted.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not delete this job.",
      );
    } finally {
      setIsDeletingJob(false);
    }
  }

  async function handleVerifyApplication(
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status" | "jobTitle">,
  ) {
    if (application.status !== "viewed") {
      return;
    }

    const key = `${application.jobId}-${application.uid}`;
    setVerifyingApplicationKey(key);
    setApplicationsError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateGlobalWorkforceJobApplicationStatus(
        application.jobId,
        application.uid,
        "applied",
      );
      setSuccessMessage(`${application.jobTitle || "Candidate"} marked as applied.`);
    } catch (error) {
      setApplicationsError(
        error instanceof Error
          ? error.message
          : "We could not mark this candidate as applied.",
      );
    } finally {
      setVerifyingApplicationKey(null);
    }
  }

  async function handleUpdateApplicationStatus(
    application: Pick<GlobalWorkforceJobApplication, "jobId" | "uid" | "status">,
    status: GlobalWorkforceApplicationStatus,
  ) {
    if (application.status === status) return;
    const isRestrictedMessageSent =
      !isSuperAdmin &&
      status === "message-sent" &&
      (application.status === "applied" || application.status === "viewed");
    if (!canManageJobs && !isRestrictedMessageSent) {
      return;
    }

    const key = `${application.jobId}-${application.uid}`;
    setVerifyingApplicationKey(key);
    setApplicationsError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await updateGlobalWorkforceJobApplicationStatus(
        application.jobId,
        application.uid,
        status,
      );
      setSuccessMessage(`Candidate status changed to ${globalWorkforceApplicationStatusLabels[status]}.`);
    } catch (error) {
      setApplicationsError(
        error instanceof Error
          ? error.message
          : "We could not update this candidate status.",
      );
    } finally {
      setVerifyingApplicationKey(null);
    }
  }

  async function handleDeleteApplication(application: GlobalWorkforceApplicationRecord) {
    if (!canManageJobs) return;
    try {
      await deleteGlobalWorkforceJobApplication(application.jobId, application.uid);
      setSuccessMessage(`${application.applicantName || "Candidate"} deleted.`);
    } catch (error) {
      setApplicationsError(error instanceof Error ? error.message : "Could not delete candidate.");
    }
  }

  async function handleDeleteCommission(application: GlobalWorkforceApplicationRecord) {
    if (!canManageJobs) return;
    if (!window.confirm(`Reset commission for ${application.applicantName || "this candidate"}?`)) return;
    const key = `${application.jobId}-${application.uid}`;
    setActiveCommissionKey(key);
    setApplicationsError(null);
    try {
      await resetGlobalWorkforceJobApplicationCommission(application.jobId, application.uid);
      setSuccessMessage(`Commission reset for ${application.applicantName || "candidate"}.`);
    } catch (error) {
      setApplicationsError(error instanceof Error ? error.message : "Could not reset commission.");
    } finally {
      setActiveCommissionKey(null);
    }
  }

  async function handleApproveCommission(
    application: GlobalWorkforceApplicationRecord,
    amount: number,
  ) {
    if (!canManageJobs && !canApproveCommissions) {
      return;
    }

    const roundedAmount = Math.max(0, Math.round(Number(amount) || 0));

    if (roundedAmount <= 0) {
      setApplicationsError("Enter a commission amount greater than 0.");
      return;
    }

    const key = `${application.jobId}-${application.uid}`;
    setActiveCommissionKey(key);
    setApplicationsError(null);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await approveGlobalWorkforceJobApplicationCommission(
        activeUser,
        application.jobId,
        application.uid,
        roundedAmount,
      );
      setSuccessMessage(`Commission approved for ${application.applicantName || "candidate"}.`);
    } catch (error) {
      setApplicationsError(
        error instanceof Error
          ? error.message
          : "We could not approve this commission.",
      );
    } finally {
      setActiveCommissionKey(null);
    }
  }

  const jobCountryOptions = useMemo(() =>
    Array.from(new Set(
      jobs.flatMap((j) => j.countries.length > 0 ? j.countries : j.country ? [j.country] : []).filter(Boolean)
    )).sort((a, b) => a.localeCompare(b)),
  [jobs]);

  const filteredJobs = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    const rangeEntry = jobPayRateRangeOptions.find((r) => r.value === jobPayRangeFilter);
    return jobs.filter((j) => {
      if (q && !j.title.toLowerCase().includes(q) && !j.jobId.toLowerCase().includes(q)) return false;
      if (jobStatusFilter !== "all" && j.status !== jobStatusFilter) return false;
      if (jobCountryFilter !== "all" && !j.countries.includes(jobCountryFilter) && j.country !== jobCountryFilter) return false;
      if (jobTypeFilter !== "all" && j.jobType !== jobTypeFilter) return false;
      if (rangeEntry) {
        if (j.payMax < rangeEntry.min) return false;
        if (rangeEntry.max !== null && j.payMin > rangeEntry.max) return false;
      }
      if (jobSeniorityFilter !== "all" && j.seniority !== jobSeniorityFilter) return false;
      if (jobWorkplaceFilter !== "all" && j.workplace !== jobWorkplaceFilter) return false;
      return true;
    });
  }, [jobs, jobSearch, jobStatusFilter, jobCountryFilter, jobTypeFilter, jobPayRangeFilter, jobSeniorityFilter, jobWorkplaceFilter]);

  if (isEditingInDedicatedView) {
    return (
      <GlobalWorkforceJobEditor
        activeUser={activeUser}
        editingJobId={editorJobIdParam === "new" ? null : editorJobIdParam}
        routeBase={routeBase}
        existingJobs={jobs}
      />
    );
  }

  if (isViewingInDedicatedView && viewJobIdParam) {
    return (
      <GlobalWorkforceJobViewPage
        jobId={viewJobIdParam}
        partners={partners}
        routeBase={routeBase}
        canManageJobs={canManageJobs}
      />
    );
  }

  if (activeSection === "dashboard") {
    return (
      <GlobalWorkforceDashboardSection jobs={jobs} applications={applications} />
    );
  }

  if (activeSection === "candidates") {
    if (isLoadingJobs || isLoadingApplications) {
      return (
        <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
          <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
          <span>Loading candidates...</span>
        </div>
      );
    }

    return (
      selectedCandidateApplication ? (
        <CandidateApplicationDetailsPage
          application={selectedCandidateApplication}
          verifyingApplicationKey={verifyingApplicationKey}
          onBack={backToCandidates}
          onVerifyApplication={handleVerifyApplication}
          canManageStatuses={canManageJobs}
          onUpdateStatus={handleUpdateApplicationStatus}
        />
      ) : (
        <GlobalWorkforceCandidatesSection
          applications={applications}
          verifyingApplicationKey={verifyingApplicationKey}
          onVerifyApplication={handleVerifyApplication}
          onUpdateStatus={handleUpdateApplicationStatus}
          onOpenApplication={openCandidateApplication}
          onDeleteApplication={canManageJobs ? handleDeleteApplication : undefined}
          errorMessage={applicationsError || errorMessage}
          successMessage={successMessage}
          canManageStatuses={canManageJobs}
          canMarkMessageSent={!isSuperAdmin}
          approvedAdmins={canManageJobs ? approvedAdmins : undefined}
        />
      )
    );
  }

  if (activeSection === "signups") {
    if (isLoadingJobs || isLoadingApplications) {
      return (
        <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
          <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
          <span>Loading signups...</span>
        </div>
      );
    }

    return (
      selectedCandidateApplication ? (
        <CandidateApplicationDetailsPage
          application={selectedCandidateApplication}
          verifyingApplicationKey={verifyingApplicationKey}
          onBack={() => router.push(buildGlobalWorkforceRoute(routeBase, "signups"))}
          onVerifyApplication={handleVerifyApplication}
          canManageStatuses={canManageJobs}
          onUpdateStatus={handleUpdateApplicationStatus}
        />
      ) : (
        <GlobalWorkforceCandidatesSection
          applications={applications}
          verifyingApplicationKey={verifyingApplicationKey}
          onVerifyApplication={handleVerifyApplication}
          onUpdateStatus={handleUpdateApplicationStatus}
          onOpenApplication={(application) =>
            router.push(
              buildGlobalWorkforceRoute(routeBase, "signups", {
                candidateJob: application.jobDocumentId || application.jobId,
                candidateUid: application.uid,
              }),
            )
          }
          onDeleteApplication={canManageJobs ? handleDeleteApplication : undefined}
          errorMessage={applicationsError || errorMessage}
          successMessage={successMessage}
          canManageStatuses={canManageJobs}
          approvedAdmins={canManageJobs ? approvedAdmins : undefined}
          mode="signups"
        />
      )
    );
  }

  if (activeSection === "interviews") {
    if (isLoadingJobs || isLoadingApplications) {
      return (
        <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
          <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
          <span>Loading interview pipeline...</span>
        </div>
      );
    }

    return <GlobalWorkforceInterviewsSection applications={applications} />;
  }

  if (activeSection === "data") {
    return (
      <GlobalWorkforceDataSection jobs={jobs} applications={applications} />
    );
  }

  if (activeSection === "commissions") {
    return (
      <GlobalWorkforceCommissionsSection
        applications={applications}
        canManageCommissions={canManageJobs}
        canApproveCommissions={canApproveCommissions}
        onApproveCommission={handleApproveCommission}
        onDeleteCommission={handleDeleteCommission}
        activeCommissionKey={activeCommissionKey}
        errorMessage={applicationsError || errorMessage}
        successMessage={successMessage}
        approvedAdmins={canManageJobs ? approvedAdmins : undefined}
      />
    );
  }

  if (activeSection === "policies") {
    return <GlobalWorkforcePoliciesSection />;
  }

  const activeFilterCount = [jobStatusFilter, jobCountryFilter, jobTypeFilter, jobPayRangeFilter, jobSeniorityFilter, jobWorkplaceFilter].filter((f) => f !== "all").length;

  return (
    <>
      <div className="space-y-4">
        <section className="rounded-[1.35rem] border border-slate-200 bg-white px-5 py-4 shadow-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                Global Workforce jobs
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">Job posts</h2>
            </div>

            {canManageJobs ? (
              <button
                type="button"
                onClick={() => openEditor()}
                className="inline-flex items-center justify-center rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Add job
              </button>
            ) : null}
          </div>
        </section>

        {/* Filters */}
        {!isLoadingJobs && jobs.length > 0 ? (
          <section className="rounded-[1.15rem] border border-slate-200 bg-white px-4 py-3 shadow-panel space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={jobSearch}
                onChange={(e) => setJobSearch(e.target.value)}
                placeholder="Search by title or ID…"
                className="h-9 min-w-[180px] flex-1 rounded-full border border-slate-300 bg-white px-4 text-sm text-ink outline-none transition placeholder:text-muted/50 focus:border-primary"
              />
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  onClick={() => { setJobSearch(""); setJobStatusFilter("all"); setJobCountryFilter("all"); setJobTypeFilter("all"); setJobPayRangeFilter("all"); setJobSeniorityFilter("all"); setJobWorkplaceFilter("all"); }}
                  className="h-9 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-semibold text-muted transition hover:bg-slate-100"
                >
                  Clear {activeFilterCount} filter{activeFilterCount > 1 ? "s" : ""}
                </button>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {([ ["Status", jobStatusFilter, setJobStatusFilter, [["all","All statuses"], ...globalWorkforceStatusOptions.map((s) => [s, s])]] , ["Country", jobCountryFilter, setJobCountryFilter, [["all","All countries"], ...jobCountryOptions.map((c) => [c, c])]] , ["Type", jobTypeFilter, setJobTypeFilter, [["all","All types"], ...globalWorkforceJobTypeOptions.map((t) => [t, t])]] , ["Pay range", jobPayRangeFilter, setJobPayRangeFilter, [["all","Any pay range"], ...jobPayRateRangeOptions.map((r) => [r.value, r.label])]] , ["Seniority", jobSeniorityFilter, setJobSeniorityFilter, [["all","Any seniority"], ...globalWorkforceSeniorityOptions.map((s) => [s, s])]] , ["Workplace", jobWorkplaceFilter, setJobWorkplaceFilter, [["all","Any workplace"], ...globalWorkforceWorkplaceOptions.map((w) => [w, w])]] ] as [string, string, (v: string) => void, string[][]][]).map(([label, value, setter, opts]) => (
                <div key={label} className="flex items-center gap-1">
                  <select
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    className={["h-9 rounded-full border px-3 text-xs font-semibold outline-none transition", value !== "all" ? "border-primary/40 bg-primary/5 text-primary" : "border-slate-200 bg-white text-ink hover:border-slate-300"].join(" ")}
                  >
                    {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {errorMessage ? (
          <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
            {errorMessage}
          </div>
        ) : null}

        {applicationsError ? (
          <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
            {applicationsError}
          </div>
        ) : null}

        {successMessage ? (
          <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
            {successMessage}
          </div>
        ) : null}

        {isLoadingJobs ? (
          <div className="flex items-center gap-3 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
            <LoadingSpinner className="h-4 w-4 border-primary/30 border-t-primary" />
            <span>Loading jobs...</span>
          </div>
        ) : null}

        {!isLoadingJobs && jobs.length === 0 ? (
          <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-5 text-sm leading-7 text-muted">
            {canManageJobs
              ? "No jobs have been created yet. Use the button above to add your first post."
              : "No jobs have been created yet."}
          </div>
        ) : null}

        {!isLoadingJobs && jobs.length > 0 && filteredJobs.length === 0 ? (
          <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-5 text-sm text-muted">
            No jobs match your filters.
          </div>
        ) : null}

        {!isLoadingJobs && filteredJobs.length > 0 ? (() => {
          const openJobs = filteredJobs.filter((j) => j.status === "Open");
          const closedJobs = filteredJobs.filter((j) => j.status !== "Open");
          const renderRow = (job: GlobalWorkforceJobPost) => (
            <JobRow
              key={job.id}
              job={job}
              onEdit={() => openEditor(job.jobId)}
              onDelete={() => void handleDelete(job)}
              onView={() => openJobView(job)}
              isDeleting={isDeletingJob && selectedJobId === job.id}
              canManageJobs={canManageJobs}
              approvedAdmins={canManageJobs ? approvedAdmins : undefined}
              onAssignAdmins={canManageJobs ? handleAssignAdmins : undefined}
            />
          );
          return (
            <div className="space-y-5">
              {openJobs.length > 0 ? (
                <section className="space-y-3">{openJobs.map(renderRow)}</section>
              ) : null}
              {closedJobs.length > 0 ? (
                <section className="space-y-3">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">
                    Closed / paused · {closedJobs.length}
                  </p>
                  {closedJobs.map(renderRow)}
                </section>
              ) : null}
            </div>
          );
        })() : null}
      </div>
    </>
  );
}
