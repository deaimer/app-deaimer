import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

const BOOTSTRAP_SUPER_ADMIN_EMAILS = new Set([
  "deaimerpvt@gmail.com",
  "ms.awan@deaimer.com",
  "jannatawan12390@gmail.com",
  "shehryarsta460@gmail.com",
]);

function normalizeEmail(value: unknown) {
  return String(value ?? "").trim().toLowerCase();
}

function stringList(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function mapWorker(data: FirebaseFirestore.DocumentData, id: string) {
  const rawOwners = data.projectAssignmentOwners && typeof data.projectAssignmentOwners === "object"
    ? data.projectAssignmentOwners as Record<string, unknown>
    : {};
  const projectAssignmentOwners = Object.fromEntries(
    Object.entries(rawOwners).map(([projectId, owner]) => {
      const value = owner && typeof owner === "object" ? owner as Record<string, unknown> : {};
      return [projectId, {
        adminEmail: normalizeEmail(value.adminEmail),
        adminName: String(value.adminName ?? ""),
      }];
    }),
  );

  return {
    email: normalizeEmail(data.email || id),
    name: String(data.name ?? ""),
    roles: stringList(data.roles),
    assignedProjectIds: stringList(data.assignedProjectIds),
    projectAssignmentOwners,
    status: data.status === "paused" ? "paused" : "active",
    invitedByEmail: normalizeEmail(data.invitedByEmail),
    invitedByUid: String(data.invitedByUid ?? ""),
    invitedByRole: data.invitedByRole === "admin" ? "admin" : "super",
    invitedByAdminEmail: data.invitedByAdminEmail ? normalizeEmail(data.invitedByAdminEmail) : undefined,
    invitedByName: data.invitedByName ? String(data.invitedByName) : undefined,
  };
}

async function requireOpsAccess(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { error: "Unauthorized", status: 401 as const };

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on auth token", status: 401 as const };

    if (BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email)) {
      return { email, isSuper: true as const, assignedProjectIds: null };
    }

    const db = adminFirestore();
    const superSnap = await db.doc(`superAccess/${email}`).get();
    if (superSnap.exists) {
      return { email, isSuper: true as const, assignedProjectIds: null };
    }

    const adminSnap = await db.doc(`adminAccess/${email}`).get();
    if (!adminSnap.exists) return { error: "Missing admin access", status: 403 as const };

    const admin = adminSnap.data() ?? {};
    return {
      email,
      isSuper: false as const,
      assignedProjectIds: stringList(admin.assignedProjectIds),
    };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "Invalid token",
      status: 401 as const,
    };
  }
}

export async function GET(req: NextRequest) {
  const gate = await requireOpsAccess(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const requestedIds = Array.from(new Set(
    (req.nextUrl.searchParams.get("projectIds") ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  ));

  const allowedProjectIds = gate.isSuper
    ? requestedIds
    : requestedIds.filter((id) => gate.assignedProjectIds.includes(id));

  if (allowedProjectIds.length === 0) {
    return NextResponse.json({ workers: [] });
  }

  const db = adminFirestore();
  const workersByEmail = new Map<string, ReturnType<typeof mapWorker>>();

  await Promise.all(allowedProjectIds.map(async (projectId) => {
    const snap = await db.collection("opsWorkers")
      .where("assignedProjectIds", "array-contains", projectId)
      .get();
    snap.docs.forEach((doc) => {
      const worker = mapWorker(doc.data(), doc.id);
      workersByEmail.set(worker.email, worker);
    });
  }));

  const adminEmails = new Set<string>();
  workersByEmail.forEach((worker) => {
    if (worker.invitedByAdminEmail) adminEmails.add(worker.invitedByAdminEmail);
    Object.values(worker.projectAssignmentOwners).forEach((owner) => {
      if (owner.adminEmail) adminEmails.add(owner.adminEmail);
    });
  });

  const adminNames = new Map<string, string>();
  await Promise.all(Array.from(adminEmails).map(async (email) => {
    const snap = await db.doc(`adminAccess/${email}`).get();
    if (!snap.exists) return;
    const data = snap.data() ?? {};
    adminNames.set(email, String(data.contactName ?? email));
  }));

  const workers = Array.from(workersByEmail.values()).map((worker) => {
    const fallbackAdminEmail = worker.invitedByAdminEmail;
    const fallbackAdminName = worker.invitedByName ||
      (fallbackAdminEmail ? adminNames.get(fallbackAdminEmail) : "") ||
      fallbackAdminEmail ||
      worker.invitedByEmail;
    const projectAssignmentOwners = { ...worker.projectAssignmentOwners };

    worker.assignedProjectIds.forEach((projectId) => {
      const owner = projectAssignmentOwners[projectId];
      if (owner?.adminEmail) {
        projectAssignmentOwners[projectId] = {
          adminEmail: owner.adminEmail,
          adminName: owner.adminName || adminNames.get(owner.adminEmail) || owner.adminEmail,
        };
      } else if (fallbackAdminEmail) {
        projectAssignmentOwners[projectId] = {
          adminEmail: fallbackAdminEmail,
          adminName: fallbackAdminName,
        };
      }
    });

    return {
      ...worker,
      invitedByName: worker.invitedByName || fallbackAdminName,
      projectAssignmentOwners,
    };
  });

  workers.sort((a, b) => a.email.localeCompare(b.email));

  return NextResponse.json({ workers });
}
