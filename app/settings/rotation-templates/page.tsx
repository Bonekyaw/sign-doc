import { Suspense } from "react";
import { RotationTemplatesContent } from "@/components/settings/RotationTemplatesContent";
import { SettingsFormSkeleton } from "@/components/skeletons/SettingsFormSkeleton";

export default function RotationTemplatesPage() {
  return (
    <Suspense fallback={<SettingsFormSkeleton rows={3} />}>
      <RotationTemplatesContent />
    </Suspense>
  );
}
