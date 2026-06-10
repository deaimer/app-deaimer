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

async function requireSuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  if (!idToken) return { error: "Unauthorized", status: 401 as const };

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on auth token", status: 401 as const };

    if (BOOTSTRAP_SUPER_ADMIN_EMAILS.has(email)) return { email };

    const snap = await adminFirestore().doc(`superAccess/${email}`).get();
    if (!snap.exists) return { error: "Missing super admin access", status: 403 as const };

    return { email };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Invalid token", status: 401 as const };
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireSuperAdmin(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({})) as {
    email?: unknown;
    tempPassword?: unknown;
    name?: unknown;
    companyEmail?: unknown;
  };
  const email = normalizeEmail(body.email);
  const tempPassword = String(body.tempPassword ?? "").trim();
  const name = String(body.name ?? "").trim();
  const companyEmail = normalizeEmail(body.companyEmail);

  if (!email) return NextResponse.json({ error: "Email is required." }, { status: 400 });
  if (!tempPassword || tempPassword.length < 6) {
    return NextResponse.json({ error: "A valid temp password is required." }, { status: 400 });
  }

  const auth = adminAuth();

  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password: tempPassword });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/user-not-found") {
      await auth.createUser({ email, password: tempPassword, emailVerified: false });
    } else {
      throw err;
    }
  }

  if (companyEmail) {
    await adminFirestore().doc(`clientPersons/${email}`).set({
      name,
      email,
      companyEmail,
      tempPassword,
      tempPasswordHash: "",
      passwordUpdated: false,
      active: false,
      updatedAt: new Date(),
      createdAt: new Date(),
    }, { merge: true });
  }

  return NextResponse.json({ ok: true });
}
