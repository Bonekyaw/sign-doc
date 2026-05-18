import { Suspense } from "react";
import { UsersContent } from "@/components/settings/UsersContent";
import { SettingsFormSkeleton } from "@/components/skeletons/SettingsFormSkeleton";

export default function UsersPage() {
  return (
    <Suspense fallback={<SettingsFormSkeleton rows={5} />}>
      <UsersContent />
    </Suspense>
  );
}
