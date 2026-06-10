import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

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
  const projectId = searchParams.get("projectId") ?? "";
  const uid = searchParams.get("uid") ?? "";

  if (!projectId) return NextResponse.json({ error: "projectId required" }, { status: 400 });
  if (uid !== callerUid) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const db = adminFirestore();
    const participantsSnap = await db
      .collection("videoProjects")
      .doc(projectId)
      .collection("participants")
      .get();

    const demand: Record<string, number> = {};
    const pairings: [string, string][] = [];
    // slotId → list of first names of OTHER participants who booked it
    const slotBookerNames: Record<string, string[]> = {};

    for (const doc of participantsSnap.docs) {
      const docUid = String(doc.data().uid ?? doc.id);
      if (docUid === callerUid || doc.id === callerUid) continue;
      const slots: string[] = Array.isArray(doc.data().selectedSlotIds)
        ? doc.data().selectedSlotIds.map(String).filter(Boolean)
        : [];

      // Derive first name: prefer stored firstName, else parse fullName
      const storedFirst = String(doc.data().firstName ?? "").trim();
      const fullName = String(doc.data().fullName ?? "").trim();
      const firstName = storedFirst || fullName.split(/\s+/)[0] || "Someone";

      for (const slotId of slots) {
        demand[slotId] = (demand[slotId] ?? 0) + 1;
        if (!slotBookerNames[slotId]) slotBookerNames[slotId] = [];
        slotBookerNames[slotId].push(firstName);
      }
      if (slots.length >= 2) {
        pairings.push([slots[0], slots[1]]);
      }
    }

    // Only expose a name when exactly 1 other participant booked the slot
    const slotNames: Record<string, string> = {};
    for (const [slotId, names] of Object.entries(slotBookerNames)) {
      if (names.length === 1) slotNames[slotId] = names[0];
    }

    return NextResponse.json({ demand, pairings, slotNames });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 500 },
    );
  }
}
