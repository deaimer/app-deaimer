"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  User,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { normalizeEmail } from "@/lib/auth/access-control";
import {
  addSuperAdmin,
  removeSuperAdmin,
  subscribeSuperAdminStatus,
  subscribeToSuperAdmins,
  type SuperAccessRecord,
} from "@/lib/firebase/super-access";
import {
  type AdminApprovalInput,
  type AdminApprovalRecord,
  emptyAdminAccessProfileDefaults,
  deleteAdminApproval,
  saveAdminApproval,
  subscribeToAdminApprovals,
} from "@/lib/firebase/admin-access";
import {
  ClientApprovalInput,
  ClientApprovalRecord,
  ClientApprovalPerson,
  deleteClientApproval,
  saveClientApproval,
  subscribeToClientApprovals,
} from "@/lib/firebase/client-access";
import { generateTempPassword } from "@/lib/utils/password";
import {
  ensureFirebaseAuthPersistence,
  getFirebaseClientServices,
  getFirebaseConfigError,
  isFirebaseConfigured,
  resolveFirebaseRedirectSignIn,
  signInWithGoogle,
} from "@/lib/firebase/client";
import { SuperAdminTeamPanel } from "@/components/super-admin-team-panel";
import { servicePages } from "@/lib/service-pages";
import {
  deleteGlobalWorkforcePartner,
  emptyGlobalWorkforcePartnerDraft,
  saveGlobalWorkforcePartner,
  subscribeToGlobalWorkforcePartners,
  type GlobalWorkforcePartner,
  type GlobalWorkforcePartnerDraft,
} from "@/lib/firebase/global-workforce-partners";
import {
  deleteLeadershipMember,
  emptyLeadershipMemberDraft,
  saveLeadershipMember,
  subscribeToLeadershipMembers,
  type CompanyLeadershipMember,
  type CompanyLeadershipMemberDraft,
} from "@/lib/firebase/company-leadership";
import {
  deleteCareerOpening,
  emptyCareerOpeningDraft,
  saveCareerOpening,
  subscribeToCareerOpenings,
  type CareerOpening,
  type CareerOpeningDraft,
} from "@/lib/firebase/careers-openings";
import {
  adminEmploymentStatusOptions,
  adminEmploymentTypeOptions,
  adminPayrollCycleOptions,
  type AdminBankPayrollDraft,
  type AdminIdentityDraft,
  type AdminPolicyDocumentsDraft,
} from "@/lib/firebase/admin-workspace";
import {
  DeaimerSiteShell,
  type PlatformSideMenuItem,
} from "@/components/deaimer-site-shell";
import {
  normalizeGlobalWorkforceJobReferenceLinks,
  replaceGlobalWorkforceJobReferenceLinks,
} from "@/lib/firebase/global-workforce-jobs";
import {
  GlobalWorkforceAdminPanel,
  type GlobalWorkforceAdminSection,
} from "@/components/global-workforce-admin-panel";
import { PlatformAuthPage } from "@/components/platform-auth-page";
import {
  DataCollectionAdminPanel,
  type DCAdminSection,
} from "@/components/data-collection-admin-panel";
import {
  EvalTranscriptionPanel,
  type EvalTranscriptionSection,
} from "@/components/eval-transcription-panel";
import { CrowdWorkAdminPanel } from "@/components/crowd-work-admin-panel";

type SuperView = "overview" | "access" | "team" | "workforce" | "company" | "careers" | "data-collection" | "evaluation-transcription" | "crowd-work";
type AccessTarget = "company" | "admin" | "super";
type AccessMode = "list" | "new" | "edit";
type AdminDefaultsTab = "basics" | "services" | "role" | "pay" | "policies";
type SuperWorkforceSection = "partners" | Extract<GlobalWorkforceAdminSection, "job-posts" | "crowd-projects" | "crowd" | "candidates" | "signups" | "commissions" | "data">;
type EmailMode = "signup" | "signin";

interface AccessPanelCopy {
  addLabel: string;
  title: string;
  description: string;
  emailLabel: string;
  emailPlaceholder: string;
  listLabel: string;
  listTitle: string;
  emptyLabel: string;
  buttonLabel: string;
  savingLabel: string;
  successLabel: string;
}

interface ApprovalRecordView {
  id: string;
  email: string;
  company: string;
  contactName: string;
  notes: string;
  people?: ClientApprovalPerson[];
  status: "approved";
  servicePermissions?: string[];
}

type ApprovalDraft = ClientApprovalInput & {
  servicePermissions: string[];
  people: ClientApprovalPerson[];
  profileDefaults: {
    identity: Pick<
      AdminIdentityDraft,
      | "employeeId"
      | "department"
      | "subDepartment"
      | "roleTitle"
      | "managerName"
      | "managerEmail"
      | "dateOfJoining"
      | "employmentType"
      | "employmentStatus"
    >;
    bankPayroll: Pick<
      AdminBankPayrollDraft,
      | "payrollCycle"
      | "salaryCurrency"
      | "baseSalary"
      | "bonusEligible"
      | "commissionEligible"
    >;
    policyDocuments: AdminPolicyDocumentsDraft;
  };
};

const emptyApprovalForm: ApprovalDraft = {
  email: "",
  company: "",
  contactName: "",
  notes: "",
  servicePermissions: [],
  people: [],
  profileDefaults: emptyAdminAccessProfileDefaults(),
};

const emptyEmailForm = {
  email: "",
  password: "",
  confirmPassword: "",
};

function createAdminEmployeeId(existingIds: string[]) {
  const usedIds = new Set(existingIds);

  for (let attempt = 0; attempt < 100000; attempt += 1) {
    const candidate = String(Math.floor(Math.random() * 100000)).padStart(5, "0");

    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  for (let value = 0; value <= 99999; value += 1) {
    const candidate = String(value).padStart(5, "0");

    if (!usedIds.has(candidate)) {
      return candidate;
    }
  }

  throw new Error("All 5-digit employee IDs are already in use.");
}

function createApprovalFormWithEmployeeId(existingIds: string[]): ApprovalDraft {
  return {
    ...emptyApprovalForm,
    profileDefaults: {
      ...emptyAdminAccessProfileDefaults(),
      identity: {
        ...emptyAdminAccessProfileDefaults().identity,
        employeeId: createAdminEmployeeId(existingIds),
      },
    },
  };
}

const departmentOptions = [
  {
    name: "Delivery Operations",
    subdepartments: [
      "Data Collection",
      "Annotation & Gen AI",
      "Evaluation & Transcription",
      "Global Managed Workforce",
    ],
  },
  {
    name: "Growth & Client Success",
    subdepartments: ["Sales", "Client onboarding", "Client relations"],
  },
  {
    name: "Platform & Admin",
    subdepartments: ["Product & Tech", "HR", "Finance", "Compliance"],
  },
];

const accessPanelCopy: Record<AccessTarget, AccessPanelCopy> = {
  company: {
    addLabel: "Add company",
    title: "Approve access",
    description:
      "Approve company access to the client portal. Add a company name and the primary admin who will manage it.",
    emailLabel: "Primary admin email",
    emailPlaceholder: "admin@clientcompany.com",
    listLabel: "Approved companies",
    listTitle: "Current company allowlist",
    emptyLabel: "No companies have been approved yet.",
    buttonLabel: "Approve company",
    savingLabel: "Saving company...",
    successLabel: "is now approved.",
  },
  admin: {
    addLabel: "Add admin access",
    title: "Approve access",
    description:
      "Approve portal emails, manage saved access records, and keep admin entry permissions tidy from one workspace.",
    emailLabel: "Admin email",
    emailPlaceholder: "admin@deaimer.com",
    listLabel: "Approved admins",
    listTitle: "Current admin allowlist",
    emptyLabel: "No admins have been approved yet.",
    buttonLabel: "Approve admin",
    savingLabel: "Saving admin approval...",
    successLabel: "is now approved for the admin portal.",
  },
  super: {
    addLabel: "Add super admin",
    title: "Approve access",
    description:
      "Approve portal emails, manage saved access records, and keep client, company, and super admin permissions tidy from one workspace.",
    emailLabel: "Super admin email",
    emailPlaceholder: "leader@deaimer.com",
    listLabel: "Approved super admins",
    listTitle: "Current super admin allowlist",
    emptyLabel: "No super admins have been approved yet.",
    buttonLabel: "Approve super admin",
    savingLabel: "Saving super admin...",
    successLabel: "is now approved for the super admin portal.",
  },
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5">
      <path
        fill="#EA4335"
        d="M12.23 10.29v3.95h5.49c-.22 1.27-1.72 3.73-5.49 3.73-3.31 0-6.01-2.74-6.01-6.12s2.7-6.12 6.01-6.12c1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 6.72 2 2.25 6.48 2.25 12s4.47 10 9.98 10c5.76 0 9.58-4.05 9.58-9.75 0-.66-.07-1.17-.16-1.68h-9.42Z"
      />
      <path
        fill="#FBBC05"
        d="M3.4 7.35 6.65 9.7c.88-2.6 3.33-4.47 6.58-4.47 1.89 0 3.15.81 3.87 1.5l2.64-2.56C17.05 3.1 14.89 2 12.23 2 8.39 2 5.07 4.18 3.4 7.35Z"
      />
      <path
        fill="#34A853"
        d="M12.23 22c2.58 0 4.75-.85 6.34-2.31l-2.93-2.4c-.79.55-1.82.93-3.41.93-3.69 0-6.82-2.49-7.94-5.84L1.03 14.9C2.68 19.13 7.03 22 12.23 22Z"
      />
      <path
        fill="#4285F4"
        d="M21.81 12.25c0-.66-.07-1.17-.16-1.68h-9.42v3.95h5.49c-.26 1.39-1.09 2.57-2.08 3.3l2.93 2.4c1.71-1.58 3.24-4.67 3.24-7.97Z"
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

function WorkspaceHero({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-primary to-primaryStrong px-8 py-10 sm:px-10 sm:py-12">
      <div className="relative z-10">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/60">
          {eyebrow}
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-white sm:text-4xl">{title}</h1>
        <p className="mt-3 max-w-lg text-sm leading-7 text-white/75">{description}</p>
        {actions ? <div className="mt-6 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
      <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-8 right-16 h-32 w-32 rounded-full bg-white/5" />
    </section>
  );
}

function WorkspaceMetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white px-5 py-5">
      <p className="text-[11px] font-medium uppercase tracking-widest text-muted/60">{label}</p>
      <p className="mt-2.5 text-4xl font-light tabular-nums tracking-tight text-ink">{value}</p>
      <p className="mt-2 text-xs leading-5 text-muted">{detail}</p>
    </article>
  );
}

function WorkspaceOpenCard({
  label,
  body,
  onClick,
}: {
  label: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-slate-200 bg-white p-5 text-left transition hover:border-primary/25 hover:bg-[#f9fbff]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-ink">{label}</p>
          <p className="mt-2 text-sm leading-7 text-muted">{body}</p>
        </div>
        <span className="shrink-0 text-lg text-muted/40">→</span>
      </div>
    </button>
  );
}

function OverviewPanel({
  approvedClientCount,
  approvedAdminCount,
  superAdmins,
  activeUserEmail,
  reviewerName,
  onOpenAdmins,
  onOpenClients,
  onOpenTeam,
  onAddSuperAdmin,
  onRemoveSuperAdmin,
  isSavingSuperAdmin,
  removingSuperEmail,
}: {
  approvedClientCount: number;
  approvedAdminCount: number;
  superAdmins: SuperAccessRecord[];
  activeUserEmail: string;
  reviewerName: string;
  onOpenAdmins: () => void;
  onOpenClients: () => void;
  onOpenTeam: () => void;
  onAddSuperAdmin: (email: string) => Promise<void>;
  onRemoveSuperAdmin: (email: string) => Promise<void>;
  isSavingSuperAdmin: boolean;
  removingSuperEmail: string | null;
}) {
  const [newSuperEmail, setNewSuperEmail] = useState("");

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const trimmed = newSuperEmail.trim();
    if (!trimmed) return;
    await onAddSuperAdmin(trimmed);
    setNewSuperEmail("");
  }

  const overviewCards = [
    {
      label: "Approved companies",
      value: String(approvedClientCount).padStart(2, "0"),
      detail: "Companies approved to access the client portal.",
    },
    {
      label: "Approved companies",
      value: String(approvedAdminCount).padStart(2, "0"),
      detail: "Google accounts cleared to sign in to the company portal.",
    },
    {
      label: "Super admins",
      value: String(superAdmins.length).padStart(2, "0"),
      detail: "Protected Google accounts with access to the control panel.",
    },
    {
      label: "Service controls",
      value: String(servicePages.length).padStart(2, "0"),
      detail: "Deaimer services that can be granted to approved companies.",
    },
  ];

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Home"
        title={`Welcome back, ${reviewerName}`}
        description="This dashboard gives you a quick summary of Deaimer control access so you can jump straight into approvals, admin permissions, and internal team review."
        actions={
          <>
            <button
              type="button"
              onClick={onOpenAdmins}
              className="inline-flex items-center justify-center rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-white/20"
            >
              Manage companies
            </button>
            <button
              type="button"
              onClick={onOpenTeam}
              className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90"
            >
              Review team
            </button>
          </>
        }
      />

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {overviewCards.map((card) => (
          <WorkspaceMetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            detail={card.detail}
          />
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <WorkspaceOpenCard
          label="Company"
          body="Approve companies and their primary admin to access the client portal."
          onClick={onOpenClients}
        />
        <WorkspaceOpenCard
          label="Company"
          body="Approve company access and decide exactly which Deaimer services each company can work with."
          onClick={onOpenAdmins}
        />
        <WorkspaceOpenCard
          label="Team"
          body="Review admin profile completion, payroll readiness, signed policies, and internal requests."
          onClick={onOpenTeam}
        />
      </section>

      <section className="rounded-[1.35rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Protected access
            </p>
            <p className="mt-2 text-lg font-semibold text-ink">Super admins</p>
          </div>
          <span className="rounded-full bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
            Live
          </span>
        </div>
        <div className="mt-4 space-y-2">
          {superAdmins.map((sa) => (
            <div key={sa.email} className="flex items-center justify-between gap-3 rounded-[0.75rem] border border-slate-100 bg-panelStrong px-4 py-2.5">
              <span className="text-xs font-semibold text-ink">{sa.email}</span>
              {sa.email !== activeUserEmail ? (
                <button
                  type="button"
                  onClick={() => void onRemoveSuperAdmin(sa.email)}
                  disabled={removingSuperEmail === sa.email || isSavingSuperAdmin}
                  className="rounded-full border border-rose-200 bg-white px-3 py-1 text-[11px] font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  {removingSuperEmail === sa.email ? "Removing…" : "Remove"}
                </button>
              ) : (
                <span className="rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">You</span>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={(e) => void handleAdd(e)} className="mt-4 flex gap-2">
          <input
            type="email"
            value={newSuperEmail}
            onChange={(e) => setNewSuperEmail(e.target.value)}
            placeholder="Add super admin email…"
            disabled={isSavingSuperAdmin}
            className="h-9 flex-1 rounded-full border border-slate-300 bg-white px-4 text-xs text-ink outline-none transition placeholder:text-muted/50 focus:border-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!newSuperEmail.trim() || isSavingSuperAdmin}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-full bg-primary px-4 text-xs font-semibold text-white transition hover:bg-primaryStrong disabled:opacity-50"
          >
            {isSavingSuperAdmin ? (
              <>
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Adding
              </>
            ) : "Add"}
          </button>
        </form>
      </section>
    </div>
  );
}

interface AccessPanelProps {
  target: AccessTarget;
  accessMode: AccessMode;
  approvals: ApprovalRecordView[];
  draft: ApprovalDraft;
  isSaving: boolean;
  isLoading: boolean;
  message: string | null;
  error: string | null;
  superAdmins: SuperAccessRecord[];
  activeUserEmail: string;
  superAdminError: string | null;
  isSavingSuperAdmin: boolean;
  removingSuperEmail: string | null;
  editingAdminEmail: string | null;
  deletingAdminEmail: string | null;
  deletingCompanyEmail: string | null;
  onTargetChange: (target: AccessTarget) => void;
  onAccessModeChange: (mode: AccessMode) => void;
  onAddApproval: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  onAdminDefaultChange: (
    section: keyof ApprovalDraft["profileDefaults"],
    field: string,
    value: string | boolean,
  ) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onToggleServicePermission: (slug: string) => void;
  onEditAdmin: (approval: AdminApprovalRecord) => void;
  onDeleteAdmin: (approval: AdminApprovalRecord) => void;
  onEditCompany: (approval: ApprovalRecordView) => void;
  onDeleteCompany: (approval: ApprovalRecordView) => void;
  onPeopleChange: (people: ClientApprovalPerson[]) => void;
  onAddPerson: (name: string, email: string, tempPassword: string) => Promise<void>;
  onCancelAdminEdit: () => void;
  onAddSuperAdmin: (email: string) => Promise<void>;
  onRemoveSuperAdmin: (email: string) => Promise<void>;
}

function AccessPanel({
  target,
  accessMode,
  approvals,
  draft,
  isSaving,
  isLoading,
  message,
  error,
  superAdmins,
  activeUserEmail,
  superAdminError,
  isSavingSuperAdmin,
  removingSuperEmail,
  editingAdminEmail,
  deletingAdminEmail,
  deletingCompanyEmail,
  onTargetChange,
  onAccessModeChange,
  onAddApproval,
  onChange,
  onAdminDefaultChange,
  onSubmit,
  onToggleServicePermission,
  onEditAdmin,
  onDeleteAdmin,
  onEditCompany,
  onDeleteCompany,
  onPeopleChange,
  onAddPerson,
  onCancelAdminEdit,
  onAddSuperAdmin,
  onRemoveSuperAdmin,
}: AccessPanelProps) {
  const copy = accessPanelCopy[target];
  const isEditingAdmin = accessMode === "edit" && target === "admin" && Boolean(editingAdminEmail);
  const isSuperTarget = target === "super";
  const [newSuperEmail, setNewSuperEmail] = useState("");
  const [superAccessMessage, setSuperAccessMessage] = useState<string | null>(null);
  const [personDraft, setPersonDraft] = useState({ name: "", email: "" });
  const [personTempPassword, setPersonTempPassword] = useState<string | null>(null);
  const [isAddingPerson, setIsAddingPerson] = useState(false);
  const [personAddError, setPersonAddError] = useState<string | null>(null);
  const selectedDepartment = departmentOptions.find(
    (department) => department.name === draft.profileDefaults.identity.department,
  ) ?? departmentOptions[0];
  const [activeAdminDefaultsTab, setActiveAdminDefaultsTab] = useState<AdminDefaultsTab>("basics");
  const formTabs: Array<{
    id: AdminDefaultsTab;
    label: string;
    hint: string;
  }> = (target === "admin" ? [
    {
      id: "basics",
      label: "Basics",
      hint: "Email, organization, contact, and notes.",
    },
    {
      id: "services",
      label: "Service access",
      hint: "Choose what this admin can open.",
    },
    {
      id: "role",
      label: "Role setup",
      hint: "Identity, reporting, and employment basics.",
    },
    {
      id: "pay",
      label: "Pay rules",
      hint: "Payroll cycle, salary, bonus, and commission.",
    },
    {
      id: "policies",
      label: "Policy signoffs",
      hint: "Internal agreement and policy confirmations.",
    },
  ] : [
    {
      id: "basics",
      label: "Basics",
      hint: "Email, organization, contact, and notes.",
    },
  ]);

  useEffect(() => {
    setActiveAdminDefaultsTab("basics");
    setNewSuperEmail("");
    setSuperAccessMessage(null);
    setPersonDraft({ name: "", email: "" });
    setPersonTempPassword(null);
    setPersonAddError(null);
  }, [target, accessMode]);

  async function handleAddPerson() {
    const email = personDraft.email.trim().toLowerCase();
    if (!email || !personTempPassword) return;
    if (draft.people.some((p) => p.email === email)) return;
    setIsAddingPerson(true);
    setPersonAddError(null);
    try {
      await onAddPerson(personDraft.name.trim(), email, personTempPassword);
      onPeopleChange([
        ...draft.people,
        { name: personDraft.name.trim(), email, tempPassword: personTempPassword, tempPasswordHash: "", passwordUpdated: false, active: false },
      ]);
      setPersonDraft({ name: "", email: "" });
      setPersonTempPassword(null);
    } catch (err) {
      setPersonAddError(err instanceof Error ? err.message : "Could not create person account.");
    } finally {
      setIsAddingPerson(false);
    }
  }

  function handleRemovePerson(email: string) {
    onPeopleChange(draft.people.filter((p) => p.email !== email));
  }

  async function handleSuperAdminSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(newSuperEmail);

    if (!normalizedEmail) {
      return;
    }

    await onAddSuperAdmin(normalizedEmail);
    setSuperAccessMessage(`${normalizedEmail} is now approved for /super.`);
    setNewSuperEmail("");
  }

  async function handleRemoveSuperAdmin(email: string) {
    await onRemoveSuperAdmin(email);
    setSuperAccessMessage(`${email} has been removed from /super.`);
  }

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Access"
        title="Access approvals"
        description={copy.description}
      />

      {isSuperTarget && accessMode === "new" ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                {copy.addLabel}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">Create approval</h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                Add a Google account to the Firestore super admin allowlist.
              </p>
            </div>

            <button
              type="button"
              onClick={() => onAccessModeChange("list")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Back to list
            </button>
          </div>

          {superAccessMessage ? (
            <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {superAccessMessage}
            </div>
          ) : null}

          {superAdminError ? (
            <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {superAdminError}
            </div>
          ) : null}

          <form onSubmit={(event) => void handleSuperAdminSubmit(event)} className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm text-muted">{copy.emailLabel}</span>
              <input
                type="email"
                required
                value={newSuperEmail}
                onChange={(event) => setNewSuperEmail(event.target.value)}
                placeholder={copy.emailPlaceholder}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
              />
            </label>

            <button
              type="submit"
              disabled={isSavingSuperAdmin}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSavingSuperAdmin ? copy.savingLabel : copy.buttonLabel}
            </button>
          </form>
        </section>
      ) : accessMode === "new" || accessMode === "edit" ? (
      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                {isEditingAdmin ? "Edit admin access" : accessMode === "edit" && target === "company" ? "Edit company" : copy.addLabel}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                {isEditingAdmin || (accessMode === "edit" && target === "company") ? "Update approval" : "Create approval"}
              </h2>
              <p className="mt-3 text-sm leading-7 text-muted">
                {isEditingAdmin || (accessMode === "edit" && target === "company")
                  ? "Adjust the approved record and save the latest changes."
                  : "Save a new approved portal record with the details below."}
              </p>
            </div>

            <button
              type="button"
              onClick={isEditingAdmin ? onCancelAdminEdit : () => onAccessModeChange("list")}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Back to list
            </button>
          </div>

          {message ? (
            <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {message}
            </div>
          ) : null}

          {error ? (
            <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {error}
            </div>
          ) : null}

          <form onSubmit={onSubmit} className="mt-5 space-y-4">
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-panelStrong p-1 sm:grid-cols-2 lg:grid-cols-5">
              {formTabs.map((tab) => {
                const isActive = tab.id === activeAdminDefaultsTab;

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveAdminDefaultsTab(tab.id)}
                    className={[
                      "rounded-xl px-4 py-3 text-left transition",
                      isActive
                        ? "bg-white text-ink shadow-sm"
                        : "text-muted hover:bg-white/80 hover:text-ink",
                    ].join(" ")}
                  >
                    <span className="block text-sm font-semibold">{tab.label}</span>
                    <span className="mt-1 block text-xs leading-5">{tab.hint}</span>
                  </button>
                );
              })}
            </div>

            {activeAdminDefaultsTab === "basics" ? (
            <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
              <p className="text-sm font-semibold text-ink">Approval basics</p>
              <p className="mt-2 text-sm leading-7 text-muted">
                {target === "company"
                  ? "Enter the company name and the primary admin who will manage access."
                  : "Set the approved portal identity and internal notes for this record."}
              </p>
              <div className="mt-4 space-y-4">
            {target === "company" ? (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Company name</span>
                  <input
                    name="company"
                    required
                    value={draft.company}
                    onChange={onChange}
                    placeholder="e.g. Acme Corp"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Primary admin name</span>
                  <input
                    name="contactName"
                    value={draft.contactName}
                    onChange={onChange}
                    placeholder="e.g. Jane Smith"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Primary admin email</span>
                  <input
                    name="email"
                    type="email"
                    required
                    value={draft.email}
                    onChange={onChange}
                    placeholder={copy.emailPlaceholder}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>

                <div className="border-t border-slate-200 pt-4">
                  <p className="text-sm font-semibold text-ink">People</p>
                  <p className="mt-1 text-xs text-muted">Additional people who can access this company's projects.</p>
                  <div className="mt-3 space-y-2">
                    {draft.people.length === 0 ? (
                      <p className="text-xs text-muted">No people added yet.</p>
                    ) : (
                      draft.people.map((person) => (
                        <div key={person.email} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-ink">{person.name || person.email}</p>
                              {person.name ? <p className="text-xs text-muted">{person.email}</p> : null}
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                              {person.passwordUpdated ? (
                                <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Approved</span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleRemovePerson(person.email)}
                                className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                              >
                                Remove
                              </button>
                            </div>
                          </div>
                          {!person.passwordUpdated && person.tempPassword ? (
                            <div className="mt-2 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5">
                              <span className="text-xs text-amber-700">Temp password:</span>
                              <code className="flex-1 font-mono text-xs font-semibold tracking-wide text-ink">{person.tempPassword}</code>
                              <button
                                type="button"
                                onClick={() => void navigator.clipboard.writeText(person.tempPassword!)}
                                className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100"
                              >
                                Copy
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                  {personAddError ? (
                    <div className="mt-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-900">
                      {personAddError}
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <input
                      value={personDraft.name}
                      onChange={(e) => setPersonDraft((c) => ({ ...c, name: e.target.value }))}
                      placeholder="Name"
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                    />
                    <input
                      type="email"
                      value={personDraft.email}
                      onChange={(e) => {
                        setPersonDraft((c) => ({ ...c, email: e.target.value }));
                        if (!e.target.value.trim()) {
                          setPersonTempPassword(null);
                        }
                      }}
                      onBlur={(e) => {
                        if (e.target.value.trim() && !personTempPassword) {
                          setPersonTempPassword(generateTempPassword());
                        }
                      }}
                      placeholder="Email"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void handleAddPerson(); } }}
                      className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-ink outline-none focus:border-primary"
                    />
                  </div>
                  {personTempPassword ? (
                    <div className="mt-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                      <p className="text-xs font-semibold text-amber-900">Temporary password — show this to the person once</p>
                      <div className="mt-2 flex items-center gap-2">
                        <code className="flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2 font-mono text-sm font-semibold tracking-widest text-ink">
                          {personTempPassword}
                        </code>
                        <button
                          type="button"
                          onClick={() => void navigator.clipboard.writeText(personTempPassword)}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          Copy
                        </button>
                        <button
                          type="button"
                          onClick={() => setPersonTempPassword(generateTempPassword())}
                          className="rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-semibold text-amber-900 hover:bg-amber-100"
                        >
                          New
                        </button>
                      </div>
                      <p className="mt-2 text-xs text-amber-700">This password will not be shown again after you click Add.</p>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void handleAddPerson()}
                    disabled={!personDraft.email.trim() || !personTempPassword || isAddingPerson}
                    className="mt-2 rounded-full border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
                  >
                    {isAddingPerson ? "Adding..." : "Add person"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">{copy.emailLabel}</span>
                  <input
                    name="email"
                    type="email"
                    required
                    value={draft.email}
                    onChange={onChange}
                    placeholder={copy.emailPlaceholder}
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Organization</span>
                  <input
                    name="company"
                    value={draft.company}
                    onChange={onChange}
                    placeholder="Company or team name"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Contact name</span>
                  <input
                    name="contactName"
                    value={draft.contactName}
                    onChange={onChange}
                    placeholder="Primary contact"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block text-sm text-muted">Notes</span>
                  <textarea
                    name="notes"
                    rows={4}
                    value={draft.notes}
                    onChange={onChange}
                    placeholder="Optional internal notes"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  />
                </label>
              </>
            )}
              </div>
            </div>
            ) : null}

            {target === "admin" && activeAdminDefaultsTab === "services" ? (
              <>
                <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                  <p className="text-sm font-semibold text-ink">Service permissions</p>
                  <p className="mt-2 text-sm leading-7 text-muted">
                    Choose which of the five Deaimer services this admin can see in
                    the admin sidebar.
                  </p>

                  <div className="mt-4 space-y-3">
                    {servicePages.map((service) => {
                      const isSelected = draft.servicePermissions.includes(service.slug);

                      return (
                        <label
                          key={service.slug}
                          className="flex cursor-pointer items-start gap-3 rounded-[0.95rem] border border-slate-200 bg-white px-4 py-3 transition hover:border-primary/20"
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => onToggleServicePermission(service.slug)}
                            className="mt-1 h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                          />
                          <div>
                            <p className="text-sm font-semibold text-ink">{service.title}</p>
                            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted">
                              {service.eyebrow}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

              </>
            ) : null}

            {target === "admin" && ["role", "pay", "policies"].includes(activeAdminDefaultsTab) ? (
              <div className="rounded-[1rem] border border-slate-200 bg-panelStrong p-4">
                <p className="text-sm font-semibold text-ink">Admin details set by super</p>
                <p className="mt-2 text-sm leading-7 text-muted">
                  These defaults are saved with the admin approval and can prefill the admin workspace profile.
                </p>

                {activeAdminDefaultsTab === "role" ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Employee ID</span>
                    <input
                      value={draft.profileDefaults.identity.employeeId}
                      readOnly
                      className="w-full rounded-xl border border-slate-300 bg-panelStrong px-4 py-3 text-sm font-semibold text-ink outline-none"
                    />
                    <span className="mt-2 block text-xs text-muted">
                      Generated automatically as a unique 5-digit number.
                    </span>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Role title</span>
                    <input
                      value={draft.profileDefaults.identity.roleTitle}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "roleTitle", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Department</span>
                    <select
                      value={draft.profileDefaults.identity.department}
                      onChange={(event) => {
                        const department = departmentOptions.find(
                          (item) => item.name === event.target.value,
                        ) ?? departmentOptions[0];

                        onAdminDefaultChange("identity", "department", department.name);
                        onAdminDefaultChange(
                          "identity",
                          "subDepartment",
                          department.subdepartments[0],
                        );
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    >
                      {departmentOptions.map((department) => (
                        <option key={department.name} value={department.name}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Subdepartment</span>
                    <select
                      value={
                        selectedDepartment.subdepartments.includes(
                          draft.profileDefaults.identity.subDepartment,
                        )
                          ? draft.profileDefaults.identity.subDepartment
                          : selectedDepartment.subdepartments[0]
                      }
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "subDepartment", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    >
                      {selectedDepartment.subdepartments.map((subdepartment) => (
                        <option key={subdepartment} value={subdepartment}>
                          {subdepartment}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Date of joining</span>
                    <input
                      type="date"
                      value={draft.profileDefaults.identity.dateOfJoining}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "dateOfJoining", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Manager name</span>
                    <input
                      value={draft.profileDefaults.identity.managerName}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "managerName", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Manager email</span>
                    <input
                      type="email"
                      value={draft.profileDefaults.identity.managerEmail}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "managerEmail", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Employment type</span>
                    <select
                      value={draft.profileDefaults.identity.employmentType}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "employmentType", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    >
                      {adminEmploymentTypeOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Employment status</span>
                    <select
                      value={draft.profileDefaults.identity.employmentStatus}
                      onChange={(event) =>
                        onAdminDefaultChange("identity", "employmentStatus", event.target.value)
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                    >
                      {adminEmploymentStatusOptions.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                  </label>
                </div>
                ) : null}

                {activeAdminDefaultsTab === "pay" ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Payroll allowance</p>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Payroll cycle</span>
                      <select
                        value={draft.profileDefaults.bankPayroll.payrollCycle}
                        onChange={(event) =>
                          onAdminDefaultChange("bankPayroll", "payrollCycle", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                      >
                        {adminPayrollCycleOptions.map((option) => (
                          <option key={option} value={option}>{option}</option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Salary currency</span>
                      <input
                        value={draft.profileDefaults.bankPayroll.salaryCurrency}
                        onChange={(event) =>
                          onAdminDefaultChange("bankPayroll", "salaryCurrency", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.18em] text-muted">Base salary</span>
                      <input
                        value={draft.profileDefaults.bankPayroll.baseSalary}
                        onChange={(event) =>
                          onAdminDefaultChange("bankPayroll", "baseSalary", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                      />
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={draft.profileDefaults.bankPayroll.bonusEligible}
                        onChange={(event) =>
                          onAdminDefaultChange("bankPayroll", "bonusEligible", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      Bonus eligible
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink">
                      <input
                        type="checkbox"
                        checked={draft.profileDefaults.bankPayroll.commissionEligible}
                        onChange={(event) =>
                          onAdminDefaultChange("bankPayroll", "commissionEligible", event.target.checked)
                        }
                        className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary"
                      />
                      Commission eligible
                    </label>
                  </div>
                </div>
                ) : null}

                {activeAdminDefaultsTab === "policies" ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted">Policy confirmations</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {[
                      ["codeOfConductSigned", "Code of conduct"],
                      ["confidentialityAgreementSigned", "Confidentiality agreement"],
                      ["dataProtectionPolicySigned", "Data protection policy"],
                      ["acceptableUsePolicySigned", "Acceptable use policy"],
                      ["payrollPolicySigned", "Payroll policy"],
                    ].map(([key, label]) => (
                      <label key={key} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-ink">
                        <input
                          type="checkbox"
                          checked={Boolean(draft.profileDefaults.policyDocuments[key as keyof AdminPolicyDocumentsDraft])}
                          onChange={(event) =>
                            onAdminDefaultChange("policyDocuments", key, event.target.checked)
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
                        value={draft.profileDefaults.policyDocuments.signedAt}
                        onChange={(event) =>
                          onAdminDefaultChange("policyDocuments", "signedAt", event.target.value)
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary"
                      />
                    </label>
                  </div>
                </div>
                ) : null}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? copy.savingLabel
                : isEditingAdmin
                  ? "Update admin"
                  : accessMode === "edit" && target === "company"
                    ? "Update company"
                    : copy.buttonLabel}
            </button>
          </form>
        </section>
      ) : (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="mb-5 inline-flex rounded-full border border-slate-200 bg-panelStrong p-1">
            {(["company", "admin", "super"] as AccessTarget[]).map((item) => {
              const isActive = item === target;

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => {
                    onTargetChange(item);
                    onAccessModeChange("list");
                  }}
                  className={[
                    "rounded-full px-4 py-2 text-sm font-semibold transition",
                    isActive
                      ? "bg-white text-ink shadow-sm"
                      : "text-muted hover:text-ink",
                  ].join(" ")}
                >
                  {item === "company" ? "Company" : item === "admin" ? "Admin" : "Super admins"}
                </button>
              );
            })}
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                {copy.listLabel}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-ink">
                {copy.listTitle}
              </h2>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={onAddApproval}
                className="rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition hover:bg-primaryStrong"
              >
                {target === "company" ? "Add company" : target === "admin" ? "Add admin" : "Add super admin"}
              </button>
              <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
                {isSuperTarget ? superAdmins.length : approvals.length} total
              </span>
            </div>
          </div>

          {superAccessMessage && isSuperTarget ? (
            <div className="mt-5 rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
              {superAccessMessage}
            </div>
          ) : null}

          {superAdminError && isSuperTarget ? (
            <div className="mt-5 rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
              {superAdminError}
            </div>
          ) : null}

          {isLoading && !isSuperTarget ? (
            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
              Loading approved entries...
            </div>
          ) : null}

          {!isLoading && !isSuperTarget && approvals.length === 0 ? (
            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
              {copy.emptyLabel}
            </div>
          ) : null}

          {isSuperTarget && superAdmins.length === 0 ? (
            <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
              {copy.emptyLabel}
            </div>
          ) : null}

          {isSuperTarget && superAdmins.length > 0 ? (
            <div className="mt-5 space-y-2">
              {superAdmins.map((admin) => {
                const normalizedEmail = normalizeEmail(admin.email);
                const isCurrentUser = normalizedEmail === activeUserEmail;

                return (
                  <article
                    key={normalizedEmail}
                    className="rounded-xl border border-slate-200 bg-panelStrong px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-sm font-semibold text-ink">
                            {normalizedEmail}
                          </p>
                          <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
                            super
                          </span>
                          {isCurrentUser ? (
                            <span className="shrink-0 rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted">
                              you
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 truncate text-xs text-muted">
                          Invited by {admin.invitedByEmail || "super admin"}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => void handleRemoveSuperAdmin(normalizedEmail)}
                        disabled={isCurrentUser || removingSuperEmail === normalizedEmail}
                        className="shrink-0 rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {removingSuperEmail === normalizedEmail ? "Removing..." : "Remove"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}

          {!isLoading && !isSuperTarget && approvals.length > 0 ? (
            <div className="mt-5 space-y-2">
              {approvals.map((approval) => {
                const isAdminApproval = target === "admin";
                const servicePermissions = approval.servicePermissions ?? [];
                const allowedServices = servicePermissions
                  .map((permission) => {
                    const service = servicePages.find(
                      (item) => item.slug === permission,
                    );

                    return service?.title || permission;
                  })
                  .join(", ");
                const secondaryDetails = [
                  approval.company || "Approved access",
                  approval.contactName,
                  isAdminApproval
                    ? allowedServices || "No service permissions"
                    : approval.notes,
                ].filter(Boolean);

                const isCompanyApproval = target === "company";

                return (
                  <article
                    key={approval.id}
                    className="rounded-xl border border-slate-200 bg-panelStrong px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isCompanyApproval ? (
                          <>
                            <p className="truncate text-sm font-semibold text-ink">
                              {approval.company || approval.email}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-muted">
                              {[approval.contactName, approval.email].filter(Boolean).join(" · ")}
                            </p>
                            {(approval.people?.length ?? 0) > 0 ? (
                              <p className="mt-0.5 text-xs text-muted">{approval.people!.length} {approval.people!.length === 1 ? "person" : "people"}</p>
                            ) : null}
                          </>
                        ) : (
                          <>
                            <div className="flex min-w-0 items-center gap-2">
                              <p className="truncate text-sm font-semibold text-ink">
                                {approval.email}
                              </p>
                              <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-900">
                                {approval.status}
                              </span>
                            </div>
                            <p className="mt-1 truncate text-xs text-muted">
                              {secondaryDetails.join(" | ")}
                            </p>
                          </>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {isAdminApproval ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditAdmin(approval as AdminApprovalRecord)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-panelStrong"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteAdmin(approval as AdminApprovalRecord)}
                              disabled={deletingAdminEmail === approval.email}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingAdminEmail === approval.email ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        ) : isCompanyApproval ? (
                          <>
                            <button
                              type="button"
                              onClick={() => onEditCompany(approval)}
                              className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-panelStrong"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCompany(approval)}
                              disabled={deletingCompanyEmail === approval.email}
                              className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingCompanyEmail === approval.email ? "Deleting..." : "Delete"}
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </section>
      )}
    </div>
  );
}

type WorkforceSubView = "partner-companies";

function GlobalWorkforcePanel({
  activeUser,
}: {
  activeUser: User;
}) {
  const [subView] = useState<WorkforceSubView>("partner-companies");
  const [partners, setPartners] = useState<GlobalWorkforcePartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [draft, setDraft] = useState<GlobalWorkforcePartnerDraft>(emptyGlobalWorkforcePartnerDraft);
  const [editingPartnerId, setEditingPartnerId] = useState<string | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingPartnerId, setDeletingPartnerId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    return subscribeToGlobalWorkforcePartners(
      (records) => {
        setPartners(records);
        setIsLoading(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsLoading(false);
      },
    );
  }, []);

  function openNewForm() {
    setEditingPartnerId(null);
    setDraft(emptyGlobalWorkforcePartnerDraft);
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(partner: GlobalWorkforcePartner) {
    setEditingPartnerId(partner.id);
    setDraft({
      name: partner.name,
      partnerId: partner.partnerId,
      referenceId: partner.referenceId,
      notes: partner.notes,
    });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingPartnerId(null);
    setDraft(emptyGlobalWorkforcePartnerDraft);
    setErrorMessage(null);
  }

  function handleDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draft.name.trim()) {
      setErrorMessage("Company name is required.");
      return;
    }

    if (!draft.referenceId.trim()) {
      setErrorMessage("Reference Link is required.");
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);

    try {
      const previousReferenceLink =
        editingPartnerId
          ? partners.find((partner) => partner.id === editingPartnerId)?.referenceId ?? ""
          : "";
      await saveGlobalWorkforcePartner(activeUser, draft, editingPartnerId);
      const syncedJobCount =
        editingPartnerId && previousReferenceLink.trim() !== draft.referenceId.trim()
          ? await replaceGlobalWorkforceJobReferenceLinks(
              previousReferenceLink,
              draft.referenceId,
            )
          : 0;
      const normalizedJobCount = await normalizeGlobalWorkforceJobReferenceLinks();
      const totalUpdatedJobCount = syncedJobCount + normalizedJobCount;
      setSuccessMessage(
        editingPartnerId
          ? `${draft.name} has been updated.${
              totalUpdatedJobCount > 0
                ? ` ${totalUpdatedJobCount} existing job post${totalUpdatedJobCount === 1 ? "" : "s"} synced.`
                : ""
            }`
          : `${draft.name} has been added as a partner company.`,
      );
      closeForm();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not save this partner right now.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(partner: GlobalWorkforcePartner) {
    if (!window.confirm(`Delete partner "${partner.name}"? This cannot be undone.`)) {
      return;
    }

    setDeletingPartnerId(partner.id);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteGlobalWorkforcePartner(partner.id);
      setSuccessMessage(`${partner.name} was removed from partner companies.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not delete this partner right now.",
      );
    } finally {
      setDeletingPartnerId(null);
    }
  }

  void subView;

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Global Managed Workforce"
        title="Partner companies"
        description="Manage the external companies Deaimer places candidates with. Each company has a Reference Link used when candidates apply to external jobs."
        actions={
          !isFormOpen ? (
            <button
              type="button"
              onClick={openNewForm}
              className="rounded-full bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
            >
              Add company
            </button>
          ) : undefined
        }
      />

      {errorMessage ? (
        <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">
          {errorMessage}
        </div>
      ) : null}

      {successMessage && !isFormOpen ? (
        <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">
          {successMessage}
        </div>
      ) : null}

      {isFormOpen ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
                {editingPartnerId ? "Edit partner" : "New partner"}
              </p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">
                {editingPartnerId ? "Update company" : "Add partner company"}
              </h2>
            </div>
            <button
              type="button"
              onClick={closeForm}
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong"
            >
              Cancel
            </button>
          </div>

          <form onSubmit={(e) => void handleSubmit(e)} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Company name</span>
                <input
                  name="name"
                  value={draft.name}
                  onChange={handleDraftChange}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  placeholder="Acme Corp"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Partner ID</span>
                <input
                  name="partnerId"
                  value={draft.partnerId}
                  onChange={handleDraftChange}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  placeholder="ACME-001"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Reference Link</span>
                <input
                  name="referenceId"
                  type="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={draft.referenceId}
                  onChange={handleDraftChange}
                  required
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                  placeholder="https://partner-site.com/apply?job=JOB_ID"
                />
                <span className="mt-1.5 block text-xs text-muted">
                  Use JOB_ID in the URL where the External Job ID should be inserted.
                </span>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Notes</span>
              <textarea
                name="notes"
                value={draft.notes}
                onChange={handleDraftChange}
                rows={3}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition placeholder:text-muted/70 focus:border-primary"
                placeholder="Optional internal notes about this partner."
              />
            </label>

            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving
                ? editingPartnerId
                  ? "Saving changes..."
                  : "Adding company..."
                : editingPartnerId
                  ? "Save changes"
                  : "Add company"}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">
              Partner directory
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Companies we work with</h2>
          </div>
          <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">
            {partners.length} total
          </span>
        </div>

        {isLoading ? (
          <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
            Loading partner companies...
          </div>
        ) : null}

        {!isLoading && partners.length === 0 ? (
          <div className="mt-5 rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">
            No partner companies added yet. Use the button above to add the first one.
          </div>
        ) : null}

        {!isLoading && partners.length > 0 ? (
          <div className="mt-5 space-y-2">
            {partners.map((partner) => (
              <article
                key={partner.id}
                className="rounded-xl border border-slate-200 bg-panelStrong px-4 py-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-ink">{partner.name}</p>
                      {partner.partnerId ? (
                        <span className="rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
                          {partner.partnerId}
                        </span>
                      ) : null}
                    </div>
                    {partner.referenceId ? (
                      <p className="mt-1 break-all text-xs leading-5 text-muted normal-case">
                        <span>Reference Link: </span>
                        <span>{partner.referenceId}</span>
                      </p>
                    ) : null}
                    {partner.notes ? (
                      <p className="mt-1 text-xs leading-5 text-muted">{partner.notes}</p>
                    ) : null}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditForm(partner)}
                      className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-panelStrong"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(partner)}
                      disabled={deletingPartnerId === partner.id}
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {deletingPartnerId === partner.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CompanyPanel({ activeUser }: { activeUser: User }) {
  const [members, setMembers] = useState<CompanyLeadershipMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CompanyLeadershipMemberDraft>(emptyLeadershipMemberDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    return subscribeToLeadershipMembers(
      (records) => { setMembers(records); setIsLoading(false); },
      (error) => { setErrorMessage(error.message); setIsLoading(false); },
    );
  }, []);

  function openNewForm() {
    setEditingMemberId(null);
    setDraft({ ...emptyLeadershipMemberDraft, order: members.length });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(member: CompanyLeadershipMember) {
    setEditingMemberId(member.id);
    setDraft({ name: member.name, role: member.role, bio: member.bio, photoUrl: member.photoUrl, initial: member.initial, order: member.order });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingMemberId(null);
    setDraft(emptyLeadershipMemberDraft);
    setErrorMessage(null);
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: name === "order" ? Number(value) : value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.name.trim()) { setErrorMessage("Name is required."); return; }
    if (!draft.role.trim()) { setErrorMessage("Role is required."); return; }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveLeadershipMember(activeUser, draft, editingMemberId);
      setSuccessMessage(editingMemberId ? `${draft.name} has been updated.` : `${draft.name} has been added to the leadership team.`);
      closeForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save this member right now.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(member: CompanyLeadershipMember) {
    if (!window.confirm(`Remove ${member.name} from the leadership team?`)) return;
    setDeletingMemberId(member.id);
    setErrorMessage(null);
    try {
      await deleteLeadershipMember(member.id);
      setSuccessMessage(`${member.name} was removed.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete this member right now.");
    } finally {
      setDeletingMemberId(null);
    }
  }

  const avatarColors = ["bg-primary/10 text-primary", "bg-amber-100 text-amber-700", "bg-emerald-100 text-emerald-700", "bg-purple-100 text-purple-700", "bg-rose-100 text-rose-700"];

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Company"
        title="Leadership team"
        description="Manage the people shown in the 'The people behind Deaimer' section on the company page. Changes go live immediately."
        actions={
          !isFormOpen ? (
            <button type="button" onClick={openNewForm} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90">
              Add member
            </button>
          ) : undefined
        }
      />

      {errorMessage ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">{errorMessage}</div> : null}
      {successMessage && !isFormOpen ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">{successMessage}</div> : null}

      {isFormOpen ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">{editingMemberId ? "Edit member" : "New member"}</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">{editingMemberId ? "Update member" : "Add team member"}</h2>
            </div>
            <button type="button" onClick={closeForm} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">Cancel</button>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Full name <span className="text-rose-500">*</span></span>
                <input name="name" value={draft.name} onChange={handleDraftChange} required placeholder="e.g. Sarah Njeri" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Role / title <span className="text-rose-500">*</span></span>
                <input name="role" value={draft.role} onChange={handleDraftChange} required placeholder="e.g. Chief Operations Officer" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
              </label>
            </div>
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Bio</span>
              <textarea name="bio" value={draft.bio} onChange={handleDraftChange} rows={3} placeholder="Short one-line bio" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="mb-2 block text-sm font-medium text-ink">Photo URL</span>
                <input name="photoUrl" value={draft.photoUrl} onChange={handleDraftChange} type="url" placeholder="https://..." className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
                <span className="mt-1.5 block text-xs text-muted">Leave blank to show initials instead.</span>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Display order</span>
                <input name="order" type="number" value={draft.order} onChange={handleDraftChange} min={0} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
                <span className="mt-1.5 block text-xs text-muted">Lower = shown first.</span>
              </label>
            </div>
            <button type="submit" disabled={isSaving} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? (editingMemberId ? "Saving..." : "Adding...") : (editingMemberId ? "Save changes" : "Add member")}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Team members</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Leadership team</h2>
          </div>
          <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">{members.length} total</span>
        </div>

        {isLoading ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">Loading team members...</div> : null}
        {!isLoading && members.length === 0 ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">No team members yet. Use the button above to add the first one.</div> : null}
        {!isLoading && members.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {members.map((member, index) => (
              <article key={member.id} className="rounded-xl border border-slate-200 bg-panelStrong p-4">
                <div className="flex items-start gap-3">
                  {member.photoUrl ? (
                    <img src={member.photoUrl} alt={member.name} className="h-11 w-11 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${avatarColors[index % avatarColors.length]}`}>
                      {member.initial || member.name.charAt(0)}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{member.name}</p>
                    <p className="mt-0.5 text-xs text-primary">{member.role}</p>
                    {member.bio ? <p className="mt-1.5 text-xs leading-5 text-muted line-clamp-2">{member.bio}</p> : null}
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <span className="text-[11px] text-muted">Order: {member.order}</span>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => openEditForm(member)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-panelStrong">Edit</button>
                    <button type="button" onClick={() => void handleDelete(member)} disabled={deletingMemberId === member.id} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:opacity-60">
                      {deletingMemberId === member.id ? "Removing..." : "Remove"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function CareersPanel({ activeUser }: { activeUser: User }) {
  const [openings, setOpenings] = useState<CareerOpening[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<CareerOpeningDraft>(emptyCareerOpeningDraft);
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    return subscribeToCareerOpenings(
      (records) => { setOpenings(records); setIsLoading(false); },
      (error) => { setErrorMessage(error.message); setIsLoading(false); },
    );
  }, []);

  function openNewForm() {
    setEditingId(null);
    setDraft({ ...emptyCareerOpeningDraft });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function openEditForm(opening: CareerOpening) {
    setEditingId(opening.id);
    setDraft({ title: opening.title, location: opening.location, employmentType: opening.employmentType, department: opening.department });
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsFormOpen(true);
  }

  function closeForm() {
    setIsFormOpen(false);
    setEditingId(null);
    setDraft(emptyCareerOpeningDraft);
    setErrorMessage(null);
  }

  function handleDraftChange(event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = event.target;
    setDraft((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim()) { setErrorMessage("Title is required."); return; }
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await saveCareerOpening(activeUser, draft, editingId);
      setSuccessMessage(editingId ? `"${draft.title}" updated.` : `"${draft.title}" added to openings.`);
      closeForm();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not save this opening.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(opening: CareerOpening) {
    if (!window.confirm(`Remove "${opening.title}"?`)) return;
    setDeletingId(opening.id);
    setErrorMessage(null);
    try {
      await deleteCareerOpening(opening.id);
      setSuccessMessage(`"${opening.title}" removed.`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Could not delete this opening.");
    } finally {
      setDeletingId(null);
    }
  }

  const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Internship"];

  return (
    <div className="space-y-6">
      <WorkspaceHero
        eyebrow="Careers"
        title="Current openings"
        description="Manage the job openings shown on the careers page. Changes go live immediately."
        actions={
          !isFormOpen ? (
            <button type="button" onClick={openNewForm} className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-white/90">
              Add opening
            </button>
          ) : undefined
        }
      />

      {errorMessage ? <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-4 text-sm leading-7 text-rose-900">{errorMessage}</div> : null}
      {successMessage && !isFormOpen ? <div className="rounded-[1rem] border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm leading-7 text-emerald-900">{successMessage}</div> : null}

      {isFormOpen ? (
        <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">{editingId ? "Edit opening" : "New opening"}</p>
              <h2 className="mt-3 text-2xl font-semibold text-ink">{editingId ? "Update role" : "Add role"}</h2>
            </div>
            <button type="button" onClick={closeForm} className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-panelStrong">Cancel</button>
          </div>
          <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-ink">Job title <span className="text-rose-500">*</span></span>
              <input name="title" value={draft.title} onChange={handleDraftChange} required placeholder="e.g. Senior Platform Engineer" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Location</span>
                <input name="location" value={draft.location} onChange={handleDraftChange} placeholder="e.g. Remote" className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary" />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Type</span>
                <select name="employmentType" value={draft.employmentType} onChange={handleDraftChange} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary">
                  {EMPLOYMENT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-ink">Department</span>
                <select name="department" value={draft.department} onChange={handleDraftChange} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-ink outline-none transition focus:border-primary">
                  <option value="">Select department</option>
                  {departmentOptions.map((d) => (
                    <option key={d.name} value={d.name}>{d.name}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" disabled={isSaving} className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong disabled:cursor-not-allowed disabled:opacity-60">
              {isSaving ? (editingId ? "Saving..." : "Adding...") : (editingId ? "Save changes" : "Add opening")}
            </button>
          </form>
        </section>
      ) : null}

      <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-panel">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primarySoft">Open roles</p>
            <h2 className="mt-2 text-2xl font-semibold text-ink">Current openings</h2>
          </div>
          <span className="rounded-full border border-slate-300 bg-panelStrong px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink">{openings.length} total</span>
        </div>

        {isLoading ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">Loading openings...</div> : null}
        {!isLoading && openings.length === 0 ? <div className="rounded-[1rem] border border-slate-200 bg-panelStrong px-4 py-4 text-sm text-muted">No openings yet. Use the button above to add the first one.</div> : null}
        {!isLoading && openings.length > 0 ? (
          <div className="space-y-2">
            {openings.map((opening) => (
              <div key={opening.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-panelStrong px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{opening.title}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {[opening.location, opening.employmentType, opening.department].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openEditForm(opening)} className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-semibold text-ink transition hover:bg-panelStrong">Edit</button>
                  <button type="button" onClick={() => void handleDelete(opening)} disabled={deletingId === opening.id} className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-semibold text-rose-900 transition hover:bg-rose-50 disabled:opacity-60">
                    {deletingId === opening.id ? "Removing..." : "Remove"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function SuperAdminPortal({
  initialView = "overview",
  initialAccessTarget = "company",
  initialAccessMode = "list",
  initialEditingEmail = null,
  initialWorkforceSection = "partners",
  initialDCSection = "projects",
  initialEvalSection = "assignments",
  platformSideMenuItems = [],
}: {
  initialView?: SuperView;
  initialAccessTarget?: AccessTarget;
  initialAccessMode?: AccessMode;
  initialEditingEmail?: string | null;
  initialWorkforceSection?: SuperWorkforceSection;
  initialDCSection?: DCAdminSection;
  initialEvalSection?: EvalTranscriptionSection;
  platformSideMenuItems?: PlatformSideMenuItem[];
}) {
  const router = useRouter();
  const firebaseReady = isFirebaseConfigured();
  const firebaseConfigError = getFirebaseConfigError();

  const [superTheme, setSuperTheme] = useState<"light" | "dark">("light");
  const [hasMounted, setHasMounted] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isAuthResolving, setIsAuthResolving] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isEmailBusy, setIsEmailBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailForm, setEmailForm] = useState(emptyEmailForm);
  const [emailMode, setEmailMode] = useState<EmailMode>("signup");
  const [activeView, setActiveView] = useState<SuperView>(initialView);
  const [activeAccessTarget, setActiveAccessTarget] = useState<AccessTarget>(
    initialAccessTarget,
  );
  const [activeAccessMode, setActiveAccessMode] = useState<AccessMode>(initialAccessMode);
  const [activeWorkforceSection, setActiveWorkforceSection] =
    useState<SuperWorkforceSection>(initialWorkforceSection);
  const [activeDCSection, setActiveDCSection] = useState<DCAdminSection>(initialDCSection);
  const [activeEvalSection, setActiveEvalSection] = useState<EvalTranscriptionSection>(initialEvalSection);
  const [isCurrentUserSuperAdmin, setIsCurrentUserSuperAdmin] = useState(false);
  const [isSuperAdminLoaded, setIsSuperAdminLoaded] = useState(false);
  const [superAdmins, setSuperAdmins] = useState<SuperAccessRecord[]>([]);
  const [isSavingSuperAdmin, setIsSavingSuperAdmin] = useState(false);
  const [removingSuperEmail, setRemovingSuperEmail] = useState<string | null>(null);
  const [superAdminError, setSuperAdminError] = useState<string | null>(null);
  const [clientApprovals, setClientApprovals] = useState<ClientApprovalRecord[]>([]);
  const [adminApprovals, setAdminApprovals] = useState<AdminApprovalRecord[]>([]);
  const [isLoadingClientApprovals, setIsLoadingClientApprovals] = useState(false);
  const [isLoadingAdminApprovals, setIsLoadingAdminApprovals] = useState(false);
  const [isSavingApproval, setIsSavingApproval] = useState(false);
  const [deletingAdminEmail, setDeletingAdminEmail] = useState<string | null>(null);
  const [deletingCompanyEmail, setDeletingCompanyEmail] = useState<string | null>(null);
  const [editingAdminEmail, setEditingAdminEmail] = useState<string | null>(null);
  const [approvalDraft, setApprovalDraft] = useState<ApprovalDraft>(emptyApprovalForm);
  const [approvalMessage, setApprovalMessage] = useState<string | null>(null);
  const existingAdminEmployeeIds = useMemo(
    () =>
      adminApprovals
        .map((approval) => approval.profileDefaults.identity.employeeId)
        .filter((employeeId) => /^\d{5}$/.test(employeeId)),
    [adminApprovals],
  );

  useEffect(() => {
    const saved = localStorage.getItem("deaimer-super-theme");
    if (saved === "dark" || saved === "light") setSuperTheme(saved);
  }, []);

  function handleSuperThemeChange(theme: "light" | "dark") {
    setSuperTheme(theme);
    localStorage.setItem("deaimer-super-theme", theme);
  }

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    setActiveView(initialView);
  }, [initialView]);

  useEffect(() => {
    setActiveAccessTarget(initialAccessTarget);
  }, [initialAccessTarget]);

  useEffect(() => {
    setActiveAccessMode(initialAccessMode);
  }, [initialAccessMode]);

  useEffect(() => {
    setActiveWorkforceSection(initialWorkforceSection);
  }, [initialWorkforceSection]);

  useEffect(() => {
    setActiveDCSection(initialDCSection);
  }, [initialDCSection]);

  useEffect(() => {
    setActiveEvalSection(initialEvalSection);
  }, [initialEvalSection]);

  useEffect(() => {
    if (initialAccessMode !== "edit" || initialAccessTarget !== "admin" || !initialEditingEmail) {
      return;
    }

    const approval = adminApprovals.find(
      (record) => normalizeEmail(record.email) === normalizeEmail(initialEditingEmail),
    );

    if (!approval) {
      return;
    }

    setEditingAdminEmail(approval.email);
    setApprovalDraft({
      email: approval.email,
      company: approval.company,
      contactName: approval.contactName,
      notes: approval.notes,
      people: [],
      servicePermissions: approval.servicePermissions,
      profileDefaults: approval.profileDefaults,
    });
  }, [adminApprovals, initialAccessMode, initialAccessTarget, initialEditingEmail]);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (!firebaseReady) {
      setAuthReady(true);
      setIsAuthResolving(false);
      return;
    }

    const { auth } = getFirebaseClientServices();
    let cancelled = false;
    let unsubscribe: (() => void) | undefined;

    // Eagerly restore in-memory auth state — avoids spinner flash on remount when already signed in
    const existingUser = auth.currentUser;
    if (existingUser) {
      setActiveUser(existingUser);
      setAuthReady(true);
      setIsAuthResolving(false);
      setIsSigningIn(false);
    } else {
      setAuthReady(false);
      setIsAuthResolving(true);
    }

    async function initializeAuth() {
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

        if (user) {
          setErrorMessage(null);
        }
      });
    }

    void initializeAuth();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [firebaseReady, hasMounted]);

  // Subscribe to whether current user is a super admin (Firestore-based)
  useEffect(() => {
    if (!hasMounted || !firebaseReady || !activeUser?.email) {
      setIsCurrentUserSuperAdmin(false);
      setIsSuperAdminLoaded(false);
      setSuperAdmins([]);
      return;
    }
    setIsSuperAdminLoaded(false);
    return subscribeSuperAdminStatus(
      activeUser.email,
      (isSuper) => {
        setIsCurrentUserSuperAdmin(isSuper);
        setIsSuperAdminLoaded(true);
        if (isSuper) {
          setErrorMessage(null);
        }
      },
      (error) => {
        setErrorMessage(
          `Could not verify super admin access for ${normalizeEmail(activeUser.email)}: ${error.message}`,
        );
      },
    );
  }, [hasMounted, firebaseReady, activeUser?.email]);

  // Load full super admin list (only when confirmed super admin)
  useEffect(() => {
    if (!isCurrentUserSuperAdmin) {
      setSuperAdmins([]);
      return;
    }
    return subscribeToSuperAdmins(
      (records) => setSuperAdmins(records),
      (error) => setSuperAdminError(error.message),
    );
  }, [isCurrentUserSuperAdmin]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady || !activeUser || !isCurrentUserSuperAdmin) {
      setClientApprovals([]);
      return;
    }

    setIsLoadingClientApprovals(true);
    const unsubscribe = subscribeToClientApprovals(
      (records) => {
        setClientApprovals(records);
        setIsLoadingClientApprovals(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsLoadingClientApprovals(false);
      },
    );

    return unsubscribe;
  }, [activeUser, firebaseReady, hasMounted, isCurrentUserSuperAdmin]);

  useEffect(() => {
    if (!hasMounted || !firebaseReady || !activeUser || !isCurrentUserSuperAdmin) {
      setAdminApprovals([]);
      return;
    }

    setIsLoadingAdminApprovals(true);
    const unsubscribe = subscribeToAdminApprovals(
      (records) => {
        setAdminApprovals(records);
        setIsLoadingAdminApprovals(false);
      },
      (error) => {
        setErrorMessage(error.message);
        setIsLoadingAdminApprovals(false);
      },
    );

    return unsubscribe;
  }, [activeUser, firebaseReady, hasMounted, isCurrentUserSuperAdmin]);


  useEffect(() => {
    if (activeAccessMode === "edit") {
      return;
    }

    setApprovalDraft(
      activeAccessTarget === "admin" && activeAccessMode === "new"
        ? createApprovalFormWithEmployeeId(existingAdminEmployeeIds)
        : emptyApprovalForm,
    );
    setApprovalMessage(null);
    setEditingAdminEmail(null);
  }, [activeAccessTarget, activeAccessMode, existingAdminEmployeeIds]);

  function handleApprovalDraftChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;
    setApprovalDraft((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleAdminDefaultChange(
    section: keyof ApprovalDraft["profileDefaults"],
    field: string,
    value: string | boolean,
  ) {
    setApprovalDraft((current) => ({
      ...current,
      profileDefaults: {
        ...current.profileDefaults,
        [section]: {
          ...current.profileDefaults[section],
          [field]: value,
        },
      },
    }));
  }

  function handleToggleServicePermission(slug: string) {
    setApprovalDraft((current) => {
      const exists = current.servicePermissions.includes(slug);

      return {
        ...current,
        servicePermissions: exists
          ? current.servicePermissions.filter((permission) => permission !== slug)
          : [...current.servicePermissions, slug],
      };
    });
  }

  function openAccessPage(target: AccessTarget, mode: AccessMode, email?: string) {
    const params = new URLSearchParams({
      view: "access",
      target,
      mode,
    });

    if (email) {
      params.set("email", normalizeEmail(email));
    }

    router.push(`/super?${params.toString()}`);
  }

  function handleAccessTargetChange(target: AccessTarget) {
    setActiveAccessTarget(target);
    setActiveAccessMode("list");
    setEditingAdminEmail(null);
    setApprovalDraft(emptyApprovalForm);
    router.push(`/super?view=access&target=${target}`);
  }

  function handleAddApprovalPage() {
    setEditingAdminEmail(null);
    setApprovalDraft(
      activeAccessTarget === "admin"
        ? createApprovalFormWithEmployeeId(existingAdminEmployeeIds)
        : emptyApprovalForm,
    );
    setActiveAccessMode("new");
    openAccessPage(activeAccessTarget, "new");
  }

  function handleAccessModeChange(mode: AccessMode) {
    setActiveAccessMode(mode);

    if (mode === "list") {
      setEditingAdminEmail(null);
      setApprovalDraft(emptyApprovalForm);
      router.push(`/super?view=access&target=${activeAccessTarget}`);
      return;
    }

    openAccessPage(activeAccessTarget, mode);
  }

  function handleStartEditAdminApproval(approval: AdminApprovalRecord) {
    setActiveView("access");
    setActiveAccessTarget("admin");
    setActiveAccessMode("edit");
    setEditingAdminEmail(approval.email);
    setApprovalMessage(null);
    setErrorMessage(null);
    setApprovalDraft({
      email: approval.email,
      company: approval.company,
      contactName: approval.contactName,
      notes: approval.notes,
      people: [],
      servicePermissions: approval.servicePermissions,
      profileDefaults: approval.profileDefaults,
    });
    openAccessPage("admin", "edit", approval.email);
  }

  function handleCancelAdminEdit() {
    setEditingAdminEmail(null);
    setActiveAccessMode("list");
    setApprovalDraft(emptyApprovalForm);
    setApprovalMessage(null);
    setErrorMessage(null);
    router.push("/super?view=access&target=admin");
  }

  async function handleDeleteAdminApproval(approval: AdminApprovalRecord) {
    if (!window.confirm(`Delete admin access for ${approval.email}?`)) {
      return;
    }

    setDeletingAdminEmail(approval.email);
    setApprovalMessage(null);
    setErrorMessage(null);

    try {
      await deleteAdminApproval(approval.email);

      if (editingAdminEmail === approval.email) {
        handleCancelAdminEdit();
      }

      setAdminApprovals((current) =>
        current.filter(
          (record) => normalizeEmail(record.email) !== normalizeEmail(approval.email),
        ),
      );
      setApprovalMessage(`${approval.email} has been removed from the admin portal.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not delete this admin approval right now.",
      );
    } finally {
      setDeletingAdminEmail(null);
    }
  }

  function handleStartEditCompanyApproval(approval: ApprovalRecordView) {
    setActiveView("access");
    setActiveAccessTarget("company");
    setActiveAccessMode("edit");
    setEditingAdminEmail(approval.email);
    setApprovalMessage(null);
    setErrorMessage(null);
    setApprovalDraft({
      ...emptyApprovalForm,
      email: approval.email,
      company: approval.company,
      contactName: approval.contactName,
      notes: approval.notes,
      people: approval.people ?? [],
    });
    openAccessPage("company", "edit", approval.email);
  }

  async function handleDeleteCompanyApproval(approval: ApprovalRecordView) {
    if (!window.confirm(`Delete company "${approval.company || approval.email}"? This cannot be undone.`)) {
      return;
    }

    setDeletingCompanyEmail(approval.email);
    setApprovalMessage(null);
    setErrorMessage(null);

    try {
      await deleteClientApproval(approval.email);
      setClientApprovals((current) =>
        current.filter((record) => normalizeEmail(record.email) !== normalizeEmail(approval.email)),
      );
      setApprovalMessage(`"${approval.company || approval.email}" has been removed.`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "We could not delete this company right now.",
      );
    } finally {
      setDeletingCompanyEmail(null);
    }
  }

  function handlePeopleChange(people: ClientApprovalPerson[]) {
    setApprovalDraft((current) => ({ ...current, people }));
  }

  async function handleGoogleSignIn() {
    if (!firebaseReady) {
      return;
    }

    setIsSigningIn(true);
    setErrorMessage(null);

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

  async function handleEmailAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firebaseReady) {
      return;
    }

    const email = emailForm.email.trim().toLowerCase();

    if (!email || !emailForm.password) {
      setErrorMessage("Enter your email and password first.");
      return;
    }

    if (emailMode === "signup" && emailForm.password !== emailForm.confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsEmailBusy(true);
    setErrorMessage(null);

    try {
      const { auth } = getFirebaseClientServices();
      if (emailMode === "signup") {
        await createUserWithEmailAndPassword(auth, email, emailForm.password);
      } else {
        await signInWithEmailAndPassword(auth, email, emailForm.password);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Email authentication did not complete. Please try again.",
      );
    } finally {
      setIsEmailBusy(false);
    }
  }

  async function handleAddPersonToCompany(name: string, email: string, tempPassword: string) {
    if (!activeUser) throw new Error("Not signed in as super admin.");
    const idToken = await activeUser.getIdToken();
    const companyEmail = normalizeEmail(approvalDraft.email);
    const res = await fetch("/api/super/create-person-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ email, tempPassword, name, companyEmail }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({})) as Record<string, unknown>;
      throw new Error(typeof data.error === "string" ? data.error : "Could not create person account.");
    }
  }

  async function handleApprovalSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (activeAccessTarget === "super") {
      return;
    }

    if (!activeUser) {
      setErrorMessage("Sign in as a super admin before approving access.");
      return;
    }

    setIsSavingApproval(true);
    setErrorMessage(null);
    setApprovalMessage(null);

    try {
      if (activeAccessTarget === "company") {
        await saveClientApproval(activeUser, approvalDraft);
        const normalizedApprovalEmail = normalizeEmail(approvalDraft.email);
        setClientApprovals((current) => [
          ...current.filter(
            (approval) => normalizeEmail(approval.email) !== normalizedApprovalEmail,
          ),
          {
            id: normalizedApprovalEmail,
            email: normalizedApprovalEmail,
            company: approvalDraft.company.trim(),
            contactName: approvalDraft.contactName.trim(),
            notes: approvalDraft.notes.trim(),
            people: approvalDraft.people,
            status: "approved" as const,
            invitedByEmail: normalizeEmail(activeUser.email),
            invitedByUid: activeUser.uid,
          },
        ].sort((a, b) => a.email.localeCompare(b.email)));
      } else {
        const currentEmployeeId = approvalDraft.profileDefaults.identity.employeeId;
        const duplicateEmployeeId = adminApprovals.some(
          (approval) =>
            normalizeEmail(approval.email) !== normalizeEmail(approvalDraft.email) &&
            approval.profileDefaults.identity.employeeId === currentEmployeeId,
        );

        if (!/^\d{5}$/.test(currentEmployeeId)) {
          throw new Error("Employee ID must be exactly 5 numbers.");
        }

        if (duplicateEmployeeId) {
          throw new Error("This employee ID is already assigned to another admin.");
        }

        const adminApprovalInput: AdminApprovalInput = {
          email: approvalDraft.email,
          company: approvalDraft.company,
          contactName: approvalDraft.contactName,
          notes: approvalDraft.notes,
          servicePermissions: approvalDraft.servicePermissions,
          profileDefaults: approvalDraft.profileDefaults,
        };

        await saveAdminApproval(activeUser, adminApprovalInput);
        const normalizedApprovalEmail = normalizeEmail(approvalDraft.email);
        setAdminApprovals((current) => [
          ...current.filter(
            (approval) => normalizeEmail(approval.email) !== normalizedApprovalEmail,
          ),
          {
            id: normalizedApprovalEmail,
            email: normalizedApprovalEmail,
            company: adminApprovalInput.company.trim(),
            contactName: adminApprovalInput.contactName.trim(),
            notes: adminApprovalInput.notes.trim(),
            servicePermissions: adminApprovalInput.servicePermissions,
            profileDefaults: adminApprovalInput.profileDefaults,
            status: "approved" as const,
            invitedByEmail: normalizeEmail(activeUser.email),
            invitedByUid: activeUser.uid,
            assignedProjectIds:
              adminApprovals.find(
                (approval) => normalizeEmail(approval.email) === normalizedApprovalEmail,
              )?.assignedProjectIds ?? [],
          },
        ].sort((a, b) => a.email.localeCompare(b.email)));
      }

      setApprovalMessage(
        `${normalizeEmail(approvalDraft.email)} ${accessPanelCopy[activeAccessTarget].successLabel}`,
      );
      setApprovalDraft(emptyApprovalForm);
      setEditingAdminEmail(null);
      setActiveView("access");
      setActiveAccessMode("list");
      router.push(`/super?view=access&target=${activeAccessTarget}`);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "We could not save this approval right now.",
      );
    } finally {
      setIsSavingApproval(false);
    }
  }

  async function handleAddSuperAdmin(email: string) {
    if (!activeUser) return;
    setSuperAdminError(null);
    setIsSavingSuperAdmin(true);
    try {
      const normalizedEmail = normalizeEmail(email);
      await addSuperAdmin(activeUser, normalizedEmail);
      setSuperAdmins((current) => {
        if (current.some((record) => normalizeEmail(record.email) === normalizedEmail)) {
          return current;
        }

        return [
          ...current,
          {
            email: normalizedEmail,
            invitedByEmail: normalizeEmail(activeUser.email),
            invitedByUid: activeUser.uid,
          },
        ].sort((a, b) => a.email.localeCompare(b.email));
      });
    } catch (err) {
      setSuperAdminError(err instanceof Error ? err.message : "Could not add super admin.");
      throw err;
    } finally {
      setIsSavingSuperAdmin(false);
    }
  }

  async function handleRemoveSuperAdmin(email: string) {
    if (!activeUser) return;
    if (email === normalizeEmail(activeUser.email)) return;
    setSuperAdminError(null);
    setRemovingSuperEmail(email);
    try {
      await removeSuperAdmin(email);
      setSuperAdmins((current) =>
        current.filter((record) => normalizeEmail(record.email) !== normalizeEmail(email)),
      );
    } catch (err) {
      setSuperAdminError(err instanceof Error ? err.message : "Could not remove super admin.");
      throw err;
    } finally {
      setRemovingSuperEmail(null);
    }
  }

  async function handleSignOut() {
    if (!firebaseReady) {
      return;
    }

    const { auth } = getFirebaseClientServices();
    await signOut(auth);
    setActiveUser(null);
    setErrorMessage(null);
    setApprovalMessage(null);
    setEditingAdminEmail(null);
  }

  const activeApprovals = useMemo<ApprovalRecordView[]>(
    () => {
      if (activeAccessTarget === "super") {
        return [];
      }

      return activeAccessTarget === "company" ? clientApprovals : adminApprovals;
    },
    [activeAccessTarget, adminApprovals, clientApprovals],
  );

  const activeApprovalsLoading =
    activeAccessTarget === "super"
      ? false
      : activeAccessTarget === "company"
        ? isLoadingClientApprovals
        : isLoadingAdminApprovals;
  if (!hasMounted || !authReady || isAuthResolving || (activeUser && !isSuperAdminLoaded)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-panelStrong">
        <div className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
      </div>
    );
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
        isSubmitting={isEmailBusy || isSigningIn || isAuthResolving}
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

  if (!isCurrentUserSuperAdmin) {
    return (
      <main className="min-h-screen bg-background text-ink">
        <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-10 sm:px-6 lg:px-10">
          <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-7 sm:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-muted">
                Access denied
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-semibold leading-tight text-ink sm:text-5xl">
                This account cannot open `/super`
              </h1>
              <p className="mt-6 max-w-2xl text-base leading-8 text-muted">
                This workspace is restricted to approved super admin accounts. Contact a super admin to request access.
              </p>
            </section>

            <section className="rounded-[1.5rem] border border-slate-200 bg-white p-6 sm:p-8">
              {errorMessage ? (
                <div className="rounded-[1rem] border border-rose-200 bg-rose-50 p-4 text-sm leading-7 text-rose-900">
                  {errorMessage}
                </div>
              ) : null}

              <div className={errorMessage ? "mt-5" : ""}>
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-muted">
                  Next step
                </p>
                <h2 className="mt-3 text-2xl font-semibold text-ink">
                  Stay signed in or switch accounts
                </h2>
                <p className="mt-3 text-sm leading-7 text-muted">
                  Your session is still active. If you want to use another Google
                  account, sign out and continue again.
                </p>

                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="/admin"
                    className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-panelStrong px-5 py-3 text-sm font-semibold text-ink transition hover:bg-slate-200"
                  >
                    Open admin portal
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleSignOut()}
                    className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primaryStrong"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    );
  }

  const superThemeClass = superTheme === "dark" ? "cand-dark" : "";
  const superShell = (
    <DeaimerSiteShell
      platformSideMenuItems={platformSideMenuItems}
      themeToggle={{
        theme: superTheme,
        onToggle: () => handleSuperThemeChange(superTheme === "dark" ? "light" : "dark"),
      }}
    >
      <main className="min-h-screen bg-background text-ink">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
          <div className="space-y-6">
            {activeView === "overview" ? (
              <>
                <OverviewPanel
                  approvedClientCount={clientApprovals.length}
                  approvedAdminCount={adminApprovals.length}
                  superAdmins={superAdmins}
                  activeUserEmail={normalizeEmail(activeUser.email)}
                  reviewerName={activeUser.displayName?.split(" ")[0] || "Super admin"}
                  onOpenAdmins={() => {
                    setActiveAccessTarget("admin");
                    setActiveView("access");
                  }}
                  onOpenClients={() => {
                    setActiveAccessTarget("company");
                    setActiveView("access");
                  }}
                  onOpenTeam={() => setActiveView("team")}
                  onAddSuperAdmin={handleAddSuperAdmin}
                  onRemoveSuperAdmin={handleRemoveSuperAdmin}
                  isSavingSuperAdmin={isSavingSuperAdmin}
                  removingSuperEmail={removingSuperEmail}
                />
                {superAdminError ? (
                  <div className="rounded-[1rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                    {superAdminError}
                  </div>
                ) : null}
              </>
            ) : activeView === "access" ? (
              <>
                <AccessPanel
                  target={activeAccessTarget}
                  accessMode={activeAccessMode}
                  approvals={activeApprovals}
                  draft={approvalDraft}
                  isSaving={isSavingApproval}
                  isLoading={activeApprovalsLoading}
                  message={approvalMessage}
                  error={errorMessage}
                  superAdmins={superAdmins}
                  activeUserEmail={normalizeEmail(activeUser.email)}
                  superAdminError={superAdminError}
                  isSavingSuperAdmin={isSavingSuperAdmin}
                  removingSuperEmail={removingSuperEmail}
                  editingAdminEmail={editingAdminEmail}
                  deletingAdminEmail={deletingAdminEmail}
                  deletingCompanyEmail={deletingCompanyEmail}
                  onTargetChange={handleAccessTargetChange}
                  onAccessModeChange={handleAccessModeChange}
                  onAddApproval={handleAddApprovalPage}
                  onChange={handleApprovalDraftChange}
                  onAdminDefaultChange={handleAdminDefaultChange}
                  onSubmit={handleApprovalSubmit}
                  onToggleServicePermission={handleToggleServicePermission}
                  onEditAdmin={handleStartEditAdminApproval}
                  onDeleteAdmin={handleDeleteAdminApproval}
                  onEditCompany={handleStartEditCompanyApproval}
                  onDeleteCompany={handleDeleteCompanyApproval}
                  onPeopleChange={handlePeopleChange}
                  onAddPerson={handleAddPersonToCompany}
                  onCancelAdminEdit={handleCancelAdminEdit}
                  onAddSuperAdmin={handleAddSuperAdmin}
                  onRemoveSuperAdmin={handleRemoveSuperAdmin}
                />
              </>
            ) : activeView === "workforce" ? (
              activeWorkforceSection === "partners" ? (
                <GlobalWorkforcePanel activeUser={activeUser} />
              ) : (
                <GlobalWorkforceAdminPanel
                  activeUser={activeUser}
                  activeSection={activeWorkforceSection}
                  routeBase="/super?view=workforce"
                  canManageJobs
                  isSuperAdmin
                />
              )
            ) : activeView === "data-collection" ? (
              <DataCollectionAdminPanel
                activeUser={activeUser}
                activeSection={activeDCSection}
                isSuperAdmin
              />
            ) : activeView === "evaluation-transcription" ? (
              <EvalTranscriptionPanel
                activeUser={activeUser}
                activeSection={activeEvalSection}
                isSuperAdmin
              />
            ) : activeView === "crowd-work" ? (
              <CrowdWorkAdminPanel activeUser={activeUser} isSuperAdmin />
            ) : activeView === "company" ? (
              <CompanyPanel activeUser={activeUser} />
            ) : activeView === "careers" ? (
              <CareersPanel activeUser={activeUser} />
            ) : (
              <SuperAdminTeamPanel
                adminApprovals={adminApprovals}
                reviewerEmail={normalizeEmail(activeUser.email)}
              />
            )}
          </div>
        </div>
      </main>
    </DeaimerSiteShell>
  );
  return superThemeClass ? <div className={superThemeClass}>{superShell}</div> : superShell;
}
