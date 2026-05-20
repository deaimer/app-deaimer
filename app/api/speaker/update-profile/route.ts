import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

const ALLOWED_FIELDS = [
  "firstName", "lastName", "name", "dateOfBirth", "age", "ageGroup",
  "gender", "country", "region", "languages", "phoneCountryCode", "phone",
  "deviceCategory", "deviceManufacturer", "deviceModel", "educationLevel",
] as const;

async function generateUniqueSpeakerId(uid: string): Promise<string> {
  const db = adminFirestore();
  for (let attempt = 0; attempt < 20; attempt++) {
    // 5-digit number: 10000–99999
    const id = String(Math.floor(Math.random() * 90000) + 10000);
    const ref = db.doc(`speakerIdIndex/${id}`);
    try {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (snap.exists) throw new Error("taken");
        tx.set(ref, { uid, createdAt: FieldValue.serverTimestamp() });
      });
      return id;
    } catch {
      // collision — try another
    }
  }
  throw new Error("Could not generate a unique speaker ID. Please try again.");
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let uid = "";
  let email = "";
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid ?? "";
    email = decoded.email?.trim().toLowerCase() ?? "";
    if (!uid) throw new Error("No uid in token");
    if (!email) throw new Error("No email in token");
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid token" },
      { status: 401 },
    );
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const db = adminFirestore();
    const profileRef = db.doc(`speakerProfiles/${uid}`);

    const updates: Record<string, unknown> = {
      email,
      updatedAt: FieldValue.serverTimestamp(),
    };
    for (const key of ALLOWED_FIELDS) {
      if (key in body) updates[key] = body[key];
    }

    // Generate a unique 5-digit speaker ID on first profile save
    const existing = await profileRef.get();
    if (!existing.exists || !existing.data()?.speakerId) {
      updates.speakerId = await generateUniqueSpeakerId(uid);
    }

    await profileRef.set(updates, { merge: true });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[update-profile]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 },
    );
  }
}
