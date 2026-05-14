import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function parseAdminPrivateKey(raw: string | undefined): string {
  if (!raw) return "";
  // Strip surrounding quotes that appear when the key is copied with the JSON
  // string delimiters (e.g. pasted from the Firebase service-account JSON as-is)
  const stripped = raw.startsWith('"') && raw.endsWith('"')
    ? raw.slice(1, -1)
    : raw;
  // Convert escaped \n sequences back to real newlines
  return stripped.replace(/\\n/g, "\n");
}

function getAdminApp() {
  if (getApps().length > 0) return getApps()[0]!;
  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: parseAdminPrivateKey(process.env.FIREBASE_ADMIN_PRIVATE_KEY),
    }),
  });
}

export function adminAuth() {
  return getAuth(getAdminApp());
}

export function adminFirestore() {
  return getFirestore(getAdminApp());
}
