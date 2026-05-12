import { Suspense } from "react";
import { DCProjectCreateForm } from "@/components/dc-project-create-form";

export default async function EditDCProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense fallback={null}>
      <DCProjectCreateForm projectId={id} />
    </Suspense>
  );
}
