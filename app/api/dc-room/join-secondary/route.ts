import { FieldValue } from "firebase-admin/firestore";
import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let email = "";
  let uid = "";
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    uid = decoded.uid ?? "";
    email = decoded.email?.trim().toLowerCase() ?? "";
    if (!uid || !email) throw new Error("No uid or email in token");
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  try {
    const body = await req.json() as { name?: string };
    await adminFirestore().doc(`speakerAccess/${email}`).set(
      {
        email,
        uid,
        name: body.name ?? "",
        status: "active",
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[join-secondary]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 },
    );
  }
}
