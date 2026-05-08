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
import { deleteObject, getDownloadURL, ref, uploadBytes } from "firebase/storage";

import type { PortalProfile } from "@/lib/firebase/user-profiles";
import { getFirebaseClientServices } from "@/lib/firebase/client";
import type { AdminApprovalRecord } from "@/lib/firebase/admin-access";

export type AdminProfileSectionKey =
  | "identity"
  | "address"
  | "bank-payroll"
  | "tax-info"
  | "documents"
  | "policy-documents";

export type AdminRequestSectionKey =
  | "leave"
  | "compensation"
  | "history";

export type AdminRequestCategory = "leave" | "compensation";
export type AdminRequestStatus =
  | "pending"
  | "under-review"
  | "approved"
  | "rejected";

export interface AdminIdentityDraft {
  fullName: string;
  preferredName: string;
  profilePhotoUrl: string;
  workEmail: string;
  personalEmail: string;
  phone: string;
  employeeId: string;
  department: string;
  subDepartment: string;
  roleTitle: string;
  managerName: string;
  managerEmail: string;
  dateOfJoining: string;
  employmentType: string;
  employmentStatus: string;
}

export interface AdminAddressDraft {
  currentAddress: string;
  permanentAddress: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export interface AdminBankPayrollDraft {
  accountTitle: string;
  bankName: string;
  iban: string;
  accountNumber: string;
  branchCode: string;
  paymentMethod: string;
  payrollCycle: string;
  salaryCurrency: string;
  baseSalary: string;
  bonusEligible: boolean;
  commissionEligible: boolean;
}

export interface AdminTaxInfoDraft {
  cnicNumber: string;
  ntnNumber: string;
  filerStatus: string;
  taxResidence: string;
  zakatDeduction: string;
  eobiNumber: string;
  socialSecurityNumber: string;
}

export interface AdminStoredDocument {
  fileName: string;
  fileUrl: string;
  filePath: string;
  contentType: string;
  sizeBytes: number;
}

export interface AdminDocumentsDraft {
  cnicFront: AdminStoredDocument | null;
  cnicBack: AdminStoredDocument | null;
  bankProof: AdminStoredDocument | null;
  signedContract: AdminStoredDocument | null;
}

export interface AdminPolicyDocumentsDraft {
  codeOfConductSigned: boolean;
  confidentialityAgreementSigned: boolean;
  dataProtectionPolicySigned: boolean;
  acceptableUsePolicySigned: boolean;
  payrollPolicySigned: boolean;
  signedAt: string;
}

export interface AdminWorkspaceProfileDraft {
  identity: AdminIdentityDraft;
  address: AdminAddressDraft;
  bankPayroll: AdminBankPayrollDraft;
  taxInfo: AdminTaxInfoDraft;
  documents: AdminDocumentsDraft;
  policyDocuments: AdminPolicyDocumentsDraft;
}

export interface AdminWorkspaceProfile extends AdminWorkspaceProfileDraft {
  uid: string;
  authEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminDocumentUpload extends AdminStoredDocument {}

export interface AdminRequestDraft {
  category: AdminRequestCategory;
  requestType: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  daysRequested: string;
  amountRequested: string;
  currency: string;
}

export interface AdminRequestRecord extends AdminRequestDraft {
  id: string;
  uid: string;
  requesterName: string;
  requesterEmail: string;
  status: AdminRequestStatus;
  reviewerNote: string;
  reviewedByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface AdminPaymentRecord {
  id: string;
  uid: string;
  adminEmail: string;
  paymentMonth: string;
  amount: string;
  currency: string;
  note: string;
  releasedByEmail: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export const adminEmploymentTypeOptions = [
  "Full-time",
  "Part-time",
  "Contract",
  "Probation",
  "Internship",
] as const;

export const adminEmploymentStatusOptions = [
  "Active",
  "On probation",
  "Notice period",
  "Inactive",
] as const;

export const adminPaymentMethodOptions = [
  "Bank transfer",
  "Cheque",
  "Cash",
] as const;

export const adminPayrollCycleOptions = [
  "Monthly",
  "Bi-weekly",
  "Weekly",
] as const;

export const adminFilerStatusOptions = [
  "Filer",
  "Non-filer",
  "Pending registration",
] as const;

export const adminZakatDeductionOptions = [
  "Deduct zakat",
  "Do not deduct zakat",
] as const;

export const adminLeaveRequestTypeOptions = [
  "Casual leave",
  "Sick leave",
  "Annual leave",
  "Medical leave",
  "Half day",
  "Work from home",
  "Unpaid leave",
] as const;

export const adminCompensationRequestTypeOptions = [
  "Bonus review",
  "Commission review",
  "Salary adjustment request",
  "Reimbursement request",
  "Advance salary request",
] as const;

export const adminRequestStatusOptions: AdminRequestStatus[] = [
  "pending",
  "under-review",
  "approved",
  "rejected",
];

export const adminDocumentMaxFileSizeBytes = 6 * 1024 * 1024;
export const adminProfilePhotoMaxFileSizeBytes = 3 * 1024 * 1024;

const allowedAdminDocumentContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

const allowedAdminPhotoContentTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const emptyStoredDocument: AdminStoredDocument | null = null;

export const emptyAdminRequestDraft: AdminRequestDraft = {
  category: "leave",
  requestType: "",
  title: "",
  description: "",
  startDate: "",
  endDate: "",
  daysRequested: "",
  amountRequested: "",
  currency: "PKR",
};

export function emptyAdminWorkspaceProfileDraft(): AdminWorkspaceProfileDraft {
  return {
    identity: {
      fullName: "",
      preferredName: "",
      profilePhotoUrl: "",
      workEmail: "",
      personalEmail: "",
      phone: "",
      employeeId: "",
      department: "",
      subDepartment: "",
      roleTitle: "",
      managerName: "",
      managerEmail: "",
      dateOfJoining: "",
      employmentType: "Full-time",
      employmentStatus: "Active",
    },
    address: {
      currentAddress: "",
      permanentAddress: "",
      city: "",
      province: "",
      postalCode: "",
      country: "Pakistan",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: "",
    },
    bankPayroll: {
      accountTitle: "",
      bankName: "",
      iban: "",
      accountNumber: "",
      branchCode: "",
      paymentMethod: "Bank transfer",
      payrollCycle: "Monthly",
      salaryCurrency: "PKR",
      baseSalary: "",
      bonusEligible: true,
      commissionEligible: false,
    },
    taxInfo: {
      cnicNumber: "",
      ntnNumber: "",
      filerStatus: "Filer",
      taxResidence: "Pakistan",
      zakatDeduction: "Deduct zakat",
      eobiNumber: "",
      socialSecurityNumber: "",
    },
    documents: {
      cnicFront: emptyStoredDocument,
      cnicBack: emptyStoredDocument,
      bankProof: emptyStoredDocument,
      signedContract: emptyStoredDocument,
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

function mapStoredDocument(data: unknown): AdminStoredDocument | null {
  if (!data || typeof data !== "object") {
    return null;
  }

  const source = data as Record<string, unknown>;

  if (!source.fileUrl) {
    return null;
  }

  return {
    fileName: String(source.fileName ?? ""),
    fileUrl: String(source.fileUrl ?? ""),
    filePath: String(source.filePath ?? ""),
    contentType: String(source.contentType ?? ""),
    sizeBytes: Math.max(0, Number(source.sizeBytes ?? 0)),
  };
}

function mapAdminProfileDocument(uid: string, data: DocumentData): AdminWorkspaceProfile {
  const emptyDraft = emptyAdminWorkspaceProfileDraft();

  return {
    uid,
    authEmail: String(data.authEmail ?? ""),
    identity: {
      fullName: String(data.identity?.fullName ?? emptyDraft.identity.fullName),
      preferredName: String(
        data.identity?.preferredName ?? emptyDraft.identity.preferredName,
      ),
      profilePhotoUrl: String(
        data.identity?.profilePhotoUrl ?? emptyDraft.identity.profilePhotoUrl,
      ),
      workEmail: String(data.identity?.workEmail ?? emptyDraft.identity.workEmail),
      personalEmail: String(
        data.identity?.personalEmail ?? emptyDraft.identity.personalEmail,
      ),
      phone: String(data.identity?.phone ?? emptyDraft.identity.phone),
      employeeId: String(data.identity?.employeeId ?? emptyDraft.identity.employeeId),
      department: String(data.identity?.department ?? emptyDraft.identity.department),
      subDepartment: String(
        data.identity?.subDepartment ?? emptyDraft.identity.subDepartment,
      ),
      roleTitle: String(data.identity?.roleTitle ?? emptyDraft.identity.roleTitle),
      managerName: String(data.identity?.managerName ?? emptyDraft.identity.managerName),
      managerEmail: String(
        data.identity?.managerEmail ?? emptyDraft.identity.managerEmail,
      ),
      dateOfJoining: String(
        data.identity?.dateOfJoining ?? emptyDraft.identity.dateOfJoining,
      ),
      employmentType: String(
        data.identity?.employmentType ?? emptyDraft.identity.employmentType,
      ),
      employmentStatus: String(
        data.identity?.employmentStatus ?? emptyDraft.identity.employmentStatus,
      ),
    },
    address: {
      currentAddress: String(
        data.address?.currentAddress ?? emptyDraft.address.currentAddress,
      ),
      permanentAddress: String(
        data.address?.permanentAddress ?? emptyDraft.address.permanentAddress,
      ),
      city: String(data.address?.city ?? emptyDraft.address.city),
      province: String(data.address?.province ?? emptyDraft.address.province),
      postalCode: String(data.address?.postalCode ?? emptyDraft.address.postalCode),
      country: String(data.address?.country ?? emptyDraft.address.country),
      emergencyContactName: String(
        data.address?.emergencyContactName ??
          emptyDraft.address.emergencyContactName,
      ),
      emergencyContactPhone: String(
        data.address?.emergencyContactPhone ??
          emptyDraft.address.emergencyContactPhone,
      ),
      emergencyContactRelation: String(
        data.address?.emergencyContactRelation ??
          emptyDraft.address.emergencyContactRelation,
      ),
    },
    bankPayroll: {
      accountTitle: String(
        data.bankPayroll?.accountTitle ?? emptyDraft.bankPayroll.accountTitle,
      ),
      bankName: String(data.bankPayroll?.bankName ?? emptyDraft.bankPayroll.bankName),
      iban: String(data.bankPayroll?.iban ?? emptyDraft.bankPayroll.iban),
      accountNumber: String(
        data.bankPayroll?.accountNumber ?? emptyDraft.bankPayroll.accountNumber,
      ),
      branchCode: String(
        data.bankPayroll?.branchCode ?? emptyDraft.bankPayroll.branchCode,
      ),
      paymentMethod: String(
        data.bankPayroll?.paymentMethod ?? emptyDraft.bankPayroll.paymentMethod,
      ),
      payrollCycle: String(
        data.bankPayroll?.payrollCycle ?? emptyDraft.bankPayroll.payrollCycle,
      ),
      salaryCurrency: String(
        data.bankPayroll?.salaryCurrency ?? emptyDraft.bankPayroll.salaryCurrency,
      ),
      baseSalary: String(
        data.bankPayroll?.baseSalary ?? emptyDraft.bankPayroll.baseSalary,
      ),
      bonusEligible: Boolean(
        data.bankPayroll?.bonusEligible ?? emptyDraft.bankPayroll.bonusEligible,
      ),
      commissionEligible: Boolean(
        data.bankPayroll?.commissionEligible ??
          emptyDraft.bankPayroll.commissionEligible,
      ),
    },
    taxInfo: {
      cnicNumber: String(data.taxInfo?.cnicNumber ?? emptyDraft.taxInfo.cnicNumber),
      ntnNumber: String(data.taxInfo?.ntnNumber ?? emptyDraft.taxInfo.ntnNumber),
      filerStatus: String(
        data.taxInfo?.filerStatus ?? emptyDraft.taxInfo.filerStatus,
      ),
      taxResidence: String(
        data.taxInfo?.taxResidence ?? emptyDraft.taxInfo.taxResidence,
      ),
      zakatDeduction: String(
        data.taxInfo?.zakatDeduction ?? emptyDraft.taxInfo.zakatDeduction,
      ),
      eobiNumber: String(data.taxInfo?.eobiNumber ?? emptyDraft.taxInfo.eobiNumber),
      socialSecurityNumber: String(
        data.taxInfo?.socialSecurityNumber ??
          emptyDraft.taxInfo.socialSecurityNumber,
      ),
    },
    documents: {
      cnicFront: mapStoredDocument(data.documents?.cnicFront),
      cnicBack: mapStoredDocument(data.documents?.cnicBack),
      bankProof: mapStoredDocument(data.documents?.bankProof),
      signedContract: mapStoredDocument(data.documents?.signedContract),
    },
    policyDocuments: {
      codeOfConductSigned: Boolean(
        data.policyDocuments?.codeOfConductSigned ??
          emptyDraft.policyDocuments.codeOfConductSigned,
      ),
      confidentialityAgreementSigned: Boolean(
        data.policyDocuments?.confidentialityAgreementSigned ??
          emptyDraft.policyDocuments.confidentialityAgreementSigned,
      ),
      dataProtectionPolicySigned: Boolean(
        data.policyDocuments?.dataProtectionPolicySigned ??
          emptyDraft.policyDocuments.dataProtectionPolicySigned,
      ),
      acceptableUsePolicySigned: Boolean(
        data.policyDocuments?.acceptableUsePolicySigned ??
          emptyDraft.policyDocuments.acceptableUsePolicySigned,
      ),
      payrollPolicySigned: Boolean(
        data.policyDocuments?.payrollPolicySigned ??
          emptyDraft.policyDocuments.payrollPolicySigned,
      ),
      signedAt: String(
        data.policyDocuments?.signedAt ?? emptyDraft.policyDocuments.signedAt,
      ),
    },
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapAdminRequestDocument(id: string, data: DocumentData): AdminRequestRecord {
  return {
    id,
    uid: String(data.uid ?? ""),
    requesterName: String(data.requesterName ?? ""),
    requesterEmail: String(data.requesterEmail ?? ""),
    category: data.category === "compensation" ? "compensation" : "leave",
    requestType: String(data.requestType ?? ""),
    title: String(data.title ?? ""),
    description: String(data.description ?? ""),
    startDate: String(data.startDate ?? ""),
    endDate: String(data.endDate ?? ""),
    daysRequested: String(data.daysRequested ?? ""),
    amountRequested: String(data.amountRequested ?? ""),
    currency: String(data.currency ?? "PKR"),
    status:
      data.status === "under-review" ||
      data.status === "approved" ||
      data.status === "rejected"
        ? data.status
        : "pending",
    reviewerNote: String(data.reviewerNote ?? ""),
    reviewedByEmail: String(data.reviewedByEmail ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function mapAdminPaymentDocument(id: string, data: DocumentData): AdminPaymentRecord {
  return {
    id,
    uid: String(data.uid ?? ""),
    adminEmail: String(data.adminEmail ?? ""),
    paymentMonth: String(data.paymentMonth ?? ""),
    amount: String(data.amount ?? ""),
    currency: String(data.currency ?? "PKR"),
    note: String(data.note ?? ""),
    releasedByEmail: String(data.releasedByEmail ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
}

function buildAdminProfileRef(uid: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "adminProfiles", uid);
}

function getAdminProfilesCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "adminProfiles");
}

function getAdminRequestsCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "adminRequests");
}

function getAdminPaymentsCollection() {
  const { firestore } = getFirebaseClientServices();
  return collection(firestore, "adminPayments");
}

function buildAdminRequestRef(requestId: string) {
  const { firestore } = getFirebaseClientServices();
  return doc(firestore, "adminRequests", requestId);
}

function sanitizeDocumentFileName(fileName: string) {
  return (fileName.trim() || "document").replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createAdminWorkspaceProfileDraft(
  user: User,
  portalProfile: PortalProfile | null,
  adminApproval?: AdminApprovalRecord | null,
): AdminWorkspaceProfileDraft {
  const draft = emptyAdminWorkspaceProfileDraft();
  const profileDefaults = adminApproval?.profileDefaults;

  return {
    ...draft,
    identity: {
      ...draft.identity,
      fullName: portalProfile?.fullName || user.displayName || "",
      preferredName: portalProfile?.fullName || user.displayName || "",
      profilePhotoUrl: portalProfile?.photoUrl || user.photoURL || "",
      workEmail: portalProfile?.email || user.email || "",
      personalEmail: user.email || "",
      phone: portalProfile?.phone || user.phoneNumber || "",
      employeeId: profileDefaults?.identity.employeeId || "",
      department: profileDefaults?.identity.department || portalProfile?.organization || "",
      subDepartment: profileDefaults?.identity.subDepartment || "",
      roleTitle: profileDefaults?.identity.roleTitle || portalProfile?.jobTitle || "",
      managerName: profileDefaults?.identity.managerName || "",
      managerEmail: profileDefaults?.identity.managerEmail || "",
      dateOfJoining: profileDefaults?.identity.dateOfJoining || "",
      employmentType: profileDefaults?.identity.employmentType || draft.identity.employmentType,
      employmentStatus: profileDefaults?.identity.employmentStatus || draft.identity.employmentStatus,
    },
    address: {
      ...draft.address,
      city: portalProfile?.location || "",
    },
    bankPayroll: {
      ...draft.bankPayroll,
      payrollCycle: profileDefaults?.bankPayroll.payrollCycle || draft.bankPayroll.payrollCycle,
      salaryCurrency: profileDefaults?.bankPayroll.salaryCurrency || draft.bankPayroll.salaryCurrency,
      baseSalary: profileDefaults?.bankPayroll.baseSalary || "",
      bonusEligible: profileDefaults?.bankPayroll.bonusEligible ?? draft.bankPayroll.bonusEligible,
      commissionEligible:
        profileDefaults?.bankPayroll.commissionEligible ??
        draft.bankPayroll.commissionEligible,
    },
    policyDocuments: {
      ...draft.policyDocuments,
      ...(profileDefaults?.policyDocuments ?? {}),
    },
  };
}

export async function getAdminWorkspaceProfile(uid: string) {
  const snapshot = await getDoc(buildAdminProfileRef(uid));

  if (!snapshot.exists()) {
    return null;
  }

  return mapAdminProfileDocument(uid, snapshot.data());
}

export async function saveAdminWorkspaceProfile(
  user: User,
  profileDraft: AdminWorkspaceProfileDraft,
) {
  return saveAdminWorkspaceProfileByUid(user.uid, user.email ?? "", profileDraft);
}

export async function saveAdminWorkspaceProfileByUid(
  uid: string,
  authEmail: string,
  profileDraft: AdminWorkspaceProfileDraft,
) {
  const profileRef = buildAdminProfileRef(uid);
  const existingProfile = await getAdminWorkspaceProfile(uid);

  await setDoc(
    profileRef,
    {
      uid,
      authEmail,
      identity: profileDraft.identity,
      address: profileDraft.address,
      bankPayroll: profileDraft.bankPayroll,
      taxInfo: profileDraft.taxInfo,
      documents: profileDraft.documents,
      policyDocuments: profileDraft.policyDocuments,
      updatedAt: serverTimestamp(),
      ...(existingProfile
        ? {}
        : {
            createdAt: serverTimestamp(),
          }),
    },
    { merge: true },
  );

  return getAdminWorkspaceProfile(uid);
}

export async function uploadAdminDocument(
  user: User,
  documentKey: keyof AdminDocumentsDraft,
  file: File,
): Promise<AdminDocumentUpload> {
  if (file.size > adminDocumentMaxFileSizeBytes) {
    throw new Error("Admin documents must be 6 MB or smaller.");
  }

  if (!allowedAdminDocumentContentTypes.has(file.type)) {
    throw new Error("Documents must be JPG, PNG, WEBP, or PDF files.");
  }

  const { storage } = getFirebaseClientServices();
  const sanitizedFileName = sanitizeDocumentFileName(file.name);
  const filePath = `adminDocuments/${user.uid}/${documentKey}/${Date.now()}-${sanitizedFileName}`;
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

export async function uploadAdminProfilePhoto(
  user: User,
  file: File,
): Promise<string> {
  if (file.size > adminProfilePhotoMaxFileSizeBytes) {
    throw new Error("Profile photos must be 3 MB or smaller.");
  }

  if (!allowedAdminPhotoContentTypes.has(file.type)) {
    throw new Error("Profile photos must be JPG, PNG, or WEBP files.");
  }

  const { storage } = getFirebaseClientServices();
  const sanitizedFileName = sanitizeDocumentFileName(file.name);
  const filePath = `adminProfilePhotos/${user.uid}/${Date.now()}-${sanitizedFileName}`;
  const storageRef = ref(storage, filePath);

  await uploadBytes(storageRef, file, {
    contentType: file.type,
  });

  return getDownloadURL(storageRef);
}

export async function deleteAdminDocument(document: AdminStoredDocument | null) {
  if (!document?.filePath) {
    return;
  }

  const { storage } = getFirebaseClientServices();
  try {
    await deleteObject(ref(storage, document.filePath));
  } catch (error) {
    const code = (error as { code?: string } | undefined)?.code;

    if (code !== "storage/object-not-found") {
      throw error;
    }
  }
}

export function subscribeToAdminWorkspaceProfile(
  uid: string | null | undefined,
  callback: (profile: AdminWorkspaceProfile | null) => void,
  onError?: (error: Error) => void,
) {
  if (!uid) {
    callback(null);
    return () => undefined;
  }

  return onSnapshot(
    buildAdminProfileRef(uid),
    (snapshot) => {
      callback(
        snapshot.exists() ? mapAdminProfileDocument(uid, snapshot.data()) : null,
      );
    },
    (error) => {
      onError?.(error);
    },
  );
}

export async function submitAdminRequest(
  user: User,
  profile: AdminWorkspaceProfile | null,
  requestDraft: AdminRequestDraft,
) {
  const requestRef = doc(getAdminRequestsCollection());

  await setDoc(requestRef, {
    uid: user.uid,
    requesterName:
      profile?.identity.fullName || user.displayName || user.email || "Admin",
    requesterEmail: user.email ?? "",
    category: requestDraft.category,
    requestType: requestDraft.requestType.trim(),
    title: requestDraft.title.trim(),
    description: requestDraft.description.trim(),
    startDate: requestDraft.startDate.trim(),
    endDate: requestDraft.endDate.trim(),
    daysRequested: requestDraft.daysRequested.trim(),
    amountRequested: requestDraft.amountRequested.trim(),
    currency: requestDraft.currency.trim() || "PKR",
    status: "pending",
    reviewerNote: "",
    reviewedByEmail: "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToAdminRequestsByUser(
  uid: string | null | undefined,
  callback: (requests: AdminRequestRecord[]) => void,
  onError?: (error: Error) => void,
) {
  if (!uid) {
    callback([]);
    return () => undefined;
  }

  const requestsQuery = query(
    getAdminRequestsCollection(),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) =>
          mapAdminRequestDocument(document.id, document.data()),
        ),
      );
    },
    (error) => {
      onError?.(error);
    },
  );
}

export function subscribeToAllAdminProfiles(
  callback: (profiles: AdminWorkspaceProfile[]) => void,
  onError?: (error: Error) => void,
) {
  const profilesQuery = query(
    getAdminProfilesCollection(),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    profilesQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) =>
          mapAdminProfileDocument(document.id, document.data()),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeToAllAdminRequests(
  callback: (requests: AdminRequestRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const requestsQuery = query(
    getAdminRequestsCollection(),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    requestsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) =>
          mapAdminRequestDocument(document.id, document.data()),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeToAdminPaymentsByUser(
  uid: string | null | undefined,
  callback: (payments: AdminPaymentRecord[]) => void,
  onError?: (error: Error) => void,
) {
  if (!uid) {
    callback([]);
    return () => undefined;
  }

  const paymentsQuery = query(
    getAdminPaymentsCollection(),
    where("uid", "==", uid),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    paymentsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) =>
          mapAdminPaymentDocument(document.id, document.data()),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export function subscribeToAllAdminPayments(
  callback: (payments: AdminPaymentRecord[]) => void,
  onError?: (error: Error) => void,
) {
  const paymentsQuery = query(
    getAdminPaymentsCollection(),
    orderBy("updatedAt", "desc"),
  );

  return onSnapshot(
    paymentsQuery,
    (snapshot) => {
      callback(
        snapshot.docs.map((document) =>
          mapAdminPaymentDocument(document.id, document.data()),
        ),
      );
    },
    (error) => onError?.(error),
  );
}

export async function releaseAdminPayment(input: {
  uid: string;
  adminEmail: string;
  paymentMonth: string;
  amount: string;
  currency: string;
  note: string;
  releasedByEmail: string;
}) {
  const paymentRef = doc(getAdminPaymentsCollection());

  await setDoc(paymentRef, {
    uid: input.uid,
    adminEmail: input.adminEmail.trim(),
    paymentMonth: input.paymentMonth.trim(),
    amount: input.amount.trim(),
    currency: input.currency.trim() || "PKR",
    note: input.note.trim(),
    releasedByEmail: input.releasedByEmail.trim(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function updateAdminRequestStatus(
  requestId: string,
  status: AdminRequestStatus,
  reviewerEmail: string,
  reviewerNote: string,
) {
  await updateDoc(buildAdminRequestRef(requestId), {
    status,
    reviewedByEmail: reviewerEmail.trim(),
    reviewerNote: reviewerNote.trim(),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAdminProfileAndRelatedData(uid: string) {
  const requestsSnapshot = await getDocs(
    query(getAdminRequestsCollection(), where("uid", "==", uid)),
  );

  await Promise.all(requestsSnapshot.docs.map((document) => deleteDoc(document.ref)));
  await deleteDoc(buildAdminProfileRef(uid));
}

export function getAdminProfileCompletion(profile: AdminWorkspaceProfile | null) {
  if (!profile) {
    return {
      completedSections: 0,
      totalSections: 6,
      missingRequirements: [
        "Identity details",
        "Address details",
        "Bank and payroll details",
        "Tax information",
        "CNIC uploads",
        "Policy acknowledgements",
      ],
    };
  }

  const sectionChecks = [
    {
      key: "identity",
      done:
        Boolean(profile.identity.fullName.trim()) &&
        Boolean(profile.identity.workEmail.trim()) &&
        Boolean(profile.identity.roleTitle.trim()),
      missing: "Identity details",
    },
    {
      key: "address",
      done:
        Boolean(profile.address.currentAddress.trim()) &&
        Boolean(profile.address.city.trim()) &&
        Boolean(profile.address.country.trim()) &&
        Boolean(profile.address.emergencyContactName.trim()),
      missing: "Address details",
    },
    {
      key: "bank-payroll",
      done:
        Boolean(profile.bankPayroll.accountTitle.trim()) &&
        Boolean(profile.bankPayroll.bankName.trim()) &&
        Boolean(profile.bankPayroll.iban.trim()),
      missing: "Bank and payroll details",
    },
    {
      key: "tax-info",
      done: Boolean(profile.taxInfo.cnicNumber.trim()),
      missing: "Tax information",
    },
    {
      key: "documents",
      done: Boolean(profile.documents.cnicFront?.fileUrl) &&
        Boolean(profile.documents.cnicBack?.fileUrl),
      missing: "CNIC uploads",
    },
    {
      key: "policy-documents",
      done:
        profile.policyDocuments.codeOfConductSigned &&
        profile.policyDocuments.confidentialityAgreementSigned &&
        profile.policyDocuments.dataProtectionPolicySigned &&
        profile.policyDocuments.acceptableUsePolicySigned &&
        profile.policyDocuments.payrollPolicySigned,
      missing: "Policy acknowledgements",
    },
  ];

  return {
    completedSections: sectionChecks.filter((section) => section.done).length,
    totalSections: sectionChecks.length,
    missingRequirements: sectionChecks
      .filter((section) => !section.done)
      .map((section) => section.missing),
  };
}
