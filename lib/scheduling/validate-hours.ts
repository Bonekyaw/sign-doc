import { computeMonthlyHours } from "@/lib/scheduling/compute-hours";
import { dateKey } from "@/lib/scheduling/dates";
import type { DoctorInfo, ShiftAssignment } from "@/lib/scheduling/types";

export function validateHours(
  doctor: DoctorInfo,
  monthKeys: string[],
  existingShifts: ShiftAssignment[],
  additionalHours: number,
  /** When reassigning a day, ignore any shift already stored for that date. */
  replaceDate?: Date,
): string | null {
  const replaceKey = replaceDate ? dateKey(replaceDate) : null;
  const shiftsForTotal = replaceKey
    ? existingShifts.filter(
        (s) =>
          !(
            s.doctorId === doctor.id && dateKey(s.date) === replaceKey
          ),
      )
    : existingShifts;
  const worked = computeMonthlyHours(doctor.id, monthKeys, shiftsForTotal);
  if (worked + additionalHours > doctor.targetHours) {
    return `${doctor.name} would exceed their monthly hour limit (${doctor.targetHours}h).`;
  }
  return null;
}
