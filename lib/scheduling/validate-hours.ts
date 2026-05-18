import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

export function validateHours(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  additionalHours: number,
): string | null {
  const worked = computeMonthlyHours(doctor.id, monthKeys, existingShifts);
  if (worked + additionalHours > doctor.targetHours) {
    return `${doctor.name} would exceed their monthly hour limit (${doctor.targetHours}h).`;
  }
  return null;
}
