import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

const ALLOWED_FIELDS = [
  "firstName", "lastName", "name", "dateOfBirth", "age",
  "gender", "country", "region", "languages", "phoneCountryCode", "phone",
] as const;

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid: string;
  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid;
    email = decoded.email?.trim().toLowerCase() ?? "";
    if (!email) throw new Error("No email in token");
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const body = await req.json() as Record<string, unknown>;

  const updates: Record<string, unknown> = {
    email,
    updatedAt: FieldValue.serverTimestamp(),
  };
  for (const key of ALLOWED_FIELDS) {
    if (key in body) updates[key] = body[key];
  }

  await adminFirestore().doc(`speakerProfiles/${uid}`).set(updates, { merge: true });

  return NextResponse.json({ ok: true });
}
