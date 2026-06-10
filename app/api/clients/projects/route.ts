import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminFirestore } from "@/lib/firebase/admin";

function normalizeEmail(email: unknown) {
  return String(email ?? "").trim().toLowerCase();
}

async function resolveCompanyName(email: string): Promise<string | null> {
  const clientSnap = await adminFirestore().doc(`clientAccess/${email}`).get();
  if (clientSnap.exists) {
    const name = String(clientSnap.data()?.company ?? "").trim();
    if (name) return name;
  }
  const personSnap = await adminFirestore().doc(`clientPersons/${email}`).get();
  if (personSnap.exists) {
    const companyEmail = normalizeEmail(personSnap.data()?.companyEmail ?? "");
    if (companyEmail) {
      const companySnap = await adminFirestore().doc(`clientAccess/${companyEmail}`).get();
      if (companySnap.exists) {
        const name = String(companySnap.data()?.company ?? "").trim();
        if (name) return name;
      }
    }
  }
  return null;
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const idToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!idToken) return NextResponse.json({ projects: [] });

  let email: string;
  try {
    const decoded = await adminAuth().verifyIdToken(idToken);
    email = normalizeEmail(decoded.email);
    if (!email) return NextResponse.json({ projects: [] });
  } catch {
    return NextResponse.json({ projects: [] });
  }

  const companyName = await resolveCompanyName(email);
  if (!companyName) return NextResponse.json({ projects: [] });

  const snap = await adminFirestore()
    .collection("dcProjects")
    .where("client", "==", companyName)
    .get();

  const projects = snap.docs
    .map((d) => {
      const data = d.data();
      const mode =
        data.recordingMode === "video"
          ? "video"
          : data.recordingMode === "conversational" || Boolean(data.isConversational)
            ? "conversational"
            : "utterance";
      return {
        id: d.id,
        name: String(data.name ?? ""),
        recordingMode: mode as "video" | "conversational" | "utterance",
        status: String(data.status ?? "active"),
        summary: String(data.summary ?? data.description ?? ""),
        client: companyName,
      };
    })
    .filter((p) => p.name);

  return NextResponse.json({ projects });
}
