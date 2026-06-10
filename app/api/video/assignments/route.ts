import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let callerUid: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    callerUid = decoded.uid;
  } catch {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const uid = searchParams.get("uid") ?? "";
  const email = normalizeEmail(searchParams.get("email") ?? "");

  if (uid !== callerUid) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const db = adminFirestore();

    const projectsSnap = await db.collection("videoProjects").get();

    const assignments: Array<{
      project: Record<string, unknown>;
      participant: Record<string, unknown>;
      meetings: Record<string, unknown>[];
    }> = [];

    await Promise.all(
      projectsSnap.docs.map(async (projectDoc) => {
        const projectId = projectDoc.id;

        const lookups = [
          uid ? db.doc(`videoProjects/${projectId}/participants/${uid}`).get() : null,
          email ? db.doc(`videoProjects/${projectId}/participants/${email}`).get() : null,
        ].filter((p): p is Promise<FirebaseFirestore.DocumentSnapshot> => p !== null);

        const snaps = await Promise.all(lookups);
        const found = snaps.find((s) => s.exists) ?? null;
        if (!found) return;

        const data = found.data()!;
        const pd = projectDoc.data();

        const selectedSlotIds: string[] = Array.isArray(data.selectedSlotIds)
          ? data.selectedSlotIds.map(String).filter(Boolean)
          : [];

        // Fetch meeting records for the participant's confirmed slots
        let meetings: Record<string, unknown>[] = [];
        if (selectedSlotIds.length > 0) {
          const meetingsSnap = await db
            .collection(`videoProjects/${projectId}/meetings`)
            .where("slotId", "in", selectedSlotIds)
            .get();
          meetings = meetingsSnap.docs.map((m) => ({
            id: m.id,
            slotId: String(m.data().slotId ?? ""),
            meetingUrl: String(m.data().meetingUrl ?? ""),
            clientStatus: String(m.data().clientStatus ?? "under_review"),
            participantAUid: String(m.data().participantAUid ?? ""),
            participantBUid: String(m.data().participantBUid ?? ""),
            participantAName: String(m.data().participantAName ?? ""),
            participantBName: String(m.data().participantBName ?? ""),
          }));
        }

        assignments.push({
          project: {
            id: projectId,
            title: String(pd.title ?? ""),
            jobDescription: String(pd.jobDescription ?? ""),
            companyId: String(pd.companyId ?? ""),
            companyName: String(pd.companyName ?? ""),
            assignedAdminEmails: Array.isArray(pd.assignedAdminEmails) ? pd.assignedAdminEmails.map(String) : [],
            assignedAdminUids: Array.isArray(pd.assignedAdminUids) ? pd.assignedAdminUids.map(String) : [],
            status: pd.status === "paused" || pd.status === "completed" ? pd.status : "active",
          },
          participant: {
            id: found.id,
            projectId,
            uid: String(data.uid ?? found.id),
            email: normalizeEmail(data.email),
            fullName: String(data.fullName ?? ""),
            source: data.source === "super" ? "super" : "admin",
            addedByEmail: normalizeEmail(data.addedByEmail),
            addedByUid: String(data.addedByUid ?? ""),
            selectedSlotIds,
            schedulingNotes: String(data.schedulingNotes ?? ""),
          },
          meetings,
        });
      }),
    );

    return NextResponse.json({ assignments });
  } catch (err) {
    console.error("[api/video/assignments]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
