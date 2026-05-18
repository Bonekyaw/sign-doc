import { getCachedDoctorList, getCachedRotationTemplates } from "@/lib/data/cached";
import { DoctorManager } from "@/components/doctors/DoctorManager";
import { canWrite, getSession } from "@/lib/auth/guards";

export async function DoctorsContent() {
  const session = await getSession();
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
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
