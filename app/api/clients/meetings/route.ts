import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

async function verifyClient(req: NextRequest): Promise<{ email: string } | { error: string }> {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return { error: "Unauthorized" };
  try {
    const decoded = await adminAuth().verifyIdToken(token);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on token" };
    return { email };
  } catch {
    return { error: "Invalid token" };
  }
}

async function resolveCompanyName(email: string): Promise<string | null> {
  const snap = await adminFirestore().doc(`clientAccess/${email}`).get();
  if (snap.exists) return String(snap.data()?.company ?? "").trim() || null;
  const pSnap = await adminFirestore().doc(`clientPersons/${email}`).get();
  if (pSnap.exists) {
    const companyEmail = normalizeEmail(pSnap.data()?.companyEmail ?? "");
    if (companyEmail) {
      const cSnap = await adminFirestore().doc(`clientAccess/${companyEmail}`).get();
      if (cSnap.exists) return String(cSnap.data()?.company ?? "").trim() || null;
    }
  }
  return null;
}

// POST — create a new meeting record for a filled slot
export async function POST(req: NextRequest) {
  const auth = await verifyClient(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? "").trim();
  const slotId    = String(body.slotId ?? "").trim();
  const meetingUrl = String(body.meetingUrl ?? "").trim();
  const pAUid  = String(body.pAUid ?? "").trim();
  const pAName = String(body.pAName ?? "").trim();
  const pBUid  = String(body.pBUid ?? "").trim();
  const pBName = String(body.pBName ?? "").trim();

  if (!projectId || !slotId) {
    return NextResponse.json({ error: "projectId and slotId are required." }, { status: 400 });
  }

  // Verify the project belongs to this client's company
  const companyName = await resolveCompanyName(auth.email);
  if (companyName) {
    const proj = await adminFirestore().doc(`videoProjects/${projectId}`).get();
    if (!proj.exists || proj.data()?.companyName !== companyName) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Parse date/time from slotId ("YYYY-MM-DD-TIME")
  const parts = slotId.split("-");
  const slotDate = parts.slice(0, 3).join("-");
  const slotTime = parts[3] ?? "";

  await adminFirestore().collection(`videoProjects/${projectId}/meetings`).add({
    projectId,
    slotId,
    date: slotDate,
    time: slotTime,
    participantAUid: pAUid,
    participantBUid: pBUid,
    participantAName: pAName,
    participantBName: pBName,
    meetingUrl,
    notes: "",
    clientStatus: meetingUrl ? "meeting_booked" : "under_review",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  return NextResponse.json({ ok: true });
}

// PATCH — update meetingUrl and/or clientStatus on an existing meeting
export async function PATCH(req: NextRequest) {
  const auth = await verifyClient(req);
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: 401 });

  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const projectId = String(body.projectId ?? "").trim();
  const meetingId = String(body.meetingId ?? "").trim();

  if (!projectId || !meetingId) {
    return NextResponse.json({ error: "projectId and meetingId are required." }, { status: 400 });
  }

  const update: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if ("meetingUrl" in body) {
    const url = String(body.meetingUrl ?? "").trim();
    update.meetingUrl = url;
    if (url) update.clientStatus = "meeting_booked";
  }
  if ("clientStatus" in body) {
    const allowed = ["under_review", "meeting_booked", "session_approved", "session_rejected", "no_show_up"];
    if (allowed.includes(String(body.clientStatus))) {
      update.clientStatus = body.clientStatus;
    }
  }

  await adminFirestore().doc(`videoProjects/${projectId}/meetings/${meetingId}`).update(update);
  return NextResponse.json({ ok: true });
}
