"use client";

import { useEffect, useMemo, useState } from "react";

import { normalizeEmail } from "@/lib/auth/access-control";
import type { AdminApprovalRecord } from "@/lib/firebase/admin-access";
import {
  adminRequestStatusOptions,
  getAdminProfileCompletion,
  releaseAdminPayment,
  saveAdminWorkspaceProfileByUid,
  subscribeToAllAdminPayments,
  subscribeToAllAdminProfiles,
  subscribeToAllAdminRequests,
  updateAdminRequestStatus,
  type AdminPaymentRecord,
  type AdminRequestRecord,
  type AdminRequestStatus,
  type AdminWorkspaceProfile,
} from "@/lib/firebase/admin-workspace";
import { servicePages } from "@/lib/service-pages";

type AdminOpsTab = "profiles" | "requests";

function WorkspaceMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <article className="rounded-[1.15rem] border border-slate-200 bg-white px-4 py-4 shadow-panel">
      <p className="text-[11px] uppercase tracking-[0.2em] text-muted">{label}</p>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-2 text-sm leading-6 text-muted">{hint}</p>
    </article>
  );
}

function RequestStatusBadge({ status }: { status: AdminRequestStatus }) {
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

export function SuperAdminTeamPanel({
  adminApprovals,
  reviewerEmail,
}: {
  adminApprovals: AdminApprovalRecord[];
  reviewerEmail: string;
}) {
  const [activeTab, setActiveTab] = useState<AdminOpsTab>("profiles");
  const [profiles, setProfiles] = useState<AdminWorkspaceProfile[]>([]);
  const [profileDrafts, setProfileDrafts] = useState<Record<string, AdminWorkspaceProfile>>({});
  const [requests, setRequests] = useState<AdminRequestRecord[]>([]);
  const [payments, setPayments] = useState<AdminPaymentRecord[]>([]);
  const [isProfilesLoading, setIsProfilesLoading] = useState(true);
  const [isRequestsLoading, setIsRequestsLoading] = useState(true);
  const [isPaymentsLoading, setIsPaymentsLoading] = useState(true);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const [savingProfileUid, setSavingProfileUid] = useState<string | null>(null);
  const [releasingPaymentUid, setReleasingPaymentUid] = useState<string | null>(null);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [paymentDrafts, setPaymentDrafts] = useState<Record<string, { paymentMonth: string; amount: string; currency: string; note: string }>>({});

  useEffect(() => {
    return subscribeToAllAdminProfiles(
      (nextProfiles) => {
        setProfiles(nextProfiles);
        setProfileDrafts((current) => {
          const next = { ...current };
          nextProfiles.forEach((profile) => {
            next[profile.uid] = next[profile.uid] ?? profile;
          });
          return next;
        });
        setIsProfilesLoading(false);
      },
      (error) => {
        setPanelError(error.message);
        setIsProfilesLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    return subscribeToAllAdminRequests(
      (nextRequests) => {
        setRequests(nextRequests);
        setIsRequestsLoading(false);
      },
      (error) => {
        setPanelError(error.message);
        setIsRequestsLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    return subscribeToAllAdminPayments(
      (nextPayments) => {
        setPayments(nextPayments);
        setIsPaymentsLoading(false);
      },
      (error) => {
        setPanelError(error.message);
        setIsPaymentsLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    setRequestNotes((current) => {
      const next = { ...current };

      requests.forEach((request) => {
        if (typeof next[request.id] !== "string") {
          next[request.id] = request.reviewerNote || "";
        }
      });

      return next;
    });
  }, [requests]);

  const normalizedProfileMap = useMemo(() => {
    return new Map(
      profiles.map((profile) => [normalizeEmail(profile.authEmail), profile]),
    );
  }, [profiles]);

  const approvedAdminsWithProfiles = useMemo(
    () =>
      adminApprovals.map((approval) => ({
        approval,
        profile: normalizedProfileMap.get(normalizeEmail(approval.email)) ?? null,
      })),
    [adminApprovals, normalizedProfileMap],
  );

  const profileCompletionCount = approvedAdminsWithProfiles.filter(
    ({ profile }) => getAdminProfileCompletion(profile).completedSections === 6,
  ).length;
  const pendingRequests = requests.filter((request) => request.status === "pending");

  async function handleStatusUpdate(
    request: AdminRequestRecord,
    status: AdminRequestStatus,
  ) {
    setUpdatingRequestId(request.id);
    setPanelError(null);

    try {
      await updateAdminRequestStatus(
        request.id,
        status,
        reviewerEmail,
        requestNotes[request.id] || "",
      );
    } catch (error) {
      setPanelError(
        error instanceof Error
          ? error.message
          : "We could not update this request right now.",
      );
    } finally {
      setUpdatingRequestId(null);
    }
  }

  function handleProfileDraftFieldChange(
    uid: string,
    updater: (draft: AdminWorkspaceProfile) => AdminWorkspaceProfile,
  ) {
    setProfileDrafts((current) => {
      const existing = current[uid];
      if (!existing) {
        return current;
      }

      return {
        ...current,
        [uid]: updater(existing),
      };
    });
  }

  async function handleSaveSuperControls(uid: string) {
    const draft = profileDrafts[uid];

    if (!draft) {
      return;
    }

    setSavingProfileUid(uid);
    setPanelError(null);

    try {
      await saveAdminWorkspaceProfileByUid(uid, draft.authEmail, draft);
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "We could not save these super controls right now.");
    } finally {
      setSavingProfileUid(null);
    }
  }

  async function handleReleasePayment(uid: string, adminEmail: string) {
    const draft = paymentDrafts[uid];

    if (!draft?.paymentMonth || !draft.amount) {
      setPanelError("Payment month and amount are required before releasing a payment.");
      return;
    }

    setReleasingPaymentUid(uid);
    setPanelError(null);

    try {
      await releaseAdminPayment({
        uid,
        adminEmail,
        paymentMonth: draft.paymentMonth,
        amount: draft.amount,
        currency: draft.currency || "PKR",
        note: draft.note,
        releasedByEmail: reviewerEmail,
      });

      setPaymentDrafts((current) => ({
        ...current,
        [uid]: { paymentMonth: "", amount: "", currency: draft.currency || "PKR", note: "" },
      }));
    } catch (error) {
      setPanelError(error instanceof Error ? error.message : "We could not release this payment right now.");
    } finally {
      setReleasingPaymentUid(null);
    }
  }

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <WorkspaceMetricCard
          label="Approved admins"
          value={String(adminApprovals.length).padStart(2, "0")}
          hint="Approved admin emails currently allowed into the admin portal."
        />
        <WorkspaceMetricCard
          label="Profile complete"
          value={String(profileCompletionCount).padStart(2, "0")}
          hint="Admins who completed all required employee profile sections."
        />
        <WorkspaceMetricCard
          label="Requests"
          value={String(requests.length).padStart(2, "0")}
          hint="Leave and compensation requests submitted by approved admins."
        />
        <WorkspaceMetricCard
          label="Pending review"
          value={String(pendingRequests.length).padStart(2, "0")}
          hint="Requests still waiting for a super admin decision."
        />
      </section>

      {panelError ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          {panelError}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-3">
        {(["profiles", "requests"] as AdminOpsTab[]).map((tab) => {
          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={[
                "rounded-full border px-5 py-3 text-sm font-semibold transition",
                isActive
                  ? "border-slate-300 bg-panelStrong text-ink"
                  : "border-slate-200 bg-white text-muted hover:bg-panelStrong hover:text-ink",
              ].join(" ")}
            >
              {tab === "profiles" ? "Profiles" : "Requests"}
            </button>
          );
        })}
      </div>

      {activeTab === "profiles" ? (
        <section className="space-y-4">
          {isProfilesLoading ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
              Loading admin profiles...
            </div>
          ) : approvedAdminsWithProfiles.length === 0 ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
              No approved admins yet.
            </div>
          ) : (
            approvedAdminsWithProfiles.map(({ approval, profile }) => {
              const completion = getAdminProfileCompletion(profile);
              const editableProfile = profile ? (profileDrafts[profile.uid] ?? profile) : null;
              const profilePayments = payments.filter((payment) => payment.uid === profile?.uid).slice(0, 6);
              const documentStatus: Array<{ label: string; url: string }> = profile?.documents
                ? [
                    profile.documents.cnicFront
                      ? { label: "CNIC front", url: profile.documents.cnicFront.fileUrl }
                      : null,
                    profile.documents.cnicBack
                      ? { label: "CNIC back", url: profile.documents.cnicBack.fileUrl }
                      : null,
                    profile.documents.bankProof
                      ? { label: "Bank proof", url: profile.documents.bankProof.fileUrl }
                      : null,
                    profile.documents.signedContract
                      ? { label: "Contract", url: profile.documents.signedContract.fileUrl }
                      : null,
                  ].filter((item): item is { label: string; url: string } => Boolean(item))
                : [];
              const signedPolicies: string[] = profile?.policyDocuments
                ? [
                    profile.policyDocuments.codeOfConductSigned ? "Code of conduct" : null,
                    profile.policyDocuments.confidentialityAgreementSigned ? "Confidentiality" : null,
                    profile.policyDocuments.dataProtectionPolicySigned ? "Data protection" : null,
                    profile.policyDocuments.acceptableUsePolicySigned ? "Acceptable use" : null,
                    profile.policyDocuments.payrollPolicySigned ? "Payroll policy" : null,
                  ].filter((item): item is string => Boolean(item))
                : [];

              return (
                <details
                  key={approval.id}
                  className="group rounded-[1.15rem] border border-slate-200 bg-white px-5 py-4 shadow-panel"
                >
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-ink">
                          {profile?.identity.fullName || approval.contactName || approval.email}
                        </p>
                        <p className="mt-1 truncate text-sm text-muted">{approval.email}</p>
                        <p className="mt-1 truncate text-xs text-muted">
                          {[profile?.identity.roleTitle, profile?.identity.department || approval.company]
                            .filter(Boolean)
                            .join(" - ") || "Admin record"}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                          {completion.completedSections}/{completion.totalSections} sections
                        </span>
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-900">
                          {approval.status}
                        </span>
                        <span className="text-sm text-muted transition group-open:rotate-180">v</span>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-4">
                      <div className="rounded-[0.9rem] border border-slate-200 bg-panelStrong px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Department</p>
                        <p className="mt-1 truncate text-sm font-semibold text-ink">
                          {profile?.identity.department || "Not added"}
                        </p>
                      </div>
                      <div className="rounded-[0.9rem] border border-slate-200 bg-panelStrong px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Role title</p>
                        <p className="mt-1 truncate text-sm font-semibold text-ink">
                          {profile?.identity.roleTitle || "Not added"}
                        </p>
                      </div>
                      <div className="rounded-[0.9rem] border border-slate-200 bg-panelStrong px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Employee ID</p>
                        <p className="mt-1 truncate text-sm font-semibold text-ink">
                          {profile?.identity.employeeId || "Not added"}
                        </p>
                      </div>
                      <div className="rounded-[0.9rem] border border-slate-200 bg-panelStrong px-4 py-3">
                        <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Payroll ready</p>
                        <p className="mt-1 truncate text-sm font-semibold text-ink">
                          {profile?.bankPayroll.iban && profile?.bankPayroll.bankName ? "Yes" : "No"}
                        </p>
                      </div>
                    </div>
                  </summary>

                  <div className="mt-5 border-t border-slate-200 pt-5">

                  <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                    <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Allowed services</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {approval.servicePermissions.map((permission) => {
                          const service = servicePages.find((item) => item.slug === permission);

                          return (
                            <span
                              key={permission}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink"
                            >
                              {service?.title || permission}
                            </span>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Documents uploaded</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {documentStatus.length > 0 ? (
                          documentStatus.map((item) => (
                            <a
                              key={item.label}
                              href={item.url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 transition hover:bg-emerald-100"
                            >
                              {item.label}
                            </a>
                          ))
                        ) : (
                          <span className="text-sm text-muted">No documents uploaded yet.</span>
                        )}
                      </div>
                    </div>

                    <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Policies signed</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {signedPolicies.length > 0 ? (
                          signedPolicies.map((item) => (
                            <span
                              key={item}
                              className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-900"
                            >
                              {item}
                            </span>
                          ))
                        ) : (
                          <span className="text-sm text-muted">No policy confirmations yet.</span>
                        )}
                      </div>
                      {profile?.policyDocuments.signedAt ? (
                        <p className="mt-3 text-xs text-muted">
                          Confirmed on {profile.policyDocuments.signedAt}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {completion.missingRequirements.length > 0 ? (
                    <div className="mt-5 rounded-[1rem] border border-amber-200 bg-amber-50 px-4 py-4">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-amber-950">
                        Missing requirements
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {completion.missingRequirements.map((item) => (
                          <span
                            key={item}
                            className="rounded-full border border-amber-200 bg-white px-3 py-1 text-xs font-semibold text-amber-950"
                          >
                            {item}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {editableProfile ? (
                    <div className="mt-5 grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
                      <section className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">
                            Super controls
                          </p>
                          <button
                            type="button"
                            onClick={() => void handleSaveSuperControls(editableProfile.uid)}
                            disabled={savingProfileUid === editableProfile.uid}
                            className="rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:bg-panelStrong disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingProfileUid === editableProfile.uid ? "Saving..." : "Save"}
                          </button>
                        </div>

                        <div className="mt-4 grid gap-4 sm:grid-cols-2">
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Payroll cycle</span>
                            <input
                              value={editableProfile.bankPayroll.payrollCycle}
                              onChange={(event) =>
                                handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                  ...draft,
                                  bankPayroll: { ...draft.bankPayroll, payrollCycle: event.target.value },
                                }))
                              }
                              className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Salary currency</span>
                            <input
                              value={editableProfile.bankPayroll.salaryCurrency}
                              onChange={(event) =>
                                handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                  ...draft,
                                  bankPayroll: { ...draft.bankPayroll, salaryCurrency: event.target.value },
                                }))
                              }
                              className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                            />
                          </label>
                          <label className="block">
                            <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Base salary</span>
                            <input
                              value={editableProfile.bankPayroll.baseSalary}
                              onChange={(event) =>
                                handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                  ...draft,
                                  bankPayroll: { ...draft.bankPayroll, baseSalary: event.target.value },
                                }))
                              }
                              className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                            />
                          </label>
                          <label className="flex items-center gap-3 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink">
                            <input
                              type="checkbox"
                              checked={editableProfile.bankPayroll.bonusEligible}
                              onChange={(event) =>
                                handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                  ...draft,
                                  bankPayroll: { ...draft.bankPayroll, bonusEligible: event.target.checked },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            Bonus eligible
                          </label>
                          <label className="flex items-center gap-3 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink sm:col-span-2">
                            <input
                              type="checkbox"
                              checked={editableProfile.bankPayroll.commissionEligible}
                              onChange={(event) =>
                                handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                  ...draft,
                                  bankPayroll: { ...draft.bankPayroll, commissionEligible: event.target.checked },
                                }))
                              }
                              className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                            />
                            Commission eligible
                          </label>
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Policy controls</p>
                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            {[
                              ["codeOfConductSigned", "Code of conduct"],
                              ["confidentialityAgreementSigned", "Confidentiality agreement"],
                              ["dataProtectionPolicySigned", "Data protection policy"],
                              ["acceptableUsePolicySigned", "Acceptable use policy"],
                              ["payrollPolicySigned", "Payroll policy"],
                            ].map(([key, label]) => (
                              <label key={key} className="flex items-center gap-3 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-ink">
                                <input
                                  type="checkbox"
                                  checked={Boolean(editableProfile.policyDocuments[key as keyof typeof editableProfile.policyDocuments])}
                                  onChange={(event) =>
                                    handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                      ...draft,
                                      policyDocuments: {
                                        ...draft.policyDocuments,
                                        [key]: event.target.checked,
                                      },
                                    }))
                                  }
                                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                                />
                                {label}
                              </label>
                            ))}
                            <label className="block sm:col-span-2">
                              <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Signed / confirmed date</span>
                              <input
                                type="date"
                                value={editableProfile.policyDocuments.signedAt}
                                onChange={(event) =>
                                  handleProfileDraftFieldChange(editableProfile.uid, (draft) => ({
                                    ...draft,
                                    policyDocuments: { ...draft.policyDocuments, signedAt: event.target.value },
                                  }))
                                }
                                className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                              />
                            </label>
                          </div>
                        </div>
                      </section>

                      <section className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Release payment</p>
                        <div className="mt-4 space-y-3">
                          <input
                            value={paymentDrafts[editableProfile.uid]?.paymentMonth ?? ""}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [editableProfile.uid]: {
                                  paymentMonth: event.target.value,
                                  amount: current[editableProfile.uid]?.amount ?? "",
                                  currency: current[editableProfile.uid]?.currency ?? (editableProfile.bankPayroll.salaryCurrency || "PKR"),
                                  note: current[editableProfile.uid]?.note ?? "",
                                },
                              }))
                            }
                            placeholder="2026-04"
                            className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                          />
                          <input
                            value={paymentDrafts[editableProfile.uid]?.amount ?? ""}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [editableProfile.uid]: {
                                  paymentMonth: current[editableProfile.uid]?.paymentMonth ?? "",
                                  amount: event.target.value,
                                  currency: current[editableProfile.uid]?.currency ?? (editableProfile.bankPayroll.salaryCurrency || "PKR"),
                                  note: current[editableProfile.uid]?.note ?? "",
                                },
                              }))
                            }
                            placeholder="Amount"
                            className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                          />
                          <textarea
                            value={paymentDrafts[editableProfile.uid]?.note ?? ""}
                            onChange={(event) =>
                              setPaymentDrafts((current) => ({
                                ...current,
                                [editableProfile.uid]: {
                                  paymentMonth: current[editableProfile.uid]?.paymentMonth ?? "",
                                  amount: current[editableProfile.uid]?.amount ?? "",
                                  currency: current[editableProfile.uid]?.currency ?? (editableProfile.bankPayroll.salaryCurrency || "PKR"),
                                  note: event.target.value,
                                },
                              }))
                            }
                            rows={3}
                            placeholder="Optional payment note"
                            className="w-full rounded-[0.9rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                          />
                          <button
                            type="button"
                            onClick={() => void handleReleasePayment(editableProfile.uid, approval.email)}
                            disabled={releasingPaymentUid === editableProfile.uid}
                            className="inline-flex w-full items-center justify-center rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {releasingPaymentUid === editableProfile.uid ? "Releasing..." : "Release payment"}
                          </button>
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Recent payment history</p>
                          {isPaymentsLoading ? (
                            <div className="mt-3 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-muted">Loading payments...</div>
                          ) : profilePayments.length === 0 ? (
                            <div className="mt-3 rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3 text-sm text-muted">No payments released yet.</div>
                          ) : (
                            <div className="mt-3 space-y-2">
                              {profilePayments.map((payment) => (
                                <div key={payment.id} className="rounded-[0.9rem] border border-slate-200 bg-white px-4 py-3">
                                  <p className="text-sm font-semibold text-ink">{payment.currency} {payment.amount} • {payment.paymentMonth}</p>
                                  <p className="mt-1 text-xs text-muted">{payment.note || "No note"} • {payment.releasedByEmail}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </section>
                    </div>
                  ) : null}
                  </div>
                </details>
              );
            })
          )}
        </section>
      ) : (
        <section className="space-y-4">
          {isRequestsLoading ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
              Loading admin requests...
            </div>
          ) : requests.length === 0 ? (
            <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4 text-sm text-muted">
              No admin requests submitted yet.
            </div>
          ) : (
            requests.map((request) => (
              <article
                key={request.id}
                className="rounded-[1.5rem] border border-slate-200 bg-white p-6"
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.22em] text-muted">
                      {request.category === "leave"
                        ? "Leave request"
                        : "Compensation request"}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold text-ink">
                      {request.title || request.requestType || "Request"}
                    </h2>
                    <p className="mt-2 text-sm text-muted">
                      {request.requesterName || request.requesterEmail}
                    </p>
                    <p className="mt-1 text-sm text-muted">{request.requesterEmail}</p>
                  </div>

                  <RequestStatusBadge status={request.status} />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Request type</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {request.requestType || "Not added"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Dates / range</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {[request.startDate, request.endDate].filter(Boolean).join(" - ") || "Not added"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Days / amount</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {request.category === "leave"
                        ? request.daysRequested || "Not added"
                        : request.amountRequested
                          ? `${request.currency} ${request.amountRequested}`
                          : "Not added"}
                    </p>
                  </div>
                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Reviewed by</p>
                    <p className="mt-2 text-sm font-semibold text-ink">
                      {request.reviewedByEmail || "Not reviewed yet"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                  <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Request details</p>
                  <p className="mt-2 text-sm leading-7 text-ink">
                    {request.description || "No description added."}
                  </p>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
                  <div className="rounded-[1rem] border border-slate-200 bg-white px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Reviewer note</p>
                    <textarea
                      rows={4}
                      value={requestNotes[request.id] ?? ""}
                      onChange={(event) =>
                        setRequestNotes((current) => ({
                          ...current,
                          [request.id]: event.target.value,
                        }))
                      }
                      className="mt-3 w-full rounded-[1rem] border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                      placeholder="Add internal reviewer notes for this request."
                    />
                  </div>

                  <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-muted">Update status</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {adminRequestStatusOptions.map((status) => {
                        const isActive = request.status === status;

                        return (
                          <button
                            key={status}
                            type="button"
                            onClick={() => void handleStatusUpdate(request, status)}
                            disabled={updatingRequestId === request.id}
                            className={[
                              "rounded-full border px-4 py-2 text-sm font-semibold transition",
                              isActive
                                ? "border-slate-300 bg-white text-ink"
                                : "border-slate-200 bg-panelStrong text-muted hover:bg-white hover:text-ink",
                            ].join(" ")}
                          >
                            {updatingRequestId === request.id && request.status === status
                              ? "Updating..."
                              : status}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      )}
    </div>
  );
}
