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

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({})) as {
    jobId?: unknown;
    adminEmails?: unknown;
  };
  const jobId = String(body.jobId ?? "").trim();
  const adminEmails = Array.isArray(body.adminEmails)
    ? Array.from(new Set(body.adminEmails.map(normalizeEmail).filter(Boolean)))
    : [];

  if (!jobId) {
    return NextResponse.json({ error: "Job ID is required." }, { status: 400 });
  }

  const db = adminFirestore();
  let jobRef = db.doc(`globalWorkforce/workspace/jobPosts/${jobId}`);
  let jobSnapshot = await jobRef.get();

  if (!jobSnapshot.exists) {
    const matchingJobs = await db
      .collection("globalWorkforce/workspace/jobPosts")
      .where("jobId", "==", jobId)
      .limit(1)
      .get();

    if (!matchingJobs.empty) {
      jobRef = matchingJobs.docs[0].ref;
      jobSnapshot = matchingJobs.docs[0];
    }
  }

  if (!jobSnapshot.exists) {
    return NextResponse.json({ error: "Job post was not found." }, { status: 404 });
  }

  await jobRef.update({
    assignedAdminEmails: adminEmails,
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}
