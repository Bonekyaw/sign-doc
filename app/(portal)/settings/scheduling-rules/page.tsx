import { Suspense } from "react";
import { SchedulingRulesContent } from "@/components/settings/SchedulingRulesContent";
import { SettingsFormSkeleton } from "@/components/skeletons/SettingsFormSkeleton";

export default function SchedulingRulesPage() {
  return (
    <Suspense fallback={<SettingsFormSkeleton rows={8} />}>
      <SchedulingRulesContent />
    </Suspense>
  );
}
