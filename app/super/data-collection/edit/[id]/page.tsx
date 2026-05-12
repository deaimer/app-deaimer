import { Suspense } from "react";
import { DCProjectCreateForm } from "@/components/dc-project-create-form";

export default function EditDCProjectPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={null}>
      <DCProjectCreateForm projectId={params.id} />
    </Suspense>
  );
}
