"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { User } from "firebase/auth";

import { countryOptions } from "@/lib/candidates/portal-data";
import {
  adminCompensationRequestTypeOptions,
  adminDocumentMaxFileSizeBytes,
  adminFilerStatusOptions,
  adminLeaveRequestTypeOptions,
  adminPaymentMethodOptions,
  adminRequestStatusOptions,
  adminZakatDeductionOptions,
  createAdminWorkspaceProfileDraft,
  deleteAdminDocument,
  emptyAdminRequestDraft,
  emptyAdminWorkspaceProfileDraft,
  getAdminProfileCompletion,
  saveAdminWorkspaceProfile,
  subscribeToAdminPaymentsByUser,
  submitAdminRequest,
  subscribeToAdminRequestsByUser,
  subscribeToAdminWorkspaceProfile,
  type AdminPaymentRecord,
  uploadAdminDocument,
  uploadAdminProfilePhoto,
  type AdminDocumentUpload,
  type AdminProfileSectionKey,
  type AdminRequestCategory,
  type AdminRequestRecord,
  type AdminRequestSectionKey,
  type AdminWorkspaceProfile,
  type AdminWorkspaceProfileDraft,
} from "@/lib/firebase/admin-workspace";
import { savePortalProfile, type PortalProfile } from "@/lib/firebase/user-profiles";
import { type AdminApprovalRecord } from "@/lib/firebase/admin-access";
import { servicePages } from "@/lib/service-pages";
import { isSuperAdminEmail } from "@/lib/auth/access-control";
import {
  GlobalWorkforceAdminPanel,
  type GlobalWorkforceAdminSection,
} from "@/components/global-workforce-admin-panel";
import {
  DataCollectionAdminPanel,
  type DCAdminSection,
} from "@/components/data-collection-admin-panel";
import {
  EvalTranscriptionPanel,
  type EvalTranscriptionSection,
} from "@/components/eval-transcription-panel";

const fieldClassName =
  "w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary";

const profileSections: Array<{
  key: AdminProfileSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: "identity",
    label: "Basics",
    description: "Personal, role, and reporting details for your Deaimer employee record.",
  },
  {
    key: "address",
    label: "Address",
    description: "Residence, emergency contact, and mailing details.",
  },
  {
    key: "bank-payroll",
    label: "Bank",
    description: "Bank account and salary payment details used by finance.",
  },
  {
    key: "tax-info",
    label: "Tax",
    description: "Pakistani tax, CNIC, filer, and payroll deduction information.",
  },
  {
    key: "documents",
    label: "Documents",
    description: "Upload required CNIC images plus optional payroll and contract files.",
  },
  {
    key: "policy-documents",
    label: "Policies",
    description: "Confirm the internal policies and agreements you have signed.",
  },
];

const requestSections: Array<{
  key: AdminRequestSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: "leave",
    label: "Leave",
    description: "Submit time off, medical leave, and work-from-home requests.",
  },
  {
    key: "compensation",
    label: "Compensation",
    description: "Request bonus reviews, reimbursements, salary adjustments, or advances.",
  },
  {
    key: "history",
    label: "History",
    description: "Track every request, status update, and reviewer note in one place.",
  },
];

function normalizeProfileSection(value: string | null): AdminProfileSectionKey {
  return profileSections.find((section) => section.key === value)?.key ?? "identity";
}

function normalizeRequestSection(value: string | null): AdminRequestSectionKey {
  return requestSections.find((section) => section.key === value)?.key ?? "leave";
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
    <article className={["rounded-xl border border-slate-200 bg-white px-3 py-3 sm:px-5 sm:py-5", className].join(" ")}>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted/60 sm:text-[11px]">{label}</p>
      <p className="mt-1.5 text-2xl font-light tabular-nums tracking-tight text-ink sm:mt-2.5 sm:text-4xl">{value}</p>
      <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-muted sm:mt-2 sm:text-xs">{hint}</p>
    </article>
  );
}

function AdminSummaryField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-ink">{value}</p>
    </article>
  );
}

function ProfileInfoLine({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-2.5 text-sm sm:grid-cols-[180px_minmax(0,1fr)] sm:gap-4">
      <dt className="font-semibold text-ink">{label}</dt>
      <dd className="min-w-0 text-muted">{value || "Not added"}</dd>
    </div>
  );
}

function ProfileInfoSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 bg-white px-4 py-3"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-ink">
        {title}
        <span className="text-base text-muted transition group-open:rotate-180">v</span>
      </summary>
      <dl className="mt-3">{children}</dl>
    </details>
  );
}

function ReadOnlyEditField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-ink">{value || "Not added"}</p>
    </div>
  );
}

function ProfileIdentityStrip({
  photoUrl,
  name,
  role,
  department,
  fallbackInitial,
  onEdit,
}: {
  photoUrl: string;
  name: string;
  role: string;
  department: string;
  fallbackInitial: string;
  onEdit: () => void;
}) {
  return (
    <section className="rounded-[1.25rem] border border-slate-200 bg-white px-5 py-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={name}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xl font-semibold text-primary">
                {fallbackInitial.slice(0, 1).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold text-ink">
              {name || "Admin"}
            </h1>
            <p className="mt-1 text-sm text-muted">
              {[role, department].filter(Boolean).join(" - ") || "Role and department not added"}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
        >
          Edit profile
        </button>
      </div>
    </section>
  );
}

function AdminSectionHeader({
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return actions ? <div className="flex flex-wrap justify-end gap-3">{actions}</div> : null;
}

function ProfilePhotoUploader({
  previewName,
  photoUrl,
  isUploading,
  onPhotoChange,
}: {
  previewName: string;
  photoUrl: string;
  isUploading: boolean;
  onPhotoChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-white">
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={previewName}
              fill
              sizes="96px"
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
              {previewName.slice(0, 1).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">Profile picture</p>
          <p className="mt-2 text-sm leading-7 text-muted">
            Add a clear headshot for internal payroll, HR, and employee records.
          </p>
          <label className="mt-4 inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
            <input
              type="file"
              accept="image/*"
              onChange={onPhotoChange}
              className="sr-only"
            />
            {isUploading ? "Uploading photo..." : "Upload photo"}
          </label>
        </div>
      </div>
    </div>
  );
}

function RequestStatusBadge({ status }: { status: string }) {
  const className =
    status === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : status === "rejected"
        ? "border-rose-200 bg-rose-50 text-rose-900"
        : status === "under-review"
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-slate-300 bg-white text-ink";

  return (
    <span
      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] ${className}`}
    >
      {status}
    </span>
  );
}

function formatAdminRequestTitle(request: AdminRequestRecord) {
  return request.title || request.requestType || "Request";
}

function formatAdminRequestMeta(request: AdminRequestRecord) {
  if (request.category === "leave") {
    return [request.requestType, request.startDate, request.endDate]
      .filter(Boolean)
      .join(" · ");
  }

  return [request.requestType, request.amountRequested ? `${request.currency} ${request.amountRequested}` : ""]
    .filter(Boolean)
    .join(" · ");
}

function AdminRequestCard({ request }: { request: AdminRequestRecord }) {
  return (
    <article className="rounded-[1.15rem] border border-slate-200 bg-white p-5 shadow-panel">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted">
            {request.category === "leave" ? "Leave request" : "Compensation request"}
          </p>
          <h3 className="mt-2 text-lg font-semibold text-ink">
            {formatAdminRequestTitle(request)}
          </h3>
          <p className="mt-2 text-sm text-muted">{formatAdminRequestMeta(request)}</p>
        </div>
        <RequestStatusBadge status={request.status} />
      </div>

      <p className="mt-4 text-sm leading-7 text-muted">
        {request.description || "No details were added to this request."}
      </p>

      {request.reviewerNote ? (
        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
          <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Reviewer note</p>
          <p className="mt-2 text-sm leading-7 text-ink">{request.reviewerNote}</p>
        </div>
      ) : null}
    </article>
  );
}

function formatFileSize(sizeBytes: number) {
  if (sizeBytes >= 1024 * 1024) {
    return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (sizeBytes >= 1024) {
    return `${Math.round(sizeBytes / 1024)} KB`;
  }

  return `${sizeBytes} B`;
}

function buildSyncedPortalProfileDraft(
  activeUser: User,
  workspaceDraft: AdminWorkspaceProfileDraft,
  fallbackPortalProfile: PortalProfile | null,
) {
  return {
    fullName: workspaceDraft.identity.fullName.trim(),
    email: workspaceDraft.identity.workEmail.trim() || activeUser.email || "",
    phone: workspaceDraft.identity.phone.trim(),
    organization: [
      workspaceDraft.identity.department.trim(),
      workspaceDraft.identity.subDepartment.trim(),
    ].filter(Boolean).join(" - "),
    contactPerson:
      workspaceDraft.identity.managerName.trim() ||
      fallbackPortalProfile?.contactPerson ||
      "",
    companyWebsite: fallbackPortalProfile?.companyWebsite || "",
    companyAddress:
      workspaceDraft.address.currentAddress.trim() ||
      fallbackPortalProfile?.companyAddress ||
      "",
    jobTitle: workspaceDraft.identity.roleTitle.trim(),
    location:
      [workspaceDraft.address.city, workspaceDraft.address.country]
        .filter(Boolean)
        .join(", ") || fallbackPortalProfile?.location || "",
    bio:
      fallbackPortalProfile?.bio ||
      `Deaimer ${[
        workspaceDraft.identity.department,
        workspaceDraft.identity.subDepartment,
      ].filter(Boolean).join(" - ") || "admin"} team member.`,
    photoUrl: workspaceDraft.identity.profilePhotoUrl.trim(),
  };
}

function isLeaveRequestType(requestType: string) {
  return adminLeaveRequestTypeOptions.includes(
    requestType as (typeof adminLeaveRequestTypeOptions)[number],
  );
}

function DocumentCard({
  label,
  description,
  document,
  isUploading,
  required = false,
  onUpload,
  onRemove,
}: {
  label: string;
  description: string;
  document: AdminDocumentUpload | AdminWorkspaceProfile["documents"][keyof AdminWorkspaceProfile["documents"]];
  isUploading: boolean;
  required?: boolean;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <article className="rounded-[1.1rem] border border-slate-200 bg-white p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-sm font-semibold text-ink">
            {label} {required ? <span className="text-rose-600">*</span> : null}
          </p>
          <p className="mt-2 text-sm leading-7 text-muted">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex cursor-pointer items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
            <input
              type="file"
              accept="image/*,application/pdf"
              onChange={onUpload}
              className="sr-only"
            />
            {isUploading ? "Uploading..." : document?.fileUrl ? "Replace file" : "Upload file"}
          </label>
          {document?.fileUrl ? (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
            >
              Remove
            </button>
          ) : null}
        </div>
      </div>

      {document?.fileUrl ? (
        <div className="mt-4 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-950">{document.fileName}</p>
              <p className="mt-1 text-xs text-emerald-900">
                {document.contentType || "Unknown file type"} · {formatFileSize(document.sizeBytes)}
              </p>
            </div>
            <a
              href={document.fileUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100"
            >
              View file
            </a>
          </div>
        </div>
      ) : (
        <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
          No file uploaded yet.
        </div>
      )}
    </article>
  );
}

export function AdminPortalWorkspace({
  activeUser,
  basePortalProfile,
  adminApproval,
  isAdminApprovalLoading,
  errorMessage,
  successMessage,
  onErrorChange,
  onSuccessChange,
}: {
  activeUser: User;
  basePortalProfile: PortalProfile | null;
  adminApproval: AdminApprovalRecord | null;
  isAdminApprovalLoading: boolean;
  errorMessage: string | null;
  successMessage: string | null;
  onErrorChange: (message: string | null) => void;
  onSuccessChange: (message: string | null) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedService = searchParams.get("service");
  const requestedSection = searchParams.get("section");
  const isProfilePath = pathname.startsWith("/admin/profile");
  const isProfileEditPath = pathname.startsWith("/admin/profile/edit");
  const isProfileEditMode = isProfileEditPath || searchParams.get("edit") === "1";
  const requestMode = searchParams.get("mode");
  const isNewRequestMode = requestMode === "new";

  const [workspaceProfile, setWorkspaceProfile] = useState<AdminWorkspaceProfile | null>(
    null,
  );
  const [workspaceDraft, setWorkspaceDraft] = useState<AdminWorkspaceProfileDraft>(
    () => createAdminWorkspaceProfileDraft(activeUser, basePortalProfile, adminApproval),
  );
  const [isWorkspaceProfileLoading, setIsWorkspaceProfileLoading] = useState(true);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [uploadingDocumentKey, setUploadingDocumentKey] = useState<string | null>(null);
  const [requests, setRequests] = useState<AdminRequestRecord[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);
  const [requestDraft, setRequestDraft] = useState(emptyAdminRequestDraft);
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const allowedAdminServices = useMemo(
    () =>
      servicePages.filter((service) =>
        adminApproval?.servicePermissions.includes(service.slug),
      ),
    [adminApproval],
  );

  const globalWorkforceService =
    allowedAdminServices.find(
      (service) => service.slug === "global-managed-workforce",
    ) ?? null;

  const selectedServiceSlug =
    isProfilePath ? "profile" : requestedService;

  const selectedProfileSection = selectedServiceSlug === "profile"
    ? normalizeProfileSection(requestedSection)
    : null;
  const selectedRequestSection = selectedServiceSlug === "requests"
    ? normalizeRequestSection(requestedSection)
    : null;
  const selectedGlobalSection =
    selectedServiceSlug === "global-managed-workforce"
      ? ((["job-posts", "candidates", "commissions"].includes(
            requestedSection ?? "",
          )
            ? requestedSection
            : "job-posts") as GlobalWorkforceAdminSection)
      : null;

  const selectedDCSection =
    selectedServiceSlug === "data-collection-sourcing"
      ? ((["projects", "speakers", "sessions"].includes(
            requestedSection ?? "",
          )
            ? requestedSection
            : "projects") as DCAdminSection)
      : null;

  const selectedEvalSection =
    selectedServiceSlug === "evaluation-transcription"
      ? ((["assignments", "qa-review", "transcription"].includes(requestedSection ?? "")
            ? requestedSection
            : "assignments") as EvalTranscriptionSection)
      : null;

  const selectedProfileSectionConfig = profileSections.find(
    (section) => section.key === selectedProfileSection,
  );
  const selectedRequestSectionConfig = requestSections.find(
    (section) => section.key === selectedRequestSection,
  );
  useEffect(() => {
    return subscribeToAdminWorkspaceProfile(
      activeUser.uid,
      (profile) => {
        setWorkspaceProfile(profile);
        setWorkspaceDraft(
          profile ?? createAdminWorkspaceProfileDraft(activeUser, basePortalProfile, adminApproval),
        );
        setIsWorkspaceProfileLoading(false);
      },
      (error) => {
        onErrorChange(error.message);
        setIsWorkspaceProfileLoading(false);
      },
    );
  }, [activeUser, adminApproval, basePortalProfile, onErrorChange]);

  useEffect(() => {
    return subscribeToAdminRequestsByUser(
      activeUser.uid,
      (nextRequests) => {
        setRequests(nextRequests);
        setIsRequestsLoading(false);
      },
      (error) => {
        onErrorChange(error.message);
        setIsRequestsLoading(false);
      },
    );
  }, [activeUser.uid, onErrorChange]);

  useEffect(() => {
    return subscribeToAdminPaymentsByUser(
      activeUser.uid,
      (nextPayments) => {
        setPayments(nextPayments);
        setIsPaymentsLoading(false);
      },
      (error) => {
        onErrorChange(error.message);
        setIsPaymentsLoading(false);
      },
    );
  }, [activeUser.uid, onErrorChange]);

  const profilePreviewName =
    workspaceDraft.identity.fullName ||
    activeUser.displayName ||
    activeUser.email ||
    "Admin";
  const firstName = profilePreviewName.split(" ")[0] || "Admin";

  const completionSummary = getAdminProfileCompletion(workspaceProfile);
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const leaveRequests = requests.filter((request) => request.category === "leave");
  const compensationRequests = requests.filter(
    (request) => request.category === "compensation",
  );
  const uploadedDocumentCount = [
    workspaceProfile?.documents.cnicFront,
    workspaceProfile?.documents.cnicBack,
    workspaceProfile?.documents.bankProof,
    workspaceProfile?.documents.signedContract,
  ].filter(Boolean).length;

  function updateRoute(
    service: string | null,
    section: string | null = null,
    edit: boolean | null = null,
    mode: string | null = null,
  ) {
    if (service === "profile") {
      const nextParams = new URLSearchParams();

      if (section) {
        nextParams.set("section", section);
      }

      const nextQuery = nextParams.toString();
      const nextPath = edit ? "/admin/profile/edit" : "/admin/profile";
      router.replace(nextQuery ? `${nextPath}?${nextQuery}` : nextPath);
      return;
    }

    const nextParams = new URLSearchParams(searchParams.toString());

    if (service) {
      nextParams.set("service", service);
    } else {
      nextParams.delete("service");
    }

    if (section) {
      nextParams.set("section", section);
    } else {
      nextParams.delete("section");
    }

    if (edit === true) {
      nextParams.set("edit", "1");
    } else if (edit === false) {
      nextParams.delete("edit");
    }

    if (mode) {
      nextParams.set("mode", mode);
    } else {
      nextParams.delete("mode");
    }

    nextParams.delete("jobEditor");
    nextParams.delete("jobView");
    nextParams.delete("candidateJob");
    nextParams.delete("candidateUid");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/admin?${nextQuery}` : "/admin");
  }

  function handleProfileDraftChange(
    section: keyof AdminWorkspaceProfileDraft,
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value, type } = event.target;

    setWorkspaceDraft((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [name]:
          type === "checkbox"
            ? (event.target as HTMLInputElement).checked
            : value,
      },
    }));
  }

  async function handleProfilePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setIsUploadingPhoto(true);
    onErrorChange(null);

    try {
      const uploadedPhotoUrl = await uploadAdminProfilePhoto(activeUser, file);
      const nextDraft = {
        ...workspaceDraft,
        identity: {
          ...workspaceDraft.identity,
          profilePhotoUrl: uploadedPhotoUrl,
        },
      };

      setWorkspaceDraft(nextDraft);

      const savedProfile = await saveAdminWorkspaceProfile(activeUser, nextDraft);
      await savePortalProfile(
        activeUser,
        "admin",
        buildSyncedPortalProfileDraft(activeUser, nextDraft, basePortalProfile),
      );
      setWorkspaceProfile(savedProfile);
      onSuccessChange("Profile photo updated.");
    } catch (error) {
      onErrorChange(
        error instanceof Error ? error.message : "We could not upload this photo right now.",
      );
    } finally {
      setIsUploadingPhoto(false);
      event.target.value = "";
    }
  }

  async function handleDocumentUpload(
    documentKey: keyof AdminWorkspaceProfileDraft["documents"],
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setUploadingDocumentKey(documentKey);
    onErrorChange(null);

    try {
      const uploadedDocument = await uploadAdminDocument(activeUser, documentKey, file);
      const previousDocument = workspaceDraft.documents[documentKey];

      setWorkspaceDraft((current) => ({
        ...current,
        documents: {
          ...current.documents,
          [documentKey]: uploadedDocument,
        },
      }));

      if (previousDocument?.filePath) {
        await deleteAdminDocument(previousDocument);
      }
    } catch (error) {
      onErrorChange(
        error instanceof Error
          ? error.message
          : "We could not upload this document right now.",
      );
    } finally {
      setUploadingDocumentKey(null);
      event.target.value = "";
    }
  }

  async function handleDocumentRemove(
    documentKey: keyof AdminWorkspaceProfileDraft["documents"],
  ) {
    const currentDocument = workspaceDraft.documents[documentKey];

    if (!currentDocument) {
      return;
    }

    setUploadingDocumentKey(documentKey);
    onErrorChange(null);

    try {
      await deleteAdminDocument(currentDocument);
      setWorkspaceDraft((current) => ({
        ...current,
        documents: {
          ...current.documents,
          [documentKey]: null,
        },
      }));
    } catch (error) {
      onErrorChange(
        error instanceof Error
          ? error.message
          : "We could not remove this document right now.",
      );
    } finally {
      setUploadingDocumentKey(null);
    }
  }

  async function handleSaveProfile(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setIsSavingProfile(true);
    onErrorChange(null);
    onSuccessChange(null);

    try {
      const savedProfile = await saveAdminWorkspaceProfile(activeUser, workspaceDraft);
      const syncedPortalDraft = buildSyncedPortalProfileDraft(
        activeUser,
        workspaceDraft,
        basePortalProfile,
      );

      await savePortalProfile(activeUser, "admin", syncedPortalDraft);
      setWorkspaceProfile(savedProfile);
      setWorkspaceDraft(
        savedProfile ?? createAdminWorkspaceProfileDraft(activeUser, basePortalProfile, adminApproval),
      );
      onSuccessChange("Admin profile saved successfully.");
    } catch (error) {
      onErrorChange(
        error instanceof Error
          ? error.message
          : "We could not save your admin profile right now.",
      );
    } finally {
      setIsSavingProfile(false);
    }
  }

  function handleRequestDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setRequestDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmittingRequest(true);
    onErrorChange(null);
    onSuccessChange(null);

    try {
      await submitAdminRequest(activeUser, workspaceProfile, requestDraft);
      setRequestDraft({
        ...emptyAdminRequestDraft,
        category: requestDraft.category,
      });
      onSuccessChange("Your request has been submitted for review.");
      if (selectedRequestSection !== "history") {
        updateRoute("requests", "history");
      }
    } catch (error) {
      onErrorChange(
        error instanceof Error
          ? error.message
          : "We could not submit your request right now.",
      );
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  function renderHome() {
    const homeCards = [
      ...allowedAdminServices.map((service) => ({
        key: service.slug,
        label: service.title,
        body:
          service.slug === "global-managed-workforce"
            ? "Manage job posts, candidates, interviews, data, and policies from one admin workspace."
            : service.description,
        onClick: () =>
          updateRoute(
            service.slug,
            service.slug === "global-managed-workforce" ? "job-posts" : null,
          ),
      })),
      {
        key: "profile",
        label: "Profile",
        body:
          "Review your identity, payroll, tax, compulsory documents, and signed policies in one place.",
        onClick: () => updateRoute("profile", null, false),
      },
      {
        key: "requests",
        label: "Requests",
        body:
          "Track leave, bonus, commission, reimbursement, and salary-related requests without leaving the admin portal.",
        onClick: () => updateRoute("requests", "leave"),
      },
    ];

    return (
      <>
        <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-8 py-10 sm:px-10 sm:py-12">
          <div className="relative z-10">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
              Admin portal
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">
              Welcome back, {firstName}
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-7 text-white/75">
              Manage your workspace, employee profile, and internal requests all in one place.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {globalWorkforceService ? (
                <button
                  type="button"
                  onClick={() => updateRoute("global-managed-workforce", "job-posts")}
                  className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  Open work
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => updateRoute("requests", "leave")}
                className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
              >
                Open requests
              </button>
            </div>
          </div>
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 right-16 h-32 w-32 rounded-full bg-white/5" />
        </section>

        <section className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden xl:grid xl:grid-cols-4 xl:overflow-visible xl:pb-0" style={{ scrollbarWidth: "none" }}>
          <WorkspaceMetricCard
            className="w-40 shrink-0 xl:w-auto"
            label="Assigned services"
            value={String(allowedAdminServices.length).padStart(2, "0")}
            hint="Your sidebar only shows workspaces the super admin has approved."
          />
          <WorkspaceMetricCard
            className="w-40 shrink-0 xl:w-auto"
            label="Requests"
            value={String(requests.length).padStart(2, "0")}
            hint="Leave and compensation requests you already submitted through the admin portal."
          />
          <WorkspaceMetricCard
            className="w-40 shrink-0 xl:w-auto"
            label="Documents"
            value={String(uploadedDocumentCount).padStart(2, "0")}
            hint="Required employee files currently saved inside your admin profile record."
          />
          <WorkspaceMetricCard
            className="w-40 shrink-0 xl:w-auto"
            label="Profile"
            value={
              completionSummary.completedSections === completionSummary.totalSections
                ? "Ready"
                : `${completionSummary.completedSections}/${completionSummary.totalSections}`
            }
            hint="Your employee profile can be reviewed any time and updated when needed."
          />
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          {homeCards.map((card) => {
            const isGMW = card.key === "global-managed-workforce";
            return isGMW ? (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className="group relative overflow-hidden rounded-xl bg-gradient-to-br from-primary to-primaryStrong p-5 text-left"
              >
                <div className="relative z-10 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{card.label}</p>
                    <p className="mt-2 text-sm leading-7 text-white/75">{card.body}</p>
                  </div>
                  <span className="shrink-0 text-lg text-white/50 transition group-hover:text-white">→</span>
                </div>
                <div aria-hidden="true" className="pointer-events-none absolute -right-5 -top-5 h-24 w-24 rounded-full bg-white/10" />
                <div aria-hidden="true" className="pointer-events-none absolute -bottom-4 right-10 h-14 w-14 rounded-full bg-white/5" />
              </button>
            ) : (
              <button
                key={card.key}
                type="button"
                onClick={card.onClick}
                className="rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-primary/25 hover:bg-[#f9fbff]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{card.label}</p>
                    <p className="mt-2 text-sm leading-7 text-muted">{card.body}</p>
                  </div>
                  <span className="shrink-0 text-lg text-muted/40">→</span>
                </div>
              </button>
            );
          })}
        </section>

      </>
    );
  }

  function renderProfileWorkspace() {
    const policyItems = [
      workspaceDraft.policyDocuments.codeOfConductSigned ? "Code of conduct" : null,
      workspaceDraft.policyDocuments.confidentialityAgreementSigned ? "Confidentiality agreement" : null,
      workspaceDraft.policyDocuments.dataProtectionPolicySigned ? "Data protection policy" : null,
      workspaceDraft.policyDocuments.acceptableUsePolicySigned ? "Acceptable use policy" : null,
      workspaceDraft.policyDocuments.payrollPolicySigned ? "Payroll and reimbursement policy" : null,
    ].filter((item): item is string => Boolean(item));
    const profileTabGridClass =
      "flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-panelStrong p-1";
    const profileEditTabs = (
      <div className={profileTabGridClass}>
        {profileSections.map((section) => {
          const isActive = selectedProfileSection === section.key;

          return (
            <button
              key={section.key}
              type="button"
              onClick={() => updateRoute("profile", section.key, true)}
              className={[
                "rounded-xl px-4 py-3 text-left transition",
                isActive
                  ? "bg-white text-ink shadow-sm"
                  : "text-muted hover:bg-white/80 hover:text-ink",
              ].join(" ")}
            >
              <span className="block text-sm font-semibold">{section.label}</span>
            </button>
          );
        })}
      </div>
    );

    if (false && !isProfileEditMode && selectedProfileSection === "identity") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Identity"
            description="Review the identity details you can edit yourself, plus the super-managed employment information attached to your admin record."
            actions={
              <button
                type="button"
                onClick={() => updateRoute("profile", "identity", true)}
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Edit profile
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                {workspaceDraft.identity.profilePhotoUrl ? (
                  <Image src={workspaceDraft.identity.profilePhotoUrl} alt={profilePreviewName} fill sizes="96px" className="object-cover" unoptimized />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-2xl font-semibold text-primary">
                    {profilePreviewName.slice(0, 1).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.2em] text-primarySoft">Identity</p>
                <h2 className="mt-2 text-2xl font-semibold text-ink">{workspaceDraft.identity.fullName || "Admin profile"}</h2>
                <p className="mt-2 text-sm text-muted">{workspaceDraft.identity.workEmail || activeUser.email || "No work email added"}</p>
              </div>
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Editable details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="Full name" value={workspaceDraft.identity.fullName || "Not added"} />
              <AdminSummaryField label="Preferred name" value={workspaceDraft.identity.preferredName || "Not added"} />
              <AdminSummaryField label="Work email" value={workspaceDraft.identity.workEmail || "Not added"} />
              <AdminSummaryField label="Personal email" value={workspaceDraft.identity.personalEmail || "Not added"} />
              <AdminSummaryField label="Phone" value={workspaceDraft.identity.phone || "Not added"} />
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Super managed details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="Employee ID" value={workspaceDraft.identity.employeeId || "Not added"} />
              <AdminSummaryField
                label="Department"
                value={
                  [
                    workspaceDraft.identity.department,
                    workspaceDraft.identity.subDepartment,
                  ].filter(Boolean).join(" - ") || "Not added"
                }
              />
              <AdminSummaryField label="Role title" value={workspaceDraft.identity.roleTitle || "Not added"} />
              <AdminSummaryField label="Manager" value={workspaceDraft.identity.managerName || "Not added"} />
              <AdminSummaryField label="Manager email" value={workspaceDraft.identity.managerEmail || "Not added"} />
              <AdminSummaryField label="Date of joining" value={workspaceDraft.identity.dateOfJoining || "Not added"} />
              <AdminSummaryField label="Employment type" value={workspaceDraft.identity.employmentType || "Not added"} />
              <AdminSummaryField label="Employment status" value={workspaceDraft.identity.employmentStatus || "Not added"} />
            </div>
          </section>
        </>
      );
    }

    if (false && !isProfileEditMode && selectedProfileSection === "address") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Address"
            description="Review your saved address and emergency contact details before opening the separate edit page."
            actions={
              <button type="button" onClick={() => updateRoute("profile", "address", true)} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                Edit address
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="mt-1 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="Current address" value={workspaceDraft.address.currentAddress || "Not added"} />
              <AdminSummaryField label="Permanent address" value={workspaceDraft.address.permanentAddress || "Not added"} />
              <AdminSummaryField label="City" value={workspaceDraft.address.city || "Not added"} />
              <AdminSummaryField label="Province" value={workspaceDraft.address.province || "Not added"} />
              <AdminSummaryField label="Postal code" value={workspaceDraft.address.postalCode || "Not added"} />
              <AdminSummaryField label="Country" value={workspaceDraft.address.country || "Not added"} />
              <AdminSummaryField label="Emergency contact name" value={workspaceDraft.address.emergencyContactName || "Not added"} />
              <AdminSummaryField label="Emergency contact phone" value={workspaceDraft.address.emergencyContactPhone || "Not added"} />
              <AdminSummaryField label="Emergency relation" value={workspaceDraft.address.emergencyContactRelation || "Not added"} />
            </div>
          </section>
        </>
      );
    }

    if (false && !isProfileEditMode && selectedProfileSection === "bank-payroll") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Bank & Payroll"
            description="Review your bank receiving details here. Payroll cycle, salary, bonus, commission, and releases are managed by super admin control."
            actions={
              <button type="button" onClick={() => updateRoute("profile", "bank-payroll", true)} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                Edit bank details
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Bank details</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="Account title" value={workspaceDraft.bankPayroll.accountTitle || "Not added"} />
              <AdminSummaryField label="Bank name" value={workspaceDraft.bankPayroll.bankName || "Not added"} />
              <AdminSummaryField label="IBAN" value={workspaceDraft.bankPayroll.iban || "Not added"} />
              <AdminSummaryField label="Account number" value={workspaceDraft.bankPayroll.accountNumber || "Not added"} />
              <AdminSummaryField label="Branch code" value={workspaceDraft.bankPayroll.branchCode || "Not added"} />
              <AdminSummaryField label="Payment method" value={workspaceDraft.bankPayroll.paymentMethod || "Not added"} />
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Super controlled payroll</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="Payroll cycle" value={workspaceDraft.bankPayroll.payrollCycle || "Not added"} />
              <AdminSummaryField label="Salary currency" value={workspaceDraft.bankPayroll.salaryCurrency || "Not added"} />
              <AdminSummaryField label="Base salary" value={workspaceDraft.bankPayroll.baseSalary || "Not added"} />
              <AdminSummaryField label="Bonus eligible" value={workspaceDraft.bankPayroll.bonusEligible ? "Yes" : "No"} />
              <AdminSummaryField label="Commission eligible" value={workspaceDraft.bankPayroll.commissionEligible ? "Yes" : "No"} />
            </div>
          </section>
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Payment history</p>
              <span className="rounded-full bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                {String(payments.length).padStart(2, "0")} entries
              </span>
            </div>
            {isPaymentsLoading ? (
              <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">Loading payment history...</div>
            ) : payments.length === 0 ? (
              <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">No payment releases logged yet.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {payments.map((payment) => (
                  <div key={payment.id} className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-sm font-semibold text-ink">{payment.currency} {payment.amount || "0"} • {payment.paymentMonth || "Payment release"}</p>
                    <p className="mt-1 text-xs leading-6 text-muted">Released by {payment.releasedByEmail || "Super admin"}{payment.note ? ` • ${payment.note}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      );
    }

    if (false && !isProfileEditMode && selectedProfileSection === "tax-info") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Tax Info"
            description="Review your tax details first, then open the separate edit page if something needs to change."
            actions={
              <button type="button" onClick={() => updateRoute("profile", "tax-info", true)} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                Edit tax info
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <AdminSummaryField label="CNIC number" value={workspaceDraft.taxInfo.cnicNumber || "Not added"} />
              <AdminSummaryField label="NTN" value={workspaceDraft.taxInfo.ntnNumber || "Not added"} />
              <AdminSummaryField label="Filer status" value={workspaceDraft.taxInfo.filerStatus || "Not added"} />
              <AdminSummaryField label="Tax residence" value={workspaceDraft.taxInfo.taxResidence || "Not added"} />
            </div>
          </section>
        </>
      );
    }

    if (false && !isProfileEditMode && selectedProfileSection === "documents") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Documents"
            description="Review the documents already on file first. CNIC front, CNIC back, and bank proof can be updated on the separate edit page. Contract is view-only here."
            actions={
              <button type="button" onClick={() => updateRoute("profile", "documents", true)} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong">
                Edit documents
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="grid gap-5 lg:grid-cols-2">
              {[
                { label: "CNIC front", document: workspaceDraft.documents.cnicFront, note: "" },
                { label: "CNIC back", document: workspaceDraft.documents.cnicBack, note: "" },
                { label: "Bank proof", document: workspaceDraft.documents.bankProof, note: "" },
                { label: "Signed contract", document: workspaceDraft.documents.signedContract, note: "This document is managed by super admin control." },
              ].map((item) => (
                <article key={item.label} className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted">{item.label}</p>
                  {item.document?.fileUrl ? (
                    <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-emerald-950">{item.document.fileName}</p>
                        <p className="mt-1 text-xs text-emerald-900">{item.document.contentType || "Unknown file type"}</p>
                      </div>
                      <a href={item.document.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100">
                        View file
                      </a>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">No file uploaded yet.</div>
                  )}
                  {item.note ? <p className="mt-3 text-xs leading-6 text-muted">{item.note}</p> : null}
                </article>
              ))}
            </div>
          </section>
        </>
      );
    }

    if (false && !isProfileEditMode && selectedProfileSection === "policy-documents") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Policy Documents Signed"
            description="These policy acknowledgements are visible here for reference and are controlled by super admin."
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <div className="space-y-3">
              {policyItems.length > 0 ? (
                policyItems.map((item) => (
                  <div key={item} className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm font-medium text-ink">{item}</div>
                ))
              ) : (
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">No policy confirmations added yet.</div>
              )}
            </div>
            {workspaceDraft.policyDocuments.signedAt ? (
              <p className="mt-5 text-sm text-muted">Signed / confirmed date: {workspaceDraft.policyDocuments.signedAt}</p>
            ) : null}
          </section>
        </>
      );
    }

    if (false && isProfileEditMode && selectedProfileSection === "identity") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Edit Identity"
            description="Only your personal identity fields can be updated here. Employment and reporting details stay under super admin control."
            actions={
              <>
                <button type="button" onClick={() => updateRoute("profile", "identity", false)} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
                  View section
                </button>
                <button type="button" onClick={() => void handleSaveProfile()} disabled={isSavingProfile} className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingProfile ? <LoadingSpinner /> : null}
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </>
            }
          />
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Full name</span><input name="fullName" value={workspaceDraft.identity.fullName} onChange={(event) => handleProfileDraftChange("identity", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Preferred name</span><input name="preferredName" value={workspaceDraft.identity.preferredName} onChange={(event) => handleProfileDraftChange("identity", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Work email</span><input name="workEmail" value={workspaceDraft.identity.workEmail} onChange={(event) => handleProfileDraftChange("identity", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Personal email</span><input name="personalEmail" value={workspaceDraft.identity.personalEmail} onChange={(event) => handleProfileDraftChange("identity", event)} className={fieldClassName} /></label>
                <label className="block sm:col-span-2"><span className="mb-2 block text-sm font-medium text-ink">Phone</span><input name="phone" value={workspaceDraft.identity.phone} onChange={(event) => handleProfileDraftChange("identity", event)} className={fieldClassName} /></label>
              </div>
            </section>
          </form>
        </>
      );
    }

    if (false && isProfileEditMode && selectedProfileSection === "bank-payroll") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Edit Bank Details"
            description="You can update only the bank account details used to send your payments. Payroll cycle, salary, bonus, and commission settings are controlled by super admin."
            actions={
              <>
                <button type="button" onClick={() => updateRoute("profile", "bank-payroll", false)} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
                  View section
                </button>
                <button type="button" onClick={() => void handleSaveProfile()} disabled={isSavingProfile} className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingProfile ? <LoadingSpinner /> : null}
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </>
            }
          />
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Account title</span><input name="accountTitle" value={workspaceDraft.bankPayroll.accountTitle} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Bank name</span><input name="bankName" value={workspaceDraft.bankPayroll.bankName} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">IBAN</span><input name="iban" value={workspaceDraft.bankPayroll.iban} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Account number</span><input name="accountNumber" value={workspaceDraft.bankPayroll.accountNumber} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Branch code</span><input name="branchCode" value={workspaceDraft.bankPayroll.branchCode} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Payment method</span><select name="paymentMethod" value={workspaceDraft.bankPayroll.paymentMethod} onChange={(event) => handleProfileDraftChange("bankPayroll", event)} className={fieldClassName}>{adminPaymentMethodOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              </div>
            </section>
          </form>
        </>
      );
    }

    if (false && isProfileEditMode && selectedProfileSection === "tax-info") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Edit Tax Info"
            description="Only the tax fields required for your profile can be updated here."
            actions={
              <>
                <button type="button" onClick={() => updateRoute("profile", "tax-info", false)} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
                  View section
                </button>
                <button type="button" onClick={() => void handleSaveProfile()} disabled={isSavingProfile} className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingProfile ? <LoadingSpinner /> : null}
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </>
            }
          />
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">CNIC number</span><input name="cnicNumber" value={workspaceDraft.taxInfo.cnicNumber} onChange={(event) => handleProfileDraftChange("taxInfo", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">NTN</span><input name="ntnNumber" value={workspaceDraft.taxInfo.ntnNumber} onChange={(event) => handleProfileDraftChange("taxInfo", event)} className={fieldClassName} /></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Filer status</span><select name="filerStatus" value={workspaceDraft.taxInfo.filerStatus} onChange={(event) => handleProfileDraftChange("taxInfo", event)} className={fieldClassName}>{adminFilerStatusOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label className="block"><span className="mb-2 block text-sm font-medium text-ink">Tax residence</span><input name="taxResidence" value={workspaceDraft.taxInfo.taxResidence} onChange={(event) => handleProfileDraftChange("taxInfo", event)} className={fieldClassName} /></label>
              </div>
            </section>
          </form>
        </>
      );
    }

    if (false && isProfileEditMode && selectedProfileSection === "documents") {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Profile"
            title="Edit Documents"
            description="Upload or replace your CNIC front, CNIC back, and bank proof here. Contract remains view-only because it is controlled by super admin."
            actions={
              <>
                <button type="button" onClick={() => updateRoute("profile", "documents", false)} className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100">
                  View section
                </button>
                <button type="button" onClick={() => void handleSaveProfile()} disabled={isSavingProfile || Boolean(uploadingDocumentKey)} className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
                  {isSavingProfile ? <LoadingSpinner /> : null}
                  {isSavingProfile ? "Saving..." : "Save"}
                </button>
              </>
            }
          />
          <div className="space-y-5">
            <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
              CNIC front and back uploads are compulsory before the admin profile is considered complete. Contract is shown below but can only be changed from super control.
            </section>
            <div className="grid gap-5 lg:grid-cols-2">
              <DocumentCard label="CNIC front" description="Upload a clear front-side image or PDF of your CNIC." document={workspaceDraft.documents.cnicFront} isUploading={uploadingDocumentKey === "cnicFront"} required onUpload={(event) => void handleDocumentUpload("cnicFront", event)} onRemove={() => void handleDocumentRemove("cnicFront")} />
              <DocumentCard label="CNIC back" description="Upload a clear back-side image or PDF of your CNIC." document={workspaceDraft.documents.cnicBack} isUploading={uploadingDocumentKey === "cnicBack"} required onUpload={(event) => void handleDocumentUpload("cnicBack", event)} onRemove={() => void handleDocumentRemove("cnicBack")} />
              <DocumentCard label="Bank proof" description="Bank letter, cheque leaf, or IBAN proof used by finance." document={workspaceDraft.documents.bankProof} isUploading={uploadingDocumentKey === "bankProof"} onUpload={(event) => void handleDocumentUpload("bankProof", event)} onRemove={() => void handleDocumentRemove("bankProof")} />
              <article className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-muted">Signed contract</p>
                {workspaceDraft.documents.signedContract?.fileUrl ? (
                  <div className="mt-4 flex items-center justify-between gap-3 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-emerald-950">{workspaceDraft.documents.signedContract?.fileName}</p>
                    </div>
                    <a href={workspaceDraft.documents.signedContract?.fileUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center rounded-full bg-white px-4 py-2 text-sm font-semibold text-emerald-900 transition hover:bg-emerald-100">View file</a>
                  </div>
                ) : (
                  <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">No file uploaded yet.</div>
                )}
                <p className="mt-3 text-xs leading-6 text-muted">This document is managed by super admin control.</p>
              </article>
            </div>
          </div>
        </>
      );
    }

    if (!isProfileEditMode) {
      return (
        <>
          {isWorkspaceProfileLoading ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
              Loading your admin profile...
            </div>
          ) : (
            <>
              <ProfileIdentityStrip
                photoUrl={workspaceDraft.identity.profilePhotoUrl}
                name={workspaceDraft.identity.fullName || profilePreviewName}
                role={workspaceDraft.identity.roleTitle}
                department={[workspaceDraft.identity.department, workspaceDraft.identity.subDepartment].filter(Boolean).join(" - ")}
                fallbackInitial={profilePreviewName}
                onEdit={() => updateRoute("profile", "identity", true)}
              />

              <section className="space-y-3">
                <ProfileInfoSection title="Basics" defaultOpen>
                  <ProfileInfoLine label="Name" value={workspaceDraft.identity.fullName || "Not added"} />
                  <ProfileInfoLine label="Preferred name" value={workspaceDraft.identity.preferredName || "Not added"} />
                  <ProfileInfoLine label="Role" value={workspaceDraft.identity.roleTitle || "Not added"} />
                  <ProfileInfoLine label="Employee ID" value={workspaceDraft.identity.employeeId || "Not added"} />
                  <ProfileInfoLine label="Work email" value={workspaceDraft.identity.workEmail || activeUser.email || "Not added"} />
                  <ProfileInfoLine label="Phone" value={workspaceDraft.identity.phone || "Not added"} />
                </ProfileInfoSection>

                <ProfileInfoSection title="Team">
                  <ProfileInfoLine label="Department" value={[workspaceDraft.identity.department, workspaceDraft.identity.subDepartment].filter(Boolean).join(" - ") || "Not added"} />
                  <ProfileInfoLine label="Manager" value={workspaceDraft.identity.managerName || "Not added"} />
                  <ProfileInfoLine label="Manager email" value={workspaceDraft.identity.managerEmail || "Not added"} />
                  <ProfileInfoLine label="Joining date" value={workspaceDraft.identity.dateOfJoining || "Not added"} />
                  <ProfileInfoLine label="Employment type" value={workspaceDraft.identity.employmentType || "Not added"} />
                  <ProfileInfoLine label="Employment status" value={workspaceDraft.identity.employmentStatus || "Not added"} />
                </ProfileInfoSection>

                <ProfileInfoSection title="Address">
                  <ProfileInfoLine label="Current address" value={workspaceDraft.address.currentAddress || "Not added"} />
                  <ProfileInfoLine label="Permanent address" value={workspaceDraft.address.permanentAddress || "Not added"} />
                  <ProfileInfoLine label="City" value={workspaceDraft.address.city || "Not added"} />
                  <ProfileInfoLine label="Province" value={workspaceDraft.address.province || "Not added"} />
                  <ProfileInfoLine label="Postal code" value={workspaceDraft.address.postalCode || "Not added"} />
                  <ProfileInfoLine label="Country" value={workspaceDraft.address.country || "Not added"} />
                  <ProfileInfoLine label="Emergency contact" value={workspaceDraft.address.emergencyContactName || "Not added"} />
                  <ProfileInfoLine label="Emergency phone" value={workspaceDraft.address.emergencyContactPhone || "Not added"} />
                  <ProfileInfoLine label="Emergency relation" value={workspaceDraft.address.emergencyContactRelation || "Not added"} />
                </ProfileInfoSection>

                <ProfileInfoSection title="Bank And Payroll">
                  <ProfileInfoLine label="Account title" value={workspaceDraft.bankPayroll.accountTitle || "Not added"} />
                  <ProfileInfoLine label="Bank" value={workspaceDraft.bankPayroll.bankName || "Not added"} />
                  <ProfileInfoLine label="IBAN" value={workspaceDraft.bankPayroll.iban || "Not added"} />
                  <ProfileInfoLine label="Account number" value={workspaceDraft.bankPayroll.accountNumber || "Not added"} />
                  <ProfileInfoLine label="Payment method" value={workspaceDraft.bankPayroll.paymentMethod || "Not added"} />
                  <ProfileInfoLine label="Payroll cycle" value={workspaceDraft.bankPayroll.payrollCycle || "Not added"} />
                  <ProfileInfoLine label="Base salary" value={workspaceDraft.bankPayroll.baseSalary || "Not added"} />
                  <ProfileInfoLine label="Bonus eligible" value={workspaceDraft.bankPayroll.bonusEligible ? "Yes" : "No"} />
                  <ProfileInfoLine label="Commission eligible" value={workspaceDraft.bankPayroll.commissionEligible ? "Yes" : "No"} />
                </ProfileInfoSection>

                <ProfileInfoSection title="Tax">
                  <ProfileInfoLine label="CNIC" value={workspaceDraft.taxInfo.cnicNumber || "Not added"} />
                  <ProfileInfoLine label="NTN" value={workspaceDraft.taxInfo.ntnNumber || "Not added"} />
                  <ProfileInfoLine label="Filer status" value={workspaceDraft.taxInfo.filerStatus || "Not added"} />
                  <ProfileInfoLine label="Tax residence" value={workspaceDraft.taxInfo.taxResidence || "Not added"} />
                  <ProfileInfoLine label="Zakat deduction" value={workspaceDraft.taxInfo.zakatDeduction || "Not added"} />
                  <ProfileInfoLine label="EOBI" value={workspaceDraft.taxInfo.eobiNumber || "Not added"} />
                </ProfileInfoSection>

                <ProfileInfoSection title="Documents And Policies">
                  <ProfileInfoLine label="CNIC front" value={workspaceDraft.documents.cnicFront?.fileUrl ? <a href={workspaceDraft.documents.cnicFront.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">View file</a> : "Not uploaded"} />
                  <ProfileInfoLine label="CNIC back" value={workspaceDraft.documents.cnicBack?.fileUrl ? <a href={workspaceDraft.documents.cnicBack.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">View file</a> : "Not uploaded"} />
                  <ProfileInfoLine label="Bank proof" value={workspaceDraft.documents.bankProof?.fileUrl ? <a href={workspaceDraft.documents.bankProof.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">View file</a> : "Not uploaded"} />
                  <ProfileInfoLine label="Signed contract" value={workspaceDraft.documents.signedContract?.fileUrl ? <a href={workspaceDraft.documents.signedContract.fileUrl} target="_blank" rel="noreferrer" className="font-semibold text-primary">View file</a> : "Not uploaded"} />
                  <ProfileInfoLine label="Policies signed" value={policyItems.length ? policyItems.join(", ") : "Not added"} />
                  <ProfileInfoLine label="Signed date" value={workspaceDraft.policyDocuments.signedAt || "Not added"} />
                </ProfileInfoSection>
              </section>
              <div className="hidden">
              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                  <div className="relative h-24 w-24 overflow-hidden rounded-full border border-slate-200 bg-panelStrong">
                    {workspaceDraft.identity.profilePhotoUrl ? (
                      <Image
                        src={workspaceDraft.identity.profilePhotoUrl}
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

                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-primarySoft">
                      Identity
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      {workspaceDraft.identity.fullName || "Admin profile"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {workspaceDraft.identity.roleTitle || "Role not added"}{" "}
                      {workspaceDraft.identity.department
                        ? `· ${workspaceDraft.identity.department}`
                        : ""}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {workspaceDraft.identity.workEmail || activeUser.email || "No work email added"}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                  Basic info
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <AdminSummaryField label="Full name" value={workspaceDraft.identity.fullName || "Not added"} />
                  <AdminSummaryField label="Work email" value={workspaceDraft.identity.workEmail || activeUser.email || "Not added"} />
                  <AdminSummaryField label="Phone" value={workspaceDraft.identity.phone || "Not added"} />
                  <AdminSummaryField label="Employee ID" value={workspaceDraft.identity.employeeId || "Not added"} />
                </div>
              </section>
            </div>
            </>
          )}
        </>
      );
    }

    return (
      <>
        <section className="flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => updateRoute("profile", null, false)}
            className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
          >
            View profile
          </button>
          <button
            type="button"
            onClick={() => void handleSaveProfile()}
            disabled={isSavingProfile || isUploadingPhoto || Boolean(uploadingDocumentKey)}
            className="inline-flex items-center justify-center gap-3 rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSavingProfile ? <LoadingSpinner /> : null}
            {isSavingProfile ? "Saving..." : "Save profile"}
          </button>
        </section>

        {profileEditTabs}

        {isWorkspaceProfileLoading ? (
          <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
            Loading your admin profile...
          </div>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "identity" ? (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <ProfilePhotoUploader
              previewName={profilePreviewName}
              photoUrl={workspaceDraft.identity.profilePhotoUrl}
              isUploading={isUploadingPhoto}
              onPhotoChange={handleProfilePhotoChange}
            />

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Full name</span>
                  <input
                    name="fullName"
                    value={workspaceDraft.identity.fullName}
                    onChange={(event) => handleProfileDraftChange("identity", event)}
                    className={fieldClassName}
                    placeholder="Employee full name"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Preferred name</span>
                  <input
                    name="preferredName"
                    value={workspaceDraft.identity.preferredName}
                    onChange={(event) => handleProfileDraftChange("identity", event)}
                    className={fieldClassName}
                    placeholder="Preferred display name"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Work email</span>
                  <input
                    name="workEmail"
                    type="email"
                    value={workspaceDraft.identity.workEmail}
                    onChange={(event) => handleProfileDraftChange("identity", event)}
                    className={fieldClassName}
                    placeholder="work@deaimer.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Personal email</span>
                  <input
                    name="personalEmail"
                    type="email"
                    value={workspaceDraft.identity.personalEmail}
                    onChange={(event) => handleProfileDraftChange("identity", event)}
                    className={fieldClassName}
                    placeholder="your@email.com"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Phone</span>
                  <input
                    name="phone"
                    value={workspaceDraft.identity.phone}
                    onChange={(event) => handleProfileDraftChange("identity", event)}
                    className={fieldClassName}
                    placeholder="+92 300 1234567"
                  />
                </label>
                <ReadOnlyEditField label="Employee ID" value={workspaceDraft.identity.employeeId} />
                <ReadOnlyEditField
                  label="Department"
                  value={[workspaceDraft.identity.department, workspaceDraft.identity.subDepartment].filter(Boolean).join(" - ")}
                />
                <ReadOnlyEditField label="Role title" value={workspaceDraft.identity.roleTitle} />
                <ReadOnlyEditField label="Manager" value={workspaceDraft.identity.managerName} />
                <ReadOnlyEditField label="Manager email" value={workspaceDraft.identity.managerEmail} />
                <ReadOnlyEditField label="Date of joining" value={workspaceDraft.identity.dateOfJoining} />
                <ReadOnlyEditField label="Employment type" value={workspaceDraft.identity.employmentType} />
                <ReadOnlyEditField label="Employment status" value={workspaceDraft.identity.employmentStatus} />
              </div>
            </section>
          </form>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "address" ? (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-ink">Current address</span>
                  <textarea
                    name="currentAddress"
                    rows={4}
                    value={workspaceDraft.address.currentAddress}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={`${fieldClassName} min-h-[132px] resize-y`}
                    placeholder="Current residential address"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-ink">Permanent address</span>
                  <textarea
                    name="permanentAddress"
                    rows={4}
                    value={workspaceDraft.address.permanentAddress}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={`${fieldClassName} min-h-[132px] resize-y`}
                    placeholder="Permanent or hometown address"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">City</span>
                  <input
                    name="city"
                    value={workspaceDraft.address.city}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="Lahore"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Province</span>
                  <input
                    name="province"
                    value={workspaceDraft.address.province}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="Punjab"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Postal code</span>
                  <input
                    name="postalCode"
                    value={workspaceDraft.address.postalCode}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="54000"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Country</span>
                  <select
                    name="country"
                    value={workspaceDraft.address.country}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                  >
                    {countryOptions.map((country) => (
                      <option key={country} value={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Emergency contact name</span>
                  <input
                    name="emergencyContactName"
                    value={workspaceDraft.address.emergencyContactName}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="Emergency contact"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Emergency contact phone</span>
                  <input
                    name="emergencyContactPhone"
                    value={workspaceDraft.address.emergencyContactPhone}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="+92 300 1234567"
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-medium text-ink">Relation</span>
                  <input
                    name="emergencyContactRelation"
                    value={workspaceDraft.address.emergencyContactRelation}
                    onChange={(event) => handleProfileDraftChange("address", event)}
                    className={fieldClassName}
                    placeholder="Brother, spouse, parent"
                  />
                </label>
              </div>
            </section>
          </form>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "bank-payroll" ? (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Account title</span>
                  <input
                    name="accountTitle"
                    value={workspaceDraft.bankPayroll.accountTitle}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                    placeholder="As per bank record"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Bank name</span>
                  <input
                    name="bankName"
                    value={workspaceDraft.bankPayroll.bankName}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                    placeholder="Meezan Bank"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">IBAN</span>
                  <input
                    name="iban"
                    value={workspaceDraft.bankPayroll.iban}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                    placeholder="PK00MEEZ0000000000000000"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Account number</span>
                  <input
                    name="accountNumber"
                    value={workspaceDraft.bankPayroll.accountNumber}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                    placeholder="0001234567890"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Branch code</span>
                  <input
                    name="branchCode"
                    value={workspaceDraft.bankPayroll.branchCode}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                    placeholder="0123"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Payment method</span>
                  <select
                    name="paymentMethod"
                    value={workspaceDraft.bankPayroll.paymentMethod}
                    onChange={(event) => handleProfileDraftChange("bankPayroll", event)}
                    className={fieldClassName}
                  >
                    {adminPaymentMethodOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <ReadOnlyEditField label="Payroll cycle" value={workspaceDraft.bankPayroll.payrollCycle} />
                <ReadOnlyEditField label="Salary currency" value={workspaceDraft.bankPayroll.salaryCurrency} />
                <ReadOnlyEditField label="Base salary" value={workspaceDraft.bankPayroll.baseSalary} />
                <ReadOnlyEditField label="Bonus eligible" value={workspaceDraft.bankPayroll.bonusEligible ? "Yes" : "No"} />
                <ReadOnlyEditField label="Commission eligible" value={workspaceDraft.bankPayroll.commissionEligible ? "Yes" : "No"} />
              </div>
            </section>
          </form>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "tax-info" ? (
          <form onSubmit={handleSaveProfile} className="space-y-5">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">CNIC number</span>
                  <input
                    name="cnicNumber"
                    value={workspaceDraft.taxInfo.cnicNumber}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                    placeholder="35202-1234567-8"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">NTN</span>
                  <input
                    name="ntnNumber"
                    value={workspaceDraft.taxInfo.ntnNumber}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                    placeholder="1234567-8"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Filer status</span>
                  <select
                    name="filerStatus"
                    value={workspaceDraft.taxInfo.filerStatus}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                  >
                    {adminFilerStatusOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Tax residence</span>
                  <input
                    name="taxResidence"
                    value={workspaceDraft.taxInfo.taxResidence}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                    placeholder="Pakistan"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Zakat deduction</span>
                  <select
                    name="zakatDeduction"
                    value={workspaceDraft.taxInfo.zakatDeduction}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                  >
                    {adminZakatDeductionOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">EOBI number</span>
                  <input
                    name="eobiNumber"
                    value={workspaceDraft.taxInfo.eobiNumber}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                    placeholder="Optional"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Social security number</span>
                  <input
                    name="socialSecurityNumber"
                    value={workspaceDraft.taxInfo.socialSecurityNumber}
                    onChange={(event) => handleProfileDraftChange("taxInfo", event)}
                    className={fieldClassName}
                    placeholder="Optional"
                  />
                </label>
              </div>
            </section>
          </form>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "documents" ? (
          <div className="space-y-5">
            <section className="rounded-[1.5rem] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-950">
              CNIC front and back uploads are compulsory before the admin profile is considered complete.
              Supported files: JPG, PNG, WEBP, or PDF up to {formatFileSize(adminDocumentMaxFileSizeBytes)}.
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <DocumentCard
                label="CNIC front"
                description="Upload a clear front-side image or PDF of your CNIC."
                document={workspaceDraft.documents.cnicFront}
                isUploading={uploadingDocumentKey === "cnicFront"}
                required
                onUpload={(event) => void handleDocumentUpload("cnicFront", event)}
                onRemove={() => void handleDocumentRemove("cnicFront")}
              />
              <DocumentCard
                label="CNIC back"
                description="Upload a clear back-side image or PDF of your CNIC."
                document={workspaceDraft.documents.cnicBack}
                isUploading={uploadingDocumentKey === "cnicBack"}
                required
                onUpload={(event) => void handleDocumentUpload("cnicBack", event)}
                onRemove={() => void handleDocumentRemove("cnicBack")}
              />
              <DocumentCard
                label="Bank proof"
                description="Optional bank letter, cheque leaf, or IBAN proof used by finance."
                document={workspaceDraft.documents.bankProof}
                isUploading={uploadingDocumentKey === "bankProof"}
                onUpload={(event) => void handleDocumentUpload("bankProof", event)}
                onRemove={() => void handleDocumentRemove("bankProof")}
              />
              <article className="rounded-[1.2rem] border border-slate-200 bg-panelStrong p-5">
                <p className="text-sm font-semibold text-ink">Signed contract</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  This file is managed by super admin control.
                </p>
                {workspaceDraft.documents.signedContract?.fileUrl ? (
                  <a
                    href={workspaceDraft.documents.signedContract.fileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex rounded-full bg-white px-4 py-2 text-sm font-semibold text-ink"
                  >
                    View file
                  </a>
                ) : (
                  <div className="mt-4 rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                    No file uploaded yet.
                  </div>
                )}
              </article>
            </div>
          </div>
        ) : null}

        {!isWorkspaceProfileLoading && selectedProfileSection === "policy-documents" ? (
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <ReadOnlyEditField
                label="Code of conduct"
                value={workspaceDraft.policyDocuments.codeOfConductSigned ? "Signed" : "Not signed"}
              />
              <ReadOnlyEditField
                label="Confidentiality agreement"
                value={workspaceDraft.policyDocuments.confidentialityAgreementSigned ? "Signed" : "Not signed"}
              />
              <ReadOnlyEditField
                label="Data protection policy"
                value={workspaceDraft.policyDocuments.dataProtectionPolicySigned ? "Signed" : "Not signed"}
              />
              <ReadOnlyEditField
                label="Acceptable use policy"
                value={workspaceDraft.policyDocuments.acceptableUsePolicySigned ? "Signed" : "Not signed"}
              />
              <ReadOnlyEditField
                label="Payroll policy"
                value={workspaceDraft.policyDocuments.payrollPolicySigned ? "Signed" : "Not signed"}
              />
              <ReadOnlyEditField
                label="Signed date"
                value={workspaceDraft.policyDocuments.signedAt}
              />
            </div>
          </section>
        ) : null}
      </>
    );
  }

  function renderRequestsWorkspace() {
    const activeConfig = selectedRequestSectionConfig ?? requestSections[0];
    const visibleRequests =
      selectedRequestSection === "leave"
        ? leaveRequests
        : selectedRequestSection === "compensation"
          ? compensationRequests
          : requests;

    if ((selectedRequestSection === "leave" || selectedRequestSection === "compensation") && !isNewRequestMode) {
      const title = selectedRequestSection === "leave" ? "Leave" : "Compensation";
      return (
        <>
          <AdminSectionHeader
            eyebrow="Requests"
            title={title}
            description={activeConfig.description}
            actions={
              <button
                type="button"
                onClick={() => {
                  setRequestDraft((current) => ({
                    ...current,
                    category: selectedRequestSection === "leave" ? "leave" : "compensation",
                    currency: "PKR",
                  }));
                  updateRoute("requests", selectedRequestSection, null, "new");
                }}
                className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primaryStrong"
              >
                Add new request
              </button>
            }
          />

          <section className="space-y-3">
            {isRequestsLoading ? (
              <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                Loading requests...
              </div>
            ) : visibleRequests.length === 0 ? (
              <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                No {selectedRequestSection} requests yet.
              </div>
            ) : (
              visibleRequests.map((request) => (
                <AdminRequestCard key={request.id} request={request} />
              ))
            )}
          </section>
        </>
      );
    }

    if ((selectedRequestSection === "leave" || selectedRequestSection === "compensation") && isNewRequestMode) {
      return (
        <>
          <AdminSectionHeader
            eyebrow="Requests"
            title={`New ${selectedRequestSection === "leave" ? "Leave" : "Compensation"} Request`}
            description="Complete this request on its own page, then return to the list once it has been submitted."
            actions={
              <button
                type="button"
                onClick={() => updateRoute("requests", selectedRequestSection)}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
              >
                Back to list
              </button>
            }
          />
          <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
            <form onSubmit={handleRequestSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Request type</span>
                <select name="requestType" value={requestDraft.requestType} onChange={handleRequestDraftChange} className={fieldClassName}>
                  <option value="">Select request type</option>
                  {(selectedRequestSection === "leave" ? adminLeaveRequestTypeOptions : adminCompensationRequestTypeOptions).map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Title</span>
                <input name="title" value={requestDraft.title} onChange={handleRequestDraftChange} className={fieldClassName} />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Description</span>
                <textarea name="description" rows={5} value={requestDraft.description} onChange={handleRequestDraftChange} className={`${fieldClassName} min-h-[140px] resize-y`} />
              </label>
              {selectedRequestSection === "leave" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Start date</span>
                    <input name="startDate" type="date" value={requestDraft.startDate} onChange={handleRequestDraftChange} className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">End date</span>
                    <input name="endDate" type="date" value={requestDraft.endDate} onChange={handleRequestDraftChange} className={fieldClassName} />
                  </label>
                  <label className="block sm:col-span-2">
                    <span className="mb-2 block text-sm font-medium text-ink">Days requested</span>
                    <input name="daysRequested" value={requestDraft.daysRequested} onChange={handleRequestDraftChange} className={fieldClassName} />
                  </label>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Amount requested</span>
                    <input name="amountRequested" value={requestDraft.amountRequested} onChange={handleRequestDraftChange} className={fieldClassName} />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-sm font-medium text-ink">Currency</span>
                    <input name="currency" value={requestDraft.currency} onChange={handleRequestDraftChange} className={fieldClassName} />
                  </label>
                </div>
              )}
              <button type="submit" disabled={isSubmittingRequest} className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
                {isSubmittingRequest ? <LoadingSpinner /> : null}
                {isSubmittingRequest ? "Submitting request..." : "Submit request"}
              </button>
            </form>
          </section>
        </>
      );
    }

    return (
      <>
        <AdminSectionHeader
          eyebrow="Requests"
          title={activeConfig.label}
          description={activeConfig.description}
          actions={
            selectedRequestSection !== "history" ? (
              <button
                type="button"
                onClick={() => updateRoute("requests", "history")}
                className="rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink transition hover:bg-slate-100"
              >
                Open history
              </button>
            ) : null
          }
        />

        <section className="grid gap-4 lg:grid-cols-3">
          {requestSections.map((section) => {
            const isActive = section.key === activeConfig.key;

            return (
              <button
                key={section.key}
                type="button"
                onClick={() => updateRoute("requests", section.key)}
                className={[
                  "rounded-[1rem] border px-4 py-4 text-left transition",
                  isActive
                    ? "border-slate-300 bg-panelStrong"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                <p className="text-sm font-semibold text-ink">{section.label}</p>
                <p className="mt-2 text-xs leading-6 text-muted">{section.description}</p>
              </button>
            );
          })}
        </section>

        {selectedRequestSection === "leave" || selectedRequestSection === "compensation" ? (
          <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <form onSubmit={handleRequestSubmit} className="space-y-4">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Request type</span>
                  <select
                    name="requestType"
                    value={requestDraft.requestType}
                    onChange={handleRequestDraftChange}
                    className={fieldClassName}
                  >
                    <option value="">Select request type</option>
                    {(selectedRequestSection === "leave"
                      ? adminLeaveRequestTypeOptions
                      : adminCompensationRequestTypeOptions
                    ).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Title</span>
                  <input
                    name="title"
                    value={requestDraft.title}
                    onChange={handleRequestDraftChange}
                    className={fieldClassName}
                    placeholder={
                      selectedRequestSection === "leave"
                        ? "Example: Annual leave for family travel"
                        : "Example: Bonus review for Q2 delivery"
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-ink">Description</span>
                  <textarea
                    name="description"
                    rows={5}
                    value={requestDraft.description}
                    onChange={handleRequestDraftChange}
                    className={`${fieldClassName} min-h-[140px] resize-y`}
                    placeholder="Add the background, dates, reason, or supporting details."
                  />
                </label>

                {selectedRequestSection === "leave" ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Start date</span>
                      <input
                        name="startDate"
                        type="date"
                        value={requestDraft.startDate}
                        onChange={handleRequestDraftChange}
                        className={fieldClassName}
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">End date</span>
                      <input
                        name="endDate"
                        type="date"
                        value={requestDraft.endDate}
                        onChange={handleRequestDraftChange}
                        className={fieldClassName}
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-sm font-medium text-ink">Days requested</span>
                      <input
                        name="daysRequested"
                        value={requestDraft.daysRequested}
                        onChange={handleRequestDraftChange}
                        className={fieldClassName}
                        placeholder="2.5"
                      />
                    </label>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Amount requested</span>
                      <input
                        name="amountRequested"
                        value={requestDraft.amountRequested}
                        onChange={handleRequestDraftChange}
                        className={fieldClassName}
                        placeholder="50000"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-sm font-medium text-ink">Currency</span>
                      <input
                        name="currency"
                        value={requestDraft.currency}
                        onChange={handleRequestDraftChange}
                        className={fieldClassName}
                        placeholder="PKR"
                      />
                    </label>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="inline-flex w-full items-center justify-center gap-3 rounded-full bg-primary px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmittingRequest ? <LoadingSpinner /> : null}
                  {isSubmittingRequest ? "Submitting request..." : "Submit request"}
                </button>
              </form>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                  Recent {selectedRequestSection} requests
                </p>
                <button
                  type="button"
                  onClick={() => updateRoute("requests", "history")}
                  className="text-sm font-semibold text-primary transition hover:text-primaryStrong"
                >
                  Open history
                </button>
              </div>

              {isRequestsLoading ? (
                <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
                  Loading your requests...
                </div>
              ) : visibleRequests.length === 0 ? (
                <div className="mt-4 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
                  No {selectedRequestSection} requests yet.
                </div>
              ) : (
                <div className="mt-4 space-y-3">
                  {visibleRequests.slice(0, 4).map((request) => (
                    <AdminRequestCard key={request.id} request={request} />
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {selectedRequestSection === "history" ? (
          <section className="space-y-3">
            {isRequestsLoading ? (
              <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                Loading request history...
              </div>
            ) : requests.length === 0 ? (
              <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                No requests submitted yet.
              </div>
            ) : (
              requests.map((request) => (
                <AdminRequestCard key={request.id} request={request} />
              ))
            )}
          </section>
        ) : null}
      </>
    );
  }

  function renderPlaceholderService() {
    const selectedService = allowedAdminServices.find(
      (service) => service.slug === selectedServiceSlug,
    );

    if (!selectedService) {
      return (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <p className="text-sm leading-7 text-muted">
            This service is not currently assigned to your admin account.
          </p>
        </section>
      );
    }

    return (
      <>
        <AdminSectionHeader
          eyebrow={selectedService.eyebrow}
          title={selectedService.title}
          description={selectedService.description}
        />
        <section className="flex gap-3 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0" style={{ scrollbarWidth: "none" }}>
          <WorkspaceMetricCard
            className="w-40 shrink-0 md:w-auto"
            label="Queue"
            value="Placeholder"
            hint="Requests and work items for this service can connect here next."
          />
          <WorkspaceMetricCard
            className="w-40 shrink-0 md:w-auto"
            label="Tracking"
            value="Placeholder"
            hint="Delivery status, owners, and QA can plug into this workspace."
          />
          <WorkspaceMetricCard
            className="w-40 shrink-0 md:w-auto"
            label="Reporting"
            value="Placeholder"
            hint="Performance and operations reporting can be added here later."
          />
        </section>
      </>
    );
  }

  return (
    <main className="min-h-screen bg-background text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
        <div className="space-y-6">

            {errorMessage ? (
              <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
                {errorMessage}
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
                {successMessage}
              </div>
            ) : null}

            {isAdminApprovalLoading ? (
              <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
                Loading your admin permissions...
              </div>
            ) : null}

            {!selectedServiceSlug ? renderHome() : null}

            {selectedServiceSlug === "profile" ? renderProfileWorkspace() : null}

            {selectedServiceSlug === "requests" ? renderRequestsWorkspace() : null}

            {selectedServiceSlug === "global-managed-workforce" && globalWorkforceService ? (
              <GlobalWorkforceAdminPanel
                activeUser={activeUser}
                activeSection={selectedGlobalSection ?? "job-posts"}
                canManageJobs={false}
              />
            ) : null}

            {selectedServiceSlug === "data-collection-sourcing" ? (
              <DataCollectionAdminPanel
                activeUser={activeUser}
                activeSection={selectedDCSection ?? "projects"}
                isSuperAdmin={isSuperAdminEmail(activeUser.email)}
              />
            ) : null}

            {selectedServiceSlug === "evaluation-transcription" ? (
              <EvalTranscriptionPanel
                activeUser={activeUser}
                activeSection={selectedEvalSection ?? "assignments"}
                isSuperAdmin={isSuperAdminEmail(activeUser.email)}
              />
            ) : null}

            {selectedServiceSlug &&
            selectedServiceSlug !== "profile" &&
            selectedServiceSlug !== "requests" &&
            selectedServiceSlug !== "global-managed-workforce" &&
            selectedServiceSlug !== "data-collection-sourcing" &&
            selectedServiceSlug !== "evaluation-transcription"
              ? renderPlaceholderService()
              : null}
        </div>
      </div>
    </main>
  );
}
