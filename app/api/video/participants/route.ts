import { NextRequest, NextResponse } from "next/server";
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

async function getCallerEmail(req: NextRequest): Promise<{ email: string; uid: string } | { error: string; status: 401 | 403 }> {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { error: "Unauthorized", status: 401 };
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on token", status: 401 };
    return { email, uid: decoded.uid };
  } catch {
    return { error: "Invalid token", status: 401 };
  }
}

async function isSuperAdmin(email: string): Promise<boolean> {
  if (BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email)) return true;
  const snap = await adminFirestore().doc(`superAccess/${email}`).get();
  return snap.exists;
}

export async function DELETE(req: NextRequest) {
  const caller = await getCallerEmail(req);
  if ("error" in caller) return NextResponse.json({ error: caller.error }, { status: caller.status });

  const body = await req.json() as { projectId?: string; participantId?: string };
  const projectId = String(body.projectId ?? "").trim();
  const participantId = String(body.participantId ?? "").trim();
  if (!projectId || !participantId) {
    return NextResponse.json({ error: "projectId and participantId are required" }, { status: 400 });
  }

  const db = adminFirestore();
  const participantRef = db.doc(`videoProjects/${projectId}/participants/${participantId}`);

  const superAdmin = await isSuperAdmin(caller.email);
  if (!superAdmin) {
    const snap = await participantRef.get();
    if (!snap.exists) return NextResponse.json({ error: "Participant not found" }, { status: 404 });
    const addedBy = normalizeEmail(snap.data()?.addedByEmail);
    if (addedBy !== caller.email) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  await participantRef.delete();
  return NextResponse.json({ ok: true });
}
