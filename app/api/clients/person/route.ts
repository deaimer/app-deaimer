import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

async function verifyUser(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { error: "Unauthorized", status: 401 as const };
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on token", status: 401 as const };
    return { email };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid token", status: 401 as const };
  }
}

export async function GET(req: NextRequest) {
  const gate = await verifyUser(req);
  if ("error" in gate) {
    return NextResponse.json({ person: null });
  }

  const snap = await adminFirestore().doc(`clientPersons/${gate.email}`).get();
  if (!snap.exists) {
    return NextResponse.json({ person: null });
  }

  const data = snap.data()!;
  const companyEmail = normalizeEmail(data.companyEmail ?? "");

  let companyName = "";
  if (companyEmail) {
    const companySnap = await adminFirestore().doc(`clientAccess/${companyEmail}`).get();
    if (companySnap.exists) {
      companyName = String(companySnap.data()?.company ?? "").trim();
    }
  }

  return NextResponse.json({
    person: {
      name: String(data.name ?? ""),
      email: String(data.email ?? gate.email),
      companyEmail,
      companyName,
      passwordUpdated: Boolean(data.passwordUpdated),
      active: Boolean(data.active),
    },
  });
}

export async function PATCH(req: NextRequest) {
  const gate = await verifyUser(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const body = await req.json().catch(() => ({})) as { newPasswordHash?: unknown };
  const newPasswordHash = String(body.newPasswordHash ?? "").trim();

  if (!newPasswordHash) {
    return NextResponse.json({ error: "newPasswordHash is required." }, { status: 400 });
  }

  await adminFirestore().doc(`clientPersons/${gate.email}`).set({
    passwordUpdated: true,
    active: true,
    tempPasswordHash: newPasswordHash,
    updatedAt: new Date(),
  }, { merge: true });

  return NextResponse.json({ ok: true });
}
