import type { PortalRole } from "@/lib/auth/portal-config";

export const SUPER_ADMIN_EMAILS = [
  "deaimerpvt@gmail.com",
  "ms.awan@deaimer.com",
] as const;

export function normalizeEmail(email: string | null | undefined) {
  return (email ?? "").trim().toLowerCase();
}

export function isSuperAdminEmail(email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email);
  return SUPER_ADMIN_EMAILS.some((entry) => entry === normalizedEmail);
}

export function isRoleEmailLocked(role: PortalRole) {
  return role === "super";
}

export function isEmailAllowedForRole(
  role: PortalRole,
  email: string | null | undefined,
) {
  if (role === "super") {
    return isSuperAdminEmail(email);
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
