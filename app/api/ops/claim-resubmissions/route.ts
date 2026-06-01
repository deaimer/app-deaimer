import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

async function requireOpsWorker(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return { error: "Unauthorized", status: 401 as const };

  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    const email = normalizeEmail(decoded.email);
    if (!email) return { error: "No email on token", status: 401 as const };

    const workerSnap = await adminFirestore().doc(`opsWorkers/${email}`).get();
    if (!workerSnap.exists || workerSnap.data()?.status !== "active") {
      return { error: "Not an active ops worker", status: 403 as const };
    }
    return { email, worker: workerSnap.data()! };
  } catch {
    return { error: "Invalid token", status: 401 as const };
  }
}

export async function POST(req: NextRequest) {
  const gate = await requireOpsWorker(req);
  if ("error" in gate) {
    return NextResponse.json({ error: gate.error }, { status: gate.status });
  }

  const { email, worker } = gate;
  const db = adminFirestore();
  const projectIds: string[] = worker.assignedProjectIds ?? [];

  if (projectIds.length === 0) return NextResponse.json({ claimed: 0 });

  // Step 1: Find all sessions already assigned to this worker as QA that are rejected
  const rejectedSnap = await db
    .collection("dcSessions")
    .where("assignedQAEmail", "==", email)
    .where("qaStatus", "==", "rejected")
    .get();

  if (rejectedSnap.empty) return NextResponse.json({ claimed: 0 });

  // Build a lookup of rejected sessions by project+task+promptIndex
  type RejKey = string;
  const rejectedByKey = new Map<RejKey, number>(); // key -> submissionCount
  for (const doc of rejectedSnap.docs) {
    const d = doc.data();
    const key = `${d.projectId}|${d.taskId ?? ""}|${d.promptIndex ?? ""}`;
    const existing = rejectedByKey.get(key) ?? -1;
    if ((d.submissionCount ?? 0) > existing) {
      rejectedByKey.set(key, d.submissionCount ?? 0);
    }
  }

  // Step 2: For each project, get pending sessions and find unassigned re-submissions
  const batch = db.batch();
  let claimed = 0;

  for (const projectId of projectIds) {
    const pendingSnap = await db
      .collection("dcSessions")
      .where("projectId", "==", projectId)
      .where("qaStatus", "==", "pending")
      .get();

    for (const pendingDoc of pendingSnap.docs) {
      const d = pendingDoc.data();

      // Skip if already assigned to anyone
      if (d.assignedQAEmail) continue;

      // Skip if not a re-submission
      const subCount = d.submissionCount ?? 0;
      if (subCount === 0) continue;

      // Check if a rejected version exists for the same prompt assigned to this worker
      const key = `${projectId}|${d.taskId ?? ""}|${d.promptIndex ?? ""}`;
      const rejSubCount = rejectedByKey.get(key);
      if (rejSubCount === undefined) continue;

      // Only claim if this session is newer than the rejected one
      if (subCount > rejSubCount) {
        batch.update(pendingDoc.ref, {
          assignedQAEmail: email,
          updatedAt: FieldValue.serverTimestamp(),
        });
        claimed++;
      }
    }
  }

  if (claimed > 0) await batch.commit();

  return NextResponse.json({ claimed });
}
