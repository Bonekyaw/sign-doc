import { getCachedDoctorList, getCachedRotationTemplates } from "@/lib/data/cached";
import { DoctorManager } from "@/components/doctors/DoctorManager";

export async function DoctorsContent() {
  const [doctors, rotationTemplates] = await Promise.all([
    getCachedDoctorList(),
    getCachedRotationTemplates(),
  ]);

  return (
    <DoctorManager
      doctors={doctors}
      rotationTemplates={rotationTemplates.map((t) => ({
        id: t.id,
        name: t.name,
      }))}
    />
  );
}
