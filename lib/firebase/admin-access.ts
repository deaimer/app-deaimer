import type { User } from "firebase/auth";
import {
  deleteDoc,
  doc,
  DocumentData,
  getDoc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { normalizeEmail } from "@/lib/auth/access-control";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import { requestSuperAccessApi } from "@/lib/firebase/super-access-api";
import { servicePages } from "@/lib/service-pages";

export type AdminServicePermission = string;

export interface AdminAccessProfileDefaults {
  identity: {
    employeeId: string;
    department: string;
    subDepartment: string;
    roleTitle: string;
    managerName: string;
    managerEmail: string;
    dateOfJoining: string;
    employmentType: string;
    employmentStatus: string;
  };
  bankPayroll: {
    payrollCycle: string;
    salaryCurrency: string;
    baseSalary: string;
    bonusEligible: boolean;
    commissionEligible: boolean;
  };
  policyDocuments: {
    codeOfConductSigned: boolean;
    confidentialityAgreementSigned: boolean;
    dataProtectionPolicySigned: boolean;
    acceptableUsePolicySigned: boolean;
    payrollPolicySigned: boolean;
    signedAt: string;
  };
}

export interface AdminApprovalInput {
  email: string;
  company: string;
  contactName: string;
  notes: string;
  servicePermissions: AdminServicePermission[];
  profileDefaults: AdminAccessProfileDefaults;
  assignedProjectIds?: string[];
}

export interface AdminApprovalRecord extends AdminApprovalInput {
  id: string;
  status: "approved";
  invitedByEmail: string;
  invitedByUid: string;
  assignedProjectIds: string[];
  createdAt?: unknown;
  updatedAt?: unknown;
}

const allowedServicePermissionSet = new Set(
  servicePages.map((service) => service.slug),
);

export function emptyAdminAccessProfileDefaults(): AdminAccessProfileDefaults {
  return {
    identity: {
      employeeId: "",
      department: "Delivery Operations",
      subDepartment: "Data Collection",
      roleTitle: "",
      managerName: "",
      managerEmail: "",
      dateOfJoining: "",
      employmentType: "Full-time",
      employmentStatus: "Active",
    },
    bankPayroll: {
      payrollCycle: "Monthly",
      salaryCurrency: "PKR",
      baseSalary: "",
      bonusEligible: true,
      commissionEligible: false,
    },
    policyDocuments: {
      codeOfConductSigned: false,
      confidentialityAgreementSigned: false,
      dataProtectionPolicySigned: false,
      acceptableUsePolicySigned: false,
      payrollPolicySigned: false,
      signedAt: "",
    },
  };
}

function mapAdminAccessProfileDefaults(data: unknown): AdminAccessProfileDefaults {
  const defaults = emptyAdminAccessProfileDefaults();
  const value = data && typeof data === "object" ? data as Record<string, any> : {};

  return {
    identity: {
      employeeId: String(value.identity?.employeeId ?? defaults.identity.employeeId),
      department: String(value.identity?.department ?? defaults.identity.department),
      subDepartment: String(value.identity?.subDepartment ?? defaults.identity.subDepartment),
      roleTitle: String(value.identity?.roleTitle ?? defaults.identity.roleTitle),
      managerName: String(value.identity?.managerName ?? defaults.identity.managerName),
      managerEmail: String(value.identity?.managerEmail ?? defaults.identity.managerEmail),
      dateOfJoining: String(value.identity?.dateOfJoining ?? defaults.identity.dateOfJoining),
      employmentType: String(value.identity?.employmentType ?? defaults.identity.employmentType),
      employmentStatus: String(value.identity?.employmentStatus ?? defaults.identity.employmentStatus),
    },
    bankPayroll: {
      payrollCycle: String(value.bankPayroll?.payrollCycle ?? defaults.bankPayroll.payrollCycle),
      salaryCurrency: String(value.bankPayroll?.salaryCurrency ?? defaults.bankPayroll.salaryCurrency),
      baseSalary: String(value.bankPayroll?.baseSalary ?? defaults.bankPayroll.baseSalary),
      bonusEligible: Boolean(value.bankPayroll?.bonusEligible ?? defaults.bankPayroll.bonusEligible),
      commissionEligible: Boolean(value.bankPayroll?.commissionEligible ?? defaults.bankPayroll.commissionEligible),
    },
    policyDocuments: {
      codeOfConductSigned: Boolean(value.policyDocuments?.codeOfConductSigned ?? defaults.policyDocuments.codeOfConductSigned),
      confidentialityAgreementSigned: Boolean(value.policyDocuments?.confidentialityAgreementSigned ?? defaults.policyDocuments.confidentialityAgreementSigned),
      dataProtectionPolicySigned: Boolean(value.policyDocuments?.dataProtectionPolicySigned ?? defaults.policyDocuments.dataProtectionPolicySigned),
      acceptableUsePolicySigned: Boolean(value.policyDocuments?.acceptableUsePolicySigned ?? defaults.policyDocuments.acceptableUsePolicySigned),
      payrollPolicySigned: Boolean(value.policyDocuments?.payrollPolicySigned ?? defaults.policyDocuments.payrollPolicySigned),
      signedAt: String(value.policyDocuments?.signedAt ?? defaults.policyDocuments.signedAt),
    },
  };
}

function sanitizeAdminAccessProfileDefaults(
  defaults: AdminAccessProfileDefaults | null | undefined,
): AdminAccessProfileDefaults {
  const mapped = mapAdminAccessProfileDefaults(defaults);
  const numericEmployeeId = mapped.identity.employeeId.replace(/\D/g, "");

  return {
    identity: {
      employeeId: numericEmployeeId.slice(0, 5).padStart(5, "0"),
      department: mapped.identity.department.trim(),
      subDepartment: mapped.identity.subDepartment.trim(),
      roleTitle: mapped.identity.roleTitle.trim(),
      managerName: mapped.identity.managerName.trim(),
      managerEmail: normalizeEmail(mapped.identity.managerEmail),
      dateOfJoining: mapped.identity.dateOfJoining,
      employmentType: mapped.identity.employmentType.trim() || "Full-time",
      employmentStatus: mapped.identity.employmentStatus.trim() || "Active",
    },
    bankPayroll: {
      payrollCycle: mapped.bankPayroll.payrollCycle.trim() || "Monthly",
      salaryCurrency: mapped.bankPayroll.salaryCurrency.trim() || "PKR",
      baseSalary: mapped.bankPayroll.baseSalary.trim(),
      bonusEligible: mapped.bankPayroll.bonusEligible,
      commissionEligible: mapped.bankPayroll.commissionEligible,
    },
    policyDocuments: {
      ...mapped.policyDocuments,
      signedAt: mapped.policyDocuments.signedAt,
    },
  };
}

function normalizeServicePermissions(
  permissions: AdminServicePermission[] | null | undefined,
) {
  const permissionList = Array.isArray(permissions) ? permissions : [];

  return Array.from(
    new Set(
      permissionList.filter((permission) =>
        allowedServicePermissionSet.has(permission),
      ),
    ),
  );
}

function buildAdminAccessRef(email: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "adminAccess", normalizeEmail(email));
}

function mapAdminApproval(data: DocumentData, id: string): AdminApprovalRecord {
  return {
    id,
    email: String(data.email ?? id),
    company: String(data.company ?? ""),
    contactName: String(data.contactName ?? ""),
    notes: String(data.notes ?? ""),
    servicePermissions: normalizeServicePermissions(data.servicePermissions),
    profileDefaults: mapAdminAccessProfileDefaults(data.profileDefaults),
    status: "approved",
    invitedByEmail: String(data.invitedByEmail ?? ""),
    invitedByUid: String(data.invitedByUid ?? ""),
    assignedProjectIds: Array.isArray(data.assignedProjectIds)
      ? data.assignedProjectIds.map(String)
      : [],
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

export async function getAdminApproval(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const snapshot = await getDoc(buildAdminAccessRef(normalizedEmail));

  if (!snapshot.exists()) {
    return null;
  }

  return mapAdminApproval(snapshot.data(), snapshot.id);
}

export async function saveAdminApproval(user: User, approval: AdminApprovalInput) {
  const normalizedEmail = normalizeEmail(approval.email);
  const normalizedPermissions = normalizeServicePermissions(
    approval.servicePermissions,
  );
  const profileDefaults = sanitizeAdminAccessProfileDefaults(
    approval.profileDefaults,
  );
  const existingApproval = await getAdminApproval(normalizedEmail);

  if (!normalizedEmail) {
    throw new Error("An admin email is required.");
  }

  if (normalizedPermissions.length === 0) {
    throw new Error("Select at least one service permission for this admin.");
  }

  await setDoc(
    buildAdminAccessRef(normalizedEmail),
    {
      email: normalizedEmail,
      company: approval.company.trim(),
      contactName: approval.contactName.trim(),
      notes: approval.notes.trim(),
      servicePermissions: normalizedPermissions,
      profileDefaults,
      status: "approved",
      invitedByEmail: normalizeEmail(user.email),
      invitedByUid: user.uid,
      updatedAt: serverTimestamp(),
      ...(existingApproval
        ? {}
        : {
            createdAt: serverTimestamp(),
            assignedProjectIds: [],
          }),
    },
    { merge: true },
  );
}

export async function deleteAdminApproval(email: string) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    throw new Error("An admin email is required.");
  }

  await deleteDoc(buildAdminAccessRef(normalizedEmail));
}

export function subscribeToAdminApprovals(
  callback: (records: AdminApprovalRecord[]) => void,
  onError?: (error: Error) => void,
) {
  void requestSuperAccessApi<{ admins: AdminApprovalRecord[] }>()
    .then((payload) => callback(payload.admins))
    .catch((error) => onError?.(error));

  return () => undefined;
}

export function subscribeToAdminApproval(
  email: string | null | undefined,
  callback: (record: AdminApprovalRecord | null) => void,
  onError?: (error: Error) => void,
) {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    callback(null);
    return () => undefined;
  }

  return onSnapshot(
    buildAdminAccessRef(normalizedEmail),
    (snapshot) => {
      callback(snapshot.exists() ? mapAdminApproval(snapshot.data(), snapshot.id) : null);
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function updateAdminProjectAssignment(
  email: string,
  projectIds: string[],
): Promise<void> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email is required.");
  await updateDoc(buildAdminAccessRef(normalizedEmail), {
    assignedProjectIds: projectIds,
    updatedAt: serverTimestamp(),
  });
}
