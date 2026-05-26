import type { PortalRole } from "@/lib/auth/portal-config";

const BOOTSTRAP_SUPER_ADMIN_EMAILS = [
  "deaimerpvt@gmail.com",
  "ms.awan@deaimer.com",
  "jannatawan12390@gmail.com",
  "shehryarsta460@gmail.com",
] as const;

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

/** UX-only gate for non-portal components (ops-shell, admin-workspace, etc.).
 *  Real access is enforced by Firestore rules via the superAccess collection. */
export function isSuperAdminEmail(email: string | null | undefined) {
  return BOOTSTRAP_SUPER_ADMIN_EMAILS.some((e) => e === normalizeEmail(email));
}

export function isRoleEmailLocked(role: PortalRole) {
  return role === "super";
}

export function isEmailAllowedForRole(
  role: PortalRole,
  _email: string | null | undefined,
) {
  if (role === "super") {
    // Enforced by Firestore rules via the superAccess collection — allow client-side
    return true;
  }

  return true;
}

export function getRoleAccessMessage(role: PortalRole) {
  if (role === "super" || role === "admin") {
    return null;
  }

  return null;
}

export function getLockedProfileEmail(
  role: PortalRole,
  email: string | null | undefined,
) {
  if (role === "super") {
    return normalizeEmail(email);
  }

  return email ?? "";
}
