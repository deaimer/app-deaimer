import { Suspense } from "react";
import { DCProjectCreateForm } from "@/components/dc-project-create-form";

export default function CreateDCProjectPage() {
  return (
    <Suspense fallback={null}>
      <DCProjectCreateForm />
    </Suspense>
  );
}
