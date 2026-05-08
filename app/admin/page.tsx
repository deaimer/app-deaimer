import { Suspense } from "react";
import { AdminPlatformShell } from "@/components/admin-platform-shell";

export default function AdminPage() {
  return (
    <Suspense fallback={null}>
      <AdminPlatformShell />
    </Suspense>
  );
}
