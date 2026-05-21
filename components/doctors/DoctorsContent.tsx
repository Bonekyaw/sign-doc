import { listDoctors } from "@/app/actions/doctors";
import { getCachedRotationTemplates } from "@/lib/data/cached";
import { DoctorManager } from "@/components/doctors/DoctorManager";
import { canWrite, getSession } from "@/lib/auth/guards";
import { loadSchedulingRules } from "@/lib/scheduling/context";
import { DEFAULT_SCHEDULING_RULES } from "@/lib/scheduling/rules-types";
import { connection } from "next/server";

export async function DoctorsContent() {
  await connection();
  const session = await getSession();

  let schedulingRules = DEFAULT_SCHEDULING_RULES;
  try {
    schedulingRules = await loadSchedulingRules();
  } catch (err) {
    console.error("Failed to load scheduling rules for doctors page:", err);
  }

  const [doctors, rotationTemplates] = await Promise.all([
    listDoctors(),
    getCachedRotationTemplates(),
  ]);

  return (
    <DoctorManager
      doctors={doctors}
      rotationTemplates={rotationTemplates.map((t) => ({
        id: t.id,
        name: t.name,
      }))}
      schedulingRules={schedulingRules}
      canWrite={session ? canWrite(session.role) : false}
    />
  );
}
