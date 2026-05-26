import { getFirebaseClientServices } from "@/lib/firebase/client";

export async function requestSuperApi<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { auth } = getFirebaseClientServices();
  const token = await auth.currentUser?.getIdToken();

  if (!token) {
    throw new Error("Sign in as a super admin first.");
  }

  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof payload.error === "string"
        ? payload.error
        : "Could not load super admin access records.",
    );
  }

  return payload as T;
}

export function requestSuperAccessApi<T>(init?: RequestInit): Promise<T> {
  return requestSuperApi<T>("/api/super/access", init);
}
