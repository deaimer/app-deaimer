import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

const BOOTSTRAP_SUPER_ADMIN_EMAILS = new Set([
  "deaimerpvt@gmail.com",
  "ms.awan@deaimer.com",
  "jannatawan12390@gmail.com",
  "shehryarsta460@gmail.com",
]);

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

function emptyAdminAccessProfileDefaults() {
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

function mapAdminAccessProfileDefaults(data: unknown) {
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

async function requireSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) {
    return { error: "Unauthorized", status: 401 as const };
  }

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);

    if (!email) {
      return { error: "No email on auth token", status: 401 as const };
    }

    if (BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email)) {
      return { email };
    }

    const accessSnapshot = await adminFirestore().doc(`superAccess/${email}`).get();

    if (!accessSnapshot.exists) {
      return { error: "Missing super admin access", status: 403 as const };
    }

    return { email };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid token",
      status: 401 as const,
    };
  }
}

function sortByEmail<T extends { email: string }>(records: T[]) {
  return records.sort((a, b) => a.email.localeCompare(b.email));
}

export async function GET(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const db = adminFirestore();
  const [clientSnapshot, adminSnapshot, superSnapshot] = await Promise.all([
    db.collection("clientAccess").get(),
    db.collection("adminAccess").get(),
    db.collection("superAccess").get(),
  ]);

  const clients = sortByEmail(clientSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      email: normalizeEmail(data.email || document.id),
      company: String(data.company ?? ""),
      contactName: String(data.contactName ?? ""),
      notes: String(data.notes ?? ""),
      status: "approved" as const,
      invitedByEmail: String(data.invitedByEmail ?? ""),
      invitedByUid: String(data.invitedByUid ?? ""),
    };
  }));

  const admins = sortByEmail(adminSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      id: document.id,
      email: normalizeEmail(data.email || document.id),
      company: String(data.company ?? ""),
      contactName: String(data.contactName ?? ""),
      notes: String(data.notes ?? ""),
      servicePermissions: Array.isArray(data.servicePermissions)
        ? data.servicePermissions.map(String)
        : [],
      profileDefaults: mapAdminAccessProfileDefaults(data.profileDefaults),
      status: "approved" as const,
      invitedByEmail: String(data.invitedByEmail ?? ""),
      invitedByUid: String(data.invitedByUid ?? ""),
      assignedProjectIds: Array.isArray(data.assignedProjectIds)
        ? data.assignedProjectIds.map(String)
        : [],
    };
  }));

  const superAdmins = sortByEmail(superSnapshot.docs.map((document) => {
    const data = document.data();
    return {
      email: normalizeEmail(data.email || document.id),
      invitedByEmail: String(data.invitedByEmail ?? ""),
      invitedByUid: String(data.invitedByUid ?? ""),
    };
  }));

  return NextResponse.json({ clients, admins, superAdmins });
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({})) as { email?: unknown };
  const email = normalizeEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  await adminFirestore().doc(`superAccess/${email}`).set({
    email,
    invitedByEmail: gate.email,
    invitedByUid: "",
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({})) as { email?: unknown };
  const email = normalizeEmail(body.email);

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  if (email === gate.email) {
    return NextResponse.json({ error: "You cannot remove your own super admin access." }, { status: 400 });
  }

  await adminFirestore().doc(`superAccess/${email}`).delete();

  return NextResponse.json({ ok: true });
}
