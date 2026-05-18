import { Suspense } from "react";
import { DoctorsContent } from "@/components/doctors/DoctorsContent";
import { DoctorListSkeleton } from "@/components/skeletons/DoctorListSkeleton";

export default function DoctorsPage() {
  return (
    <Suspense fallback={<DoctorListSkeleton />}>
      <DoctorsContent />
    </Suspense>
  );
}
