import { Suspense } from "react";
import { ShiftTypesContent } from "@/components/settings/ShiftTypesContent";
import { SettingsFormSkeleton } from "@/components/skeletons/SettingsFormSkeleton";

export default function ShiftTypesPage() {
  return (
    <Suspense fallback={<SettingsFormSkeleton />}>
      <ShiftTypesContent />
    </Suspense>
  );
}
