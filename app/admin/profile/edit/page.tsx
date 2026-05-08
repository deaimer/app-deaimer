import { Suspense } from "react";
import { AdminPlatformShell } from "@/components/admin-platform-shell";

export default function AdminProfileEditPage() {
  return (
    <Suspense fallback={null}>
      <AdminPlatformShell />
    </Suspense>
  );
}
